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

test("Integrale CSVs build the same books as the Genius PDFs", async () => {
  const N = built();
  const { integraleSummaryCsv, integraleDetailCsv } =
    await import("./helpers/synth.mjs");
  const pdfRes = await N.GENIUS.build(pdfs(N));
  const csvRes = N.GENIUS.buildIntegrale([integraleSummaryCsv(), integraleDetailCsv()]);
  assert.deepEqual(norm(csvRes.secsByDay), norm(pdfRes.secsByDay), "mainline sections");
  assert.deepEqual(norm(csvRes.metroSecs), norm(pdfRes.metroSecs), "metro sections");
  assert.deepEqual(norm(csvRes.hsSecs), norm(pdfRes.hsSecs), "high speed sections");
  assert.deepEqual(norm(csvRes.labels), norm(pdfRes.labels), "labels");
  assert.equal(csvRes.tag, pdfRes.tag, "tag");
  assert.deepEqual(norm(csvRes.reviews), norm(pdfRes.reviews), "review lists");
});

test("Integrale quirks: mangled headcodes, stable placeholders, uncovered note", async () => {
  const N = built();
  const { INTEGRALE_QUIRKS_SUMMARY, INTEGRALE_QUIRKS_DETAIL } =
    await import("./helpers/synth.mjs");
  const res = N.GENIUS.buildIntegrale([INTEGRALE_QUIRKS_SUMMARY, INTEGRALE_QUIRKS_DETAIL]);
  assert.ok(res.review.some(m => /1 stable-all-day.*QQ902/.test(m)),
    "stable placeholder dropped with a note");
  assert.ok(res.review.some(m => /1 headcode\(s\) recovered.*2E05/.test(m)),
    "mangled headcode noted");
  assert.ok(res.review.some(m => /1 of 3 diagrams are marked Uncovered/.test(m)),
    "uncovered count noted");
  const ash = res.secsByDay.M.get("ASHFORD");
  assert.ok(ash && ash.some(e => e.headcode === "2E05"),
    "recovered headcode reaches the entry");
  assert.ok(!("T" in res.labels), "the next-day placeholder builds no TUE tab");
  // Plumstead and Bellingham use their own codes on the sheets now
  const bell = res.metroSecs.M.get("BELLINGHAM SIDING");
  assert.ok(bell && bell.length, "Bellingham entry present");
  assert.equal(bell[0].units[0].am, "PLU", "Plumstead berths code PLU");
  assert.equal(bell[0].units[0].pm, "BGM", "Bellingham berths code BGM");
});

test("metro sheets are timed off the first move; the mainline is not", async () => {
  const N = built();
  const { METRO_MOVE_SUMMARY, METRO_MOVE_DETAIL } =
    await import("./helpers/synth.mjs");
  const res = N.GENIUS.buildIntegrale([METRO_MOVE_SUMMARY, METRO_MOVE_DETAIL]);
  const dart = res.metroSecs.M.get("DARTFORD");
  assert.ok(dart && dart.length === 2, "both Dartford entries listed");
  // MM801 leaves the up sidings empty at 05 52 and forms the 06 00 off the
  // platform: the sheet shows the berth move, still bound for Cannon Street.
  const [moved, starter] = dart;
  assert.equal(moved.time, 5 * 60 + 52, "timed off the first move");
  assert.equal(moved.time_kind, "ecs", "an empty move, so a + time");
  assert.equal(moved.headcode, "5B05", "the empty move's headcode");
  assert.equal(moved.dest, "CST", "destination stays with the working leg");
  // MM802 starts in the platform, so the platform time is the first move.
  assert.equal(starter.time, 6 * 60 + 20, "platform starter keeps its time");
  assert.equal(starter.time_kind, "pax");
  assert.equal(starter.headcode, "2B07");
  // The mainline book keeps the legacy rule: GT101 runs empty out of the
  // Ashford down sidings at 05 30 but is listed off the platform at 05 45.
  const pdfRes = await N.GENIUS.build(pdfs(N));
  const ash = pdfRes.secsByDay.M.get("ASHFORD");
  assert.ok(ash.some(e => e.time === 5 * 60 + 45 && e.headcode === "2A01"),
    "mainline listed off the platform call");
  assert.ok(!ash.some(e => e.time === 5 * 60 + 30),
    "mainline not moved back to the sidings departure");
});

test("mixed-format pairs are refused by the sniffers", () => {
  const N = built();
  assert.equal(N.GENIUS.sniffIntegrale("Code,Cov,Type,x,x,x,Position,First Train,y"), "sum");
  assert.equal(N.GENIUS.sniffIntegrale("Diagram Code,Diagram Date,Notes,Start Tiploc"), "det");
  assert.equal(N.GENIUS.sniffIntegrale("some,other,csv"), null);
});
