import { useRef } from "react";

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

  return (
    <div className="screen home-screen">
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
            <div className="placeholder">Reference</div>
          )}
        </div>
        <div className="floating-card bottom-card">
          {drawingUrl ? (
            <img src={drawingUrl} alt="Drawing preview" />
          ) : (
            <div className="placeholder">Drawing</div>
          )}
        </div>
      </section>

      <section className="home-copy">
        <h1>Draw from real life</h1>
        <p>
          Capture real objects with your camera and practice drawing them at your
          own pace.
        </p>
      </section>

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
          onClick={() => cameraInputRef.current?.click()}
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

        <div className="divider" />
        <button
          className="ghost-button"
          type="button"
          onClick={() => drawingInputRef.current?.click()}
        >
          Add drawing photo
        </button>
      </section>
    </div>
  );
}
