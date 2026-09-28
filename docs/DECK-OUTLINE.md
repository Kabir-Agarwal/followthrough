# FollowThrough — deck outline (7 slides)

**Track:** Future of Work & Enterprise Productivity · **AI Builder Cup 2026**
Keep it to 7 slides. One idea per slide. The verifier is the star — give it its own slide.

---

### Slide 1 — Problem
- Meetings end with commitments. Most quietly die: no owner follow-through, no artifact.
- "Action items" in notes ≠ work done. The gap between *deciding* and *doing* is where teams leak.
- One line: **"The meeting ended. Did anything actually happen?"**

### Slide 2 — Who it's for
- Teams that leave meetings with commitments — PMs, leads, ICs, anyone who runs on standups and kickoffs.
- Not another notetaker: it produces the *deliverables*, not just a summary.

### Slide 3 — The 3-pass flow
- Paste notes → **Extract** commitments (owner, action, deadline, source line).
- **Draft** the deliverable for each (email / doc / summary).
- **Verify** — a separate pass. Show the pipeline diagram.
- Everything runs in the browser on Firebase; Gemini via Firebase AI Logic; no server, no key in the page.

### Slide 4 — The differentiator: the verifier
- A second, adversarial Gemini pass that sees **only the original notes + the draft** — never the
  draft's reasoning.
- Returns ACCEPT / REJECT + the **exact source line** it checked against + the mismatch.
- This is the trust layer: it catches invented commitments, wrong owners, and deadlines the notes never stated.
- Tagline: **"Don't trust the draft. Verify it against the notes."**

### Slide 5 — Demo (live)
- Open the receipt view first (strongest visual): claim → draft → verdict → evidence.
- Run a sample; show a green ACCEPT row and the evidence line.
- Then the adversarial input: show a red **REJECT** with the mismatch called out.
- Export the receipt as Markdown.

### Slide 6 — Measured & built right
- Exactly **3 Gemini calls per run** (batched), structured JSON output on every pass.
- Backoff + clear "retrying" state for free-tier limits; **Spark plan, no billing**.
- Unit-tested pure logic (parsing, receipt assembly, export).
- Live latency + the adversarial REJECT from `/evidence`.

### Slide 7 — What's next
- Push accepted drafts straight to Gmail / Docs / Slack with one click.
- Owner reminders + a "still open?" nudge until each commitment closes.
- Team receipt history and a weekly "what we committed vs. what shipped" digest.
- Confidence scores and multi-source (calendar + notes) extraction.
