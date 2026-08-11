/* Every coupled entry in all three books, both ways round, as a CSV for one
   pass of marking up against the real books:

     node tools/order-check.mjs out.csv summary.csv diagrams.csv

   This is the routine to run whenever the timetable changes. Nothing in
   either export says which way round a formation was left standing, so a new
   or altered working can only be checked against the book that was written
   by hand. Tick A or B down the "Which is right?" column; every row marked B
   comes with the exact line to paste into ORDER_FIX in src/data.js.

   A formation that appears more than once in a day gets the timed key, since
   the books do print the same pair both ways round at different times of day.
   One that appears once gets the plain key, which keeps working when the
   timetable moves the departure by a minute or two. */
import { readFileSync, writeFileSync } from "node:fs";
import { loadSandbox } from "../test/helpers/sandbox.mjs";
import { fileURLToPath } from "node:url";

const sumTxt = readFileSync(process.argv[3], "utf8");
const N = loadSandbox(fileURLToPath(new URL("../Sheets Generator.html", import.meta.url)));
const res = N.GENIUS.buildIntegrale(
  [sumTxt, readFileSync(process.argv[4], "utf8")]);
const pos = new Map();
for (const line of sumTxt.split(/\r?\n/).slice(1)) {
  const f = line.split(","); if (/^[A-Z]{2}\d{3}$/.test(f[0])) pos.set(f[0].slice(2), +f[6]);
}
const X = N.SHEETS_XLSX;
const BOOKS = [["Mainline", res.secsByDay, X.MAIN_ORDER],
               ["Metro", res.metroSecs, X.METRO_ORDER],
               ["High Speed", res.hsSecs, X.HS_ORDER]];
const fmt = e => String(Math.floor(e.time / 60) % 24).padStart(2, "0") +
  (e.time_kind === "pax" ? " " : "+") + String(e.time % 60).padStart(2, "0");
const setOf = e => e.units.map(u => u.diag).slice().sort().join(",");

/* which formations turn up more than once, so need the time in their key */
const times = new Map();
for (const [, days] of BOOKS.map(b => [b[0], b[1]]))
  for (const day of Object.keys(days))
    for (const [, list] of days[day])
      for (const e of list)
        if (e.units.length > 1)
          times.set(setOf(e), (times.get(setOf(e)) || 0) + 1);

const rows = [["Book", "Section", "Time", "To", "Headcode", "Sheet shows",
               "The other way round", "Which is right? (A or B)",
               "If B, paste this into ORDER_FIX", "Notes"]];
let n = 0;
for (const [book, days, ORDER] of BOOKS) {
  for (const day of Object.keys(days)) {
    const secs = days[day];
    const seen = [...secs.keys()].sort((a, b) => {
      const ia = ORDER.indexOf(a), ib = ORDER.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
    for (const sec of seen) {
      for (const e of secs.get(sec)) {
        if (e.units.length < 2) continue;
        n++;
        const shown = e.units.map(u => u.diag);
        const other = shown.slice().reverse();
        const key = sec + (times.get(setOf(e)) > 1 ? " " + fmt(e) : "") +
          "|" + setOf(e);
        const tie = new Set(e.units.map(u => pos.get(u.diag))).size !== e.units.length;
        rows.push([book, sec, fmt(e), e.dest, e.headcode || "",
          "A: " + shown.join(" then "),
          "B: " + other.join(" then "), "",
          '"' + key + '": ["' + other.join('", "') + '"],',
          tie ? "two units share a Position" : ""]);
      }
    }
  }
}
writeFileSync(process.argv[2],
  "﻿" + rows.map(r => r.map(v =>
    /[",]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v).join(",")).join("\r\n"));
console.log("wrote " + n + " coupled entries across the three books");
