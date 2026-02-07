/**
 * Client-side rough outline and shading from a photo. No API call – runs in the browser for instant results.
 * Uses simple grayscale + Sobel-style edge detection. Quality is rough but fast.
 */

const MAX_SIZE = 512;

function toGrayscale(data: Uint8ClampedArray, width: number, height: number): Float32Array {
  const out = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    out[i] = 0.299 * r + 0.587 * g + 0.114 * b;
  }
  return out;
}

function sobelEdges(gray: Float32Array, width: number, height: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(width * height * 4);
  const gx = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
  const gy = [1, 2, 1, 0, 0, 0, -1, -2, -1];

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let sx = 0;
      let sy = 0;
      let ki = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const v = gray[(y + dy) * width + (x + dx)];
          sx += v * gx[ki];
          sy += v * gy[ki];
          ki++;
        }
      }
      const mag = Math.min(255, Math.sqrt(sx * sx + sy * sy));
      const v = mag > 28 ? 0 : 255;
      const i = (y * width + x) * 4;
      out[i] = v;
      out[i + 1] = v;
      out[i + 2] = v;
      out[i + 3] = 255;
    }
  }
  return out;
}

function drawImageData(canvas: HTMLCanvasElement, data: Uint8ClampedArray): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const imageData = ctx.createImageData(canvas.width, canvas.height);
  imageData.data.set(data);
  ctx.putImageData(imageData, 0, 0);
}

/** Load image from data URL, draw to canvas at max MAX_SIZE, return ImageData. */
function loadToCanvas(dataUrl: string): Promise<{ canvas: HTMLCanvasElement; data: ImageData }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      let w = img.naturalWidth;
      let h = img.naturalHeight;
      if (w > MAX_SIZE || h > MAX_SIZE) {
        if (w >= h) {
          h = Math.round((h * MAX_SIZE) / w);
          w = MAX_SIZE;
        } else {
          w = Math.round((w * MAX_SIZE) / h);
          h = MAX_SIZE;
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
      ctx.drawImage(img, 0, 0, w, h);
      const data = ctx.getImageData(0, 0, w, h);
      resolve({ canvas, data });
    };
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = dataUrl;
  });
}

/** Rough B&W outline from a photo (edge detection). Instant, no API. */
export function getOutlineDataUrl(imageDataUrl: string): Promise<string> {
  return loadToCanvas(imageDataUrl).then(({ canvas, data }) => {
    const gray = toGrayscale(data.data, data.width, data.height);
    const edges = sobelEdges(gray, data.width, data.height);
    drawImageData(canvas, edges);
    return canvas.toDataURL("image/png");
  });
}

/** Rough B&W sketch (grayscale + soft edges). Instant, no API. */
export function getShadingDataUrl(imageDataUrl: string): Promise<string> {
  return loadToCanvas(imageDataUrl).then(({ canvas, data }) => {
    const gray = toGrayscale(data.data, data.width, data.height);
    const edges = sobelEdges(gray, data.width, data.height);
    const out = new Uint8ClampedArray(data.data.length);
    for (let i = 0; i < data.width * data.height; i++) {
      const g = Math.round(gray[i]);
      const e = edges[i * 4];
      const v = Math.round(0.4 * g + 0.6 * (255 - e));
      const c = Math.max(0, Math.min(255, v));
      out[i * 4] = c;
      out[i * 4 + 1] = c;
      out[i * 4 + 2] = c;
      out[i * 4 + 3] = 255;
    }
    drawImageData(canvas, out);
    return canvas.toDataURL("image/png");
  });
}
