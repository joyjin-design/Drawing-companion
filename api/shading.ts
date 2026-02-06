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

  try {
    const geminiRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      return res.status(502).json({ error: `Gemini error: ${errText.slice(0, 200)}` });
    }
    const data = (await geminiRes.json()) as {
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
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return res.status(500).json({ error: message });
  }
}
