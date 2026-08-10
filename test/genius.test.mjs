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

test("per-book review lists carry only their own fleet's items", async () => {
  const N = built();
  const res = await N.GENIUS.build(pdfs(N));
  assert.ok(res.reviews, "per-book lists returned");
  // The Faversham ECS suppression belongs to the mainline book alone…
  assert.ok(res.reviews.main.some(x => /FAVERSHAM/.test(x.msg)), "main has its item");
  assert.ok(!res.reviews.metro.some(x => /FAVERSHAM/.test(x.msg)), "metro clean of it");
  assert.ok(!res.reviews.hs.some(x => /FAVERSHAM/.test(x.msg)), "hs clean of it");
  // …and the unknown Belvedere Sidings berth to the metro book alone.
  assert.ok(res.reviews.metro.some(x => /Belvedere/.test(x.msg)), "metro has its item");
  assert.ok(!res.reviews.main.some(x => /Belvedere/.test(x.msg)), "main clean of it");
  // Together the per-book lists are exactly the combined list.
  assert.deepEqual(
    norm([...res.reviews.main, ...res.reviews.metro, ...res.reviews.hs]
      .map(x => x.msg).sort()),
    norm([...res.review].sort()),
    "partition covers the combined list");
});

test("warnings carry their section, and the Ramsgate cut works", async () => {
  const N = built();
  const res = await N.GENIUS.build(pdfs(N));
  const fav = res.reviews.main.find(x => /suppressed: FAVERSHAM/.test(x.msg));
  assert.equal(fav.sec, "FAVERSHAM", "suppression tagged with its section");
  const ramItem = res.reviews.main.find(x => /suppressed: RAMSGATE/.test(x.msg));
  assert.equal(ramItem.sec, "RAMSGATE", "Ramsgate suppression tagged");
  const bel = res.reviews.metro.find(x => /Belvedere/.test(x.msg));
  assert.equal(bel.sec, "BELVEDERE", "auto-section tagged with its section");
  // The Ramsgate card's filter: RAMSGATE items and general items only.
  const ram = res.reviews.main.filter(x => !x.sec || x.sec === "RAMSGATE");
  assert.ok(ram.some(x => /suppressed: RAMSGATE/.test(x.msg)),
    "Ramsgate card keeps its own item");
  assert.ok(!ram.some(x => /FAVERSHAM/.test(x.msg)),
    "Ramsgate card clean of other sections' items");
});
