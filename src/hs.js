/* SHEETS_HS — the High Speed book in the depot's own format.

   Like the Metro sheets, this is not a berthing sheet. Taken from the
   operator's own Class 395 Allocations Sheet for 18/08/2026:

     * one worksheet for the day, with a block per depot down it - Ashford,
       Margate, Ramsgate - and each block two tables side by side;
     * on the LEFT, "<DEPOT> PM ARRIVALS <yesterday>": what came in last
       night. Filled whenever the reports cover the day before as well, which
       a Monday-to-Friday pair does for every day but the Monday;
     * on the RIGHT, "<DEPOT> UNIT ALLOCATIONS <today>": what goes out, with
       the diagram, its mileage, where it ends AM and PM, and what it forms
       after that;
     * the columns the reports cannot fill - N/M M/O, FP/RP, CET DUE, the
       cleaning and works marks and the notes - are ruled and left empty, the
       way they are hand-kept in the real sheet.

   The mileage is the strongest check there is that this reads the reports
   the way the depot does: on 18/08 the sheet's MG column and the Detail
   export agree to the mile on AZ601 (951), AZ602 (828) and AZ603 (1012). */
"use strict";
const SHEETS_HS = (() => {
const X = SHEETS_XLSX;
const PM_BREAK = SHEETS_RULEBOOK.PM_BREAK;

/* The sheet's own berth vocabulary, which is not the berthing books'. Taken
   from the columns of the real sheet: ASH 2019 times against AFK 6, and RAM
   throughout for Ramsgate. Anything it does not name is passed through. */
const ENDS_CODE = { AFK: "ASH", RE: "RAM", FKE: "FAV" };
const endsCode = c => ENDS_CODE[String(c || "").toUpperCase()] ||
                      String(c || "").toUpperCase();

const HEADS = ["TRAIN ID", "ARRIVAL TIME", "UNIT NUMBER", "6 OR 12 CAR",
               "CET DUE", "", "TRAIN ID", "DIAGRAM", "N/M M/O", "MG", "TIME",
               "FP/RP", "UNIT NO", "ENDS AM", "ARRIVES", "ENDS PM",
               "TRAIN ID", "TIME", "NOTES"];
// B..T on the real sheet, so column 1 is left as its margin
const WIDTHS = [3.5, 9.6, 11.4, 11.4, 10.4, 8.6, 3.5, 11.4, 9.6, 8.6, 6.4,
                8.6, 8.1, 9.6, 9.6, 9.6, 9.6, 9.6, 8.6, 16];
const DEPOTS = ["ASHFORD", "MARGATE", "RAMSGATE"];

const hhmm = t => String(Math.floor(t / 60) % 24).padStart(2, "0") +
  ":" + String(t % 60).padStart(2, "0");
const stamp = e => String(Math.floor(e.time / 60) % 24).padStart(2, "0") +
  (e.time_kind === "pax" ? " " : "+") + String(e.time % 60).padStart(2, "0");
const DAY_NAME = { M: "Monday", T: "Tuesday", W: "Wednesday", TH: "Thursday",
                   F: "Friday", SA: "Saturday", SU: "Sunday" };
const DAY_ORDER = ["M", "T", "W", "TH", "F", "SA", "SU"];
const longDate = (dayKey, date) =>
  (DAY_NAME[dayKey] || "") + " " + String(date || "");

/* Yesterday's arrivals into this depot, read off the day before's own
   entries: every unit whose PM berth is here, with what it came in on. */
function arrivalsInto(depot, secs) {
  const out = [];
  if (!secs) return out;
  for (const [, list] of secs)
    for (const e of list)
      for (const u of e.units) {
        const pm = endsCode(u.pm || u.ends.split(" ")[0]);
        if (pm !== endsCode(depot.slice(0, 3) === "ASH" ? "AFK" : depot)) continue;
        out.push({ hc: e.headcode || "", at: stamp(e), unit: u.unit || "",
                   cars: "" });
      }
  return out.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
}

/* looks: 1 = block title, 3 = centred body, 6 = bold centred header */
function layoutDay(dayKey, labels, dates, hsSecs, prevKey) {
  const cells = [], merges = [], rowHeights = new Map();
  const put = (r, c, v, look, sides, noFit) =>
    cells.push({ r, c, v: v === undefined || v === null ? "" : String(v),
                 look, sides: sides || [null, null, null, null], noFit: !!noFit });
  const secs = hsSecs[dayKey];
  const prev = prevKey ? hsSecs[prevKey] : null;
  const today = longDate(dayKey, dates[dayKey]);
  const yday = prevKey ? longDate(prevKey, dates[prevKey]) : "";
  let r = 1;
  put(r, 19, "Date Sent", 3, null, true);
  put(r, 20, dates[dayKey] || "", 3, null, true);
  rowHeights.set(r, 18); r += 2;

  for (const depot of DEPOTS) {
    const list = (secs && secs.get(depot)) || [];
    const arr = prev ? arrivalsInto(depot, prev) : [];
    if (!list.length && !arr.length) continue;
    put(r, 2, depot + " PM ARRIVALS " + (yday || "— no previous day loaded"),
        1, null, true);
    put(r, 8, depot + " UNIT ALLOCATIONS " + today, 1, null, true);
    rowHeights.set(r, 18); r++;
    HEADS.forEach((h, i) => {
      if (!h) return;
      put(r, i + 2, h, 6, [null, null, "medium", "medium"]);
    });
    rowHeights.set(r, 18); r++;

    // the allocations, one row per unit, in the order they leave
    const rows = [];
    for (const e of list.slice().sort((a, b) => a.time - b.time))
      for (const u of e.units)
        rows.push({
          id: (e.headcode || "") + (e.dest ? " " + e.dest : ""),
          diag: (u.code || "") + u.diag,
          mg: u.miles == null ? "" : Math.round(u.miles),
          time: stamp(e), unit: u.unit || "",
          endsAm: endsCode(u.am), endsPm: endsCode(u.pm),
        });
    const n = Math.max(rows.length, arr.length);
    for (let i = 0; i < n; i++) {
      const a = arr[i], v = rows[i];
      const last = i === n - 1;
      const box = c => [c === 2 || c === 8 ? "medium" : "thin",
                        c === 6 || c === 20 ? "medium" : "thin",
                        null, last ? "medium" : "thin"];
      const cell = (c, val) => put(r, c, val, 3, box(c));
      cell(2, a ? a.hc : ""); cell(3, a ? a.at : ""); cell(4, a ? a.unit : "");
      cell(5, a ? a.cars : ""); cell(6, "");            // 6 OR 12 CAR, CET DUE
      cell(8, v ? v.id : ""); cell(9, v ? v.diag : "");
      cell(10, "");                                      // N/M M/O: by hand
      cell(11, v ? v.mg : ""); cell(12, v ? v.time : "");
      cell(13, "");                                      // FP/RP: by hand
      cell(14, v ? v.unit : "");
      cell(15, v ? v.endsAm : ""); cell(16, "");         // ARRIVES: by hand
      cell(17, v ? v.endsPm : "");
      cell(18, ""); cell(19, ""); cell(20, "");          // next working, notes
      rowHeights.set(r, 18); r++;
    }
    r += 2;
  }
  return { cells, merges, rowHeights, maxRow: r,
           opts: { widths: fitWidths(cells), landscape: true, fitToHeight: 0,
                   fitToWidth: 0 } };
}

/* As the Metro sheet does: measured widths, floored at the real sheet's, and
   the long free text kept out of the measurement. */
const LOOK_WIDE = { 1: 1.53, 2: 1.60, 3: 1.40, 4: 1.15, 5: 1.15, 6: 1.27 };
function fitWidths(cells) {
  const need = WIDTHS.slice();
  for (const c of cells) {
    if (c.noFit) continue;
    const i = c.c - 1;
    if (i < 0 || i >= need.length) continue;
    const w = String(c.v || "").length * (LOOK_WIDE[c.look] || 1.1) + 1.6;
    if (w > need[i]) need[i] = w;
  }
  return need.map(w => Math.round(Math.min(w, 26) * 10) / 10);
}

/* One worksheet per day the reports carry, named the way the real workbook
   names them - "Tue 18 08". */
function sheetsFor(hsSecs, labels, dates) {
  const days = DAY_ORDER.filter(d => d in labels);
  return days.map((d, i) => {
    const lbl = String(labels[d] || "");
    const m = /^([A-Z]{3}) (\d\d)\/(\d\d)/.exec(lbl);
    const name = m
      ? m[1].charAt(0) + m[1].slice(1).toLowerCase() + " " + m[2] + " " + m[3]
      : lbl || "SHEET";
    return { name: name.slice(0, 31),
             layout: layoutDay(d, labels, dates, hsSecs, i > 0 ? days[i - 1] : null) };
  }).filter(s => s.layout.maxRow > 3);
}
function writeHsBook(hsSecs, labels, dates, zipFn) {
  const sheets = sheetsFor(hsSecs, labels, dates);
  return sheets.length ? X.writeWorkbook(sheets, zipFn) : null;
}

return { writeHsBook, sheetsFor, layoutDay, fitWidths, endsCode,
         HEADS, WIDTHS, DEPOTS };
})();
if (typeof module !== "undefined" && module.exports) module.exports = SHEETS_HS;
if (typeof globalThis !== "undefined") globalThis.SHEETS_HS = SHEETS_HS;
