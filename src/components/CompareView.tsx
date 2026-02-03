import { useMemo, useRef, useState } from "react";
import type React from "react";
import type { CompareMode, Guides, OverlaySettings } from "../types";

export type CompareViewProps = {
  referenceUrl?: string | null;
  drawingUrl?: string | null;
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
};

export default function CompareView({
  referenceUrl,
  drawingUrl,
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
  onAddDrawing
}: CompareViewProps) {
  const [sliderValue, setSliderValue] = useState(50);
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
        <button className="icon-button" type="button" onClick={onOpenSessions}>
          ⋯
        </button>
      </header>

      <section className="compare-stage">
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
                  <img
                    className="base-image"
                    src={referenceUrl}
                    alt="Reference"
                  />
                )}
                {drawingUrl && (
                  <img
                    className="drawing-image"
                    src={drawingUrl}
                    alt="Drawing"
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
              <div className="slider-stack">
                {referenceUrl && (
                  <img
                    className="base-image"
                    src={referenceUrl}
                    alt="Reference"
                  />
                )}
                {drawingUrl && (
                  <div
                    className="slider-mask"
                    style={{
                      clipPath: `inset(0 ${100 - sliderValue}% 0 0)`
                    }}
                  >
                    <img
                      className="base-image"
                      src={drawingUrl}
                      alt="Drawing"
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

      <section className="compare-controls">
        {compareMode === "slider" && (
          <label className="control-row">
            <span>Reveal</span>
            <input
              type="range"
              min={0}
              max={100}
              value={sliderValue}
              onChange={(event) =>
                setSliderValue(Number(event.target.value))
              }
            />
          </label>
        )}
        {compareMode === "overlay" && (
          <>
            <label className="control-row">
              <span>Opacity</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={overlaySettings.opacity}
                onChange={(event) =>
                  onChangeOverlay({
                    ...overlaySettings,
                    opacity: Number(event.target.value)
                  })
                }
              />
            </label>
            <label className="control-row">
              <span>Scale</span>
              <input
                type="range"
                min={0.5}
                max={2}
                step={0.01}
                value={overlaySettings.scale}
                onChange={(event) =>
                  onChangeOverlay({
                    ...overlaySettings,
                    scale: Number(event.target.value)
                  })
                }
              />
            </label>
            <div className="control-row">
              <span>Rotate</span>
              <div className="button-group">
                <button
                  className="mini-button"
                  onClick={() =>
                    onChangeOverlay({
                      ...overlaySettings,
                      rotation: overlaySettings.rotation - 5
                    })
                  }
                >
                  -5°
                </button>
                <button
                  className="mini-button"
                  onClick={() =>
                    onChangeOverlay({
                      ...overlaySettings,
                      rotation: overlaySettings.rotation + 5
                    })
                  }
                >
                  +5°
                </button>
              </div>
            </div>
            <button className="ghost-button" onClick={onResetAlignment}>
              Reset alignment
            </button>
          </>
        )}

        <div className="divider" />

        <div className="toggle-row">
          <button
            className={guides.grid ? "toggle active" : "toggle"}
            onClick={() => onChangeGuides({ ...guides, grid: !guides.grid })}
          >
            Grid
          </button>
          <button
            className={guides.centerline ? "toggle active" : "toggle"}
            onClick={() =>
              onChangeGuides({ ...guides, centerline: !guides.centerline })
            }
          >
            Centerline
          </button>
        </div>
      </section>

      <footer className="compare-footer">
        <button className="secondary-button" onClick={onAddReference}>
          Update reference
        </button>
        <button className="secondary-button" onClick={onAddDrawing}>
          Update drawing
        </button>
      </footer>
    </div>
  );
}
