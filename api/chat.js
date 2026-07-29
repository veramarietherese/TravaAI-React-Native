const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      service: "Trava AI",
      configured: Boolean(process.env.GEMINI_API_KEY),
      model: MODEL
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      error: "Method not allowed"
    });
  }

  try {
    const body =
      typeof req.body === "string"
        ? JSON.parse(req.body || "{}")
        : req.body || {};

    const message =
      body.message ||
      body.prompt ||
      body.query ||
      body.text ||
      "";

    if (!String(message).trim()) {
      return res.status(400).json({
        ok: false,
        error: "A message is required."
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        ok: false,
        error: "GEMINI_API_KEY is missing in Vercel."
      });
    }

    const endpoint =
      `https://generativelanguage.googleapis.com/v1beta/models/` +
      `${encodeURIComponent(MODEL)}:generateContent?key=` +
      encodeURIComponent(apiKey);

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: String(message).trim()
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1200
        }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        ok: false,
        error:
          data?.error?.message ||
          `Gemini request failed with ${response.status}.`
      });
    }

    const reply =
      data?.candidates?.[0]?.content?.parts
        ?.map((part) => part.text || "")
        .join("")
        .trim() || "";

    if (!reply) {
      return res.status(502).json({
        ok: false,
        error: "Gemini returned an empty response."
      });
    }

    return res.status(200).json({
      ok: true,
      reply,
      response: reply,
      message: reply,
      text: reply,
      content: reply
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message || "Unexpected AI server error."
    });
  }
}
