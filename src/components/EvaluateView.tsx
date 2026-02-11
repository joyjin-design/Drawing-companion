import { useEffect, useMemo, useState } from "react";
import { evaluateDrawing } from "../gemini";
import type { OverlaySettings } from "../types";
import ProgressiveImage from "./ProgressiveImage";

export type EvaluateViewProps = {
  referenceUrl: string | null;
  referencePreviewUrl?: string | null;
  drawingUrl: string | null;
  drawingPreviewUrl?: string | null;
  overlaySettings: OverlaySettings;
  /** When true (reference from Outline mode), hide feedback about shading/shadow. */
  referenceIsOutline?: boolean;
  onBack: () => void;
  onSaveToGallery?: () => void;
};

type EvaluateHighlight = { category: string; feedback: string };
type StructuredEvaluation = {
  title: string;
  subtitle: string;
  growthPercent: number;
  highlights: EvaluateHighlight[];
};

function urlToBase64Jpeg(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("No canvas context"));
        return;
      }
      ctx.drawImage(img, 0, 0);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
      const base64 = dataUrl.split(",")[1];
      if (base64) resolve(base64);
      else reject(new Error("Failed to encode image"));
    };
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = url;
  });
}

function parseStructuredEvaluation(text: string): StructuredEvaluation | null {
  try {
    const cleaned = text.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();
    const data = JSON.parse(cleaned) as unknown;
    if (!data || typeof data !== "object") return null;
    const o = data as Record<string, unknown>;
    const title = typeof o.title === "string" ? o.title : "Amazing Effort!";
    const subtitle = typeof o.subtitle === "string" ? o.subtitle : "You're growing as an artist";
    const growthPercent = typeof o.growthPercent === "number" ? Math.max(0, Math.min(100, o.growthPercent)) : 75;
    const rawHighlights = Array.isArray(o.highlights) ? o.highlights : [];
    const highlights: EvaluateHighlight[] = rawHighlights
      .filter((h): h is EvaluateHighlight => typeof h === "object" && h !== null && typeof (h as EvaluateHighlight).category === "string" && typeof (h as EvaluateHighlight).feedback === "string")
      .slice(0, 3);
    return { title, subtitle, growthPercent, highlights };
  } catch {
    return null;
  }
}

const DEFAULT_HIGHLIGHTS: EvaluateHighlight[] = [
  { category: "Proportions", feedback: "Keep comparing your drawing to the reference to refine proportions." },
  { category: "Line Quality", feedback: "Try varying line weight and pressure for more expression." },
  { category: "Detail Work", feedback: "Build up detail gradually and keep the big shapes in mind." }
];

const HIGHLIGHT_ICONS: Record<string, string> = {
  Proportions: "✨",
  "Line Quality": "✒️",
  "Detail Work": "🔍"
};
const HIGHLIGHT_GRADIENTS: Record<string, string> = {
  Proportions: "linear-gradient(135deg, #8b5cf6, #6366f1)",
  "Line Quality": "linear-gradient(135deg, #ec4899, #ef4444)",
  "Detail Work": "linear-gradient(135deg, #14b8a6, #22c55e)"
};

function isShadingOrShadowFeedback(h: EvaluateHighlight): boolean {
  const cat = h.category.toLowerCase();
  const fb = h.feedback.toLowerCase();
  return cat.includes("shad") || fb.includes("shad");
}

export default function EvaluateView({
  referenceUrl,
  referencePreviewUrl,
  drawingUrl,
  drawingPreviewUrl,
  overlaySettings,
  referenceIsOutline = false,
  onBack,
  onSaveToGallery
}: EvaluateViewProps) {
  const [structured, setStructured] = useState<StructuredEvaluation | null>(null);
  const [rawText, setRawText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const drawingTransform = useMemo(() => {
    const { scale, rotation, translateX, translateY } = overlaySettings;
    return `translate(${translateX}px, ${translateY}px) scale(${scale}) rotate(${rotation}deg)`;
  }, [overlaySettings]);

  useEffect(() => {
    if (!referenceUrl || !drawingUrl) {
      setError("Missing reference or drawing.");
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [refB64, drawingB64] = await Promise.all([
          urlToBase64Jpeg(referenceUrl),
          urlToBase64Jpeg(drawingUrl)
        ]);
        if (cancelled) return;
        const result = await evaluateDrawing(refB64, drawingB64);
        if (cancelled) return;
        if ("error" in result) {
          setError(result.error);
          return;
        }
        const parsed = parseStructuredEvaluation(result.text);
        if (parsed) setStructured(parsed);
        else {
          setRawText(result.text);
          setStructured({
            title: "Amazing Effort!",
            subtitle: "You're growing as an artist",
            growthPercent: 75,
            highlights: [{ category: "Feedback", feedback: result.text }]
          });
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to evaluate.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [referenceUrl, drawingUrl]);

  const display = structured ?? (rawText ? {
    title: "Amazing Effort!",
    subtitle: "You're growing as an artist",
    growthPercent: 75,
    highlights: [{ category: "Feedback", feedback: rawText }]
  } : null);
  const rawHighlights = display?.highlights.length
    ? display.highlights
    : DEFAULT_HIGHLIGHTS;
  const highlights =
    referenceIsOutline
      ? rawHighlights.filter((h) => !isShadingOrShadowFeedback(h))
      : rawHighlights;
  const showHighlightsSection = highlights.length > 0;
  const growthPercent = display?.growthPercent ?? 75;

  return (
    <div className="screen evaluate-screen">
      <header className="top-bar">
        <button type="button" className="icon-button" onClick={onBack} aria-label="Back">
          ←
        </button>
        <h2 className="evaluate-title">Evaluation</h2>
        <div className="icon-button" style={{ visibility: "hidden" }} aria-hidden>
          ⋯
        </div>
      </header>

      <section className="evaluate-content">
        <p className="evaluate-compare-caption">Comparing your reference to your drawing.</p>
        <div className="evaluate-preview">
          {referenceUrl && (
            <ProgressiveImage
              src={referenceUrl}
              previewUrl={referencePreviewUrl}
              alt="Reference"
              className="evaluate-preview-base"
              decoding="async"
              fetchPriority="high"
            />
          )}
          {drawingUrl && (
            <ProgressiveImage
              src={drawingUrl}
              previewUrl={drawingPreviewUrl}
              alt="Drawing"
              className="evaluate-preview-drawing"
              decoding="async"
              fetchPriority="high"
              style={{
                opacity: overlaySettings.opacity,
                transform: drawingTransform
              }}
            />
          )}
        </div>

        {loading && (
          <div className="evaluate-result evaluate-loading-skeleton">
            <div className="evaluate-skeleton achievement">
              <div className="evaluate-skeleton-icon" />
              <div className="evaluate-skeleton-line short" />
              <div className="evaluate-skeleton-line medium" />
            </div>
            <div className="evaluate-skeleton growth">
              <div className="evaluate-skeleton-line medium" />
              <div className="evaluate-skeleton-bar" />
            </div>
            <div className="evaluate-skeleton highlights">
              <div className="evaluate-skeleton-line short" />
              <div className="evaluate-skeleton-card" />
              <div className="evaluate-skeleton-card" />
              <div className="evaluate-skeleton-card" />
            </div>
            <p className="evaluate-loading-text" aria-live="polite">Evaluating your drawing…</p>
          </div>
        )}

        {error && !loading && (
          <div className="evaluate-result">
            <p className="evaluate-error" role="alert">{error}</p>
          </div>
        )}

        {display && !loading && !error && (
          <>
            <div className="evaluate-achievement">
              <div className="evaluate-achievement-icon" aria-hidden>
                🏅
              </div>
              <h3 className="evaluate-achievement-title">{display.title}</h3>
              <p className="evaluate-achievement-subtitle">
                {display.subtitle} 🌱
              </p>
            </div>

            <div className="evaluate-growth-card">
              <div className="evaluate-growth-header">
                <div className="evaluate-growth-heading">
                  <span className="evaluate-growth-icon" aria-hidden>📈</span>
                  <span>Growth Meter</span>
                </div>
                <div className="evaluate-growth-stars" aria-hidden>
                  <span className="star filled">★</span>
                  <span className="star filled">★</span>
                  <span className="star">★</span>
                </div>
              </div>
              <p className="evaluate-growth-desc">Your improvement trend is looking great!</p>
              <div className="evaluate-growth-bar-wrap">
                <div
                  className="evaluate-growth-bar-fill"
                  style={{ width: `${growthPercent}%` }}
                >
                  <span className="evaluate-growth-bar-label">{growthPercent}% Growth</span>
                </div>
              </div>
            </div>

            {showHighlightsSection && (
              <div className="evaluate-highlights">
                <h4 className="evaluate-highlights-title">Feedback Highlights</h4>
                <div className="evaluate-highlights-list">
                  {highlights.map((h, i) => (
                    <div key={i} className="evaluate-highlight-card">
                      <div
                        className="evaluate-highlight-icon"
                        style={{
                          background: HIGHLIGHT_GRADIENTS[h.category] ?? "var(--primary)"
                        }}
                        aria-hidden
                      >
                        {HIGHLIGHT_ICONS[h.category] ?? "•"}
                      </div>
                      <div className="evaluate-highlight-body">
                        <h5 className="evaluate-highlight-category">{h.category}</h5>
                        <p className="evaluate-highlight-feedback">{h.feedback}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="evaluate-actions">
              <button
                type="button"
                className="primary-button evaluate-btn-practice"
                onClick={onBack}
              >
                <span className="evaluate-btn-icon" aria-hidden>↻</span>
                Practice Again
              </button>
              {onSaveToGallery && (
                <button
                  type="button"
                  className="secondary-button evaluate-btn-save"
                  onClick={onSaveToGallery}
                >
                  <span className="evaluate-btn-icon" aria-hidden>🖼</span>
                  Save to Gallery
                </button>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
