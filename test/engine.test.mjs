/* Golden test: the weekend engine must reproduce the legacy output —
   layouts, reports, reissue merge and the updated prints document. */
import test from "node:test";
import assert from "node:assert/strict";
import { legacy, built, norm } from "./helpers/compare.mjs";
import { makeDocx, PRINTS_LINES, REISSUE_LINES } from "./helpers/synth.mjs";

function inputs(ctx, withReissue) {
  const docs = [{ name: "WEEKEND PRINTS.docx", bytes: makeDocx(PRINTS_LINES, ctx.fflate) }];
  if (withReissue)
    docs.push({ name: "WEEKEND PRINTS reissue.docx", bytes: makeDocx(REISSUE_LINES, ctx.fflate) });
  return docs;
}
function run(ctx, withReissue) {
  return ctx.SheetsEngine.run(inputs(ctx, withReissue),
    b => ctx.fflate.unzipSync(b),
    f => ctx.fflate.zipSync(f, { level: 6 }));
}
function normBook(b) {
  if (b.skipped) return { road: b.road, label: b.label, skipped: true };
  return {
    road: b.road, label: b.label, name: b.name, report: b.report,
    entries: b.entries, sections: b.sections, reviews: b.reviews,
    sectionCounts: b.sectionCounts,
    layout: {
      cells: b.layout.cells
        .map(c => [c.r, c.c, c.v, c.look, c.sides, c.f || null])
        .sort((a, x) => (a[0] - x[0]) || (a[1] - x[1])),
      merges: b.layout.merges.slice().sort(),
      rowHeights: [...b.layout.rowHeights.entries()].sort((a, x) => a[0] - x[0]),
      maxRow: b.layout.maxRow,
    },
  };
}

test("docx paragraph extraction is unchanged", () => {
  const L = legacy(), N = built();
  const docx = makeDocx(PRINTS_LINES, L.fflate);
  const xml = new TextDecoder().decode(L.fflate.unzipSync(docx)["word/document.xml"]);
  assert.deepEqual(norm(N.SheetsEngine.docxParagraphs(xml)), norm(L.SheetsEngine.docxParagraphs(xml)));
});

test("parseDiagrams is unchanged", () => {
  const L = legacy(), N = built();
  assert.deepEqual(norm(N.SheetsEngine.parseDiagrams(PRINTS_LINES)),
                   norm(L.SheetsEngine.parseDiagrams(PRINTS_LINES)));
});

test("weekend run matches the legacy build (no reissue)", () => {
  const L = legacy(), N = built();
  const rL = run(L, false), rN = run(N, false);
  assert.equal(rN.date, rL.date);
  assert.equal(rN.stamp, rL.stamp);
  assert.equal(rN.banner, rL.banner);
  assert.equal(rN.diagrams, rL.diagrams);
  assert.deepEqual(norm(rN.books.map(normBook)), norm(rL.books.map(normBook)));
  assert.equal(rN.updated, rL.updated);
});

test("weekend run matches the legacy build (reissue merged)", () => {
  const L = legacy(), N = built();
  const rL = run(L, true), rN = run(N, true);
  assert.deepEqual(norm(rN.books.map(normBook)), norm(rL.books.map(normBook)));
  assert.deepEqual(norm(rN.merge), norm(rL.merge));
  assert.equal(rN.updated.name, rL.updated.name);
  const docXml = (ctx, u) =>
    new TextDecoder().decode(ctx.fflate.unzipSync(u.bytes)["word/document.xml"]);
  assert.equal(docXml(N, rN.updated), docXml(L, rL.updated),
    "updated prints document body");
});

test("guard rails are unchanged", () => {
  const N = built();
  const zip = { un: b => N.fflate.unzipSync(b), z: f => N.fflate.zipSync(f) };
  assert.throws(
    () => N.SheetsEngine.run([{ name: "only reissue.docx",
      bytes: makeDocx(REISSUE_LINES, N.fflate) }], zip.un, zip.z),
    /reissue on its own/);
  const otherDay = REISSUE_LINES.map(l => l.replace("01/08/2026", "08/08/2026"));
  assert.throws(
    () => N.SheetsEngine.run([
      { name: "WEEKEND PRINTS.docx", bytes: makeDocx(PRINTS_LINES, N.fflate) },
      { name: "late reissue.docx", bytes: makeDocx(otherDay, N.fflate) },
    ], zip.un, zip.z),
    /belongs to a different day/);
});
