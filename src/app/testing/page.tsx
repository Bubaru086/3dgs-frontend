"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import * as SPLAT from "gsplat";
import { useSearchParams } from "next/navigation";

export default function SplatPage() {
  const searchParams = useSearchParams();
  const projectName = searchParams.get("project") || "";
  const [error, setError] = useState<string>("");
  const [selectedFPS, setSelectedFPS] = useState(24);
  const [durationSec, setDurationSec] = useState(5);
  const [recording, setRecording] = useState(false);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [totalFrames, setTotalFrames] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  // Refs for DOM and SPLAT objects.
  const containerRef = useRef<HTMLDivElement>(null);
  const cameraRef = useRef<SPLAT.Camera | null>(null);
  const rendererRef = useRef<SPLAT.WebGLRenderer | null>(null);
  const controlsRef = useRef<any>(null);
  const sceneRef = useRef<SPLAT.Scene | null>(null);
  const keyframe1Ref = useRef<any>(null);
  const keyframe2Ref = useRef<any>(null);
  const defaultAnimationId = useRef<number | null>(null);

  // Persistent key state and mouse state.
  const keysPressed = useRef<{ [key: string]: boolean }>({});
  const mouseState = useRef({
    isDragging: false,
    lastX: 0,
    lastY: 0,
    orbitDeltaX: 0,
    orbitDeltaY: 0,
    moveDeltaY: 0,
  });

  // Free–look rotation offsets.
  const rotationOffsetRef = useRef({ yaw: 0, pitch: 0, roll: 0 });

  // ---- Utility Functions ----

// Compute the camera’s forward vector based on its rotation.
const getForwardVector = (quat: SPLAT.Quaternion): SPLAT.Vector3 => {
    // Assuming the default forward direction is along +Z.
    return quat.apply(new SPLAT.Vector3(0, 0, 1)).normalize();
  };
  
  // Compute the right vector based on the camera’s rotation.
  const getRightVector = (quat: SPLAT.Quaternion): SPLAT.Vector3 => {
    // Assuming the default right direction is along +X.
    return quat.apply(new SPLAT.Vector3(1, 0, 0)).normalize();
  };
  

  // Linear interpolation helper.
  const lerp = (a: number, b: number, t: number) => a * (1 - t) + b * t;

  // Interpolate between two keyframes.
  const interpolateCamera = (t: number) => {
    if (!cameraRef.current || !keyframe1Ref.current || !keyframe2Ref.current) return;
    const { position: startPos } = keyframe1Ref.current;
    const { position: endPos } = keyframe2Ref.current;
    cameraRef.current.position = new SPLAT.Vector3(
      lerp(startPos.x, endPos.x, t),
      lerp(startPos.y, endPos.y, t),
      lerp(startPos.z, endPos.z, t)
    );
  };

  // ---- Event Listeners ----

  // Keyboard listeners to track persistent key state.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      keysPressed.current[event.key.toLowerCase()] = true;
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      keysPressed.current[event.key.toLowerCase()] = false;
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  // Mouse event listeners on the container.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleContextMenu = (e: MouseEvent) => e.preventDefault();

    const handleMouseDown = (event: MouseEvent) => {
      mouseState.current.isDragging = true;
      mouseState.current.lastX = event.clientX;
      mouseState.current.lastY = event.clientY;
    };

    const handleMouseMove = (event: MouseEvent) => {
      if (!mouseState.current.isDragging) return;
      const deltaX = event.clientX - mouseState.current.lastX;
      const deltaY = event.clientY - mouseState.current.lastY;

      // Left–mouse drag updates orbit deltas.
      if (event.buttons & 1) {
        mouseState.current.orbitDeltaX += deltaX * 0.005;
        mouseState.current.orbitDeltaY += deltaY * 0.005;
      }
      // Right–mouse drag (or ctrl/cmd) for vertical movement.
      if (event.buttons & 2) {
        mouseState.current.moveDeltaY += deltaY * 0.01;
      }
      mouseState.current.lastX = event.clientX;
      mouseState.current.lastY = event.clientY;
    };

    const handleMouseUp = () => {
      mouseState.current.isDragging = false;
    };

    // Use capture mode to ensure these events are registered.
    container.addEventListener("mousedown", handleMouseDown, true);
    container.addEventListener("mousemove", handleMouseMove, true);
    container.addEventListener("mouseup", handleMouseUp, true);
    container.addEventListener("mouseleave", handleMouseUp, true);
    container.addEventListener("contextmenu", handleContextMenu, true);

    return () => {
      container.removeEventListener("mousedown", handleMouseDown, true);
      container.removeEventListener("mousemove", handleMouseMove, true);
      container.removeEventListener("mouseup", handleMouseUp, true);
      container.removeEventListener("mouseleave", handleMouseUp, true);
      container.removeEventListener("contextmenu", handleContextMenu, true);
    };
  }, []);

  // ---- Camera Control Helpers ----

  // Update camera translation based on arrow keys and vertical mouse drag.
  const updateTranslation = (cam: SPLAT.Camera, moveSpeed: number) => {
    const forward = getForwardVector(cam.rotation);
    const right = getRightVector(cam.rotation);
    let translation = new SPLAT.Vector3(0, 0, 0);

    if (keysPressed.current["arrowup"]) {
      translation = translation.add(forward.multiply(moveSpeed));
    }
    if (keysPressed.current["arrowdown"]) {
      translation = translation.subtract(forward.multiply(moveSpeed));
    }
    if (keysPressed.current["arrowright"]) {
      translation = translation.add(right.multiply(moveSpeed));
    }
    if (keysPressed.current["arrowleft"]) {
      translation = translation.subtract(right.multiply(moveSpeed));
    }
    if (mouseState.current.moveDeltaY) {
      translation = translation.add(new SPLAT.Vector3(0, mouseState.current.moveDeltaY * moveSpeed, 0));
    }
    cam.position = cam.position.add(translation);
  };

  // Update free–look rotation using WASD and QE keys.
  const updateFreeLookRotation = (rotSpeed: number) => {
    if (keysPressed.current["a"]) rotationOffsetRef.current.yaw -= rotSpeed;
    if (keysPressed.current["d"]) rotationOffsetRef.current.yaw += rotSpeed;
    if (keysPressed.current["w"]) rotationOffsetRef.current.pitch -= rotSpeed;
    if (keysPressed.current["s"]) rotationOffsetRef.current.pitch += rotSpeed;
    if (keysPressed.current["q"]) rotationOffsetRef.current.roll -= rotSpeed;
    if (keysPressed.current["e"]) rotationOffsetRef.current.roll += rotSpeed;
  };

  // Calculate orbit control deltas from keys and mouse dragging.
  const getOrbitDeltas = (rotSpeed: number) => {
    let deltaTheta = 0;
    let deltaPhi = 0;
    if (keysPressed.current["j"]) deltaTheta -= rotSpeed;
    if (keysPressed.current["l"]) deltaTheta += rotSpeed;
    if (keysPressed.current["i"]) deltaPhi += rotSpeed;
    if (keysPressed.current["k"]) deltaPhi -= rotSpeed;
    // Add mouse-based orbit deltas.
    deltaTheta += mouseState.current.orbitDeltaX;
    deltaPhi += mouseState.current.orbitDeltaY;
    return { deltaTheta, deltaPhi };
  };

  // Main function to update camera controls.
  const applyControls = useCallback(() => {
    const cam = cameraRef.current;
    if (!cam) return;
  
    const moveSpeed = 0.2;
    const rotSpeed = 0.02;
    
    // Update camera translation based on arrow keys and vertical mouse drag.
    updateTranslation(cam, moveSpeed);
    
    // Update free–look rotation using WASD and QE keys.
    updateFreeLookRotation(rotSpeed);
    
    // Get orbit deltas from keys and mouse dragging.
    const { deltaTheta, deltaPhi } = getOrbitDeltas(rotSpeed);
    
    // Instead of orbiting around a fixed pivot, add orbit deltas directly to free–look rotation.
    rotationOffsetRef.current.yaw += deltaTheta;
    rotationOffsetRef.current.pitch += deltaPhi;
    
    // Update camera rotation based solely on the updated free–look offsets.
    cam.rotation = SPLAT.Quaternion.FromEuler(
      new SPLAT.Vector3(
        rotationOffsetRef.current.pitch,
        rotationOffsetRef.current.yaw,
        rotationOffsetRef.current.roll
      )
    );
    
    // Reset mouse orbit deltas for the next frame.
    mouseState.current.orbitDeltaX = 0;
    mouseState.current.orbitDeltaY = 0;
    mouseState.current.moveDeltaY = 0;
  }, []);
  

  // ---- Animation Loop ----

  const defaultFrame = useCallback(() => {
    if (!rendererRef.current || !sceneRef.current || !cameraRef.current) return;
    applyControls();
    rendererRef.current.render(sceneRef.current, cameraRef.current);
    defaultAnimationId.current = requestAnimationFrame(defaultFrame);
  }, [applyControls]);

  // ---- Initialization ----

  useEffect(() => {
    if (!projectName) {
      window.location.href = "/";
    }
  }, [projectName]);

  useEffect(() => {
    if (!projectName || !containerRef.current) {
      setError("Project name is missing or container not found.");
      return;
    }

    // Set up the scene, camera, renderer, and controls.
    const scene = new SPLAT.Scene();
    sceneRef.current = scene;
    const camera = new SPLAT.Camera();
    cameraRef.current = camera;
    const renderer = new SPLAT.WebGLRenderer();
    rendererRef.current = renderer;
    controlsRef.current = new SPLAT.OrbitControls(camera, renderer.canvas);

    // Adjust renderer resolution.
    const pixelRatio = window.devicePixelRatio || 1;
    renderer.setSize(window.innerWidth * pixelRatio, window.innerHeight * pixelRatio);
    containerRef.current.appendChild(renderer.canvas);

    async function main() {
      const url = `http://localhost:8000/splat/${projectName}`;
      await SPLAT.Loader.LoadAsync(url, scene, () => {});
      defaultFrame();
    }
    main();
  }, [projectName, defaultFrame]);

  // ---- Keyframe and Recording Handlers ----

  const takePhoto = () => {
    if (!rendererRef.current) return;
    requestAnimationFrame(() => {
      rendererRef.current!.canvas.toBlob((blob: Blob | null) => {
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
    if (!cameraRef.current) return;
    keyframe1Ref.current = { position: { ...cameraRef.current.position } };
    console.log("Start keyframe set:", keyframe1Ref.current);
  };

  const setEndKeyframe = () => {
    if (!cameraRef.current) return;
    keyframe2Ref.current = { position: { ...cameraRef.current.position } };
    console.log("End keyframe set:", keyframe2Ref.current);
  };

  const recordVideo = async () => {
    if (!rendererRef.current || !cameraRef.current) return;
    if (!keyframe1Ref.current || !keyframe2Ref.current) {
      alert("Please set both start and end keyframes before recording video.");
      return;
    }

    // Disable OrbitControls and stop the animation loop.
    const oldControlsEnabled = controlsRef.current.enabled;
    controlsRef.current.enabled = false;
    if (defaultAnimationId.current) cancelAnimationFrame(defaultAnimationId.current);

    const duration = durationSec * 1000;
    const fps = selectedFPS;
    const computedTotalFrames = Math.floor(duration / (1000 / fps));
    setTotalFrames(computedTotalFrames);
    setCurrentFrame(0);
    setRecording(true);

    const canvas = rendererRef.current.canvas;
    const frames: Blob[] = [];

    for (let i = 0; i < computedTotalFrames; i++) {
      const t = i / (computedTotalFrames - 1);
      interpolateCamera(t);
      rendererRef.current.render(sceneRef.current!, cameraRef.current);
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const blob: Blob | null = await new Promise((resolve) => {
        canvas.toBlob(resolve, "image/png");
      });
      if (blob) frames.push(blob);
      setCurrentFrame(i + 1);
    }

    // Re-enable controls and resume the animation loop.
    controlsRef.current.enabled = oldControlsEnabled;
    defaultFrame();
    setRecording(false);
    setIsProcessing(true);

    // Send frames to backend for video processing.
    const formData = new FormData();
    formData.append("project_name", projectName);
    formData.append("fps", String(fps));
    frames.forEach((frame, index) => {
      const fileName = `frame${String(index).padStart(3, "0")}.png`;
      formData.append("files", new File([frame], fileName, { type: "image/png" }));
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

  // ---- Render UI ----

  return (
    <main className="w-full h-full">
      <div ref={containerRef} className="w-full h-full" />

      {isMinimized ? (
        <button
          onClick={() => setIsMinimized(false)}
          className="absolute top-10 left-10 z-50 p-2 bg-gray-800 bg-opacity-75 rounded text-white"
        >
          +
        </button>
      ) : (
        <div className="absolute top-10 left-10 z-50 flex flex-col gap-4 p-4 bg-gray-800 bg-opacity-75 rounded">
          <div className="flex justify-end">
            <button onClick={() => setIsMinimized(true)} className="text-white">
              –
            </button>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-white font-medium">FPS:</label>
            <select
              value={selectedFPS}
              onChange={(e) => setSelectedFPS(parseInt(e.target.value))}
              className="bg-gray-700 text-white p-2 rounded"
              disabled={recording || isProcessing}
            >
              <option value={24}>24</option>
              <option value={30}>30</option>
              <option value={60}>60</option>
              <option value={120}>120</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-white font-medium">Duration (sec):</label>
            <input
              type="number"
              value={durationSec}
              onChange={(e) => setDurationSec(parseInt(e.target.value))}
              className="bg-gray-700 text-white p-2 rounded w-20"
              disabled={recording || isProcessing}
            />
          </div>
          <button
            onClick={takePhoto}
            className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded"
            disabled={recording || isProcessing}
          >
            Take Photo
          </button>
          <button
            onClick={setStartKeyframe}
            className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded"
            disabled={recording || isProcessing}
          >
            Set Start Keyframe
          </button>
          <button
            onClick={setEndKeyframe}
            className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded"
            disabled={recording || isProcessing}
          >
            Set End Keyframe
          </button>
          <button
            onClick={recordVideo}
            className="bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-4 rounded"
            disabled={recording || isProcessing}
          >
            Record Video
          </button>
        </div>
      )}

      {recording && (
        <div className="absolute bottom-4 left-4 right-4 p-4 bg-gray-800 bg-opacity-75 rounded">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full"
              style={{ width: `${(currentFrame / totalFrames) * 100}%` }}
            ></div>
          </div>
          <p className="text-white text-sm mt-1">
            Processing frame {currentFrame} of {totalFrames}
          </p>
        </div>
      )}

      {isProcessing && (
        <div className="absolute bottom-4 left-4 right-4 p-4 bg-gray-800 bg-opacity-75 rounded text-center">
          <p className="text-white text-sm">Processing video, please wait...</p>
        </div>
      )}
    </main>
  );
}
