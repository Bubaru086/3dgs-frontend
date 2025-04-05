"use client";
import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import BottomBar from "../components/BottomBar";

interface FeatureExtractionProgress {
  current: number;
  total: number;
  name: string;
  dimensions: string;
  camera: string;
  focalLength: string;
  features: string;
}

interface FeatureMatchingProgress {
  currentStep: number;
  totalSteps: number;
  matchedIn: string;
}

interface IncrementalPipelineProgress {
  count: number;
  imageId: number;
  points: string;
}

interface UndistortionProgress {
  current: number;
  total: number;
}

export default function Converting() {
  const searchParams = useSearchParams();
  const projectName = searchParams.get("project") || "";
  
  const [phase, setPhase] = useState<"extraction" | "matching" | "undistortion">("extraction");

  const [featureExtractionProgress, setFeatureExtractionProgress] = useState<FeatureExtractionProgress>({
    current: 0,
    total: 0,
    name: "",
    dimensions: "",
    camera: "",
    focalLength: "",
    features: ""
  });
  
  const [featureMatchingProgress, setFeatureMatchingProgress] = useState<FeatureMatchingProgress>({
    currentStep: 0,
    totalSteps: 0,
    matchedIn: ""
  });
  
  const [incrementalProgress, setIncrementalProgress] = useState<IncrementalPipelineProgress>({
    count: 0,
    imageId: 0,
    points: ""
  });
  
  const [undistortionProgress, setUndistortionProgress] = useState<UndistortionProgress>({
    current: 0,
    total: 0,
  });
  
  // Flags to decide whether to show each step's UI (they persist once shown)
  const [showExtraction, setShowExtraction] = useState(false);
  const [showMatching, setShowMatching] = useState(false);
  const [showUndistortion, setShowUndistortion] = useState(false);
  
  const [isConverting, setIsConverting] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  
  useEffect(() => {
    if (!projectName) {
      window.location.href = "/";
    }
  }, [projectName]);
  
  const handleConvert = () => {
    if (!projectName) {
      setError("Project name is missing.");
      return;
    }
    setIsConverting(true);
    setPhase("extraction");
    // Reset progress and flags.
    setFeatureExtractionProgress({
      current: 0,
      total: 0,
      name: "",
      dimensions: "",
      camera: "",
      focalLength: "",
      features: ""
    });
    setFeatureMatchingProgress({
      currentStep: 0,
      totalSteps: 0,
      matchedIn: ""
    });
    setIncrementalProgress({
      count: 0,
      imageId: 0,
      points: ""
    });
    setUndistortionProgress({
      current: 0,
      total: 0
    });
    setError("");
    // Reset all show flags so nothing is visible until events are received.
    setShowExtraction(false);
    setShowMatching(false);
    setShowUndistortion(false);
  
    const eventSource = new EventSource(`http://localhost:8000/convert/?project_name=${projectName}`);
  
    eventSource.onmessage = (event) => {
      if (event.data.includes("Conversion completed successfully")) {
        eventSource.close();
        router.push(`/training/?project=${projectName}`);
        return;
      }
  
      const lines = event.data.split("\n");
      lines.forEach((line: string) => {
        // --- Undistortion logs ---
        if (/Undistorting image/i.test(line)) {
          if (phase !== "undistortion") {
            setPhase("undistortion");
            setShowUndistortion(true);
          }
          const match = line.match(/Undistorting image\s+\[(\d+)\/(\d+)\]/i);
          if (match) {
            setUndistortionProgress({
              current: parseInt(match[1]),
              total: parseInt(match[2])
            });
          }
        }
        // --- Matching block logs ---
        else if (/Matching block/i.test(line)) {
          if (phase === "extraction") {
            setPhase("matching");
            setShowMatching(true);
          }
          const match = line.match(/Matching block \[(\d+)\/(\d+),\s*(\d+)\/(\d+)\]/i);
          if (match) {
            const firstNum = parseInt(match[1]);
            const firstDenom = parseInt(match[2]);
            const secondNum = parseInt(match[3]);
            const secondDenom = parseInt(match[4]);
            const currentStep = (firstNum - 1) * firstDenom + secondNum;
            const totalSteps = firstDenom * secondDenom;
            setFeatureMatchingProgress(prev => ({
              ...prev,
              currentStep,
              totalSteps
            }));
          }
        }
        // Matching time log
        else if (/feature_matching\.cc.*in\s+([\d\.]+s)/i.test(line)) {
          const match = line.match(/in\s+([\d\.]+s)/i);
          if (match) {
            setFeatureMatchingProgress(prev => ({
              ...prev,
              matchedIn: match[1]
            }));
          }
        }
        // --- Incremental Pipeline logs (still in matching phase) ---
        else if (/Registering image/i.test(line)) {
          const match = line.match(/Registering image\s+#(\d+)\s+\((\d+)\)/i);
          if (match) {
            const imageId = parseInt(match[1]);
            const count = parseInt(match[2]);
            setIncrementalProgress(prev => ({
              ...prev,
              imageId,
              count
            }));
          }
        } else if (/=> Image sees/i.test(line)) {
          const match = line.match(/=> Image sees\s+(\d+\s*\/\s*\d+)\s+points/i);
          if (match) {
            setIncrementalProgress(prev => ({
              ...prev,
              points: match[1].trim()
            }));
          }
        }
        // --- Extraction logs ---
        else {
          // We consider any extraction log to be part of extraction phase.
          if (!showExtraction) setShowExtraction(true);
          if (/Processed file/i.test(line)) {
            const match = line.match(/Processed file \[(\d+)\/(\d+)\]/i);
            if (match) {
              setFeatureExtractionProgress(prev => ({
                ...prev,
                current: parseInt(match[1]),
                total: parseInt(match[2])
              }));
            }
          } else if (/Name:\s*(.*)/i.test(line)) {
            const match = line.match(/Name:\s*(.*)/i);
            if (match) {
              setFeatureExtractionProgress(prev => ({
                ...prev,
                name: match[1].trim()
              }));
            }
          } else if (/Dimensions:\s*(.*)/i.test(line)) {
            const match = line.match(/Dimensions:\s*(.*)/i);
            if (match) {
              setFeatureExtractionProgress(prev => ({
                ...prev,
                dimensions: match[1].trim()
              }));
            }
          } else if (/Camera:\s*(.*)/i.test(line)) {
            const match = line.match(/Camera:\s*(.*)/i);
            if (match) {
              setFeatureExtractionProgress(prev => ({
                ...prev,
                camera: match[1].trim()
              }));
            }
          } else if (/Focal Length:\s*(.*)/i.test(line)) {
            const match = line.match(/Focal Length:\s*(.*)/i);
            if (match) {
              setFeatureExtractionProgress(prev => ({
                ...prev,
                focalLength: match[1].trim()
              }));
            }
          } else if (/Features:\s*(.*)/i.test(line)) {
            const match = line.match(/Features:\s*(.*)/i);
            if (match) {
              setFeatureExtractionProgress(prev => ({
                ...prev,
                features: match[1].trim()
              }));
            }
          }
        }
      });
    };
  
    eventSource.onerror = (err) => {
      console.error("EventSource error:", err);
      setError("Conversion failed. Please try again.");
      eventSource.close();
      setIsConverting(false);
    };
  };
  
  // Calculate progress percentages.
  const extractionPercentage = featureExtractionProgress.total
    ? Math.round((featureExtractionProgress.current / featureExtractionProgress.total) * 100)
    : 0;
  
  const matchingPercentage = featureMatchingProgress.totalSteps
    ? Math.round((featureMatchingProgress.currentStep / featureMatchingProgress.totalSteps) * 100)
    : 0;
  
  const incrementalPercentage = featureExtractionProgress.total
    ? Math.round((incrementalProgress.count / featureExtractionProgress.total) * 100)
    : 0;
  
  const undistortionPercentage = undistortionProgress.total
    ? Math.round((undistortionProgress.current / undistortionProgress.total) * 100)
    : 0;
  
  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-r from-gray-900 to-gray-800">
      <div className="flex-grow flex items-center justify-center">
      <div className="bg-gray-800 border border-gray-700 backdrop-blur-lg shadow-xl rounded-lg p-10 max-w-md w-full">
        <h1 className="text-4xl font-extrabold text-gray-100 mb-6 text-center">
          {phase === "extraction"
            ? `Convert Project "${projectName}"`
            : phase === "matching"
            ? "Generating exhaustive image pairs..."
            : "Image Undistortion"}
        </h1>
        <button
          onClick={handleConvert}
          disabled={isConverting}
          className="w-full py-3 px-4 bg-gray-700 text-gray-100 font-semibold rounded-lg shadow-md hover:bg-gray-600 transition-all duration-300 transform hover:-translate-y-1"
        >
          {isConverting ? "Converting..." : "Start Conversion"}
        </button>
        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
        
        {/* Extraction Progress */}
        {showExtraction && (
          <>
            <div className="bg-gray-700 border border-gray-600 p-4 rounded-lg shadow-md mt-6">
              <div className="mb-2 text-sm font-medium text-gray-100">
                Feature Extraction Progress
              </div>
              <div className="w-full bg-gray-600 rounded-full h-4">
                <div
                  className="bg-green-500 h-4 rounded-full transition-all duration-300"
                  style={{ width: `${extractionPercentage}%` }}
                ></div>
              </div>
              <div className="text-sm font-medium text-gray-100 mt-1 text-center">
                {featureExtractionProgress.current} of {featureExtractionProgress.total} ({extractionPercentage}%)
              </div>
            </div>
            {matchingPercentage === 0 && (
              <div className="bg-gray-700 border border-gray-600 p-4 rounded-lg shadow-md mt-4">
                <p className="mb-1 text-gray-100"><strong>Name:</strong> {featureExtractionProgress.name || "N/A"}</p>
                <p className="mb-1 text-gray-100"><strong>Dimensions:</strong> {featureExtractionProgress.dimensions || "N/A"}</p>
                <p className="mb-1 text-gray-100"><strong>Camera:</strong> {featureExtractionProgress.camera || "N/A"}</p>
                <p className="mb-1 text-gray-100"><strong>Focal Length:</strong> {featureExtractionProgress.focalLength || "N/A"}</p>
                <p className="mb-1 text-gray-100"><strong>Features:</strong> {featureExtractionProgress.features || "N/A"}</p>
              </div>
            )}
          </>
        )}
        
        {/* Matching Progress */}
        {showMatching && (
          <>
            <div className="bg-gray-700 border border-gray-600 p-4 rounded-lg shadow-md mt-6">
              <div className="mb-2 text-sm font-medium text-gray-100">
                Matching Block Progress
              </div>
              <div className="w-full bg-gray-600 rounded-full h-4">
                <div
                  className="bg-blue-500 h-4 rounded-full transition-all duration-300"
                  style={{ width: `${matchingPercentage}%` }}
                ></div>
              </div>
              <div className="text-sm font-medium text-gray-100 mt-1 text-center">
                {featureMatchingProgress.currentStep} of {featureMatchingProgress.totalSteps} ({matchingPercentage}%)
              </div>
            </div>
            {featureMatchingProgress.matchedIn && incrementalPercentage === 0 && (
              <div className="bg-gray-700 border border-gray-600 p-4 rounded-lg shadow-md mt-4">
                <p className="mb-1 text-gray-100"><strong>Matched in:</strong> {featureMatchingProgress.matchedIn}</p>
              </div>
            )}
            {incrementalProgress.count > 0 && (
              <>
                <div className="bg-gray-700 border border-gray-600 p-4 rounded-lg shadow-md mt-4">
                  <div className="mb-2 text-sm font-medium text-gray-100">
                    Incremental Pipeline Progress
                  </div>
                  <div className="w-full bg-gray-600 rounded-full h-4">
                    <div
                      className="bg-yellow-500 h-4 rounded-full transition-all duration-300"
                      style={{ width: `${incrementalPercentage}%` }}
                    ></div>
                  </div>
                  <div className="text-sm font-medium text-gray-100 mt-1 text-center">
                    {incrementalProgress.count} of {featureExtractionProgress.total} ({incrementalPercentage}%)
                  </div>
                </div>
                {undistortionPercentage === 0 && (
                  <div className="bg-gray-700 border border-gray-600 p-4 rounded-lg shadow-md mt-4">
                    <p className="mb-1 text-gray-100">
                      <strong>Registering image:</strong> {incrementalProgress.imageId ? `#${incrementalProgress.imageId}` : "N/A"}
                    </p>
                    <p className="mb-1 text-gray-100">
                      <strong>Image sees:</strong> {incrementalProgress.points ? `${incrementalProgress.points} points` : "N/A"}
                    </p>
                  </div>
                )}
              </>
            )}
          </>
        )}
        
        {/* Undistortion Progress */}
        {showUndistortion && (
          <div className="bg-gray-700 border border-gray-600 p-4 rounded-lg shadow-md mt-6">
            <div className="mb-2 text-sm font-medium text-gray-100">
              Image Undistortion Progress
            </div>
            <div className="w-full bg-gray-600 rounded-full h-4">
              <div
                className="bg-red-500 h-4 rounded-full transition-all duration-300"
                style={{ width: `${undistortionPercentage}%` }}
              ></div>
            </div>
            <div className="text-sm font-medium text-gray-100 mt-1 text-center">
              {undistortionProgress.current} of {undistortionProgress.total} ({undistortionPercentage}%)
            </div>
          </div>
        )}
      </div>
      </div>
      <BottomBar />
    </main>
  );
}
