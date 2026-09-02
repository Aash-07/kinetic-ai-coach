/**
 * GET /api/stats?key=YOUR_STATS_KEY
 * Returns aggregate event counters + the most recent feedback/waitlist entries,
 * for pulling numbers into the submission deck. Protected by a shared secret
 * (env.STATS_KEY) so it isn't public.
 */

const COUNTER_EVENTS = [
  "app_opened",
  "onboarding_started",
  "onboarding_completed",
  "workout_started",
  "workout_completed",
  "chat_message_sent",
  "feedback_submitted",
  "waitlist_joined",
  "share_clicked",
];

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const key = url.searchParams.get("key");

  if (!env.STATS_KEY || key !== env.STATS_KEY) {
    return json({ error: "Unauthorized" }, 401);
  }
  if (!env.TRACTION_KV) {
    return json({ error: "No KV bound" }, 503);
  }

  const counts = {};
  for (const ev of COUNTER_EVENTS) {
    counts[ev] = parseInt((await env.TRACTION_KV.get(`count:${ev}`)) || "0", 10);
  }

  // Pull the most recent ~50 raw events (KV list, newest keys sort last since
  // they're timestamp-prefixed) for feedback/waitlist review.
  const list = await env.TRACTION_KV.list({ prefix: "evt:", limit: 1000 });
  const keys = list.keys.map((k) => k.name).sort().reverse().slice(0, 200);
  const events = [];
  for (const k of keys) {
    const raw = await env.TRACTION_KV.get(k);
    if (raw) events.push(JSON.parse(raw));
  }

  const feedback = events.filter((e) => e.event === "feedback_submitted");
  const waitlist = events.filter((e) => e.event === "waitlist_joined");
  const uniqueUsers = new Set(events.map((e) => e.anonId)).size;

  return json({
    counts,
    uniqueUsers,
    avgRating:
      feedback.length > 0
        ? (feedback.reduce((s, f) => s + (f.data.rating || 0), 0) / feedback.length).toFixed(2)
        : null,
    recentFeedback: feedback.slice(0, 20),
    recentWaitlist: waitlist.slice(0, 20),
  });
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
