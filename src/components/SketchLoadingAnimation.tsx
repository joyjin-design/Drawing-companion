import { useEffect, useRef, useState } from "react";

export const SHAPES = [
  {
    id: "circle",
    color: "#6B8CA8",
    fill: "none",
    strokeDuration: 800,
    strokes: [
      "M 50 50 m -30 0 a 30 30 0 1 1 60 0 a 30 30 0 1 1 -60 0",
    ],
  },
  {
    id: "star",
    color: "#7A9E7E",
    fill: "none",
    strokeDuration: 900,
    strokes: [
      "M 50 10 L 61 37 L 90 37 L 67 55 L 76 82 L 50 65 L 24 82 L 33 55 L 10 37 L 39 37 Z",
    ],
  },
  {
    id: "sun",
    color: "#E96025",
    fill: "none",
    strokes: [
      "M 50 50 m -20 0 a 20 20 0 1 1 40 0 a 20 20 0 1 1 -40 0",
      "M 50 22 L 50 14 M 50 78 L 50 86 M 22 50 L 14 50 M 78 50 L 86 50",
      "M 32 32 L 26 26 M 68 32 L 74 26 M 32 68 L 26 74 M 68 68 L 74 74",
    ],
  },
];

export const LOADING_MESSAGES = [
  "Sketching your canvas…",
  "Warming up the brushes…",
  "Drawing something beautiful…",
  "Almost there…",
];

const STROKE_DURATION = 800;
const HOLD_DURATION = 600;
const FADE_DURATION = 300;

type Phase = "drawing" | "holding" | "fading";

export function SketchLoadingAnimation({
  onShapeChange,
  currentShapeIndex,
}: {
  onShapeChange?: (i: number) => void;
  currentShapeIndex: number;
}) {
  const [strokesVisible, setStrokesVisible] = useState(0);
  const [currentStrokeProgress, setCurrentStrokeProgress] = useState(0);
  const [phase, setPhase] = useState<Phase>("drawing");
  const [opacity, setOpacity] = useState(1);
  const shapeRef = useRef(currentShapeIndex);

  useEffect(() => {
    shapeRef.current = currentShapeIndex;
  }, [currentShapeIndex]);

  useEffect(() => {
    setStrokesVisible(0);
    setCurrentStrokeProgress(0);
    setPhase("drawing");
    setOpacity(1);
  }, [currentShapeIndex]);

  const shape = SHAPES[currentShapeIndex % SHAPES.length];

  useEffect(() => {
    if (phase !== "drawing") return;
    if (strokesVisible >= shape.strokes.length) {
      setPhase("holding");
      return;
    }

    const start = performance.now();
    let raf: number;
    const tick = (now: number) => {
      const p = Math.min((now - start) / (shape.strokeDuration ?? STROKE_DURATION), 1);
      setCurrentStrokeProgress(p);
      if (p < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        setStrokesVisible((v) => v + 1);
        setCurrentStrokeProgress(0);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase, strokesVisible, shape.strokes.length, shape.strokeDuration]);

  useEffect(() => {
    if (phase !== "holding") return;
    const t = setTimeout(() => setPhase("fading"), HOLD_DURATION);
    return () => clearTimeout(t);
  }, [phase]);

  useEffect(() => {
    if (phase !== "fading") return;
    const start = performance.now();
    let raf: number;
    const tick = (now: number) => {
      const p = Math.min((now - start) / FADE_DURATION, 1);
      setOpacity(1 - p);
      if (p < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        onShapeChange?.((shapeRef.current + 1) % SHAPES.length);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase, onShapeChange]);

  return (
    <div className="sketch-loading-animation" style={{ opacity, transition: "opacity 0.05s" }}>
      <svg viewBox="0 0 100 100" className="sketch-loading-svg" aria-hidden>
        {shape.strokes.map((d, i) => {
          const isCurrentStroke = i === strokesVisible;
          const isPastStroke = i < strokesVisible;
          const isFuture = i > strokesVisible;

          return (
            <path
              key={`${currentShapeIndex}-${i}`}
              d={d}
              fill="none"
              stroke={shape.color}
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="1"
              strokeDashoffset={
                isPastStroke ? 0 : isCurrentStroke ? 1 - currentStrokeProgress : 1
              }
              pathLength={1}
              style={{ opacity: isFuture ? 0 : 1 }}
            />
          );
        })}
      </svg>
    </div>
  );
}
