/* SHEETS_HS — the Class 395 Allocations Sheet, in the depot's own dress.

   Not a berthing sheet. The layout is the operator's own workbook: one
   worksheet per day, a block per depot (see DEPOTS below), each
   block two tables side by side - last night's arrivals on the left, the
   day's allocations on the right - with the clean-marks and mileage key
   above and the standing house notes below.

   Everything about how it LOOKS comes from SHEETS_HS_SKIN, which is the
   workbook's own style records lifted verbatim (tools/make-hs-skin.py):
   the exact borders, fills, fonts, row heights, column widths, yellow tab
   and the conditional formatting that colours the MG column green under
   500 miles and red over it. This file only decides what goes in which
   cell.

   The mileage is the strongest check that the reports are read the way the
   depot reads them: on 18/08 the sheet's MG column and the Detail export
   agree to the mile on AZ601 (951), AZ602 (828) and AZ603 (1012). */
"use strict";
const SHEETS_HS = (() => {
const X = SHEETS_XLSX;
const SKIN = SHEETS_HS_SKIN;
const { fmtTime } = SHEETS_CORE;
const { DAY_ROLL } = SHEETS_RULEBOOK;

/* The sheet's own berth vocabulary, which is not the berthing books'. Taken
   from the columns of the real sheet: ASH 2019 times against AFK 6, and RAM
   throughout for Ramsgate. Anything it does not name is passed through. */
const ENDS_CODE = { AFK: "ASH", RE: "RAM", FKE: "FAV" };
/* A berth code as the allocation sheet's ENDS columns write it. */
const endsCode = c => ENDS_CODE[String(c || "").toUpperCase()] ||
                      String(c || "").toUpperCase();

/* The depots that get a block, in the order their workbook lays them out:
   of its daily tabs, 97 run Ashford > Faversham > Ramsgate, 23 run Ashford >
   Margate > Ramsgate and 9 carry all four in this order. A depot with
   nothing to show is skipped, so a tab only ever has the blocks it needs -
   which is why Faversham being left out of this list was invisible until a
   day's reports had a Faversham departure in them and it went quietly
   missing from the sheet. */
const DEPOTS = ["ASHFORD", "FAVERSHAM", "MARGATE", "RAMSGATE"];
/* …and what each is called in the sheet's own ENDS columns, so an arrival
   can be recognised as one. Comparing a berth code against a full location
   name only ever matched Ashford, through a special case; every other
   depot's arrivals table stayed empty however many days were loaded. */
const DEPOT_CODE = { ASHFORD: "ASH", FAVERSHAM: "FAV",
                     MARGATE: "MAR", RAMSGATE: "RAM" };
const COL = l => l.charCodeAt(0) - 64;              // "B" -> 2
/* The weekday reports' day keys - the only days a Genius or Integrale pair
   ever carries. */
const DAY_NAME = { M: "Monday", T: "Tuesday", W: "Wednesday", TH: "Thursday",
                   F: "Friday" };
const DAY_ORDER = ["M", "T", "W", "TH", "F"];
const longDate = (dayKey, date) =>
  (DAY_NAME[dayKey] || "") + " " + String(date || "");

/* Rough per-column widths for the on-screen preview only - the saved file
   carries the workbook's own <cols> verbatim from the skin. */
const PREVIEW_W = [8.4, 8.6, 8.4, 8.6, 8.1, 8.1, 8.4, 8.6, 8.1, 6.4, 5.6,
                   7.1, 6.3, 7.3, 8.3, 7.7, 7.9, 7.7, 8.4, 8.4];

/* Yesterday's arrivals into this depot, read off the day before's own
   entries: one row per unit whose PM berth is here, off its last stint of
   the day. The reports say what the unit LEFT on and when - the departure
   that took it there - not what it arrived on or at what time, so TRAIN ID
   and ARRIVAL TIME are left blank for the depot to fill in rather than
   printed with the departure's figures under the wrong headings. */
function arrivalsInto(depot, secs) {
  const last = new Map();      // diagram -> its latest stint into the depot
  if (!secs) return [];
  const want = DEPOT_CODE[depot] || endsCode(depot);
  const key = t => (t % 1440) < DAY_ROLL ? (t % 1440) + 1440 : (t % 1440);
  for (const [, list] of secs)
    for (const e of list)
      for (const u of e.units) {
        const pm = endsCode(u.pm || (u.ends || "").split(" ")[0]);
        if (pm !== want) continue;
        const id = (u.code || "") + u.diag;
        const prev = last.get(id);
        if (!prev || key(e.time) >= key(prev.time))
          last.set(id, { id, time: e.time, unit: u.unit || "",
                         cars: e.units.length > 1 ? "12" : "6" });
      }
  return Array.from(last.values())
    .sort((a, b) => key(a.time) - key(b.time) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map(a => ({ hc: "", at: "", unit: a.unit, cars: a.cars }));
}

/* The fleet roster for the UNIT drop-downs, built at runtime from
   first+count so no unit numbers ride in the skin. */
function rosterList() {
  const out = [];
  for (let i = 0; i < SKIN.dv.unitCount; i++) out.push(SKIN.dv.unitFirst + i);
  return out.join(",");
}

/* One day's worksheet: the legend, a block per depot with entries, and the
   standing notes, every cell naming the skin's style record. prevKey is
   the day before (its entries fill the arrivals tables) or null. */
function layoutDay(dayKey, dates, hsSecs, prevKey) {
  const cells = [], merges = [], rowHeights = new Map(), condFmt = [];
  const comments = [];
  /* the drop-downs: per-kind cell ranges, filled in block by block */
  const dvRanges = { cet: [], fprp: [], cars: [], unit: [] };
  /* Every cell names the skin's exact style record (xf), which both the
     saved file and the on-screen preview draw it with. */
  const put = (r, c, xf, v, num) => {
    const cell = { r, c, xf, v: v === undefined || v === null ? "" : String(v),
                   sides: [null, null, null, null] };
    // a real number cell, so the MG colour rules can compare it
    if (num) cell.num = true;
    cells.push(cell);
  };
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
  let blocks = 0;
  for (const depot of DEPOTS) {
    const list = (secs && secs.get(depot)) || [];
    const arr = prev ? arrivalsInto(depot, prev) : [];
    if (!list.length && !arr.length) continue;
    blocks++;

    // title row, merged across each of its two tables
    for (const [c, xf] of Object.entries(SKIN.title)) {
      const v = c === "B" ? depot + " PM ARRIVALS " +
                  (yday || "— no previous day loaded")
              : c === "H" ? depot + " UNIT ALLOCATIONS " + today : "";
      put(r, COL(c), xf, v);
    }
    merges.push("B" + r + ":F" + r, "H" + r + ":T" + r);
    r++;
    for (const [c, xf, v] of SKIN.header) put(r, COL(c), xf, v);
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
          hl: u.hl,
          time: fmtTime(e.time, e.time_kind), unit: u.unit || "",
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
        // UNIT NUMBER and 6 OR 12 CAR are numbers on their sheet too
        put(r, COL(c), xf, val,
            (c === "D" || c === "E") && /^\d+$/.test(String(val)));
      }
      for (const [c, xf] of Object.entries(right)) {
        if (COL(c) < 7) continue;
        const val = !v ? ""
          : c === "H" ? v.id : c === "I" ? v.diag : c === "K" ? v.mg
          : c === "L" ? v.time : c === "N" ? v.unit
          : c === "O" ? v.endsAm : c === "Q" ? v.endsPm : "";
        const num = (c === "K" || c === "N") && val !== "" &&
                    /^\d+$/.test(String(val));
        put(r, COL(c), xf, val, num);
        /* Excel paints the mileage rules over the cell when the book opens.
           The preview has to do it itself, or MG shows its base fill and the
           sheet on screen disagrees with the one in the workbook. Same two
           dxf records the conditional formatting below names. */
        if (c === "K" && num)
          cells[cells.length - 1].cfCss =
            SKIN.dxfCss[Number(val) < 500 ? 0 : 1];
      }
      /* The route notes their sheet keeps as comments on the DIAGRAM
         cells. "Not over high level" is DERIVED, per working: a stint
         with a leg between Ebbsfleet and Gravesend goes over the high
         level, one without does not - which is where their own tab puts
         the note. The North Kent notes still come from the standing
         lookup by headcode; a PDF-fed build, with no legs to read, falls
         back to the lookup for the high-level note too. */
      if (v) {
        const std = SKIN.hcNotes[v.id.split(" ")[0]] || [];
        const notes = v.hl === undefined ? std
          : std.filter(t => !/high level/i.test(t))
               .concat(v.hl ? [] : ["Not over high level"]);
        if (notes.length) comments.push({ ref: "I" + r, text: notes.join("\n") });
      }
      r++;
    }
    /* Their sheet colours the MG column by the mileage key above: green
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
  return { cells, merges, rowHeights, maxRow: r, comments, blocks,
           opts: { stylesXml: SKIN.stylesXml, colsXml: SKIN.colsXml,
                   // the same records again, as CSS, for the preview
                   xfCss: SKIN.xfCss, previewFont: "calibri",
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
             layout: layoutDay(d, dates, hsSecs, i > 0 ? days[i - 1] : null) };
    /* A day with no 395 work gets no tab. Testing for "any filled cell in
       the block rows" looked equivalent and was not: with no blocks to
       anchor it the standing footer is re-anchored right up into that range,
       so an empty day satisfied the test and shipped a tab carrying the
       legend and the house notes and nothing else. Count the blocks. */
  }).filter(s => s.layout.blocks > 0);
}
/* The whole allocations workbook as bytes, or null when no day has any
   395 work. */
function writeHsBook(hsSecs, labels, dates, zipFn) {
  const sheets = sheetsFor(hsSecs, labels, dates);
  return sheets.length ? X.writeWorkbook(sheets, zipFn) : null;
}

return { writeHsBook, sheetsFor, layoutDay, endsCode, arrivalsInto, DEPOTS };
})();
if (typeof module !== "undefined" && module.exports) module.exports = SHEETS_HS;
if (typeof globalThis !== "undefined") globalThis.SHEETS_HS = SHEETS_HS;
