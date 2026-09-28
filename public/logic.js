// Pure, side-effect-free helpers: JSON parsing, receipt assembly, Markdown export,
// run stats. No Firebase, no DOM — so Node can unit-test this file directly.

// Models sometimes wrap JSON in ```json fences or add prose. Pull out the first
// balanced JSON value and parse it.
export function extractJson(text) {
  if (text == null) throw new Error("empty model response");
  let s = String(text).trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  try {
    return JSON.parse(s);
  } catch {
    // fall back to the first {...} or [...] span
    const start = s.search(/[[{]/);
    if (start === -1) throw new Error("no JSON found in model response");
    const open = s[start];
    const close = open === "{" ? "}" : "]";
    let depth = 0, inStr = false, esc = false;
    for (let i = start; i < s.length; i++) {
      const c = s[i];
      if (inStr) {
        if (esc) esc = false;
        else if (c === "\\") esc = true;
        else if (c === '"') inStr = false;
      } else if (c === '"') inStr = true;
      else if (c === open) depth++;
      else if (c === close) {
        depth--;
        if (depth === 0) return JSON.parse(s.slice(start, i + 1));
      }
    }
    throw new Error("unterminated JSON in model response");
  }
}

// Join the three passes by commitment id into one receipt row list. Robust to a
// pass that dropped or reordered an id: missing pieces become nulls, never a crash.
export function assembleReceipt(commitments, drafts, verdicts) {
  const draftById = new Map((drafts || []).map((d) => [d.id, d]));
  const verdictById = new Map((verdicts || []).map((v) => [v.id, v]));
  return (commitments || []).map((c) => {
    const d = draftById.get(c.id) || null;
    const v = verdictById.get(c.id) || null;
    return {
      id: c.id,
      owner: c.owner || "",
      action: c.action || "",
      deadline: c.deadline || "",
      source_line: c.source_line || "",
      draft_type: d ? d.type || "" : "",
      draft_subject: d ? d.subject || "" : "",
      draft_body: d ? d.body || "" : "",
      verdict: v ? (v.verdict || "UNKNOWN") : "UNKNOWN",
      evidence_line: v ? v.evidence_line || "" : "",
      mismatch: v ? v.mismatch || "" : "",
    };
  });
}

export function summarize(receipt) {
  const total = receipt.length;
  const accepted = receipt.filter((r) => r.verdict === "ACCEPT").length;
  const rejected = receipt.filter((r) => r.verdict === "REJECT").length;
  return { total, accepted, rejected };
}

export function receiptToMarkdown(receipt, meta = {}) {
  const s = summarize(receipt);
  const lines = [];
  lines.push(`# Follow-Through Receipt`);
  if (meta.title) lines.push(`**Source:** ${meta.title}`);
  if (meta.model) lines.push(`**Model:** ${meta.model}`);
  if (meta.generatedAt) lines.push(`**Generated:** ${meta.generatedAt}`);
  lines.push("");
  lines.push(`**${s.accepted}/${s.total} accepted** by the verifier · ${s.rejected} rejected`);
  lines.push("");
  receipt.forEach((r, i) => {
    lines.push(`## ${i + 1}. ${r.action || "(no action)"} — ${r.verdict}`);
    lines.push(`- **Owner:** ${r.owner || "—"}`);
    lines.push(`- **Deadline:** ${r.deadline || "—"}`);
    lines.push(`- **Source line:** ${r.source_line || "—"}`);
    lines.push(`- **Draft (${r.draft_type || "—"}):** ${r.draft_subject || ""}`);
    if (r.draft_body) {
      lines.push("");
      lines.push("  > " + r.draft_body.replace(/\n/g, "\n  > "));
      lines.push("");
    }
    lines.push(`- **Verifier:** ${r.verdict}` + (r.evidence_line ? ` — checked against: "${r.evidence_line}"` : ""));
    if (r.verdict === "REJECT" && r.mismatch) lines.push(`- **Mismatch:** ${r.mismatch}`);
    lines.push("");
  });
  return lines.join("\n");
}
