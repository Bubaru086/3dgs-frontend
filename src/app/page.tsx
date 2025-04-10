"use client";
import { useState } from "react";
import axios from "axios";
import { useRouter } from "next/navigation";

export default function Home() {
  const [projectName, setProjectName] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  const handleCreateProject = async () => {
    if (!/^[A-Za-z]+$/.test(projectName)) {
      setError("Project name must contain only letters.");
      return;
    }

    try {
      // Create the project
      const response = await axios.post("http://localhost:8000/project/", null, {
        params: { project_name: projectName },
      });

      if (response.status === 200) {
        // Check project progress
        const progressResponse = await axios.get("http://localhost:8000/progress/", {
          params: { project_name: projectName },
        });
        const progress = progressResponse.data.progress;

        // Redirect based on the progress
        if (progress === "rendering") {
          router.push(`/rendering/?project=${projectName}`);
        } else if (progress === "training") {
          router.push(`/training/?project=${projectName}`);
        } else if (progress === "converting") {
          router.push(`/converting/?project=${projectName}`);
        } else {
          router.push(`/preprocessing/?project=${projectName}`);
        }
      }
    } catch (err) {
      setError("Error creating project. Try again.");
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-black">
      <div className="flex flex-col items-center space-y-8">
        {/* Logo Image */}
        <img src="/logo.png" alt="Logo" className="w-150 h-auto" />

        <hr></hr>

        {/* Title and Slogan */}
        <p className="text-lg text-white font-mono">
          Bring your videos to life with 3D Gaussian Splatting!
        </p>

        {/* Input with CMD prompt look */}
        <input
          type="text"
          placeholder="Enter Project Name"
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          className="w-64 p-3 bg-black text-white font-mono rounded focus:outline-none text-center"
        />

        {/* Start Project Button */}
        <button
          onClick={handleCreateProject}
          className="w-64 p-3 bg-black text-white font-bold font-mono border border-white py-2 rounded cursor-pointer hover:bg-white hover:text-black hover:-translate-y-1 transition-all duration-300"
        >
          Start Project
        </button>

        {/* Error message */}
        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
      </div>
    </main>
  );
}
