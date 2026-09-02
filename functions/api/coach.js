/**
 * POST /api/coach
 * Server-side proxy to the Anthropic API. Keeps ANTHROPIC_API_KEY out of the
 * browser and gives Nova real, model-generated coaching instead of canned text.
 *
 * Env vars (set in Cloudflare Pages > Settings > Environment variables):
 *   ANTHROPIC_API_KEY  - required
 *   ANTHROPIC_MODEL    - optional, defaults to claude-haiku-4-5-20251001 (fast/cheap)
 *
 * Request body: { type: "recommendation" | "reflection" | "chat", context: {...}, message?: string }
 * Response: { text: string, source: "ai" } on success
 *           { error: string } on failure (client falls back to canned copy)
 */

const SYSTEM_PROMPT = `You are Nova, a warm, upbeat AI fitness coach avatar inside the Kinetic AI Coach app.
Rules:
- Keep replies SHORT: 1-3 sentences, no markdown, no headers, no lists.
- Sound like a real coach speaking out loud, not a chatbot. Encouraging but not cheesy.
- Reference the user's actual goal, mood, energy level, or exercise when relevant.
- Never give medical diagnoses or claim to replace a doctor or physical therapist.
- If a user mentions pain, dizziness, or injury, tell them to stop and rest, and to check with a
  medical professional if it continues - do not push them to keep exercising.
- Never claim credentials you don't have. You are a coaching assistant, not a licensed trainer.
- Do not invent workout science; keep advice general and safe (form cues, pacing, breathing, motivation).`;

function buildPrompt(type, context, message) {
  const c = context || {};
  if (type === "recommendation") {
    return `The user just finished onboarding. Goal: ${c.goal}. Mood: ${c.mood}. Energy: ${c.energy}/100. ` +
      `Duration picked: ${c.duration} minutes. Their workout is called "${c.workoutTitle}" with ${c.exerciseCount} exercises ` +
      `at ${c.intensity} intensity, about ${c.calories} kcal. In 1-2 sentences, tell them why this plan fits how they feel ` +
      `right now, and hype them up to start.`;
  }
  if (type === "reflection") {
    return `The user just completed a workout. Goal: ${c.goal}. Mood going in: ${c.mood}. ` +
      `They completed ${c.completed} exercises and skipped ${c.skipped}, burned about ${c.calories} kcal over ${c.activeMinutes} min. ` +
      `They adjusted difficulty ${c.difficultyAdjustments} time(s). Current streak: ${c.streak} day(s). ` +
      `In 2-3 sentences, give a genuine, specific reflection on this session (not generic praise) and one concrete ` +
      `tip for next time.`;
  }
  // chat
  return `Context: goal=${c.goal}, mood=${c.mood}, energy=${c.energy}/100, current exercise="${c.exerciseName || "n/a"}" ` +
    `(${c.exerciseDesc || ""}). The user just asked Nova: "${message}". Reply directly to their question in 1-3 sentences.`;
}

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.ANTHROPIC_API_KEY) {
    return json({ error: "AI not configured" }, 503);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const { type, ctx, message } = body || {};
  if (!["recommendation", "reflection", "chat"].includes(type)) {
    return json({ error: "Invalid type" }, 400);
  }
  if (type === "chat" && (!message || String(message).length > 500)) {
    return json({ error: "Invalid message" }, 400);
  }

  const prompt = buildPrompt(type, ctx, message);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 9000);

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: env.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001",
        max_tokens: 200,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!resp.ok) {
      return json({ error: `Upstream error ${resp.status}` }, 502);
    }

    const data = await resp.json();
    const text = (data.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join(" ")
      .trim();

    if (!text) return json({ error: "Empty response" }, 502);

    return json({ text, source: "ai" }, 200);
  } catch (err) {
    return json({ error: "AI request failed" }, 504);
  }
}

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
