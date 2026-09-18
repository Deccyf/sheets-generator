/* The shortages and variations road: the ported engine, and the plumbing
   that was changed on the way in (one PDF reader, and a Diagram Detail that
   can arrive as the CSV export as well as the PDF). */
import test from "node:test";
import assert from "node:assert/strict";
import { built, norm } from "./helpers/compare.mjs";
import { OPERATING_LINES, SHORTAGE_DETAIL_LINES, SHORTAGE_DETAIL_CSV }
  from "./helpers/shortage-synth.mjs";

const S = () => built().SHEETS_SHORTAGE;
const txt = lines => lines.join("\n");

test("a 3-car in the formation but the wrong place is a swap, not a length", () => {
  const res = S().run(txt(OPERATING_LINES), txt(SHORTAGE_DETAIL_LINES));
  const lines = res.text.split("\n").filter(Boolean);
  /* RM301 planned a 3-car and got a 4-car; RM901, on the same working, got
     the 3-car. Every car is there and the train is the right length - only
     the order is wrong - so it must NOT read as 4.375 V 3.375 against one
     and 3.375 V 4.375 against the other. */
  assert.match(lines[0],
    /^3 CAR WRONG END \(RM301\/RM901\) ENDS 2R02 05 22 AFK - DVP \(ARR 05 51\)$/,
    "the swap, as one line naming both: " + lines[0]);
  assert.ok(!/375 V 3\.375 \(RM301\)|375 V 4\.375 \(RM901\)/.test(res.text),
    "and neither half reads as a length difference: " + res.text);
  /* A swap says nothing about the services it runs on, because it does not
     change what turns up: the train is the length it was planned. */
  assert.ok(!/FOLLOWING[^\n]*2R02/.test(res.text),
    "nothing to trace through - the train is the right length");
});

test("a 3-car with nothing swapped back is still a length difference", () => {
  /* RM903 has the 3-car and no 4-car went the other way, so that train
     really is a car short. The swap rule must not swallow it. */
  const res = S().run(txt(OPERATING_LINES), txt(SHORTAGE_DETAIL_LINES));
  assert.match(res.text, /^3\.375 V 4\.375 \(RM903\) ENDS 2W14 06 36 RAM - CHX/m,
    "the real shortfall keeps its length label: " + res.text);
  assert.match(res.text, /FOLLOWING 3 V 4: 2W14 06 36 RAM - CHX/,
    "and what it leaves short is traced through");
});

test("the swap is read off the working, not the diagram’s last allocation", () => {
  /* The trap that hid this one. RM901 carries the 3-car on the morning
     working with RM301 and a 4-car from the afternoon; a check that looks
     only at a diagram’s effective (last) allocation never sees the 3-car at
     all, and the pair came out as two length differences against the depot.
     Its afternoon unit is a separate mismatch and still has its own line. */
  const res = S().run(txt(OPERATING_LINES), txt(SHORTAGE_DETAIL_LINES));
  assert.match(res.text, /3 CAR WRONG END \(RM301\/RM901\)/, "the morning swap is found");
  assert.match(res.text, /^375 V 375\/9 \(RM901\) ENDS 5F85 15\+49 DVP - CST/m,
    "and the afternoon unit is still reported on its own: " + res.text);
  assert.match(res.text, /^375\/9 V 375 \(RM002\)/m, "and the lower section still reads");
});

test("in the middle of a formation it is INTER VICE END, and that needs the Summary", async () => {
  const { SHORTAGE_SUMMARY_LINES } = await import("./helpers/shortage-synth.mjs");
  const s = S();
  /* RM302 planned a 3-car and got a 4-car; RM905, in the same formation of
     three, got the 3-car - and it stands at Position 2 of 3, so the 3-car is
     in the MIDDLE. That is the depot’s INTER VICE END, not WRONG END, and
     nothing but the Summary’s POS column can tell the two apart. */
  const withSum = s.run(txt(OPERATING_LINES), txt(SHORTAGE_DETAIL_LINES),
                        txt(SHORTAGE_SUMMARY_LINES));
  assert.equal(withSum.positions, true, "the Summary was read");
  assert.match(withSum.text, /^3 CAR INTER VICE END \(RM302\/RM905\) ENDS 2X01 07 10 RAM - CHX/m,
    "the middle case: " + withSum.text);
  /* The two-unit swap does not need it and must read the same either way. */
  assert.match(withSum.text, /3 CAR WRONG END \(RM301\/RM901\)/,
    "and a pair is still WRONG END, Summary or no Summary");
  assert.ok(!withSum.reviews.some(r => /formation of 3/.test(r)),
    "nothing left for review: " + withSum.reviews.join(" | "));
});

test("without the Summary the middle case is named, not guessed at", () => {
  /* The house rule: what cannot be resolved safely goes on the Review list.
     A formation of three with no POS column could be either label, so it
     stays a length difference and the review says what to drop in. */
  const res = S().run(txt(OPERATING_LINES), txt(SHORTAGE_DETAIL_LINES));
  assert.equal(res.positions, false, "no Summary was given");
  assert.ok(!/INTER VICE END/.test(res.text), "no label was guessed");
  const note = res.reviews.find(r => /RM302\/RM905/.test(r));
  assert.ok(note, "the pair is named: " + res.reviews.join(" | "));
  assert.match(note, /POS/, "and what would settle it is named too: " + note);
});

test("the Diagram Detail can be the CSV export or the PDF", () => {
  const s = S();
  const fromPdf = s.run(txt(OPERATING_LINES), txt(SHORTAGE_DETAIL_LINES));
  const fromCsv = s.run(txt(OPERATING_LINES), SHORTAGE_DETAIL_CSV);
  /* The prototype could only read the PDF. Both roads have to land on the
     same list, or the tab would answer differently depending on which
     export somebody happened to have. */
  assert.equal(fromCsv.text, fromPdf.text, "same list either way");
  assert.equal(fromCsv.detailDiagrams, fromPdf.detailDiagrams, "same diagrams");
});

test("a report it cannot use is named, not silently ignored", () => {
  const s = S();
  assert.equal(s.sniff(txt(OPERATING_LINES)), "op");
  assert.equal(s.sniff(txt(SHORTAGE_DETAIL_LINES)), "det");
  assert.equal(s.sniff(SHORTAGE_DETAIL_CSV), "det");
  assert.equal(s.sniff("GENIUS  DIAGRAM SUMMARY REPORT\nDiagram Summary for: 03/08/26"),
    "sum", "the weekday Summary is recognised so the panel can redirect it");
  assert.equal(s.sniff("nothing to do with any of this"), null);
});

test("a print time outside the windows says so rather than guessing", () => {
  /* The windows the depot supplied cover a report run between one and eight
     in the morning, and one run between eight and six. There is no rule yet
     for one run later than that, and a shortage list that quietly dropped
     every Not Allocated line would be worse than one that says why. */
  const late = OPERATING_LINES.map(l => l.replace("Time:  05:30", "Time:  20:25"));
  const res = S().run(txt(late), txt(SHORTAGE_DETAIL_LINES));
  assert.ok(res.reviews.some(r => /18:00/.test(r)),
    "the gap is on the review list: " + res.reviews.join(" | "));
});

test("the place codes are the roads, not the berthing books' stations", () => {
  /* A berthing sheet names the station a unit is put away at; a discrepancy
     is worked off a ROAD, so this list names the road. The two tables are
     deliberately apart, and this is the guard on anybody merging them. */
  const s = S(), D = built().SHEETS_DATA, C = built().SHEETS_CORE;
  const apart = [["ASHFDNS", "AFDS"], ["ASHFEBS", "AFES"], ["ASHFUPS", "AFUS"],
                 ["DOVERPS", "DVPS"], ["GRVPKUS", "GPUS"], ["VICTGCS", "VICS"]];
  for (const [code, road] of apart) {
    assert.equal(s.ABBR[code], road, code + " reads as the road");
    const name = D.CODE2NAME[code];
    const berth = name && C.BERTH_SHEETS[C.norm(name)];
    if (berth && berth[1])
      assert.notEqual(berth[1], road,
        code + " is the same in both tables now - was that meant?");
  }
  assert.ok(norm(s.MASTER_GROUPS).some(g => g.includes("AFDS")),
    "and the roads group back up for the list's own headings");
});
