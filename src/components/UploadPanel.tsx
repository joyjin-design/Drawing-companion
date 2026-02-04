import { useCallback, useEffect, useRef, useState } from "react";

export type UploadPanelProps = {
  referenceUrl?: string | null;
  drawingUrl?: string | null;
  onReferenceSelected: (file: File) => void;
  onDrawingSelected: (file: File) => void;
  onOpenSessions: () => void;
};

export default function UploadPanel({
  referenceUrl,
  drawingUrl,
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
  const [captureMode, setCaptureMode] = useState<"form" | "shading">("form");

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraActive(false);
    setCameraError(null);
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

  const capturePhoto = useCallback(() => {
    const video = videoRef.current;
    if (!video || !streamRef.current) return;
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
  }, [onReferenceSelected, stopCamera]);

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
              playsInline
              muted
              autoPlay
            />
            <div className="capture-reference-grid" aria-hidden />
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
          </div>

          <div className="capture-reference-tip">
            <span className="capture-reference-tip-icon" aria-hidden>💡</span>
            <span className="capture-reference-tip-text">
              Tip: Good lighting and a clear background help with drawing
            </span>
          </div>

          <div className="capture-reference-controls">
            <div className="capture-reference-modes">
              <div className="capture-reference-mode-rail">
                <div
                  className="capture-reference-mode-indicator"
                  style={{ left: captureMode === "form" ? "calc(50% - 36px)" : "calc(50% + 36px)" }}
                />
              </div>
              <button
                type="button"
                className={`capture-reference-mode-btn ${captureMode === "form" ? "active" : ""}`}
                onClick={() => setCaptureMode("form")}
                aria-pressed={captureMode === "form"}
              >
                <span className="mode-icon mode-form" aria-hidden />
                <span>Form</span>
              </button>
              <button
                type="button"
                className={`capture-reference-mode-btn ${captureMode === "shading" ? "active" : ""}`}
                onClick={() => setCaptureMode("shading")}
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
        <button className="icon-button" type="button" aria-label="Sparkle">
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
            <span>📷</span>
          </div>
        </div>

        <div className="floating-card top-card">
          {referenceUrl ? (
            <img src={referenceUrl} alt="Reference preview" />
          ) : (
            <img src="/reference-placeholder.png" alt="Reference" />
          )}
        </div>
        <div className="floating-card bottom-card">
          {drawingUrl ? (
            <img src={drawingUrl} alt="Drawing preview" />
          ) : (
            <img src="/drawing-placeholder.png" alt="Drawing" />
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
