# FollowThrough — video script (< 3 minutes)

For the owner to record. Screen-record the live site: https://followthrough-56f12.web.app
Open on the **receipt view** if you can (run a sample just before recording so a result is on screen).
Target: 2:30. Narration is in quotes; [actions] are what to click.

---

**[0:00–0:20] Hook — open on a filled receipt**
> "Every meeting ends the same way: people commit to things, and half of them quietly die.
> This is FollowThrough. Paste your meeting notes, and it doesn't just summarize them — it
> drafts every deliverable, and then a second AI verifies each one against what was actually said."

[Have the receipt from a sample run already on screen. Slowly scroll it.]

**[0:20–0:45] The input**
> "It runs entirely in the browser on Firebase — no server, no API key in the page. Gemini is
> brokered through Firebase AI Logic, on the free tier."

[Click "Load sample: standup". Point at the notes textarea. Point at "model: gemini-3.8-flash".]

**[0:45–1:20] Run the three passes**
> "One click. Pass A extracts the commitments — who owns what, by when, and the exact line it came
> from. Pass B drafts the deliverable for each. Pass C is the important one."

[Click Run. Narrate the status line as it moves through Pass A → B → C.]

**[1:20–2:00] The verifier — the differentiator**
> "The verifier is a separate, strict pass. It only sees the original notes and the drafts — never
> the reasoning that produced them. For each item it returns ACCEPT or REJECT, and it shows the
> exact source line it checked against."

[Point at a green ACCEPT card and its "checked against" evidence line.]

**[2:00–2:25] The adversarial catch**
> "Here's why that matters. Feed it a draft that contradicts the notes —"

[Load the adversarial sample / show the pre-recorded adversarial run.]

> "— and the verifier catches it: REJECT, with the mismatch spelled out. That's the trust layer
> most AI tools skip."

[Point at the red REJECT card and the mismatch line.]

**[2:25–2:40] Close**
> "Export the whole receipt as Markdown and send it out. FollowThrough: meetings end, work
> actually gets done — and verified. Built on Google Cloud with Gemini and Firebase, for the
> AI Builder Cup."

[Click "Export receipt (.md)". Show the downloaded file. End on the receipt.]

---
**Recording tips**
- Do a full run just before recording so the demo isn't waiting on the model (and to avoid the
  free-tier daily limit mid-take).
- If you see a "free-tier daily limit" message, the day's 20 requests are used up — wait for the
  Pacific-midnight reset, then record.
- Keep the browser zoom high enough that the evidence lines are readable on video.
