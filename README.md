# FollowThrough — meeting commitments, verified

**Live demo:** https://followthrough-56f12.web.app
**Built entirely during the AI Builder Cup 2026 window.** No pre-existing code was reused.

Meetings end with commitments that quietly die. FollowThrough turns raw meeting notes into
a **drafted deliverable for every commitment** — and, crucially, runs a **separate AI
verifier** that checks each draft against the exact source line before you trust it. You get
a one-screen *receipt*: claim → draft → verifier verdict → evidence line, exportable as Markdown.

## Theme & problem statement

**Theme: Future of Work & Enterprise Productivity.**

> "Build an AI-powered solution that transforms how individuals and organizations access
> knowledge, collaborate, make decisions, and **complete everyday work**."
> — AI Builder Cup 2026, Future of Work theme

FollowThrough targets the "complete everyday work" clause: the gap between *deciding* something
in a meeting and it actually getting done.

## What makes it different: the verifier

Most "AI notetaker" tools stop at generating text. FollowThrough adds a **third, adversarial
pass** whose only job is to catch the model's own mistakes:

1. **Extract** — Gemini reads the notes and returns structured commitments
   (`owner, action, deadline, source_line`) as JSON.
2. **Draft** — Gemini drafts the deliverable (email / doc / summary) for each commitment.
3. **Verify** — a **separate strict prompt** receives *only* the original notes + the drafts
   (never the draft's own reasoning) and returns per-item `ACCEPT` / `REJECT`, the exact
   source line it checked against, and the mismatch if any.

The verifier is what turns "the AI wrote something" into "the AI wrote something **and a second
AI confirmed it matches the notes**." Contradictions, invented commitments, and wrong deadlines
get `REJECT`ed with the evidence line shown.

## Architecture

- **100% client-side** on **Firebase Hosting** — no server, no backend to run.
- **Gemini via Firebase AI Logic** (Gemini Developer API provider) — the browser calls Gemini
  through Firebase's broker, so **no Gemini API key is ever in the page**. The only key in the
  client is the public Firebase Web config key (a client identifier, not a secret — see
  [`public/config.js`](public/config.js)).
- **Model:** `gemini-3.8-flash` (free-tier flash-class), using **structured JSON output**
  (`responseMimeType: application/json` + `responseSchema`) on every pass.
- **Resilience:** exponential backoff on rate-limit / transient overload (429/500/503), with a
  visible "retrying…" state; empty/incomplete structured results are retried too.
- **Cost:** stays on the Firebase **Spark (free) plan — no billing account linked.**

```
notes ──▶ [A: extract] ──▶ commitments ──▶ [B: draft] ──▶ drafts
                                   │                          │
                                   └──────────┬───────────────┘
                                              ▼
                      [C: verify]  (sees ONLY notes + drafts)
                                              ▼
                          receipt: claim → draft → verdict → evidence
```

## Run it locally

Static site — no build step.

```bash
git clone https://github.com/Kabir-Agarwal/<repo>.git
cd <repo>
# any static server works, e.g.:
npx serve public        # then open the printed URL
# or use the Firebase CLI:
npx firebase-tools serve --only hosting
```

Firebase AI Logic authorizes `localhost` automatically, so the AI passes work locally.

### Tests

```bash
node --test        # unit tests for JSON parsing, receipt assembly, Markdown export
```

## How it was deployed

```bash
firebase deploy --only hosting --project followthrough-56f12
```

Project `followthrough-56f12` on the **Spark plan** (billing = none). Firebase AI Logic enabled
with the **Gemini Developer API** provider (free tier — the Vertex AI provider, which needs
billing, was deliberately not used).

## Measured numbers

- **Gemini calls per run:** exactly **3** (extract + draft + verify), independent of how many
  commitments the notes contain — each pass batches all items in one request.
- **Free-tier limit:** the Gemini free tier allows **20 `generateContent` requests/day per
  model** per project. At 3 calls/run that is ~6 full runs/day shared across all visitors — the
  accepted trade-off of the "no card, no billing" constraint. The UI shows a clear message when
  the daily limit is reached.
- **Latency & adversarial verification evidence:** captured in [`/evidence`](evidence/) from
  live runs on both sample files plus an adversarial input where the verifier correctly
  `REJECT`s a draft that contradicts the notes.

## Layout

```
public/          the app (index.html, app.js, logic.js, styles.css, config.js)
samples/         two sample inputs + one adversarial input
tests/           node:test unit tests for the pure logic
evidence/        live-run outputs (both samples + the adversarial REJECT)
docs/            deck outline + video script
```
