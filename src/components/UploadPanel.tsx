import { useCallback, useEffect, useRef, useState } from "react";
import { getOutlineFromImage, getShadingFromImage } from "../gemini";
import { getOutlineDataUrl, getShadingDataUrl } from "../sketchClient";
import ProgressiveImage from "./ProgressiveImage";

export type UploadPanelProps = {
  referenceUrl?: string | null;
  referencePreviewUrl?: string | null;
  drawingUrl?: string | null;
  drawingPreviewUrl?: string | null;
  onReferenceSelected: (file: File, source?: "outline" | "shading") => void;
  onDrawingSelected: (file: File) => void;
  onOpenSessions: () => void;
};

export default function UploadPanel({
  referenceUrl,
  referencePreviewUrl,
  drawingUrl,
  drawingPreviewUrl,
  onReferenceSelected,
  onDrawingSelected,
  onOpenSessions
}: UploadPanelProps) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const drawingInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [captureMode, setCaptureMode] = useState<"form" | "shading" | "colors">("form");
  const [outlineDataUrl, setOutlineDataUrl] = useState<string | null>(null);
  const [outlineLoading, setOutlineLoading] = useState(false);
  const [outlineError, setOutlineError] = useState<string | null>(null);
  const [shadingDataUrl, setShadingDataUrl] = useState<string | null>(null);
  const [shadingLoading, setShadingLoading] = useState(false);
  const [shadingError, setShadingError] = useState<string | null>(null);
  const [generatingPreviewUrl, setGeneratingPreviewUrl] = useState<string | null>(null);
  const [captureWithGeminiLoading, setCaptureWithGeminiLoading] = useState(false);
  const [captureWithGeminiError, setCaptureWithGeminiError] = useState<string | null>(null);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraActive(false);
    setCameraError(null);
    setOutlineDataUrl(null);
    setOutlineError(null);
    setShadingDataUrl(null);
    setShadingError(null);
    setGeneratingPreviewUrl(null);
    setCaptureWithGeminiError(null);
    setCaptureWithGeminiLoading(false);
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false
      });
      streamRef.current = stream;
      setCameraActive(true);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not access camera";
      setCameraError(message);
      // Fallback: open file input so user can still pick an image
      cameraInputRef.current?.click();
    }
  }, []);

  useEffect(() => {
    if (!cameraActive || !streamRef.current) return;
    const video = videoRef.current;
    if (video) {
      video.srcObject = streamRef.current;
      video.play().catch(() => {});
    }
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [cameraActive]);

  const captureFrameAsBase64 = useCallback((): Promise<string> => {
    return new Promise((resolve, reject) => {
      const video = videoRef.current;
      if (!video || video.videoWidth === 0) {
        reject(new Error("Video not ready"));
        return;
      }
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("No canvas context"));
        return;
      }
      ctx.drawImage(video, 0, 0);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
      const base64 = dataUrl.split(",")[1];
      if (!base64) reject(new Error("Failed to encode frame"));
      else resolve(base64);
    });
  }, []);

  const captureFrameAsDataUrl = useCallback((): Promise<string> => {
    return new Promise((resolve, reject) => {
      const video = videoRef.current;
      if (!video || video.videoWidth === 0) {
        reject(new Error("Video not ready"));
        return;
      }
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("No canvas context"));
        return;
      }
      ctx.drawImage(video, 0, 0);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    });
  }, []);

  /** Smaller frame for faster API upload and processing (rough preview only). */
  const captureFrameAsBase64Small = useCallback((): Promise<string> => {
    return new Promise((resolve, reject) => {
      const video = videoRef.current;
      if (!video || video.videoWidth === 0) {
        reject(new Error("Video not ready"));
        return;
      }
      const maxSize = 480;
      let w = video.videoWidth;
      let h = video.videoHeight;
      if (w > maxSize || h > maxSize) {
        if (w >= h) {
          h = Math.round((h * maxSize) / w);
          w = maxSize;
        } else {
          w = Math.round((w * maxSize) / h);
          h = maxSize;
        }
      }
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("No canvas context"));
        return;
      }
      ctx.drawImage(video, 0, 0, w, h);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.4);
      const base64 = dataUrl.split(",")[1];
      if (!base64) reject(new Error("Failed to encode frame"));
      else resolve(base64);
    });
  }, []);

  const getOutline = useCallback(async () => {
    setOutlineError(null);
    setOutlineLoading(true);
    try {
      const dataUrl = await captureFrameAsDataUrl();
      setGeneratingPreviewUrl(dataUrl);
      const outlineUrl = await getOutlineDataUrl(dataUrl);
      setOutlineDataUrl(outlineUrl);
    } catch (e) {
      setOutlineError(e instanceof Error ? e.message : "Failed to create outline");
      setOutlineDataUrl(null);
    } finally {
      setOutlineLoading(false);
      setGeneratingPreviewUrl(null);
    }
  }, [captureFrameAsDataUrl]);

  const getShading = useCallback(async () => {
    setShadingError(null);
    setShadingLoading(true);
    try {
      const dataUrl = await captureFrameAsDataUrl();
      setGeneratingPreviewUrl(dataUrl);
      const shadingUrl = await getShadingDataUrl(dataUrl);
      setShadingDataUrl(shadingUrl);
    } catch (e) {
      setShadingError(e instanceof Error ? e.message : "Failed to create sketch");
      setShadingDataUrl(null);
    } finally {
      setShadingLoading(false);
      setGeneratingPreviewUrl(null);
    }
  }, [captureFrameAsDataUrl]);

  const capturePhoto = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !streamRef.current) return;
    if (captureWithGeminiLoading) return;

    const usePhotoFallback = () => {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(video, 0, 0);
      canvas.toBlob(
        (blob) => {
          if (!blob) return;
          const file = new File([blob], "camera.jpg", { type: "image/jpeg" });
          stopCamera();
          onReferenceSelected(file);
        },
        "image/jpeg",
        0.9
      );
    };

    if (captureMode === "colors") {
      usePhotoFallback();
      return;
    }

    const isForm = captureMode === "form";
    const isShading = captureMode === "shading";
    if (isForm || isShading) {
      setCaptureWithGeminiError(null);
      setCaptureWithGeminiLoading(true);
      try {
        const previewUrl = await captureFrameAsDataUrl();
        setGeneratingPreviewUrl(previewUrl);
        const base64 = await captureFrameAsBase64Small();
        if (isForm) {
          const result = await getOutlineFromImage(base64);
          if ("error" in result) {
            setCaptureWithGeminiError(result.error);
            setCaptureWithGeminiLoading(false);
            setGeneratingPreviewUrl(null);
            return;
          }
          const res = await fetch(result.dataUrl);
          const blob = await res.blob();
          const file = new File([blob], "reference-outline.png", { type: blob.type || "image/png" });
          stopCamera();
          setCaptureWithGeminiLoading(false);
          setGeneratingPreviewUrl(null);
          onReferenceSelected(file, "outline");
        } else {
          const result = await getShadingFromImage(base64);
          if ("error" in result) {
            setCaptureWithGeminiError(result.error);
            setCaptureWithGeminiLoading(false);
            setGeneratingPreviewUrl(null);
            return;
          }
          const res = await fetch(result.dataUrl);
          const blob = await res.blob();
          const file = new File([blob], "reference-shading.png", { type: blob.type || "image/png" });
          stopCamera();
          setCaptureWithGeminiLoading(false);
          setGeneratingPreviewUrl(null);
          onReferenceSelected(file, "shading");
        }
      } catch (e) {
        setCaptureWithGeminiError(e instanceof Error ? e.message : "Failed to process");
        setCaptureWithGeminiLoading(false);
        setGeneratingPreviewUrl(null);
      }
      return;
    }

    usePhotoFallback();
  }, [
    captureMode,
    captureWithGeminiLoading,
    captureFrameAsDataUrl,
    captureFrameAsBase64Small,
    onReferenceSelected,
    stopCamera
  ]);

  return (
    <div className="screen home-screen">
      {cameraActive && (
        <div className="capture-reference-overlay" role="dialog" aria-label="Capture Reference">
          <header className="capture-reference-header">
            <button
              type="button"
              className="capture-reference-back"
              onClick={stopCamera}
              aria-label="Back"
            >
              ←
            </button>
            <h2 className="capture-reference-title">Capture Reference</h2>
            <button
              type="button"
              className="capture-reference-flash"
              aria-label="Flash"
            >
              ✦
            </button>
          </header>

          <div className="capture-reference-viewfinder">
            <video
              ref={videoRef}
              className="capture-reference-preview"
              style={
                (captureMode === "form" && outlineDataUrl) ||
                (captureMode === "shading" && shadingDataUrl) ||
                outlineLoading ||
                shadingLoading ||
                captureWithGeminiLoading
                  ? { display: "none" }
                  : undefined
              }
              playsInline
              muted
              autoPlay
            />
            {(outlineLoading || shadingLoading || captureWithGeminiLoading) && generatingPreviewUrl && (
              <>
                <img
                  src={generatingPreviewUrl}
                  alt=""
                  className="capture-reference-preview capture-reference-generating-preview"
                  aria-hidden
                  decoding="async"
                />
                <div
                  className="capture-reference-loading-overlay"
                  aria-hidden
                  role="presentation"
                >
                  <div className="capture-reference-loading-content">
                    <span className="capture-reference-spinner" aria-hidden />
                    <span className="capture-reference-loading-text">
                      {captureWithGeminiLoading ? "Processing with AI…" : "Generating…"}
                    </span>
                  </div>
                </div>
              </>
            )}
            {captureMode === "form" && outlineDataUrl && (
              <img
                src={outlineDataUrl}
                alt="Outline reference"
                className="capture-reference-preview capture-reference-outline-preview"
                decoding="async"
              />
            )}
            {captureMode === "shading" && shadingDataUrl && (
              <img
                src={shadingDataUrl}
                alt="Outline and shading reference"
                className="capture-reference-preview capture-reference-outline-preview"
                decoding="async"
              />
            )}
            <div className="capture-reference-grid" aria-hidden />
            {(outlineError || (captureWithGeminiError && captureMode === "form")) && captureMode === "form" && (
              <p className="capture-reference-outline-error" role="alert">
                {captureWithGeminiError ?? outlineError}
              </p>
            )}
            {(shadingError || (captureWithGeminiError && captureMode === "shading")) && captureMode === "shading" && (
              <p className="capture-reference-outline-error" role="alert">
                {captureWithGeminiError ?? shadingError}
              </p>
            )}
            {!(outlineDataUrl || shadingDataUrl) && (
              <div className="capture-reference-guide">
                <div className="capture-reference-brackets">
                  <span className="bracket tl" />
                  <span className="bracket tr" />
                  <span className="bracket bl" />
                  <span className="bracket br" />
                </div>
                <div className="capture-reference-center">
                  <div className="center-dashed" />
                  <div className="center-solid" />
                </div>
                <p className="capture-reference-instruction">Position your subject in frame</p>
              </div>
            )}
          </div>

          <div className="capture-reference-tip">
            <span className="capture-reference-tip-icon" aria-hidden>💡</span>
            <span className="capture-reference-tip-text">
              Tip: Good lighting and a clear background help with drawing
            </span>
          </div>

          <div className="capture-reference-controls">
            <div className="capture-reference-modes">
              <button
                type="button"
                className={`capture-reference-mode-btn ${captureMode === "colors" ? "active" : ""}`}
                onClick={() => {
                  setCaptureMode("colors");
                  setOutlineDataUrl(null);
                  setShadingDataUrl(null);
                  setOutlineError(null);
                  setShadingError(null);
                  setCaptureWithGeminiError(null);
                }}
                aria-pressed={captureMode === "colors"}
              >
                <span className="mode-icon" aria-hidden />
                <span>Colors</span>
              </button>
              <button
                type="button"
                className={`capture-reference-mode-btn ${captureMode === "form" ? "active" : ""}`}
                onClick={() => {
                  setCaptureMode("form");
                  setShadingDataUrl(null);
                  setShadingError(null);
                  setOutlineError(null);
                  setCaptureWithGeminiError(null);
                  getOutline();
                }}
                aria-pressed={captureMode === "form"}
              >
                <span className="mode-icon mode-form" aria-hidden />
                <span>Outline</span>
              </button>
              <button
                type="button"
                className={`capture-reference-mode-btn ${captureMode === "shading" ? "active" : ""}`}
                onClick={() => {
                  setCaptureMode("shading");
                  setOutlineDataUrl(null);
                  setOutlineError(null);
                  setShadingError(null);
                  setCaptureWithGeminiError(null);
                  getShading();
                }}
                aria-pressed={captureMode === "shading"}
              >
                <span className="mode-icon mode-shading" aria-hidden />
                <span>Shading</span>
              </button>
            </div>
            <button
              type="button"
              className="capture-reference-capture-btn"
              onClick={capturePhoto}
              disabled={captureWithGeminiLoading}
              aria-label="Capture photo"
            />
          </div>
        </div>
      )}
      {cameraError && (
        <p className="camera-error" role="alert">
          {cameraError}. You can choose an image from your device instead.
        </p>
      )}
      <header className="top-bar">
        <button className="icon-button sparkle-badge" type="button" aria-label="Sparkle">
          ✦
        </button>
        <button
          className="icon-button"
          type="button"
          aria-label="Sessions"
          onClick={onOpenSessions}
        >
          ⋯
        </button>
      </header>

      <section className="hero">
        <div className="hero-orbit">
          <div className="hero-orbit-ring" />
          <div className="hero-camera">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
          </div>
        </div>

        <div className="floating-card top-card">
          {referenceUrl ? (
            <ProgressiveImage
              src={referenceUrl}
              previewUrl={referencePreviewUrl}
              alt="Reference preview"
              decoding="async"
            />
          ) : (
            <img src="/reference-placeholder.png" alt="Reference" decoding="async" />
          )}
        </div>
        <div className="floating-card bottom-card">
          {drawingUrl ? (
            <ProgressiveImage
              src={drawingUrl}
              previewUrl={drawingPreviewUrl}
              alt="Drawing preview"
              decoding="async"
            />
          ) : (
            <img src="/drawing-placeholder.png" alt="Drawing" decoding="async" />
          )}
        </div>
      </section>

      <section className="home-copy">
        <h1>Draw from real life</h1>
        <p>
          Capture real objects with your camera and practice drawing them at your
          own pace.
        </p>
        <section className="home-actions">
          <input
            ref={cameraInputRef}
            className="file-input"
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onReferenceSelected(file);
            }}
          />
          <input
            ref={galleryInputRef}
            className="file-input"
            type="file"
            accept="image/*"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onReferenceSelected(file);
            }}
          />
          <input
            ref={drawingInputRef}
            className="file-input"
            type="file"
            accept="image/*"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onDrawingSelected(file);
            }}
          />

          <button
            className="primary-button"
            type="button"
            onClick={startCamera}
          >
            Take a photo to draw
          </button>
          <button
            className="secondary-button"
            type="button"
            onClick={() => galleryInputRef.current?.click()}
          >
            Upload from Gallery
          </button>
        </section>
      </section>
    </div>
  );
}
