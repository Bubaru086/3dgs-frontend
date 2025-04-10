"use client";
import { useState, useEffect } from "react";
import axios from "axios";
import { useSearchParams, useRouter } from "next/navigation";
import BottomBar from "../components/BottomBar";

export default function Upload() {
  const searchParams = useSearchParams();
  const projectName = searchParams.get("project") || "";
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [videoURL, setVideoURL] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<any>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const fpsValues = [0.1, 0.25, 0.5, 1, 2, 4, 10];
  const [fpsIndex, setFpsIndex] = useState<number>(3);
  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const [extractionSuccess, setExtractionSuccess] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false); // New state for uploading
  const router = useRouter();

  useEffect(() => {
    if (!projectName) {
      window.location.href = "/";
    }
  }, [projectName]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      setSelectedFile(file);
      setVideoURL(URL.createObjectURL(file));
      setMetadata(null);
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (event.dataTransfer.files.length > 0) {
      const file = event.dataTransfer.files[0];
      setSelectedFile(file);
      setVideoURL(URL.createObjectURL(file));
      setMetadata(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    const formData = new FormData();
    formData.append("file", selectedFile);
    setProgress(0);
    setIsUploading(true); // Start upload

    try {
      const response = await axios.post(
        `http://localhost:8000/upload/?project_name=${projectName}`,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
          onUploadProgress: (progressEvent) => {
            if (progressEvent.total) {
              setProgress(
                Math.round((progressEvent.loaded * 100) / progressEvent.total)
              );
            }
          },
        }
      );
      setMetadata(response.data);
      setProgress(null);
    } catch (error) {
      console.error("Error uploading file:", error);
      setProgress(null);
    } finally {
      setIsUploading(false); // End upload regardless of outcome
    }
  };

  const handleExtractFrames = () => {
    if (!metadata || !projectName) {
      console.error("Invalid project name or metadata is missing.");
      return;
    }

    setIsExtracting(true);
    setProgress(0);

    const url = `http://localhost:8000/extract-frames/?project_name=${projectName}&fps=${fpsValues[fpsIndex]}&video_path=${metadata.file_path}`;
    const eventSource = new EventSource(url);

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.progress !== undefined) {
        setProgress(data.progress);
      }
      if (data.message) {
        eventSource.close();
        setExtractionSuccess(true);
        setIsExtracting(false);
        setProgress(null);
        router.push(`/converting/?project=${projectName}`);
      }
    };

    eventSource.onerror = (error) => {
      console.error("Error extracting frames:", error);
      eventSource.close();
      setIsExtracting(false);
      setProgress(null);
    };
  };

  return (
    <div className="min-h-screen bg-black text-white font-mono">
      <header className="flex items-center px-4 py-3 border-b border-white bg-black">
        <img
          src="/logo-small.png"
          alt="Logo"
          className="h-10 w-auto mr-4"
        />
        <h1 className="text-xl font-bold">{projectName}</h1>
      </header>

      <main className="flex flex-col items-center justify-center px-4 py-34">
        <div className="w-full max-w-6xl">
          <div className="mb-12 text-center">
            <h2 className="text-5xl font-bold uppercase tracking-wide my-6">
              preprocessing
            </h2>
          </div>

          {/* 3-column layout */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            {/* Upload Section */}
            <div className="border border-white rounded-lg p-6">
              <h3 className="text-xl font-semibold mb-4 text-center">
                Select Video
              </h3>

              <div
                className="w-full h-36 border-2 border-dashed border-white rounded mb-4 flex items-center justify-center text-sm cursor-pointer"
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
              >
                {selectedFile
                  ? selectedFile.name
                  : "Drag & Drop a video file here"}
              </div>

              <div className="mb-4">
                <label
                  htmlFor="videoUpload"
                  className="block w-full border border-white py-2 rounded text-center cursor-pointer hover:bg-white hover:text-black hover:-translate-y-1 transition"
                >
                  Select Video File
                </label>
                <input
                  id="videoUpload"
                  type="file"
                  accept="video/*"
                  onChange={handleFileChange}
                  style={{ display: "none" }}
                />
              </div>
            </div>

            {/* Video Preview */}
            <div className="border border-white rounded-lg p-6 flex flex-col items-center">
              <h3 className="text-xl font-semibold mb-4">
                Preview & Upload
              </h3>
              {videoURL ? (
                <video
                  className="w-full border border-white rounded mb-4"
                  controls
                  src={videoURL}
                />
              ) : (
                <p className="text-sm mt-2 text-center">No video selected.</p>
              )}
              {videoURL && (
                <button
                  onClick={handleUpload}
                  disabled={isUploading || isExtracting || !selectedFile}
                  className="w-full border border-white py-2 rounded cursor-pointer hover:bg-white hover:text-black hover:-translate-y-1 transition"
                >
                  {isUploading ? "Uploading..." : "Upload"}
                </button>
              )}
            </div>

            {/* Frame Extraction */}
            <div className="border border-white rounded-lg p-6 flex flex-col items-center">
              <h3 className="text-xl font-semibold mb-4 text-center">
                Frame Extraction
              </h3>

              {!metadata ? (
                <p className="text-sm mt-2 mb-4 text-center">
                  No video uploaded.
                </p>
              ) : (
                <>
                  <div className="text-sm mb-6">
                    <p><strong>File Path:</strong> {metadata.file_path}</p>
                    <p><strong>Resolution:</strong> {metadata.resolution}</p>
                    <p><strong>Frame Rate:</strong> {metadata.frame_rate} FPS</p>
                    <p><strong>Duration:</strong> {metadata.duration} seconds</p>
                  </div>

                  <label className="block mb-1 font-semibold">
                    Frames per Second (FPS)
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={fpsValues.length - 1}
                    step={1}
                    value={fpsIndex}
                    onChange={(e) => setFpsIndex(Number(e.target.value))}
                    disabled={isExtracting}
                    className="w-full mb-2 fps-slider"  // added custom class "fps-slider"
                  />
                  <p className="text-center mb-4">
                    {fpsValues[fpsIndex]} FPS
                  </p>

                  <style jsx>{`
                    /* Style the slider track */
                    input[type='range'].fps-slider {
                      -webkit-appearance: none; /* remove default styling on webkit browsers */
                      width: 100%;
                      height: 8px;              /* adjust height as needed */
                      background: white;        /* white background for the track */
                      outline: none;
                      border-radius: 0;         /* square corners */
                      margin: 10px 0;
                    }
                                    
                    /* Custom thumb styling for Webkit browsers */
                    input[type='range'].fps-slider::-webkit-slider-thumb {
                      -webkit-appearance: none;
                      width: 16px;              /* size of the thumb */
                      height: 16px;
                      background: white;        /* white thumb background */
                      border: 2px solid black;  /* border for contrast */
                      border-radius: 0;         /* square shape */
                      cursor: pointer;
                      margin-top: -4px;         /* adjust to center the thumb on the track */
                    }
                  `}</style>

                  <button
                    onClick={handleExtractFrames}
                    disabled={!metadata || isExtracting}
                    className="w-full border border-white py-2 rounded cursor-pointer hover:bg-white hover:text-black hover:-translate-y-1 transition"
                  >
                    {isExtracting ? "Extracting..." : "Extract Frames"}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Unified Progress Bar */}
          <div className="flex flex-col items-center justify-center mt-12">
            <div className="w-full md:w-3/4 border border-white bg-black h-6 relative">
              <div
                className="h-full"
                style={{
                  width: `${progress || 0}%`,
                  backgroundColor: "white",
                }}
              />
            </div>
          </div>
        </div>
      </main>

      <BottomBar />
    </div>
  );
}
