/**
 * Gemini API: calls our backend (/api/*) so the API key never reaches the browser.
 * Backend uses GEMINI_API_KEY (server-side only on Vercel).
 */

const API_BASE = import.meta.env.VITE_API_ORIGIN ?? "";

export type OutlineResult = { dataUrl: string } | { error: string };
export type ShadingResult = { dataUrl: string } | { error: string };

export async function getOutlineFromImage(base64Jpeg: string): Promise<OutlineResult> {
  try {
    const res = await fetch(`${API_BASE}/api/outline`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ base64: base64Jpeg })
    });
    const data = (await res.json()) as { dataUrl?: string; error?: string };
    if (!res.ok) return { error: data.error ?? `Request failed ${res.status}` };
    if (data.dataUrl) return { dataUrl: data.dataUrl };
    return { error: data.error ?? "No image in response." };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { error: message };
  }
}

export async function getShadingFromImage(base64Jpeg: string): Promise<ShadingResult> {
  try {
    const res = await fetch(`${API_BASE}/api/shading`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ base64: base64Jpeg })
    });
    const data = (await res.json()) as { dataUrl?: string; error?: string };
    if (!res.ok) return { error: data.error ?? `Request failed ${res.status}` };
    if (data.dataUrl) return { dataUrl: data.dataUrl };
    return { error: data.error ?? "No image in response." };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { error: message };
  }
}

export type EvaluateResult = { text: string } | { error: string };

export async function evaluateDrawing(
  referenceBase64Jpeg: string,
  drawingBase64Jpeg: string
): Promise<EvaluateResult> {
  try {
    const res = await fetch(`${API_BASE}/api/evaluate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        referenceBase64: referenceBase64Jpeg,
        drawingBase64: drawingBase64Jpeg
      })
    });
    const data = (await res.json()) as { text?: string; error?: string };
    if (!res.ok) return { error: data.error ?? `Request failed ${res.status}` };
    if (data.text) return { text: data.text };
    return { error: data.error ?? "No evaluation in response." };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { error: message };
  }
}
