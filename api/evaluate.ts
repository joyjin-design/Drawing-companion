import type { VercelRequest, VercelResponse } from "@vercel/node";

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

  const { referenceBase64, drawingBase64 } = (req.body || {}) as {
    referenceBase64?: string;
    drawingBase64?: string;
  };
  if (!referenceBase64 || !drawingBase64) {
    return res.status(400).json({ error: "Missing referenceBase64 or drawingBase64 in body." });
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_TEXT_MODEL}:generateContent?key=${apiKey}`;
  const body = {
    contents: [
      {
        parts: [
          { text: EVALUATE_PROMPT },
          { inline_data: { mime_type: "image/jpeg", data: referenceBase64 } },
          { inline_data: { mime_type: "image/jpeg", data: drawingBase64 } }
        ]
      }
    ]
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
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (text) return res.status(200).json({ text });
    return res.status(502).json({ error: "No evaluation in Gemini response." });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return res.status(500).json({ error: message });
  }
}
