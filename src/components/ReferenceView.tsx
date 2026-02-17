import ProgressiveImage from "./ProgressiveImage";

export type ReferenceViewProps = {
  referenceUrl: string;
  referencePreviewUrl: string | null;
  onBack: () => void;
  onScanSketch: () => void;
  onUploadFromGallery: () => void;
};

export default function ReferenceView({
  referenceUrl,
  referencePreviewUrl,
  onBack,
  onScanSketch,
  onUploadFromGallery
}: ReferenceViewProps) {
  return (
    <div className="screen reference-view">
      <header className="reference-screen-header">
        <button
          type="button"
          className="reference-screen-back"
          onClick={onBack}
          aria-label="Back"
        >
          ←
        </button>
        <h1 className="reference-screen-title">Reference</h1>
        <button
          type="button"
          className="reference-screen-upload"
          onClick={onUploadFromGallery}
          aria-label="Upload from Gallery"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        </button>
      </header>

      <section className="reference-image-area">
        <ProgressiveImage
          src={referenceUrl}
          previewUrl={referencePreviewUrl}
          alt="Reference"
          decoding="async"
        />
      </section>

      <section className="reference-actions">
        <button
          type="button"
          className="reference-actions-primary"
          onClick={onScanSketch}
        >
          Scan my sketch
        </button>
        <button
          type="button"
          className="reference-actions-secondary"
          onClick={onUploadFromGallery}
        >
          Upload from Gallery
        </button>
      </section>
    </div>
  );
}
