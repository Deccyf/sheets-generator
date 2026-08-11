/* Every coupled entry in the mainline book, both ways round, as a CSV for
   one pass of marking up against the real book:

     node tools/order-check.mjs out.csv summary.csv diagrams.csv

   Whatever comes back fills in posAsc in src/data.js. */
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
const rows = [["Book", "Section", "Time", "To", "Headcode", "Sheet shows",
               "The other way round", "Which is right? (A or B)", "Notes"]];
const X = N.SHEETS_XLSX;
const BOOKS = [["Mainline", res.secsByDay, X.MAIN_ORDER],
               ["Metro", res.metroSecs, X.METRO_ORDER],
               ["High Speed", res.hsSecs, X.HS_ORDER]];
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
        const t = String(Math.floor(e.time / 60) % 24).padStart(2, "0") +
          (e.time_kind === "pax" ? " " : "+") + String(e.time % 60).padStart(2, "0");
        const shown = e.units.map(u => u.diag);
        const tie = new Set(e.units.map(u => pos.get(u.diag))).size !== e.units.length;
        rows.push([book, sec, t, e.dest, e.headcode || "",
          "A: " + shown.join(" then "),
          "B: " + shown.slice().reverse().join(" then "), "",
          tie ? "two units share a Position" : ""]);
      }
    }
  }
}
writeFileSync(process.argv[2],
  "﻿" + rows.map(r => r.map(v =>
    /[",]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v).join(",")).join("\r\n"));
console.log("wrote " + n + " coupled entries across the three books");
