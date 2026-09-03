/* Regression tests for the weekday-pipeline fixes made in 2.7.x. Each one
   is the repro that found the fault, pinned. No legacy counterpart: every
   fault here is one the frozen build shares, so these pin stated behaviour
   rather than golden equivalence. Fixtures are inline. */
import test from "node:test";
import assert from "node:assert/strict";
import { built, norm } from "./helpers/compare.mjs";
import { makePdf, SUMMARY_LINES, DETAIL_LINES } from "./helpers/synth.mjs";

const N = built();
const G = N.GENIUS, C = N.SHEETS_CORE;
const fmt = e => C.fmtTime(e.time, e.time_kind);

/* ---- Integrale CSV shapes, as the repro wrote them ---- */
const HS = "Code,Cov,Type,Allocate Resource,Stock,Start Time,Position,First Train," +
  "Start Location,End Time,End Location,Distance,First Train Note,Start Stock," +
  "Last Train,Last Train Note,End Stock,Pre-assignment,Diagram Comments,Coverage Notes";
const HD = "Diagram Code,Diagram Date,Notes,Total Miles,Start Tiploc,Start Location Name," +
  "Start Time,Activity,Headcode,Cumulative Miles,Cumulative Fuel Miles,End Tiploc," +
  "End Location Name,End Time,Off Diagram,Works";
const srow = (d, fleet, pos, s, from, e, to) =>
  `${d},Covered,${fleet},,0,10/08/2026 ${s},${pos},0X00,${from},10/08/2026 ${e},${to},0,,,,,,${d},,`;
const leg = (d, a, an, at, hc, b, bn, bt) =>
  `${d},10/08/2026,,0,${a},${an},${at}:00,,${hc},0,,${b},${bn},${bt}:00,,`;

/* ---- Genius CSV shapes: every line repeats the header ---- */
const SHEAD = date => '"GENIUS","DIAGRAM SUMMARY REPORT",' +
  '"Diagram Summary for:"," ' + date + '","NOTES","NOTES",';
const gsum = (diag, fleet, pos, start, from, to, end, date = "03/08/26") =>
  SHEAD(date) + ['"' + diag + '"', "", '"' + fleet + '"', "0.00", pos,
    '"' + start + '"', '"' + from + '"', '"' + to + '"', '"' + end + '"',
    "0.00", "1.00", "1.00", "", ""].join(",");
const DHEAD = (d, date) => '"GENIUS","Diagram Detail Report",' +
  '"Diagram Details for:"," ' + date + '",' +
  '"Diagram","' + d + '","On","' + date + '","Notes",,"Miles","Fuel Miles",';
const gleg = (d, from, arr, dep, act, hc, to, toArr, date = "03/08/26") =>
  DHEAD(d, date) + ['"' + from + '"', '"' + from + '"',
    arr ? '"' + arr + '"' : "", dep ? '"' + dep + '"' : "",
    act ? '"' + act + '"' : "", '"' + hc + '"', "1.00", "1.00",
    '"' + to + '"', '"' + to + '"', '"' + toArr + '"'].join(",");

/* GT101/GT102 off the shared fixture, as a Genius CSV pair of their own */
const PAIR_SUM = [
  gsum("GT101", "375/6", 1, "05:30", "ASHFDNS", "DOVERPS", "23:50"),
  gsum("GT102", "375/6", 2, "05:30", "ASHFDNS", "ASHFEBS", "22:40"),
].join("\r\n");
const PAIR_DET = [
  gleg("GT101", "ASHFDNS", "", "05:30", "", "5A01", "ASHFKY", "05:35"),
  gleg("GT101", "ASHFKY", "05:35", "05:45", "", "2A01", "CHARX", "07:00"),
  gleg("GT101", "CHARX", "07:00", "09:00", "", "2A02", "ASHFKY", "10:30"),
  gleg("GT101", "ASHFKY", "10:30", "10:35", "", "5A03", "ASHFEBS", "10:40"),
  gleg("GT101", "ASHFEBS", "10:40", "14:00", "", "5A05", "ASHFKY", "14:05"),
  gleg("GT101", "ASHFKY", "14:05", "14:07", "", "2A06", "DOVERP", "15:30"),
  gleg("GT101", "DOVERP", "15:30", "15:40", "", "5A07", "DOVERPS", "23:50"),
  gleg("GT102", "ASHFDNS", "", "05:30", "", "5A01", "ASHFKY", "05:35"),
  gleg("GT102", "ASHFKY", "05:35", "05:45", "", "2A01", "CHARX", "07:00"),
  gleg("GT102", "CHARX", "07:00", "09:30", "", "2A04", "ASHFKY", "11:00"),
  gleg("GT102", "ASHFKY", "11:00", "11:05", "", "5A09", "ASHFEBS", "22:40"),
].join("\r\n");

const unitsOf = e => e.units.map(u => u.diag + "{am=" + u.am + ",pm=" + u.pm + "}").join(" ");

test("1. a Genius Detail CSV re-saved by Excel keeps its arrival stops", async () => {
  /* Excel drops the leading zero and appends seconds ("9:10:00"). The
     from-side already read that tolerantly; the to-side did not, so every
     arrival stop written that way was dropped without a word - GT102's day
     then ended at the Ashford platform instead of the East Sidings, and its
     AM/PM berths moved with it. */
  const mangle = s => s.replace(/"(\d\d):(\d\d)"/g, (m, h, mm) => '"' + (+h) + ":" + mm + ':00"');
  const clean = await G.build([PAIR_SUM, PAIR_DET]);
  const mangled = await G.build([mangle(PAIR_SUM), mangle(PAIR_DET)]);
  assert.deepEqual(norm(mangled.secsByDay), norm(clean.secsByDay),
    "the same books whichever way the cells are written");
  const ash = mangled.secsByDay.M.get("ASHFORD");
  const first = ash.find(e => e.headcode === "2A01");
  assert.ok(first, "the 05 45 off Ashford is there");
  assert.equal(unitsOf(first), "102{am=,pm=AFE} 101{am=AFE,pm=DVP}",
    "102 still ends in the East Sidings at 22 40");
});

test("2. a berth-to-berth shunt inside one section is not timed off the next stint", () => {
  /* AX001: down sidings 14:41 -> platform -> east sidings 14:50, out again
     16:27 for the 16 35. The stint walk ran to the stint's END boundary,
     which is the next stint's origin, so the shunt printed as "16+27 AFK"
     - the following departure's time and headcode - and the real 16 35 DVP
     entry sat under it. */
  const s = [HS, srow("AX001", "375/6", 1, "05:00", "ASHFDNS", "22:10", "DOVERPS")].join("\r\n");
  const d = [HD,
    leg("AX001", "ASHFDNS", "Ashford Down Sidings", "05:00", "5A20", "ASHFKY", "Ashford", "05:03"),
    leg("AX001", "ASHFKY", "Ashford", "05:05", "2A20", "DOVERP", "Dover Priory", "06:00"),
    leg("AX001", "DOVERP", "Dover Priory", "13:00", "2A40", "ASHFKY", "Ashford", "14:00"),
    leg("AX001", "ASHFKY", "Ashford", "14:10", "5A52", "ASHFDNS", "Ashford Down Sidings", "14:20"),
    leg("AX001", "ASHFDNS", "Ashford Down Sidings", "14:41", "5A60", "ASHFKY", "Ashford", "14:45"),
    leg("AX001", "ASHFKY", "Ashford", "14:47", "5A60", "ASHFEBS", "Ashford East Bth Sdgs", "14:50"),
    leg("AX001", "ASHFEBS", "Ashford East Bth Sdgs", "16:27", "5A70", "ASHFKY", "Ashford", "16:30"),
    leg("AX001", "ASHFKY", "Ashford", "16:35", "2A70", "DOVERP", "Dover Priory", "17:30"),
    leg("AX001", "DOVERP", "Dover Priory", "22:00", "5A80", "DOVERPS", "Dover Priory Sidings", "22:10")].join("\r\n");
  const r = G.buildIntegrale([s, d]);
  const ash = r.secsByDay.M.get("ASHFORD");
  const rows = ash.map(e => fmt(e) + " " + e.dest + " " + e.headcode);
  assert.equal(ash.length, 3, "three Ashford departures: " + rows.join(" | "));
  assert.equal(rows[0], "05 05 DVP 2A20");
  assert.equal(rows[2], "16 35 DVP 2A70", "the real 16 35 is the last row");
  /* the shunt: timed inside its own stint, under its own headcode. (Whether
     Ashford times it off the sidings at 14+41 or the platform call at 14+47
     is the clean-call rule's business, not this test's.) */
  const shunt = ash[1];
  assert.equal(shunt.headcode, "5A60", "the shunt's own headcode, not the 16+27's");
  assert.ok(shunt.time >= 14 * 60 + 41 && shunt.time < 16 * 60 + 27,
    "timed within the shunt's own stint: " + rows[1]);
  assert.ok(!ash.some(e => e.time === 16 * 60 + 27 || e.headcode === "5A70"),
    "no row carries the next stint's 16+27 / 5A70: " + rows.join(" | "));
});

test("3. Folkestone East pairs the LATEST arrival with the earliest departure, past midnight too", () => {
  /* The Train Roads work last-in-first-out. Arrivals were keyed on the
     wall clock, so a 00 20 arrival sorted EARLIEST and the pairing came
     out backwards: the 05+00 got the 23 50 and the 06+00 the 00 20. */
  const S = [HS], D = [HD];
  for (const [i, d] of ["FK001", "FK002", "FK003"].entries()) {
    S.push(srow(d, "375/6", i + 1, "05:00", "FLKSETR", "23:50", "FLKSETR"));
    D.push(leg(d, "FLKSETR", "Folkestone ETR", "05:00", "5F01", "ASHFKY", "Ashford", "05:20"),
           leg(d, "ASHFKY", "Ashford", "05:30", "2F01", "CHARX", "Charing Cross", "06:40"),
           leg(d, "CHARX", "Charing Cross", "22:00", "2F90", "ASHFKY", "Ashford", "23:20"),
           leg(d, "ASHFKY", "Ashford", "23:30", "5F90", "FLKSETR", "Folkestone ETR", "23:50"));
  }
  for (const [i, d] of ["FK004", "FK005", "FK006"].entries()) {
    S.push(srow(d, "375/6", i + 1, "06:00", "FLKSETR", "00:20", "FLKSETR"));
    D.push(leg(d, "FLKSETR", "Folkestone ETR", "06:00", "5F02", "ASHFKY", "Ashford", "06:20"),
           leg(d, "ASHFKY", "Ashford", "06:30", "2F02", "CHARX", "Charing Cross", "07:40"),
           leg(d, "CHARX", "Charing Cross", "22:30", "2F92", "ASHFKY", "Ashford", "23:50"),
           leg(d, "ASHFKY", "Ashford", "00:00", "5F92", "FLKSETR", "Folkestone ETR", "00:20"));
  }
  const r = G.buildIntegrale([S.join("\r\n"), D.join("\r\n")]);
  const fke = r.secsByDay.M.get("FOLKESTONE EAST");
  const mid = t => fke.find(e => fmt(e) === t).units[1].end;
  assert.equal(mid("05+00"), "EX 00+20 ARR", "first out is formed by the last in");
  assert.equal(mid("06+00"), "EX 23+50 ARR", "second out by the one before it");
  const note = r.reviews.main.find(x => /EX 00\+20 ARR/.test(x.msg));
  assert.ok(note && !/ - /.test(note.msg), "the note is worded with an em dash: " + (note && note.msg));
});

test("4. a headshunt or depot extension berth prints the berth table's code", () => {
  /* Grove Park's headshunt and country-end extension and Slade Green's
     east headshunt are stabling places to the Genius engine but sit in
     NON_BERTH_VISIT, so amPm gave nothing for them and the resolver
     truncated the name to GRO / SLA - plus a cryptic "nocode" line. The
     berth table has a code for each; that is what prints. */
  const S = [HS, srow("GP001", "375/6", 1, "05:00", "GRVPKUS", "17:10", "GRVPUHS"),
                 srow("GP002", "375/6", 1, "05:30", "GRVPKUS", "17:40", "GRVPDCE"),
                 srow("SG003", "375/6", 1, "05:00", "SLADEGD", "17:10", "SLADGEH")].join("\r\n");
  const gp = (d, t0, home) => [
    leg(d, "GRVPKUS", "Grove Park Up C.H.S", t0, "5S0" + d[4], "GRVPK", "Grove Park", t0.replace(/:\d\d$/, ":05")),
    leg(d, "GRVPK", "Grove Park", t0.replace(/:\d\d$/, ":10"), "2S0" + d[4], "CANONST", "Cannon Street", "06:30"),
    leg(d, "CANONST", "Cannon Street", "16:00", "2S1" + d[4], "GRVPK", "Grove Park", "17:00"),
    leg(d, "GRVPK", "Grove Park", "17:05", "5S1" + d[4], home[0], home[1], "17:10")];
  const D = [HD,
    ...gp("GP001", "05:00", ["GRVPUHS", "Grove Park Up H"]),
    ...gp("GP002", "05:30", ["GRVPDCE", "Grove Park Dpt C"]),
    leg("SG003", "SLADEGD", "Slade Green T&R.S.M.D", "05:00", "5S03", "SLADEGN", "Slade Green", "05:05"),
    leg("SG003", "SLADEGN", "Slade Green", "05:10", "2S03", "CANONST", "Cannon Street", "06:00"),
    leg("SG003", "CANONST", "Cannon Street", "16:00", "2S13", "SLADEGN", "Slade Green", "17:00"),
    leg("SG003", "SLADEGN", "Slade Green", "17:05", "5S13", "SLADGEH", "Slade Green Dpt", "17:10")].join("\r\n");
  const r = G.buildIntegrale([S, D]);
  const pmOf = diag => {
    for (const [, list] of r.secsByDay.M)
      for (const e of list) for (const u of e.units) if (u.diag === diag) return u.pm;
    return "(not built)";
  };
  assert.equal(pmOf("001"), "GP", "the Up Headshunt is a Grove Park berth");
  assert.equal(pmOf("002"), "GP", "so is the country-end extension");
  assert.equal(pmOf("003"), "SG", "and the east headshunt a Slade Green one");
  const stray = r.review.filter(m => /nocode|No code known|\bGRO\b|\bSLA\b/.test(m));
  assert.deepEqual(Array.from(stray), [], "and nothing on the review list about it");
});

test("5. a Summary and a Detail for different dates say so, naming both", async () => {
  const sum = PAIR_SUM;
  const det = PAIR_DET.replace(/03\/08\/26/g, "04/08/26");
  await assert.rejects(() => G.build([sum, det]),
    /Diagram Summary is for 03\/08\/26[\s\S]*Diagram Detail for 04\/08\/26[\s\S]*same date/,
    "names the Summary's date, the Detail's date, and the rule");
  await assert.rejects(() => G.build([sum, det]), e => !/No weekday dates/.test(e.message),
    "and does not send anybody checking the calendar");
});

test("6. the platform turn reaches the first-move books, and inverts the section's direction", () => {
  /* Ramsgate New Sidings -> platform -> Margate turns (same side in and
     out); -> Minster runs straight. The rule never fired on the Metro and
     High Speed books, whose entries are timed off the first move: the
     platform search stopped at that move, which is the berth itself. And
     "turned" always sorted descending, which is only the inverse of a
     section that lists lowest Position first. */
  const S = [HS], D = [HD];
  const mk = (a, b, fleet, dest, dn, hcs) => {
    for (const [i, d] of [a, b].entries()) {
      S.push(srow(d, fleet, i + 1, "05:00", "RAMSNEW", "06:00", dest));
      D.push(leg(d, "RAMSNEW", "Ramsgate New Sidings", hcs[0], "5" + hcs[2], "RAMSGTE", "Ramsgate", hcs[1]),
             leg(d, "RAMSGTE", "Ramsgate", hcs[3], "1" + hcs[2], dest, dn, hcs[4]));
    }
  };
  mk("HT001", "HT002", "395/0", "MARGATE", "Margate", ["05:00", "05:05", "D01", "05:10", "05:30"]);
  mk("HT003", "HT004", "395/0", "MINSTER", "Minster", ["06:00", "06:05", "D03", "06:10", "06:30"]);
  mk("MT001", "MT002", "375/6", "MARGATE", "Margate", ["07:00", "07:05", "D05", "07:10", "07:30"]);
  mk("MT003", "MT004", "375/6", "MINSTER", "Minster", ["08:00", "08:05", "D07", "08:10", "08:30"]);
  const r = G.buildIntegrale([S.join("\r\n"), D.join("\r\n")]);
  const ord = book => [...r[book].M.get("RAMSGATE")].map(e =>
    fmt(e) + " " + e.dest + " -> " + e.units.map(u => u.diag).join(","));
  // mainline Ramsgate lists lowest Position first; turned, the other way up
  assert.deepEqual(ord("secsByDay"), ["07 10 MAR -> 002,001", "08 10 MSR -> 003,004"]);
  // the High Speed book lists highest first; turned, the other way up from THAT
  assert.deepEqual(ord("hsSecs"), ["05+00 MAR -> 001,002", "06+00 MSR -> 004,003"]);
  /* copied out of the sandbox realm: a strict deep-equal on its arrays
     fails on the prototype alone */
  const hsTurn = Array.from(r.rules.coupled).filter(c => c.bucket === "hs")
    .map(c => c.timeText + ":" + Array.from(c.ev).map(x => x.turn).join(","));
  assert.deepEqual(hsTurn, ["05+00:true,true", "06+00:false,false"],
    "the rule is seen to fire on the High Speed book");
});

test("7. a Summary PDF row with the POS cell blank is position 1, said out loud", () => {
  /* With POS blank the token before the start time is START FUEL, and
     parseInt("0.00") is 0 - a Position nothing has. Only a whole number is
     a Position; anything else is 1 with a note, as the CSV readers do. */
  const txt = "GENIUS  DIAGRAM SUMMARY REPORT\nDiagram Summary for: 03/08/26\n" +
    "GT101  375/6  MF  0.00  05:30  ASHFDNS  DOVERPS  23:50\n" +
    "GT102  375/6  MF  2  05:30  ASHFDNS  ASHFEBS  22:40\n";
  const notes = [];
  const rows = G.parseSummary(txt, notes);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].pos, 1, "blank POS reads as 1");
  assert.equal(rows[1].pos, 2, "a real POS is untouched");
  assert.ok(rows.every(r => Number.isInteger(r.pos)), "never NaN");
  assert.equal(notes.length, 1, "one note, for the one row");
  assert.match(notes[0], /03\/08\/26 GT101/, "naming the row");
  assert.match(notes[0], /no Position .* — taken as 1/, "and what was done about it");
  assert.equal(G.parseSummary(txt)[0].pos, 1, "and the notes list is optional");
});

test("8. whether the report carries the shunt column is settled once per date, over every fleet", async () => {
  /* A metro unit pausing at Dartford on the way home to the depot, never
     shunted there, and a mainline diagram elsewhere in the same report
     carrying the "#" that proves the column exists. The pause exception
     is gated on the column being there at all, and that used to be asked
     per fleet - so the metro book, whose own diagrams had no "#", printed
     the pause as a Dartford berthing. */
  const sum = [gsum("MN810", "465/9", 1, "22:38", "SLADEGN", "SLADEGD", "23:39"),
               gsum("GT811", "375/6", 1, "06:00", "ASHFDNS", "ASHFDNS", "08:25")].join("\r\n");
  const det = [
    gleg("MN810", "SLADEGN", "", "22:38", "", "2E73", "DARTFD", "22:45"),
    gleg("MN810", "DARTFD", "22:45", "22:50", "", "5E73", "DARTFDS", "22:53"),
    gleg("MN810", "DARTFDS", "22:53", "23:30", "", "5A73", "DARTFD", "23:33"),
    gleg("MN810", "DARTFD", "23:33", "23:33", "", "5A73", "SLADEGD", "23:39"),
    gleg("GT811", "ASHFDNS", "", "06:00", "", "5X01", "ASHFKY", "06:05"),
    gleg("GT811", "ASHFKY", "06:05", "06:10", "", "2X01", "CHARX", "07:00"),
    gleg("GT811", "CHARX", "07:00", "07:30", "", "5X02", "ASHFDNS", "08:20"),
    gleg("GT811", "ASHFDNS", "08:20", "08:25", "#", "", "ASHFDNS", "08:25"),
  ].join("\r\n");
  const res = await G.build([sum, det]);
  const dart = res.metroSecs.M.get("DARTFORD") || [];
  assert.deepEqual(dart.map(fmt), [], "no Dartford line for the pause");
  const note = res.reviews.metro.find(x => /Left off — DARTFORD/.test(x.msg));
  assert.ok(note, "the metro list says why: " + res.reviews.metro.map(x => x.msg).join(" | "));
  assert.match(note.msg, /never shunted/);
});

test("9a. resolver guesses and misses are sentences", () => {
  const S = [HS, srow("GT901", "375/6", 1, "05:00", "ASHFDNS", "07:00", "LNDBR"),
                 srow("GT902", "375/6", 1, "05:00", "DOVERPS", "07:00", "ZZYZXH")].join("\r\n");
  const D = [HD,
    leg("GT901", "ASHFDNS", "Ashford Down Sidings", "05:00", "5A01", "ASHFKY", "Ashford", "05:05"),
    leg("GT901", "ASHFKY", "Ashford", "05:10", "2A01", "LNDBR", "Lond Br", "07:00"),
    leg("GT902", "DOVERPS", "Dover Priory Sidings", "05:00", "5B01", "DOVERP", "Dover Priory", "05:05"),
    leg("GT902", "DOVERP", "Dover Priory", "05:10", "2B01", "ZZYZXH", "Zzyzx Halt", "07:00")].join("\r\n");
  const r = G.buildIntegrale([S, D]);
  const look = r.review.find(m => /Location look-up/.test(m));
  assert.ok(look, "a low-confidence read is on the list: " + r.review.join(" | "));
  assert.match(look,
    /^Location look-up: “Lond Br” read as [A-Za-z ]+ \([A-Z]{3}\) — low confidence — at GT901\. Check it\./);
  const none = r.review.find(m => /No code known/.test(m));
  assert.ok(none, "a name nothing knows is on the list: " + r.review.join(" | "));
  assert.equal(none, "No code known for “Zzyzx Halt” at GT902 — printed as ZZY. Check it.");
  assert.ok(!r.review.some(m => /^resolved |^nocode /.test(m)), "and no raw tuples");
});

test("9b. an end-marker miss and a look-up place are timed in HH MM, not raw minutes", () => {
  /* Dover Priory pair to London Bridge, which no end-marker rule covers:
     the note read "DOVER PRIORY 390 to LBG". */
  const S = [HS, srow("DP001", "375/6", 1, "06:00", "DOVERPS", "08:00", "LNDNBDE"),
                 srow("DP002", "375/6", 2, "06:00", "DOVERPS", "08:00", "LNDNBDE")].join("\r\n");
  const D = [HD, ...["DP001", "DP002"].flatMap(d => [
    leg(d, "DOVERPS", "Dover Priory Sidings", "06:00", "5W05", "DOVERP", "Dover Priory", "06:05"),
    leg(d, "DOVERP", "Dover Priory", "06:30", "2W05", "LNDNBDE", "London Bridge", "08:00")])].join("\r\n");
  const r = G.buildIntegrale([S, D]);
  const note = r.reviews.main.find(x => /no rule for which end leads/.test(x.msg));
  assert.ok(note, "the miss is on the list: " + r.reviews.main.map(x => x.msg).join(" | "));
  assert.equal(note.msg, "DOVER PRIORY 06 30 to LBG — no rule for which end leads");
  assert.ok(!r.review.some(m => /\b390\b/.test(m)), "no raw minute count anywhere");
});

test("9c. the AM-only Summary note names the setting, briefly, with a › menu path", async () => {
  // five diagrams each working twice, one Summary line apiece
  const sum = [], det = [];
  for (let i = 1; i <= 5; i++) {
    const d = "GT10" + i;
    sum.push(gsum(d, "375/6", 1, "05:00", "ASHFDNS", "ASHFDNS", "14:10"));
    det.push(gleg(d, "ASHFDNS", "", "05:00", "", "5A0" + i, "ASHFKY", "05:05"),
             gleg(d, "ASHFKY", "05:05", "05:10", "", "2A0" + i, "DOVERP", "06:00"),
             gleg(d, "DOVERP", "06:00", "13:00", "", "2A1" + i, "ASHFKY", "14:00"),
             gleg(d, "ASHFKY", "14:00", "14:05", "", "5A2" + i, "ASHFDNS", "14:10"));
  }
  const res = await G.build([sum.join("\r\n"), det.join("\r\n")]);
  const note = res.review.find(m => /Show diagram sections/.test(m));
  assert.equal(note,
    "This Diagram Summary was exported without “Show diagram sections” ticked, " +
    "so it carries only the morning unit positions and afternoon formations may " +
    "print the wrong way round. In Genius: File › Session Settings, tick it, and " +
    "run the Summary again — or put the affected formations right with Reverse " +
    "on the Unit order tab.");
});

test("9d. local order corrections are described as what they are, singular and plural", async () => {
  const one = await G.build([PAIR_SUM, PAIR_DET],
    { orderFix: { "ASHFORD|101,102": ["101", "102"] } });
  assert.ok(one.review.includes(
    "1 order correction made on this computer was used for these books. It is " +
    "listed on the Unit order tab — tell us what it says so it can be built in for everyone."),
    one.review.join(" | "));
  const two = await G.build([PAIR_SUM, PAIR_DET],
    { orderFix: { "ASHFORD|101,102": ["101", "102"], "VICTORIA|901,902": ["902", "901"] } });
  assert.ok(two.review.includes(
    "2 order corrections made on this computer were used for these books. They are " +
    "listed on the Unit order tab — tell us what it says so they can be built in for everyone."),
    two.review.join(" | "));
  assert.ok(two.review.some(m => /^The order correction VICTORIA\|901,902 made on this computer matched nothing/.test(m)),
    "and the one that reached nothing is named: " + two.review.join(" | "));
  assert.ok(!two.review.some(m => /Export from the Rules tab|baked in/.test(m)),
    "nothing sends anybody to an export that does not exist");
});

test("9e. a near-miss correction is explained in one sentence", () => {
  const S = [HS, srow("AD951", "375/6", 1, "06:00", "ASHFDNS", "07:20", "DOVERP"),
                 srow("AD952", "375/6", 2, "06:00", "ASHFDNS", "07:20", "DOVERP")].join("\r\n");
  const D = [HD, ...["AD951", "AD952"].flatMap(d => [
    leg(d, "ASHFDNS", "Ashford Down Sidings", "06:00", "5A60", "ASHFKY", "Ashford", "06:10"),
    leg(d, "ASHFKY", "Ashford", "06:20", "2A60", "DOVERP", "Dover Priory", "07:20")])].join("\r\n");
  const r = G.buildIntegrale([S, D],
    { orderFix: { "ASHFORD|951,952,953": ["951", "952", "953"] } });
  const note = r.reviews.main.find(x => /a correction exists for/.test(x.msg));
  assert.ok(note, r.reviews.main.map(x => x.msg).join(" | "));
  assert.match(note.msg,
    /^ASHFORD 06 20 \(95[12]\+95[12]\): a correction exists for 951, 952, 953 here, but this formation is different, so its order comes from the report\. Check it against the real book\.$/);
});

test("9f. Integrale notes pluralise properly and every review item uses an em dash", () => {
  const S = [HS,
    "QQ901,Covered,375/6,,0,10/08/2026 06:00,1,2E05,ASHFDNS,10/08/2026 06:05,ASHFKY,1,,,,,,QQ901,,",
    "QQ902,Covered,465/9,,0,11/08/2026 00:01,,,GRVPKUS,11/08/2026 23:59,GRVPKUS,0,,,,,,QQ902,,",
    "QQ903,Uncovered,395/0,,0,10/08/2026 07:00,1,5D01,RAMSGTD,10/08/2026 07:05,RAMSGTE,2,,,,,,QQ903,,",
    "QQ904,Covered,375/6,,0,10/08/2026 07:00,1,5D02,ASHFDNS,10/08/2026 07:05,ASHFKY,2,,,,,,QQ904,,"].join("\r\n");
  const D = [HD,
    "QQ901,10/08/2026,,1,ASHFDNS,Ashford Down Sidings,06:00:00,,2.00E+05,0,,ASHFKY,Ashford,06:05:00,,",
    "QQ902,11/08/2026,,0,GRVPKUS,Grove Park Up C.H.S.,00:01:00,STABLD,,0,,GRVPKUS,Grove Park Up C.H.S.,00:01:00,,",
    "QQ903,10/08/2026,,2,RAMSGTD,Ramsgate E.M.U.D.,07:00:00,,5D01,0,,RAMSGTE,Ramsgate,07:05:00,,",
    "QQ904,10/08/2026,,2,ASHFDNS,Ashford Down Sidings,,,5D02,0,,ASHFKY,Ashford,07:05:00,,"].join("\r\n");
  const r = G.buildIntegrale([S, D]);
  assert.ok(r.review.includes("1 stable-all-day diagram with no movements left out: QQ902"), r.review.join(" | "));
  /* QQ904's only leg has no start time: it is unreadable, not stable, and
     the note says so by name rather than calling it a diagram that stood
     still all day */
  assert.ok(r.review.some(m =>
    /^1 leg left out — the Start or End Time cell .* \(QQ904 has no readable leg at all, so it is left out\)$/.test(m)),
    r.review.join(" | "));
  assert.ok(r.review.some(m => /^1 headcode recovered from spreadsheet number formatting .* — re-export/.test(m)), r.review.join(" | "));
  assert.ok(r.review.includes("1 of 2 diagrams is marked Uncovered in the plan"), r.review.join(" | "));
  const hyphenated = r.review.filter(m => / - /.test(m) || /\(s\)/.test(m));
  assert.deepEqual(Array.from(hyphenated), [], "no ' - ' and no '(s)' anywhere");
});

test("9g. the whole review list of the shared fixture is free of ' - ' and '(s)'", async () => {
  const res = await G.build([makePdf(SUMMARY_LINES, N.fflate), makePdf(DETAIL_LINES, N.fflate)]);
  const bad = res.review.filter(m => / - /.test(m) || /\(s\)/.test(m));
  assert.deepEqual(Array.from(bad), [], "every item is worded with an em dash");
});

test("10. build() takes a PDF's text already extracted, and builds the same books", async () => {
  const pdfs = [makePdf(SUMMARY_LINES, N.fflate), makePdf(DETAIL_LINES, N.fflate)];
  const fromBytes = await G.build(pdfs);
  const fromText = await G.build(pdfs.map(u8 => ({ pdfText: G.pdfText(u8) })));
  const mixed = await G.build([{ pdfText: G.pdfText(pdfs[0]) }, pdfs[1]]);
  for (const [what, r] of [["text", fromText], ["mixed", mixed]]) {
    assert.deepEqual(norm(r.secsByDay), norm(fromBytes.secsByDay), what + ": mainline");
    assert.deepEqual(norm(r.metroSecs), norm(fromBytes.metroSecs), what + ": metro");
    assert.deepEqual(norm(r.hsSecs), norm(fromBytes.hsSecs), what + ": high speed");
    assert.deepEqual(norm(r.review), norm(fromBytes.review), what + ": review list");
    assert.equal(r.tag, fromBytes.tag, what + ": tag");
  }
  // an object that is not a PDF's text is still refused as a report
  await assert.rejects(() => G.build([{ pdfText: "nothing here" }, pdfs[1]]), /Summary/);
});

test("11. an unallocated working is left blank, not given the diagram's other unit", () => {
  /* A diagram allocated in the morning and not yet in the evening had the
     morning's unit carried down its whole day, so evening departures nobody
     had allocated came out with a unit against them. The rulebook says the
     tool does not invent a unit number and leaves the cell for the depot;
     it is only ever read off the row covering the working being printed. */
  const S = [HS,
    // two workings of one diagram: the morning allocated 465609, the
    // evening left for the planner
    "GT024,Covered,375/6,,0,10/08/2026 06:00,1,2A01,ASHFDNS,10/08/2026 09:00,VICTRIE,10,,465609,,,,GT024,,",
    "GT024,Covered,375/6,,0,10/08/2026 17:12,1,2A40,VICTGCS,10/08/2026 19:00,ASHFDNS,10,,,,,,GT024,,"].join("\r\n");
  const D = [HD,
    leg("GT024", "ASHFDNS", "Ashford Down Sidings", "06:00", "5A01", "ASHFKY", "Ashford", "06:05"),
    leg("GT024", "ASHFKY", "Ashford", "06:10", "2A01", "VICTRIE", "Victoria", "09:00"),
    leg("GT024", "VICTRIE", "Victoria", "09:10", "5A02", "VICTGCS", "Victoria Grosvenor Shed", "09:20"),
    leg("GT024", "VICTGCS", "Victoria Grosvenor Shed", "17:12", "5A40", "VICTRIE", "Victoria", "17:20"),
    leg("GT024", "VICTRIE", "Victoria", "17:30", "2A40", "ASHFKY", "Ashford", "18:50"),
    leg("GT024", "ASHFKY", "Ashford", "18:55", "5A41", "ASHFDNS", "Ashford Down Sidings", "19:00")].join("\r\n");
  const r = G.buildIntegrale([S, D]);
  const unitsAt = () => {
    const out = [];
    for (const [sec, list] of r.secsByDay.M)
      for (const e of list)
        for (const u of e.units)
          out.push(sec + " " + fmt(e) + " = " + JSON.stringify(u.unit || ""));
    return out.sort();
  };
  const rows = Array.from(unitsAt());
  assert.ok(rows.length >= 2, "the fixture built both workings: " + rows.join(" | "));
  const morning = rows.filter(x => /ASHFORD 06/.test(x));
  const evening = rows.filter(x => /VICTORIA 17/.test(x));
  assert.ok(morning.length, "the morning working is on the book: " + rows.join(" | "));
  assert.ok(evening.length, "and so is the evening one: " + rows.join(" | "));
  // the books print the last three digits of the unit number, as 465609 -> 609
  assert.ok(morning.every(x => x.endsWith('"609"')),
    "the allocated morning keeps its unit: " + morning.join(" | "));
  assert.ok(evening.every(x => x.endsWith('""')),
    "the unallocated evening is left blank for the depot: " + evening.join(" | "));
});

test("12. a unit that attaches and stays out carries the rest of the day's miles", () => {
  /* GT116 leaves Ashford at 05+31, is back on the sidings at 06 59 and goes
     out again at 07 46 attached to GT117 - and that departure prints as
     GT117's row, with GT116 named in the attachment note. So the 39 miles of
     the first stint were all the book ever showed of a 455-mile day. A
     working's miles now run to wherever the unit next berths ON THE SHEET,
     and where nothing later of that diagram prints, to the end of its day. */
  const mleg = (d, a, an, at, hc, b, bn, bt, cum) =>
    `${d},10/08/2026,,0,${a},${an},${at}:00,,${hc},${cum},,${b},${bn},${bt}:00,,`;
  const S = [HS,
    srow("GT116", "375/6", 1, "05:31", "ASHFDNS", "06:59", "ASHFDNS"),
    srow("GT116", "375/6", 1, "07:46", "ASHFDNS", "14:05", "VICTGCS"),
    srow("GT117", "375/6", 2, "07:45", "ASHFDNS", "10:10", "VICTGCS")].join("\r\n");
  const D = [HD,
    // out to Maidstone and back to the sidings: 39 miles
    mleg("GT116", "ASHFDNS", "Ashford Down Sidings", "05:31", "5A05", "ASHFKY", "Ashford", "05:35", 2),
    mleg("GT116", "ASHFKY", "Ashford", "05:36", "5A05", "MDSTE", "Maidstone East", "06:04", 20),
    mleg("GT116", "MDSTE", "Maidstone East", "06:18", "2N06", "ASHFKY", "Ashford", "06:49", 38),
    mleg("GT116", "ASHFKY", "Ashford", "06:55", "5N06", "ASHFDNS", "Ashford Down Sidings", "06:59", 39),
    // …then out again on GT117's 07 55 and never berthing again: 246 more
    mleg("GT116", "ASHFDNS", "Ashford Down Sidings", "07:46", "5A18", "ASHFKY", "Ashford", "07:50", 41),
    mleg("GT116", "ASHFKY", "Ashford", "07:55", "2A18", "VICTRIE", "Victoria", "09:36", 120),
    mleg("GT116", "VICTRIE", "Victoria", "09:55", "2N24", "ASHFKY", "Ashford", "11:32", 200),
    mleg("GT116", "ASHFKY", "Ashford", "11:56", "2A34", "VICTRIE", "Victoria", "13:36", 280),
    mleg("GT116", "VICTRIE", "Victoria", "13:55", "5F07", "VICTGCS", "Victoria Grosvenor Shed", "14:05", 285),
    // GT117's day opens by arriving on the sidings to be joined
    mleg("GT117", "ASHFDNS", "Ashford Down Sidings", "07:45", "", "ASHFDNS", "Ashford Down Sidings", "07:45", 0),
    mleg("GT117", "ASHFDNS", "Ashford Down Sidings", "07:46", "5A18", "ASHFKY", "Ashford", "07:50", 2),
    mleg("GT117", "ASHFKY", "Ashford", "07:55", "2A18", "VICTRIE", "Victoria", "09:36", 81),
    mleg("GT117", "VICTRIE", "Victoria", "10:00", "5F09", "VICTGCS", "Victoria Grosvenor Shed", "10:10", 84)]
    .join("\r\n");
  const r = G.buildIntegrale([S, D]);
  const rows = [];
  for (const [sec, list] of r.secsByDay.M)
    for (const e of list)
      for (const u of e.units)
        rows.push({ where: sec + " " + fmt(e), diag: u.diag, mg: u.mg, miles: u.miles });
  const shown = rows.map(x => x.where + " " + x.diag + " mg=" + x.mg).join(" | ");
  const g116 = rows.filter(x => x.diag === "116");
  assert.equal(g116.length, 1,
    "116 prints once, its second departure being GT117's row: " + shown);
  assert.equal(g116[0].mg, 285,
    "and carries the whole day, not the 39 miles of its first stint: " + shown);
  // the diagram that DOES print both halves is untouched: a unit stands
  // still between two stints, so each row still shows its own working
  const g117 = rows.filter(x => x.diag === "117");
  assert.equal(g117.length, 1, "117 prints its one departure: " + shown);
  assert.equal(g117[0].mg, 84, "117 runs its own day: " + shown);
});
