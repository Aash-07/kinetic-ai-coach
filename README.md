# Kinetic AI Coach — Nova

A voice-of-a-friend, text-first AI fitness coach with an animated avatar ("Nova") that builds a
personalized workout, talks you through it live, adapts on the fly, and reflects on your session
afterward — all backed by real Claude API calls, not scripted text.

## What's actually AI here (and what isn't, on purpose)

| Moment | Powered by |
|---|---|
| Workout plan selection (which exercises, how many, intensity) | Deterministic rules engine (fast, free, no latency during onboarding) |
| "Why this plan fits you today" blurb on the recommendation screen | **Live Claude API call**, personalized to goal/mood/energy/duration |
| "Ask Nova" chat during a workout (form questions, motivation, adapting) | **Live Claude API call**, grounded in current exercise + user context |
| Post-workout reflection ("Nova's take on your session") | **Live Claude API call**, references actual performance (calories, skips, streak) |
| In-the-moment micro-messages during exercise transitions (every few seconds) | Local canned copy — intentional, to avoid latency/cost on a tight timer loop |

Every AI moment shows a **"✨ Live AI" / "📋 Offline mode"** badge so users always know whether
they're getting a live model response or a safe local fallback (transparency ground rule). If the
API is slow, down, or not configured, the app never breaks — it silently falls back to the
original scripted copy.

## Architecture

```
Browser (index.html / app.js / styles.css)
   │
   ├─ POST /api/coach   → Cloudflare Pages Function → Anthropic Messages API
   │                       (ANTHROPIC_API_KEY stays server-side, never shipped to client)
   │
   └─ POST /api/track   → Cloudflare Pages Function → Cloudflare KV (TRACTION_KV)
        GET  /api/stats  →                              (usage/demand/value events)
```

This keeps the API key off the client (a raw client-side fetch to api.anthropic.com would leak
the key to anyone who opens devtools) and gives you a real events log for the traction section of
your deck.

## Deploy (Cloudflare Pages)

1. Push this folder to a GitHub repo, connect it in Cloudflare Pages (Framework preset: "None",
   build command: none, output directory: `/`).
2. In **Pages → Settings → Environment variables**, add:
   - `ANTHROPIC_API_KEY` — your Anthropic API key
   - `ANTHROPIC_MODEL` — optional, defaults to `claude-haiku-4-5-20251001`
   - `STATS_KEY` — any secret string, used to protect `/api/stats`
3. In **Pages → Settings → Functions → KV namespace bindings**, create/bind a KV namespace named
   `TRACTION_KV`. (Skip this and the app still works — analytics calls just no-op.)
4. Redeploy. Visit `/api/stats?key=YOUR_STATS_KEY` any time to pull aggregate numbers for slides.

No key, no KV? The app still fully works — it just runs Nova in offline/scripted mode and skips
logging events, so you can demo it anywhere (including `file://`) without breaking.

## Events tracked (traction signal)

`app_opened`, `onboarding_started`, `onboarding_completed`, `workout_started`,
`exercise_completed`, `exercise_skipped`, `difficulty_adjusted`, `break_taken`,
`workout_completed`, `chat_message_sent`, `feedback_submitted`, `waitlist_joined`

`feedback_submitted` carries a 1–5 star rating + free-text comment (value/quality signal).
`waitlist_joined` carries an email for a paid "Nova Pro" tier (demand signal).

## Before you submit

1. Deploy with a real key + KV bound, so the AI and tracking are actually live.
2. Get **at least a handful of real people** to run through a full workout (friends, a fitness
   Discord/subreddit, classmates). Aim for double-digit sessions if you can — that's what turns
   this into "evidence of traction," not just a working demo.
3. Pull numbers from `/api/stats?key=...` right before the deadline and drop them into the deck.
4. Fill in the `[FILL IN]` placeholders in `submission-deck.md` with your real numbers, screenshots,
   and 2–3 direct user quotes (with permission).
