/* SHEETS_METRO — the Metro book in the depot's own format.

   This is not the berthing sheet. The Metro sheets are a separate document
   with its own shape, taken from the operator's own May 2026 workbook:

     * one worksheet per location, not one per day, landscape A4;
     * a title row, "SERVICES STARTING <WHERE> MONDAY TO FRIDAY", and the
       date against it;
     * one row per unit, the headcode, time and destination written once on
       the entry's first row and the rest of the formation under it;
     * sixteen columns, of which the reports fill nine. Two of the rest are
       spares with no heading at all, which the depot uses when a comment
       overflows; the other five are ruled and left empty to write in, the
       way the Unit column already is on the berthing books. All seven are
       hand-kept in the real workbook too.

   Grove Park and Slade Green get an AM and a PM sheet, which is how the real
   workbook splits them, and their ROAD column carries the Dn / Up / Shed the
   working comes off. */
"use strict";
const SHEETS_METRO = (() => {
const X = SHEETS_XLSX;
const { fmtTime } = SHEETS_CORE;
const { DEST_TLC, DEPOT_ROAD } = SHEETS_DATA;
const { DAY_ROLL } = SHEETS_RULEBOOK;
/* Where the AM sheet ends and the PM sheet starts at the two depots.
   Read off the depot's own May 2026 workbook rather than picked: its AM
   sheets run to 07+10 (Slade Green) and 07+23 (Grove Park), and its PM
   sheets open at 10+40 (Slade Green) and 13+12 (Grove Park), so the
   boundary it keeps lies between 07+23 and 10+40. Ten o'clock sits inside
   that with room either side, and the morning peak is over by it.
   NOT the berthing books' AM_CUTOFF: that is 14:00, which would put Grove
   Park's 13+12 on the AM sheet, and the workbook has it on the PM one. */
const AM_SHEET_END = 10 * 60;

/* Column widths, and the two headings that change with the location: a
   terminus has PLATFORMs where a depot has ROADs, and the two big depots
   call the timing point a SIGNAL where everywhere else calls it a STATION.
   Both are the real workbook's own wording. */
/* Column widths, read off the workbook's own ASHFORD sheet. */
const WIDTHS = [11.3, 11, 16.3, 17.9, 8.1, 14, 14.9, 9.1, 9.1, 16.1,
                2.9, 2.9, 3.7, 3.7, 10.6, 9.1];
const SIGNAL_AT = new Set(["GROVE PARK", "SLADE GREEN"]);
/* Victoria is NOT one of these: the workbook heads its column ROAD, the
   same as every other location that is not a London terminus. */
const PLATFORM_AT = new Set(["CANNON STREET", "CHARING CROSS",
                             "LONDON BRIDGE", "BLACKFRIARS"]);
/* The sixteen column headings for a location, in the workbook's own order.
   Columns 10 and 11 carry no heading: they are the spares a long comment
   runs into, and the depot rules them like the rest of the grid. */
function headings(sec) {
  return ["TRAIN I.D.", "SIDINGS", SIGNAL_AT.has(sec) ? "SIGNAL" : "STATION",
          "DESTINATION", "POS", "DIAG", "FORMATION",
          PLATFORM_AT.has(sec) ? "PLATFORM" : "ROAD", "COMMENTS", "", "",
          "S", "R/T", "L/S", "ENDS", "MILES"];
}
const NCOL = 16;
/* The destination in full, which is how this sheet writes it - the berthing
   books use the three-letter code. The name table is keyed the other way
   round, so it is turned once here. */
const NAME_OF = (() => {
  const m = {};
  for (const name of Object.keys(DEST_TLC)) {
    const code = DEST_TLC[name];
    // the first spelling wins: the table has several names per code and the
    // earliest is the plain one ("VICTORIA" before "LONDON VICTORIA")
    if (!(code in m)) m[code] = name;
  }
  return m;
})();
const destName = code => NAME_OF[String(code || "").toUpperCase()] || code || "";

/* Which sheet an entry belongs on. Grove Park and Slade Green are split by
   the time of day, the way the real workbook splits them; everywhere else
   is one sheet.

   The split was PM_BREAK (20:00), which is not a morning and an afternoon
   at all: the AM sheet carried the whole PM peak and the PM sheet held only
   what left after eight in the evening. A departure before 03:00 is the
   back of last night's work, so it stays on the PM sheet. */
function sheetFor(sec, e) {
  if (!SIGNAL_AT.has(sec)) return sec;
  const t = e.time % 1440;
  return sec + (t < DAY_ROLL || t >= AM_SHEET_END ? " PM" : " AM");
}
/* The Dn / Up / Shed indicator for the ROAD column: which road at the depot
   this working comes off. Known for the two metro depots only, and blank
   where the entry starts in a platform rather than on a road. */
function roadOf(e) {
  const origin = (e.pub && e.pub.sheet) || "";
  return DEPOT_ROAD[String(origin).toUpperCase()] || "";
}

/* looks: 1 = section title, 3 = centred body, 5 = right, 6 = bold centred */
const HEAD_LOOK = 6, BODY_LOOK = 3, TITLE_LOOK = 1;
const EMAIL_LINE =
  "PLEASE E-MAIL SHEETS TO .Engineering Stock Maintenance Controllers Metro";
/* dd/mm/yy as the sheets write it: DATED 18.05.26 */
const dated = d => String(d || "").replace(/\//g, ".");
/* A figure the reports left blank, or could not read, is not a number:
   NaN written into a number cell is a workbook Excel repairs on opening. */
const finite = v => v != null && v !== "" && Number.isFinite(+v);
/* One location's worksheet: the cell layout writeWorkbook and previewHtml
   both read. name carries its AM/PM suffix; dateLbl is the banner ("MON
   03/08"), dateFull the sign-off's dd/mm/yy. */
function layoutSection(name, entries, dateLbl, dateFull) {
  const issued = dated(dateFull);
  const cells = [], merges = [], rowHeights = new Map();
  /* noFit: a cell that must not stretch its column. The title and the
     sign-off block are long free text that the real workbook simply lets
     overflow across the empty cells to its right, which is what Excel does
     anyway - measured in, they pushed TRAIN I.D. from 11 characters wide to
     the 32-character cap. */
  /* A figure written as text carries Excel's "number stored as text" mark
     and cannot be sorted or summed; the depot's own workbook holds POS and
     MILES as numbers, so these do too. Same flag the 395 sheet's MG uses. */
  const put = (r, c, v, look, sides, noFit, num) =>
    cells.push({ r, c, v: v === undefined || v === null ? "" : String(v),
                 look, sides: sides || [null, null, null, null],
                 noFit: !!noFit, num: !!num });
  let r = 1;
  put(r, 1, "SERVICES STARTING " + name + " MONDAY TO FRIDAY", TITLE_LOOK);
  put(r, 13, dateLbl, 2);
  merges.push("A1:E1");
  rowHeights.set(r, 18); r++;
  const head = headings(name.replace(/ (AM|PM)$/, ""));
  head.forEach((h, i) =>
    put(r, i + 1, h, HEAD_LOOK, [null, null, "medium", "medium"]));
  rowHeights.set(r, 18); r++;

  const sorted = entries.slice().sort((a, b) => {
    const ka = (a.time % 1440) < DAY_ROLL ? (a.time % 1440) + 1440 : a.time % 1440;
    const kb = (b.time % 1440) < DAY_ROLL ? (b.time % 1440) + 1440 : b.time % 1440;
    return ka - kb;
  });
  const blockRows = [];
  for (const e of sorted) {
    const first = r;
    // one formation is one unbreakable block on the paper
    blockRows.push(first);
    /* This sheet reads by POSITION, lowest first, which is not the berthing
       books' order - they list the units the way they stand on the ground,
       front one first. The operator's own workbook numbers the POS column
       1, 2, 3 straight down every formation on it. */
    const units = e.units.slice().sort((a, b) => {
      const pa = finite(a.pos) ? +a.pos : 99, pb = finite(b.pos) ? +b.pos : 99;
      return pa - pb || (a.diag < b.diag ? -1 : a.diag > b.diag ? 1 : 0);
    });
    units.forEach((u, i) => {
      const lastOfEntry = i === units.length - 1;
      const bot = lastOfEntry ? "thin" : null;
      const col = (c, v, look, num) =>
        put(r, c, v, look === undefined ? BODY_LOOK : look,
            [c === 1 ? "medium" : "thin", c === NCOL ? "medium" : "thin", null, bot],
            false, num);
      // written once, against the top row of the formation
      col(1, i === 0 ? (e.headcode || "") : "");
      col(2, i === 0 ? fmtTime(e.time, e.time_kind) : "");
      col(3, "");                                   // STATION / SIGNAL: by hand
      col(4, i === 0 ? destName(e.dest) : "");
      col(5, finite(u.pos) ? +u.pos : "", undefined, finite(u.pos));
      col(6, (u.code || "") + u.diag);
      col(7, u.unit || "");                         // the allocated unit
      // ROAD: the depot road this working comes off, where the tool knows
      // it; a platform departure and everywhere but the two depots stay
      // blank for the depot to write in
      col(8, i === 0 ? roadOf(e) : "");
      col(9, "");                                   // COMMENTS: by hand
      col(10, ""); col(11, "");                     // the two spares
      col(12, ""); col(13, ""); col(14, "");        // S, R/T, L/S: by hand
      col(15, u.ends || "");
      col(16, finite(u.miles) ? Math.round(+u.miles) : "", 5, finite(u.miles));
      rowHeights.set(r, 18);
      r++;
    });
  }
  /* The block every sheet in the real workbook ends with: a blank row, the
     issue date with room for a name and a signature beside it, and the line
     saying where the finished sheet goes back to. */
  r++;
  /* Each given the room it needs rather than left to spill across its
     neighbours: Excel lets text out of an empty cell, a table does not. */
  put(r, 1, "DATED " + issued, BODY_LOOK, null, true);
  put(r, 5, "NAME", BODY_LOOK, null, true);
  put(r, 11, "SIGNATURE", BODY_LOOK, null, true);
  merges.push("A" + r + ":D" + r, "E" + r + ":J" + r, "K" + r + ":P" + r);
  rowHeights.set(r, 18); r++;
  put(r, 1, EMAIL_LINE, 4, null, true);
  merges.push("A" + r + ":P" + r);
  rowHeights.set(r, 18); r++;
  return { cells, merges, rowHeights, maxRow: r,
           opts: { widths: fitWidths(cells), landscape: true, fitToHeight: 0,
                   blockRows: blockRows } };
}

/* Column widths sized to what is actually in them, never narrower than the
   real workbook's. The body is bold Arial 11 where a column width counts in
   Calibri 11 characters, so a value fills about a fifth more room than its
   length suggests: DESTINATION at the workbook's own 17.9 clipped
   "TUNBRIDGE WELLS", and Cannon Street's destinations with it. The title row
   is left out of the measurement - it is merged across five columns and
   would otherwise stretch column A on its own. */
/* Measured, not guessed: a canvas at each look's own font, against Excel's
   width unit of one Calibri 11 digit. In capitals, bold Arial 11 runs about
   1.40 to the character - "CANNON STREET" wants 18.2 where the workbook's own
   column is 17.9, which is exactly the clipping that was reported. */
const LOOK_WIDE = { 1: 1.53, 2: 1.60, 3: 1.40, 4: 1.15, 5: 1.15, 6: 1.27 };
const MAX_WIDTH = 32;
function fitWidths(cells) {
  const need = WIDTHS.slice();
  for (const c of cells) {
    if (c.r === 1 || c.noFit) continue;
    const i = c.c - 1;
    if (i < 0 || i >= need.length) continue;
    const w = String(c.v || "").length * (LOOK_WIDE[c.look] || 1.1) + 1.6;
    if (w > need[i]) need[i] = w;
  }
  return need.map(w => Math.round(Math.min(w, MAX_WIDTH) * 10) / 10);
}

/* One workbook, one worksheet per location, in the section order the book
   already uses with the AM/PM splits slotted in where they fall.

   One day's reports give one sheet per location, named for the location.
   A pair covering several days gives one per location PER DAY - "DARTFORD
   MON", "DARTFORD TUE" - each dated its own day. Folding every day into
   the one tab, dated day one, listed Tuesday's 05+00 under Monday's date
   as if the unit left twice. The sheets array carries a `notes` list
   saying so for the review list. */
function sheetsFor(secsByDay, dateLabels, order, dates) {
  const bySheet = new Map();
  const days = Object.keys(dateLabels).filter(d => secsByDay[d]);
  const multi = days.length > 1;
  const dayTag = day => {
    const m = /^([A-Z]{3})\b/.exec(String(dateLabels[day] || ""));
    return m ? m[1] : String(day);
  };
  for (const day of days) {
    for (const [sec, list] of secsByDay[day])
      for (const e of list) {
        const name = sheetFor(sec, e);
        const key = multi ? name + " " + day : name;
        if (!bySheet.has(key)) bySheet.set(key, { name, day, entries: [] });
        bySheet.get(key).entries.push(e);
      }
  }
  const rank = new Map((order || []).map((s, i) => [s, i]));
  const dayRank = new Map(days.map((d, i) => [d, i]));
  const secOf = n => n.replace(/ (AM|PM)$/, "");
  const keys = Array.from(bySheet.keys()).sort((a, b) => {
    const A = bySheet.get(a), B = bySheet.get(b);
    const ra = rank.has(secOf(A.name)) ? rank.get(secOf(A.name)) : 999;
    const rb = rank.has(secOf(B.name)) ? rank.get(secOf(B.name)) : 999;
    return ra - rb || (A.name < B.name ? -1 : A.name > B.name ? 1 : 0)
           || dayRank.get(A.day) - dayRank.get(B.day);
  });
  const sheets = keys.map(key => {
    const s = bySheet.get(key);
    const tab = multi ? s.name + " " + dayTag(s.day) : s.name;
    return {
      // Excel will not take more than 31 characters in a tab name
      name: tab.slice(0, 31),
      layout: layoutSection(s.name, s.entries, dateLabels[s.day] || "",
                            (dates || {})[s.day] || ""),
    };
  });
  sheets.notes = multi
    ? ["The reports cover " + days.map(d => dateLabels[d]).join(", ") +
       " — the Metro book has a worksheet per location per day, named " +
       days.map(dayTag).map(t => "“<LOCATION> " + t + "”").join(", ") +
       ". Check each is the day it says."]
    : [];
  return sheets;
}
/* The whole Metro workbook as bytes, or null when no day has any Metro
   entries. dates: day key -> dd/mm/yy, for the sign-off block. */
function writeMetroBook(secsByDay, dateLabels, order, zipFn, dates) {
  const sheets = sheetsFor(secsByDay, dateLabels, order, dates);
  return sheets.length ? X.writeWorkbook(sheets, zipFn) : null;
}

return { writeMetroBook, sheetsFor, layoutSection, fitWidths, headings, WIDTHS };
})();
if (typeof module !== "undefined" && module.exports) module.exports = SHEETS_METRO;
if (typeof globalThis !== "undefined") globalThis.SHEETS_METRO = SHEETS_METRO;
