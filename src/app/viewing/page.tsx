"use client";
import { useSearchParams } from "next/navigation";
import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { PLYLoader } from "three/examples/jsm/loaders/PLYLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export default function Viewing() {
  const searchParams = useSearchParams();
  const projectName = searchParams.get("project") || "";
  const containerRef = useRef<HTMLDivElement>(null);
  const [plyFile, setPlyFile] = useState<File | null>(null);
  const [error, setError] = useState<string>("");

  // Refs to store our Three.js objects
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);  

  // Initialize scene, camera, renderer, and controls
  useEffect(() => {
    if (!containerRef.current) return;
    
    // Create scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    sceneRef.current = scene;
    
    // Create camera
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.set(0, 0, 2);
    cameraRef.current = camera;
    
    // Create renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    rendererRef.current = renderer;
    containerRef.current.appendChild(renderer.domElement);
    
    // Add orbit controls for user navigation
    const controls = new OrbitControls(camera, renderer.domElement);

    // Enable damping for smoother transitions
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;

    // Set zoom constraints
    controls.enableZoom = true;
    controls.minDistance = 0.5;
    controls.maxDistance = 50;

    controlsRef.current = controls;
    
    // Add a basic ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    
    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();
    
    // Handle window resize
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
    };
  }, []);

  useEffect(() => {
    if (!projectName) {
      window.location.href = "/";
    }
  }, [projectName]);
  
  // Fetch the PLY file from the backend on component mount
  useEffect(() => {
    const fetchPlyFile = async () => {
        if (!projectName) {
            setError("Project name is missing.");
            return;
          }
      try {
        const response = await fetch("http://localhost:8000/ply/" + projectName);
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

    fetchPlyFile();
  }, []);

  // Load the fetched PLY file when plyFile state changes
  useEffect(() => {
    if (!plyFile || !sceneRef.current) return;
    setError("");
    
    // Create a URL for the file and load it with PLYLoader
    const url = URL.createObjectURL(plyFile);
    const loader = new PLYLoader();
    loader.load(
      url,
      (geometry) => {
        geometry.computeVertexNormals();
        //geometry.computeBoundingBox();
        //geometry.center();
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

  return (
    <main className="flex flex-col items-center justify-center h-screen">
      {error && <p className="text-red-600">{error}</p>}
      <div ref={containerRef} className="w-full h-full" />
    </main>
  );
}
