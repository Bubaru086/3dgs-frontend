"use client";
import { useState, useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import * as THREE from "three";
import { PLYLoader } from "three/examples/jsm/loaders/PLYLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import BottomBar from "../components/BottomBar";

export default function TrainingAndViewing() {
  const searchParams = useSearchParams();
  const projectName = searchParams.get("project") || "";
  const router = useRouter();

  // Training state
  const [resolutionPercent, setResolutionPercent] = useState(50);
  const [originalResolution, setOriginalResolution] = useState({ width: 0, height: 0 });
  const [progressCurrent, setProgressCurrent] = useState(0);
  const [progressTotal, setProgressTotal] = useState(0);
  const [isTraining, setIsTraining] = useState(false);
  const [error, setError] = useState("");

  // PLY file state
  const [plyFile, setPlyFile] = useState<File | null>(null);
  const [plyLoaded, setPlyLoaded] = useState(false);
  const [showViewer, setShowViewer] = useState(true);

  // Use a ref to track if the ply file has been loaded
  const plyLoadedRef = useRef(false);

  // THREE.js viewer refs
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);

  // Redirect if no project name provided
  useEffect(() => {
    if (!projectName) {
      window.location.href = "/";
    }
  }, [projectName]);

  // Fetch the original image resolution on mount
  useEffect(() => {
    async function fetchResolution() {
      try {
        const res = await fetch(`http://localhost:8000/resolution/${projectName}`);
        if (res.ok) {
          const data = await res.json();
          setOriginalResolution({ width: data.width, height: data.height });
        } else {
          console.error("Failed to fetch image resolution");
        }
      } catch (err) {
        console.error("Error fetching resolution", err);
      }
    }
    if (projectName) {
      fetchResolution();
    }
  }, [projectName]);

  // Initialize THREE.js scene and viewer only after ply is loaded
  useEffect(() => {
    if (!plyLoaded) return;
    if (!containerRef.current) return;
  
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    sceneRef.current = scene;
  
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.set(0, 0, 2);
    cameraRef.current = camera;
  
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    rendererRef.current = renderer;
    containerRef.current.appendChild(renderer.domElement);
  
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controls.enableZoom = true;
    controls.minDistance = 0.5;
    controls.maxDistance = 50;
    controlsRef.current = controls;
  
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
  
    loadCameras();
  
    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();
  
    const handleResize = () => {
      if (containerRef.current && rendererRef.current && cameraRef.current) {
        const width = containerRef.current.clientWidth;
        const height = containerRef.current.clientHeight;
        rendererRef.current.setSize(width, height);
        cameraRef.current.aspect = width / height;
        cameraRef.current.updateProjectionMatrix();
      }
    };
    window.addEventListener("resize", handleResize);
  
    return () => {
      window.removeEventListener("resize", handleResize);
      renderer.dispose();
      controls.dispose();
  
      if (containerRef.current && renderer.domElement.parentNode === containerRef.current) {
        containerRef.current.removeChild(renderer.domElement);
      }
    };
  }, [plyLoaded]);  

  // Load the fetched PLY file into the scene once plyFile is set
  useEffect(() => {
    if (!plyFile || !sceneRef.current) return;
    setError("");

    const url = URL.createObjectURL(plyFile);
    const loader = new PLYLoader();
    loader.load(
      url,
      (geometry) => {
        geometry.computeVertexNormals();
        geometry.applyMatrix4(new THREE.Matrix4().makeRotationX(Math.PI));
        const material = new THREE.PointsMaterial({ color: 0xffffff, size: 0.01 });
        const points = new THREE.Points(geometry, material);
        sceneRef.current?.add(points);
        URL.revokeObjectURL(url);
      },
      (xhr) => {
        console.log(`PLY file ${(xhr.loaded / xhr.total) * 100}% loaded`);
      },
      (err) => {
        console.error("Error loading PLY file:", err);
        setError("Failed to load PLY file.");
      }
    );
  }, [plyFile]);

  // Function to load the PLY file using fetch
  const loadPlyFile = async () => {
    // Use the ref to ensure this is only executed once
    if (plyLoadedRef.current) return;
    plyLoadedRef.current = true;
    setPlyLoaded(true);
    try {
      const response = await fetch(`http://localhost:8000/ply/${projectName}`);
      if (!response.ok) {
        throw new Error("Failed to fetch PLY file");
      }
      const blob = await response.blob();
      const file = new File([blob], "model.ply", { type: "application/octet-stream" });
      setPlyFile(file);
    } catch (error) {
      console.error("Error fetching PLY file:", error);
      setError("Failed to fetch PLY file.");
    }
  };

  const loadCameras = async () => {
    try {
      const response = await fetch(`http://localhost:8000/cameras/${projectName}`);
      if (!response.ok) {
        throw new Error("Failed to fetch cameras data");
      }
      const cameras = await response.json();
      const rotationMatrix = new THREE.Matrix4().makeRotationX(Math.PI);
      cameras.forEach((cam: { position: number[] }) => {
        const position = new THREE.Vector3(...cam.position);
        position.applyMatrix4(rotationMatrix);
        // Create a small red sphere for each camera
        const dotGeometry = new THREE.SphereGeometry(0.02, 16, 16);
        const dotMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        const dot = new THREE.Mesh(dotGeometry, dotMaterial);
        dot.position.copy(position);
        sceneRef.current?.add(dot);
      });
    } catch (error) {
      console.error("Error loading cameras:", error);
    }
  };  

  // Handle training start and progress via EventSource
  const handleTrain = () => {
    if (!projectName) {
      setError("Project name is missing.");
      return;
    }
    setIsTraining(true);
    setError("");

    // Pass the resolution percentage in the query string.
    const trainUrl = `http://localhost:8000/train/?project_name=${projectName}&resolution=${resolutionPercent}`;
    const trainEventSource = new EventSource(trainUrl);

    trainEventSource.onmessage = (event) => {
      if (event.data.includes("Training completed successfully")) {
        trainEventSource.close();
        setIsTraining(false);
        router.push(`/rendering/?project=${projectName}`);
        return;
      }
      const lines = event.data.split("\n");
      lines.forEach((line: string) => {
        if (line.includes("Training progress:")) {
          const fractionMatch = line.match(/(\d+)\/(\d+)/);
          if (fractionMatch) {
            const current = parseInt(fractionMatch[1], 10);
            const total = parseInt(fractionMatch[2], 10);
            setProgressCurrent(current);
            setProgressTotal(total);
            if (!plyLoadedRef.current) {
              loadPlyFile();
            }
          }
        }
      });
    };

    trainEventSource.onerror = (err) => {
      console.error("Training EventSource error:", err);
      setError("Training failed. Please try again.");
      trainEventSource.close();
      setIsTraining(false);
    };
  };

  // When the PLY file is loaded, render the full-page viewer using the same layout
  if (plyLoaded && showViewer) {
    return (
      <main className="min-h-screen bg-black text-white font-mono flex flex-col">
        <header className="flex items-center px-4 py-3 border-b border-white bg-black">
          <img src="/logo-small.png" alt="Logo" className="h-10 w-auto mr-4" />
          <h1 className="text-xl font-bold">{projectName}</h1>
        </header>
        <div className="flex-grow relative">
          {/* THREE.js Canvas container */}
          <div className="absolute inset-0" ref={containerRef}></div>
          
          {/* New overlay for "Training" text */}
          <div className="absolute top-0 left-0 right-0 p-4 text-center pointer-events-none">
            <h2 className="text-5xl font-bold uppercase tracking-wide text-white">
              {progressCurrent == progressTotal ? (
                "preparing"
              ) : (
                "training"
              )}
            </h2>
          </div>

          {progressCurrent == progressTotal && (
            <div className="absolute inset-0 z-10 flex items-center justify-center" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
              <div className="w-16 h-16 bg-white animate-spin"></div>
            </div>
          )}
          
          {/* Progress bar at the bottom */}
          <div
            className="absolute left-0 right-0 p-4"
            style={{ bottom: "4rem", zIndex: 10 }}
          >
            {progressTotal > 0 && (
              <div className="flex items-center justify-center space-x-2">
                <span className="text-white">
                  {Math.round((progressCurrent / progressTotal) * 100)}%
                </span>
                <progress value={progressCurrent} max={progressTotal} className="w-1/2"></progress>
                <span className="text-white">
                  {progressCurrent}/{progressTotal}
                </span>
              </div>
            )}
          </div>
        </div>
        <BottomBar />
      </main>
    );
  }  

  // Before the PLY file is loaded, show the training UI with the matching layout and styling
  return (
    <main className="min-h-screen bg-black text-white font-mono flex flex-col">
      <header className="flex items-center px-4 py-3 border-b border-white bg-black">
        <img src="/logo-small.png" alt="Logo" className="h-10 w-auto mr-4" />
        <h1 className="text-xl font-bold">{projectName}</h1>
      </header>
      <div className="flex-col flex items-center justify-center px-4 py-48">
        <div className="w-full max-w-6xl">
          <div className="mb-12 text-center">
            <h2 className="text-5xl font-bold uppercase tracking-wide my-6">
              training
            </h2>
          </div>
          <div className="w-full bg-black p-4 mt-6">
            <div className="flex flex-col items-center space-y-4">
              <div className="relative w-full md:w-3/4 mt-6">
                <input
                  type="range"
                  min="1"
                  max="100"
                  value={resolutionPercent}
                  disabled={isTraining}
                  onChange={(e) => setResolutionPercent(Number(e.target.value))}
                  className="w-full fps-slider"
                />
                <span
                  className="absolute -top-6 text-white text-sm"
                  style={{
                    left: `${resolutionPercent}%`,
                    transform: "translateX(-50%)",
                  }}
                >
                  {resolutionPercent}%
                </span>
              </div>
              <p>
                Training Resolution:{" "}
                {originalResolution.width && originalResolution.height
                  ? `${Math.round(originalResolution.width * (resolutionPercent / 100))} x ${Math.round(
                      originalResolution.height * (resolutionPercent / 100)
                    )}`
                  : "Loading..."}
              </p>
              <style jsx>{`
                /* Style the slider track */
                input[type='range'].fps-slider {
                  -webkit-appearance: none;
                  width: 100%;
                  height: 8px;
                  background: white;
                  outline: none;
                  border-radius: 0;
                  margin: 10px 0;
                }
                                    
                /* Custom thumb styling for Webkit browsers */
                input[type='range'].fps-slider::-webkit-slider-thumb {
                  -webkit-appearance: none;
                  width: 16px;
                  height: 16px;
                  background: white;
                  border: 2px solid black;
                  border-radius: 0;
                  cursor: pointer;
                  margin-top: -4px;
                }
              `}</style>
            </div>
            {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
          </div>
          <div className="flex flex-col items-center justify-center mt-12">
            <button
              className="w-full md:w-1/2 py-3 px-4 border border-white rounded cursor-pointer hover:bg-white hover:text-black hover:-translate-y-1 transition"
              onClick={handleTrain}
              disabled={isTraining}
            >
              {isTraining ? "Loading..." : "Start Training"}
            </button>
          </div>
        </div>
      </div>
      <BottomBar />
    </main>
  );
}
