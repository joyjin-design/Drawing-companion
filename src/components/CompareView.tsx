import { useMemo, useRef, useState } from "react";
import type React from "react";
import ProgressiveImage from "./ProgressiveImage";
import type { CompareMode, Guides, OverlaySettings } from "../types";

export type CompareViewProps = {
  referenceUrl?: string | null;
  referencePreviewUrl?: string | null;
  drawingUrl?: string | null;
  drawingPreviewUrl?: string | null;
  compareMode: CompareMode;
  overlaySettings: OverlaySettings;
  guides: Guides;
  onChangeMode: (mode: CompareMode) => void;
  onChangeOverlay: (next: OverlaySettings) => void;
  onChangeGuides: (next: Guides) => void;
  onResetAlignment: () => void;
  onBack: () => void;
  onOpenSessions: () => void;
  onAddReference: () => void;
  onAddDrawing: () => void;
  onEvaluate?: () => void;
};

export default function CompareView({
  referenceUrl,
  referencePreviewUrl,
  drawingUrl,
  drawingPreviewUrl,
  compareMode,
  overlaySettings,
  guides,
  onChangeMode,
  onChangeOverlay,
  onChangeGuides,
  onResetAlignment,
  onBack,
  onOpenSessions,
  onAddReference,
  onAddDrawing,
  onEvaluate
}: CompareViewProps) {
  const [sliderValue, setSliderValue] = useState(50);
  const sliderTrackRef = useRef<HTMLDivElement>(null);

  const updateSliderFromClientX = (clientX: number) => {
    const el = sliderTrackRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = clientX - rect.left;
    const pct = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderValue(pct);
  };

  const handleSliderPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (compareMode !== "slider") return;
    event.currentTarget.setPointerCapture(event.pointerId);
    updateSliderFromClientX(event.clientX);
  };

  const handleSliderPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (compareMode !== "slider") return;
    if (event.buttons !== 1) return;
    updateSliderFromClientX(event.clientX);
  };

  const handleSliderKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (compareMode !== "slider") return;
    const step = event.shiftKey ? 10 : 2;
    if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
      event.preventDefault();
      setSliderValue((v) => Math.max(0, v - step));
    } else if (event.key === "ArrowRight" || event.key === "ArrowUp") {
      event.preventDefault();
      setSliderValue((v) => Math.min(100, v + step));
    } else if (event.key === "Home") {
      event.preventDefault();
      setSliderValue(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setSliderValue(100);
    }
  };

  const dragState = useRef<{
    startX: number;
    startY: number;
    baseX: number;
    baseY: number;
  } | null>(null);
  const pointerState = useRef<
    Map<number, { x: number; y: number }>
  >(new Map());
  const pinchState = useRef<{
    startCenter: { x: number; y: number };
    startDistance: number;
    startAngle: number;
    baseScale: number;
    baseRotation: number;
    baseX: number;
    baseY: number;
  } | null>(null);

  const drawingTransform = useMemo(() => {
    const { scale, rotation, translateX, translateY } = overlaySettings;
    return `translate(-50%, -50%) translate(${translateX}px, ${translateY}px) scale(${scale}) rotate(${rotation}deg)`;
  }, [overlaySettings]);

  const guideClass = `guide-layer${guides.grid ? " grid" : ""}${
    guides.centerline ? " centerline" : ""
  }`;

  const handlePointerDown = (event: React.PointerEvent<HTMLImageElement>) => {
    if (compareMode !== "overlay") return;
    const next = pointerState.current;
    next.set(event.pointerId, { x: event.clientX, y: event.clientY });
    (event.target as HTMLElement).setPointerCapture(event.pointerId);

    if (next.size === 1) {
      dragState.current = {
        startX: event.clientX,
        startY: event.clientY,
        baseX: overlaySettings.translateX,
        baseY: overlaySettings.translateY
      };
      pinchState.current = null;
    } else if (next.size === 2) {
      const points = Array.from(next.values());
      const center = {
        x: (points[0].x + points[1].x) / 2,
        y: (points[0].y + points[1].y) / 2
      };
      const dx = points[1].x - points[0].x;
      const dy = points[1].y - points[0].y;
      pinchState.current = {
        startCenter: center,
        startDistance: Math.hypot(dx, dy),
        startAngle: Math.atan2(dy, dx),
        baseScale: overlaySettings.scale,
        baseRotation: overlaySettings.rotation,
        baseX: overlaySettings.translateX,
        baseY: overlaySettings.translateY
      };
      dragState.current = null;
    }
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLImageElement>) => {
    const next = pointerState.current;
    if (!next.has(event.pointerId)) return;
    next.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (next.size === 1 && dragState.current) {
      const deltaX = event.clientX - dragState.current.startX;
      const deltaY = event.clientY - dragState.current.startY;
      onChangeOverlay({
        ...overlaySettings,
        translateX: dragState.current.baseX + deltaX,
        translateY: dragState.current.baseY + deltaY
      });
    }

    if (next.size === 2 && pinchState.current) {
      const points = Array.from(next.values());
      const center = {
        x: (points[0].x + points[1].x) / 2,
        y: (points[0].y + points[1].y) / 2
      };
      const dx = points[1].x - points[0].x;
      const dy = points[1].y - points[0].y;
      const distance = Math.hypot(dx, dy);
      const angle = Math.atan2(dy, dx);
      const scaleDelta = distance / pinchState.current.startDistance;
      const rotationDelta =
        ((angle - pinchState.current.startAngle) * 180) / Math.PI;
      const translateDelta = {
        x: center.x - pinchState.current.startCenter.x,
        y: center.y - pinchState.current.startCenter.y
      };
      onChangeOverlay({
        ...overlaySettings,
        scale: Math.max(0.5, Math.min(2.5, pinchState.current.baseScale * scaleDelta)),
        rotation: pinchState.current.baseRotation + rotationDelta,
        translateX: pinchState.current.baseX + translateDelta.x,
        translateY: pinchState.current.baseY + translateDelta.y
      });
    }
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLImageElement>) => {
    const next = pointerState.current;
    next.delete(event.pointerId);
    try {
      (event.target as HTMLElement).releasePointerCapture(event.pointerId);
    } catch {
      // ignore
    }
    if (next.size < 2) {
      pinchState.current = null;
    }
    if (next.size === 0) {
      dragState.current = null;
    }
  };

  return (
    <div className="screen compare-screen">
      <header className="top-bar">
        <button className="icon-button" type="button" onClick={onBack}>
          ←
        </button>
        <button className="icon-button" type="button" onClick={onOpenSessions}>
          ⋯
        </button>
      </header>

      <section className="compare-stage">
        <div className="segmented">
          <button
            type="button"
            className={compareMode === "overlay" ? "active" : ""}
            onClick={() => onChangeMode("overlay")}
          >
            Overlay
          </button>
          <button
            type="button"
            className={compareMode === "slider" ? "active" : ""}
            onClick={() => onChangeMode("slider")}
          >
            Slider
          </button>
        </div>
        {!referenceUrl && !drawingUrl ? (
          <div className="empty-state">
            <p>Add a reference and drawing photo to start comparing.</p>
            <div className="empty-actions">
              <button className="secondary-button" onClick={onAddReference}>
                Add reference
              </button>
              <button className="secondary-button" onClick={onAddDrawing}>
                Add drawing
              </button>
            </div>
          </div>
        ) : (
          <div className="canvas-frame">
            <div className={guideClass} />
            {compareMode === "overlay" ? (
              <div className="overlay-stack">
                {referenceUrl && (
                  <ProgressiveImage
                    src={referenceUrl}
                    previewUrl={referencePreviewUrl}
                    alt="Reference"
                    className="base-image"
                    decoding="async"
                    fetchPriority="high"
                  />
                )}
                {drawingUrl && (
                  <ProgressiveImage
                    src={drawingUrl}
                    previewUrl={drawingPreviewUrl}
                    alt="Drawing"
                    className="drawing-image"
                    decoding="async"
                    fetchPriority="high"
                    style={{
                      opacity: overlaySettings.opacity,
                      transform: drawingTransform
                    }}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerUp}
                  />
                )}
              </div>
            ) : (
              <div
                ref={sliderTrackRef}
                className="slider-stack"
                role="slider"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(sliderValue)}
                aria-label="Reveal reference or drawing"
                tabIndex={0}
                onPointerDown={handleSliderPointerDown}
                onPointerMove={handleSliderPointerMove}
                onKeyDown={handleSliderKeyDown}
              >
                {referenceUrl && (
                  <ProgressiveImage
                    src={referenceUrl}
                    previewUrl={referencePreviewUrl}
                    alt="Reference"
                    className="base-image"
                    decoding="async"
                    fetchPriority="high"
                  />
                )}
                {drawingUrl && (
                  <div
                    className="slider-mask"
                    style={{
                      clipPath: `inset(0 ${100 - sliderValue}% 0 0)`
                    }}
                  >
                    <ProgressiveImage
                      src={drawingUrl}
                      previewUrl={drawingPreviewUrl}
                      alt="Drawing"
                      className="base-image"
                      style={{ opacity: overlaySettings.opacity }}
                      decoding="async"
                      fetchPriority="high"
                    />
                  </div>
                )}
                <div
                  className="slider-handle"
                  style={{ left: `${sliderValue}%` }}
                />
              </div>
            )}
          </div>
        )}
      </section>

      <footer className="compare-footer">
        <button className="secondary-button" onClick={onAddReference}>
          Update reference
        </button>
        <button className="secondary-button" onClick={onAddDrawing}>
          Add drawing
        </button>
        <button
          type="button"
          className="primary-button"
          onClick={() => onEvaluate?.()}
        >
          Evaluate
        </button>
      </footer>
    </div>
  );
}
