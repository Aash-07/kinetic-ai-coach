/**
 * POST /api/track
 * Lightweight event logger for traction metrics (usage, demand, value events).
 * Writes to a Cloudflare KV namespace bound as TRACTION_KV.
 *
 * If no KV binding exists (e.g. local/static preview), this silently no-ops
 * with a 200 so the app never breaks because analytics is unavailable.
 *
 * Body: { event: string, anonId: string, data?: object }
 */

const ALLOWED_EVENTS = new Set([
  "app_opened",
  "onboarding_started",
  "onboarding_completed",
  "workout_started",
  "exercise_completed",
  "exercise_skipped",
  "difficulty_adjusted",
  "break_taken",
  "workout_completed",
  "chat_message_sent",
  "feedback_submitted",
  "waitlist_joined",
  "share_clicked",
]);

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Invalid JSON" }, 400);
  }

  const { event, anonId, data } = body || {};
  if (!ALLOWED_EVENTS.has(event)) {
    return json({ ok: false, error: "Unknown event" }, 400);
  }

  if (!env.TRACTION_KV) {
    // No KV bound yet - accept silently so the client experience is unaffected.
    return json({ ok: true, stored: false });
  }

  const record = {
    event,
    anonId: String(anonId || "unknown").slice(0, 64),
    data: data && typeof data === "object" ? data : {},
    ts: Date.now(),
    ip: request.headers.get("cf-connecting-ip") || "",
  };

  const key = `evt:${Date.now()}:${crypto.randomUUID()}`;
  await env.TRACTION_KV.put(key, JSON.stringify(record), {
    expirationTtl: 60 * 60 * 24 * 90, // 90 days
  });

  // Maintain a rolling counter per event type for cheap dashboard reads.
  const counterKey = `count:${event}`;
  const current = parseInt((await env.TRACTION_KV.get(counterKey)) || "0", 10);
  await env.TRACTION_KV.put(counterKey, String(current + 1));

  return json({ ok: true, stored: true });
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
