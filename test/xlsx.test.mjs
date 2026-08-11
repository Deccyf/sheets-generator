/* Golden test: workbooks written by the new in-house writer must read back
   (via the legacy build's bundled ExcelJS) identically to the ones the
   legacy ExcelJS writer produced — values, fonts, alignment, borders,
   merges, widths, heights and page setup. */
import test from "node:test";
import assert from "node:assert/strict";
import { legacy, built, normalizeWorkbook } from "./helpers/compare.mjs";
import { makePdf, makeDocx, SUMMARY_LINES, DETAIL_LINES, PRINTS_LINES }
  from "./helpers/synth.mjs";

async function geniusRes(ctx) {
  return ctx.GENIUS.build([
    makePdf(SUMMARY_LINES, ctx.fflate), makePdf(DETAIL_LINES, ctx.fflate)]);
}

test("weekday books: new writer matches the ExcelJS output cell for cell", async () => {
  const L = legacy(), N = built();
  const rL = await geniusRes(L);
  const variants = [
    ["SHEETS", s => s.secsByDay, false, undefined],
    ["RAM_SHEETS", s => s.secsByDay, true, undefined],
    ["METRO_SHEETS", s => s.metroSecs, false,
      ctx => ({ baseOrder: ctx.SHEETS_XLSX.METRO_ORDER, splitRamsgate: false })],
    ["HS_SHEETS", s => s.hsSecs, false, () => ({ baseOrder: [], splitRamsgate: false })],
  ];
  for (const [name, pick, ram, opts] of variants) {
    // Both writers get the same sections: what the engines produce is
    // compared in genius.test.mjs (the mainline book's unit order has moved
    // on since the legacy build), and this test is about the writer.
    const secs = pick(rL), labels = rL.labels;
    const bytesL = await L.SHEETS_XLSX.writeBooks(secs, labels, ram,
      opts ? opts(L) : undefined);
    const bytesN = N.SHEETS_XLSX.writeBooks(secs, labels, ram,
      opts ? opts(N) : undefined);
    const wbL = await normalizeWorkbook(L, bytesL);
    const wbN = await normalizeWorkbook(L, bytesN);
    assert.deepEqual(wbN, wbL, name);
  }
});

test("weekend books: shared writer matches the legacy zipXlsx output", async () => {
  const L = legacy(), N = built();
  const runOn = ctx => ctx.SheetsEngine.run(
    [{ name: "WEEKEND PRINTS.docx", bytes: makeDocx(PRINTS_LINES, ctx.fflate) }],
    b => ctx.fflate.unzipSync(b),
    f => ctx.fflate.zipSync(f, { level: 6 }));
  const rL = runOn(L), rN = runOn(N);
  for (let i = 0; i < rL.books.length; i++) {
    if (rL.books[i].skipped) {
      assert.equal(rN.books[i].skipped, true);
      continue;
    }
    const wbL = await normalizeWorkbook(L, rL.books[i].xlsx);
    const wbN = await normalizeWorkbook(L, rN.books[i].xlsx);
    assert.deepEqual(wbN, wbL, rL.books[i].name);
  }
});

test("unified preview renders every saved cell", async () => {
  const N = built();
  const rN = await geniusRes(N);
  const day = Object.keys(rN.labels)[0];
  const order = N.SHEETS_XLSX.bookOrder(rN.secsByDay, N.SHEETS_XLSX.MAIN_ORDER, true);
  const html = N.SHEETS_XLSX.dayPreviewHtml(rN.secsByDay[day],
    rN.labels[day], false, order);
  assert.match(html, /<table class="sheet">/);
  for (const [, entries] of rN.secsByDay[day]) {
    for (const e of entries) {
      assert.ok(html.includes(e.dest), "preview shows destination " + e.dest);
    }
  }
});

test("all-headcodes toggle puts every headcode in the notes column (weekday)", async () => {
  const N = built();
  const rN = await geniusRes(N);
  const X = N.SHEETS_XLSX;
  const order = X.bookOrder(rN.secsByDay, X.MAIN_ORDER, true);
  const day = Object.keys(rN.labels)[0];
  const noteFor = (rows, headStart) => {
    const flat = [...rows];
    const i = flat.findIndex(r => r.kind === "data" &&
      String(r.vals[1] || "").startsWith(headStart));
    return i < 0 ? null : String(flat[i].vals[8] || "");
  };
  const on = X.layoutSheet(rN.secsByDay[day], rN.labels[day], false, order, true);
  const off = X.layoutSheet(rN.secsByDay[day], rN.labels[day], false, order);
  // ASHFORD is not a headcode section: the platform starter's passenger
  // headcode appears only with the toggle on…
  assert.match(noteFor(on, "05 45"), /2A01/, "pax starter headcode on");
  assert.doesNotMatch(noteFor(off, "05 45") || "", /2A01/, "legacy rules off");
  // …and so does an ECS departure's headcode (the Belvedere berth exit
  // in the metro book, which is not a headcode section either).
  const mOrder = X.bookOrder(rN.metroSecs, X.METRO_ORDER, false);
  const mOn = X.layoutSheet(rN.metroSecs[day], rN.labels[day], false, mOrder, true);
  const mOff = X.layoutSheet(rN.metroSecs[day], rN.labels[day], false, mOrder);
  assert.match(noteFor(mOn, "06+20"), /5E01/, "ECS headcode on");
  assert.doesNotMatch(noteFor(mOff, "06+20") || "", /5E01/, "legacy rules off");
});
