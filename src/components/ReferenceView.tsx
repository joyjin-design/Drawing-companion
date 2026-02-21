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
        <div style={{ width: 44, height: 44 }} aria-hidden />
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
          onClick={() => {
            // #region agent log
            fetch('http://127.0.0.1:7543/ingest/061dfdc9-29cb-4d00-8ed1-24635fe0b4c4',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'41d973'},body:JSON.stringify({sessionId:'41d973',location:'ReferenceView.tsx:click',message:'Scan my sketch clicked',data:{},timestamp:Date.now(),hypothesisId:'H_scan_click'})}).catch(()=>{});
            // #endregion
            onScanSketch();
          }}
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
