// Unit tests for the pure logic. Run: node --test
// No framework, no network — just node:test + node:assert.
import { test } from "node:test";
import assert from "node:assert/strict";
import { extractJson, assembleReceipt, summarize, receiptToMarkdown } from "../public/logic.js";

test("extractJson parses raw JSON", () => {
  assert.deepEqual(extractJson('{"a":1}'), { a: 1 });
});

test("extractJson strips ```json fences", () => {
  const s = "```json\n{\"commitments\":[{\"id\":\"c1\"}]}\n```";
  assert.deepEqual(extractJson(s), { commitments: [{ id: "c1" }] });
});

test("extractJson recovers JSON embedded in prose", () => {
  const s = 'Sure! Here you go: {"x": [1,2,3]} — hope that helps.';
  assert.deepEqual(extractJson(s), { x: [1, 2, 3] });
});

test("extractJson throws on non-JSON", () => {
  assert.throws(() => extractJson("no json here"));
  assert.throws(() => extractJson(null));
});

test("assembleReceipt joins the three passes by id", () => {
  const commitments = [{ id: "c1", owner: "Priya", action: "send deck", deadline: "Thu", source_line: "Priya said she'll send the deck by Thu" }];
  const drafts = [{ id: "c1", type: "email", subject: "Pricing deck", body: "Hi team, attached." }];
  const verdicts = [{ id: "c1", verdict: "ACCEPT", evidence_line: "Priya said she'll send the deck by Thu", mismatch: "" }];
  const r = assembleReceipt(commitments, drafts, verdicts);
  assert.equal(r.length, 1);
  assert.equal(r[0].owner, "Priya");
  assert.equal(r[0].draft_type, "email");
  assert.equal(r[0].verdict, "ACCEPT");
  assert.equal(r[0].evidence_line, "Priya said she'll send the deck by Thu");
});

test("assembleReceipt tolerates a missing draft or verdict", () => {
  const commitments = [{ id: "c1", action: "do thing" }, { id: "c2", action: "other thing" }];
  const drafts = [{ id: "c1", type: "doc", subject: "s", body: "b" }]; // c2 missing
  const verdicts = [{ id: "c2", verdict: "REJECT", evidence_line: "line", mismatch: "no source" }]; // c1 missing
  const r = assembleReceipt(commitments, drafts, verdicts);
  assert.equal(r[0].draft_type, "doc");
  assert.equal(r[0].verdict, "UNKNOWN"); // c1 had no verdict
  assert.equal(r[1].draft_type, "");     // c2 had no draft
  assert.equal(r[1].verdict, "REJECT");
});

test("summarize counts accept/reject", () => {
  const r = [{ verdict: "ACCEPT" }, { verdict: "REJECT" }, { verdict: "ACCEPT" }];
  assert.deepEqual(summarize(r), { total: 3, accepted: 2, rejected: 1 });
});

test("receiptToMarkdown includes verdicts, evidence and mismatch", () => {
  const r = assembleReceipt(
    [{ id: "c1", owner: "Marcus", action: "fix test", deadline: "EOW", source_line: "Marcus agreed to fix the test by EOW" }],
    [{ id: "c1", type: "email", subject: "PR", body: "Opened." }],
    [{ id: "c1", verdict: "REJECT", evidence_line: "Marcus agreed to fix the test by EOW", mismatch: "Draft claims it is already merged." }],
  );
  const md = receiptToMarkdown(r, { title: "notes", model: "gemini-2.5-flash", generatedAt: "2026-01-01" });
  assert.match(md, /Follow-Through Receipt/);
  assert.match(md, /REJECT/);
  assert.match(md, /Marcus agreed to fix the test by EOW/);
  assert.match(md, /Mismatch:.*already merged/);
  assert.match(md, /0\/1 accepted/);
});
