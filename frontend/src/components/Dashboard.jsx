import { useState, useEffect, useRef, useCallback } from 'react';
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

  // Wrap fitToScreen in useCallback to avoid dependency issues
  const fitToScreen = useCallback(() => {
      if (!imageSize.w || !imageSize.h || !containerRef.current) return;
      // Find the wrapper (parent of container) dimensions
      const wrapper = containerRef.current.parentElement;
      const availW = wrapper.clientWidth;
      const availH = wrapper.clientHeight;
      
      const scaleW = availW / imageSize.w;
      const scaleH = availH / imageSize.h;
      
      // Use 0.95 factor to leave a tiny margin
      const newScale = Math.min(scaleW, scaleH) * 0.95; 
      setScale(newScale);
  }, [imageSize]);
  
  // Auto-fit on new image load
  useEffect(() => {
      if (imageSize.w && imageSize.h) {
          fitToScreen();
      }
  }, [imageSize, fitToScreen]);

  /** MOUSE INTERACTION **/
  const getEventPos = (e) => {
     // Standardize event relative to the IMAGE container (which is now explicitly sized)
     const rect = containerRef.current.getBoundingClientRect();
     
     // Visual coordinates relative to the image top-left
     const visualX = e.clientX - rect.left;
     const visualY = e.clientY - rect.top;
     
     // Logic coordinate (native image pixels)
     // Since width = native * scale, native = visual / scale
     const x = visualX / scale;
     const y = visualY / scale;
     
     return { x, y, visualX, visualY };
  };
  
  const handleMouseDown = (e) => {
      if ((!selectionMode && !e.shiftKey) || !containerRef.current) return;
      e.preventDefault();
      const { x, y } = getEventPos(e);
      setIsDrawing(true);
      setDrawStart({ x, y }); // Store NATIVE coordinates
      setCurrentRect({ x, y, w: 0, h: 0 });
  };
  
  const handleMouseMove = (e) => {
      if (!isDrawing || !containerRef.current) return;
      e.preventDefault();
      const { x, y } = getEventPos(e);
      
      const w = x - drawStart.x;
      const h = y - drawStart.y;
      
      // Store as NATIVE coordinates
      setCurrentRect({ 
          x: w > 0 ? drawStart.x : x, 
          y: h > 0 ? drawStart.y : y, 
          w: Math.abs(w), 
          h: Math.abs(h) 
      });
  };
  
  const handleMouseUp = (e) => {
      if (!isDrawing || !containerRef.current) return;
      e.preventDefault();
      setIsDrawing(false);
      
      // If rect is too small, ignore
      if (!currentRect || currentRect.w < 5 || currentRect.h < 5) {
          setCurrentRect(null);
          return;
      }
      
      // Logic for "Zoom Area"
      if (selectionMode === 'zoom') {
          handleAreaZoom(currentRect);
          // Auto switch back to null or keep zoom tool? Usually keep or switch.
          // Let's reset to allow panning or viewing.
          setSelectionMode(null);
      } 
      // Logic for ROIs
      else if (selectionMode) {
          setRois(prev => ({ ...prev, [selectionMode]: currentRect }));
          setSelectionMode(null); 
      }
      
      setCurrentRect(null);
  };
  
  const handleAreaZoom = (rectNative) => {
      // rectNative is in native image pixels (e.g. 500px width on 1920px image)
      
      // 1. Calculate desired scale
      // We want the drawn rect to fill the view wrapper
      const wrapper = containerRef.current.parentElement;
      const availW = wrapper.clientWidth;
      const availH = wrapper.clientHeight;
      
      // Calculate scale needed to fit the SELECTION into the AVAILABLE SPACE
      const scaleW = availW / rectNative.w;
      const scaleH = availH / rectNative.h;
      
      // Choose the smaller scale to ensure it fits (contain)
      let newScale = Math.min(scaleW, scaleH) * 0.95; 
      
      // Cap max zoom
      newScale = Math.min(newScale, 10); // Max 10x
      
      setScale(newScale);
      
      // 2. Scroll to center
      // New dimensions of the total image
      // Center of ROI in native pixels
      const roiCenterX = rectNative.x + rectNative.w / 2;
      const roiCenterY = rectNative.y + rectNative.h / 2;
      
      // We need to scroll the wrapper such that (roiCenter * newScale) is at (avail / 2)
      // scrollLeft = (roiCenterX * newScale) - (availW / 2)
      
      // We must wait for render Update? 
      // React state update is async. We can use requestAnimationFrame or setTimeout
      setTimeout(() => {
          if (wrapper) {
            wrapper.scrollTo({
                left: (roiCenterX * newScale) - (availW / 2),
                top: (roiCenterY * newScale) - (availH / 2),
                behavior: 'smooth'
            });
          }
      }, 50);
  };

  const captureFrame = () => {
    // Check for global cv availability
    if (!canvasRef.current || !cvReady || !window.cv) return null;
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
        let src = window.cv.imread(canvasRef.current);
        let rgb = new window.cv.Mat();
        if (src.channels() === 4) window.cv.cvtColor(src, rgb, window.cv.COLOR_RGBA2RGB);
        else if (src.channels() === 1) window.cv.cvtColor(src, rgb, window.cv.COLOR_GRAY2RGB);
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
          window.cv.imshow(canvasRef.current, calibrated);
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
      <div className="relative border border-white/10 rounded-2xl bg-black shadow-2xl overflow-hidden" style={{ minHeight: '500px' }}>
          {/* Controls Overlay */}
          <div className="absolute top-2 right-2 z-50 flex gap-2 pointer-events-none">
              <div className="glass-panel p-1 flex gap-1 rounded-lg pointer-events-auto">
                  <button onClick={() => setScale(s => Math.max(0.1, s * 0.8))} className="p-2 hover:bg-white/20 rounded" title="Zoom Out">➖</button>
                  <span className="p-2 text-xs font-bold w-16 text-center tabular-nums">{(scale * 100).toFixed(0)}%</span>
                  <button onClick={() => setScale(s => Math.min(10, s * 1.2))} className="p-2 hover:bg-white/20 rounded" title="Zoom In">➕</button>
                  <button onClick={fitToScreen} className="p-2 hover:bg-white/20 rounded text-xs ml-2 px-3 border-l border-white/10">Fit Screen</button>
                  <button 
                      onClick={() => setSelectionMode(selectionMode === 'zoom' ? null : 'zoom')} 
                      className={`p-2 ml-2 rounded text-xs px-3 border border-white/10 flex items-center gap-2 ${selectionMode === 'zoom' ? 'bg-cyan-500/20 text-cyan-400 ring-1 ring-cyan-400' : 'hover:bg-white/20'}`}
                  >
                      <span>🔍</span> Area Zoom
                  </button>
              </div>
          </div>
          
          {/* Scrollable Container Wrapper */}
          <div className="w-full h-[65vh] overflow-auto flex bg-gray-900/50 relative custom-scrollbar">
             {/* Centering Wrapper: Ensures that if content is smaller than view, it's centered. 
                 If larger, it starts at top-left allowing scroll. 
                 Flex 'justify-center items-center' works well for smaller, but for larger it might clip 'top-left' if not careful.
                 Safe approach: 'min-w-full min-h-full flex items-center justify-center' works if child is margin:auto? 
                 Actually 'grid place-items-center' is robust.
             */}
             <div className="min-w-full min-h-full grid place-items-center p-10"> 
                 {/* Sized Content Container */}
                 <div 
                    ref={containerRef}
                    className={`relative shadow-2xl transition-all duration-100 ease-out select-none ${selectionMode ? 'cursor-crosshair' : 'cursor-default'}`}
                    style={{ 
                        // EXPLICIT SIZING replace transform
                        width: imageSize.w * scale, 
                        height: imageSize.h * scale,
                        // No transform!
                    }}
                    onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}
                 >
                     {sourceType === 'camera' && stream ? <video ref={videoRef} autoPlay playsInline className="w-full h-full object-contain pointer-events-none" /> :
                      sourceType === 'upload' && uploadedImageSrc ? <img src={uploadedImageSrc} className="w-full h-full object-contain pointer-events-none" /> :
                      <div className="w-full h-full flex items-center justify-center text-art-muted border-2 border-dashed border-white/10 rounded-lg">
                          <div className="text-center animate-pulse">
                              <div className="text-4xl mb-2">📷</div>
                              <div>No Image</div>
                          </div>
                      </div>}
              
                     {/* ROI Overlays - Rendered using percentage to adapt to container size automatically? 
                         OR native pixel * scale. Since container is natively sized to (w*scale), 
                         we can use native pixel * scale for positions.
                     */}
                     {containerRef.current && (sourceType === 'upload' || stream) && Object.entries(rois).map(([key, r]) => (
                         <div key={key} className={`absolute border-2 ${key===selectionMode?'animate-pulse':''} border-${{ref:'yellow-400',standard:'cyan-400',test:'purple-400'}[key]||'white'} ${key==='standard'&&lockedStandard?'opacity-40 border-dashed':''}`}
                             style={{ 
                                 left: r.x * scale, 
                                 top: r.y * scale, 
                                 width: r.w * scale, 
                                 height: r.h * scale, 
                                 pointerEvents: 'none' 
                             }}>
                             <span className={`bg-${{ref:'yellow-400',standard:'cyan-400',test:'purple-400'}[key]||'white'}/80 text-black px-1 absolute -top-5 left-0 text-[10px] font-bold whitespace-nowrap scale-item`}>
                                {key.toUpperCase()}{key==='standard'&&lockedStandard?' (LOCKED)':''}
                             </span>
                         </div>
                     ))}
                     
                     {/* Drawing Rect - Green Dash */}
                     {isDrawing && currentRect && (
                        <div className={`absolute border-2 ${selectionMode === 'zoom' ? 'border-blue-400 bg-blue-400/10 border-dashed' : 'border-green-400 bg-green-400/20'}`}
                             style={{ 
                                 left: currentRect.x * scale, 
                                 top: currentRect.y * scale, 
                                 width: currentRect.w * scale, 
                                 height: currentRect.h * scale, 
                                 pointerEvents: 'none'
                             }}>
                             {selectionMode === 'zoom' && <span className="absolute -top-5 left-0 text-blue-400 text-xs font-bold bg-black/50 px-1">ZOOM AREA</span>}
                        </div>
                     )}
                 </div>
             </div>
          </div>
          {selectionMode && !isDrawing && <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-black/80 px-4 py-2 rounded-full text-white text-xs border border-white/20 animate-bounce pointer-events-none shadow-lg z-40 flex items-center gap-2">
              {selectionMode === 'zoom' ? '🔍 Draw a box to Zoom In' : <span>🖌️ Draw Box: <span className="font-bold text-green-400 ml-2">{selectionMode.toUpperCase()}</span></span>}
          </div>}
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
