/* SHEETS_XLSX — the one xlsx writer and the one preview renderer, plus the
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
function esc(s){
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
                  .replace(/"/g,"&quot;");
}
function colName(n){         // 1 -> A
  let s = ""; while (n > 0){ const r = (n-1) % 26; s = String.fromCharCode(65+r) + s;
    n = (n - r - 1) / 26; }
  return s;
}
/* Looks: [fontId, horizontal alignment]. Fonts are indexed into FONTS below. */
const LOOKS = {1:[1,"center"], 2:[2,"right"], 3:[3,"center"],
               4:[4,"center"], 5:[4,"right"], 6:[5,"center"]};
const FONTS_XML =
'<font><sz val="11"/><color theme="1"/><name val="Calibri"/><family val="2"/></font>' +
'<font><b/><sz val="12"/><name val="Arial"/><family val="2"/></font>' +
'<font><sz val="14"/><name val="Arial"/><family val="2"/></font>' +
'<font><b/><sz val="11"/><name val="Arial"/><family val="2"/></font>' +
'<font><sz val="10"/><name val="Arial"/><family val="2"/></font>' +
'<font><b/><sz val="10"/><name val="Arial"/><family val="2"/></font>';

/* Styles are registered as they are needed, so any mix of look and border
   gets its own entry rather than being hard-coded up front. */
function StyleBook(){
  this.borders = [[null,null,null,null]];
  this.borderIdx = {",,,": 0};
  this.xfs = [{look:0, border:0}];
  this.xfIdx = {"0|0": 0};
}
StyleBook.prototype.border = function(sides){
  const key = sides.map(function(s){ return s || ""; }).join(",");
  if (this.borderIdx[key] === undefined){
    this.borderIdx[key] = this.borders.length;
    this.borders.push(sides);
  }
  return this.borderIdx[key];
};
StyleBook.prototype.style = function(look, borderId){
  const key = look + "|" + borderId;
  if (this.xfIdx[key] === undefined){
    this.xfIdx[key] = this.xfs.length;
    this.xfs.push({look:look, border:borderId});
  }
  return this.xfIdx[key];
};
StyleBook.prototype.xml = function(){
  const side = function(tag, s){
    return s ? "<" + tag + ' style="' + s + '"/>' : "<" + tag + "/>";
  };
  let b = '<borders count="' + this.borders.length + '">';
  for (const s of this.borders){
    b += "<border>" + side("left", s[0]) + side("right", s[1]) +
         side("top", s[2]) + side("bottom", s[3]) + "<diagonal/></border>";
  }
  b += "</borders>";
  let x = '<cellXfs count="' + this.xfs.length + '">';
  for (const f of this.xfs){
    const L = LOOKS[f.look];
    x += '<xf numFmtId="0" fontId="' + (L ? L[0] : 0) + '" fillId="0" borderId="' +
         f.border + '" xfId="0" applyFont="1" applyBorder="1"' +
         (L ? ' applyAlignment="1">' + '<alignment horizontal="' + L[1] +
              '" vertical="center"/></xf>' : "/>");
  }
  x += "</cellXfs>";
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
   '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
   '<fonts count="6">' + FONTS_XML + '</fonts>' +
   '<fills count="2"><fill><patternFill patternType="none"/></fill>' +
   '<fill><patternFill patternType="gray125"/></fill></fills>' + b +
   '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
   x + '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
   '</styleSheet>';
};

function buildSheetXml(cells, merges, rowHeights, maxRow){
  const widths = HOUSE_WIDTHS;
  let cols = '<cols>';
  widths.forEach(function(w, i){
    cols += '<col min="' + (i+1) + '" max="' + (i+1) +
            '" width="' + w + '" customWidth="1"/>';
  });
  cols += '</cols>';
  const byRow = new Map();
  for (const c of cells){
    if (!byRow.has(c.r)) byRow.set(c.r, []);
    byRow.get(c.r).push(c);
  }
  let sd = '<sheetData>';
  const rowNums = Array.from(new Set([...byRow.keys(), ...rowHeights.keys()]))
                       .sort(function(a,b){ return a-b; });
  for (const r of rowNums){
    const h = rowHeights.get(r);
    sd += '<row r="' + r + '"' + (h ? ' ht="' + h + '" customHeight="1"' : '') + '>';
    const rc = (byRow.get(r) || []).sort(function(a,b){ return a.c-b.c; });
    for (const c of rc){
      const ref = colName(c.c) + c.r;
      if (c.f) sd += '<c r="' + ref + '" s="' + c.s + '"><f>' + esc(c.f) + '</f></c>';
      else if (c.v === undefined || c.v === null || c.v === "")
        sd += '<c r="' + ref + '" s="' + c.s + '"/>';
      else sd += '<c r="' + ref + '" s="' + c.s + '" t="inlineStr"><is>' +
                 '<t xml:space="preserve">' + esc(c.v) + '</t></is></c>';
    }
    sd += '</row>';
  }
  sd += '</sheetData>';
  let mg = "";
  if (merges.length){
    mg = '<mergeCells count="' + merges.length + '">' +
         merges.map(function(m){ return '<mergeCell ref="' + m + '"/>'; }).join("") +
         '</mergeCells>';
  }
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
   '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
   '<dimension ref="A1:H' + Math.max(1, maxRow) + '"/>' +
   '<sheetViews><sheetView workbookViewId="0"/></sheetViews>' +
   '<sheetFormatPr defaultRowHeight="15"/>' + cols + sd + mg +
   '<pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/>' +
   '<pageSetup paperSize="9" orientation="portrait"/></worksheet>';
}
/* Multi-sheet workbook: shared styles, one worksheet part per sheet.
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
}

/* ==== unified preview (ex weekend engine) ==== */
/* ---- on-screen preview, rendered from that same layout ------------------ */
const PREVIEW_PX = [12.4, 9.1, 7.3, 4.7, 5.4, 12.9, 11.9, 27.6].map(function(w){
  return Math.round(w * 7 + 5);
});
const LOOK_SIZE = {1:"12pt", 2:"14pt", 3:"11pt", 4:"10pt", 5:"10pt", 6:"10pt"};
const LOOK_BOLD = {1:true, 3:true, 6:true};
function colNum(s){
  let n = 0;
  for (let i = 0; i < s.length; i++) n = n * 26 + (s.charCodeAt(i) - 64);
  return n;
}
function previewHtml(layout){
  const at = new Map();
  for (const c of layout.cells) at.set(c.r + "," + c.c, c);
  const spans = new Map(), covered = new Set();
  for (const m of layout.merges){
    const p = /^([A-Z]+)(\d+):([A-Z]+)(\d+)$/.exec(m);
    if (!p) continue;
    const c1 = colNum(p[1]), r1 = +p[2], c2 = colNum(p[3]), r2 = +p[4];
    spans.set(r1 + "," + c1, [c2 - c1 + 1, r2 - r1 + 1]);
    for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++)
      if (!(r === r1 && c === c1)) covered.add(r + "," + c);
  }
  // one declaration per side so a double rule draws as a double rule
  const SIDE_CSS = {medium: "2px solid #262E33", thin: "1px solid #262E33",
                    double: "3px double #262E33"};
  const edge = function(name, s){
    return "border-" + name + ":" + (SIDE_CSS[s] || "0") + ";";
  };
  let h = '<table class="sheet"><colgroup>';
  for (const px of PREVIEW_PX) h += '<col style="width:' + px + 'px">';
  h += "</colgroup><tbody>";
  for (let r = 1; r < layout.maxRow; r++){
    h += "<tr>";
    for (let c = 1; c <= 8; c++){
      if (covered.has(r + "," + c)) continue;
      const cell = at.get(r + "," + c);
      const sp = spans.get(r + "," + c);
      const look = cell ? cell.look : 0;
      const s = cell ? cell.sides : [null, null, null, null];
      let css = edge("top", s[2]) + edge("right", s[1]) +
                edge("bottom", s[3]) + edge("left", s[0]);
      if (look && LOOKS[look]){
        css += "text-align:" + LOOKS[look][1] + ";font-size:" + LOOK_SIZE[look] + ";";
        if (LOOK_BOLD[look]) css += "font-weight:700;";
      }
      h += "<td" + (sp ? ' colspan="' + sp[0] + '" rowspan="' + sp[1] + '"' : "") +
           ' style="' + css + '">' + esc(cell && cell.v ? cell.v : "") + "</td>";
    }
    h += "</tr>";
  }
  return h + "</tbody></table>";
}

/* ==== weekday layout (ex ExcelJS glue) ==== */
  function* entryRows(e, section, allHc) {
    const src = e.units.length ? e.units[0].src_sheet : null;
    const stn = norm(sheetStation(src || e.pub.sheet));
    let originNote = SIDING_NOTES[stn] || "";
    if (section === "ORPINGTON") originNote = "";
    let hc = "";
    if ((allHc || HEADCODE_SECTIONS.has(section)) && e.headcode) {
      hc = e.headcode;
      const road = GP_ROAD[stn] || "";
      if (section === "GROVE PARK" && road) hc = `${hc} ${road}`;
    }
    const ends = END_STYLE[section];
    const timeA = `${fmtTime(e.time, e.time_kind)} ${e.dest}`.trim();
    const n = e.units.length;
    for (let i = 0; i < n; i++) {
      const u = e.units[i];
      let a = i === 0 ? timeA : "";
      if (i === 1 && e.sub) a = " " + e.sub;
      if (section === "FOLKESTONE EAST" && i === 1 && e.pub.pl) {
        a = `Road ${e.pub.pl}`;
      }
      const notes = [];
      if (i === 0) {
        if (hc) notes.push(hc);
        if (originNote) notes.push(originNote);
        if (e.attachment) notes.push("ATTACHMENT");
        for (const x of e.extra_notes) notes.push(x);
      }
      if (u.end) notes.push(u.end);
      else if (ends) {
        const [firstEnd, lastEnd] = ends;
        if (i === 0 && firstEnd) notes.push(firstEnd);
        else if (i === n - 1 && n > 1 && lastEnd) notes.push(lastEnd);
      }
      yield { a, cls: u.cls.replace(/\//g, "-"), am: u.am || "", diag: u.diag || "",
              pm: u.pm || "", flag: i === 0 ? e.flag : "",
              note: notes.join(" ").trim(), last: i === n - 1 };
    }
  }

  const V_EDGES = { 1: ["medium", null], 2: ["thin", null], 3: ["thin", "medium"],
                    4: [null, null], 5: ["thin", "medium"], 6: [null, null],
                    7: [null, null], 8: [null, "medium"] };

  function orderEntries(entries) {
    return entries.slice().sort((a, b) => {
      const ka = (a.time % 1440) < 180 ? (a.time % 1440) + 1440 : a.time % 1440;
      const kb = (b.time % 1440) < 180 ? (b.time % 1440) + 1440 : b.time % 1440;
      return ka - kb;
    });
  }

  function sectionRows(rows, name, dateLbl, entries, allHc) {
    rows.push({ kind: "hdr", name, date: dateLbl, merge: true });
    const flat = [];
    const tkey = e => {
      const t = e.time % 1440;
      return t < 180 ? t + 1440 : t;
    };
    /* The double line rules off the morning: the hand books draw it under
       the last entry before the midday break, and nowhere else - Ashford
       after 08 28, Victoria after 07+14, Slade Green after 06+36 in the
       12/08 book. Not "the biggest gap": those two readings agreed on every
       section of 12/08 and came apart the day a late ECS row opened a
       bigger evening gap, which pulled the line down to it. A section
       worked steadily through midday (Gillingham, Faversham) draws no line,
       so the crossing only counts when the gap under it is berthing-length.
       Grove Park is never ruled - its two-table layout has no divide. */
    const NOON = 12 * 60;
    let gapI = null;
    if (name !== "GROVE PARK") {
      for (let i = 1; i < entries.length; i++) {
        const a = tkey(entries[i - 1]), b = tkey(entries[i]);
        if (a < NOON && b >= NOON) {
          if (b - a >= 120) gapI = i;
          break;
        }
      }
    }
    let divideAt = null;
    const flagSpans = [];
    entries.forEach((e, i) => {
      if (gapI !== null && i === gapI && flat.length) {
        divideAt = flat.length - 1;
      }
      if (e.flag && e.units.length > 1) {
        flagSpans.push([flat.length, e.units.length]);
      }
      for (const v of entryRows(e, name, allHc)) flat.push(v);
    });
    const spanStart = new Map(flagSpans);
    flat.forEach((v, idx) => {
      const first = idx === 0;
      const lastSec = idx === flat.length - 1;
      let bot = lastSec ? "medium" : (v.last ? "thin" : null);
      if (idx === divideAt && !lastSec) bot = "double";
      rows.push({ kind: "data",
        vals: { 1: v.a, 2: v.cls, 3: v.diag, 4: v.am, 5: v.pm, 7: v.flag, 8: v.note },
        top: first ? "medium" : null,
        bot,
        flag: !!v.flag,
        flagSpan: spanStart.has(idx) ? spanStart.get(idx) : 0 });
    });
    rows.push({ kind: "gap" });
    rows.push({ kind: "gap" });
  }

  function layoutSheet(secs, dateLbl, ram, fullOrder, allHc) {
    const rows = [];
    const order = ram ? ["RAMSGATE"] : (fullOrder || MAIN_ORDER);
    for (const name of order) {
      let entries = orderEntries(secs.get(name) || []);
      if (name !== "FOLKESTONE EAST") {
        const own = new Set([name.split(" ")[0].slice(0, 3).toUpperCase(),
                             name.slice(0, 3).toUpperCase()]);
        entries = entries.filter(e => !(e.dest &&
          own.has(e.dest.toUpperCase()) &&
          norm(sheetStation(e.pub.sheet)).startsWith(name.split(" ")[0])));
      }
      if (!entries.length) continue;
      // Grove Park gets two tables in the mainline book - the overnight block
      // first, then the rest. Only there: the 10/08 metro book this tool
      // produced came back with the second GROVE PARK header struck out and
      // its entry merged into the first.
      if (name === "GROVE PARK" &&
          fullOrder !== METRO_ORDER && fullOrder !== HS_ORDER) {
        const firstB = entries.filter(e => e.overnight);
        const second = entries.filter(e => !e.overnight);
        if (firstB.length) sectionRows(rows, name, dateLbl, firstB, allHc);
        if (second.length) sectionRows(rows, name, dateLbl, second, allHc);
      } else {
        sectionRows(rows, name, dateLbl, entries, allHc);
      }
    }
    return rows;
  }

  function mergeAlpha(base, extras) {
    const order = base.slice();
    for (const name of extras.slice().sort()) {
      let at = order.length;
      for (let i = 0; i < order.length; i++) {
        if (name < order[i]) { at = i; break; }
      }
      order.splice(at, 0, name);
    }
    return order;
  }

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
  const allHc = !!opts.allHeadcodes;
  const sheets = dayKeys.map(day => ({
    name: DAY_SHEET[day],
    layout: rowsToLayout(layoutSheet(secsByDay[day], dateLabels[day], ram, fullOrder, allHc)),
  }));
  return writeWorkbook(sheets, opts.zipFn || (f => fflate.zipSync(f, { level: 6 })));
}

function dayPreviewHtml(secs, label, ram, order, allHc) {
  return previewHtml(rowsToLayout(layoutSheet(secs, label, ram, order, allHc)));
}

return { writeBooks, bookOrder, layoutSheet, rowsToLayout, writeWorkbook,
         previewHtml, dayPreviewHtml, StyleBook, buildSheetXml, esc, colName,
         DAY_SHEET, MAIN_ORDER, METRO_ORDER, HS_ORDER };
})();
if (typeof module !== "undefined" && module.exports) module.exports = SHEETS_XLSX;
if (typeof globalThis !== "undefined") globalThis.SHEETS_XLSX = SHEETS_XLSX;
