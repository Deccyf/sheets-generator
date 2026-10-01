/* Regression tests for the weekend-pipeline and writer fixes: each one
   reproduces a fault that was found by probing the built file, and pins
   the behaviour that replaced it. No legacy counterpart - the frozen build
   has every one of these faults. */
import test from "node:test";
import assert from "node:assert/strict";
import { built, norm } from "./helpers/compare.mjs";
import { makeDocx, PRINTS_LINES, REISSUE_LINES, RUN_ROUND_PRINTS,
         SECTION_TURN_PRINTS, STABLED_PRINTS } from "./helpers/synth.mjs";
import { hsWeekCsv } from "./helpers/hs-synth.mjs";

const N = built();
const zip = { un: b => N.fflate.unzipSync(b), z: f => N.fflate.zipSync(f) };
const enc = new TextEncoder(), dec = new TextDecoder();
const run = files => N.SheetsEngine.run(files, zip.un, zip.z);
const docx = (lines, name) => ({ name, bytes: makeDocx(lines, N.fflate) });
const text = (lines, name) => ({ name, bytes: enc.encode(lines.join("\n")) });
const csv = (lines, name) => ({ name, bytes: enc.encode(
  lines.map(l => l.split("\t").join(",")).join("\r\n")) });
/* A book's pages: the mainline roads are berthing books with one layout,
   Metro and High Speed are the depot's own documents and carry a worksheet
   each. */
const pagesOf = book => book.sheets ? book.sheets.map(s => s.layout)
                      : (book.layout ? [book.layout] : []);
const col1 = book => pagesOf(book)
  .reduce((a, l) => a.concat(l.cells.filter(c => c.c === 1 && c.v)
    .sort((x, y) => x.r - y.r).map(c => String(c.v))), []);
const reviewLines = res => res.books.filter(b => !b.skipped)
  .flatMap(b => b.report.split("\n").filter(l => l.startsWith("- ")));
const sheetXml = (bytes, n) => dec.decode(zip.un(bytes)["xl/worksheets/sheet" + (n || 1) + ".xml"]);

/* A tiny set of prints whose only point is the times: two Dover Priory
   starters 175 minutes apart, which is under BREAK_GAP and must not rule. */
const timed = (t1, t2) => [
  "Diagram:\tGT\t501\tSat", "Fleet:\t375/6", "From:\t01/08/2026",
  "\t\tDover PSd\t\t" + t1[0] + "\t5B01\t\t\t",
  "\t\tDover P\t" + t1[1] + "\t" + t1[2] + "\t1B01\t\t\t",
  "\t\tCX\t" + t1[3] + "\t\t\t#\t\t",
  "Diagram:\tGT\t502\tSat", "Fleet:\t375/6", "From:\t01/08/2026",
  "\t\tDover PSd\t\t" + t2[0] + "\t5B03\t\t\t",
  "\t\tDover P\t" + t2[1] + "\t" + t2[2] + "\t1B03\t\t\t",
  "\t\tCX\t" + t2[3] + "\t\t\t#\t\t",
];

test("a .docx base with a CSV reissue produces no updated document, and says why", () => {
  /* The reissue's data was merged into the books, the splice into
     document.xml was skipped because the reissue had no paragraphs, and the
     UNCHANGED base came back as <base>_UPDATED.docx while the review said
     "reissue merged" - the superseded prints under a name that says they are
     current, which is the worst thing this tool can hand a depot. */
  const res = run([docx(PRINTS_LINES, "P.docx"), csv(REISSUE_LINES, "P reissue.csv")]);
  assert.deepEqual(norm(res.merge.replaced), ["GT 502"], "the reissue was merged");
  assert.equal(res.updated, null, "no _UPDATED.docx is produced");
  for (const b of res.books.filter(b => !b.skipped))
    assert.match(b.report,
      /updated prints document not produced — the reissue was not a Word document, so its diagrams could not be spliced in — the books above still use the merged data/,
      b.name + " says why");
  // the other way round names the base as the reason
  const pasted = run([text(PRINTS_LINES, "P.txt"), text(REISSUE_LINES, "P reissue.txt")]);
  assert.equal(pasted.updated, null);
  assert.match(pasted.books[0].report, /not produced — the base prints are not a Word document/);
  // and with both .docx the document is produced, as before
  assert.ok(run([docx(PRINTS_LINES, "P.docx"), docx(REISSUE_LINES, "P reissue.docx")]).updated);
});

test("a time with its leading zero dropped reads as the time it is", () => {
  /* "6:40" is what a spreadsheet makes of 06:40. Fixed character positions
     read it as 06 04 - so every rule timed off it (the double lines, the
     AM/PM cut, the break gaps) was up to fifty minutes out while the cell
     still printed the raw text. */
  const padded = run([text(timed(["06:30", "06:35", "06:40", "08:00"],
                                 ["09:25", "09:30", "09:35", "11:00"]), "p.txt")]);
  const stripped = run([text(timed(["6:30", "6:35", "6:40", "8:00"],
                                   ["9:25", "9:30", "9:35", "11:00"]), "p.txt")]);
  const doubles = b => b.layout.cells.filter(c => c.c === 1 && c.sides[3] === "double").map(c => c.r);
  assert.deepEqual(norm(doubles(padded.books[0])), [], "175 minutes is not a break");
  assert.deepEqual(norm(doubles(stripped.books[0])), [], "…however the zero is written");
  assert.deepEqual(norm(col1(stripped.books[0])), norm(col1(padded.books[0])),
    "and the printed cell reads 06:40, zero restored");
  assert.deepEqual(norm(col1(stripped.books[0])), ["DOVER PRIORY", "06:40 CHX", "09:35 CHX"]);
  // the whole layout is the same book
  const shape = b => b.layout.cells.map(c => [c.r, c.c, c.v, c.look, c.sides]);
  assert.deepEqual(norm(shape(stripped.books[0])), norm(shape(padded.books[0])));
  // seconds, as a re-save adds them, are ignored; a dotted time keeps its dot
  const secs = run([text(timed(["06:30:00", "06:35:00", "06:40:00", "08:00:00"],
                               ["09:25:00", "09:30:00", "09:35:00", "11:00:00"]), "p.txt")]);
  assert.deepEqual(norm(col1(secs.books[0])), ["DOVER PRIORY", "06:40 CHX", "09:35 CHX"]);
});

test("a Metro pair covering several days gets a worksheet per location per day", () => {
  /* Every day's entries used to fold into ONE sheet per location, dated day
     one, so Tuesday's 05+00 sat under Monday's date as if the unit left
     twice. */
  const M = N.SHEETS_METRO;
  const mk = (t, diag) => ({ time: t, time_kind: "ecs", dest: "CST", headcode: "5S08",
    units: [{ diag, code: "SG", pos: 1, ends: "GP PM", miles: 100 }] });
  const two = { M: new Map([["DARTFORD", [mk(300, "401")]], ["GROVE PARK", [mk(300, "402"), mk(1230, "403")]]]),
                T: new Map([["DARTFORD", [mk(305, "411")]]]) };
  const labels = { M: "MON 03/08", T: "TUE 04/08" }, dates = { M: "03/08/26", T: "04/08/26" };
  const sh = M.sheetsFor(two, labels, ["DARTFORD", "GROVE PARK"], dates);
  assert.deepEqual(norm(sh.map(s => s.name)),
    ["DARTFORD MON", "DARTFORD TUE", "GROVE PARK AM MON", "GROVE PARK PM MON"],
    "named <LOCATION> <DAY>, the location's days together");
  for (const s of sh) assert.ok(s.name.length <= 31, "Excel takes 31 characters in a tab name");
  const at = s => new Map(s.layout.cells.map(c => [c.r + "," + c.c, c.v]));
  assert.equal(at(sh[0]).get("1,13"), "MON 03/08", "Monday's sheet carries Monday's date");
  assert.equal(at(sh[1]).get("1,13"), "TUE 04/08", "and Tuesday's Tuesday's");
  assert.ok(sh[1].layout.cells.some(c => c.v === "DATED 04.08.26"), "down to the sign-off");
  assert.deepEqual(norm(sh[1].layout.cells.filter(c => c.c === 6 && c.r > 2 && c.v).map(c => c.v)),
    ["SG411"], "with only that day's rows on it");
  assert.match(at(sh[0]).get("1,1"), /^SERVICES STARTING DARTFORD MONDAY/,
    "the title still names the location, not the tab");
  assert.equal(sh.notes.length, 1, "and the review list is told");
  assert.match(sh.notes[0], /MON 03\/08, TUE 04\/08/);
  assert.match(sh.notes[0], /<LOCATION> MON/);
  // one day's input keeps today's names, byte for byte
  const one = M.sheetsFor({ M: two.M }, { M: labels.M }, ["DARTFORD", "GROVE PARK"], { M: dates.M });
  assert.deepEqual(norm(one.map(s => s.name)), ["DARTFORD", "GROVE PARK AM", "GROVE PARK PM"]);
  assert.deepEqual(norm(one.notes), [], "and nothing to say");
  const single = M.sheetsFor({ M: two.M, T: two.T }, { M: labels.M }, ["DARTFORD"], dates);
  assert.deepEqual(norm(single.map(s => s.name)), ["DARTFORD", "GROVE PARK AM", "GROVE PARK PM"],
    "a day the labels do not name is not a day");
});

test("a figure that is not a number is never written as <v>NaN</v>", () => {
  /* A summary row with a blank POS reaches the Metro book as NaN, which is
     typeof "number", and went out as <v>NaN</v> - a workbook Excel repairs
     on opening. */
  const M = N.SHEETS_METRO, X = N.SHEETS_XLSX;
  const e = { time: 350, time_kind: "ecs", dest: "CST", headcode: "5C01",
    units: [{ diag: "201", code: "GN", pos: NaN, ends: "SGR PM", miles: NaN },
            { diag: "202", code: "GN", pos: 2, ends: "SGR PM", miles: 120.4 }] };
  const bytes = M.writeMetroBook({ M: new Map([["SLADE GREEN", [e]]]) }, { M: "MON 03/08" },
                                 ["SLADE GREEN"], zip.z, { M: "03/08/26" });
  const xml = sheetXml(bytes);
  assert.ok(!/<v>NaN<\/v>/.test(xml), "no NaN in the Metro sheet");
  // the unit with no position sorts last, so it is row 4
  assert.match(xml, /<c r="E3" s="\d+"><v>2<\/v><\/c>/, "a real POS is a number");
  // MILES is column P: the sheet is sixteen wide, two of them the depot's
  // unheaded spares between COMMENTS and S
  assert.match(xml, /<c r="P3" s="\d+"><v>120<\/v><\/c>/, "MILES rounded, as a number");
  assert.match(xml, /<c r="E4" s="\d+"\/>/, "the blank POS is an empty ruled cell");
  assert.match(xml, /<c r="P4" s="\d+"\/>/, "and so is the unreadable mileage");
  // the writer guards itself too: the berthing books' mileage column
  const lay = X.rowsToLayout([{ kind: "hdr", name: "ASHFORD", date: "X" },
    { kind: "data", vals: { 1: "05 05 VIC", 2: "4 377", 3: "102", 4: "", 5: "", 6: "", 7: "", 8: "", 9: NaN },
      top: "medium", bot: "thin", flag: false, flagSpan: 0 }], true);
  const wb = sheetXml(X.writeWorkbook([{ name: "T", layout: lay }], zip.z));
  assert.match(wb, /<c r="I2" s="\d+"\/>/, "an empty styled cell, not <v>NaN</v>");
  assert.ok(!/NaN/.test(wb));
});

test("the 395 arrivals table has one row per unit, with the arrival columns left blank", () => {
  /* The rows carried the previous day's DEPARTURE headcode and time under
     headings that say ARRIVAL TIME and TRAIN ID, and one row per stint - a
     unit out twice was listed twice. The reports do not carry the arrival,
     so those columns are the depot's to fill in. */
  const H = N.SHEETS_HS;
  const u = unit => ({ diag: "623", code: "AZ", am: "", pm: "AFK", ends: "AFK PM", unit });
  const yday = new Map([["ASHFORD", [
    { time: 594, time_kind: "ecs", dest: "STP", headcode: "5J05", units: [u("395010")] },
    { time: 986, time_kind: "ecs", dest: "STP", headcode: "5J13", units: [u("395010")] },
  ]], ["RAMSGATE", [
    { time: 700, time_kind: "pax", dest: "STP", headcode: "1J20",
      units: [{ ...u("395011"), diag: "624" }, { ...u("395012"), diag: "625" }] },
  ]]]);
  assert.deepEqual(norm(H.arrivalsInto("ASHFORD", yday)),
    [{ hc: "", at: "", unit: "395011", cars: "12" },
     { hc: "", at: "", unit: "395012", cars: "12" },
     { hc: "", at: "", unit: "395010", cars: "6" }],
    "one row per unit, in the order of their last stints (11 40, then 16+26), " +
    "TRAIN ID and ARRIVAL TIME blank");
  // and on the sheet itself
  const lay = H.layoutDay("T", { M: "03/08/26", T: "04/08/26" }, { M: yday, T: new Map() }, "M");
  const at = new Map(lay.cells.map(c => [c.r + "," + c.c, c.v]));
  const rows = [...lay.cells].filter(c => c.c === 4 && /^395/.test(c.v)).map(c => c.r);
  assert.equal(rows.length, 3, "three arrival rows");
  for (const r of rows) {
    assert.equal(at.get(r + ",2"), "", "TRAIN ID blank on row " + r);
    assert.equal(at.get(r + ",3"), "", "ARRIVAL TIME blank on row " + r);
  }
});

test("a Diagram: header without a day cell still starts its diagram", () => {
  /* A CSV save trims the trailing empty cells, so "Diagram:\tGN\t601" arrives
     with no day. The header failed the pattern and GN601's rows were folded
     into GT502 without a word - GT502 grew to fifteen rows. */
  const noDay = PRINTS_LINES.map(l => l.replace(/^(Diagram:\tGN\t601)\tSat$/, "$1"));
  const warn = [];
  const pd = N.SheetsEngine.parseDiagrams(noDay, warn);
  assert.deepEqual(norm([...pd.keys()]), ["GT|501", "GT|502", "GN|601"]);
  assert.equal(pd.get("GT|502").rows.length, N.SheetsEngine.parseDiagrams(PRINTS_LINES).get("GT|502").rows.length);
  assert.deepEqual(norm(warn), [], "nothing to report");
  const res = run([csv(noDay, "p.csv")]);
  assert.equal(res.diagrams, 3, "and the whole build sees three diagrams");
  // a header that still cannot be read is named, and its rows are left out
  const broken = PRINTS_LINES.map(l => l.replace(/^Diagram:\tGN\t601\tSat$/, "Diagram:\tGN 601"));
  const w2 = [];
  const pd2 = N.SheetsEngine.parseDiagrams(broken, w2);
  assert.deepEqual(norm([...pd2.keys()]), ["GT|501", "GT|502"]);
  assert.equal(pd2.get("GT|502").rows.length, 5, "not folded into the diagram before it");
  assert.equal(w2.length, 1);
  assert.match(w2[0][1], /a Diagram: line could not be read — “Diagram: GN 601” — the rows under it were left out/);
  const r2 = run([text(broken, "p.txt")]);
  assert.match(r2.books[0].report, /- not read: a Diagram: line could not be read/, "and the review list carries it");
});

test("two reissues carrying the same diagram count it once", () => {
  const res = run([docx(PRINTS_LINES, "P.docx"),
                   docx(REISSUE_LINES, "P reissue 1.docx"),
                   docx(REISSUE_LINES, "P reissue 2.docx")]);
  assert.deepEqual(norm(res.merge.replaced), ["GT 502"], "not GT 502, GT 502");
  assert.match(res.books[0].report, /- reissue merged: 1 diagram replaced from P reissue 1\.docx, P reissue 2\.docx/);
  assert.match(res.books[0].report, /- replaced by reissue: GT 502\n/);
});

test("a UTF-16 'Unicode' text save of the prints is read", () => {
  /* Notepad's Unicode save: a byte-order mark and two bytes a character.
     Read as UTF-8 that is one letter between NULs, which looked like nothing
     at all and was refused with "save it as plain text". */
  const s = PRINTS_LINES.join("\r\n");
  const le = new Uint8Array(2 + s.length * 2), be = new Uint8Array(2 + s.length * 2);
  le[0] = 0xFF; le[1] = 0xFE; be[0] = 0xFE; be[1] = 0xFF;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    le[2 + 2 * i] = c & 0xff; le[3 + 2 * i] = c >> 8;
    be[2 + 2 * i] = c >> 8;   be[3 + 2 * i] = c & 0xff;
  }
  const want = run([docx(PRINTS_LINES, "P.docx")]);
  const cols = r => r.books.filter(b => !b.skipped).map(col1);
  for (const [name, bytes] of [["little-endian", le], ["big-endian", be]]) {
    const got = run([{ name: "prints.txt", bytes }]);
    assert.equal(got.diagrams, want.diagrams, name + ": every diagram read");
    assert.deepEqual(norm(cols(got)), norm(cols(want)), name + ": the same books");
  }
});

test("the review list speaks plainly", () => {
  /* Every line: an em dash between clauses, real plurals, and no bare
     "order: ASHFORD 06 45" from the generic fall-through. */
  const odd = ["Diagram:\tGT\t701\tSat", "Fleet:\t375/6", "From:\t01/08/2026",
    "\t\tAshfrd DS\t\t06:45\t5A01\t\t\t", "\t\tAshford I\t06:50\t06:55\t2A01\t\t\t", "\t\tZzyzx Qq\t08:00\t\t\t#\t\t",
    "Diagram:\tGT\t702\tSat", "Fleet:\t375/6", "From:\t01/08/2026",
    "\t\tAshfrd DS\t\t06:45\t5A01\t\t\t", "\t\tAshford I\t06:50\t06:55\t2A01\t\t\t", "\t\tZzyzx Qq\t08:00\t\t\t#\t\t"];
  const r = run([text(odd, "p.txt")]);
  const lines = reviewLines(r);
  assert.ok(lines.includes("- ASHFORD 06:55: the prints give no position for these units, so the order is unchecked — compare it with the real book."),
    "the unchecked order has a real message: " + lines.join(" | "));
  assert.ok(lines.includes("- No code known for “Zzyzx Qq” — printed as ZZY. Check it. Seen at: ASHFORD 06:55, GT701, GT702"),
    "an unknown place is named once, with everywhere it was seen: " + lines.join(" | "));
  assert.match(r.books[0].report, /^SHEETS_SAT_01_AUG\.xlsx: 1 entry in 1 section\n/, "the header counts in the singular");
  // plurals and dashes across the fixtures
  const all = [
    ...reviewLines(run([docx(PRINTS_LINES, "P.docx")])),
    ...reviewLines(run([docx(STABLED_PRINTS, "P.docx")])),
    ...reviewLines(run([docx(PRINTS_LINES, "P.docx"), docx(REISSUE_LINES, "P reissue.docx")])),
    ...reviewLines(run([csv(PRINTS_LINES, "P.csv"), csv(REISSUE_LINES, "P reissue.csv")])),
    ...lines,
  ];
  assert.ok(all.some(l => /^- CX: 2 station dwells of 120 to 520 min treated as layovers, not berths$/.test(l)), all.join("\n"));
  assert.ok(all.some(l => /^- standing all day: 1 diagram stands all day and is not berthed: /.test(l)));
  assert.ok(all.some(l => /^- new section: 1 berthing at Lndon BrE, which is not in the section list — listed under LONDON BRIDGE$/.test(l)));
  assert.ok(all.some(l => /^- reissue merged: 1 diagram replaced from /.test(l)));
  for (const l of all) {
    assert.doesNotMatch(l, /\(s\)/, "no lazy plural: " + l);
    assert.doesNotMatch(l, / - /, "a dash is an em dash: " + l);
    assert.doesNotMatch(l, /weekly/, "there are no weekly prints: " + l);
  }
  // the drop-zone messages too
  assert.throws(() => run([docx(REISSUE_LINES, "only reissue.docx")]), /drop the full weekend prints/);
  assert.throws(() => run([docx(PRINTS_LINES, "a.docx"), docx(PRINTS_LINES, "b.docx")]),
    /drop one weekend prints file/);
  // and a .doc that cannot be read says what to do, not which structure was missing
  const doc = new Uint8Array(1024);
  [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1].forEach((b, i) => { doc[i] = b; });
  assert.throws(() => run([{ name: "prints.doc", bytes: doc }]),
    /^Error: That \.doc file couldn't be read\. Open it in Word, save it as \.docx, and drop the new file\.$/);
});

test("the Metro and 395 sheets stamp their times with the one shared formatter", () => {
  const fmt = N.SHEETS_CORE.fmtTime;
  const e = { time: 25 * 60 + 5, time_kind: "ecs", dest: "CST", headcode: "5S08",
    units: [{ diag: "401", code: "SG", pos: 1, ends: "GP PM", miles: 100 }] };
  const m = N.SHEETS_METRO.layoutSection("DARTFORD", [e], "MON 03/08", "03/08/26");
  assert.equal(m.cells.find(c => c.r === 3 && c.c === 2).v, fmt(e.time, e.time_kind));
  assert.equal(m.cells.find(c => c.r === 3 && c.c === 2).v, "01+05", "past midnight wraps");
  const hs = { M: new Map([["ASHFORD", [{ time: 300, time_kind: "pax", dest: "STP", headcode: "1J01",
    units: [{ diag: "601", code: "AZ", am: "", pm: "AFK", ends: "AFK PM", mg: 143 }] }]]]) };
  const h = N.SHEETS_HS.layoutDay("M", { M: "03/08/26" }, hs, null);
  assert.ok(h.cells.some(c => c.c === 12 && c.v === fmt(300, "pax")), "05 00 on the allocations side");
  /* the day-roll is the rulebook's, not a literal: 02:59 is the end of
     the previous day and goes on the PM sheet, 03:00 starts a new one */
  const DAY_ROLL = N.SHEETS_RULEBOOK.DAY_ROLL;
  const gp = t => ({ ...e, time: t });
  const sh = N.SHEETS_METRO.sheetsFor({ M: new Map([["GROVE PARK", [gp(DAY_ROLL - 1), gp(DAY_ROLL)]]]) },
    { M: "MON 03/08" }, ["GROVE PARK"], { M: "03/08/26" });
  assert.deepEqual(norm(sh.map(s => s.name)), ["GROVE PARK AM", "GROVE PARK PM"]);
});

test("the exports nothing used are gone, and the ones the tools use remain", () => {
  const gone = {
    SHEETS_XLSX: ["StyleBook", "buildSheetXml", "colName"],
    SHEETS_METRO: ["sheetFor", "destName"],
    SHEETS_HS: ["DEPOT_CODE"],
    SheetsEngine: ["dateBits"],
    SHEETS_PRINTS: ["readDoc", "readDocx", "readCfb", "xmlUnescape"],
    SHEETS_STOCKREQ: ["TYPES", "ROWS", "STYLES_XML"],
  };
  const kept = {
    SHEETS_XLSX: ["writeBooks", "bookOrder", "layoutSheet", "rowsToLayout", "writeWorkbook",
                  "previewHtml", "dayPreviewHtml", "esc", "printPlan", "BREAK_GAP"],
    SHEETS_METRO: ["writeMetroBook", "sheetsFor", "layoutSection", "fitWidths", "headings", "WIDTHS"],
    SHEETS_HS: ["writeHsBook", "sheetsFor", "layoutDay", "endsCode", "arrivalsInto", "DEPOTS"],
    SheetsEngine: ["run", "PROFILES", "docxParagraphs", "parseDiagrams", "looksLikePrints",
                   "printsFromCsv", "previewHtml", "resolveStation", "codeFor", "looksLikeStabling"],
    SHEETS_PRINTS: ["readPrints", "docxParagraphs", "docParaSpans", "isDocxBytes",
                    "looksLikePrints", "printsFromCsv", "csvParse"],
    SHEETS_STOCKREQ: ["layout", "write", "previewHtml", "unitCount", "XF_CSS"],
  };
  for (const mod of Object.keys(gone)) {
    for (const k of gone[mod]) assert.ok(!(k in N[mod]), mod + "." + k + " should be gone");
    for (const k of kept[mod]) assert.ok(k in N[mod], mod + "." + k + " should remain");
  }
  // the writer's own stylesheet carries only the house fonts now
  const bytes = N.SHEETS_XLSX.writeWorkbook([{ name: "T", layout: N.SHEETS_XLSX.rowsToLayout(
    [{ kind: "hdr", name: "ASHFORD", date: "X" }]) }], zip.z);
  const styles = dec.decode(zip.un(bytes)["xl/styles.xml"]);
  assert.match(styles, /<fonts count="6">/);
  assert.ok(!/<sz val="9"\/>/.test(styles), "no Calibri 9 - the allocation sheet brings its own");
  assert.match(styles, /<fills count="2">/);
  assert.ok(!styles.includes("applyFill"));
});

test("a plus in the clock is a time, not an unreadable cell", () => {
  /* The prints mark an EMPTY move with a plus where a passenger one has a
     dot — "05+30" against "06.30" — and 972 of the 5,418 clock cells in one
     Sunday's document are written that way. The reader's separator class was
     ":. " and never had the plus in it, so every empty departure came back
     null: sorted to the bottom of its section, its AM and PM berths worked
     out from a missing time, and the run-round rule never fired against it.
     The time itself always printed correctly, straight off the raw cell,
     which is what made a failed parse look like a deliberate grouping.

     The operator's own SUN 16/08 book settles the order: Ashford runs
     06 35, 07+18, 07+29, 07 30 — the empties in among the rest, by the
     clock, not gathered at the foot of the page. */
  const diag = (n, rows) =>
    ["Diagram:\tGT\t" + n + "\tSat", "Fleet:\t375/6", "From:\t01/08/2026"].concat(rows);
  const empty = diag(501, [                      // out empty, then works back
    "\t\tDover PSd\t\t05+20\t5B01\t\t\t",
    "\t\tDover P\t05+25\t05+30\t5B01\t\t\t",
    "\t\tAshford I\t06+10\t06.20\t1B01\t\t\t",
    "\t\tCX\t08:00\t\t\t#\t\t",
  ]);
  const pax = diag(502, [                        // and a later passenger one
    "\t\tDover PSd\t\t06.20\t1B03\t\t\t",
    "\t\tDover P\t06.25\t06.30\t1B03\t\t\t",
    "\t\tCX\t08:40\t\t\t#\t\t",
  ]);
  const timesOf = ls => Array.from(col1(run([docx(ls, "prints.docx")])
    .books.find(b => b.road === "Mainline")).filter(v => /^\d\d[ +]\d\d/.test(v)));
  assert.deepEqual(timesOf(empty.concat(pax)), ["05+30 AFK", "06 30 CHX"],
    "the 05+30 empty is read as half past five and leads the section");
  // the same two the other way round in the document still come out by the
  // clock, so this is the time being read rather than the order they arrived
  assert.deepEqual(timesOf(pax.concat(empty)), ["05+30 AFK", "06 30 CHX"],
    "whichever order the prints list them in");
});

test("the weekend builds the depot's own Metro and 395 documents", () => {
  /* The weekend panel used to draw all three roads with one layout - the
     8-column berthing grid, three times over, differing only in which
     diagrams landed on it - while the weekday panel had drawn the depot's
     own two documents properly for a long time. Everything those documents
     want was already worked out here, so they are handed the entries in the
     shape the weekday side hands them and the very same code draws them.

     The mileage is the piece that was missing: column 7 of the prints is a
     RUNNING total, the same figure the weekday reports carry as Cumulative
     Miles, and the reader stepped straight over it. */
  const lines = [
    "Diagram:\tGN\t601\tSat", "Fleet:\t465/9", "From:\t01/08/2026",
    "\t\tG Pk DnSd\t\t05+50\t5C01\t\t0.5\t601(1)\\602(2)",
    "\t\tG Pk\t05+55\t06.00\t2C01\t\t2.1\t",
    "\t\tC St\t06.40\t06.50\t2C02\t\t14.8\t",
    "\t\tG Pk\t07.30\t07+35\t5C03\t\t27.4\t",
    "\t\tG Pk UpSd\t07+40\t\t\t#\t28.0\t",
    "\t\tG Pk UpSd\t\t16+20\t5C05\t\t28.5\t",
    "\t\tG Pk\t16+25\t16.30\t2C06\t\t30.1\t",
    "\t\tC St\t17.10\t17.20\t2C07\t\t42.8\t",
    "\t\tG Pk\t18.00\t18+05\t5C08\t\t55.4\t",
    "\t\tG Pk Dep\t18+10\t\t\t#\t56.0\t",
    "Diagram:\tGN\t602\tSat", "Fleet:\t465/9", "From:\t01/08/2026",
    "\t\tG Pk DnSd\t\t05+50\t5C01\t\t0.5\t601(1)\\602(2)",
    "\t\tG Pk\t05+55\t06.00\t2C01\t\t2.1\t",
    "\t\tC St\t06.40\t06.50\t2C02\t\t14.8\t",
    "\t\tG Pk\t07.30\t07+35\t5C03\t\t27.4\t",
    "\t\tG Pk UpSd\t07+40\t\t\t#\t28.0\t",
  ];
  const res = run([docx(lines, "prints.docx")]);
  const metro = res.books.find(b => b.road === "Metro");
  assert.equal(metro.kind, "metro", "the Metro road is the depot's document");
  assert.equal(metro.name, "METRO_SHEETS_SAT_01_AUG.xlsx", "named the way the weekday one is");
  // Grove Park takes an AM and a PM sheet, the way the depot's workbook has it
  assert.deepEqual(Array.from(metro.sheets.map(s => s.name)),
                   ["GROVE PARK AM", "GROVE PARK PM"]);
  const at = new Map();
  for (const c of metro.sheets[0].layout.cells) at.set(c.r + "," + c.c, String(c.v || ""));
  const row = r => [1, 2, 5, 6, 8, 12, 15, 16].map(c => at.get(r + "," + c) || "");
  assert.deepEqual(Array.from(at.get("1,1")),
    Array.from("SERVICES STARTING GROVE PARK AM SATURDAY"),
    "and says which day it is for, not MONDAY TO FRIDAY");
  /* ROAD off the prints' own name for the road - "G Pk DnSd" is the down
     carriage holding sidings, which the depot writes DOWNS. S because the
     pair comes apart: 601 finishes in the depot, 602 on the up sidings.
     MILES is the diagram's day total, out of column 7. */
  assert.deepEqual(Array.from(row(3)),
    ["5C01", "05+50", "1", "GN601", "DOWNS", "Y", "GP PM", "56"]);
  assert.deepEqual(Array.from(row(4)),
    ["", "", "2", "GN602", "", "Y", "GPU AM", "28"]);
  // …and the afternoon re-departure comes off the UP sidings
  const pm = new Map();
  for (const c of metro.sheets[1].layout.cells) pm.set(c.r + "," + c.c, String(c.v || ""));
  assert.equal(pm.get("3,8"), "UPS", "the prints' G Pk UpSd is the depot's UPS");
  assert.equal(pm.get("3,2"), "16+20", "timed off the move off the road");
});

test("the weekend 395 book is the allocations sheet, mileage and all", () => {
  const lines = [
    "Diagram:\tAZ\t601\tSat", "Fleet:\t395/0", "From:\t01/08/2026",
    "\t\tAshfrd DS\t\t07+10\t5R09\t\t0.82\t",
    "\t\tAshford I\t07+36\t07.47\t2R09\t\t43.74\t",
    "\t\tRam\t08.52\t09.08\t1L23\t\t86.66\t",
    /* A row's figure is the total AFTER its own leg, so the last one to
       carry a number is the leg INTO the depot and the terminal row is
       blank - which is exactly how the real prints write it. */
    "\t\tStPancInt\t10.54\t11.07\t1L26\t\t242.56\t",
    "\t\tRam Depot\t12.40\t\t\t#\t\t",
  ];
  const res = run([docx(lines, "prints.docx")]);
  const hs = res.books.find(b => b.road === "High Speed");
  assert.equal(hs.kind, "hs", "the High Speed road is the allocations sheet");
  assert.equal(hs.name, "HS_SHEETS_SAT_01_AUG.xlsx");
  assert.equal(hs.sheets.length, 1, "a worksheet for the day");
  const at = new Map();
  for (const c of hs.sheets[0].layout.cells) at.set(c.r + "," + c.c, String(c.v || ""));
  const vals = [...at.values()];
  /* Timed off the FIRST MOVE, the way the operator's sheet is: 07+10 off the
     down sidings as 5R09, not the 07.47 out of the platform as 2R09. */
  assert.ok(vals.includes("07+10"), "the first move is the time: " + vals.join(" "));
  assert.ok(!vals.includes("07 47"), "not the platform departure");
  assert.ok(vals.includes("AZ601"), "under its own diagram");
  // MG is what this working runs: 242.56 less the 0 it started on
  assert.ok(vals.includes("243"), "with the working's mileage: " + vals.join(" "));
  assert.ok(vals.some(v => /ASHFORD UNIT ALLOCATIONS Saturday/.test(v)),
    "and the block is headed for the day it is: " + vals.join(" "));
});

test("a brief call at a shunt spur is a turnround, not a berthing", () => {
  /* The Sunday 06/09/26 prints turn the Sidcup service back through Sidcup
     Sidings: off the platform, two minutes in, nine to sixteen minutes
     standing, two minutes back out to form the next working. The place is
     named like a siding, so every one of those counted as putting the unit
     away - twenty-seven Sidcup lines in the Metro book and eight in the
     mainline one, for stands nobody berths a unit on.

     Same rule as the weekday side: a shunt spur splits a diagram only when
     the unit really stands there. A home berthing siding is not held to it -
     those list every re-departure however short the sit - and neither is a
     spur the unit stands PROPERLY on, which is a berthing like any other. */
  const diag = (n, rows) =>
    ["Diagram:\tGT\t" + n + "\tSat", "Fleet:\t375/6", "From:\t01/08/2026"].concat(rows);
  const turnback = diag(501, [
    "\t\tG Pk Dep\t\t07+03\t5N14\t\t6.8\t",
    "\t\tSidcup Sd\t07+31\t07+40\t5D28\t\t7.3\t",   // 9 minutes: a turnround
    "\t\tSidcup\t07+42\t07.48\t2D28\t\t19.2\t",
    "\t\tCX\t08.24\t\t\t#\t33.5\t",
  ]);
  const stand = diag(502, [
    "\t\tG Pk Dep\t\t07+03\t5N14\t\t6.8\t",
    "\t\tSidcup Sd\t07+31\t09+40\t5D28\t\t7.3\t",   // two hours: a berthing
    "\t\tSidcup\t09+42\t09.48\t2D28\t\t19.2\t",
    "\t\tCX\t10.24\t\t\t#\t33.5\t",
  ]);
  const timesAt = (lines, sec) => {
    const res = run([docx(lines, "prints.docx")]);
    const main = res.books.find(b => b.road === "Mainline");
    return { rows: col1(main).filter(v => /^\d\d[ +]\d\d/.test(v)),
             report: main.report };
  };
  const brief = timesAt(turnback);
  // the 07+03 off Grove Park stays - that is where the unit was put away.
  // What goes is the 07+40 back out of the sidings nine minutes later.
  assert.ok(brief.rows.some(v => /^07\+03/.test(v)),
    "the departure off the depot is still there: " + brief.rows.join(" | "));
  assert.ok(!brief.rows.some(v => /^07\+40/.test(v)),
    "the nine-minute call is not a departure of its own: " + brief.rows.join(" | "));
  assert.match(brief.report, /Sidcup Sd: 1 call of 9 min treated as a turnround/,
    "and the review says so, gathered by place");
  const long = timesAt(stand);
  assert.ok(long.rows.some(v => /^09\+40/.test(v)),
    "but two hours standing there is a berthing: " + long.rows.join(" | "));
});

test("a unit that turns round inside its section is listed the way up it leaves", () => {
  /* SG417 and SG418 came out of the Grove Park book as "1 SG418 / 2 SG417"
     against a 10+09 the prints show as 417(1)\418(2). The row is timed off
     the first move out of the section, but the formation was being read off
     the LAST one - and between the two the pair runs into the country end
     extension and comes back out the other way up. Anyone standing at Grove
     Park at 10+09 wrote both numbers in the wrong box. */
  const res = run([docx(SECTION_TURN_PRINTS, "prints.docx")]);
  const metro = res.books.find(b => b.road === "Metro");
  const page = metro.sheets.find(s => s.name === "GROVE PARK PM").layout;
  const at = (r, c) => {
    const cell = Array.from(page.cells).find(x => x.r === r && x.c === c);
    return cell ? String(cell.v) : "";
  };
  const diagRow = n => Array.from(page.cells)
    .filter(c => c.c === 6 && String(c.v) === n).map(c => c.r)[0];
  assert.equal(at(3, 1), "5H76", "the row is the 5H76");
  assert.equal(at(3, 2), "10+09", "timed off the first move out of the shed");
  assert.equal(at(3, 4), "TUNBRIDGE WELLS",
    "and still bound where the service it forms goes, not where it turns");
  assert.equal(at(diagRow("SG417"), 5), "1", "417 leads at 10+09");
  assert.equal(at(diagRow("SG418"), 5), "2", "418 is second at 10+09");
  // the 10+21 back out of the extension is 418(1)\417(2) - the way up the
  // row must NOT be dressed, and no second row of its own either
  assert.deepEqual(norm(col1(metro).filter(v => /^\d\d[+.:]\d\d$/.test(v))), [],
    "one entry for the pair, not one per leg");
});

test("a run-round that works nothing afterwards is not claimed to be listed", () => {
  /* Every run-round line read "— listed on its next departure instead",
     with the word "next" standing in wherever there was no time to name.
     On the Saturday 19/09 prints all five of them said that and none of the
     five was listed anywhere: SG462/463 ran into the Victoria East platform
     and stopped, RM905/906 onto the Ramsgate wash road, RM30 into the New
     Sidings. The depot was being sent to look for rows nobody had written. */
  const res = run([docx(RUN_ROUND_PRINTS, "prints.docx")]);
  const lines = reviewLines(res).filter(l => l.includes("run-round"));
  assert.equal(lines.length, 2, lines.join("\n"));
  assert.ok(lines.some(l => /GN621 runs round via Dart at 05.30 \(25 min\) — listed on its 05.30 departure instead/.test(l)),
    "one that does work afterwards names the time the row really carries: " + lines.join(" | "));
  assert.ok(lines.some(l => /GN622 runs round via S Gn at 05.32 \(4 min\) and works nothing afterwards, so it is not on a sheet/.test(l)),
    "and one that does not says so: " + lines.join(" | "));
  // and the claim holds: the only entry in the book is GN621's
  const metro = res.books.find(b => b.road === "Metro");
  const diags = metro.sheets.flatMap(s => Array.from(s.layout.cells)
    .filter(c => c.c === 6 && /^GN/.test(String(c.v))).map(c => String(c.v)));
  assert.deepEqual(norm(diags), ["GN621"], "GN622 really is on no sheet");
});

test("the weekend 395 sheet is filled from the print's stops and formations, as the weekday one is from the reports", async () => {
  /* The prints list only where a diagram does something - no calls in
     between - but they write the formation against every departure, leading
     unit first. That, the stops and the headcodes fill every column the
     weekday sheet fills from the reports; the units are left for the stock
     controller, and last night's arrivals come from the day before's
     Summary and Detail dropped with the print. */
  const D = n => ["Diagram:\tAZ\t" + n + "\tMO", "Fleet:\t395/0", "From:\t03/08/2026"];
  // a 12 out of the Down Sidings, straight to Margate as the print writes it
  const pair = [
    "\t\tAshfrd DS\t\t07+20\t5J21\t\t35.00\t605(1)\\606(2)",
    "\t\tMgate\t08+30\t08.45\t1J21\t\t127.00\t606(1)\\605(2)",
    "\t\tStPancInt\t10.15\t10.40\t1J24\t\t218.00\t605(1)\\606(2)",
    "\t\tMgate\t12.10\t12+25\t5J72\t\t223.00\t606(1)\\605(2)",
    "\t\tRam Depot\t12+45\t\t\t\t\t"];
  // Faversham: back to the Back Road at midday and out again at five
  const fav = [
    "\t\tFav\t\t09.30\t1F23\t\t51.00\t",
    "\t\tStPancInt\t10.35\t10.50\t1F24\t\t102.00\t",
    "\t\tFav\t11.55\t12+05\t5F24\t\t103.00\t",
    "\t\tFav Bk Rd\t12+30\t\t\t#\t\t",
    "\t\tFav Bk Rd\t\t17+10\t5F51\t\t104.00\t",
    "\t\tFav\t17+20\t17.30\t1F55\t\t155.00\t",
    "\t\tStPancInt\t18.35\t18.50\t1F56\t\t206.00\t",
    "\t\tFav\t19.55\t20+05\t5F56\t\t234.00\t",
    "\t\tRam Depot\t20+45\t\t\t\t\t"];
  // Ashford: back to the Down Sidings before noon, out again at 15+40
  const ash = [
    "\t\tAshfrd DS\t\t09+05\t5L23\t\t0.82\t",
    "\t\tAshford I\t09+15\t09.30\t1L23\t\t57.00\t",
    "\t\tStPancInt\t10.10\t10.40\t1L26\t\t113.00\t",
    "\t\tAshford I\t11.20\t11+30\t5L26\t\t113.82\t",
    "\t\tAshfrd DS\t11+45\t\t\t#\t\t",
    "\t\tAshfrd DS\t\t15+40\t5L47\t\t114.64\t",
    "\t\tAshford I\t15+50\t16.00\t1L47\t\t170.00\t",
    "\t\tStPancInt\t16.40\t17.10\t1L50\t\t226.00\t",
    "\t\tAshford I\t17.50\t18+00\t5L50\t\t226.82\t",
    "\t\tAshfrd DS\t18+15\t\t\t\t\t"];
  const lines = [...D(605), ...pair, ...D(606), ...pair, ...D(613), ...fav, ...D(608), ...ash];
  const hsPrev = await N.GENIUS.hsDaysFrom(hsWeekCsv("02/08/26"));
  const build = prev => N.SheetsEngine.run([docx(lines, "prints.docx")], zip.un, zip.z, { hsPrev: prev });
  const hs = build(hsPrev).books.find(b => b.road === "High Speed");
  const L = hs.sheets[0].layout, COLS = "ABCDEFGHIJKLMNOPQRST", SKIN = N.SHEETS_HS_SKIN;
  const g = new Map(), x = new Map();
  for (const c of L.cells) { g.set(c.r + COLS[c.c - 1], String(c.v || "")); x.set(c.r + COLS[c.c - 1], c.xf); }
  const notes = new Map(L.comments.map(c => [c.ref, c.text]));
  const rowsOf = diag => { const out = []; for (let r = 1; r <= L.maxRow; r++) if (g.get(r + "I") === diag) out.push(r); return out; };
  const at = (r, c) => g.get(r + c) || "";
  const yellow = (r, c) => /background:#FFFF00/.test(SKIN.xfCss[x.get(r + c)] || "");

  // the 12: London end first, off the printed order; each end it gets in at
  const [a6] = rowsOf("AZ606"), [a5] = rowsOf("AZ605");
  assert.equal(a5, a6 + 1, "the London end's line first");
  assert.deepEqual([at(a6, "H"), at(a6, "J"), at(a6, "M")], ["5J21 MAR", "M/O", "FP"]);
  assert.deepEqual([at(a5, "H"), at(a5, "J"), at(a5, "M")], ["", "M/O", "RP"]);
  assert.deepEqual([at(a6, "Q"), at(a6, "R"), at(a6, "S")], ["RAM", "5J72", "12+45 MIN"]);
  assert.equal(at(a5, "S"), "12+45 MAR");
  assert.equal(notes.get("I" + a6), "not over high level", "1J never calls at Gravesend");
  assert.equal(at(a6, "N"), "", "the unit is the stock controller's to fill in");

  // Faversham: one line for the day, the return in ENDS AM, the miles for the lot
  const f = rowsOf("AZ613");
  assert.equal(f.length, 1, "no second Faversham line: " + f);
  assert.deepEqual(["O", "P", "Q", "R", "S", "T", "K"].map(c => at(f[0], c)),
                   ["FAV", "12+30", "RAM", "5F56", "20+45", "", "234"]);
  assert.ok(!notes.has("I" + f[0]), "1F runs by Gravesend, so no note");

  // Ashford: the return, the working it goes out on, both marked
  const [m1, m2] = rowsOf("AZ608");
  assert.deepEqual(["O", "P", "T"].map(c => at(m1, c)), ["ASH", "11+45", "5L47"]);
  assert.ok(yellow(m1, "T") && yellow(m2, "H"), "WORKS and the working it names on yellow");
  assert.equal(at(m2, "H"), "5L47 AFK");
  assert.ok(m2 > m1 + 1, "under the bar");

  // last night's arrivals, from the day before's reports
  const t = [...g.entries()].find(([k, v]) => /^ASHFORD PM ARRIVALS/.test(v));
  assert.equal(t[1], "ASHFORD PM ARRIVALS Sunday 02/08/26");
  const r0 = parseInt(t[0], 10) + 2;
  assert.deepEqual(["B", "C", "D", "E"].map(c => at(r0, c)), ["5J60", "20+05", "395030", "6"]);
  assert.ok(!hs.report.includes("PM arrivals"), "nothing to say when they are there");
  // …and without them, the sheet says what to drop
  const bare = build(null).books.find(b => b.road === "High Speed");
  assert.match(bare.report, /PM arrivals: empty — drop the Diagram Summary and Diagram Detail for 02\/08\/26/);
});

test("the base diagrams for a timetable build any day of it, from the diagrams that run that day", () => {
  /* A base print carries a number once per day code and period - here AZ601
     Mondays to Thursdays (FSX) and again on Saturdays (SO), over a period,
     and a reissue for one engineering week. The books are built for a date,
     from what runs on it; the day before, where the timetable covers it,
     gives the 395 sheet its PM arrivals out of the same document. */
  const D = (days, from, until) => ["Diagram:\tAZ\t601\t" + days, "Fleet:\t395/0",
    "From:\t" + from + "\tUntil:\t" + until];
  const day = hc => [
    "\t\tAshfrd DS\t\t06+00\t5R" + hc + "\t\t0.82\t",
    "\t\tAshford I\t06+10\t06.20\t1J" + hc + "\t\t20.00\t",
    "\t\tMgate\t07.30\t07+40\t5J" + hc + "\t\t60.00\t",
    "\t\tRam Depot\t08+00\t\t\t\t\t"];
  const lines = [...D("FSX", "13/12/2026", "15/05/2027"), ...day("01"),
                 ...D("SO", "13/12/2026", "15/05/2027"), ...day("51"),
                 // an engineering week: Mondays to Thursdays differ 11-14/01
                 ...D("FSX", "11/01/2027", "14/01/2027"), ...day("71")];
  const build = forDate => N.SheetsEngine.run([text(lines, "base diagrams.txt")], zip.un, zip.z, { forDate });
  const hsCells = res => {
    const hs = res.books.find(b => b.road === "High Speed");
    return hs.sheets[0].layout.cells.map(c => String(c.v));
  };
  // no date: the first day the timetable runs anything - Monday 14/12
  const first = build(null);
  assert.deepEqual(norm(first.base), { from: "13/12/2026", until: "15/05/2027", date: "14/12/2026" });
  assert.ok(hsCells(first).includes("5R01 AFK"), "the Monday-to-Thursday diagram");
  // a Saturday is the SO one
  assert.ok(hsCells(build("19/12/2026")).includes("5R51 AFK"), "the Saturday diagram");
  // the engineering week's printing wins inside its week, not outside it
  assert.ok(hsCells(build("12/01/2027")).includes("5R71 AFK"));
  assert.ok(hsCells(build("19/01/2027")).includes("5R01 AFK"));
  // Tuesday's arrivals are Monday night's, out of the same base diagrams
  const tue = hsCells(build("15/12/2026"));
  assert.ok(tue.includes("RAMSGATE PM ARRIVALS Monday 14/12/26"), tue.filter(v => /ARRIVALS/.test(v)).join(" | "));
  assert.ok(tue.includes("5J01"), "the working it came in on");
  // a day nothing runs, and a date outside the period, say so
  assert.throws(() => build("13/12/2026"), /runs on a Sunday/);
  assert.throws(() => build("20/05/2027"), /outside these base diagrams/);
  // a day's own prints are untouched by any of it
  assert.equal(run([docx(PRINTS_LINES, "prints.docx")]).base, null);
});

test("the base diagrams build a week of books, a sheet per day type", () => {
  /* Every road gets one book for the week, a sheet per day type, named the
     way the depot's own base template names its tabs ("MAY MONDAY"). A day
     type is the days that run the same diagrams after the same night - so
     Tuesday to Thursday are one, but Monday stands alone: its arrivals are
     Sunday night's. */
  const D = (days, hc) => ["Diagram:\tAZ\t601\t" + days, "Fleet:\t395/0",
    "From:\t13/12/2026\tUntil:\t15/05/2027",
    "\t\tAshfrd DS\t\t06+00\t5R" + hc + "\t\t0.82\t",
    "\t\tAshford I\t06+10\t06.20\t1J" + hc + "\t\t20.00\t",
    "\t\tMgate\t07.30\t07+40\t5J" + hc + "\t\t60.00\t",
    "\t\tRam Depot\t08+00\t\t\t\t\t"];
  const lines = [...D("FSX", "01"), ...D("FO", "41"), ...D("SO", "51"), ...D("Su", "61")];
  const week = forDate => N.SheetsEngine.runWeek([text(lines, "base diagrams.txt")], zip.un, zip.z,
                                                  { forDate, splitRamsgate: true });
  const res = week(null);
  // the first full week of a timetable that starts on a Sunday
  assert.equal(res.base.week, "14/12/2026");
  assert.deepEqual(Array.from(res.base.types),
    ["DEC MONDAY", "DEC TUE-THU", "DEC FRIDAY", "DEC SATURDAY", "DEC SUNDAY"]);
  const hs = res.books.find(b => b.road === "High Speed");
  assert.equal(hs.name, "HS_SHEETS_BASE_WC_14_DEC.xlsx");
  assert.deepEqual(Array.from(hs.sheets, s => s.name), Array.from(res.base.types), "a tab per day type");
  // Monday's arrivals are Sunday night's, out of the same base diagrams
  const mon = hs.sheets.find(s => s.name === "DEC MONDAY").layout.cells.map(c => String(c.v));
  assert.ok(mon.includes("RAMSGATE PM ARRIVALS Sunday 12/26"), mon.filter(v => /ARRIVALS/.test(v)).join(" | "));
  assert.ok(mon.includes("5J61"), "Sunday's working in");
  const tue = hs.sheets.find(s => s.name === "DEC TUE-THU").layout.cells.map(c => String(c.v));
  assert.ok(tue.includes("ASHFORD UNIT ALLOCATIONS Tuesday to Thursday 12/26"));
  assert.ok(tue.includes("5J01"), "a weekday night's working in");
  assert.ok(hs.xlsx && hs.xlsx.length > 1000, "and a workbook to save");
  // another week, chosen by any date in it
  assert.equal(week("17/02/2027").base.week, "15/02/2027");
  // a day's own prints are built as that day, as before
  const day = N.SheetsEngine.runWeek([docx(PRINTS_LINES, "prints.docx")], zip.un, zip.z, {});
  assert.equal(day.base, null);
});

test("the base sheets note the modded-unit AZ1 diagrams and count AZ1 and AZ9 by where they start and end", () => {
  const D = (num, from, to) => ["Diagram:\tAZ\t" + num + "\tFSX", "Fleet:\t395/0",
    "From:\t13/12/2026\tUntil:\t15/05/2027",
    "\t\t" + from + "\t\t06+" + String(num % 60).padStart(2, "0") + "\t5R" + String(num % 100).padStart(2, "0") + "\t\t0.82\t",
    "\t\tAshford I\t07+00\t07.10\t1J" + String(num % 100).padStart(2, "0") + "\t\t20.00\t",
    "\t\t" + to + "\t08+00\t\t\t\t\t"];
  // and an AZ9 that stands all day at Faversham: left out of the count
  const stabled = ["Diagram:\tAZ\t902\tFSX", "Fleet:\t395/0", "From:\t13/12/2026\tUntil:\t15/05/2027",
                   "\t\tFav Bk Rd\t\t\t\tSTABLD\t\t"];
  const lines = [...D(101, "Ashfrd DS", "Ram Depot"), ...D(102, "Ashfrd DS", "Ashfrd DS"),
                 ...D(901, "Ram Depot", "Ashfrd DS"), ...D(601, "Ashfrd DS", "Ram Depot"), ...stabled];
  const res = N.SheetsEngine.runWeek([text(lines, "base diagrams.txt")], zip.un, zip.z, {});
  const hs = res.books.find(b => b.road === "High Speed");
  const L = hs.sheets[0].layout, COLS = "ABCDEFGHIJKLMNOPQRST";
  const v = (r, c) => String((L.cells.find(x => x.r === r && COLS[x.c - 1] === c) || {}).v || "");
  const rowOf = d => L.cells.find(x => x.c === 9 && x.v === d).r;
  const note = d => (L.comments.find(x => x.ref === "I" + rowOf(d)) || {}).text || "";
  // the AZ1 diagrams are the modded units', first on the note; the others are not
  assert.match(note("AZ101"), /^Modded unit only/);
  assert.match(note("AZ102"), /^Modded unit only/);
  assert.doesNotMatch(note("AZ901"), /Modded/);
  assert.doesNotMatch(note("AZ601"), /Modded/);
  // the table: where each series starts the day, and where it ends it
  const t = L.cells.find(x => /^AZ1 & AZ9 DIAGRAMS/.test(x.v)).r;
  assert.deepEqual([2, 3, 4, 5, 6].map(i => v(t + 1, COLS[i - 1])),
                   ["LOCATION", "AZ1 START", "AZ1 ENDS", "AZ9 START", "AZ9 ENDS"]);
  const rows = {};
  for (let r = t + 2; v(r, "B"); r++) rows[v(r, "B")] = [3, 4, 5, 6].map(i => v(r, COLS[i - 1]));
  assert.deepEqual(rows, { ASH: ["2", "1", "0", "1"], RAM: ["0", "1", "1", "0"],
                           TOTAL: ["2", "2", "1", "1"] },
    "AZ601 is in neither series, and the stabled AZ902 is not counted");
  // the note shows in the preview too, as Excel shows a comment
  assert.match(N.SHEETS_XLSX.previewHtml(L), /title="Modded unit only/);
  // and a day's own sheets have no such table
  const day = N.SheetsEngine.runWeek([docx(PRINTS_LINES, "prints.docx")], zip.un, zip.z, {});
  const dhs = day.books.find(b => b.road === "High Speed");
  assert.ok(!dhs || dhs.skipped || !dhs.sheets.some(s => s.layout.cells.some(x => /^AZ1 & AZ9/.test(x.v))));
});

test("the base diagrams as a document per day code - FX, FO, SO, SUN - build the whole week", () => {
  /* The base diagrams can come as four documents, one per day code, dropped
     together. They are one timetable: pooled, each number kept once per
     printing, the week comes out exactly as it does from one document. FX
     is Monday to Thursday and SUN Sunday, however the book writes it. */
  const D = (days, hc) => ["Diagram:\tAZ\t601\t" + days, "Fleet:\t395/0",
    "From:\t13/12/2026\tUntil:\t15/05/2027",
    "\t\tAshfrd DS\t\t06+00\t5R" + hc + "\t\t0.82\t",
    "\t\tAshford I\t06+10\t06.20\t1J" + hc + "\t\t20.00\t",
    "\t\tMgate\t07.30\t07+40\t5J" + hc + "\t\t60.00\t",
    "\t\tRam Depot\t08+00\t\t\t\t\t"];
  const parts = { FX: D("FX", "01"), FO: D("FO", "41"), SO: D("SO", "51"), SUN: D("SUN", "61") };
  const four = Object.entries(parts).map(([k, l]) => text(l, "BASE " + k + ".txt"));
  const one = [text([].concat(...Object.values(parts)), "BASE ALL.txt")];
  const week = inputs => N.SheetsEngine.runWeek(inputs, zip.un, zip.z, { splitRamsgate: true });
  assert.equal(N.SheetsEngine.printsKind(four, zip.un), "base", "read as base diagrams");
  const a = week(four), b = week(one);
  assert.deepEqual(Array.from(a.base.types),
    ["DEC MONDAY", "DEC TUE-THU", "DEC FRIDAY", "DEC SATURDAY", "DEC SUNDAY"], "the whole week");
  const cells = r => JSON.stringify(r.books.map(x => x.sheets
    ? x.sheets.map(s => s.layout.cells.map(c => String(c.v)))
    : x.skipped ? null : x.layout.cells.map(c => String(c.v))));
  assert.equal(cells(a), cells(b), "the same books as from one document");
  // each day type its own printing: Friday the FO one, Sunday the SUN one
  const hs = a.books.find(x => x.road === "High Speed");
  const on = name => hs.sheets.find(s => s.name === name).layout.cells.map(c => String(c.v));
  assert.ok(on("DEC TUE-THU").includes("5R01 AFK") && on("DEC FRIDAY").includes("5R41 AFK") &&
            on("DEC SUNDAY").includes("5R61 AFK"));
  // a day's weekend prints are still one document at a time
  assert.equal(N.SheetsEngine.printsKind([docx(PRINTS_LINES, "prints.docx")], zip.un), "day");
  assert.throws(() => run([docx(PRINTS_LINES, "a prints.docx"), docx(PRINTS_LINES, "b prints.docx")]),
    /More than one full prints document/);
});
