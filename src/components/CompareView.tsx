import { useMemo, useRef, useState } from "react";
import type React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowLeft } from "@fortawesome/free-solid-svg-icons";
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
  onAddReference: () => void;
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
  onAddReference,
  onEvaluate
}: CompareViewProps) {
  const [sliderValue, setSliderValue] = useState(50);
  const [splitOrientation, setSplitOrientation] = useState<"horizontal" | "vertical">("horizontal");
  const sliderTrackRef = useRef<HTMLDivElement>(null);
  const handleDragRef = useRef(false);
  const handleDidMoveRef = useRef(false);
  const lastTapRef = useRef(0);
  const compareScreenRef = useRef<HTMLDivElement>(null);

  const updateSliderFromClientX = (clientX: number) => {
    const el = sliderTrackRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = clientX - rect.left;
    const pct = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderValue(pct);
  };

  const updateSliderFromClientY = (clientY: number) => {
    const el = sliderTrackRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const y = clientY - rect.top;
    const pct = Math.max(0, Math.min(100, (y / rect.height) * 100));
    setSliderValue(pct);
  };

  const updateSliderFromPointer = (clientX: number, clientY: number) => {
    if (splitOrientation === "horizontal") updateSliderFromClientX(clientX);
    else updateSliderFromClientY(clientY);
  };

  const handleSliderPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (compareMode !== "slider") return;
    event.currentTarget.setPointerCapture(event.pointerId);
    updateSliderFromPointer(event.clientX, event.clientY);
  };

  const handleSliderPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (compareMode !== "slider") return;
    if (event.buttons !== 1) return;
    updateSliderFromPointer(event.clientX, event.clientY);
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

  const handleSliderHandlePointerDown = (event: React.PointerEvent) => {
    if (compareMode !== "slider") return;
    event.stopPropagation();
    handleDragRef.current = true;
    handleDidMoveRef.current = false;
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
    updateSliderFromPointer(event.clientX, event.clientY);
  };

  const handleSliderHandlePointerMove = (event: React.PointerEvent) => {
    if (!handleDragRef.current) return;
    handleDidMoveRef.current = true;
    updateSliderFromPointer(event.clientX, event.clientY);
  };

  const handleSliderHandlePointerUp = (event: React.PointerEvent) => {
    if (compareMode !== "slider") return;
    const now = Date.now();
    const delta = now - lastTapRef.current;
    const wasQuickTap = !handleDidMoveRef.current && delta > 0 && delta < 400;
    lastTapRef.current = now;
    handleDragRef.current = false;
    try {
      (event.target as HTMLElement).releasePointerCapture(event.pointerId);
    } catch {
      // ignore
    }
    if (wasQuickTap) {
      setSplitOrientation((o) => (o === "horizontal" ? "vertical" : "horizontal"));
    }
  };

  const handleSliderHandleDoubleClick = () => {
    setSplitOrientation((o) => (o === "horizontal" ? "vertical" : "horizontal"));
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
    return `translate(${translateX}px, ${translateY}px) scale(${scale}) rotate(${rotation}deg)`;
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
    <div ref={compareScreenRef} className="screen compare-screen">
      <header className="top-bar">
        <button className="icon-button" type="button" onClick={onBack} aria-label="Back">
          <FontAwesomeIcon icon={faArrowLeft} />
        </button>
      </header>

      <section className="compare-stage">
        {!referenceUrl && !drawingUrl ? (
          <div className="empty-state">
            <p>Add your reference and your drawing to compare.</p>
            <div className="empty-actions">
              <button className="secondary-button" onClick={onAddReference}>
                Add reference
              </button>
            </div>
          </div>
        ) : (
          <div className="canvas-frame">
            <div className={guideClass} />
            {compareMode === "overlay" ? (
              <div className="overlay-stack">
                <span className="compare-pane-tag reference-tag" aria-hidden>OVERLAY</span>
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
                className={`slider-stack ${splitOrientation === "vertical" ? "slider-stack-vertical" : ""}`}
                role="slider"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(sliderValue)}
                aria-label={
                  splitOrientation === "horizontal"
                    ? "Adjust split between reference and drawing"
                    : "Adjust split between reference (top) and drawing (bottom)"
                }
                tabIndex={0}
                onPointerDown={handleSliderPointerDown}
                onPointerMove={handleSliderPointerMove}
                onKeyDown={handleSliderKeyDown}
              >
                <div
                  className="slider-pane slider-pane-first"
                  style={
                    splitOrientation === "horizontal"
                      ? { width: `${sliderValue}%` }
                      : { top: 0, height: `${sliderValue}%` }
                  }
                >
                  <span className="compare-pane-tag reference-tag" aria-hidden>REFERENCE</span>
                  {referenceUrl && (
                    <ProgressiveImage
                      src={referenceUrl}
                      previewUrl={referencePreviewUrl}
                      alt="Reference"
                      className="slider-pane-image"
                      decoding="async"
                      fetchPriority="high"
                    />
                  )}
                </div>
                <div
                  className="slider-pane slider-pane-second"
                  style={
                    splitOrientation === "horizontal"
                      ? { left: `${sliderValue}%`, width: `${100 - sliderValue}%` }
                      : { top: `${sliderValue}%`, height: `${100 - sliderValue}%` }
                  }
                >
                  <span className="compare-pane-tag drawing-tag" aria-hidden>DRAWING</span>
                  {drawingUrl && (
                    <ProgressiveImage
                      src={drawingUrl}
                      previewUrl={drawingPreviewUrl}
                      alt="Drawing"
                      className="slider-pane-image"
                      decoding="async"
                      fetchPriority="high"
                    />
                  )}
                </div>
                <div
                  className="slider-handle"
                  style={
                    splitOrientation === "horizontal"
                      ? { left: `${sliderValue}%` }
                      : { left: "50%", top: `${sliderValue}%` }
                  }
                  aria-hidden
                  onPointerDown={handleSliderHandlePointerDown}
                  onPointerMove={handleSliderHandlePointerMove}
                  onPointerUp={handleSliderHandlePointerUp}
                  onPointerCancel={handleSliderHandlePointerUp}
                  onDoubleClick={handleSliderHandleDoubleClick}
                >
                  <span className="slider-handle-icon">
                    {splitOrientation === "horizontal" ? "< >" : "\u2191 \u2193"}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      <footer className="compare-footer">
        <div className="segmented">
          <button
            type="button"
            className={compareMode === "slider" ? "active" : ""}
            onClick={() => onChangeMode("slider")}
          >
            Side-by-Side
          </button>
          <button
            type="button"
            className={compareMode === "overlay" ? "active" : ""}
            onClick={() => onChangeMode("overlay")}
          >
            Overlay
          </button>
        </div>
        {compareMode === "overlay" && (
          <div className="compare-opacity-row">
            <span className="compare-opacity-label">DRAWING OPACITY</span>
            <div className="compare-opacity-slider-wrap">
              <span className="compare-opacity-pct" aria-hidden>0%</span>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(overlaySettings.opacity * 100)}
                onChange={(e) =>
                  onChangeOverlay({
                    ...overlaySettings,
                    opacity: Number(e.target.value) / 100
                  })
                }
                className="compare-opacity-slider"
                aria-label="Drawing opacity"
              />
              <span className="compare-opacity-pct" aria-hidden>100%</span>
            </div>
          </div>
        )}
        <button
          type="button"
          className="primary-button"
          disabled={!drawingUrl}
          onClick={() => onEvaluate?.()}
          title={!drawingUrl ? "Add a drawing to evaluate" : "View tips and analysis"}
          aria-label="View tips and analysis"
        >
          ✨ View tips & analysis
        </button>
      </footer>
    </div>
  );
}
