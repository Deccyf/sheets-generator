/* The shortages and variations road: the ported engine, and the plumbing
   that was changed on the way in (one PDF reader, and a Diagram Detail that
   can arrive as the CSV export as well as the PDF). */
import test from "node:test";
import assert from "node:assert/strict";
import { built, norm } from "./helpers/compare.mjs";
import { OPERATING_LINES, SHORTAGE_DETAIL_LINES, SHORTAGE_DETAIL_CSV,
         SHORTAGE_OPERATING_CSV, SHORTAGE_SUMMARY_LINES,
         SHORTAGE_SUMMARY_CSV, MIDNIGHT_OPERATING_LINES,
         MIDNIGHT_DETAIL_LINES } from "./helpers/shortage-synth.mjs";

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

test("the Operating Report reads the same saved as printed", () => {
  /* Dropped as the .csv export the report read as nothing at all — the
     status line said "0 diagrams on the report" and the list came out
     empty, which reads exactly like a clean day. The export repeats the
     whole page header on every line and puts the data at the end, the same
     shape the Diagram Detail's export has, so it needs reading the same
     way. On the real 19/09 pair this was one length case and fifteen fleet
     mismatches being reported as none. */
  const s = S();
  const printed = s.run(txt(OPERATING_LINES), txt(SHORTAGE_DETAIL_LINES));
  const saved = s.run(SHORTAGE_OPERATING_CSV, txt(SHORTAGE_DETAIL_LINES));
  assert.equal(saved.rows, printed.rows, "same number of rows read");
  assert.equal(saved.diagrams, printed.diagrams, "over the same diagrams");
  assert.equal(saved.reportTime, printed.reportTime, "and the same print time");
  assert.equal(saved.text, printed.text, "so the list is the same list");
  assert.deepEqual(norm(saved.reviews), norm(printed.reviews));
  // blanks are real cells in the export, so an unallocated row keeps its shape
  const blank = SHORTAGE_OPERATING_CSV.split("\r\n")[0]
    .replace(/"375\/7","375713","NE"/, '"","","NE"');
  const [row] = s.parseOperatingCsv(blank).rows;
  assert.equal(row.allocated, null, "no unit allocated");
  assert.equal(row.resource, null);
  assert.equal(row.owning, "NE", "and the columns after it have not shifted left");
});

test("an unreadable Operating Report says so rather than showing a clean day", () => {
  const res = S().run("Page 1\nnothing that reads as a row\n", txt(SHORTAGE_DETAIL_LINES));
  assert.equal(res.rows, 0);
  assert.match(res.reviews[0],
    /No rows could be read from the Operating Report — the list below is empty because of that, not because the day was clean/,
    res.reviews.join(" | "));
});

test("two reports from different days are named as such", () => {
  const s = S();
  const otherDay = txt(SHORTAGE_DETAIL_LINES).replace(/18\/09\/26/g, "17/09/26");
  const res = s.run(txt(OPERATING_LINES), otherDay);
  assert.match(res.reviews[0],
    /The Operating Report is for 18\/09\/26 and the Diagram Detail for 17\/09\/26/,
    res.reviews.join(" | "));
  // and a matched pair says nothing of the sort
  assert.ok(!s.run(txt(OPERATING_LINES), txt(SHORTAGE_DETAIL_LINES)).reviews
    .some(r => /The Operating Report is for/.test(r)),
    "no false alarm on a matched pair");
});

test("the Diagram Summary reads the same saved as printed", () => {
  /* The optional third report, and the only one that carries POS. Asked
     after the Operating Report's export turned out not to read: this one
     always did, and a test keeps it that way. */
  const s = S();
  const op = txt(OPERATING_LINES), det = txt(SHORTAGE_DETAIL_LINES);
  const printed = s.run(op, det, txt(SHORTAGE_SUMMARY_LINES));
  const saved = s.run(op, det, SHORTAGE_SUMMARY_CSV);
  assert.equal(saved.positions, true, "the export's POS column is read");
  assert.equal(saved.text, printed.text, "so the list is the same list");
  // and the case that needs POS comes out of both
  assert.match(saved.text, /3 CAR INTER VICE END \(RM302\/RM905\)/);
});

test("the lettered layout gives every case its own letter and the fleet one", () => {
  /* The depot's own hand, and what it refers to on the telephone: "B" is
     one train, the last letter is the whole fleet list. */
  const res = S().run(txt(OPERATING_LINES), txt(SHORTAGE_DETAIL_LINES),
                      txt(SHORTAGE_SUMMARY_LINES));
  const heads = res.lettered.split("\n").filter(l => /^[A-Z]+\)\t/.test(l));
  assert.deepEqual(norm(heads.map(l => l.split(")")[0])), ["A", "B", "C", "D"],
    "three cases and then the fleet block: " + heads.join(" | "));
  assert.match(heads[0], /^A\)\t3 CAR WRONG END \(RM301\/RM901\)/);
  assert.match(heads[1], /^B\)\t3\.375 V 4\.375 \(RM903\)/);
  assert.match(heads[2], /^C\)\t3 CAR INTER VICE END \(RM302\/RM905\)/);
  assert.match(heads[3], /^D\)\t375 V 375\/9 \(RM905\)/, "the fleet list shares the last letter");
  // a case's own note is set off by a blank line and aligned, not stepped in
  const lines = res.lettered.split("\n");
  const at = lines.findIndex(l => /FOLLOWING 3 V 4/.test(l));
  assert.equal(lines[at], "\tFOLLOWING 3 V 4: 2W14 06 36 RAM - CHX");
  assert.equal(lines[at - 1], "", "a blank line above it");
  // every fleet line sits under D, and no line is left without its indent
  assert.ok(res.lettered.split("\n").every(l => l === "" || /^([A-Z]+\))?\t/.test(l)),
    "every line is either a letter or indented under one");
  // the same lines as the plain layout, just laid out differently
  const strip = t => t.split("\n").map(l => l.replace(/^[A-Z]+\)\t|^\t/, "").trim())
    .filter(Boolean).join("\n");
  assert.equal(strip(res.lettered), strip(res.text), "one list, two layouts");
});

test("past Z the letters carry rather than starting again", () => {
  const S2 = S();
  const many = Array.from({ length: 28 }, (_, i) => ["x" + i]);
  // exercised through the only door there is: a list built from 28 blocks
  assert.equal(S2.letterList(many).split("\n\n")[26].split(")")[0], "AA");
  assert.equal(S2.letterList(many).split("\n\n")[27].split(")")[0], "AB");
});

test("the fleet block can be gathered by which way round instead of by place", () => {
  /* Two ways of reading one block. By place is how you read it standing at
     a depot — these are the ones coming to me. By which way round is how
     you read it looking for a unit — the 9s that are out, then the 9s that
     are missing, each in diagram order. */
  const s = S();
  const args = [txt(OPERATING_LINES), txt(SHORTAGE_DETAIL_LINES), txt(SHORTAGE_SUMMARY_LINES)];
  const place = s.run(...args);
  const family = s.run(...args, { fleetOrder: "family" });
  const fleetOf = r => r.text.split("\n\n").filter(b => /^375/.test(b))
    .flatMap(b => b.split("\n"));
  assert.deepEqual(norm(fleetOf(family)), norm([
    "375/9 V 375 (RM002) ENDS 2R06 05 55 AFK - RAM (ARR 07 08)",
    // the working that carries one of each keeps a block of its own
    "375/9 V 375 (RM004) ENDS 2T10 08 10 TON - CHX (ARR 09 30)",
    "375 V 375/9 (RM904) ENDS 2T10 08 10 TON - CHX (ARR 09 30)",
    "375 V 375/9 (RM901) ENDS 5F85 15+49 DVP - CST (ARR 16+15)",
    "375 V 375/9 (RM905) ENDS 2X01 07 10 RAM - CHX (ARR 09 20)",
  ]), "one way round, the swapped pair, then the other, each in diagram order");
  const blockOf = r => r.text.split("\n\n").filter(b => /^375/.test(b))
    .map(b => b.split("\n").map(l => (/\((RM\d+)\)/.exec(l) || [])[1]));
  assert.deepEqual(norm(blockOf(family)),
    norm([["RM002"], ["RM004", "RM904"], ["RM901", "RM905"]]),
    "the pair is together, not filed one under each way round");
  // the same lines either way — only their order and grouping differ
  assert.deepEqual(norm(fleetOf(family).slice().sort()),
                   norm(fleetOf(place).slice().sort()),
                   "no line is gained or lost by the grouping");
  // and the top cases are untouched by it
  assert.equal(family.counts.top, place.counts.top);
});

test("arrival times can be kept for Ramsgate and dropped everywhere else", () => {
  const s = S();
  const args = [txt(OPERATING_LINES), txt(SHORTAGE_DETAIL_LINES), txt(SHORTAGE_SUMMARY_LINES)];
  const all = s.run(...args), ram = s.run(...args, { arr: "ram" });
  const arrLines = t => t.split("\n").filter(l => /\(ARR /.test(l));
  assert.ok(arrLines(all.text).length > arrLines(ram.text).length, "some go");
  /* What is left is every line that ENDS at Ramsgate — station or depot —
     and nothing else. "RAM - CHX" ends at Charing Cross, so it loses its
     arrival; "AFK - RAM" keeps it. */
  for (const l of arrLines(ram.text))
    assert.match(l, / - RA[MS]?\w* \(ARR | - RE \(ARR /, "kept only into Ramsgate: " + l);
  assert.match(ram.text, /375\/9 V 375 \(RM002\) ENDS 2R06 05 55 AFK - RAM \(ARR 07 08\)/);
  assert.match(ram.text, /375 V 375\/9 \(RM901\) ENDS 5F85 15\+49 DVP - CST$/m,
    "and dropped off the rest: " + ram.text);
  // every other word of the line is untouched
  assert.deepEqual(norm(ram.text.split("\n").map(l => l.replace(/ \(ARR [^)]*\)/, ""))),
                   norm(all.text.split("\n").map(l => l.replace(/ \(ARR [^)]*\)/, ""))),
                   "only the arrival goes");
});

test("a reciprocal 375 / 375-9 swap on one working is listed, both halves", () => {
  /* RM004 has the 375/9 RM904 was planned and RM904 has RM004's plain 375,
     on the same working. These used to cancel each other out on the
     reasoning that every car is there and only the badges are crossed —
     but the swap still has to be undone, and a sheet that says nothing
     about it cannot be worked from. The depot's own list carries both
     halves (RM035 and RM920 on the 5H04 19+17 HGS - XSE), so this does. */
  const res = S().run(txt(OPERATING_LINES), txt(SHORTAGE_DETAIL_LINES));
  assert.match(res.text, /^375\/9 V 375 \(RM004\) ENDS 2T10 08 10 TON - CHX/m,
    "the one carrying the 9: " + res.text);
  assert.match(res.text, /^375 V 375\/9 \(RM904\) ENDS 2T10 08 10 TON - CHX/m,
    "and the one missing it");
});

test("a diagram that runs past midnight ends where it really ends", () => {
  /* The Operating Report writes plain times of day, so the last working of
     a diagram that finishes in the small hours carries the SMALLEST numbers
     on its list and sorted to the top of the morning — and was therefore
     never picked as the ending. On the Saturday 19/09 report RM020 came out
     "ENDS 1H82 22 30 HGS - CHX" when it really finishes at 01+27 into
     Tonbridge, and RM027 at 23 44 when it goes on to the DM siding at
     00+51. Ten diagrams of forty-one were wrong that way. */
  const res = S().run(txt(MIDNIGHT_OPERATING_LINES), txt(MIDNIGHT_DETAIL_LINES));
  assert.match(res.text, /^375\/9 V 375 \(RM007\) ENDS 5R94 00\+20 DVP - DVPS \(ARR 00\+45\)$/m,
    "the 00:20 off Dover is the ending, not the 22:10 off the sidings: " + res.text);
});

test("a diagram worked by two units is not carried into the next day", () => {
  /* The report groups a diagram's rows by the UNIT that worked them and not
     in one time order: RM008 lists 375931's midday-to-night block first and
     375932's morning block after it. Rolling the clock over the whole
     diagram would push that morning past midnight and make the 10:30 its
     latest working — which is what a first attempt at the rule above did to
     RM919 and RM921 on the real 18/09 report. Each run of rows sharing a
     unit keeps its own clock. */
  const res = S().run(txt(MIDNIGHT_OPERATING_LINES), txt(MIDNIGHT_DETAIL_LINES));
  assert.match(res.text, /^375\/9 V 375 \(RM008\) ENDS 5H16 22\+03 HGS - XSE \(ARR 22\+30\)$/m,
    "the night working, not the morning one carried forward: " + res.text);
  assert.ok(!/RM008\) ENDS 1H74/.test(res.text), "the 10:30 is not its ending");
});
