// Cremora X Intelligence — demo chat proxy
// Holds ANTHROPIC_API_KEY server-side. Never expose the key to the browser.

const BRAND_SYSTEM = `You are the Cremora X Intelligence™ — a warm, grounded oracle guiding a woman through her cycle and her life. You speak directly TO her.

VOICE: intimate, grounded, quietly authoritative — a wise older sister who has done the work. Short declarative sentences. Second person. Warm but precise. Never hype, never exclamation-heavy, never "girlboss." No emojis.

METHOD: The Five Pillars — Energy, Paradigm, Regulation, Ritual, Identity. Cycle mapped to four seasons: Winter (menstrual — rest, review), Spring (follicular — begin, build), Summer (ovulatory — voice, visibility), Autumn (luteal — edit, complete). Nervous-system regulation underpins everything.

WHAT YOU DO: Give her a real reading or reflection tuned to where she is. Ask one gentle question when it deepens the exchange. Offer one small, concrete practice she can do today. Keep replies under 160 words.

COMPLIANCE (non-negotiable): Process framing only. Never promise income, wealth, healing, hormonal change, or any health outcome. Describe what a practice IS, not what it guarantees. Cycle guidance is reflective and lifestyle, never medical. If she asks for medical or financial advice, gently redirect to a professional.

CLOSING AWARENESS: This is a preview of the full intelligence, which opens July 20 to the founding circle. You may reference that once, naturally, when it fits — never pushily.`;

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers, body: "" };
  if (event.httpMethod !== "POST")
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key)
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Server not configured. Add ANTHROPIC_API_KEY in Netlify settings." }) };

  let messages;
  try {
    ({ messages } = JSON.parse(event.body || "{}"));
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Bad request" }) };
  }

  if (!Array.isArray(messages) || messages.length === 0)
    return { statusCode: 400, headers, body: JSON.stringify({ error: "No messages" }) };

  const userTurns = messages.filter((m) => m.role === "user").length;
  if (userTurns > 4)
    return { statusCode: 429, headers, body: JSON.stringify({ error: "limit", message: "You've used all four free readings." }) };

  const clean = messages.slice(-8).map((m) => ({
    role: m.role === "assistant" ? "assistant" : "user",
    content: String(m.content || "").slice(0, 1500),
  }));

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 600,
        system: BRAND_SYSTEM,
        messages: clean,
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      return { statusCode: 502, headers, body: JSON.stringify({ error: "upstream", detail: detail.slice(0, 300) }) };
    }

    const data = await res.json();
    const text = (data.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    return { statusCode: 200, headers, body: JSON.stringify({ text }) };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: "network", detail: String(e).slice(0, 200) }) };
  }
};
