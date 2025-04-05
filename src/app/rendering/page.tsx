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
  const keyframe1Ref = useRef<any>(null);
  const keyframe2Ref = useRef<any>(null);
  const defaultAnimationId = useRef<number | null>(null);

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
  const [startKeyframePreview, setStartKeyframePreview] = useState("");
  const [endKeyframePreview, setEndKeyframePreview] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [rotationType, setRotationType] = useState("");

  // Reset rotation amounts when no rotation type is selected.
  useEffect(() => {
    if (rotationType === "") {
      setStartRoll(0);
      setEndRoll(0);
    }
  }, [rotationType]);

  // Use refs to always hold the latest checkbox states.
  const gridEnabledRef = useRef(showGrid);
  const crossEnabledRef = useRef(showCenterCross);

  useEffect(() => {
    gridEnabledRef.current = showGrid;
  }, [showGrid]);

  useEffect(() => {
    crossEnabledRef.current = showCenterCross;
  }, [showCenterCross]);

  // The default render loop updates both the SPLAT scene and the overlay.
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
    renderer.setSize(window.innerWidth * pixelRatio, window.innerHeight * pixelRatio);
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

  // The overlay function uses the refs to always get the latest checkbox values.
  const updateOverlay = () => {
    if (recording) return; // Skip drawing overlays during video capture

    if (!overlayCanvasRef.current) return;
    const ctx = overlayCanvasRef.current.getContext("2d");
    if (!ctx) return;
    const canvas = overlayCanvasRef.current;
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);
  
    // Draw grid if enabled.
    if (gridEnabledRef.current) {
      const gridSpacing = 50; // grid spacing in pixels
      ctx.strokeStyle = "rgba(136,136,136,0.5)";
      ctx.lineWidth = 1;
      ctx.beginPath();
  
      const centerX = width / 2;
      const centerY = height / 2;
  
      // Draw vertical grid lines: one through the center and outwards.
      for (let x = centerX; x <= width; x += gridSpacing) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
      }
      for (let x = centerX - gridSpacing; x >= 0; x -= gridSpacing) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
      }
  
      // Draw horizontal grid lines: one through the center and outwards.
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
  
    // Draw center cross if enabled.
    if (crossEnabledRef.current) {
      const centerX = width / 2;
      const centerY = height / 2;
      const crossSize = 10; // half-length of each cross line
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

  const setStartKeyframe = () => {
    if (!cameraRef.current || !rendererRef.current) return;
    keyframe1Ref.current = {
      position: { ...cameraRef.current.position },
      orientation: cameraRef.current.rotation.clone(),
    };
    requestAnimationFrame(() => {
      const previewDataUrl = rendererRef.current.canvas.toDataURL("image/png");
      setStartKeyframePreview(previewDataUrl);
    });
    console.log("Start keyframe set:", keyframe1Ref.current);
  };
  
  const setEndKeyframe = () => {
    if (!cameraRef.current || !rendererRef.current) return;
    keyframe2Ref.current = {
      position: { ...cameraRef.current.position },
    };
    requestAnimationFrame(() => {
      const previewDataUrl = rendererRef.current.canvas.toDataURL("image/png");
      setEndKeyframePreview(previewDataUrl);
    });
    console.log("End keyframe set:", keyframe2Ref.current);
  };

  const lerp = (a: number, b: number, t: number) => a * (1 - t) + b * t;

  const interpolateCamera = (t: number) => {
    if (!cameraRef.current || !keyframe1Ref.current || !keyframe2Ref.current) return;
    const startPos = keyframe1Ref.current.position;
    const endPos = keyframe2Ref.current.position;
    cameraRef.current.position.x = lerp(startPos.x, endPos.x, t);
    cameraRef.current.position.y = lerp(startPos.y, endPos.y, t);
    cameraRef.current.position.z = lerp(startPos.z, endPos.z, t);
  };

  const recordVideo = async () => {
    // Parse the input values
    const fps = parseInt(selectedFPS, 10);
    const duration = parseInt(durationSec, 10);
    if (isNaN(fps) || isNaN(duration)) {
      alert("Please enter valid numbers for FPS and Duration.");
      return;
    }
    
    if (!rendererRef.current || !cameraRef.current) return;
    if (!keyframe1Ref.current || !keyframe2Ref.current) {
      alert("Please set both start and end keyframes before recording video.");
      return;
    }

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
      interpolateCamera(t);
      const currentRollDeg = lerp(startRoll, endRoll, t);
      const currentRollRad = currentRollDeg * (Math.PI / 180);
      if (keyframe1Ref.current && keyframe1Ref.current.orientation && rotationType !== "") {
        const baseOrientation = keyframe1Ref.current.orientation;
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

    if (keyframe1Ref.current) {
      cameraRef.current.rotation = keyframe1Ref.current.orientation;
    }

    controlsRef.current.enabled = oldControlsEnabled;
    defaultFrame();
    setRecording(false);
    setIsProcessing(true);

    // Reset rotation amounts after recording.
    setStartRoll(0);
    setEndRoll(0);

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
    a.download = "scene_video.mp4";
    a.click();
    URL.revokeObjectURL(videoUrl);
  };

  return (
    <main className="min-h-screen bg-gradient-to-r from-gray-900 to-gray-800 relative">
      <div className="flex-grow flex items-center justify-center">
      <div ref={containerRef} className="w-full h-full relative">
        {/* Overlay canvas */}
        <canvas
          ref={overlayCanvasRef}
          className="absolute top-0 left-0 pointer-events-none"
          style={{ width: "100%", height: "100%", display: recording ? "none" : "block" }}
        />
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-75">
            <div className="bg-gray-800 border border-gray-700 backdrop-blur-lg shadow-xl rounded-lg p-4">
              <p className="text-gray-100">Loading... {Math.round(loadingProgress * 100)}%</p>
              <progress value={loadingProgress * 100} max="100" className="w-full"></progress>
            </div>
          </div>
        )}
      </div>
      <div className="absolute top-10 left-10 z-50 flex flex-col gap-4">
        {/* Box 1: Render */}
        <div className="p-4 bg-gray-800 border border-gray-700 backdrop-blur-lg shadow-xl rounded-lg flex flex-col gap-2">
          <div
            className="flex items-center justify-between p-2 cursor-pointer"
            onClick={() => setIsActionMinimized(!isActionMinimized)}
          >
            <h2 className="text-gray-100 font-bold text-lg">Render</h2>
            <span className="text-gray-100">{isActionMinimized ? "+" : "–"}</span>
          </div>
          {!isActionMinimized && (
            <>
              {/* FPS on the left and Duration on the right */}
              <div className="flex w-full justify-between gap-2">
                <input
                  type="text"
                  value={fpsFocused ? selectedFPS : selectedFPS ? `${selectedFPS}fps` : ""}
                  onFocus={() => setFPSFocused(true)}
                  onBlur={() => setFPSFocused(false)}
                  onChange={(e) => {
                    const val = e.target.value;
                    const numeric = val.replace(/[^\d]/g, "");
                    setSelectedFPS(numeric);
                  }}
                  placeholder="FPS"
                  className="bg-gray-700 text-gray-100 p-2 rounded w-20"
                  disabled={recording || isProcessing}
                />
                <input
                  type="text"
                  value={durationFocused ? durationSec : durationSec ? `${durationSec}s` : ""}
                  onFocus={() => setDurationFocused(true)}
                  onBlur={() => setDurationFocused(false)}
                  onChange={(e) => {
                    const val = e.target.value;
                    const numeric = val.replace(/[^\d]/g, "");
                    setDurationSec(numeric);
                  }}
                  placeholder="Duration"
                  className="bg-gray-700 text-gray-100 p-2 rounded w-20"
                  disabled={recording || isProcessing}
                />
              </div>
              <button
                onClick={takePhoto}
                className="w-full py-3 px-4 bg-gray-700 text-gray-100 font-semibold rounded-lg shadow-md hover:bg-gray-600 transition-all duration-300 transform hover:-translate-y-1"
                disabled={recording || isProcessing}
              >
                Take Photo
              </button>
              <button
                onClick={setStartKeyframe}
                className="w-full py-3 px-4 bg-gray-700 text-gray-100 font-semibold rounded-lg shadow-md hover:bg-gray-600 transition-all duration-300 transform hover:-translate-y-1"
                disabled={recording || isProcessing}
              >
                Set Start Keyframe
              </button>
              <button
                onClick={setEndKeyframe}
                className="w-full py-3 px-4 bg-gray-700 text-gray-100 font-semibold rounded-lg shadow-md hover:bg-gray-600 transition-all duration-300 transform hover:-translate-y-1"
                disabled={recording || isProcessing}
              >
                Set End Keyframe
              </button>
              <button
                onClick={recordVideo}
                className="w-full py-3 px-4 bg-green-700 text-gray-100 font-semibold rounded-lg shadow-md hover:bg-green-600 transition-all duration-300 transform hover:-translate-y-1"
                disabled={recording || isProcessing}
              >
                Record Video
              </button>
              {(startKeyframePreview || endKeyframePreview) && (
                <div className="flex gap-4 mt-2">
                  {startKeyframePreview && (
                    <div className="w-24 h-24 border border-gray-700 rounded-lg overflow-hidden">
                      <img
                        src={startKeyframePreview}
                        alt="Start Keyframe Preview"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  {endKeyframePreview && (
                    <div className="w-24 h-24 border border-gray-700 rounded-lg overflow-hidden">
                      <img
                        src={endKeyframePreview}
                        alt="End Keyframe Preview"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
        
        {/* Box 2: Rotation Options */}
        <div className="p-4 bg-gray-800 border border-gray-700 backdrop-blur-lg shadow-xl rounded-lg flex flex-col gap-4">
          <div
            className="flex items-center justify-between p-2 cursor-pointer"
            onClick={() => setIsRotationMinimized(!isRotationMinimized)}
          >
            <h2 className="text-gray-100 font-bold text-lg">Rotation</h2>
            <span className="text-gray-100">{isRotationMinimized ? "+" : "–"}</span>
          </div>
          {!isRotationMinimized && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <label className="text-gray-100">
                  <input
                    type="checkbox"
                    checked={rotationType === "tilt"}
                    onChange={(e) =>
                      setRotationType(e.target.checked ? "tilt" : "")
                    }
                    disabled={recording || isProcessing}
                  />
                  Tilt
                </label>
                <label className="text-gray-100">
                  <input
                    type="checkbox"
                    checked={rotationType === "turn"}
                    onChange={(e) =>
                      setRotationType(e.target.checked ? "turn" : "")
                    }
                    disabled={recording || isProcessing}
                  />
                  Turn
                </label>
                <label className="text-gray-100">
                  <input
                    type="checkbox"
                    checked={rotationType === "roll"}
                    onChange={(e) =>
                      setRotationType(e.target.checked ? "roll" : "")
                    }
                    disabled={recording || isProcessing}
                  />
                  Roll
                </label>
              </div>
              {rotationType !== "" && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <label className="text-gray-100">Start Roll (deg):</label>
                    <input
                      type="number"
                      value={startRoll}
                      onChange={(e) =>
                        setStartRoll(parseFloat(e.target.value))
                      }
                      className="bg-gray-700 text-gray-100 p-2 rounded w-20"
                      disabled={recording || isProcessing}
                    />
                  </div>
                  <input
                    type="range"
                    min="-360"
                    max="360"
                    value={startRoll}
                    onChange={(e) => setStartRoll(parseFloat(e.target.value))}
                    className="w-full"
                    disabled={recording || isProcessing}
                  />
                  <div className="flex items-center gap-2">
                    <label className="text-gray-100">End Roll (deg):</label>
                    <input
                      type="number"
                      value={endRoll}
                      onChange={(e) =>
                        setEndRoll(parseFloat(e.target.value))
                      }
                      className="bg-gray-700 text-gray-100 p-2 rounded w-20"
                      disabled={recording || isProcessing}
                    />
                  </div>
                  <input
                    type="range"
                    min="-360"
                    max="360"
                    value={endRoll}
                    onChange={(e) => setEndRoll(parseFloat(e.target.value))}
                    className="w-full"
                    disabled={recording || isProcessing}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Box 3: Overlay Options */}
        <div className="p-4 bg-gray-800 border border-gray-700 backdrop-blur-lg shadow-xl rounded-lg flex flex-col gap-4">
          <div
            className="flex items-center justify-between p-2 cursor-pointer"
            onClick={() => setIsOverlayMinimized(!isOverlayMinimized)}
          >
            <h2 className="text-gray-100 font-bold text-lg">Overlay</h2>
            <span className="text-gray-100">{isOverlayMinimized ? "+" : "–"}</span>
          </div>
          {!isOverlayMinimized && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <label className="text-gray-100">Center Cross:</label>
                <input
                  type="checkbox"
                  checked={showCenterCross}
                  onChange={(e) => setShowCenterCross(e.target.checked)}
                  disabled={recording || isProcessing}
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-gray-100">Grid:</label>
                <input
                  type="checkbox"
                  checked={showGrid}
                  onChange={(e) => setShowGrid(e.target.checked)}
                  disabled={recording || isProcessing}
                />
              </div>
            </div>
          )}
        </div>
      </div>
      {recording && (
        <div className="absolute bottom-4 left-4 right-4 p-4 bg-gray-800 border border-gray-700 backdrop-blur-lg shadow-xl rounded-lg">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full"
              style={{ width: `${(currentFrame / totalFrames) * 100}%` }}
            ></div>
          </div>
          <p className="text-gray-100 text-sm mt-1">
            Processing frame {currentFrame} of {totalFrames}
          </p>
        </div>
      )}
      {isProcessing && (
        <div className="absolute bottom-4 left-4 right-4 p-4 bg-gray-800 border border-gray-700 backdrop-blur-lg shadow-xl rounded-lg text-center">
          <p className="text-gray-100 text-sm">Processing video, please wait...</p>
        </div>
      )}
      {!recording && (startRoll !== 0 || endRoll !== 0) && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <svg width="150" height="150" viewBox="0 0 150 150">
            <circle cx="75" cy="75" r="70" stroke="white" strokeWidth="2" fill="none" strokeOpacity="0.25" />
            <circle cx="75" cy="75" r="3" fill="red" fillOpacity="0.75" />
            <line x1="75" y1="75" x2="75" y2="15" stroke="red" strokeWidth="2" strokeOpacity="0.75"
              transform={`rotate(${startRoll}, 75, 75)`}
            />
            <line x1="75" y1="75" x2="75" y2="15" stroke="red" strokeWidth="2" strokeOpacity="0.75"
              transform={`rotate(${endRoll}, 75, 75)`}
            />
          </svg>
        </div>
      )}
      </div>
      <BottomBar />
    </main>
  );  
}
