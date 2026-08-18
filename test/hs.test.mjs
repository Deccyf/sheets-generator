/* The High Speed book is the depot's Class 395 Allocations Sheet, not a
   berthing sheet: a worksheet per day, a block per depot, last night's
   arrivals on the left and today's allocations on the right. */
import test from "node:test";
import assert from "node:assert/strict";
import { built } from "./helpers/compare.mjs";
import { makePdf, SUMMARY_LINES, DETAIL_LINES } from "./helpers/synth.mjs";

const res = ctx => ctx.GENIUS.build(
  [makePdf(SUMMARY_LINES, ctx.fflate), makePdf(DETAIL_LINES, ctx.fflate)]);

test("High Speed is timed off the first move, the way their sheet is", async () => {
  const N = built();
  const D = N.SHEETS_DATA;
  const hs = Array.from(D.PROFILES_G).find(p => p.bucket === "hs");
  assert.equal(hs.firstDepAll, true,
    "their 18/08 sheet has AZ601 at 04+19 where the platform departure is 05+03");
  /* …on the reports side only. The weekend High Speed book is still a
     berthing book and nobody has held one against a copy timed that way. */
  const wk = Array.from(D.PROFILES).find(p => /395/.test(String(p.label || p.road)));
  assert.equal(wk.first_dep_all, false, "the weekend book keeps the platform time");
});

test("the sheet uses the allocation sheet's own berth codes", () => {
  const H = built().SHEETS_HS;
  // ASH appears 2019 times in the real sheet's ENDS columns against AFK's 6
  assert.equal(H.endsCode("AFK"), "ASH");
  assert.equal(H.endsCode("RE"), "RAM");
  assert.equal(H.endsCode("FAV"), "FAV", "one it already agrees on");
  assert.equal(H.endsCode(""), "", "and nothing stays nothing");
});

test("a worksheet per day, named the way their workbook names them", async () => {
  const N = built();
  const H = N.SHEETS_HS;
  const r = await res(N);
  const sheets = H.sheetsFor(r.hsSecs, r.labels, r.dates);
  assert.ok(sheets.length, "the fixture built a High Speed sheet");
  for (const sh of sheets) {
    assert.match(sh.name, /^[A-Z][a-z]{2} \d\d \d\d$/,
      "named like their own tabs — 'Tue 18 08': " + sh.name);
    assert.ok(sh.name.length <= 31, "Excel takes 31 characters in a tab name");
    /* Dressed in the workbook's own records, not the house looks: the exact
       styleSheet rides on the layout, the tab is their yellow, the columns
       are their <cols> verbatim, and there is no pageSetup because their
       tab carries none. */
    const o = sh.layout.opts;
    assert.ok(/^<\?xml/.test(o.stylesXml), "the skin's styleSheet is used");
    assert.ok(o.stylesXml.includes("FF00B050"), "their green is in it");
    assert.equal(o.tabColor, "FFFFFF00", "their yellow tab");
    assert.match(o.colsXml, /^<cols>/, "their column widths, verbatim");
    assert.equal(o.noPageSetup, true, "no pageSetup, like their tab");
    assert.ok(o.condFmt.length, "the MG mileage colours ride along");
    assert.match(o.condFmt[0], /dxfId="0".*lessThan.*500/s, "amber under 500");
  }
  /* …and the saved workbook really carries all of it. */
  const bytes = H.writeHsBook(r.hsSecs, r.labels, r.dates,
                              f => N.fflate.zipSync(f, { level: 6 }));
  const files = N.fflate.unzipSync(bytes);
  const styles = new TextDecoder().decode(files["xl/styles.xml"]);
  assert.ok(styles.includes("FF00B050") && styles.includes("<dxfs count=\"2\">"),
    "their styles and the two mileage dxfs are in the saved file");
  const xml = new TextDecoder().decode(files["xl/worksheets/sheet1.xml"]);
  assert.ok(xml.includes('<tabColor rgb="FFFFFF00"/>'), "yellow tab saved");
  assert.ok(xml.includes("<conditionalFormatting"), "mileage colours saved");
  assert.ok(!xml.includes("<pageSetup"), "and no pageSetup, like theirs");
});

test("each depot block is arrivals on the left, allocations on the right", async () => {
  const N = built();
  const H = N.SHEETS_HS;
  const r = await res(N);
  const sh = H.sheetsFor(r.hsSecs, r.labels, r.dates)[0];
  const at = new Map();
  for (const c of sh.layout.cells) at.set(c.r + "," + c.c, c.v);

  // the legend block sits above everything, exactly as the workbook has it
  assert.equal(at.get("2,7"), "INT CLEAN");
  assert.equal(at.get("3,7"), "EXT CLEAN");
  assert.equal(at.get("2,8"), "Mileage Guide");
  assert.equal(at.get("2,19"), "Date Sent");
  assert.equal(at.get("3,19"), "", "the sent date is the sender's to fill in");

  // find a block heading and check the pair, and the header row under it
  let head = null;
  for (let n = 1; n < sh.layout.maxRow; n++)
    if (/PM ARRIVALS/.test(at.get(n + ",2") || "")) { head = n; break; }
  assert.ok(head, "a depot block was written");
  assert.match(at.get(head + ",2"), /^[A-Z ]+ PM ARRIVALS /, "arrivals on the left");
  assert.match(at.get(head + ",8"), /^[A-Z ]+ UNIT ALLOCATIONS /, "allocations on the right");
  // the header row, in their own words and their own columns
  for (const [c, want] of [[2, "TRAIN ID"], [3, "ARRIVAL TIME"], [4, "UNIT NUMBER"],
                           [5, "6 OR 12 CAR"], [6, "CET DUE"], [8, "TRAIN ID"],
                           [9, "DIAGRAM"], [11, "MG"], [12, "TIME"], [13, "FP/RP"],
                           [14, "UNIT NO"], [15, "ENDS AM"], [17, "ENDS PM"],
                           [18, "TRAIN ID"], [19, "ARRIVES"], [20, "WORKS"]])
    assert.equal(at.get((head + 1) + "," + c), want, "column " + c);
  /* With one day's reports there is no day before, so the arrivals table is
     empty and the heading says so rather than looking like a quiet nothing. */
  assert.match(at.get(head + ",2"), /no previous day loaded/,
    "a single day's reports cannot fill last night's arrivals");
  // and the standing house notes close the sheet
  let note = false;
  for (const c of sh.layout.cells) if (c.v === "NOTE") note = true;
  assert.ok(note, "the footer notes block is re-anchored under the last depot");
});

test("the columns the reports cannot fill are ruled and empty", async () => {
  const N = built();
  const H = N.SHEETS_HS;
  const r = await res(N);
  const sh = H.sheetsFor(r.hsSecs, r.labels, r.dates)[0];
  const at = new Map(), styled = new Map();
  for (const c of sh.layout.cells) {
    at.set(c.r + "," + c.c, c.v);
    styled.set(c.r + "," + c.c, c.sides);
  }
  let firstData = null;
  for (let n = 1; n < sh.layout.maxRow; n++)
    if (/^[A-Z]{2}\d{3}$/.test(at.get(n + ",9") || "")) { firstData = n; break; }
  assert.ok(firstData, "a diagram row was written");
  // N/M M/O, FP/RP, ARRIVES, the next working and the notes are hand-kept
  for (const c of [10, 13, 16, 18, 19, 20]) {
    assert.equal(at.get(firstData + "," + c), "", "column " + c + " left empty");
    assert.ok(styled.get(firstData + "," + c), "…but ruled, not missing");
  }
  // and the ones it can fill, are
  assert.match(at.get(firstData + ",9"), /^[A-Z]{2}\d{3}$/, "DIAGRAM");
  assert.match(at.get(firstData + ",12"), /^\d\d[ +]\d\d$/, "TIME");
});
