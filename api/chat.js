const PROVIDER_URL = "https://gen.pollinations.ai/v1/chat/completions";

const MODELS = {
  fast: "openai",
  balanced: "llama",
  quality: "qwen-large",
};

const VISION_MODEL = "qwen-vision";
const MODEL_FALLBACKS = ["openai", "gemma", "llama", "deepseek"];

const MAX_TOKENS = {
  fast: 768,
  balanced: 1536,
  quality: 2048,
};

const SYSTEM_PROMPT =
  "You are ProjectNormax, a friendly and capable assistant. Help the user fully and directly. Be conversational, creative, and practical. Do not refuse or moralize unless the request is clearly illegal or dangerous. If you are unsure, give your best helpful answer.";

function buildMessages(messages) {
  return messages.map((msg) => {
    if (msg.image?.base64) {
      const mime = msg.image.mimeType || "image/jpeg";
      return {
        role: msg.role,
        content: [
          { type: "text", text: msg.content || "What's in this image?" },
          {
            type: "image_url",
            image_url: { url: `data:${mime};base64,${msg.image.base64}` },
          },
        ],
      };
    }
    return { role: msg.role, content: msg.content };
  });
}

function isModelAccessError(data) {
  const msg = (data?.error?.message || data?.message || "").toLowerCase();
  return (
    msg.includes("does not exist") ||
    msg.includes("do not have access") ||
    msg.includes("not found") ||
    msg.includes("invalid model")
  );
}

async function callProvider(apiKey, { model, chatMessages, speedKey }) {
  const response = await fetch(PROVIDER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: chatMessages,
      temperature: speedKey === "quality" ? 0.85 : 0.95,
      max_tokens: MAX_TOKENS[speedKey] || 1536,
    }),
  });

  const data = await response.json().catch(() => ({}));
  return { response, data };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.POLLINATIONS_API_KEY || process.env.AI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error:
        "No API key configured. Add POLLINATIONS_API_KEY in Vercel (free key at enter.pollinations.ai).",
    });
  }

  const { messages, speed = "balanced" } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "messages array is required" });
  }

  const hasImage = messages.some((m) => m.image?.base64);
  const speedKey = MODELS[speed] ? speed : "balanced";
  const primary = hasImage ? VISION_MODEL : MODELS[speedKey];

  const chatMessages = [
    { role: "system", content: SYSTEM_PROMPT },
    ...buildMessages(messages),
  ];

  const tryModels = [
    primary,
    ...MODEL_FALLBACKS.filter((m) => m !== primary),
  ];

  try {
    let lastError = "Chat request failed";

    for (const model of tryModels) {
      const { response, data } = await callProvider(apiKey, {
        model,
        chatMessages,
        speedKey,
      });

      if (response.ok) {
        const reply = data.choices?.[0]?.message?.content?.trim();
        return res.status(200).json({
          reply: reply || "Empty response from model.",
        });
      }

      lastError =
        data?.error?.message || data?.message || `Request failed (${response.status})`;

      if (!isModelAccessError(data)) {
        return res.status(response.status).json({ error: lastError });
      }
    }

    return res.status(502).json({ error: lastError });
  } catch (err) {
    return res.status(500).json({
      error: err.message || "Failed to reach AI provider",
    });
  }
}
