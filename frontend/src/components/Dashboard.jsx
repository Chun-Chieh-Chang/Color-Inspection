import { useState, useEffect, useRef } from 'react';
import { ProcessingEngine } from '../core/processor';

export default function Dashboard() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const uploadedImgRef = useRef(null);
  const containerRef = useRef(null);
  
  const [stream, setStream] = useState(null);
  const [uploadedImageSrc, setUploadedImageSrc] = useState(null);
  const [sourceType, setSourceType] = useState('camera'); 
  
  const [results, setResults] = useState(null);
  const [lockedStandard, setLockedStandard] = useState(null);
  
  const [rois, setRois] = useState({
    ref: { x: 50, y: 50, w: 100, h: 100 },      
    standard: { x: 200, y: 200, w: 150, h: 150 }, 
    test: { x: 400, y: 200, w: 150, h: 150 },     
  });
  const [imageSize, setImageSize] = useState({ w: 1920, h: 1080 });

  const [selectionMode, setSelectionMode] = useState(null); 
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState({ x: 0, y: 0 });
  const [currentRect, setCurrentRect] = useState(null); 
  const [cvReady, setCvReady] = useState(false);

  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: { width: 1920, height: 1080 } })
        .then(s => {
            setStream(s);
            if(videoRef.current) {
                videoRef.current.srcObject = s;
                videoRef.current.onloadedmetadata = () => {
                   setImageSize({ w: videoRef.current.videoWidth, h: videoRef.current.videoHeight });
                };
            }
        })
        .catch(() => setSourceType('upload'));

    const interval = setInterval(() => { if (window.cv && window.cv.Mat) { setCvReady(true); clearInterval(interval); } }, 500);
    return () => clearInterval(interval);
  }, []);

  const handleFileUpload = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
          setUploadedImageSrc(evt.target.result);
          setSourceType('upload');
          const img = new Image();
          img.onload = () => { uploadedImgRef.current = img; setImageSize({ w: img.width, h: img.height }); };
          img.src = evt.target.result;
      };
      reader.readAsDataURL(file);
  };

  /** MOUSE ROI LOGIC **/
  const getEventPos = (e) => {
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      return { x, y, rect };
  };
  const handleMouseDown = (e) => {
      if (!selectionMode || !containerRef.current) return;
      e.preventDefault();
      const { x, y } = getEventPos(e);
      setIsDrawing(true);
      setDrawStart({ x, y });
      setCurrentRect({ x, y, w: 0, h: 0 });
  };
  const handleMouseMove = (e) => {
      if (!isDrawing || !containerRef.current) return;
      e.preventDefault();
      const { x, y } = getEventPos(e);
      const w = x - drawStart.x;
      const h = y - drawStart.y;
      setCurrentRect({ x: w > 0 ? drawStart.x : x, y: h > 0 ? drawStart.y : y, w: Math.abs(w), h: Math.abs(h) });
  };
  const handleMouseUp = (e) => {
      if (!isDrawing || !selectionMode || !containerRef.current) return;
      e.preventDefault();
      setIsDrawing(false);
      const { rect } = getEventPos(e);
      const scaleX = imageSize.w / rect.width;
      const scaleY = imageSize.h / rect.height;
      if (currentRect && currentRect.w > 5 && currentRect.h > 5) {
          const finalRect = { x: Math.round(currentRect.x * scaleX), y: Math.round(currentRect.y * scaleY), w: Math.round(currentRect.w * scaleX), h: Math.round(currentRect.h * scaleY) };
          setRois(prev => ({ ...prev, [selectionMode]: finalRect }));
          setSelectionMode(null); 
      }
      setCurrentRect(null);
  };

  const captureFrame = () => {
    if (!canvasRef.current || !cvReady) return null;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (sourceType === 'camera' && videoRef.current && videoRef.current.readyState === 4) {
        canvas.width = videoRef.current.videoWidth; canvas.height = videoRef.current.videoHeight;
        ctx.drawImage(videoRef.current, 0, 0);
    } else if (sourceType === 'upload' && uploadedImgRef.current) {
        canvas.width = uploadedImgRef.current.width; canvas.height = uploadedImgRef.current.height;
        ctx.drawImage(uploadedImgRef.current, 0, 0);
    } else { return null; }
    
    try {
        let src = cv.imread(canvasRef.current);
        let rgb = new cv.Mat();
        if (src.channels() === 4) cv.cvtColor(src, rgb, cv.COLOR_RGBA2RGB);
        else if (src.channels() === 1) cv.cvtColor(src, rgb, cv.COLOR_GRAY2RGB);
        else src.copyTo(rgb);
        src.delete(); return rgb;
    } catch(e) { console.error(e); return null; }
  };

  const lockStandard = () => {
      let mat = captureFrame();
      if (!mat) return alert("Please load an image first!");
      try {
          if (rois.ref.w <= 0 || rois.standard.w <= 0) throw new Error("Please draw boxes for Color Card and Standard Product first.");
          let calibrated = ProcessingEngine.calibrateImage(mat, rois.ref);
          let resStd = ProcessingEngine.calculateDeltaE(calibrated, null, rois.standard);
          cv.imshow(canvasRef.current, calibrated);
          let thumb = canvasRef.current.toDataURL('image/jpeg', 0.5);
          setLockedStandard({ lab: resStd.lab, image: thumb });
          alert("Success: Standard Product values saved.\nNow you can load a different image to test other products.");
          calibrated.delete();
      } catch(e) { alert(e.message); } finally { mat.delete(); }
  };

  const analyze = () => {
      let mat = captureFrame();
      if (!mat) return alert("Please load an image first!");
      try {
          if (rois.ref.w <= 0) throw new Error("Please draw a box for the Color Card (needed for every photo).");
          let calibrated = ProcessingEngine.calibrateImage(mat, rois.ref);

          let labStd;
          if (lockedStandard) {
              labStd = lockedStandard.lab;
          } else {
              if (rois.standard.w <= 0) throw new Error("Please draw the Standard Product box.");
              let resStd = ProcessingEngine.calculateDeltaE(calibrated, null, rois.standard);
              labStd = resStd.lab;
          }

          if (rois.test.w <= 0) throw new Error("Please draw the Test Product box.");
          let resTest = ProcessingEngine.calculateDeltaE(calibrated, labStd, rois.test);
          
          let transparencyDiff = Math.abs(labStd[0] - resTest.lab[0]); 
          
          setResults({
              delta_e: resTest.deltaE,
              contrast_diff: transparencyDiff, 
              lab_std: labStd,
              lab_test: resTest.lab,
              passed: resTest.deltaE < 2.0
          });
          calibrated.delete();
      } catch(e) { console.error(e); alert(e.message); } finally { mat.delete(); }
  };

  const DisplayArea = () => (
      <div ref={containerRef} className={`relative border border-white/10 rounded-2xl overflow-hidden bg-black shadow-2xl flex items-center justify-center select-none cursor-${selectionMode ? 'crosshair' : 'default'} touch-none`}
        onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} style={{ minHeight: '400px' }}>
          {sourceType === 'camera' && stream ? <video ref={videoRef} autoPlay playsInline className="max-w-full max-h-[60vh] pointer-events-none" /> :
           sourceType === 'upload' && uploadedImageSrc ? <img src={uploadedImageSrc} className="max-w-full max-h-[60vh] object-contain pointer-events-none" /> :
           <div className="p-20 text-art-muted flex flex-col items-center animate-pulse pointer-events-none"><span className="text-6xl mb-4">📷 / 📁</span><span className="text-xl font-bold">Step 1: Load Image</span><span className="text-xs mt-2">Click 'Load New Image' below</span></div>}
          
          {containerRef.current && (sourceType === 'upload' || stream) && Object.entries(rois).map(([key, r]) => {
                const colors = { ref: 'yellow-400', standard: 'cyan-400', test: 'purple-400' };
                // If standard is locked, show Standard ROI dashed/dimmed
                const isLocked = key === 'standard' && lockedStandard;
                return (<div key={key} className={`absolute border-2 ${key===selectionMode?'animate-pulse':''} border-${colors[key]||'white'} ${isLocked?'opacity-40 border-dashed':''}`}
                    style={{ left: r.x * (containerRef.current.getBoundingClientRect().width / imageSize.w), top: r.y * (containerRef.current.getBoundingClientRect().height / imageSize.h), width: r.w * (containerRef.current.getBoundingClientRect().width / imageSize.w), height: r.h * (containerRef.current.getBoundingClientRect().height / imageSize.h), pointerEvents: 'none' }}>
                    <span className={`bg-${colors[key]||'white'}/80 text-black px-1 absolute -top-5 left-0 text-[10px] font-bold whitespace-nowrap`}>{key.toUpperCase()}{isLocked?' (LOCKED)':''}</span></div>);
           })}
           {isDrawing && currentRect && <div className="absolute border-2 border-green-400 bg-green-400/20" style={{ left: currentRect.x, top: currentRect.y, width: currentRect.w, height: currentRect.h, pointerEvents: 'none' }}></div>}
           {selectionMode && !isDrawing && <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/80 px-4 py-2 rounded-full text-white text-xs border border-white/20 animate-bounce pointer-events-none shadow-lg">🖌️ Please Draw Box for: <span className="font-bold text-green-400 text-lg ml-2">{selectionMode.toUpperCase()}</span></div>}
      </div>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 p-6 max-h-screen overflow-auto">
      <canvas ref={canvasRef} className="hidden"></canvas>
      <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept="image/*" />
      
      <div className="lg:col-span-2 space-y-6">
        <DisplayArea />
        <div className="flex flex-wrap gap-4 justify-center">
            <button onClick={() => fileInputRef.current.click()} className="btn-secondary flex items-center gap-2 text-lg px-6">📁 Load New Image</button>
            {stream && <button onClick={() => setSourceType('camera')} className="btn-secondary">📷 Camera</button>}
        </div>
        
        <div className="glass-panel p-6">
            <h3 className="text-sm font-bold text-art-muted uppercase mb-4 text-center">Step 2: Draw Regions of Interest</h3>
            <div className="grid grid-cols-3 gap-3">
                {[
                    { k: 'ref', label: '1. Color Card', color: 'text-yellow-400', desc: 'Required (Every Photo)' },
                    { k: 'standard', label: '2. Standard', color: 'text-cyan-400', desc: 'Target Object' },
                    { k: 'test', label: '3. Test Product', color: 'text-purple-400', desc: 'Sample to Check' }
                ].map(tool => (
                    <button key={tool.k} onClick={() => setSelectionMode(selectionMode === tool.k ? null : tool.k)} disabled={lockedStandard && tool.k === 'standard'}
                        className={`p-4 rounded-xl border transition-all ${selectionMode === tool.k ? 'bg-white/20 ring-2 ring-white' : 'bg-white/5 hover:bg-white/10'} border-white/10 disabled:opacity-30 disabled:cursor-not-allowed`}>
                        <div className={`text-sm font-bold ${tool.color}`}>{tool.label}</div>
                        <div className="text-[10px] text-art-muted mt-1">{tool.desc}</div>
                    </button>
                ))}
            </div>
            {lockedStandard && <div className="mt-2 text-center text-xs text-cyan-400 bg-cyan-900/30 p-2 rounded border border-cyan-500/30">🔒 Standard Product is LOCKED. ROI 2 is disabled.</div>}
        </div>

        <div className="flex gap-4 justify-center mt-4">
             {/* Mode Toggle */}
             <button onClick={lockedStandard ? () => setLockedStandard(null) : lockStandard} className={`btn-secondary ${lockedStandard ? 'border-red-400 text-red-200' : 'border-cyan-400 text-cyan-200'} w-48`}>
                {lockedStandard ? '🔓 Unlock / Reset' : '🔒 Lock Standard'}
             </button>
             
             <button onClick={analyze} disabled={!cvReady} className="btn-primary px-12 py-4 text-xl shadow-cyan-500/50 shadow-2xl disabled:opacity-50 w-64">
                🔍 INSPECT
            </button>
        </div>
        <p className="text-center text-xs text-art-muted mt-2 opacity-60">Tip: Start by drawing the Standard Product box, then Lock it if checking multiple items.</p>
      </div>

      <div className="space-y-6">
        <div className="glass-panel p-8 text-center bg-gradient-to-b from-white/5 to-transparent">
            <h3 className="text-xl text-art-muted uppercase tracking-widest mb-4">Final Result</h3>
            {results ? (<div className={`text-6xl font-black ${results.passed ? 'text-art-success drop-shadow-[0_0_20px_rgba(74,222,128,0.5)]' : 'text-art-fail drop-shadow-[0_0_20px_rgba(248,113,113,0.5)]'}`}>{results.passed ? 'PASS' : 'FAIL'}</div>) : <div className="text-4xl font-bold text-white/10">READY</div>}
        </div>
        
        <div className="grid grid-cols-1 gap-4">
             {lockedStandard && (
                 <div className="glass-panel p-3 flex items-center gap-4 bg-cyan-900/20 border-cyan-500/30">
                     <img src={lockedStandard.image} className="w-16 h-16 rounded bg-black object-contain border border-cyan-500/50" />
                     <div>
                         <div className="text-xs text-cyan-400 font-bold uppercase mb-1">Active Standard</div>
                         <div className="text-[10px] text-art-muted">Using saved values from previous image.</div>
                     </div>
                 </div>
             )}
             
             <div className="metric-card">
                <span className="text-art-muted text-sm uppercase">Delta E (Color Diff)</span>
                <span className="text-6xl font-black tracking-tight mt-2">{results ? results.delta_e.toFixed(2) : '--'}</span>
                <div className="w-full bg-gray-700 h-2 rounded-full mt-4 overflow-hidden">
                    <div className={`h-full ${!results ? 'w-0' : results.delta_e < 2 ? 'bg-green-400' : 'bg-red-500'}`} style={{width: results ? `${Math.min(100, results.delta_e * 20)}%` : '0%'}}></div>
                </div>
                <div className="flex justify-between w-full text-[10px] text-art-muted mt-1"><span>Target &lt; 2.0</span><span>Current</span></div>
             </div>
             
             {results && (
                 <div className="glass-panel p-4 text-xs font-mono space-y-2">
                     <div className="flex justify-between"><span className="text-cyan-400">Std Lab</span><span>{results.lab_std.map(v=>v.toFixed(0)).join(', ')}</span></div>
                     <div className="flex justify-between"><span className="text-purple-400">Test Lab</span><span>{results.lab_test.map(v=>v.toFixed(0)).join(', ')}</span></div>
                     <div className="flex justify-between mt-2 pt-2 border-t border-white/10"><span className="text-white">Luminance Diff</span><span className="font-bold">{results.contrast_diff.toFixed(1)}</span></div>
                 </div>
             )}
        </div>
      </div>
    </div>
  );
}
