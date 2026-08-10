/* One-shot, reproducible extraction of the legacy monolith into src/ modules.
   Slices test/fixtures/legacy.html by line ranges and applies the targeted
   rewrites of the overhaul. Every splice target is asserted, so a drifted
   range fails loudly instead of producing a subtly wrong module. */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const SRC = readFileSync(new URL("../test/fixtures/legacy.html", import.meta.url), "utf8")
  .split("\n");
const cut = (a, b) => SRC.slice(a - 1, b).join("\n");
function mustInclude(text, needle, what) {
  if (!text.includes(needle)) throw new Error(`${what}: missing «${needle.slice(0, 60)}…»`);
  return text;
}
function repl(text, from, to, what) {
  mustInclude(text, from, what);
  return text.split(from).join(to);
}
mkdirSync("src/vendor", { recursive: true });

/* ---------------- vendor ---------------- */
writeFileSync("src/vendor/fflate.js",
  "/* fflate (MIT) — https://github.com/101arrowz/fflate — bundled verbatim\n" +
  "   from the legacy build. Zip/unzip for docx + xlsx, and zlib inflate for\n" +
  "   the Genius PDF streams. */\n" + cut(3447, 3447) + "\n");

/* ---------------- data.js ---------------- */
const dataParts = [
  "/* All of the tool's local knowledge in one module: berths, codes,\n" +
  "   sections, fleets and rule tables for every engine. Corrections belong\n" +
  "   here, not in the engines. */\n" +
  '"use strict";\nconst SHEETS_DATA = (() => {\n',
  "/* ==== shared berth/destination reference (ex core) ==== */",
  cut(770, 792),   // DEST_TLC
  cut(794, 884),   // BERTH_SHEETS
  cut(886, 894),   // NON_BERTH_VISIT
  cut(896, 899),   // SIDING_CLASS_RE
  "\n/* ==== house sheet layout (ex xlsx glue) ==== */",
  cut(2472, 2490), // MAIN_ORDER..HS_ORDER
  "\n/* ==== Genius location knowledge (ex GENIUS) ==== */",
  cut(2945, 2976),
  cut(2980, 2988), // STABLE_CODES (with comment)
  cut(2993, 2999), // NAME_CODE / FIX_CODE
  cut(3029, 3041), // PROFILES_G
  cut(3072, 3078), // MINOR_SPUR (with comment)
  cut(3113, 3129).replace("const END_MARKERS =", "const END_MARKERS_GENIUS ="),
  "\n/* ==== weekend prints knowledge (ex SheetsEngine) ==== */",
  cut(3456, 3525), // DEST_CODE..STATION_TABLE + STATIONS (includes PLATFORM,
                   // BASE_STABLING, TRANSIT in their original spots)
  cut(3527, 3538), // MANUAL_LOC
  cut(3630, 3642).replace("const END_MARKERS =", "const END_MARKERS_PRINTS ="),
  cut(3661, 3715), // book profiles
  `
return {
  DEST_TLC, BERTH_SHEETS, NON_BERTH_VISIT, SIDING_CLASS_RE,
  MAIN_ORDER, METRO_ORDER, HS_ORDER, HEADCODE_SECTIONS, GP_ROAD,
  SIDING_NOTES, END_STYLE, DAY_SHEET,
  CODE2NAME, GROUP_EXTRA, STABLE_CODES, NAME_CODE, FIX_CODE,
  PROFILES_G, MINOR_SPUR, END_MARKERS_GENIUS,
  DEST_CODE, BERTH_CODE, NOTE_FROM_BERTH, PLATFORM, BASE_STABLING,
  TRANSIT, STATION_TABLE, STATIONS, MANUAL_LOC, END_MARKERS_PRINTS,
  MAINLINE, METRO, HIGHSPEED, PROFILES,
};
})();
if (typeof module !== "undefined" && module.exports) module.exports = SHEETS_DATA;
if (typeof globalThis !== "undefined") globalThis.SHEETS_DATA = SHEETS_DATA;`,
];
let dataJs = dataParts.join("\n");
mustInclude(dataJs, "const PROFILES_G = [", "data.js: PROFILES_G");
mustInclude(dataJs, "const STATIONS = STATION_TABLE", "data.js: STATIONS");
writeFileSync("src/data.js", dataJs + "\n");

/* ---------------- core.js ---------------- */
const coreJs = [
  "/* SHEETS core — the shared helpers and drafting rules every engine leans\n" +
  "   on: name normalisation, destination codes, the berth AM/PM rule.\n" +
  "   (The retired ACWN workbook pipeline that used to live here was removed\n" +
  "   in the 2.0 overhaul — see git history for tracer3/builder3.) */\n" +
  '"use strict";\nconst SHEETS_CORE = (() => {\n' +
  "const { DEST_TLC, BERTH_SHEETS, NON_BERTH_VISIT, SIDING_CLASS_RE } = SHEETS_DATA;",
  cut(424, 435),   // pyStr/strip/stripChars/pad2 (stripChars unused but tiny)
  cut(551, 560),   // cleanLoc / bracketOf
  cut(761, 768),   // norm / sheetStation
  cut(901, 909),   // isSiding / binfo
  cut(930, 945),   // locBinfo / destTlc / bracketDest
  "// ---------- berth AM/PM rule (ex builder3) ----------",
  "const AM_CUTOFF = 14 * 60;\nconst PM_STAY = 18 * 60;\nconst SHUNT_DWELL = 65;",
  cut(1530, 1549), // fmtTime / clsText / visitCode / sectionOf
  cut(1705, 1759), // amPm
  `
return { strip, pyStr, pad2, cleanLoc, norm, sheetStation, isSiding,
         locBinfo, destTlc, fmtTime, amPm,
         BERTH_SHEETS, DEST_TLC, NON_BERTH_VISIT };
})();
if (typeof module !== "undefined" && module.exports) module.exports = SHEETS_CORE;
if (typeof globalThis !== "undefined") globalThis.SHEETS_CORE = SHEETS_CORE;`,
].join("\n");
mustInclude(coreJs, "function amPm(visits, flags)", "core.js: amPm");
writeFileSync("src/core.js", coreJs + "\n");

/* ---------------- rulebook.js ---------------- */
writeFileSync("src/rulebook.js", `/* Shared rulebook primitives used by both the Genius and the prints
   engines: the day-shape constants and the stop-collapsing walk. The
   engines keep their own field extraction — only the structure is shared. */
"use strict";
const SHEETS_RULEBOOK = (() => {
  const DAY_ROLL = 180;      // times below this have wrapped past midnight
  const PM_BREAK = 20 * 60;  // a berth still occupied this late is the PM end
  const RUN_ROUND = 60;      // out and straight back inside this, nothing
                             // worked, is a run-round not a departure
  /* Consecutive rows at one location form one stop. Returns [i0, i1] index
     runs; isCont marks rows that continue the current run regardless of
     location (the prints' blank-location rows). */
  function runsOf(items, locOf, isCont) {
    const out = [];
    let i = 0;
    while (i < items.length) {
      const loc = locOf(items[i]);
      let j = i;
      while (j < items.length &&
             (locOf(items[j]) === loc || (isCont && isCont(items[j])))) j++;
      out.push([i, j - 1]);
      i = j;
    }
    return out;
  }
  return { DAY_ROLL, PM_BREAK, RUN_ROUND, runsOf };
})();
if (typeof module !== "undefined" && module.exports) module.exports = SHEETS_RULEBOOK;
if (typeof globalThis !== "undefined") globalThis.SHEETS_RULEBOOK = SHEETS_RULEBOOK;
`);

/* ---------------- xlsx.js ---------------- */
let writerPart = cut(4296, 4447);   // esc..zipXlsx
let previewPart = cut(4543, 4595);  // PREVIEW_PX..previewHtml
let weekdayLayout = cut(2492, 2622); // entryRows..mergeAlpha

// Generalise the single-sheet zip into a multi-sheet workbook writer.
writerPart = repl(writerPart,
  "function buildSheetXml(cells, merges, rowHeights, maxRow){\n" +
  "  const widths = [12.4, 9.1, 7.3, 4.7, 5.4, 12.9, 11.9, 27.6];",
  "function buildSheetXml(cells, merges, rowHeights, maxRow){\n" +
  "  const widths = HOUSE_WIDTHS;",
  "xlsx.js: widths hoist");
writerPart = repl(writerPart, cut(4414, 4447),
`/* Multi-sheet workbook: shared styles, one worksheet part per sheet.
   sheets: [{name, layout:{cells, merges, rowHeights, maxRow}}]. Cells carry
   look + sides; the StyleBook indexes them across every sheet so the books
   stay small. */
function writeWorkbook(sheets, zipFn){
  const sb = new StyleBook();
  const parts = sheets.map(function(s){
    for (const c of s.layout.cells) c.s = sb.style(c.look, sb.border(c.sides));
    return buildSheetXml(s.layout.cells, s.layout.merges,
                         s.layout.rowHeights, s.layout.maxRow);
  });
  const enc = new TextEncoder();
  let types =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>';
  let sheetTags = "", relTags =
    '<Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>';
  const files = {};
  parts.forEach(function(xml, i){
    const n = i + 1;
    types += '<Override PartName="/xl/worksheets/sheet' + n + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>';
    sheetTags += '<sheet name="' + esc(sheets[i].name) + '" sheetId="' + n + '" r:id="rId' + n + '"/>';
    relTags += '<Relationship Id="rId' + n + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + n + '.xml"/>';
    files["xl/worksheets/sheet" + n + ".xml"] = enc.encode(xml);
  });
  types += '</Types>';
  files["[Content_Types].xml"] = enc.encode(types);
  files["_rels/.rels"] = enc.encode(
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
    '</Relationships>');
  files["xl/workbook.xml"] = enc.encode(
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    '<sheets>' + sheetTags + '</sheets>' +
    '<calcPr calcId="124519" fullCalcOnLoad="1"/></workbook>');
  files["xl/_rels/workbook.xml.rels"] = enc.encode(
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    relTags + '</Relationships>');
  files["xl/styles.xml"] = enc.encode(sb.xml());
  return zipFn(files);
}`,
  "xlsx.js: writeWorkbook");

// Weekday layout glue: alias the data/core names its slices reference.
weekdayLayout = repl(weekdayLayout,
  "  function* entryRows(e, section) {",
  "  function* entryRows(e, section) {", "xlsx.js: entryRows anchor");

const xlsxJs = `/* SHEETS_XLSX — the one xlsx writer and the one preview renderer, plus the
   weekday book layout. Both the weekday and the weekend books go through
   writeWorkbook, and both previews render the same cell layout that gets
   saved, so what you look at is what you get. (ExcelJS is gone: the books
   are written directly as SpreadsheetML, ~75% of the old file size.) */
"use strict";
const SHEETS_XLSX = (() => {
const CORE = SHEETS_CORE;
const { fmtTime, norm, sheetStation } = CORE;
const { MAIN_ORDER, METRO_ORDER, HS_ORDER, HEADCODE_SECTIONS, GP_ROAD,
        SIDING_NOTES, END_STYLE, DAY_SHEET } = SHEETS_DATA;
const HOUSE_WIDTHS = [12.4, 9.1, 7.3, 4.7, 5.4, 12.9, 11.9, 27.6];

/* ==== generic writer (ex weekend engine) ==== */
${writerPart}

/* ==== unified preview (ex weekend engine) ==== */
${previewPart}

/* ==== weekday layout (ex ExcelJS glue) ==== */
${weekdayLayout}

/* Weekday layout rows -> the writer's cell layout. Mirrors what the old
   ExcelJS path put on each worksheet: looks per column, V_EDGES verticals,
   the entry rules, and the flag column merged per entry. */
const V_LOOK = { 1: 3, 2: 3, 3: 3, 4: 4, 5: 4, 6: 3, 7: 6, 8: 5 };
function rowsToLayout(rowsIn) {
  const cells = [], merges = [], rowHeights = new Map();
  const rowEdge = new Map();
  const pendingMerges = [];
  let r = 1;
  for (const row of rowsIn) {
    if (row.kind === "hdr") {
      merges.push("A" + r + ":G" + r);
      cells.push({ r, c: 1, v: row.name, look: 1, sides: [null, null, null, null] });
      cells.push({ r, c: 8, v: row.date, look: 2, sides: [null, null, null, null] });
      rowHeights.set(r, 18);
      r += 1;
    } else if (row.kind === "data") {
      for (let c = 1; c <= 8; c++) {
        const [l, rr] = V_EDGES[c];
        const val = row.vals[c] !== undefined ? row.vals[c] : "";
        cells.push({ r, c, v: val, look: V_LOOK[c],
                     sides: [l, rr, row.top || null, row.bot || null] });
      }
      rowEdge.set(r, [row.top || null, row.bot || null]);
      if (row.flagSpan > 1) pendingMerges.push([r, r + row.flagSpan - 1]);
      rowHeights.set(r, 18);
      r += 1;
    } else {
      r += 1;
    }
  }
  const at = new Map();
  for (const c of cells) at.set(c.r + "," + c.c, c);
  for (const [r0, r1] of pendingMerges) {
    const top = (rowEdge.get(r0) || [null, null])[0];
    const bot = (rowEdge.get(r1) || [null, null])[1];
    for (let rr = r0; rr <= r1; rr++) {
      const cell = at.get(rr + ",7");
      if (cell) cell.sides = [null, null, top, bot];
    }
    merges.push("G" + r0 + ":G" + r1);
  }
  return { cells, merges, rowHeights, maxRow: r };
}

function bookOrder(secsByDay, base, splitRamsgate) {
  const present = new Set();
  for (const d of Object.keys(secsByDay)) {
    const sd = secsByDay[d];
    if (!sd) continue;
    const names = typeof sd.get === "function" ? Array.from(sd.keys()) : Object.keys(sd);
    for (const s of names) present.add(s);
  }
  const extras = Array.from(present)
    .filter(s => !base.includes(s) && (!splitRamsgate || s !== "RAMSGATE"));
  return mergeAlpha(base, extras);
}

function writeBooks(secsByDay, dateLabels, ram, opts) {
  opts = opts || {};
  const base = opts.baseOrder || MAIN_ORDER;
  const splitRamsgate = opts.splitRamsgate !== false;
  const fullOrder = bookOrder(secsByDay, base, splitRamsgate);
  const dayKeys = ["M", "T", "W", "TH", "F"].filter(d => d in dateLabels);
  const sheets = dayKeys.map(day => ({
    name: DAY_SHEET[day],
    layout: rowsToLayout(layoutSheet(secsByDay[day], dateLabels[day], ram, fullOrder)),
  }));
  return writeWorkbook(sheets, opts.zipFn || (f => fflate.zipSync(f, { level: 6 })));
}

function dayPreviewHtml(secs, label, ram, order) {
  return previewHtml(rowsToLayout(layoutSheet(secs, label, ram, order)));
}

return { writeBooks, bookOrder, layoutSheet, rowsToLayout, writeWorkbook,
         previewHtml, dayPreviewHtml, StyleBook, buildSheetXml, esc, colName,
         DAY_SHEET, MAIN_ORDER, METRO_ORDER, HS_ORDER };
})();
if (typeof module !== "undefined" && module.exports) module.exports = SHEETS_XLSX;
if (typeof globalThis !== "undefined") globalThis.SHEETS_XLSX = SHEETS_XLSX;
`;
mustInclude(xlsxJs, "function writeWorkbook", "xlsx.js: writeWorkbook present");
mustInclude(xlsxJs, "function layoutSheet", "xlsx.js: layoutSheet present");
mustInclude(xlsxJs, "function previewHtml(layout)", "xlsx.js: unified preview present");
writeFileSync("src/xlsx.js", xlsxJs);

/* ---------------- engine.js ---------------- */
let engineJs = [
  "/* SheetsEngine — the weekend pipeline, a JS port of make_sheets.py.\n" +
  "   Same rules, same output. Runs in the browser and in node. Reference\n" +
  "   tables live in data.js; the xlsx writer and preview in xlsx.js. */\n" +
  '"use strict";\n(function (root) {\n' +
  "const { DEST_CODE, BERTH_CODE, NOTE_FROM_BERTH, PLATFORM, BASE_STABLING,\n" +
  "        TRANSIT, STATIONS, MANUAL_LOC } = SHEETS_DATA;\n" +
  "const END_MARKERS = SHEETS_DATA.END_MARKERS_PRINTS;\n" +
  "const PROFILES = SHEETS_DATA.PROFILES;\n" +
  "const { DAY_ROLL, PM_BREAK, RUN_ROUND, runsOf } = SHEETS_RULEBOOK;",
  cut(3539, 3561),  // QUAL_RE..cleanName
  cut(3562, 3611),  // resolveStation/codeFor/looksLikeStabling
  cut(3613, 3628),  // finalBerth
  cut(3643, 3651),  // legLocs
  "const SHORT_BERTH = 20;   // a stop shorter than this at an unmarked,\n" +
  "                          // un-siding-named place is reported, not trusted\n" +
  "const GAP_WARN = 60;\n" +
  'const ATT = ["ATTACH","ATTTT"], DET = ["DETACH","DETTT"];',
  cut(3717, 3915),  // docx -> lines, .doc reader, readPrints
  cut(3917, 3957),  // parseDiagrams..mod1440
  // stopsOf rebuilt on the shared runsOf walk
  `function stopsOf(rows){
  const out = []; let lastHc = null;
  for (const [i, j1] of runsOf(rows, r => r.loc, r => r.loc === "")){
    const grp = [];
    for (let k = i; k <= j1; k++) grp.push([k, rows[k]]);
    const loc = rows[i].loc;
    let hcOut = null;
    for (let k = grp.length-1; k >= 0; k--) if (grp[k][1].hc){ hcOut = grp[k][1].hc; break; }
    let arr = null;
    for (const [,x] of grp) if (x.arr){ arr = mins(x.arr); break; }
    let dep = null, depIdx = null;
    for (let k = grp.length-1; k >= 0; k--) if (grp[k][1].dep){
      dep = mins(grp[k][1].dep); depIdx = grp[k][0]; break;
    }
    let hash = false;
    for (const [,x] of grp) if (x.ev === "#"){ hash = true; break; }
    out.push({loc, i0:i, i1:j1, arr, dep, dep_idx:depIdx,
              hc_in:lastHc, hc_out:hcOut, hash});
    if (hcOut) lastHc = hcOut;
  }
  return out;
}`,
  cut(3983, 4015),  // berthBoundaries / legEnd
  cut(4017, 4293),  // generate
  cut(4448, 4464),  // dateBits / COL_SIDES / DAY_BREAKS
  cut(4466, 4535),  // layoutBook
  "function buildBook(layout, zipFn){\n" +
  '  return SHEETS_XLSX.writeWorkbook([{name: "Sheet1", layout: layout}], zipFn);\n' +
  "}\n" +
  "const previewHtml = SHEETS_XLSX.previewHtml;",
  cut(4596, 4635),  // buildReport
  cut(4637, 4814),  // reissue merge + run
  cut(4816, 4818),  // exports
  "})(typeof globalThis !== \"undefined\" ? globalThis : this);",
].join("\n");
mustInclude(engineJs, "function generate(diags, prof, stabling, warn)", "engine.js: generate");
mustInclude(engineJs, "function readCfb(bytes)", "engine.js: readCfb");
mustInclude(engineJs, "root.SheetsEngine", "engine.js: exports");
writeFileSync("src/engine.js", engineJs + "\n");

/* ---------------- genius.js ---------------- */
let geniusJs = [
  cut(2821, 2825),  // header comment
  "const GENIUS = (() => {\n" +
  "  const { CODE2NAME, GROUP_EXTRA, STABLE_CODES, NAME_CODE, FIX_CODE,\n" +
  "          MINOR_SPUR, PROFILES_G } = SHEETS_DATA;\n" +
  "  const END_MARKERS = SHEETS_DATA.END_MARKERS_GENIUS;\n" +
  "  const { DAY_ROLL, PM_BREAK, RUN_ROUND, runsOf } = SHEETS_RULEBOOK;\n" +
  "  // ---- pdf text extraction (machine reports; Flate streams) ----\n" +
  "  function inflate(u8) { return fflate.unzlibSync(u8); }",
  cut(2832, 2884),  // latin / pdfText
  cut(2885, 2887),  // HC / TM / mins
  "  const sortkey = t => (t % 1440) < DAY_ROLL ? (t % 1440) + 1440 : (t % 1440);",
  cut(2891, 2943),  // parseSummary / parseDetail
  "  // ---- locations ----",
  cut(2977, 2978),  // locName / berthInfo
  cut(2979, 2979),  // SE()
  "  // Sidings, depots and sheds only — see data.js STABLE_CODES.",
  cut(2989, 2991),  // isStabling
  cut(3000, 3027),  // viaResolver / destCode / bcode
  cut(3043, 3048),  // DAY_OF / DAY_NAME / dayKey
  "  // ---- the weekend engine's shapes, over Genius itineraries ----",
  `  function stopsOf(raw) {
    // collapse consecutive same-location rows; carry identities in and out
    const out = [];
    let lastHc = null;
    for (const [i, j1] of runsOf(raw, s => s.code, null)) {
      const grp = raw.slice(i, j1 + 1);
      let hcOut = null;
      for (let k = grp.length - 1; k >= 0; k--) if (grp[k].hc) { hcOut = grp[k].hc; break; }
      let arr = null;
      for (const x of grp) if (x.arr !== null) { arr = x.arr; break; }
      let dep = null;
      for (let k = grp.length - 1; k >= 0; k--) if (grp[k].dep !== null) { dep = grp[k].dep; break; }
      out.push({ code: grp[0].code, name: grp[0].name, arr, dep, hcIn: lastHc, hcOut });
      if (hcOut) lastHc = hcOut;
    }
    return out;
  }`,
  cut(3072, 3077).split("\n").map(l => "  " + l.replace(/^  /, "")).join("\n")
    .replace("  const MINOR_SPUR", "  // MINOR_SPUR lives in data.js"),
  cut(3079, 3112),  // BERTH_STAY / boundaries / legEnd / legRoute
  cut(3131, 3439),  // buildDate / fmtT / build / return
  "})();\n" +
  "if (typeof module !== \"undefined\" && module.exports) module.exports = GENIUS;\n" +
  "if (typeof globalThis !== \"undefined\") globalThis.GENIUS = GENIUS;",
].join("\n");
// The MINOR_SPUR literal must not survive in genius.js (it moved to data.js).
geniusJs = geniusJs.replace(/ *const MINOR_SPUR = new Set\(\[[^\]]*\]\);\n/, "");
mustInclude(geniusJs, "function buildDate(date, sumRows, details, prof, warn)", "genius.js: buildDate");
mustInclude(geniusJs, "fflate.unzlibSync", "genius.js: fflate inflate");
if (geniusJs.includes("pako")) throw new Error("genius.js: pako survived");
writeFileSync("src/genius.js", geniusJs + "\n");

console.log("extracted: src/vendor/fflate.js src/data.js src/core.js src/rulebook.js src/xlsx.js src/engine.js src/genius.js");
