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
      cameras.forEach((cam: { position: number[] }) => {
        const [x, y, z] = cam.position;
        // Create a small red sphere for each camera
        const dotGeometry = new THREE.SphereGeometry(0.02, 16, 16);
        const dotMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        const dot = new THREE.Mesh(dotGeometry, dotMaterial);
        dot.position.set(x, y, z);
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
        // (Rest of your success handling remains unchanged)
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

  // When ply is loaded, render a full-page viewer that hides everything else,
  // except for the progress messages at the bottom.
  if (plyLoaded && showViewer) {
    return (
      <div className="relative h-screen w-screen">
        <div className="absolute inset-0" ref={containerRef}></div>
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-black bg-opacity-50">
        {progressTotal > 0 && (
          <div className="flex justify-center">
            <progress value={progressCurrent} max={progressTotal} className="w-1/2"></progress>
          </div>
        )}
        </div>
      </div>
    );
  }

  // Before the PLY file is loaded, show the training UI (without the three.js viewer)
  // In the training UI (before PLY is loaded), replace the dropdown with a slider.
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-r from-gray-900 to-gray-800">
      <div className="flex-grow flex items-center justify-center">
      <div className="bg-gray-800 border border-gray-700 backdrop-blur-lg shadow-xl rounded-lg p-10 max-w-md w-full text-center">
        <h1 className="text-4xl font-extrabold mb-4 text-gray-100">
          Train and View Project "{projectName}"
        </h1>
        <div className="flex flex-col items-center space-y-4">
          <label className="block text-sm font-medium text-gray-100">Resolution Percentage</label>
          <input
            type="range"
            min="1"
            max="100"
            value={resolutionPercent}
            onChange={(e) => setResolutionPercent(Number(e.target.value))}
            className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-500 transition"
          />
          <p className="text-gray-100">
            Training Resolution:{" "}
            {originalResolution.width && originalResolution.height
              ? `${Math.round(originalResolution.width * (resolutionPercent / 100))} x ${Math.round(
                  originalResolution.height * (resolutionPercent / 100)
                )}`
              : "Loading..."}
          </p>
          <button
            className="w-full py-3 px-4 bg-green-500 text-white font-semibold rounded-lg shadow-md hover:bg-green-700 transition-all duration-300 transform hover:-translate-y-1"
            onClick={handleTrain}
            disabled={isTraining}
          >
            {isTraining ? "Starting..." : "Start Training"}
          </button>
        </div>
        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
      </div>
      </div>
      <BottomBar />
    </main>
  );  
}
