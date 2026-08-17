/* The Metro book is the depot's own document, not a berthing sheet: a
   worksheet per location, landscape, fourteen columns. Pinned against the
   shape of the operator's own May 2026 workbook. */
import test from "node:test";
import assert from "node:assert/strict";
import { built, norm } from "./helpers/compare.mjs";
import { makePdf, SUMMARY_LINES, DETAIL_LINES } from "./helpers/synth.mjs";

const res = ctx => ctx.GENIUS.build(
  [makePdf(SUMMARY_LINES, ctx.fflate), makePdf(DETAIL_LINES, ctx.fflate)]);

test("the Metro book is a worksheet per location, not per day", async () => {
  const N = built();
  const X = N.SHEETS_XLSX, M = N.SHEETS_METRO;
  const r = await res(N);
  const order = X.bookOrder(r.metroSecs, X.METRO_ORDER, false);
  const sheets = M.sheetsFor(r.metroSecs, r.labels, order);
  assert.ok(sheets.length, "the fixture built some Metro sheets");
  // every worksheet is a location the build actually has entries for
  const secs = new Set();
  for (const day of Object.keys(r.labels))
    for (const [s] of r.metroSecs[day] || []) secs.add(s);
  for (const sh of sheets)
    assert.ok(secs.has(sh.name.replace(/ (AM|PM)$/, "")),
      sh.name + " is one of the build's locations: " + [...secs].join(", "));
  for (const sh of sheets)
    assert.ok(sh.name.length <= 31, "Excel takes 31 characters in a tab name");
});

test("the Metro sheet carries the depot's own columns", async () => {
  const N = built();
  const X = N.SHEETS_XLSX, M = N.SHEETS_METRO;
  const r = await res(N);
  const sheets = M.sheetsFor(r.metroSecs, r.labels,
                             X.bookOrder(r.metroSecs, X.METRO_ORDER, false));
  const sh = sheets[0];
  const at = new Map();
  for (const c of sh.layout.cells) at.set(c.r + "," + c.c, c.v);
  const row = n => Array.from({ length: 14 }, (_, i) => at.get(n + "," + (i + 1)) || "");

  assert.match(row(1)[0], /^SERVICES STARTING /, "the title row: " + row(1)[0]);
  assert.deepEqual(Array.from(row(2)),
    ["TRAIN I.D.", "SIDINGS", "STATION", "DESTINATION", "POS", "DIAG",
     "FORMATION", "ROAD", "COMMENTS", "S", "R/T", "L/S", "ENDS", "MILES"],
    "the header row, in the workbook's own order and wording");
  // the two depots call the timing point a SIGNAL, and a terminus has
  // PLATFORMs where a depot has ROADs
  assert.equal(Array.from(M.headings("GROVE PARK"))[2], "SIGNAL");
  assert.equal(Array.from(M.headings("VICTORIA"))[7], "PLATFORM");
  assert.equal(Array.from(M.headings("TONBRIDGE"))[7], "ROAD");

  // landscape, and as many pages down as the day needs
  assert.equal(sh.layout.opts.landscape, true, "landscape");
  assert.equal(sh.layout.opts.fitToHeight, 0, "runs down as many pages as it needs");
  assert.equal(Array.from(sh.layout.opts.widths).length, 14, "fourteen columns");
});

test("the Metro sheet reads by Position, lowest first", () => {
  const N = built();
  const M = N.SHEETS_METRO;
  /* Not the berthing books' order - those list the units the way they stand
     on the ground, front one first, which on the metro profile is highest
     Position first. Every formation on the operator's own workbook numbers
     its POS column 1, 2, 3 straight down, so the sheet is sorted for it. */
  const entry = {
    time: 5 * 60 + 9, time_kind: "ecs", dest: "SEV", headcode: "5S08",
    units: [{ diag: "435", code: "SG", pos: 3, ends: "GP PM", miles: 338 },
            { diag: "203", code: "SG", pos: 1, ends: "GP PM", miles: 338 },
            { diag: "434", code: "SG", pos: 2, ends: "GP PM", miles: 338 }],
  };
  const lay = M.layoutSection("GROVE PARK AM", [entry], "MON 03/08");
  const at = new Map();
  for (const c of lay.cells) at.set(c.r + "," + c.c, c.v);
  const col = c => [3, 4, 5].map(r => at.get(r + "," + c) || "");
  assert.deepEqual(Array.from(col(5)), ["1", "2", "3"], "POS runs 1, 2, 3 down");
  assert.deepEqual(Array.from(col(6)), ["SG203", "SG434", "SG435"],
    "and the diagrams follow it");
  // the headcode, time and destination are written once, on the top row
  assert.deepEqual(Array.from(col(1)), ["5S08", "", ""], "TRAIN I.D. written once");
  assert.deepEqual(Array.from(col(2)), ["05+09", "", ""], "SIDINGS written once");
  assert.equal(at.get("4,4"), "", "DESTINATION written once");
  // ENDS and MILES belong to the diagram, so every row of it carries them
  assert.deepEqual(Array.from(col(13)), ["GP PM", "GP PM", "GP PM"], "ENDS on each");
  assert.deepEqual(Array.from(col(14)), ["338", "338", "338"], "MILES on each");
  // and the six hand-kept columns are ruled and empty
  for (const c of [3, 8, 9, 10, 11, 12])
    assert.equal(at.get("3," + c), "", "column " + c + " is left for the depot");
});

test("MILES is the diagram's own total, not the running one added up", async () => {
  const N = built();
  /* The export carries the figure already running - 0.10, 6.72, 10.31 down
     the diagram, with the leg's own mileage in the next column - so the
     total is the last of them. Adding them up gave one Metro diagram 5,445
     miles for a day's work. */
  const { geniusSummaryCsv, geniusDetailCsv } = await import("./helpers/synth.mjs");
  const r = await N.GENIUS.build([geniusSummaryCsv(), geniusDetailCsv()]);
  const miles = [];
  for (const day of Object.keys(r.labels))
    for (const m of [r.secsByDay[day], r.metroSecs[day], r.hsSecs[day]]) {
      if (!m) continue;
      for (const [, list] of m)
        for (const e of list)
          for (const u of e.units) if (u.miles != null) miles.push(u.miles);
    }
  assert.ok(miles.length, "the CSV export carries a Miles column to read");
  const worst = Math.max(...miles);
  assert.ok(worst < 2000, "a day's diagram does not run thousands of miles: " + worst);
});

test("every Metro sheet ends with the dated, name and signature block", () => {
  const N = built();
  const M = N.SHEETS_METRO;
  const entry = { time: 5 * 60 + 56, time_kind: "ecs", dest: "VIC", headcode: "5B80",
                  units: [{ diag: "401", code: "SG", pos: 1, ends: "VIC PM", miles: 306 }] };
  const lay = M.layoutSection("BELLINGHAM", [entry], "MON 18/05", "18/05/26");
  const at = new Map();
  for (const c of lay.cells) at.set(c.r + "," + c.c, c.v);
  // a blank row after the work, then the block the real sheets carry
  assert.equal(at.get("4,1"), undefined, "a blank row under the last entry");
  assert.equal(at.get("5,1"), "DATED 18.05.26", "the issue date, as the sheets write it");
  assert.equal(at.get("5,5"), "NAME");
  assert.equal(at.get("5,11"), "SIGNATURE");
  assert.match(at.get("6,1"), /^PLEASE E-MAIL SHEETS TO /, "and where it goes back to");
});

test("a column is never narrower than what is in it", () => {
  const N = built();
  const M = N.SHEETS_METRO;
  /* Measured on a canvas against Excel's own width unit: in capitals, the
     body's bold Arial 11 runs about 1.40 to the character, so "CANNON
     STREET" wants 18.2 where the real workbook's DESTINATION column is 17.9.
     That last third of a character is the clipping that was reported. */
  const mk = dest => ({ time: 6 * 60, time_kind: "ecs", dest, headcode: "5A01",
                        units: [{ diag: "401", code: "SG", pos: 1, ends: "GP PM" }] });
  const wide = M.layoutSection("DARTFORD", [mk("CST")], "MON 03/08", "03/08/26");
  const dCol = Array.from(wide.opts.widths)[3];
  const at = new Map();
  for (const c of wide.cells) at.set(c.r + "," + c.c, c.v);
  assert.equal(at.get("3,4"), "CANNON STREET", "the destination in full");
  assert.ok(dCol >= 18.2, "wide enough for it: " + dCol);
  // and a short one is left at the workbook's own width, not shrunk
  const narrow = M.layoutSection("DARTFORD", [mk("VIC")], "MON 03/08", "03/08/26");
  assert.equal(Array.from(narrow.opts.widths)[3], Array.from(M.WIDTHS)[3],
    "a short destination leaves the column at the house width");
  assert.deepEqual(Array.from(M.fitWidths([])), Array.from(M.WIDTHS),
    "and an empty sheet is the house widths exactly");
});
