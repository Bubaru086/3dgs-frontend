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
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [extractionProgress, setExtractionProgress] = useState<number>(0);
  const fpsValues = [0.1, 0.25, 0.5, 1, 2, 4, 10];
  const [fpsIndex, setFpsIndex] = useState<number>(3);
  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const [extractionSuccess, setExtractionSuccess] = useState<boolean>(false);
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

    try {
      const response = await axios.post(
        `http://localhost:8000/upload/?project_name=${projectName}`,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
          onUploadProgress: (progressEvent) => {
            if (progressEvent.total) {
              setUploadProgress(
                Math.round((progressEvent.loaded * 100) / progressEvent.total)
              );
            }
          },
        }
      );

      setMetadata(response.data);
      setUploadProgress(null);
    } catch (error) {
      console.error("Error uploading file:", error);
      setUploadProgress(null);
    }
  };

  const handleExtractFrames = () => {
    if (!metadata || !projectName) {
      console.error("Invalid project name or metadata is missing.");
      return;
    }

    setIsExtracting(true);
    const url = `http://localhost:8000/extract-frames/?project_name=${projectName}&fps=${fpsValues[fpsIndex]}&video_path=${metadata.file_path}`;
    const eventSource = new EventSource(url);

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.progress !== undefined) {
        setExtractionProgress(data.progress);
      }
      if (data.message) {
        // When extraction is complete, close the stream and show popup instead of redirecting automatically.
        eventSource.close();
        setExtractionSuccess(true);
        setIsExtracting(false);
      }
    };

    eventSource.onerror = (error) => {
      console.error("Error extracting frames:", error);
      eventSource.close();
      setIsExtracting(false);
    };
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-black">
      <div className="flex-grow flex items-center justify-center">
      <div className="bg-gray-800 border border-gray-700 backdrop-blur-lg shadow-xl rounded-lg p-10 max-w-md w-full text-center">
        <h1 className="text-4xl font-extrabold mb-4 text-gray-100">
          Upload a Video for "{projectName}"
        </h1>

        {!metadata ? (
          <>
            <div
              className="w-full h-40 border-2 border-dashed border-gray-600 bg-gray-700 flex items-center justify-center text-gray-100 cursor-pointer rounded-lg mb-4"
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
            >
              {selectedFile ? selectedFile.name : "Drag & Drop a video file here"}
            </div>

            <input
              type="file"
              accept="video/*"
              onChange={handleFileChange}
              className="w-full p-3 mb-4 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 transition"
            />

            {videoURL && (
              <video className="w-full border rounded-lg" controls src={videoURL} />
            )}

            {uploadProgress !== null && (
              <div className="w-full bg-gray-600 rounded-full h-4 mt-2">
                <div
                  className="bg-blue-500 h-4 rounded-full"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            )}

            <button
              onClick={handleUpload}
              className="w-full mt-4 py-3 px-4 bg-gray-700 text-gray-100 font-semibold rounded-lg shadow-md hover:bg-gray-600 transition-all duration-300 transform hover:-translate-y-1"
              disabled={!selectedFile}
            >
              Upload
            </button>
          </>
        ) : (
          <div className="mt-4 bg-gray-700 border border-gray-600 p-4 rounded-lg shadow-md text-gray-100">
            <h2 className="text-lg font-semibold mb-2">Video Metadata</h2>
            <div className="text-left">
              <p>
                <strong>File Path:</strong> {metadata.file_path}
              </p>
              <p>
                <strong>Resolution:</strong> {metadata.resolution}
              </p>
              <p>
                <strong>Frame Rate:</strong> {metadata.frame_rate} FPS
              </p>
              <p>
                <strong>Duration:</strong> {metadata.duration} seconds
              </p>
            </div>

            <div className="mt-4">
              <label className="block mb-2 font-medium text-gray-100">
                Frames per Second (FPS)
              </label>
              <input
                type="range"
                min={0}
                max={fpsValues.length - 1}
                step={1}
                value={fpsIndex}
                onChange={(e) => setFpsIndex(Number(e.target.value))}
                className="w-full"
                disabled={isExtracting}
              />
              <p className="text-center mt-1 text-gray-100">
                {fpsValues[fpsIndex]} FPS
              </p>
            </div>

            <button
              onClick={handleExtractFrames}
              disabled={isExtracting}
              className={`mt-4 w-full py-3 px-4 bg-gray-700 text-gray-100 font-semibold rounded-lg shadow-md transition-all duration-300 transform ${
                isExtracting ? "" : "hover:bg-gray-600 hover:-translate-y-1"
              }`}
            >
              {isExtracting ? "Extracting..." : "Extract Frames"}
            </button>

            {/* Progress bar for extraction */}
            {isExtracting && (
              <div className="w-full bg-gray-600 rounded-full h-4 mt-2">
                <div
                  className="bg-blue-500 h-4 rounded-full"
                  style={{ width: `${extractionProgress}%` }}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal Popup for Extraction Success */}
      {extractionSuccess && (
        <div className="fixed inset-0 flex items-center justify-center backdrop-blur-sm">
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-8 shadow-2xl text-center">
            <p className="text-white text-400 text-2xl font-bold mb-4">
              Frames extracted successfully!
            </p>
            <button
              onClick={() => router.push(`/converting/?project=${projectName}`)}
              className="py-2 px-6 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg transition duration-300"
            >
              Next Page
            </button>
          </div>
        </div>
      )}
      </div>
      <BottomBar />
    </main>
  );
}
