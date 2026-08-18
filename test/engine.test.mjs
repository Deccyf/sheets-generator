/* Golden test: the weekend engine must reproduce the legacy output —
   layouts, reports, reissue merge and the updated prints document. */
import test from "node:test";
import assert from "node:assert/strict";
import { legacy, built, norm } from "./helpers/compare.mjs";
import { makeDocx, PRINTS_LINES, REISSUE_LINES, METRO_MOVE_PRINTS, STABLED_PRINTS }
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

/* The weekend books follow the weekday rulebook now, so two things in the
   layout are deliberately different from the frozen build: where the double
   lines fall (every break of BREAK_GAP or more, not the midday and 20 00
   crossings), and which sections quote a headcode. Everything else still has
   to match it exactly, so the comparison drops those two and they are pinned
   on their own below.

   Reading order was a third, and is not any more: it was taken back out
   after the verified Sunday 16/08 book disagreed with it 53 times. So the
   diagram column is compared in full again, which is the strongest check
   here - it is the column the whole change moved. */
function sameShape(b) {
  if (b.skipped) return { road: b.road, label: b.label, skipped: true };
  const n = normBook(b);
  return {
    ...n,
    layout: {
      ...n.layout,
      // c = [r, c, v, look, sides, f]; sides[3] is the bottom border
      cells: n.layout.cells.map(c => [c[0], c[1],
        // the notes column: a leading headcode comes and goes with the
        // headcode sections, which are the weekday ones now
        c[1] === 8 ? String(c[2] || "").replace(/^\d[A-Z]\d\d\s*/, "")
        : c[2], c[3],
        [c[4][0], c[4][1], c[4][2], c[4][3] === "double" ? "thin" : c[4][3]],
        c[5]]),
    },
  };
}

test("weekend run matches the legacy build apart from headcodes and rules", () => {
  const L = legacy(), N = built();
  const rL = run(L, false), rN = run(N, false);
  assert.equal(rN.date, rL.date);
  assert.equal(rN.stamp, rL.stamp);
  assert.equal(rN.banner, rL.banner);
  assert.equal(rN.diagrams, rL.diagrams);
  assert.deepEqual(norm(rN.books.map(sameShape)), norm(rL.books.map(sameShape)));
  assert.equal(rN.updated, rL.updated);
});

test("the weekend metro book quotes the weekday headcode sections", () => {
  const L = legacy(), N = built();
  const noteAt = (books, road, re) => {
    const b = books.find(x => x.road === road);
    const c = b.layout.cells.find(x => x.c === 8 && re.test(String(x.v || "")));
    return c ? String(c.v) : null;
  };
  /* Slade Green was in the weekend metro book's headcode sections and in no
     weekday book's, so its rows carried a headcode the weekday sheets never
     print. Same railway, same rule. */
  assert.match(noteAt(run(L, false).books, "Metro", /^5C01/) || "", /^5C01/,
    "the frozen build quoted it");
  assert.equal(noteAt(run(N, false).books, "Metro", /^5C01/), null,
    "this one does not");
  assert.ok(!N.SHEETS_DATA.HEADCODE_SECTIONS.has("SLADE GREEN"),
    "because the weekday books do not");
});

test("a weekend page is only ruled off at a real break in its work", () => {
  const N = built();
  const X = N.SHEETS_XLSX;
  const rN = run(N, false);
  const doubles = b => b.layout.cells
    .filter(c => c.c === 1 && c.sides[3] === "double").map(c => c.r);
  const timeAt = (b, r) => {
    const c = b.layout.cells.find(x => x.r === r && x.c === 1);
    return c ? String(c.v).slice(0, 5) : null;
  };
  const mins = t => +t.slice(0, 2) * 60 + +t.slice(3, 5);
  for (const b of rN.books) {
    if (b.skipped) continue;
    for (const r of doubles(b)) {
      /* every double has a gap of at least BREAK_GAP under it: find the next
         entry's time down the page */
      let next = null;
      for (const c of b.layout.cells)
        if (c.c === 1 && c.r > r && /^\d\d[: +]\d\d/.test(String(c.v))) {
          next = String(c.v).slice(0, 5); break;
        }
      const here = timeAt(b, r);
      if (!next || !here || !/\d\d[: +]\d\d/.test(here)) continue;
      const gap = mins(next) - mins(here);
      assert.ok(gap >= X.BREAK_GAP || gap < 0,
        b.road + " row " + r + ": ruled off a " + gap + "-minute gap");
    }
  }
});

test("weekend run matches the legacy build (reissue merged)", () => {
  const L = legacy(), N = built();
  const rL = run(L, true), rN = run(N, true);
  assert.deepEqual(norm(rN.books.map(sameShape)), norm(rL.books.map(sameShape)));
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

test("a diagram that starts stabled still gets berthed; one that never moves is named", () => {
  const N = built();
  const res = N.SheetsEngine.run(
    [{ name: "WEEKEND PRINTS.docx", bytes: makeDocx(STABLED_PRINTS, N.fflate) }],
    b => N.fflate.unzipSync(b), f => N.fflate.zipSync(f, { level: 6 }));
  const metro = res.books.find(b => b.road === "Metro");
  assert.ok(metro && !metro.skipped, "the metro book was built");
  const col1 = metro.layout.cells.filter(c => c.c === 1).map(c => String(c.v || ""));
  const diagCol = metro.layout.cells.filter(c => c.c === 3).map(c => String(c.v || ""));

  /* GN621 stands in the Slade Green depot overnight and then works out of it
     at 00 45. The prints mark the road it stands in and list the work under
     it, so a filter on "carries a STABLD row" threw the whole diagram away -
     on SUN 16/08 that lost 465/9 diagrams 411 and 412 off Gillingham depot
     and 376 diagram 821 off Slade Green, none of them mentioned anywhere. */
  assert.ok(col1.some(v => /^00[:+ ]45/.test(v)),
    "the 00 45 off the depot is berthed: " + col1.filter(Boolean).join(" / "));
  assert.ok(diagCol.includes("621"), "under its own diagram number");

  // GN622 never moves, so it has nothing to berth - but it is left off out
  // loud, naming the road it is standing in
  assert.ok(!diagCol.includes("622"), "the one that never moves is not berthed");
  assert.match(metro.report, /standing all day: 1 diagram\(s\)/, "it is counted");
  assert.match(metro.report, /S Gn U Sd x1/, "with the road it stands in");
  assert.match(metro.report, /GN622/, "and its diagram number");
});

test("the prints read the same pasted, dropped, or saved as a CSV", async () => {
  const N = built();
  const zip = { un: b => N.fflate.unzipSync(b), z: f => N.fflate.zipSync(f, { level: 6 }) };
  const docx = makeDocx(PRINTS_LINES, N.fflate);

  /* A .docx cannot be pasted but its text can, and the text is what the
     parser reads: readDocx and readDoc exist only to get from a file to a
     list of paragraphs. So the pasted route joins one step in rather than
     being a second, lesser reader. Checked on the real SUN 16/08 prints as
     well as this fixture: 322 diagrams either way, every laid-out cell the
     same. */
  const text = new TextEncoder().encode(PRINTS_LINES.join("\n"));
  const fromDocx = N.SheetsEngine.run([{ name: "PRINTS.docx", bytes: docx }], zip.un, zip.z);
  const fromText = N.SheetsEngine.run([{ name: "PRINTS.txt", bytes: text }], zip.un, zip.z);
  assert.equal(fromText.banner, fromDocx.banner, "same weekend");
  assert.equal(fromText.diagrams, fromDocx.diagrams, "same diagram count");
  assert.deepEqual(norm(fromText.books.map(normBook)),
                   norm(fromDocx.books.map(normBook)), "and the same books");

  /* The prints saved as a CSV: a spreadsheet writes a comma where the .docx
     has a tab, and the columns are the structure either way. This used to be
     refused as "not the diagram prints". */
  const asCsv = PRINTS_LINES.map(l => l.split("\t")
    .map(c => /[",\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c)
    .join(",")).join("\r\n");
  const fromCsv = N.SheetsEngine.run(
    [{ name: "PRINTS.csv", bytes: new TextEncoder().encode(asCsv) }], zip.un, zip.z);
  assert.equal(fromCsv.banner, fromDocx.banner, "the CSV is the same weekend");
  assert.equal(fromCsv.diagrams, fromDocx.diagrams, "and the same diagrams");
  assert.deepEqual(norm(fromCsv.books.map(normBook)),
                   norm(fromDocx.books.map(normBook)), "and the same books");
  // a spreadsheet pads every row to the widest; the padding must not survive
  const padded = PRINTS_LINES.map(l => l.split("\t")
    .map(c => /[",\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c)
    .join(",") + ",,,").join("\r\n");
  const fromPadded = N.SheetsEngine.run(
    [{ name: "PADDED.csv", bytes: new TextEncoder().encode(padded) }], zip.un, zip.z);
  assert.deepEqual(norm(fromPadded.books.map(normBook)),
                   norm(fromDocx.books.map(normBook)), "trailing empty cells go");

  // the columns ARE the structure, so a paste that lost them is refused
  const noTabs = new TextEncoder().encode(PRINTS_LINES.join("\n").replace(/\t/g, " "));
  assert.throws(() => N.SheetsEngine.run([{ name: "flat.txt", bytes: noTabs }], zip.un, zip.z),
    /isn't the diagram prints/, "flattened text is refused, not half-read");
  /* And a CSV that is NOT the prints stays refused - the weekday Diagram
     Summary export is a CSV too, and half-reading one into an empty book
     would be worse than saying no. */
  const { geniusSummaryCsv } = await import("./helpers/synth.mjs");
  assert.throws(() => N.SheetsEngine.run(
    [{ name: "udiagsum.csv", bytes: new TextEncoder().encode(geniusSummaryCsv()) }],
    zip.un, zip.z),
    /isn't the diagram prints/, "a Diagram Summary export is not the prints");
  assert.equal(N.SheetsEngine.printsFromCsv("a,b,c\n1,2,3"), null,
    "nor is any other CSV");
  assert.equal(N.SheetsEngine.looksLikePrints(PRINTS_LINES.join("\n")), true, "prints");
  assert.equal(N.SheetsEngine.looksLikePrints("Diagram: GT 501 Sat"), false,
    "a line without tabs is not the prints");
  assert.equal(N.SheetsEngine.looksLikePrints(""), false, "nor is nothing");

  // a reissue pasted alongside still merges, and says the base was not a docx
  const re = new TextEncoder().encode(REISSUE_LINES.join("\n"));
  const merged = N.SheetsEngine.run([{ name: "PASTED PRINTS.txt", bytes: text },
                                     { name: "PASTED reissue prints.txt", bytes: re }],
                                    zip.un, zip.z);
  assert.ok(merged.merge, "the reissue was cross-referenced");
  assert.equal(merged.updated, null, "no updated .docx, because there was no .docx");
  const said = merged.books.filter(b => !b.skipped)
    .some(b => /not produced/.test(b.report));
  assert.ok(said, "and the report says so rather than leaving it unexplained");

  /* A reissue arrives the same ways the base does. What decides whether an
     updated prints document comes back is the BASE: there is a .docx to
     splice a reissue into, or there is not. */
  const reCsv = REISSUE_LINES.map(l => l.split("\t")
    .map(c => /[",\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c)
    .join(",")).join("\r\n");
  const csvBoth = N.SheetsEngine.run(
    [{ name: "PRINTS.csv", bytes: new TextEncoder().encode(asCsv) },
     { name: "PRINTS reissue.csv", bytes: new TextEncoder().encode(reCsv) }], zip.un, zip.z);
  assert.deepEqual(norm(csvBoth.merge && csvBoth.merge.replaced),
                   norm(fromDocx && N.SheetsEngine.run(
                     [{ name: "P.docx", bytes: docx },
                      { name: "P reissue.docx", bytes: makeDocx(REISSUE_LINES, N.fflate) }],
                     zip.un, zip.z).merge.replaced),
                   "a CSV reissue replaces the same diagrams a .docx one does");
  assert.equal(csvBoth.updated, null, "and no updated document, with no .docx base");
  const mixed = N.SheetsEngine.run(
    [{ name: "P.docx", bytes: docx },
     { name: "P reissue.csv", bytes: new TextEncoder().encode(reCsv) }], zip.un, zip.z);
  assert.ok(mixed.merge, "a CSV reissue merges into a .docx base");
  assert.ok(mixed.updated, "and that one CAN produce the updated prints");
});

test("a reissue replaces its diagram however the day cell is spelled", () => {
  /* The merge that decides what to replace keys a diagram on its code and
     number. The splice that writes the _UPDATED document keyed it on one run
     of alphanumerics off text with the tabs stripped, which swept the DAY
     cell in too — "AZ601Su". So a reissue whose day cell read even slightly
     differently matched nothing: the review reported the diagram replaced
     while the document handed to the depot carried BOTH the superseded
     working and the new one. The books were right and the document was not,
     which is the worst way round. */
  const N = built();
  const zip = { un: b => N.fflate.unzipSync(b), z: f => N.fflate.zipSync(f) };
  const dec = new TextDecoder();
  const heads = doc => (dec.decode(zip.un(doc.bytes)["word/document.xml"])
    .match(/Diagram:/g) || []).length;
  const base = { name: "WEEKEND PRINTS.docx",
                 bytes: makeDocx(PRINTS_LINES, N.fflate) };
  const baseHeads = heads(base);

  // the same reissue, with its day cell spelled a different way
  const spelt = REISSUE_LINES.map(l => l.replace("\tSat", "\tSa"));
  const res = N.SheetsEngine.run([base,
    { name: "WEEKEND PRINTS reissue.docx", bytes: makeDocx(spelt, N.fflate) }],
    zip.un, zip.z);
  assert.ok(res.updated, "an updated document is produced");
  assert.equal(heads(res.updated), baseHeads,
    "the diagram is replaced in place, not appended alongside itself");
  const xml = dec.decode(zip.un(res.updated.bytes)["word/document.xml"]);
  assert.ok(xml.includes("1B06"), "the reissued working is in the document");
  assert.ok(!xml.includes("1B02"), "and the superseded one is gone");
  assert.deepEqual([...(res.updated.appended || [])], [],
    "nothing had to be appended for want of a match");
});
