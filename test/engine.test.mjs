/* Golden test: the weekend engine must reproduce the legacy output —
   layouts, reports, reissue merge and the updated prints document. */
import test from "node:test";
import assert from "node:assert/strict";
import { legacy, built, norm } from "./helpers/compare.mjs";
import { makeDocx, PRINTS_LINES, REISSUE_LINES, METRO_MOVE_PRINTS }
  from "./helpers/synth.mjs";

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
  /* Deliberate divergence from the frozen build. Its paragraph pattern
     required a space after "w:p", so a plain <w:p> was invisible to it: the
     merge replaced nothing and the "updated prints" it handed back were the
     superseded document, byte for byte, with no warning. The legacy bytes
     are therefore the wrong answer and cannot be the assertion - what is
     asserted instead is the merge itself. */
  const docXml = (ctx, u) =>
    new TextDecoder().decode(ctx.fflate.unzipSync(u.bytes)["word/document.xml"]);
  const baseXml = new TextDecoder().decode(
    N.fflate.unzipSync(inputs(N, true)[0].bytes)["word/document.xml"]);
  const updXml = docXml(N, rN.updated);
  assert.notEqual(updXml, baseXml, "the updated prints are not the original");
  assert.ok(updXml.includes("1B06"), "the reissued diagram's rows are in it");
  assert.ok(!updXml.includes("1B02"), "the superseded rows are gone");
  assert.equal(docXml(L, rL.updated), baseXml,
    "and the frozen build really did hand back the original unchanged");
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

test("weekend metro sheets are timed off the first move too", () => {
  const N = built();
  const res = N.SheetsEngine.run(
    [{ name: "WEEKEND PRINTS.docx", bytes: makeDocx(METRO_MOVE_PRINTS, N.fflate) }],
    b => N.fflate.unzipSync(b), f => N.fflate.zipSync(f, { level: 6 }));
  const metro = res.books.find(b => b.road === "Metro");
  const times = metro.layout.cells
    .filter(c => c.c === 1 && /^\d\d:\d\d/.test(String(c.v)))
    .sort((a, b) => a.r - b.r).map(c => String(c.v));
  // GN611 empty out of the up sidings at 05:52 for the 06:00 off the
  // platform; GN612 starts in the platform and keeps its own time. Both
  // still show where the service they form is going.
  assert.deepEqual(norm(times), ["05:52 CST", "06:20 CST"]);
});

test("all-headcodes toggle works per book on the weekend panel", () => {
  const L = legacy(), N = built();
  const zipFns = [b => N.fflate.unzipSync(b), f => N.fflate.zipSync(f, { level: 6 })];
  const docs = inputs(N, false);
  const on = N.SheetsEngine.run(docs, ...zipFns, { allHeadcodes: { Mainline: true } });
  const off = N.SheetsEngine.run(docs, ...zipFns);
  const noteCells = book => book.layout.cells
    .filter(c => c.c === 8 && c.v).map(c => String(c.v)).join(" | ");
  // ASHFORD is not a mainline headcode section: 2A01 shows only when on.
  assert.match(noteCells(on.books[0]), /2A01/, "Mainline notes gain the headcode");
  assert.doesNotMatch(noteCells(off.books[0]), /2A01/, "off = house rules");
  // The Metro book was not toggled and keeps its legacy notes exactly.
  assert.equal(noteCells(on.books[1]), noteCells(off.books[1]),
    "untouched book unchanged");
});
