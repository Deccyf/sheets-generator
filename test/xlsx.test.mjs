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
  const rL = await geniusRes(L), rN = await geniusRes(N);
  const variants = [
    ["SHEETS", s => s.secsByDay, false, undefined],
    ["RAM_SHEETS", s => s.secsByDay, true, undefined],
    ["METRO_SHEETS", s => s.metroSecs, false,
      ctx => ({ baseOrder: ctx.SHEETS_XLSX.METRO_ORDER, splitRamsgate: false })],
    ["HS_SHEETS", s => s.hsSecs, false, () => ({ baseOrder: [], splitRamsgate: false })],
  ];
  for (const [name, pick, ram, opts] of variants) {
    const bytesL = await L.SHEETS_XLSX.writeBooks(pick(rL), rL.labels, ram,
      opts ? opts(L) : undefined);
    const bytesN = N.SHEETS_XLSX.writeBooks(pick(rN), rN.labels, ram,
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
