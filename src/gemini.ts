/**
 * Gemini API (Google AI Studio) helper for image-to-image outline/sketch.
 * Uses gemini-2.5-flash-image for image editing (photo → line art).
 */

const GEMINI_IMAGE_MODEL = "gemini-2.5-flash-image";
const OUTLINE_PROMPT =
  "Convert this image to a clean black and white line art outline only. Show only the main contours and edges of the subject, no shading, no color, no background detail. Result should look like a simple drawing reference for artists. Preserve the same composition and framing.";

export type OutlineResult = { dataUrl: string } | { error: string };

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
