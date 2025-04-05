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
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-r from-gray-900 to-gray-800">
      <div className="bg-gray-800 border border-gray-700 backdrop-blur-lg shadow-xl rounded-lg p-10 max-w-md w-full text-center">
        <h1 className="text-4xl font-extrabold mb-4 text-gray-100">
          Create Your 3DGS
        </h1>
        <input
          type="text"
          placeholder="Project Name"
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          className="w-full p-3 mb-4 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 transition"
        />
        <button
          onClick={handleCreateProject}
          className="w-full py-3 px-4 bg-gray-700 text-gray-100 font-semibold rounded-lg shadow-md hover:bg-gray-600 transition-all duration-300 transform hover:-translate-y-1"
        >
          Start Project
        </button>
        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
      </div>
    </main>
  );
}
