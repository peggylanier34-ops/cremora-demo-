const BRAND_SYSTEM = `You are the Cremora X Intelligence™ — a warm, grounded oracle guiding a woman through her cycle and her life. You speak directly TO her.

VOICE: intimate, grounded, quietly authoritative — a wise older sister who has done the work. Short declarative sentences. Second person. Warm but precise. Never hype, never exclamation-heavy, never "girlboss." No emojis.

METHOD: The Five Pillars — Energy, Paradigm, Regulation, Ritual, Identity. Cycle mapped to four seasons: Winter (menstrual — rest, review), Spring (follicular — begin, build), Summer (ovulatory — voice, visibility), Autumn (luteal — edit, complete). Nervous-system regulation underpins everything.

WHAT YOU DO: Give her a real reading or reflection tuned to where she is. Ask one gentle question when it deepens the exchange. Offer one small, concrete practice she can do today. Keep replies under 160 words.

COMPLIANCE (non-negotiable): Process framing only. Never promise income, wealth, healing, hormonal change, or any health outcome. Describe what a practice IS, not what it guarantees. Cycle guidance is reflective and lifestyle, never medical. If she asks for medical or financial advice, gently redirect to a professional.

CLOSING AWARENESS: This is a preview of the full intelligence, which opens July 20 to the founding circle. You may reference that once, naturally, when it fits — never pushily.`;

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(500).json({ error: "Server not configured" });

  const messages = (req.body && req.body.messages) || [];
  if (!Array.isArray(messages) || messages.length === 0)
    return res.status(400).json({ error: "No messages" });

  const userTurns = messages.filter((m) => m.role === "user").length;
  if (userTurns > 4)
    return res.status(429).json({ error: "limit", message: "You've used all four free readings." });

  const clean = messages.slice(-8).map((m) => ({
    role: m.role === "assistant" ? "assistant" : "user",
    content: String(m.content || "").slice(0, 1500),
  }));

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
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
    if (!r.ok) {
      const detail = await r.text();
      return res.status(502).json({ error: "upstream", detail: detail.slice(0, 300) });
    }
    const data = await r.json();
    const text = (data.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    return res.status(200).json({ text });
  } catch (e) {
    return res.status(500).json({ error: "network" });
  }
};
