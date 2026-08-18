/* SHEETS_HS — the Class 395 Allocations Sheet, in the depot's own dress.

   Not a berthing sheet. The layout is the operator's own workbook: one
   worksheet per day, a block per depot (Ashford, Margate, Ramsgate), each
   block two tables side by side - last night's arrivals on the left, the
   day's allocations on the right - with the clean-marks and mileage key
   above and the standing house notes below.

   Everything about how it LOOKS comes from SHEETS_HS_SKIN, which is the
   workbook's own style records lifted verbatim (see scratchpad/mkskin.py):
   the exact borders, fills, fonts, row heights, column widths, yellow tab
   and the conditional formatting that colours the MG column amber under
   500 miles and red over it. This file only decides what goes in which
   cell.

   The mileage is the strongest check that the reports are read the way the
   depot reads them: on 18/08 the sheet's MG column and the Detail export
   agree to the mile on AZ601 (951), AZ602 (828) and AZ603 (1012). */
"use strict";
const SHEETS_HS = (() => {
const X = SHEETS_XLSX;
const SKIN = SHEETS_HS_SKIN;

/* The sheet's own berth vocabulary, which is not the berthing books'. Taken
   from the columns of the real sheet: ASH 2019 times against AFK 6, and RAM
   throughout for Ramsgate. Anything it does not name is passed through. */
const ENDS_CODE = { AFK: "ASH", RE: "RAM", FKE: "FAV" };
const endsCode = c => ENDS_CODE[String(c || "").toUpperCase()] ||
                      String(c || "").toUpperCase();

const DEPOTS = ["ASHFORD", "MARGATE", "RAMSGATE"];
const COL = l => l.charCodeAt(0) - 64;              // "B" -> 2
const stamp = e => String(Math.floor(e.time / 60) % 24).padStart(2, "0") +
  (e.time_kind === "pax" ? " " : "+") + String(e.time % 60).padStart(2, "0");
const DAY_NAME = { M: "Monday", T: "Tuesday", W: "Wednesday", TH: "Thursday",
                   F: "Friday", SA: "Saturday", SU: "Sunday" };
const DAY_ORDER = ["M", "T", "W", "TH", "F", "SA", "SU"];
const longDate = (dayKey, date) =>
  (DAY_NAME[dayKey] || "") + " " + String(date || "");

/* Rough per-column widths for the on-screen preview only - the saved file
   carries the workbook's own <cols> verbatim from the skin. */
const PREVIEW_W = [8.4, 8.6, 8.4, 8.6, 8.1, 8.1, 8.4, 8.6, 8.1, 6.4, 5.6,
                   7.1, 6.3, 7.3, 8.3, 7.7, 7.9, 7.7, 8.4, 8.4];

/* Yesterday's arrivals into this depot, read off the day before's own
   entries: every unit whose PM berth is here, with what it came in on. */
function arrivalsInto(depot, secs) {
  const out = [];
  if (!secs) return out;
  for (const [, list] of secs)
    for (const e of list)
      for (const u of e.units) {
        const pm = endsCode(u.pm || (u.ends || "").split(" ")[0]);
        if (pm !== endsCode(depot.slice(0, 3) === "ASH" ? "AFK" : depot)) continue;
        out.push({ hc: e.headcode || "", at: stamp(e), unit: u.unit || "",
                   cars: e.units.length > 1 ? "12" : "6" });
      }
  return out.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
}

/* The fleet roster for the UNIT drop-downs, built at runtime from
   first+count so no unit numbers ride in the skin. */
function rosterList() {
  const out = [];
  for (let i = 0; i < SKIN.dv.unitCount; i++) out.push(SKIN.dv.unitFirst + i);
  return out.join(",");
}

function layoutDay(dayKey, labels, dates, hsSecs, prevKey) {
  const cells = [], merges = [], rowHeights = new Map(), condFmt = [];
  const comments = [];
  /* the drop-downs: per-kind cell ranges, filled in block by block */
  const dvRanges = { cet: [], fprp: [], cars: [], unit: [] };
  /* Every cell names the skin's exact style record (xf) for the saved file,
     and a coarse house look for the on-screen preview. */
  const put = (r, c, xf, v, look) =>
    cells.push({ r, c, xf, v: v === undefined || v === null ? "" : String(v),
                 look: look || 3, sides: [null, null, null, null] });
  const secs = hsSecs[dayKey];
  const prev = prevKey ? hsSecs[prevKey] : null;
  const today = longDate(dayKey, dates[dayKey]);
  const yday = prevKey ? longDate(prevKey, dates[prevKey]) : "";

  // the legend block, rows 1-6, exactly as the workbook has it
  for (const [lr, c, xf, v] of SKIN.legend) put(lr, COL(c), xf, v);
  for (const [lr, h] of Object.entries(SKIN.legendHts)) rowHeights.set(+lr, +h);
  merges.push("B2:E3", "H2:J3", "M2:O2", "M3:O3",
              "S2:T2", "S3:T3", "S4:T4", "S5:T5", "S6:T6");

  let r = 7;
  let pri = 1;
  for (const depot of DEPOTS) {
    const list = (secs && secs.get(depot)) || [];
    const arr = prev ? arrivalsInto(depot, prev) : [];
    if (!list.length && !arr.length) continue;

    // title row, merged across each of its two tables
    for (const [c, xf] of Object.entries(SKIN.title)) {
      const v = c === "B" ? depot + " PM ARRIVALS " +
                  (yday || "— no previous day loaded")
              : c === "H" ? depot + " UNIT ALLOCATIONS " + today : "";
      put(r, COL(c), xf, v, c === "B" || c === "H" ? 8 : 3);
    }
    merges.push("B" + r + ":F" + r, "H" + r + ":T" + r);
    r++;
    for (const [c, xf, v] of SKIN.header) put(r, COL(c), xf, v, 7);
    rowHeights.set(r, +SKIN.headerHt);
    r++;

    // the allocations, one row per unit, in the order they leave
    const rows = [];
    for (const e of list.slice().sort((a, b) => a.time - b.time))
      for (const u of e.units)
        rows.push({
          id: (e.headcode || "") + (e.dest ? " " + e.dest : ""),
          diag: (u.code || "") + u.diag,
          // per WORKING, as their sheet keeps it - the day total only
          // where the stint figure is missing (a PDF-fed build)
          mg: u.mg != null ? u.mg
            : (u.miles == null ? "" : Math.round(u.miles)),
          time: stamp(e), unit: u.unit || "",
          endsAm: endsCode(u.am), endsPm: endsCode(u.pm),
        });
    const n = Math.max(rows.length, arr.length);
    const d0 = r;
    for (let i = 0; i < n; i++) {
      const a = arr[i], v = rows[i];
      /* An arrivals side that runs on after the allocations have finished
         is greyed out on the real sheet, so it is here too. */
      const right = v ? SKIN.data : SKIN.greyRight;
      for (const [c, xf] of Object.entries(SKIN.data)) {
        if (COL(c) >= 7) continue;
        const val = c === "B" ? (a ? a.hc : "") : c === "C" ? (a ? a.at : "")
                  : c === "D" ? (a ? a.unit : "") : c === "E" ? (a ? a.cars : "")
                  : "";
        put(r, COL(c), xf, val);
      }
      for (const [c, xf] of Object.entries(right)) {
        if (COL(c) < 7) continue;
        const val = !v ? ""
          : c === "H" ? v.id : c === "I" ? v.diag : c === "K" ? v.mg
          : c === "L" ? v.time : c === "N" ? v.unit
          : c === "O" ? v.endsAm : c === "Q" ? v.endsPm : "";
        put(r, COL(c), xf, val);
      }
      /* The standing route notes their sheet keeps as comments on the
         DIAGRAM cells - "Not over high level", "Avoids North Kent" -
         carried by headcode, the way ROUTE_BY_HC carries routes. */
      if (v) {
        const note = SKIN.hcNotes[v.id.split(" ")[0]];
        if (note) comments.push({ ref: "I" + r, text: note.join("\n") });
      }
      r++;
    }
    /* Their sheet colours the MG column by the mileage key above: amber
       under 500 miles, red at 500 and over - dxf 0 and 1 in the skin. */
    if (rows.length)
      condFmt.push('<conditionalFormatting sqref="K' + d0 + ':K' + (r - 1) +
        '"><cfRule type="cellIs" dxfId="0" priority="' + pri++ +
        '" operator="lessThan"><formula>500</formula></cfRule>' +
        '<cfRule type="cellIs" dxfId="1" priority="' + pri++ +
        '" operator="greaterThan"><formula>499</formula></cfRule>' +
        '</conditionalFormatting>');
    /* the drop-downs their sheet keeps on these columns: the fleet on
       both UNIT columns, 6/12, the CET mark, and FP/RP */
    if (r > d0) {
      const span = (col) => col + d0 + ":" + col + (r - 1);
      dvRanges.unit.push(span("D"), span("N"));
      dvRanges.cars.push(span("E"));
      dvRanges.cet.push(span("F"));
      dvRanges.fprp.push(span("M"));
    }
    // the ruled strip that closes a block, then a clear row
    for (const [c, xf] of Object.entries(SKIN.gapRow)) put(r, COL(c), xf, "");
    r += 2;
  }

  // the standing house notes, re-anchored under the last block
  const base = r + 1 - 60;
  for (const [fr, c, xf, v] of SKIN.footer) put(fr + base, COL(c), xf, v);
  for (const m of SKIN.footerMerges)
    merges.push(m.replace(/(\d+)/g, d => String(+d + base)));
  r = base + 67;

  const dvDefs = [["cars", SKIN.dv.cars], ["cet", SKIN.dv.cet],
                  ["fprp", SKIN.dv.fprp], ["unit", rosterList()]]
    .filter(([k]) => dvRanges[k].length);
  const dataValidations = dvDefs.length
    ? '<dataValidations count="' + dvDefs.length + '">' +
      dvDefs.map(([k, list]) =>
        '<dataValidation type="list" allowBlank="1" showInputMessage="1"' +
        ' showErrorMessage="1" sqref="' + dvRanges[k].join(" ") + '">' +
        '<formula1>"' + list + '"</formula1></dataValidation>').join("") +
      '</dataValidations>'
    : "";
  return { cells, merges, rowHeights, maxRow: r, comments,
           opts: { stylesXml: SKIN.stylesXml, colsXml: SKIN.colsXml,
                   tabColor: SKIN.tabColor, condFmt, dataValidations,
                   lastCol: "T", noPageSetup: true, widths: PREVIEW_W } };
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
  }).filter(s => s.layout.cells.some(c => c.r > 6 && c.r < 55 && c.v));
}
function writeHsBook(hsSecs, labels, dates, zipFn) {
  const sheets = sheetsFor(hsSecs, labels, dates);
  return sheets.length ? X.writeWorkbook(sheets, zipFn) : null;
}

return { writeHsBook, sheetsFor, layoutDay, endsCode, DEPOTS };
})();
if (typeof module !== "undefined" && module.exports) module.exports = SHEETS_HS;
if (typeof globalThis !== "undefined") globalThis.SHEETS_HS = SHEETS_HS;
