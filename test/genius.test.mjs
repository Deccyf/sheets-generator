/* Golden test: the new build's Genius pipeline must reproduce the frozen
   legacy build's output exactly, structure for structure. */
import test from "node:test";
import assert from "node:assert/strict";
import { legacy, built, norm } from "./helpers/compare.mjs";
import { makePdf, SUMMARY_LINES, DETAIL_LINES } from "./helpers/synth.mjs";

function pdfs(ctx) {
  return [makePdf(SUMMARY_LINES, ctx.fflate), makePdf(DETAIL_LINES, ctx.fflate)];
}

test("pdfText is unchanged", () => {
  const L = legacy(), N = built();
  for (const lines of [SUMMARY_LINES, DETAIL_LINES]) {
    const pdf = makePdf(lines, L.fflate);
    assert.equal(N.GENIUS.pdfText(pdf), L.GENIUS.pdfText(pdf));
  }
});

test("parseSummary / parseDetail are unchanged", () => {
  const L = legacy(), N = built();
  const sumTxt = L.GENIUS.pdfText(makePdf(SUMMARY_LINES, L.fflate));
  const detTxt = L.GENIUS.pdfText(makePdf(DETAIL_LINES, L.fflate));
  assert.deepEqual(norm(N.GENIUS.parseSummary(sumTxt)), norm(L.GENIUS.parseSummary(sumTxt)));
  assert.deepEqual(norm(N.GENIUS.parseDetail(detTxt)), norm(L.GENIUS.parseDetail(detTxt)));
});

test("stop collapsing and berth boundaries are unchanged", () => {
  const L = legacy(), N = built();
  const det = L.GENIUS.parseDetail(L.GENIUS.pdfText(makePdf(DETAIL_LINES, L.fflate)));
  for (const [, diags] of det) {
    for (const [diag, raw] of diags) {
      const sL = L.GENIUS._stopsOf(raw), sN = N.GENIUS._stopsOf(raw);
      assert.deepEqual(norm(sN), norm(sL), diag + " stops");
      assert.deepEqual(norm(N.GENIUS._boundaries(sN)), norm(L.GENIUS._boundaries(sL)), diag + " boundaries");
    }
  }
});

test("GENIUS.build output is identical to the legacy build", async () => {
  const L = legacy(), N = built();
  const resL = await L.GENIUS.build(pdfs(L));
  const resN = await N.GENIUS.build(pdfs(N));
  assert.deepEqual(norm(resN.secsByDay), norm(resL.secsByDay), "mainline sections");
  assert.deepEqual(norm(resN.metroSecs), norm(resL.metroSecs), "metro sections");
  assert.deepEqual(norm(resN.hsSecs), norm(resL.hsSecs), "high speed sections");
  assert.deepEqual(norm(resN.labels), norm(resL.labels), "labels");
  assert.deepEqual(norm(resN.review), norm(resL.review), "review list");
  assert.equal(resN.tag, resL.tag, "tag");
});

test("both reports are still required", async () => {
  const N = built();
  await assert.rejects(() => N.GENIUS.build([makePdf(SUMMARY_LINES, N.fflate)]),
    /Detail report/);
  await assert.rejects(() => N.GENIUS.build([makePdf(DETAIL_LINES, N.fflate)]),
    /Summary report/);
});
