"use client";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import axios from "axios";

export default function BottomBar() {
  const searchParams = useSearchParams();
  const project = searchParams.get("project") || "";
  const [progress, setProgress] = useState("");

  useEffect(() => {
    if (project) {
      axios
        .get("http://localhost:8000/progress/", {
          params: { project_name: project },
        })
        .then((response) => {
          setProgress(response.data.progress);
        })
        .catch((error) => {
          console.error("Error fetching project progress:", error);
          setProgress("");
        });
    }
  }, [project]);

  // Define the pipeline stages.
  const navItems = [
    { label: "Preprocessing" },
    { label: "Converting" },
    { label: "Training" },
    { label: "Rendering" },
  ];

  // Define the order of stages matching backend progress values.
  const stages = ["preprocessing", "converting", "training", "rendering"];
  const currentStageIndex = stages.indexOf(progress.toLowerCase());

  const getDotColor = (index: number) => {
    if (currentStageIndex === -1) return "bg-gray-500";
    if (index < currentStageIndex) return "bg-green-500";
    if (index === currentStageIndex) return "bg-yellow-500";
    return "bg-red-500";
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700 p-4 flex justify-around items-center">
      {navItems.map((item, index) => (
        <div key={item.label} className="flex flex-col items-center">
          <div className="text-white font-bold">{item.label}</div>
          <div className={`w-2 h-2 rounded-full mt-1 ${getDotColor(index)}`}></div>
        </div>
      ))}
    </div>
  );
}
