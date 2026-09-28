import { initializeApp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";
import { getAI, getGenerativeModel, GoogleAIBackend, Schema }
  from "https://www.gstatic.com/firebasejs/12.3.0/firebase-ai.js";
import { firebaseConfig, MODEL } from "./config.js?v=8";
import { extractJson, assembleReceipt, summarize, receiptToMarkdown } from "./logic.js?v=8";

const app = initializeApp(firebaseConfig);
// GoogleAIBackend = the Gemini Developer API provider = free tier, no billing.
const ai = getAI(app, { backend: new GoogleAIBackend() });

// ---- structured-output schemas -------------------------------------------------
const extractSchema = Schema.object({
  properties: {
    commitments: Schema.array({
      items: Schema.object({
        properties: {
          id: Schema.string(),
          owner: Schema.string(),
          action: Schema.string(),
          deadline: Schema.string(),
          source_line: Schema.string(),
        },
        optionalProperties: ["deadline"],
      }),
    }),
  },
});
const draftSchema = Schema.object({
  properties: {
    drafts: Schema.array({
      items: Schema.object({
        properties: {
          id: Schema.string(),
          type: Schema.string(),
          subject: Schema.string(),
          body: Schema.string(),
        },
      }),
    }),
  },
});
const verifySchema = Schema.object({
  properties: {
    verdicts: Schema.array({
      items: Schema.object({
        properties: {
          id: Schema.string(),
          verdict: Schema.string(),        // "ACCEPT" | "REJECT"
          evidence_line: Schema.string(),
          mismatch: Schema.string(),
        },
        optionalProperties: ["mismatch"],
      }),
    }),
  },
});

function model(schema) {
  return getGenerativeModel(ai, {
    model: MODEL,
    generationConfig: { responseMimeType: "application/json", responseSchema: schema },
  });
}

// ---- rate-limit backoff --------------------------------------------------------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const DELAYS = [1500, 3000, 6000, 12000, 20000];
// Free-tier / new-model transients worth retrying: rate limits (429) AND server
// overload (500/503 "high demand", "try again", "unavailable", "overloaded").
function isTransient(err) {
  const m = (err && (err.message || String(err))) || "";
  return /\b(429|500|503)\b|rate|quota|resource[- ]?exhausted|overload|unavailable|high demand|try again|internal error|timeout/i.test(m);
}
function stateFor(msg) { return /rate|quota|429/i.test(msg) ? "rate-limited" : "model busy"; }

// Returns raw model text, retrying transient failures with backoff.
async function callWithBackoff(m, prompt, onState) {
  for (let attempt = 0; ; attempt++) {
    try {
      return (await m.generateContent(prompt)).response.text();
    } catch (err) {
      if (isTransient(err) && attempt < DELAYS.length) {
        onState && onState(`${stateFor(err.message || "")}, retrying in ${DELAYS[attempt] / 1000}s…`);
        await sleep(DELAYS[attempt]);
        continue;
      }
      throw err;
    }
  }
}

// Parse + validate a JSON pass, retrying transient errors AND empty/invalid results
// (a flaky model under load sometimes returns an empty structured object).
async function callJSON(m, prompt, onState, validate) {
  for (let attempt = 0; ; attempt++) {
    try {
      const obj = extractJson(await (async () => (await m.generateContent(prompt)).response.text())());
      if (validate && !validate(obj)) {
        if (attempt < DELAYS.length) { onState && onState(`incomplete result, retrying in ${DELAYS[attempt] / 1000}s…`); await sleep(DELAYS[attempt]); continue; }
      }
      return obj;
    } catch (err) {
      if (isTransient(err) && attempt < DELAYS.length) {
        onState && onState(`${stateFor(err.message || "")}, retrying in ${DELAYS[attempt] / 1000}s…`);
        await sleep(DELAYS[attempt]);
        continue;
      }
      throw err;
    }
  }
}

// ---- the three passes ----------------------------------------------------------
const EXTRACT_PROMPT = (notes) => `You extract concrete commitments from meeting notes.
A commitment is a specific thing a named person agreed to do. Ignore vague talk.
For each, return: id (c1, c2, …), owner (the person), action (what they will do),
deadline (verbatim if stated, else ""), and source_line (the EXACT line from the notes
that states it — copied character for character, no paraphrase).
Return JSON only.

NOTES:
"""${notes}"""`;

const DRAFT_PROMPT = (commitments) => `For each commitment, draft the deliverable that
fulfils it. Choose type = "email", "doc", or "summary" to fit the action. Write a ready-to-send
subject and body in the owner's voice. Keep it concise and professional. Do not invent facts
beyond the commitment. Return JSON only.

COMMITMENTS:
${JSON.stringify(commitments, null, 2)}`;

const VERIFY_PROMPT = (notes, drafts) => `You are a strict verifier. You receive the ORIGINAL
notes and a set of drafts. For each draft decide whether it is faithful to the notes:
- verdict "ACCEPT" if every claim in the draft is supported by the notes and it matches the
  owner, action and any deadline stated there.
- verdict "REJECT" if the draft contradicts the notes, invents a commitment, changes the owner,
  or states a deadline the notes do not.
Return, per id: verdict, evidence_line (the EXACT line from the notes you checked against), and
mismatch (one sentence naming the contradiction, or "" if ACCEPT). Judge only against the notes
below — you are not told how the drafts were produced. Return JSON only.

ORIGINAL NOTES:
"""${notes}"""

DRAFTS:
${JSON.stringify(drafts, null, 2)}`;

export async function runFlow(notes, onState) {
  const t0 = performance.now();
  let calls = 0, rateLimited = false, retried = false;
  const trackState = (msg) => {
    if (/rate-limited/.test(msg)) rateLimited = true;
    if (/retrying/.test(msg)) retried = true;
    onState && onState(msg);
  };

  onState && onState("Pass A — extracting commitments…");
  calls++;
  const commitments = (await callJSON(model(extractSchema), EXTRACT_PROMPT(notes), trackState,
    (o) => Array.isArray(o.commitments) && o.commitments.length > 0)).commitments || [];
  if (commitments.length === 0) throw new Error("No commitments found in the notes.");

  onState && onState(`Pass B — drafting ${commitments.length} deliverable(s)…`);
  calls++;
  const drafts = (await callJSON(model(draftSchema), DRAFT_PROMPT(commitments), trackState,
    (o) => Array.isArray(o.drafts) && o.drafts.length > 0)).drafts || [];

  onState && onState("Pass C — verifying drafts against the notes…");
  calls++;
  const verdicts = (await callJSON(model(verifySchema), VERIFY_PROMPT(notes, drafts), trackState,
    (o) => Array.isArray(o.verdicts) && o.verdicts.length > 0)).verdicts || [];

  const receipt = assembleReceipt(commitments, drafts, verdicts);
  const seconds = (performance.now() - t0) / 1000;
  return { receipt, stats: { calls, seconds: Number(seconds.toFixed(1)), rateLimited, retried, ...summarize(receipt) } };
}

// ---- DOM wiring ----------------------------------------------------------------
const $ = (id) => document.getElementById(id);
let lastReceipt = null, lastMeta = null;

function setStatus(msg, kind = "info") {
  const el = $("status");
  el.textContent = msg;
  el.className = `status ${kind}`;
}

function render(receipt, stats) {
  const s = summarize(receipt);
  $("summary").innerHTML =
    `<strong>${s.accepted}/${s.total}</strong> accepted by the verifier · ${s.rejected} rejected ` +
    `· ${stats.calls} Gemini calls · ${stats.seconds}s${stats.rateLimited ? " · hit rate limit (retried)" : stats.retried ? " · retried on transient load" : ""}`;
  const cards = receipt.map((r, i) => {
    const cls = r.verdict === "ACCEPT" ? "accept" : r.verdict === "REJECT" ? "reject" : "unknown";
    return `<article class="card ${cls}">
      <header><span class="badge ${cls}">${r.verdict}</span>
        <h3>${escapeHtml(r.action) || "(no action)"}</h3></header>
      <dl>
        <dt>Owner</dt><dd>${escapeHtml(r.owner) || "—"}</dd>
        <dt>Deadline</dt><dd>${escapeHtml(r.deadline) || "—"}</dd>
        <dt>Claimed from</dt><dd class="src">${escapeHtml(r.source_line) || "—"}</dd>
      </dl>
      <div class="draft"><span class="dtype">${escapeHtml(r.draft_type) || "draft"}</span>
        <strong>${escapeHtml(r.draft_subject)}</strong>
        <pre>${escapeHtml(r.draft_body)}</pre></div>
      <div class="verdict-detail">Verifier checked against:
        <span class="src">${escapeHtml(r.evidence_line) || "—"}</span>
        ${r.verdict === "REJECT" && r.mismatch ? `<p class="mismatch">⚠ ${escapeHtml(r.mismatch)}</p>` : ""}</div>
    </article>`;
  }).join("");
  $("receipt").innerHTML = cards;
  $("export-btn").disabled = false;
}

function escapeHtml(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

async function go() {
  const notes = $("notes").value.trim();
  if (!notes) { setStatus("Paste some notes first.", "error"); return; }
  $("run-btn").disabled = true;
  $("export-btn").disabled = true;
  $("receipt").innerHTML = "";
  $("summary").textContent = "";
  try {
    const { receipt, stats } = await runFlow(notes, (m) => setStatus(m, "info"));
    lastReceipt = receipt;
    lastMeta = { title: $("sample-name").textContent || "pasted notes", model: MODEL, generatedAt: new Date().toISOString() };
    render(receipt, stats);
    setStatus(`Done — ${stats.accepted}/${stats.total} accepted in ${stats.seconds}s.`, "ok");
  } catch (err) {
    console.error(err);
    const m = (err && err.message) || String(err);
    const friendly = /quota|free_tier|exceeded your current quota/i.test(m)
      ? "Free-tier daily limit reached (Gemini free tier = 20 requests/day per model). It resets at midnight Pacific — please try again later."
      : "Error: " + m;
    setStatus(friendly, "error");
  } finally {
    $("run-btn").disabled = false;
  }
}

function exportMd() {
  if (!lastReceipt) return;
  const md = receiptToMarkdown(lastReceipt, lastMeta || { model: MODEL });
  const blob = new Blob([md], { type: "text/markdown" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "follow-through-receipt.md";
  a.click();
  URL.revokeObjectURL(a.href);
}

async function loadSample(path, label) {
  try {
    const txt = await (await fetch(path)).text();
    $("notes").value = txt;
    $("sample-name").textContent = label;
    setStatus(`Loaded sample: ${label}`, "info");
  } catch {
    setStatus("Could not load sample.", "error");
  }
}

// Verify-only path, used to prove the verifier REJECTS a draft that contradicts the notes.
export async function verifyOnly(notes, drafts, onState) {
  const txt = await callWithBackoff(model(verifySchema), VERIFY_PROMPT(notes, drafts), onState);
  return extractJson(txt).verdicts || [];
}
// Exposed for evidence capture from the browser console (see /evidence).
window.__ft = {
  runFlow, verifyOnly, MODEL,
  rawExtract: (notes) => model(extractSchema).generateContent(EXTRACT_PROMPT(notes)).then((r) => r.response.text()),
  rawDraft: (c) => model(draftSchema).generateContent(DRAFT_PROMPT(c)).then((r) => r.response.text()),
};

$("model-name").textContent = MODEL;
$("run-btn").addEventListener("click", go);
$("export-btn").addEventListener("click", exportMd);
$("sample1-btn").addEventListener("click", () => loadSample("../samples/standup-notes.txt", "standup-notes.txt"));
$("sample2-btn").addEventListener("click", () => loadSample("../samples/project-kickoff.txt", "project-kickoff.txt"));
// Ctrl/Cmd+Enter runs the flow.
$("notes").addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); go(); }
});
