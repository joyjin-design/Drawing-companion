/**
 * Gemini API (Google AI Studio) helper for image-to-image outline/sketch.
 * Uses gemini-2.5-flash-image for image editing (photo → line art).
 */

const GEMINI_IMAGE_MODEL = "gemini-2.5-flash-image";
const OUTLINE_PROMPT =
  "Black and white line art outline only. Main contours and edges, no shading. Simple drawing reference. Same composition.";

const SHADING_PROMPT =
  "Rough B&W sketch: outlines plus simple shading. Loose and sketchy, not polished. Same composition.";

export type OutlineResult = { dataUrl: string } | { error: string };
export type ShadingResult = { dataUrl: string } | { error: string };

export async function getOutlineFromImage(base64Jpeg: string): Promise<OutlineResult> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey?.trim()) {
    return { error: "Missing API key. Add VITE_GEMINI_API_KEY to your .env file." };
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_IMAGE_MODEL}:generateContent?key=${apiKey}`;
  const body = {
    contents: [
      {
        parts: [
          { text: OUTLINE_PROMPT },
          {
            inline_data: {
              mime_type: "image/jpeg",
              data: base64Jpeg
            }
          }
        ]
      }
    ],
    generationConfig: {
      responseModalities: ["TEXT", "IMAGE"]
    }
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const errText = await res.text();
      return { error: `API error ${res.status}: ${errText.slice(0, 200)}` };
    }
    const data = (await res.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ inlineData?: { mimeType?: string; data?: string } }> };
      }>;
    };
    const parts = data.candidates?.[0]?.content?.parts ?? [];
    for (const part of parts) {
      if (part.inlineData?.data) {
        const mime = part.inlineData.mimeType ?? "image/png";
        const dataUrl = `data:${mime};base64,${part.inlineData.data}`;
        return { dataUrl };
      }
    }
    return { error: "No image in API response." };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { error: message };
  }
}

export async function getShadingFromImage(base64Jpeg: string): Promise<ShadingResult> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey?.trim()) {
    return { error: "Missing API key. Add VITE_GEMINI_API_KEY to your .env file." };
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_IMAGE_MODEL}:generateContent?key=${apiKey}`;
  const body = {
    contents: [
      {
        parts: [
          { text: SHADING_PROMPT },
          {
            inline_data: {
              mime_type: "image/jpeg",
              data: base64Jpeg
            }
          }
        ]
      }
    ],
    generationConfig: {
      responseModalities: ["TEXT", "IMAGE"]
    }
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const errText = await res.text();
      return { error: `API error ${res.status}: ${errText.slice(0, 200)}` };
    }
    const data = (await res.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ inlineData?: { mimeType?: string; data?: string } }> };
      }>;
    };
    const parts = data.candidates?.[0]?.content?.parts ?? [];
    for (const part of parts) {
      if (part.inlineData?.data) {
        const mime = part.inlineData.mimeType ?? "image/png";
        const dataUrl = `data:${mime};base64,${part.inlineData.data}`;
        return { dataUrl };
      }
    }
    return { error: "No image in API response." };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { error: message };
  }
}

const GEMINI_TEXT_MODEL = "gemini-2.0-flash";
const EVALUATE_PROMPT = `You are a supportive art teacher. The user has shared two images: first a reference (photo or subject), second their drawing of it.

Respond with ONLY a valid JSON object (no markdown, no code fence, no extra text). Use this exact shape:
{
  "title": "Short encouraging title, e.g. Amazing Effort!",
  "subtitle": "One short encouraging sentence",
  "growthPercent": 75,
  "highlights": [
    { "category": "Proportions", "feedback": "One or two sentences on proportions." },
    { "category": "Line Quality", "feedback": "One or two sentences on line work." },
    { "category": "Detail Work", "feedback": "One or two sentences on detail and shading." }
  ]
}
- title: 2-4 words, encouraging.
- subtitle: one sentence, warm tone.
- growthPercent: number 50-95 reflecting how well the drawing matches the reference (be generous).
- highlights: exactly 3 items with category "Proportions", "Line Quality", "Detail Work". Each feedback: 1-2 sentences, specific and constructive.`;

export type EvaluateResult = { text: string } | { error: string };

export async function evaluateDrawing(
  referenceBase64Jpeg: string,
  drawingBase64Jpeg: string
): Promise<EvaluateResult> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey?.trim()) {
    return { error: "Missing API key. Add VITE_GEMINI_API_KEY to your .env file." };
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_TEXT_MODEL}:generateContent?key=${apiKey}`;
  const body = {
    contents: [
      {
        parts: [
          { text: EVALUATE_PROMPT },
          {
            inline_data: {
              mime_type: "image/jpeg",
              data: referenceBase64Jpeg
            }
          },
          {
            inline_data: {
              mime_type: "image/jpeg",
              data: drawingBase64Jpeg
            }
          }
        ]
      }
    ]
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const errText = await res.text();
      return { error: `API error ${res.status}: ${errText.slice(0, 200)}` };
    }
    const data = (await res.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
    };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (text) return { text };
    return { error: "No evaluation in API response." };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { error: message };
  }
}
