import React, { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import axios from "axios";

export default function HomeUI() {
  // For bottom bar progress display
  const [progress, setProgress] = useState("");
  const searchParams = useSearchParams();
  const project = searchParams?.get("project") || "";

  useEffect(() => {
    if (project) {
      axios
        .get("http://localhost:8000/progress/", {
          params: { project_name: project },
        })
        .then((response) => setProgress(response.data.progress))
        .catch((err) => {
          console.error("Error fetching project progress:", err);
          setProgress("");
        });
    }
  }, [project]);

  // Bottom bar items and stage logic
  const navItems = [
    { label: "Preprocessing" },
    { label: "Converting" },
    { label: "Training" },
    { label: "Rendering" },
  ];

  const stages = ["preprocessing", "converting", "training", "rendering"];
  const currentStageIndex = stages.indexOf(progress.toLowerCase());

  const getDotColor = (index: number) => {
    if (currentStageIndex === -1) return "bg-gray-500";
    if (index < currentStageIndex) return "bg-green-500";
    if (index === currentStageIndex) return "bg-yellow-500";
    return "bg-red-500";
  };

  return (
    <footer className="fixed bottom-0 left-0 right-0 bg-black border-t border-white p-4 flex justify-around items-center">
      {navItems.map((item, index) => (
        <div key={item.label} className="flex flex-col items-center">
          <span className="text-white font-mono">{item.label}</span>
          <div className={`w-2 h-2 rounded-full mt-1 ${getDotColor(index)}`}></div>
        </div>
      ))}
    </footer>
  );
}
