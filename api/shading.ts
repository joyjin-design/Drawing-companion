import type { VercelRequest, VercelResponse } from "@vercel/node";

const GEMINI_IMAGE_MODEL = "gemini-2.5-flash-image";
const SHADING_PROMPT =
  "Rough B&W sketch: outlines plus simple shading. Loose and sketchy, not polished. Same composition.";

function cors(res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey?.trim()) {
    return res.status(500).json({ error: "Server missing GEMINI_API_KEY." });
  }

  const { base64 } = (req.body || {}) as { base64?: string };
  if (!base64) {
    return res.status(400).json({ error: "Missing base64 in body." });
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_IMAGE_MODEL}:generateContent?key=${apiKey}`;
  const body = {
    contents: [
      {
        parts: [
          { text: SHADING_PROMPT },
          { inline_data: { mime_type: "image/jpeg", data: base64 } }
        ]
      }
    ],
    generationConfig: { responseModalities: ["TEXT", "IMAGE"] }
  };

  const maxAttempts = 3;
  const backoffMs = [1000, 2000];

  try {
    let lastErrText = "";
    let lastStatus = 0;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const geminiRes = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      lastErrText = await geminiRes.text();
      lastStatus = geminiRes.status;
      if (geminiRes.ok) {
        const data = JSON.parse(lastErrText) as {
          candidates?: Array<{
            content?: { parts?: Array<{ inlineData?: { mimeType?: string; data?: string } }> };
          }>;
        };
        const parts = data.candidates?.[0]?.content?.parts ?? [];
        for (const part of parts) {
          if (part.inlineData?.data) {
            const mime = part.inlineData.mimeType ?? "image/png";
            return res.status(200).json({ dataUrl: `data:${mime};base64,${part.inlineData.data}` });
          }
        }
        return res.status(502).json({ error: "No image in Gemini response." });
      }
      const is429 =
        lastStatus === 429 ||
        lastErrText.includes("429") ||
        lastErrText.includes("Resource exhausted");
      if (!is429 || attempt === maxAttempts) {
        const message = is429
          ? "Rate limit reached. Please try again in a minute."
          : `Gemini error: ${lastErrText.slice(0, 200)}`;
        return res.status(is429 ? 429 : 502).json({ error: message });
      }
      await new Promise((r) => setTimeout(r, backoffMs[attempt - 1] ?? 2000));
    }
    const message =
      lastStatus === 429 || lastErrText.includes("429") || lastErrText.includes("Resource exhausted")
        ? "Rate limit reached. Please try again in a minute."
        : `Gemini error: ${lastErrText.slice(0, 200)}`;
    return res.status(429).json({ error: message });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return res.status(500).json({ error: message });
  }
}
