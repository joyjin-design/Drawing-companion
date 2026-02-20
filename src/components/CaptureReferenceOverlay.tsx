import { useCallback, useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowLeft } from "@fortawesome/free-solid-svg-icons";
import { getOutlineFromImage, getShadingFromImage } from "../gemini";
import { getOutlineDataUrl, getShadingDataUrl } from "../sketchClient";
import { SketchLoadingAnimation, SHAPES, LOADING_MESSAGES } from "./SketchLoadingAnimation";

export type CaptureReferenceOverlayProps = {
  open: boolean;
  onClose: () => void;
  onReferenceSelected: (file: File, source?: "outline" | "shading") => void;
};

export default function CaptureReferenceOverlay({
  open,
  onClose,
  onReferenceSelected
}: CaptureReferenceOverlayProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const outlineAutoLoadDoneRef = useRef(false);
  const getOutlineRef = useRef<() => Promise<void>>(() => Promise.resolve());
  const outlineTriggerCleanupRef = useRef<(() => void) | null>(null);
  const outlineDelayTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [cameraError, setCameraError] = useState<string | null>(null);
  const [streamReady, setStreamReady] = useState(false);
  const [captureMode, setCaptureMode] = useState<"form" | "shading" | "colors">("form");
  const [outlineDataUrl, setOutlineDataUrl] = useState<string | null>(null);
  const [outlineDisplayUrl, setOutlineDisplayUrl] = useState<string | null>(null);
  const [outlineLoading, setOutlineLoading] = useState(false);
  const [outlineError, setOutlineError] = useState<string | null>(null);
  const [shadingDataUrl, setShadingDataUrl] = useState<string | null>(null);
  const [shadingLoading, setShadingLoading] = useState(false);
  const [shadingError, setShadingError] = useState<string | null>(null);
  const [generatingPreviewUrl, setGeneratingPreviewUrl] = useState<string | null>(null);
  const [captureWithGeminiLoading, setCaptureWithGeminiLoading] = useState(false);
  const [captureWithGeminiError, setCaptureWithGeminiError] = useState<string | null>(null);
  const [captureShapeIndex, setCaptureShapeIndex] = useState(0);
  const [captureMessageIndex, setCaptureMessageIndex] = useState(0);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    outlineAutoLoadDoneRef.current = false;
    setStreamReady(false);
    setCameraError(null);
    setOutlineDataUrl(null);
    setOutlineError(null);
    setShadingDataUrl(null);
    setShadingError(null);
    setGeneratingPreviewUrl(null);
    setCaptureWithGeminiError(null);
    setCaptureWithGeminiLoading(false);
  }, []);

  const handleClose = useCallback(() => {
    stopCamera();
    onClose();
  }, [stopCamera, onClose]);

  const showCaptureLoading =
    (outlineLoading || shadingLoading || captureWithGeminiLoading) && !!generatingPreviewUrl;

  useEffect(() => {
    if (!showCaptureLoading) return;
    const cycle = setInterval(() => {
      setCaptureMessageIndex((i) => (i + 1) % LOADING_MESSAGES.length);
    }, 2000);
    return () => clearInterval(cycle);
  }, [showCaptureLoading]);

  useEffect(() => {
    if (!open) {
      stopCamera();
      return;
    }
    let cancelled = false;
    setCameraError(null);
    setStreamReady(false);
    outlineAutoLoadDoneRef.current = false;
    navigator.mediaDevices
      .getUserMedia({
        video: { facingMode: "environment" },
        audio: false
      })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        setStreamReady(true);
        setCaptureMode("form");
      })
      .catch((err) => {
        if (!cancelled) {
          setCameraError(
            err instanceof Error ? err.message : "Could not access camera"
          );
        }
      });
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [open, stopCamera]);

  useEffect(() => {
    if (!streamReady || !streamRef.current) return;
    const video = videoRef.current;
    if (!video) {
      return () => {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      };
    }
    video.srcObject = streamRef.current;
    video.play().catch(() => {});

    outlineTriggerCleanupRef.current = null;
    const deferredId = setTimeout(() => {
      const runOutlineAfterFrame = () => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            outlineDelayTimeoutRef.current = setTimeout(() => {
              outlineDelayTimeoutRef.current = null;
              getOutlineRef.current();
            }, 300);
          });
        });
      };

      const triggerOutlineWhenReady = () => {
        if (outlineAutoLoadDoneRef.current) return;
        if (video.videoWidth === 0) return;
        outlineAutoLoadDoneRef.current = true;

        if (video.readyState >= 2 && !video.paused) {
          runOutlineAfterFrame();
          return;
        }
        let fallbackId: ReturnType<typeof setTimeout> | undefined;
        const onPlaying = () => {
          video.removeEventListener("playing", onPlaying);
          if (fallbackId !== undefined) clearTimeout(fallbackId);
          runOutlineAfterFrame();
        };
        video.addEventListener("playing", onPlaying, { once: true });
        fallbackId = setTimeout(() => {
          video.removeEventListener("playing", onPlaying);
          runOutlineAfterFrame();
        }, 3000);
      };

      const onMeta = () => {
        video.removeEventListener("loadedmetadata", onMeta);
        triggerOutlineWhenReady();
      };
      video.addEventListener("loadedmetadata", onMeta);
      if (video.videoWidth > 0) triggerOutlineWhenReady();

      const pollId = setInterval(triggerOutlineWhenReady, 150);
      const timeoutId = setTimeout(() => clearInterval(pollId), 6000);

      outlineTriggerCleanupRef.current = () => {
        if (outlineDelayTimeoutRef.current) {
          clearTimeout(outlineDelayTimeoutRef.current);
          outlineDelayTimeoutRef.current = null;
        }
        clearTimeout(timeoutId);
        clearInterval(pollId);
        video.removeEventListener("loadedmetadata", onMeta);
      };
    }, 0);

    return () => {
      clearTimeout(deferredId);
      outlineTriggerCleanupRef.current?.();
      outlineTriggerCleanupRef.current = null;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [streamReady]);

  const captureFrameAsBase64 = useCallback((): Promise<string> => {
    return new Promise((resolve, reject) => {
      const video = videoRef.current;
      if (!video || video.videoWidth === 0) {
        reject(new Error("Video not ready"));
        return;
      }
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("No canvas context"));
        return;
      }
      ctx.drawImage(video, 0, 0);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
      const base64 = dataUrl.split(",")[1];
      if (!base64) reject(new Error("Failed to encode frame"));
      else resolve(base64);
    });
  }, []);

  const captureFrameAsDataUrl = useCallback((): Promise<string> => {
    return new Promise((resolve, reject) => {
      const video = videoRef.current;
      if (!video || video.videoWidth === 0) {
        reject(new Error("Video not ready"));
        return;
      }
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("No canvas context"));
        return;
      }
      ctx.drawImage(video, 0, 0);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    });
  }, []);

  const captureFrameAsBase64Small = useCallback((): Promise<string> => {
    return new Promise((resolve, reject) => {
      const video = videoRef.current;
      if (!video || video.videoWidth === 0) {
        reject(new Error("Video not ready"));
        return;
      }
      const maxSize = 480;
      let w = video.videoWidth;
      let h = video.videoHeight;
      if (w > maxSize || h > maxSize) {
        if (w >= h) {
          h = Math.round((h * maxSize) / w);
          w = maxSize;
        } else {
          w = Math.round((w * maxSize) / h);
          h = maxSize;
        }
      }
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("No canvas context"));
        return;
      }
      ctx.drawImage(video, 0, 0, w, h);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.4);
      const base64 = dataUrl.split(",")[1];
      if (!base64) reject(new Error("Failed to encode frame"));
      else resolve(base64);
    });
  }, []);

  const getOutline = useCallback(async () => {
    setOutlineError(null);
    setOutlineLoading(true);
    try {
      const dataUrl = await captureFrameAsDataUrl();
      setGeneratingPreviewUrl(dataUrl);
      const outlineUrl = await getOutlineDataUrl(dataUrl);
      setOutlineDataUrl(outlineUrl);
    } catch (e) {
      setOutlineError(e instanceof Error ? e.message : "Failed to create outline");
      setOutlineDataUrl(null);
    } finally {
      setOutlineLoading(false);
      setGeneratingPreviewUrl(null);
    }
  }, [captureFrameAsDataUrl]);

  const getShading = useCallback(async () => {
    setShadingError(null);
    setShadingLoading(true);
    try {
      const dataUrl = await captureFrameAsDataUrl();
      setGeneratingPreviewUrl(dataUrl);
      const shadingUrl = await getShadingDataUrl(dataUrl);
      setShadingDataUrl(shadingUrl);
    } catch (e) {
      setShadingError(e instanceof Error ? e.message : "Failed to create sketch");
      setShadingDataUrl(null);
    } finally {
      setShadingLoading(false);
      setGeneratingPreviewUrl(null);
    }
  }, [captureFrameAsDataUrl]);
  getOutlineRef.current = getOutline;

  const outlineBlobUrlRef = useRef<string | null>(null);
  useEffect(() => {
    if (!outlineDataUrl) {
      if (outlineBlobUrlRef.current) {
        URL.revokeObjectURL(outlineBlobUrlRef.current);
        outlineBlobUrlRef.current = null;
      }
      setOutlineDisplayUrl(null);
      return;
    }
    try {
      if (outlineBlobUrlRef.current) URL.revokeObjectURL(outlineBlobUrlRef.current);
      const comma = outlineDataUrl.indexOf(",");
      if (comma === -1) {
        setOutlineDisplayUrl(outlineDataUrl);
        return;
      }
      const mime = outlineDataUrl.slice(0, comma).match(/:(.*?);/)?.[1] ?? "image/png";
      const b64 = outlineDataUrl.slice(comma + 1);
      const bin = atob(b64);
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      const blob = new Blob([arr], { type: mime });
      const url = URL.createObjectURL(blob);
      outlineBlobUrlRef.current = url;
      setOutlineDisplayUrl(url);
    } catch {
      setOutlineDisplayUrl(outlineDataUrl);
    }
    return () => {
      if (outlineBlobUrlRef.current) {
        URL.revokeObjectURL(outlineBlobUrlRef.current);
        outlineBlobUrlRef.current = null;
      }
      setOutlineDisplayUrl(null);
    };
  }, [outlineDataUrl]);

  const capturePhoto = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !streamRef.current) return;
    if (captureWithGeminiLoading) return;

    const usePhotoFallback = () => {
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
          handleClose();
          onReferenceSelected(file);
        },
        "image/jpeg",
        0.9
      );
    };

    if (captureMode === "colors") {
      usePhotoFallback();
      return;
    }

    const isForm = captureMode === "form";
    const isShading = captureMode === "shading";
    if (isForm || isShading) {
      setCaptureWithGeminiError(null);
      setCaptureWithGeminiLoading(true);
      try {
        const previewUrl = await captureFrameAsDataUrl();
        setGeneratingPreviewUrl(previewUrl);
        const base64 = await captureFrameAsBase64Small();
        if (isForm) {
          const result = await getOutlineFromImage(base64);
          if ("error" in result) {
            setCaptureWithGeminiError(result.error);
            setCaptureWithGeminiLoading(false);
            setGeneratingPreviewUrl(null);
            return;
          }
          const res = await fetch(result.dataUrl);
          const blob = await res.blob();
          const file = new File([blob], "reference-outline.png", { type: blob.type || "image/png" });
          handleClose();
          setCaptureWithGeminiLoading(false);
          setGeneratingPreviewUrl(null);
          onReferenceSelected(file, "outline");
        } else {
          const result = await getShadingFromImage(base64);
          if ("error" in result) {
            setCaptureWithGeminiError(result.error);
            setCaptureWithGeminiLoading(false);
            setGeneratingPreviewUrl(null);
            return;
          }
          const res = await fetch(result.dataUrl);
          const blob = await res.blob();
          const file = new File([blob], "reference-shading.png", { type: blob.type || "image/png" });
          handleClose();
          setCaptureWithGeminiLoading(false);
          setGeneratingPreviewUrl(null);
          onReferenceSelected(file, "shading");
        }
      } catch (e) {
        setCaptureWithGeminiError(e instanceof Error ? e.message : "Failed to process");
        setCaptureWithGeminiLoading(false);
        setGeneratingPreviewUrl(null);
      }
      return;
    }

    usePhotoFallback();
  }, [
    captureMode,
    captureWithGeminiLoading,
    captureFrameAsDataUrl,
    captureFrameAsBase64Small,
    onReferenceSelected,
    handleClose
  ]);

  if (!open) return null;

  return (
    <div className="capture-reference-overlay" role="dialog" aria-label="Capture Reference">
      {open && !streamReady && !cameraError && (
        <div className="camera-loading-screen" aria-live="polite">
          <div className="camera-loading-screen-spinner" aria-hidden />
          <p>Opening camera…</p>
        </div>
      )}
      {cameraError && (
        <div className="capture-reference-camera-error">
          <p className="camera-error" role="alert">
            {cameraError}. You can close and choose an image from your device instead.
          </p>
          <button type="button" className="primary-button" onClick={handleClose}>
            Back
          </button>
        </div>
      )}
      {streamReady && (
        <>
          {showCaptureLoading && (
            <div className="capture-loading-fullscreen" aria-hidden role="presentation">
              <div
                className="capture-loading-blob capture-loading-blob-tl"
                style={{ background: SHAPES[captureShapeIndex % SHAPES.length]?.color ?? "#6B8CA8" }}
              />
              <div
                className="capture-loading-blob capture-loading-blob-br"
                style={{ background: "#c9a227" }}
              />
              <div className="capture-loading-content">
                <SketchLoadingAnimation
                  currentShapeIndex={captureShapeIndex}
                  onShapeChange={setCaptureShapeIndex}
                />
                <div className="capture-loading-dots">
                  {SHAPES.map((s, i) => (
                    <div
                      key={s.id}
                      className={`capture-loading-dot ${i === captureShapeIndex ? "active" : ""}`}
                      style={{
                        background: i === captureShapeIndex ? s.color : "rgba(0, 0, 0, 0.2)"
                      }}
                    />
                  ))}
                </div>
                <p className="capture-loading-message">
                  {LOADING_MESSAGES[captureMessageIndex % LOADING_MESSAGES.length]}
                </p>
              </div>
            </div>
          )}
          <header className="capture-reference-header">
            <button
              type="button"
              className="capture-reference-back"
              onClick={handleClose}
              aria-label="Back"
            >
              <FontAwesomeIcon icon={faArrowLeft} aria-hidden />
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
              style={
                (captureMode === "form" && outlineDataUrl) ||
                (captureMode === "shading" && shadingDataUrl) ||
                outlineLoading ||
                shadingLoading ||
                captureWithGeminiLoading
                  ? { display: "none" }
                  : undefined
              }
              playsInline
              muted
              autoPlay
            />
            {captureMode === "form" && outlineDataUrl && (
              <img
                key={outlineDataUrl.slice(0, 80)}
                src={outlineDisplayUrl || outlineDataUrl}
                alt="Outline reference"
                className="capture-reference-preview capture-reference-outline-preview"
                style={{ zIndex: 1 }}
                decoding="async"
              />
            )}
            {captureMode === "shading" && shadingDataUrl && (
              <img
                src={shadingDataUrl}
                alt="Outline and shading reference"
                className="capture-reference-preview capture-reference-outline-preview"
                decoding="async"
              />
            )}
            <div className="capture-reference-grid" aria-hidden />
            {(outlineError || (captureWithGeminiError && captureMode === "form")) && captureMode === "form" && (
              <p className="capture-reference-outline-error" role="alert">
                {captureWithGeminiError ?? outlineError}
              </p>
            )}
            {(shadingError || (captureWithGeminiError && captureMode === "shading")) && captureMode === "shading" && (
              <p className="capture-reference-outline-error" role="alert">
                {captureWithGeminiError ?? shadingError}
              </p>
            )}
            {!(outlineDataUrl || shadingDataUrl) && (
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
            )}
          </div>

          <div className="capture-reference-tip">
            <span className="capture-reference-tip-icon" aria-hidden>💡</span>
            <span className="capture-reference-tip-text">
              Tip: Good lighting and a clear background help with drawing
            </span>
          </div>

          <div className="capture-reference-controls">
            <div className="capture-reference-modes">
              <button
                type="button"
                className={`capture-reference-mode-btn ${captureMode === "colors" ? "active" : ""}`}
                onClick={() => {
                  setCaptureMode("colors");
                  setOutlineDataUrl(null);
                  setShadingDataUrl(null);
                  setOutlineError(null);
                  setShadingError(null);
                  setCaptureWithGeminiError(null);
                }}
                aria-pressed={captureMode === "colors"}
              >
                <span className="mode-icon" aria-hidden />
                <span>Colors</span>
              </button>
              <button
                type="button"
                className={`capture-reference-mode-btn ${captureMode === "form" ? "active" : ""}`}
                onClick={() => {
                  setCaptureMode("form");
                  setShadingDataUrl(null);
                  setShadingError(null);
                  setOutlineError(null);
                  setCaptureWithGeminiError(null);
                  getOutline();
                }}
                aria-pressed={captureMode === "form"}
              >
                <span className="mode-icon mode-form" aria-hidden />
                <span>Outline</span>
              </button>
              <button
                type="button"
                className={`capture-reference-mode-btn ${captureMode === "shading" ? "active" : ""}`}
                onClick={() => {
                  setCaptureMode("shading");
                  setOutlineDataUrl(null);
                  setOutlineError(null);
                  setShadingError(null);
                  setCaptureWithGeminiError(null);
                  getShading();
                }}
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
              disabled={captureWithGeminiLoading}
              aria-label="Capture photo"
            />
          </div>
        </>
      )}
    </div>
  );
}
