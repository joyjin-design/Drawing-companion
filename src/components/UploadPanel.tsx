import { useEffect, useRef, useState } from "react";
import ProgressiveImage from "./ProgressiveImage";
import CaptureReferenceOverlay from "./CaptureReferenceOverlay";

export type UploadPanelProps = {
  referenceUrl?: string | null;
  referencePreviewUrl?: string | null;
  drawingUrl?: string | null;
  drawingPreviewUrl?: string | null;
  onReferenceSelected: (file: File, source?: "outline" | "shading") => void;
  onDrawingSelected: (file: File) => void;
  onOpenSessions: () => void;
  triggerCameraOnMount?: boolean;
  triggerGalleryOnMount?: boolean;
  onTriggerCameraDone?: () => void;
  onTriggerGalleryDone?: () => void;
};

export default function UploadPanel({
  referenceUrl,
  referencePreviewUrl,
  drawingUrl,
  drawingPreviewUrl,
  onReferenceSelected,
  onDrawingSelected,
  onOpenSessions,
  triggerCameraOnMount = false,
  triggerGalleryOnMount = false,
  onTriggerCameraDone,
  onTriggerGalleryDone
}: UploadPanelProps) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const drawingInputRef = useRef<HTMLInputElement>(null);

  const [cameraActive, setCameraActive] = useState(false);

  const startCamera = () => setCameraActive(true);
  const stopCamera = () => setCameraActive(false);

  useEffect(() => {
    if (!triggerCameraOnMount) return;
    setCameraActive(true);
    onTriggerCameraDone?.();
  }, [triggerCameraOnMount, onTriggerCameraDone]);

  useEffect(() => {
    if (!triggerGalleryOnMount) return;
    galleryInputRef.current?.click();
    onTriggerGalleryDone?.();
  }, [triggerGalleryOnMount, onTriggerGalleryDone]);

  return (
    <div className="screen home-screen">
      <CaptureReferenceOverlay
        open={cameraActive}
        onClose={stopCamera}
        onReferenceSelected={onReferenceSelected}
      />
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
          {false && (
          <button
            className="secondary-button"
            type="button"
            onClick={() => galleryInputRef.current?.click()}
          >
            Upload from Gallery
          </button>
          )}
        </section>
      </section>
    </div>
  );
}
