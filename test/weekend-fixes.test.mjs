/* Regression tests for the weekend-pipeline and writer fixes: each one
   reproduces a fault that was found by probing the built file, and pins
   the behaviour that replaced it. No legacy counterpart - the frozen build
   has every one of these faults. */
import test from "node:test";
import assert from "node:assert/strict";
import { built, norm } from "./helpers/compare.mjs";
import { makeDocx, PRINTS_LINES, REISSUE_LINES, STABLED_PRINTS } from "./helpers/synth.mjs";

const N = built();
const zip = { un: b => N.fflate.unzipSync(b), z: f => N.fflate.zipSync(f) };
const enc = new TextEncoder(), dec = new TextDecoder();
const run = files => N.SheetsEngine.run(files, zip.un, zip.z);
const docx = (lines, name) => ({ name, bytes: makeDocx(lines, N.fflate) });
const text = (lines, name) => ({ name, bytes: enc.encode(lines.join("\n")) });
const csv = (lines, name) => ({ name, bytes: enc.encode(
  lines.map(l => l.split("\t").join(",")).join("\r\n")) });
const col1 = book => book.layout.cells
  .filter(c => c.c === 1 && c.v).sort((a, b) => a.r - b.r).map(c => String(c.v));
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
  assert.match(xml, /<c r="N3" s="\d+"><v>120<\/v><\/c>/, "MILES rounded, as a number");
  assert.match(xml, /<c r="E4" s="\d+"\/>/, "the blank POS is an empty ruled cell");
  assert.match(xml, /<c r="N4" s="\d+"\/>/, "and so is the unreadable mileage");
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
