/* A day of Class 395 work, as Genius exports it: three AZ diagrams out of
   two depots on Monday 03/08/26 - one plain Ashford turn, one Ashford turn
   that goes over the Ebbsfleet high level and stands back at Ashford
   through the early afternoon, and one Ramsgate turn. Small enough to read
   at a glance, and shaped so each of the disposition sheet's rules has a
   diagram that satisfies it and one that does not. */

const SHEAD = '"GENIUS","DIAGRAM SUMMARY REPORT","Page:","Page -1 of 1",,' +
  '"Control:","SouthEastern Trains","Print Date:","August 2, 2026",' +
  '"Diagram Summary for:"," 03/08/26","DIAGRAM","UNITS","FLEET","OFF",' +
  '"START FUEL","POS","AT","FROM","TO","AT","WORKS","END FUEL","MILES",' +
  '"TOT. FUEL  MILES","NOTES","NOTES",';
const DHEAD = '"GENIUS","Diagram Detail Report","Page:","Page -1 of 1",,,,,' +
  '"Control:","SouthEastern Trains","Print Date:","August 2, 2026",' +
  '"Diagram Details for:"," 03/08/26",';

/* code, name, arr, dep, headcode out, running miles on arrival */
const S = (code, name, arr, dep, hc, ml) => ({ code, name, arr, dep, hc, ml });
export const HS_DIAGRAMS = [
  { diag: "AZ601", fleet: "395/0", from: "ASHFDNS", to: "ASHFDNS", start: "07:10", end: "23:54", stops: [
    S("ASHFDNS", "Ashford Dn Sdgs", null, "07:10", "5R09", 0),
    S("ASHFKY", "Ashford Kent", "07:16", "07:27", "2R09", 1),
    S("STPANCI", "St Pancras Intl", "08:20", "09:10", "1R12", 60),
    S("ASHFKY", "Ashford Kent", "10:05", "10:20", "5R13", 120),
    S("DOVERP", "Dover Priory", "11:10", "11:30", "2R15", 140),
    S("ASHFKY", "Ashford Kent", "23:40", "23:48", "5R99", 670),
    S("ASHFDNS", "Ashford Dn Sdgs", "23:54", null, null, 672)] },
  /* over the high level (an Ebbsfleet-Gravesend leg), and standing back at
     Ashford 13:16 to 16:40 - the berth an early-afternoon clean needs */
  { diag: "AZ602", fleet: "395/0", from: "ASHFDNS", to: "ASHFDNS", start: "08:40", end: "19:16", stops: [
    S("ASHFDNS", "Ashford Dn Sdgs", null, "08:40", "5L19", 0),
    S("ASHFKY", "Ashford Kent", "08:46", "08:55", "2L19", 1),
    S("EBSFLTI", "Ebbsfleet Intl", "09:30", "09:34", "2L19", 40),
    S("GRVSEND", "Gravesend", "09:44", "09:50", "2L21", 44),
    S("ASHFKY", "Ashford Kent", "13:10", "13:14", "5L23", 150),
    S("ASHFDNS", "Ashford Dn Sdgs", "13:16", "16:40", "5L41", 151),
    S("ASHFKY", "Ashford Kent", "16:45", "16:55", "2L41", 152),
    S("DOVERP", "Dover Priory", "17:40", "18:00", "5L47", 190),
    S("ASHFDNS", "Ashford Dn Sdgs", "19:16", null, null, 210)] },
  { diag: "AZ603", fleet: "395/0", from: "RAMSGTD", to: "RAMSGTD", start: "06:27", end: "22:42", stops: [
    S("RAMSGTD", "Ramsgate Depot", null, "06:27", "5L15", 0),
    S("RAMSGTE", "Ramsgate", "06:31", "06:40", "2L15", 1),
    S("STPANCI", "St Pancras Intl", "08:00", "08:40", "1L18", 80),
    S("RAMSGTE", "Ramsgate", "10:10", "10:25", "2L31", 160),
    S("STPANCI", "St Pancras Intl", "11:50", "12:20", "1L44", 240),
    S("RAMSGTE", "Ramsgate", "22:36", "22:40", "5L99", 520),
    S("RAMSGTD", "Ramsgate Depot", "22:42", null, null, 521)] },
];

/* units: a map of diagram to the UNITS cell, for a Summary printed after
   the day was allocated; left out, every row is blank, which is what an
   AM print looks like */
export function hsSummaryCsv(units) {
  return HS_DIAGRAMS.map(d => SHEAD + ['"' + d.diag + '"',
    '"' + ((units && units[d.diag]) || "") + '"', '"' + d.fleet + '"', "0.00", 1,
    '"' + d.start + '"', '"' + d.from + '"', '"' + d.to + '"', '"' + d.end + '"',
    "-0.60", "100.00", "100.00", "", ""].join(",")).join("\r\n");
}
export function hsDetailCsv() {
  const out = [];
  for (const d of HS_DIAGRAMS) {
    const head = DHEAD + '"Diagram","' + d.diag + '","On","03/08/26","Notes",,"Miles","Fuel Miles",';
    for (let i = 0; i + 1 < d.stops.length; i++) {
      const a = d.stops[i], b = d.stops[i + 1];
      out.push(head + ['"' + a.code + '"', '"' + a.name + '"',
        a.arr ? '"' + a.arr + '"' : "", a.dep ? '"' + a.dep + '"' : "", "",
        '"' + (a.hc || "") + '"', '"' + a.ml.toFixed(2) + '"', "1.00",
        '"' + b.code + '"', '"' + b.name + '"',
        '"' + (b.arr || b.dep) + '"', '"Off Diagram"', '"  000"',
        '"Works"', '"  000"'].join(","));
    }
  }
  return out.join("\r\n");
}

/* ---- two days of 395 work for the allocations sheet (Mon 03/08, Tue 04/08) ----
   Monday: AZ611 and AZ612 leave Ramsgate depot together at 05 00 for Margate
   (AZ611 position 1), turn there, run up to St Pancras - standing there nearly
   two hours - and come back to Ashford depot by the Down Yard, a 12 all day.
   AZ601 goes out of Ashford at 06 00, down to Dover and back into the depot
   at 10 00, and out again at 16 00 by Gravesend and the North Kent to end the
   day in Ramsgate depot. Tuesday: AZ620 and AZ621 go out of Ramsgate, the
   second one on 395001 - Monday's AZ601 unit, which came in there the night
   before. Every place is a Genius code the sheet's network table knows. */
const X = (code, arr, dep, hc, ml) => ({ code, name: code, arr, dep, hc, ml });
const PAIR = [
  X("RAMSGTD", null, "05:00", "5J05", 0), X("MARGATE", "05:10", "05:20", "1J05", 4),
  X("RAMSGTE", "05:32", "05:33", "1J05", 8), X("MINSTER", "05:40", "05:40", "1J05", 12),
  X("CNTBW", "05:52", "05:54", "1J05", 20), X("ASHFKY", "06:10", "06:12", "1J05", 34),
  X("EBSFLTI", "06:30", "06:31", "1J05", 70), X("STFORDI", "06:40", "06:42", "1J05", 80),
  X("STPANCI", "06:50", "08:45", "1J20", 86), X("STFORDI", "08:52", "08:54", "1J20", 92),
  X("EBSFLTI", "09:04", "09:05", "1J20", 102), X("ASHFKY", "09:25", "09:27", "5J20", 138),
  X("ASHFDYW", "09:32", "09:40", "5J20", 139), X("ASHFDNS", "09:50", null, null, 140)];
export const HS_WEEK = {
  // Sunday: no tab of its own, but Monday's arrivals are its arrivals
  "02/08/26": {
    units: { AZ630: "395030" },
    pos: {},
    diagrams: {
      AZ630: [X("RAMSGTD", null, "09:00", "5J60", 0), X("RAMSGTE", "09:05", "09:08", "1J60", 1),
              X("MINSTER", "09:15", "09:15", "1J60", 5), X("CNTBW", "09:27", "09:29", "1J60", 13),
              X("ASHFKY", "09:45", "09:47", "5J60", 27), X("ASHFDNS", "20:05", null, null, 28)],
    },
  },
  "03/08/26": {
    units: { AZ611: "395011", AZ612: "395012", AZ601: "395001" },
    pos: { AZ611: 1, AZ612: 2 },
    diagrams: {
      AZ611: PAIR, AZ612: PAIR,
      AZ601: [
        X("ASHFDNS", null, "06:00", "5R01", 0), X("ASHFDYW", "06:10", "06:18", "5R01", 1),
        X("ASHFKY", "06:25", "06:30", "2R01", 2), X("DOVERP", "07:00", "07:20", "2R04", 24),
        X("ASHFKY", "07:50", "07:55", "5R04", 46), X("ASHFDYW", "08:00", "08:10", "5R04", 47),
        X("ASHFDNS", "10:00", "16:00", "5R30", 48), X("ASHFDYW", "16:10", "16:18", "5R30", 49),
        X("ASHFKY", "16:25", "16:30", "1R30", 50), X("EBSFLTI", "16:50", "16:51", "1R30", 86),
        X("GRVSEND", "17:00", "17:01", "1R30", 90), X("STROOD", "17:10", "17:11", "1R30", 97),
        X("GLNGHMK", "17:20", "17:21", "1R30", 102), X("FAVRSHM", "17:40", "17:41", "1R30", 118),
        X("MARGATE", "18:20", "18:30", "5R32", 140), X("RAMSGTD", "18:50", null, null, 144)],
    },
  },
  "04/08/26": {
    units: { AZ620: "395099", AZ621: "395001" },
    pos: {},
    diagrams: {
      AZ620: [X("RAMSGTD", null, "06:00", "5J40", 0), X("MARGATE", "06:10", "06:20", "1J40", 4),
              X("FAVRSHM", "07:00", null, null, 30)],
      AZ621: [X("RAMSGTD", null, "07:00", "5J42", 0), X("MARGATE", "07:10", "07:20", "1J42", 4),
              X("FAVRSHM", "08:00", null, null, 30)],
    },
  },
};
const headSum = date => SHEAD.replace(" 03/08/26", " " + date);
const headDet = date => DHEAD.replace(" 03/08/26", " " + date);
export function hsWeekCsv(date) {
  const D = HS_WEEK[date];
  const sum = Object.entries(D.diagrams).map(([diag, st]) => headSum(date) + ['"' + diag + '"',
    '"' + (D.units[diag] ? D.units[diag] + "." : "") + '"', '"395/0"', "0.00", D.pos[diag] || 1,
    '"' + st[0].dep + '"', '"' + st[0].code + '"', '"' + st[st.length - 1].code + '"',
    '"' + st[st.length - 1].arr + '"', "-0.60", "100.00", "100.00", "", ""].join(",")).join("\r\n");
  const det = [];
  for (const [diag, st] of Object.entries(D.diagrams)) {
    const head = headDet(date) + '"Diagram","' + diag + '","On","' + date + '","Notes",,"Miles","Fuel Miles",';
    for (let i = 0; i + 1 < st.length; i++) {
      const a = st[i], b = st[i + 1];
      det.push(head + ['"' + a.code + '"', '"' + a.name + '"', a.arr ? '"' + a.arr + '"' : "",
        a.dep ? '"' + a.dep + '"' : "", "", '"' + (a.hc || "") + '"', '"' + a.ml.toFixed(2) + '"', "1.00",
        '"' + b.code + '"', '"' + b.name + '"', '"' + (b.arr || b.dep) + '"', '"Off Diagram"', '"  000"',
        '"Works"', '"  000"'].join(","));
    }
  }
  return [sum, det.join("\r\n")];
}

/* The disposition statement as it pastes out of the workbook: the header
   block's boxes, the heading row, then a line per unit. `plan` fills the
   four planning columns, which is what a finished sheet looks like; left
   out they are blank, which is what the planner starts from. */
const COLS = 16;
const row = cells => { const f = new Array(COLS).fill(""); for (const k of Object.keys(cells)) f["ABCDEFGHIJKLMNOP".indexOf(k)] = cells[k];
  const q = v => /[\t\n"]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  const out = f.map(q); while (out.length && !out[out.length - 1]) out.pop(); return out.join("\t"); };
export const HS_UNITS = [
  { unit: "395001", depot: "Ashford", status: "Stopped", restr: "", today: "CCTV Mod", plan: null },
  { unit: "395002", depot: "Ashford", status: "Available", restr: " Not on Ebbsfleet High Level", today: "Not over Ebbsfleet High\n Level", plan: ["AZ601\n5R09", "07+10", "Ashford", "23+54"] },
  { unit: "395003", depot: "Ashford", status: "Available", restr: "", today: "Internal Clean \nEarly PM", plan: ["AZ602\n5L19", "08+40", "Ashford", "19+16"] },
  { unit: "395004", depot: "Ramsgate", status: "Available", restr: "75% Traction", today: "", plan: ["AZ603\n5L15", "06+27", "Ramsgate", "22+42"] },
  { unit: "395005", depot: "Ramsgate", status: "Available", restr: "", today: "Stable if possible", plan: null },
];
export function dispositionPaste(opts) {
  opts = opts || {};
  const lines = [];
  lines.push(row({}));
  lines.push(row({ B: "Actual", G: "CLASS 395 DISPOSITION STATEMENT AM", M: "Monday, August 03, 2026" }));
  lines.push(row({ B: "Version 1", G: "Date Sent", J: "SERVICE TRAINS REQUIRED AM / PM", L: "3" }));
  lines.push(row({ J: "SERVICE TRAINS OFFERED AM / PM", L: "3" }));
  lines.push(row({ J: "SERVICE SPARE TRAINS", L: "0" }));
  lines.push(row({ G: "Time Sent", J: "TOTAL STOPPED", L: "1" }));
  lines.push(row({ J: "TOTAL STABLED", L: "1" }));
  for (let r = 8; r <= 19; r++) lines.push(row({}));
  lines.push(row({ B: "UNIT\n#  \nCCTV Mod", C: "FTR DAYS\n@12:30", D: "DEPT\nLOCATION", E: "MC", F: "UNIT STATUS",
    G: "RESTRICTION /\nCOMMENT", H: "Mon 03/08", I: "Tue 04/08", J: "Wed 05/08", K: "Thur 06/08", L: "Fri 07/08",
    M: "DIAGRAM", N: "DEP TIME", O: "END\nLOCATION", P: "ARRIVAL\nTIME" }));
  for (const u of (opts.units || HS_UNITS)) {
    const c = { B: u.unit, D: u.depot, E: u.mc || "", F: u.status, G: u.restr, H: u.today };
    if (opts.filled && u.plan) { c.M = u.plan[0]; c.N = u.plan[1]; c.O = u.plan[2]; c.P = u.plan[3]; }
    lines.push(row(c));
  }
  return lines.join("\n") + "\n";
}
