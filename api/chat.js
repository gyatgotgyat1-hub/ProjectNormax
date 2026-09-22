const MODELS = {
  fast: "llama-3.1-8b-instant",
  balanced: "openai/gpt-oss-20b",
  quality: "openai/gpt-oss-120b",
};

const VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";
const FALLBACK_MODEL = "llama-3.1-8b-instant";

const MAX_TOKENS = {
  fast: 512,
  balanced: 1024,
  quality: 2048,
};

function buildGroqMessages(messages) {
  return messages.map((msg) => {
    if (msg.image?.base64) {
      const mime = msg.image.mimeType || "image/jpeg";
      return {
        role: msg.role,
        content: [
          { type: "text", text: msg.content || "Describe this image." },
          {
            type: "image_url",
            image_url: {
              url: `data:${mime};base64,${msg.image.base64}`,
            },
          },
        ],
      };
    }
    return { role: msg.role, content: msg.content };
  });
}

function isModelAccessError(data) {
  const msg = (data?.error?.message || data?.message || "").toLowerCase();
  return msg.includes("does not exist") || msg.includes("do not have access");
}

async function callGroq(apiKey, { model, groqMessages, speedKey }) {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: groqMessages,
      temperature: speedKey === "quality" ? 0.5 : 0.7,
      max_tokens: MAX_TOKENS[speedKey] || 1024,
    }),
  });

  const data = await response.json();
  return { response, data };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: "GROQ_API_KEY is not configured. Add it in Vercel project settings.",
    });
  }

  const { messages, speed = "balanced" } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "messages array is required" });
  }

  const hasImage = messages.some((m) => m.image?.base64);
  const speedKey = MODELS[speed] ? speed : "balanced";
  let model = hasImage ? VISION_MODEL : MODELS[speedKey];

  const groqMessages = [
    {
      role: "system",
      content:
        "You are ProjectNormax, a helpful assistant. Be concise unless the user asks for detail.",
    },
    ...buildGroqMessages(messages),
  ];

  try {
    let { response, data } = await callGroq(apiKey, { model, groqMessages, speedKey });

    if (!response.ok && isModelAccessError(data) && model !== FALLBACK_MODEL) {
      model = FALLBACK_MODEL;
      ({ response, data } = await callGroq(apiKey, { model, groqMessages, speedKey }));
    }

    if (!response.ok) {
      const errMsg =
        data?.error?.message || data?.message || "Groq API request failed";
      return res.status(response.status).json({ error: errMsg });
    }

    const reply = data.choices?.[0]?.message?.content?.trim();
    return res.status(200).json({ reply: reply || "Empty response from model." });
  } catch (err) {
    return res.status(500).json({
      error: err.message || "Failed to reach Groq API",
    });
  }
}
