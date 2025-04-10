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
    total: 0
  });
  
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
    
    // Reset progress values.
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
          const match = line.match(/Undistorting image\s+\[(\d+)\/(\d+)\]/i);
          if (match) {
            setUndistortionProgress({
              current: parseInt(match[1], 10),
              total: parseInt(match[2], 10)
            });
          }
        }
        // --- Matching block logs ---
        else if (/Matching block/i.test(line)) {
          const match = line.match(/Matching block \[(\d+)\/(\d+),\s*(\d+)\/(\d+)\]/i);
          if (match) {
            const firstNum = parseInt(match[1], 10);
            const firstDenom = parseInt(match[2], 10);
            const secondNum = parseInt(match[3], 10);
            const secondDenom = parseInt(match[4], 10);
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
        // --- Incremental Pipeline logs (during matching) ---
        else if (/Registering image/i.test(line)) {
          const match = line.match(/Registering image\s+#(\d+)\s+\((\d+)\)/i);
          if (match) {
            const imageId = parseInt(match[1], 10);
            const count = parseInt(match[2], 10);
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
          if (/Processed file/i.test(line)) {
            const match = line.match(/Processed file \[(\d+)\/(\d+)\]/i);
            if (match) {
              setFeatureExtractionProgress(prev => ({
                ...prev,
                current: parseInt(match[1], 10),
                total: parseInt(match[2], 10)
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
    <main className="min-h-screen bg-black text-white font-mono">
      <header className="flex items-center px-4 py-3 border-b border-white bg-black">
        <img src="/logo-small.png" alt="Logo" className="h-10 w-auto mr-4" />
        <h1 className="text-xl font-bold">{projectName}</h1>
      </header>
      <div className="flex flex-col items-center justify-center px-4 py-24">
        <div className="w-full max-w-6xl">
          <div className="mb-12 text-center">
            <h2 className="text-5xl font-bold uppercase tracking-wide my-6">
              converting
            </h2>
          </div>

          <div className="w-full border border-white bg-black p-4 rounded mt-6">
            <div className="mt-2">
              <p className="mb-2 text-sm font-medium">Feature Extraction Progress</p>
              <div className="w-full border border-white bg-black h-6">
                <div
                  className="h-full"
                  style={{ width: `${extractionPercentage}%`, backgroundColor: "white" }}
                ></div>
              </div>
              <p className="text-sm font-medium mt-1 text-center">
                {featureExtractionProgress.current} of {featureExtractionProgress.total} ({extractionPercentage}%)
              </p>
            </div>

            <div className="mt-4">
              <p className="mb-2 text-sm font-medium">Matching Block Progress</p>
              <div className="w-full border border-white bg-black h-6">
                <div
                  className="h-full"
                  style={{ width: `${matchingPercentage}%`, backgroundColor: "white" }}
                ></div>
              </div>
              <p className="text-sm font-medium mt-1 text-center">
                {featureMatchingProgress.currentStep} of {featureMatchingProgress.totalSteps} ({matchingPercentage}%)
              </p>
            </div>

            <div className="mt-4">
              <p className="text-sm font-medium">Incremental Pipeline Progress</p>
              <div className="w-full border border-white bg-black h-6">
                <div
                  className="h-full"
                  style={{ width: `${incrementalPercentage}%`, backgroundColor: "white" }}
                ></div>
              </div>
              <p className="text-sm font-medium mt-1 text-center">
                {incrementalProgress.count} of {featureExtractionProgress.total} ({incrementalPercentage}%)
              </p>
            </div>

            <div className="mt-4">
              <p className="mb-2 text-sm font-medium">Image Undistortion Progress</p>
              <div className="w-full border border-white bg-black h-6">
                <div
                  className="h-full"
                  style={{ width: `${undistortionPercentage}%`, backgroundColor: "white" }}
                ></div>
              </div>
              <p className="text-sm font-medium mt-1 text-center">
                {undistortionProgress.current} of {undistortionProgress.total} ({undistortionPercentage}%)
              </p>
            </div>
          </div>

          <div className="flex flex-col items-center justify-center mt-12">
            {!isConverting ? (
              <button
                onClick={handleConvert}
                disabled={isConverting}
                className="w-full md:w-1/2 py-3 px-4 border border-white rounded cursor-pointer hover:bg-white hover:text-black hover:-translate-y-1 transition"
              >
                Start Conversion
              </button>
            ) : (
              <div className="w-full md:w-1/2 border border-white bg-black rounded p-4 text-center">
                {matchingPercentage === 0 && featureExtractionProgress.current !== 0 ? (
                  <div className="grid grid-cols-2 gap-y-2 gap-x-4">
                    <p className="text-sm">
                      <strong>Name:</strong> {featureExtractionProgress.name || "N/A"}
                    </p>
                    <p className="text-sm">
                      <strong>Dimensions:</strong> {featureExtractionProgress.dimensions || "N/A"}
                    </p>
                    <p className="text-sm">
                      <strong>Features:</strong> {featureExtractionProgress.features || "N/A"}
                    </p>
                    <p className="text-sm">
                      <strong>Focal Length:</strong> {featureExtractionProgress.focalLength || "N/A"}
                    </p>
                  </div>
                ) : featureMatchingProgress.matchedIn && incrementalPercentage === 0 ? (
                  <div>
                    <p className="text-sm">
                      <strong>Matched in:</strong> {featureMatchingProgress.matchedIn}
                    </p>
                  </div>
                ) : undistortionPercentage === 0 && incrementalProgress.points ? (
                  <div className="space-y-2">
                    <p className="text-sm">
                      <strong>Registering image:</strong> {incrementalProgress.imageId ? `#${incrementalProgress.imageId}` : "N/A"}
                    </p>
                    <p className="text-sm">
                      <strong>Image sees:</strong> {incrementalProgress.points ? `${incrementalProgress.points} points` : "N/A"}
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm">
                      <strong>Processing...</strong>
                    </p>
                  </div>
                )}
              </div>
            )}
            {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
          </div>
        </div>
      </div>
      <BottomBar />
    </main>
  );
}
