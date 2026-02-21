import { useState } from "react";
import type React from "react";

type ProgressiveImageProps = {
  src: string;
  previewUrl?: string | null;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
  decoding?: "async" | "sync" | "auto";
  fetchPriority?: "high" | "low" | "auto";
} & Omit<
  React.ImgHTMLAttributes<HTMLImageElement>,
  "src" | "alt" | "className" | "style" | "decoding" | "fetchPriority"
>;

export default function ProgressiveImage({
  src,
  previewUrl,
  alt,
  className = "",
  style,
  decoding = "async",
  fetchPriority,
  ...imgProps
}: ProgressiveImageProps) {
  const [loaded, setLoaded] = useState(false);
  const showPreview = previewUrl && !loaded;

  return (
    <div className={`progressive-image ${className}`.trim()}>
      {showPreview && (
        <img
          src={previewUrl}
          alt=""
          aria-hidden
          className="progressive-image-preview"
        />
      )}
      <img
        src={src}
        alt={alt}
        decoding={decoding}
        {...(fetchPriority != null ? { fetchpriority: fetchPriority } : {})}
        className={`progressive-image-full ${loaded ? "loaded" : ""}`.trim()}
        style={style}
        onLoad={() => setLoaded(true)}
        {...imgProps}
      />
    </div>
  );
}
