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
  
  // Initial ROIs
  const initialRois = {
    ref: { x: 50, y: 50, w: 100, h: 100 },      
    standard: { x: 200, y: 200, w: 150, h: 150 }, 
    test: { x: 400, y: 200, w: 150, h: 150 },     
  };
  const [rois, setRois] = useState(initialRois);
  const [imageSize, setImageSize] = useState({ w: 1920, h: 1080 });

  const [selectionMode, setSelectionMode] = useState(null); 
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState({ x: 0, y: 0 });
  const [currentRect, setCurrentRect] = useState(null); 
  const [cvReady, setCvReady] = useState(false);
  
  // ZOOM State
  const [scale, setScale] = useState(1);

  useEffect(() => {
    // Auto-init camera logic removed for "Reset" clarity, but can act as default if desired.
    // For now, let's keep auto-init camera on load, but handleReset will clear it.
    initCamera();

    const interval = setInterval(() => { if (window.cv && window.cv.Mat) { setCvReady(true); clearInterval(interval); } }, 500);
    return () => clearInterval(interval);
  }, []);

  const initCamera = () => {
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
  };

  const handleReset = () => {
      if (confirm("Are you sure you want to RESET ALL? This will clear images, results, and locked Golden Sample data.")) {
          // Stop stream if active
          if (stream) {
              stream.getTracks().forEach(track => track.stop());
              setStream(null);
          }
          setUploadedImageSrc(null);
          setSourceType(null); // Clear source type
          setResults(null);
          setLockedStandard(null);
          setRois(initialRois);
          setScale(1);
          setSelectionMode(null);
          // Optional: Reload camera after reset? Or wait for user action?
          // Let's leave it blank and show "Load Image" or "Start Camera" buttons.
      }
  };

  const handleFileUpload = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
          setUploadedImageSrc(evt.target.result);
          setSourceType('upload');
          // Reset zoom on new image
          setScale(1);
          const img = new Image();
          img.onload = () => { uploadedImgRef.current = img; setImageSize({ w: img.width, h: img.height }); };
          img.src = evt.target.result;
      };
      reader.readAsDataURL(file);
  };

  /** MOUSE ROI LOGIC **/
  const getEventPos = (e) => {
      // Logic adjusted for scale
      const rect = containerRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left) / scale; // Divide by scale to get original coordinates relative to unscaled container
      const y = (e.clientY - rect.top) / scale;
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
      // Coordinate Mapping needs original dimensions (unscaled)
      // containerRef dimensions are effectively scaled visually, but getBoundingClientRect returns scaled px
      // The logic:
      // imageSize = Original Image W/H (e.g. 1920x1080)
      // containerRef.width (unscaled) = Display Width (e.g. 800px)
      // We need mapping factor = imageSize / containerUnscaledSize
      
      // Since our getPosition creates coordinates relative to UN-SCALED container (because we divide by scale),
      // we can just use the unscaled rect.width/height for ratio calculation.
      
      const rect = containerRef.current.getBoundingClientRect();
      // Unscaled dimensions:
      const containerW = rect.width / scale;
      const containerH = rect.height / scale;
      
      const scaleX = imageSize.w / containerW;
      const scaleY = imageSize.h / containerH;
      
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
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
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
  
  // ... lockStandard and analyze functions remain same ...
  const lockStandard = () => {
      let mat = captureFrame();
      if (!mat) return alert("Please load an image first!");
      try {
          if (rois.ref.w <= 0 || rois.standard.w <= 0) throw new Error("Please draw boxes for Color Card and Golden Sample first.");
          let calibrated = ProcessingEngine.calibrateImage(mat, rois.ref);
          let resStd = ProcessingEngine.calculateDeltaE(calibrated, null, rois.standard);
          cv.imshow(canvasRef.current, calibrated);
          let thumb = canvasRef.current.toDataURL('image/jpeg', 0.5);
          setLockedStandard({ lab: resStd.lab, image: thumb });
          alert("Success: Golden Sample values saved.");
          calibrated.delete();
      } catch(e) { alert(e.message); } finally { mat.delete(); }
  };

  const analyze = () => {
      let mat = captureFrame();
      if (!mat) return alert("Please load an image first!");
      try {
          if (rois.ref.w <= 0) throw new Error("Please draw a box for the Color Card.");
          let calibrated = ProcessingEngine.calibrateImage(mat, rois.ref);
          let labStd;
          if (lockedStandard) { labStd = lockedStandard.lab; } else {
              if (rois.standard.w <= 0) throw new Error("Please draw the Golden Sample box.");
              let resStd = ProcessingEngine.calculateDeltaE(calibrated, null, rois.standard);
              labStd = resStd.lab;
          }
          if (rois.test.w <= 0) throw new Error("Please draw the Test Product box.");
          let resTest = ProcessingEngine.calculateDeltaE(calibrated, labStd, rois.test);
          let transparencyDiff = Math.abs(labStd[0] - resTest.lab[0]); 
          setResults({ delta_e: resTest.deltaE, contrast_diff: transparencyDiff, lab_std: labStd, lab_test: resTest.lab, passed: resTest.deltaE < 2.0 });
          calibrated.delete();
      } catch(e) { console.error(e); alert(e.message); } finally { mat.delete(); }
  };

  const DisplayArea = () => (
      <div className="relative border border-white/10 rounded-2xl bg-black shadow-2xl overflow-hidden" style={{ minHeight: '400px' }}>
          {/* Controls Overlay */}
          <div className="absolute top-2 right-2 z-50 flex gap-2">
              <div className="glass-panel p-1 flex gap-1 rounded-lg">
                  <button onClick={() => setScale(s => Math.max(0.5, s - 0.1))} className="p-2 hover:bg-white/20 rounded">➖</button>
                  <span className="p-2 text-xs font-bold w-12 text-center">{(scale * 100).toFixed(0)}%</span>
                  <button onClick={() => setScale(s => Math.min(4, s + 0.1))} className="p-2 hover:bg-white/20 rounded">➕</button>
                  <button onClick={() => setScale(1)} className="p-2 hover:bg-white/20 rounded text-xs ml-2">Reset Zoom</button>
              </div>
          </div>
          
          {/* Scrollable Container Wrapper */}
          <div className="w-full h-[60vh] overflow-auto flex justify-center items-center bg-gray-900/50">
             {/* Scalable Content */}
             <div 
                ref={containerRef}
                className={`relative flex-shrink-0 origin-center transition-transform duration-200 ease-out select-none cursor-${selectionMode ? 'crosshair' : 'default'} touch-none`}
                style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }} // Top Left assumes container grows
                onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}
             >
                 {sourceType === 'camera' && stream ? <video ref={videoRef} autoPlay playsInline className="max-w-none pointer-events-none" /> :
                  sourceType === 'upload' && uploadedImageSrc ? <img src={uploadedImageSrc} className="max-w-none object-contain pointer-events-none" /> :
                  <div className="p-20 text-art-muted flex flex-col items-center animate-pulse pointer-events-none w-[600px] h-[400px] flex justify-center"><span className="text-6xl mb-4">📷 / 📁</span><span className="text-xl font-bold">Step 1: Load Image</span></div>}
          
                 {/* ROI Overlays */}
                 {containerRef.current && (sourceType === 'upload' || stream) && Object.entries(rois).map(([key, r]) => {
                     // Need to calculate position relative to UN-SCALED container size
                     // But here we are INSIDE the scaled container.
                     // A standard absolute div placed at (rx, ry) in a scaled container 
                     // will also be scaled by the parent transform!
                     // So we just need coordinates relative to the Image itself.
                     // Wait, previous logic used screen coordinates -> image mapping.
                     // rois store {x,y,w,h} in IMAGE PIXELS.
                     
                     // If we are rendering inside the scaled container which WRAPS the image:
                     // The container size = Image Size (approximately, if img max-w-none).
                     // If uploaded image is large (4000px), viewing it at scale 1 might be huge.
                     // We need to constrain the inner container to be "Native Image Size" or "Fit Size"?
                     // Let's assume the inner div takes the size of the image.
                     
                     // To make this robust:
                     // 1. rois are in IMAGE PIXELS.
                     // 2. We render overlays using percentages or map back to pixels?
                     // If container size == Image Size, we use r.x directly.
                     
                     const displayRect = containerRef.current.getBoundingClientRect();
                     const unscaledW = displayRect.width / scale; // Unscaled width of the container (which wraps image)
                     const unscaledH = displayRect.height / scale;
                     
                     // If image is loaded, typically the containerRef div auto-sizes to fit the img child (because of flex/inline-block behavior)?
                     // Let's ensure containerRef has 'display: inline-block' or similar.
                    
                     const scaleX = unscaledW / imageSize.w; 
                     const scaleY = unscaledH / imageSize.h;
                     // Ideally unscaledW should EQUAL imageSize.w if we display at 1:1 natural.
                     // But if we use 'max-h-[60vh] object-contain', the img is resized by CSS.
                     // If we use 'max-w-none', img is natural size?
                     
                     // Let's stick to the previous behavior where `img` had `max-h-[60vh]`.
                     // So unscaled container matches the "Fit to Screen" size of the image.
                     // Then we scale THAT up/down.
                     
                     return (<div key={key} className={`absolute border-2 ${key===selectionMode?'animate-pulse':''} border-${{ref:'yellow-400',standard:'cyan-400',test:'purple-400'}[key]||'white'} ${key==='standard'&&lockedStandard?'opacity-40 border-dashed':''}`}
                         style={{ 
                             left: r.x * scaleX, 
                             top: r.y * scaleY, 
                             width: r.w * scaleX, 
                             height: r.h * scaleY, 
                             pointerEvents: 'none' 
                         }}>
                         <span className={`bg-${{ref:'yellow-400',standard:'cyan-400',test:'purple-400'}[key]||'white'}/80 text-black px-1 absolute -top-5 left-0 text-[10px] font-bold whitespace-nowrap`}>{key.toUpperCase()}{key==='standard'&&lockedStandard?' (LOCKED)':''}</span></div>);
                })}
                {isDrawing && currentRect && <div className="absolute border-2 border-green-400 bg-green-400/20" style={{ left: currentRect.x, top: currentRect.y, width: currentRect.w, height: currentRect.h, pointerEvents: 'none' }}></div>}
             </div>
          </div>
          {selectionMode && !isDrawing && <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-black/80 px-4 py-2 rounded-full text-white text-xs border border-white/20 animate-bounce pointer-events-none shadow-lg z-40">🖌️ Draw Box: <span className="font-bold text-green-400 ml-2">{selectionMode.toUpperCase()}</span></div>}
      </div>
  );

  return (
    <div className="flex flex-col min-h-screen">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 p-6 flex-grow">
          <canvas ref={canvasRef} className="hidden"></canvas>
          <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept="image/*" />
          
          <div className="lg:col-span-2 space-y-6 flex flex-col h-full">
            {/* Top Header Row with Reset */}
            {/* Top Header Row with Reset */}
            <div className="flex justify-between items-center mb-2 px-1">
                <h2 className="text-art-muted text-sm uppercase font-bold tracking-widest flex items-center gap-2">
                    <span className="w-2 h-2 bg-cyan-500 rounded-full animate-pulse"></span>
                    Workbench
                </h2>
                <button onClick={handleReset} className="px-3 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded text-xs border border-red-500/20 transition-all flex items-center gap-2 group">
                    <span className="group-hover:rotate-12 transition-transform">🗑️</span> RESET ALL
                </button>
            </div>

            <DisplayArea />
            
            <div className="flex flex-wrap gap-4 justify-center">
                { !sourceType ? (
                    <>
                    <button onClick={() => fileInputRef.current.click()} className="btn-secondary flex items-center gap-2 text-lg px-6">📁 Load Image</button>
                    <button onClick={initCamera} className="btn-secondary">📷 Start Camera</button>
                    </>
                ) : (
                    <button onClick={() => fileInputRef.current.click()} className="btn-secondary flex items-center gap-2">📁 Change Image</button>
                )}
            </div>
            
            {/* Step 2 & Controls */}
            <div className="glass-panel p-6">
                <h3 className="text-sm font-bold text-art-muted uppercase mb-4 text-center">Step 2: Draw Regions</h3>
                <div className="grid grid-cols-3 gap-3">
                    {[
                        { k: 'ref', label: '1. Calibration Card (White)', color: 'text-yellow-400', desc: 'White Balance' },
                        { k: 'standard', label: '2. Golden Sample', color: 'text-cyan-400', desc: 'Target Item' },
                        { k: 'test', label: '3. Test Product', color: 'text-purple-400', desc: 'Sample Check' }
                    ].map(tool => (
                        <button key={tool.k} onClick={() => setSelectionMode(selectionMode === tool.k ? null : tool.k)} disabled={!sourceType || (lockedStandard && tool.k === 'standard')}
                            className={`p-4 rounded-xl border transition-all ${selectionMode === tool.k ? 'bg-white/20 ring-2 ring-white' : 'bg-white/5 hover:bg-white/10'} border-white/10 disabled:opacity-30 disabled:cursor-not-allowed`}>
                            <div className={`text-sm font-bold ${tool.color}`}>{tool.label}</div>
                            <div className="text-[10px] text-art-muted mt-1">{tool.desc}</div>
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex gap-4 justify-center">
                 <button onClick={lockedStandard ? () => setLockedStandard(null) : lockStandard} disabled={!sourceType} className={`btn-secondary ${lockedStandard ? 'border-red-400 text-red-200' : 'border-cyan-400 text-cyan-200'} w-48 disabled:opacity-30`}>
                    {lockedStandard ? '🔓 Unlock / Reset' : '🔒 Lock Golden Sample'}
                 </button>
                 <button onClick={analyze} disabled={!cvReady || !sourceType} className="btn-primary px-12 py-4 text-xl shadow-cyan-500/50 shadow-2xl disabled:opacity-50 w-64">
                    🔍 INSPECT
                </button>
            </div>
          </div>

          <div className="space-y-6">
            <div className="glass-panel p-8 text-center bg-gradient-to-b from-white/5 to-transparent min-h-[200px] flex flex-col justify-center">
                <h3 className="text-xl text-art-muted uppercase tracking-widest mb-4">Inspection Result</h3>
                {results ? (<div className={`text-6xl font-black ${results.passed ? 'text-art-success drop-shadow-[0_0_20px_rgba(74,222,128,0.5)]' : 'text-art-fail drop-shadow-[0_0_20px_rgba(248,113,113,0.5)]'}`}>{results.passed ? 'PASS' : 'FAIL'}</div>) : <div className="text-4xl font-bold text-white/10">--</div>}
            </div>
            
            <div className="grid grid-cols-1 gap-4">
                 {lockedStandard && (
                     <div className="glass-panel p-3 flex items-center gap-4 bg-cyan-900/20 border-cyan-500/30">
                         <img src={lockedStandard.image} className="w-16 h-16 rounded bg-black object-contain border border-cyan-500/50" />
                         <div>
                             <div className="text-xs text-cyan-400 font-bold uppercase mb-1">Active Golden Sample</div>
                             <div className="text-[10px] text-art-muted">Using saved values.</div>
                         </div>
                     </div>
                 )}
                 
                 <div className="metric-card">
                    <span className="text-art-muted text-sm uppercase">Delta E</span>
                    <span className="text-6xl font-black tracking-tight mt-2">{results ? results.delta_e.toFixed(2) : '--'}</span>
                    <div className="w-full bg-gray-700 h-2 rounded-full mt-4 overflow-hidden">
                        <div className={`h-full ${!results ? 'w-0' : results.delta_e < 2 ? 'bg-green-400' : 'bg-red-500'}`} style={{width: results ? `${Math.min(100, results.delta_e * 20)}%` : '0%'}}></div>
                    </div>
                    <div className="flex justify-between w-full text-[10px] text-art-muted mt-1"><span>Target &lt; 2.0</span><span>Current</span></div>
                 </div>
                 
                 {results && (
                     <div className="glass-panel p-4 text-xs font-mono space-y-2">
                         <div className="flex justify-between"><span className="text-cyan-400">Golden Lab</span><span>{results.lab_std.map(v=>v.toFixed(0)).join(', ')}</span></div>
                         <div className="flex justify-between"><span className="text-purple-400">Test Lab</span><span>{results.lab_test.map(v=>v.toFixed(0)).join(', ')}</span></div>
                     </div>
                 )}
            </div>
          </div>
      </div>
      <div className="text-center p-4 text-xs text-art-muted/30 font-mono tracking-widest border-t border-white/5 mt-auto">
        Developed by Wesley Chang @ Mouldex, 2026.
      </div>
    </div>
  );
}
