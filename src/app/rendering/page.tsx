"use client";
import { useEffect, useRef, useState } from "react";
import * as SPLAT from "gsplat";
import { useSearchParams } from "next/navigation";
import BottomBar from "../components/BottomBar";

export default function SplatPage() {
  const searchParams = useSearchParams();
  const projectName = searchParams.get("project") || "";
  const [error, setError] = useState<string>("");
  const containerRef = useRef<HTMLDivElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const cameraRef = useRef<any>(null);
  const rendererRef = useRef<any>(null);
  const controlsRef = useRef<any>(null);
  const sceneRef = useRef<any>(null);
  
  // Use a single ref to hold all keyframes.
  const keyframesRef = useRef<any[]>([]);
  
  // Recording and UI state
  const [selectedFPS, setSelectedFPS] = useState<string>("");
  const [durationSec, setDurationSec] = useState<string>("");
  const [fpsFocused, setFPSFocused] = useState(false);
  const [durationFocused, setDurationFocused] = useState(false);
  const [startRoll, setStartRoll] = useState(0);
  const [endRoll, setEndRoll] = useState(0);
  const [recording, setRecording] = useState(false);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [totalFrames, setTotalFrames] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isActionMinimized, setIsActionMinimized] = useState(false);
  // New states for the two boxes, both collapsed (minimized) by default
  const [isRotationMinimized, setIsRotationMinimized] = useState(true);
  const [isOverlayMinimized, setIsOverlayMinimized] = useState(true);
  const [showCenterCross, setShowCenterCross] = useState(true);
  const [showGrid, setShowGrid] = useState(false);
  // Only show preview for the first and last keyframes.
  const [startKeyframePreview, setStartKeyframePreview] = useState("");
  const [endKeyframePreview, setEndKeyframePreview] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [rotationType, setRotationType] = useState("");

  const [startRollInput, setStartRollInput] = useState("");
  const [startRollFocused, setStartRollFocused] = useState(false);
  const [endRollInput, setEndRollInput] = useState("");
  const [endRollFocused, setEndRollFocused] = useState(false);

  // Reset rotation amounts when no rotation type is selected.
  useEffect(() => {
    if (rotationType === "") {
      setStartRoll(0);
      setEndRoll(0);
      setStartRollInput("");
      setEndRollInput("");
    }
  }, [rotationType]);

  // Keep refs current with UI checkbox states.
  const gridEnabledRef = useRef(showGrid);
  const crossEnabledRef = useRef(showCenterCross);

  useEffect(() => {
    gridEnabledRef.current = showGrid;
  }, [showGrid]);

  useEffect(() => {
    crossEnabledRef.current = showCenterCross;
  }, [showCenterCross]);

  const defaultAnimationId = useRef<number | null>(null);
  const defaultFrame = () => {
    if (
      !controlsRef.current ||
      !rendererRef.current ||
      !sceneRef.current ||
      !cameraRef.current
    )
      return;
    controlsRef.current.update();
    rendererRef.current.render(sceneRef.current, cameraRef.current);
    updateOverlay();
    defaultAnimationId.current = requestAnimationFrame(defaultFrame);
  };

  useEffect(() => {
    if (!projectName) {
      window.location.href = "/";
    }
  }, [projectName]);

  useEffect(() => {
    if (!projectName) {
      setError("Project name is missing.");
      return;
    }
    if (!containerRef.current) return;

    // Initialize SPLAT scene, camera, renderer, and controls.
    const scene = new SPLAT.Scene();
    sceneRef.current = scene;
    const camera = new SPLAT.Camera();
    cameraRef.current = camera;
    const renderer = new SPLAT.WebGLRenderer();
    rendererRef.current = renderer;
    const controls = new SPLAT.OrbitControls(camera, renderer.canvas);
    controlsRef.current = controls;

    const pixelRatio = window.devicePixelRatio || 1;
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;
    renderer.setSize(width * pixelRatio, height * pixelRatio);
    containerRef.current.appendChild(renderer.canvas);

    // Setup the overlay canvas to match container size.
    if (overlayCanvasRef.current && containerRef.current) {
      const overlayCanvas = overlayCanvasRef.current;
      overlayCanvas.width = containerRef.current.clientWidth * pixelRatio;
      overlayCanvas.height = containerRef.current.clientHeight * pixelRatio;
    }

    async function main() {
      const url = `http://localhost:8000/splat/${projectName}`;
      setIsLoading(true);
      await SPLAT.Loader.LoadAsync(url, scene, (progress: number) => {
        setLoadingProgress(progress);
      });
      setIsLoading(false);
      defaultFrame();
    }
    main();
  }, []);

  useEffect(() => {
    if (!sessionStorage.getItem("hasRefreshed")) {
      sessionStorage.setItem("hasRefreshed", "true");
      window.location.reload();
    } else {
      sessionStorage.removeItem("hasRefreshed");
    }
  }, []);

  // Update overlay based on grid and cross settings.
  const updateOverlay = () => {
    if (recording) return;
    if (!overlayCanvasRef.current) return;
    const ctx = overlayCanvasRef.current.getContext("2d");
    if (!ctx) return;
    const canvas = overlayCanvasRef.current;
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    if (gridEnabledRef.current) {
      const gridSpacing = 50;
      ctx.strokeStyle = "rgba(136,136,136,0.5)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      const centerX = width / 2;
      const centerY = height / 2;
      for (let x = centerX; x <= width; x += gridSpacing) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
      }
      for (let x = centerX - gridSpacing; x >= 0; x -= gridSpacing) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
      }
      for (let y = centerY; y <= height; y += gridSpacing) {
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
      }
      for (let y = centerY - gridSpacing; y >= 0; y -= gridSpacing) {
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
      }
      ctx.stroke();
    }
    if (crossEnabledRef.current) {
      const centerX = width / 2;
      const centerY = height / 2;
      const crossSize = 10;
      ctx.strokeStyle = "rgb(255, 255, 255)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(centerX - crossSize, centerY);
      ctx.lineTo(centerX + crossSize, centerY);
      ctx.moveTo(centerX, centerY - crossSize);
      ctx.lineTo(centerX, centerY + crossSize);
      ctx.stroke();
    }
  };

  const takePhoto = () => {
    if (!rendererRef.current) return;
    requestAnimationFrame(() => {
      rendererRef.current.canvas.toBlob((blob: Blob | null) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "scene.png";
        a.click();
        URL.revokeObjectURL(url);
      }, "image/png");
    });
  };

  // Single button to add a keyframe.
  // The first keyframe stores rotation; subsequent keyframes store only position.
  const addKeyframe = () => {
    if (!cameraRef.current || !rendererRef.current) return;
    const newKeyframe: any = {
      position: { ...cameraRef.current.position },
    };
    if (keyframesRef.current.length === 0) {
      newKeyframe.orientation = cameraRef.current.rotation.clone();
      requestAnimationFrame(() => {
        const previewDataUrl = rendererRef.current.canvas.toDataURL("image/png");
        setStartKeyframePreview(previewDataUrl);
      });
    } else {
      // For every additional keyframe, update the "end" preview.
      requestAnimationFrame(() => {
        const previewDataUrl = rendererRef.current.canvas.toDataURL("image/png");
        setEndKeyframePreview(previewDataUrl);
      });
    }
    keyframesRef.current.push(newKeyframe);
    console.log("Added keyframe:", newKeyframe, "Total keyframes:", keyframesRef.current.length);
  };

  // New: Reset keyframes button clears the keyframe array and previews.
  const resetKeyframes = () => {
    keyframesRef.current = [];
    setStartKeyframePreview("");
    setEndKeyframePreview("");
    console.log("Keyframes have been reset.");
  };

  const lerp = (a: number, b: number, t: number) => a * (1 - t) + b * t;

  // New interpolation function that goes through all keyframes.
  const interpolateCameraThroughKeyframes = (t: number) => {
    if (!cameraRef.current || keyframesRef.current.length < 2) return;
    const keyframes = keyframesRef.current;
    const numSegments = keyframes.length - 1;
    let s = t * numSegments;
    let segmentIndex = Math.floor(s);
    // Clamp to the last segment if needed.
    if (segmentIndex >= numSegments) {
      segmentIndex = numSegments - 1;
      s = numSegments;
    }
    const localT = s - segmentIndex;
    const startKF = keyframes[segmentIndex];
    const endKF = keyframes[segmentIndex + 1];
    cameraRef.current.position.x = lerp(startKF.position.x, endKF.position.x, localT);
    cameraRef.current.position.y = lerp(startKF.position.y, endKF.position.y, localT);
    cameraRef.current.position.z = lerp(startKF.position.z, endKF.position.z, localT);
  };

  const recordVideo = async () => {
    const fps = parseInt(selectedFPS, 10);
    const duration = parseInt(durationSec, 10);
    if (isNaN(fps) || isNaN(duration)) {
      alert("Please enter valid numbers for FPS and Duration.");
      return;
    }
    
    if (!rendererRef.current || !cameraRef.current) return;
    if (keyframesRef.current.length < 2) {
      alert("Please set at least two keyframes before recording video.");
      return;
    }
    // Use all keyframes.
    const firstKeyframe = keyframesRef.current[0];

    const oldControlsEnabled = controlsRef.current.enabled;
    controlsRef.current.enabled = false;
    if (defaultAnimationId.current) {
      cancelAnimationFrame(defaultAnimationId.current);
    }
    const computedTotalFrames = Math.floor(duration * fps);
    setTotalFrames(computedTotalFrames);
    setCurrentFrame(0);
    setRecording(true);

    const canvas = rendererRef.current.canvas;
    const frames: Blob[] = [];
    for (let i = 0; i < computedTotalFrames; i++) {
      const t = i / (computedTotalFrames - 1);
      interpolateCameraThroughKeyframes(t);
      const currentRollDeg = lerp(startRoll, endRoll, t);
      const currentRollRad = currentRollDeg * (Math.PI / 180);
      // Always apply rotation based on the first keyframe's orientation.
      if (firstKeyframe && firstKeyframe.orientation && rotationType !== "") {
        const baseOrientation = firstKeyframe.orientation;
        let axis;
        if (rotationType === "tilt") {
          axis = new SPLAT.Vector3(1, 0, 0);
        } else if (rotationType === "turn") {
          axis = new SPLAT.Vector3(0, 1, 0);
        } else {
          axis = new SPLAT.Vector3(0, 0, 1);
        }
        const rollOffsetQuat = SPLAT.Quaternion.FromAxisAngle(axis, currentRollRad);
        cameraRef.current.rotation = baseOrientation.multiply(rollOffsetQuat);
      }
      rendererRef.current.render(sceneRef.current, cameraRef.current);
      updateOverlay();
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const blob: Blob | null = await new Promise((resolve) => {
        canvas.toBlob(resolve, "image/png");
      });
      if (blob) {
        frames.push(blob);
      }
      setCurrentFrame(i + 1);
    }

    // Restore original camera rotation.
    if (firstKeyframe && firstKeyframe.orientation) {
      cameraRef.current.rotation = firstKeyframe.orientation;
    }
    controlsRef.current.enabled = oldControlsEnabled;
    defaultFrame();
    setRecording(false);
    setIsProcessing(true);

    // Reset rotation amounts after recording.
    setStartRoll(0);
    setEndRoll(0);
    setStartRollInput("");
    setEndRollInput("");

    const formData = new FormData();
    formData.append("project_name", projectName);
    formData.append("fps", String(fps));
    frames.forEach((frame, index) => {
      const fileName = `frame${String(index).padStart(3, "0")}.png`;
      const file = new File([frame], fileName, { type: "image/png" });
      formData.append("files", file);
    });

    const response = await fetch("http://localhost:8000/create_video/", {
      method: "POST",
      body: formData,
    });
    setIsProcessing(false);
    if (!response.ok) {
      alert("Video creation failed.");
      return;
    }
    const videoBlob = await response.blob();
    const videoUrl = URL.createObjectURL(videoBlob);
    const a = document.createElement("a");
    a.href = videoUrl;
    a.download = "scene.mp4";
    a.click();
    URL.revokeObjectURL(videoUrl);
  };

  return (
    <main className="h-screen bg-black text-white font-mono flex flex-col relative">
      {/* Header */}
      <header className="flex items-center px-4 py-3 border-b border-white bg-black">
        <img src="/logo-small.png" alt="Logo" className="h-10 w-auto mr-4" />
        <h1 className="text-xl font-bold">{projectName}</h1>
      </header>
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar controls */}
        <aside className="sidebar w-1/5 border-r border-white bg-black pt-4 pb-18 h-full overflow-y-auto flex flex-col">
          <div className="flex-1">
            <div className="text-center">
              <h2 className="text-5xl font-bold uppercase tracking-wide my-6">
                render
              </h2>
            </div>
            {/* Render Control Box */}
            <div className="p-4 flex flex-col gap-2 mb-4">
              <button
                onClick={takePhoto}
                className="w-full py-3 px-4 mb-4 font-semibold border border-white rounded cursor-pointer hover:bg-white hover:text-black hover:-translate-y-1 transition"
                disabled={recording || isProcessing}
              >
                Take Photo
              </button>
              <div className="flex w-full gap-2">
                <input
                  type="text"
                  value={
                    fpsFocused
                      ? selectedFPS
                      : selectedFPS
                      ? `${selectedFPS} fps`
                      : ""
                  }
                  onFocus={() => setFPSFocused(true)}
                  onBlur={() => setFPSFocused(false)}
                  onChange={(e) => {
                    const val = e.target.value;
                    const numeric = val.replace(/[^\d]/g, "");
                    setSelectedFPS(numeric);
                  }}
                  placeholder="FPS"
                  className="border border-white text-center p-2 rounded w-full"
                  disabled={recording || isProcessing}
                />
                <input
                  type="text"
                  value={
                    durationFocused
                      ? durationSec
                      : durationSec
                      ? `${durationSec} sec`
                      : ""
                  }
                  onFocus={() => setDurationFocused(true)}
                  onBlur={() => setDurationFocused(false)}
                  onChange={(e) => {
                    const val = e.target.value;
                    const numeric = val.replace(/[^\d]/g, "");
                    setDurationSec(numeric);
                  }}
                  placeholder="Duration (s)"
                  className="border border-white text-center p-2 rounded w-full"
                  disabled={recording || isProcessing}
                />
              </div>
              {/* Single keyframe button */}
              <button
                onClick={addKeyframe}
                className="w-full py-2 px-4 font-semibold border border-white rounded cursor-pointer hover:bg-white hover:text-black transition"
                disabled={recording || isProcessing}
              >
                ■ Set Keyframe ■
              </button>
              {/* Reset keyframes button */}
              <button
                onClick={resetKeyframes}
                className="w-full py-2 px-4 font-semibold border border-white rounded cursor-pointer hover:bg-white hover:text-black transition"
                disabled={recording || isProcessing}
              >
                ✖ Reset Keyframes ✖
              </button>
              <button
                onClick={recordVideo}
                className="w-full py-3 px-4 my-4 font-semibold border border-white rounded cursor-pointer hover:bg-white hover:text-black hover:-translate-y-1 transition"
                disabled={recording || isProcessing}
              >
                Record Video
              </button>
              {/* Show only first and last keyframe previews */}
              {(startKeyframePreview || endKeyframePreview) && (
                <div className="flex gap-4 p-2">
                  {startKeyframePreview && (
                    <div className="w-full h-24 border border-white p-1 rounded-lg overflow-hidden">
                      <img
                        src={startKeyframePreview}
                        alt="First Keyframe Preview"
                        className="w-full h-full object-cover rounded-lg"
                      />
                    </div>
                  )}
                  {endKeyframePreview && (
                    <div className="w-full h-24 border border-white p-1 rounded-lg overflow-hidden">
                      <img
                        src={endKeyframePreview}
                        alt="Last Keyframe Preview"
                        className="w-full h-full object-cover rounded-lg"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
            
            {/* Rotation Options Box */}
            <div className="p-4 border-y border-white flex flex-col gap-4 mb-4">
              <div
                className="flex items-center justify-between p-2 cursor-pointer"
                onClick={() => {
                  setIsRotationMinimized(!isRotationMinimized);
                  setRotationType("");
                }}
              >
                <h2 className="text-gray-100 font-bold text-lg">Rotations</h2>
                <span className="text-gray-100">{isRotationMinimized ? "+" : "–"}</span>
              </div>
              {!isRotationMinimized && (
                <div className="flex flex-col gap-2 p-4">
                  {/* Toggle Buttons for Rotation Type */}
                  <div className="flex gap-8 mb-4">
                    <button
                      onClick={() =>
                        setRotationType(rotationType === "tilt" ? "" : "tilt")
                      }
                      className={`w-1/3 py-2 px-4 font-semibold border border-white rounded cursor-pointer hover:-translate-y-1 transition ${
                        rotationType === "tilt"
                          ? "bg-white text-black"
                          : "bg-black text-white"
                      }`}
                      disabled={recording || isProcessing}
                    >
                      Tilt
                    </button>
                    <button
                      onClick={() =>
                        setRotationType(rotationType === "turn" ? "" : "turn")
                      }
                      className={`w-1/3 py-2 px-4 font-semibold border border-white rounded cursor-pointer hover:-translate-y-1 transition ${
                        rotationType === "turn"
                          ? "bg-white text-black"
                          : "bg-black text-white"
                      }`}
                      disabled={recording || isProcessing}
                    >
                      Turn
                    </button>
                    <button
                      onClick={() =>
                        setRotationType(rotationType === "roll" ? "" : "roll")
                      }
                      className={`w-1/3 py-2 px-4 font-semibold border border-white rounded cursor-pointer hover:-translate-y-1 transition ${
                        rotationType === "roll"
                          ? "bg-white text-black"
                          : "bg-black text-white"
                      }`}
                      disabled={recording || isProcessing}
                    >
                      Roll
                    </button>
                  </div>
                  {/* Sliders for Start and End Roll */}
                  <div className="flex flex-col gap-2 py-4">
                    <input
                      type="range"
                      min="-180"
                      max="180"
                      value={startRoll}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setStartRoll(val);
                        setStartRollInput(val.toString());
                      }}
                      className="w-full fps-slider fps-slider-start"
                      disabled={!rotationType || recording || isProcessing}
                    />
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={
                          startRollFocused
                            ? startRollInput
                            : startRollInput
                              ? `${startRollInput}°`
                              : ""
                        }
                        onFocus={() => setStartRollFocused(true)}
                        onBlur={() => setStartRollFocused(false)}
                        onChange={(e) => {
                          // Allow numbers, a dot, and the minus sign.
                          const val = e.target.value.replace(/[^0-9.\-]/g, "");
                          setStartRollInput(val);
                          const parsed = parseFloat(val);
                          if (!isNaN(parsed)) {
                            setStartRoll(parsed);
                          } else {
                            setStartRoll(0);
                          }
                        }}
                        placeholder="Start (°)"
                        className="p-2 border border-white disabled:border-gray-500 rounded w-full text-center"
                        disabled={!rotationType || recording || isProcessing}
                      />
                      <label className="px-4">-</label>
                      <input
                        type="text"
                        value={
                          endRollFocused
                            ? endRollInput
                            : endRollInput
                              ? `${endRollInput}°`
                              : ""
                        }
                        onFocus={() => setEndRollFocused(true)}
                        onBlur={() => setEndRollFocused(false)}
                        onChange={(e) => {
                          const val = e.target.value.replace(/[^0-9.\-]/g, "");
                          setEndRollInput(val);
                          const parsed = parseFloat(val);
                          if (!isNaN(parsed)) {
                            setEndRoll(parsed);
                          } else {
                            setEndRoll(0);
                          }
                        }}
                        placeholder="End (°)"
                        className="p-2 border border-white disabled:border-gray-500 rounded w-full text-center"
                        disabled={!rotationType || recording || isProcessing}
                      />
                    </div>
                    <input
                      type="range"
                      min="-180"
                      max="180"
                      value={endRoll}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setEndRoll(val);
                        setEndRollInput(val.toString());
                      }}
                      className="w-full fps-slider fps-slider-end"
                      disabled={!rotationType || recording || isProcessing}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* Overlay Options Box */}
          <div className="p-4 mt-auto">
            <div className="flex gap-2">
              <button
                onClick={() => setShowCenterCross(!showCenterCross)}
                className={`w-1/2 py-2 px-4 font-semibold border border-white rounded cursor-pointer hover:-translate-y-1 transition ${
                  showCenterCross ? "bg-white text-black" : "bg-black text-white"
                }`}
                disabled={recording || isProcessing}
              >
                Crosshair
              </button>
              <button
                onClick={() => setShowGrid(!showGrid)}
                className={`w-1/2 py-2 px-4 font-semibold border border-white rounded cursor-pointer hover:-translate-y-1 transition ${
                  showGrid ? "bg-white text-black" : "bg-black text-white"
                }`}
                disabled={recording || isProcessing}
              >
                Grid
              </button>
            </div>
          </div>
        </aside>

        <style jsx>{`
          .sidebar::-webkit-scrollbar {
            display: none;
          }
          .sidebar {
            -ms-overflow-style: none; /* IE and Edge */
          }
        `}</style>

        <style jsx>{`
          /* Common slider track styling */
          input[type='range'].fps-slider {
            -webkit-appearance: none;
            width: 100%;
            height: 8px;
            background: white;
            outline: none;
            border-radius: 0;
            margin: 10px 0;
          }
        
          /* Start slider thumb styling (Webkit) */
          input[type='range'].fps-slider-start::-webkit-slider-thumb {
            -webkit-appearance: none;
            width: 16px;
            height: 16px;
            background: white;
            border: 2px solid black;
            border-radius: 0;
            cursor: pointer;
            margin-top: -4px;
          }
        
          /* End slider thumb styling (Webkit) */
          input[type='range'].fps-slider-end::-webkit-slider-thumb {
            -webkit-appearance: none;
            width: 16px;
            height: 16px;
            background: white;
            border: 2px solid black;
            border-radius: 0;
            cursor: pointer;
            margin-top: 4px;
          }
        
          /* Disabled slider track styling */
          input[type='range'].fps-slider:disabled {
            background: gray;
          }
        `}</style>

        {/* Right section: Rendering canvas and overlays */}
        <section className="w-4/5 relative">
          <div className="relative w-full" style={{ aspectRatio: "16/9" }}>
            <div ref={containerRef} className="w-full h-full relative">
              <canvas
                ref={overlayCanvasRef}
                className="absolute top-0 left-0 pointer-events-none"
                style={{ width: "100%", height: "100%", display: recording ? "none" : "block" }}
              />
              {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-16 h-16 bg-white animate-spin"></div>
                </div>
              )}
            </div>
            {(recording || isProcessing) && (
              <div className="absolute bottom-20 left-4 right-4 flex flex-col items-center justify-center">
                <div className="w-full md:w-3/4 border border-white bg-black h-6 relative">
                  <div
                    className="h-full bg-white"
                    style={{ width: `${(currentFrame / totalFrames) * 100}%` }}
                  ></div>
                </div>
                <p className="text-white text-sm mt-1 text-center">
                  {recording
                    ? `Processing frame ${currentFrame} of ${totalFrames}`
                    : "Processing video, please wait..."}
                </p>
              </div>
            )}
            {!recording && rotationType && false && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <svg width="150" height="150" viewBox="0 0 150 150">
                  <rect x="72" y="72" width="6" height="6" fill="white" />
                  <rect 
                    x="74" 
                    y="15" 
                    width="2" 
                    height="60" 
                    fill="white" 
                    transform={`rotate(${startRoll}, 75, 75)`} 
                  />
                  <rect 
                    x="74" 
                    y="15" 
                    width="2" 
                    height="60" 
                    fill="white" 
                    transform={`rotate(${endRoll}, 75, 75)`} 
                  />
                </svg>
              </div>
            )}
          </div>
        </section>
      </div>
      <BottomBar />
    </main>
  );
}
