/* A very small .xlsx writer: plain grids, one tab per question.

   The berthing sheets have their own writer, and it is a large one because
   a berthing sheet is a designed page - column widths, merges, print
   scaling, comments. Nothing here needs any of that. These are tables to
   be sorted and filtered in Excel, so this writes exactly that and stays
   short enough to read in one sitting.                                    */
;(function(root){
"use strict";

function esc(s){
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    /* Control characters are not legal in XML at all and Excel refuses the
       whole file rather than the cell, so they go before they get in. */
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");
}
function colName(n){
  let s = "";
  while (n > 0){ const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = (n - r - 1) / 26; }
  return s;
}
const isNum = v => typeof v === "number" && isFinite(v);

/* rows: array of arrays. The first row is treated as the heading. */
function sheetXml(rows, widths){
  const cols = widths && widths.length
    ? "<cols>" + widths.map((w, i) =>
        `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("") + "</cols>"
    : "";
  const body = rows.map((r, ri) => {
    const cells = (r || []).map((v, ci) => {
      if (v === "" || v == null) return "";
      const ref = colName(ci + 1) + (ri + 1);
      const st = ri === 0 ? ' s="1"' : "";
      return isNum(v)
        ? `<c r="${ref}"${st}><v>${v}</v></c>`
        : `<c r="${ref}"${st} t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`;
    }).join("");
    return `<row r="${ri + 1}">${cells}</row>`;
  }).join("");
  const dim = rows.length
    ? `A1:${colName(Math.max(1, ...rows.map(r => (r || []).length)))}${rows.length}` : "A1";
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    `<dimension ref="${dim}"/>` +
    '<sheetViews><sheetView workbookViewId="0">' +
    '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>' +
    "</sheetView></sheetViews>" +
    '<sheetFormatPr defaultRowHeight="15"/>' + cols +
    `<sheetData>${body}</sheetData>` +
    (rows.length > 1 ? `<autoFilter ref="${dim}"/>` : "") +
    "</worksheet>";
}

/* Excel is unforgiving about tab names: 31 characters, and none of  \ / ? * [ ] */
function tabName(s, taken){
  let n = String(s || "Sheet").replace(/[\\\/\?\*\[\]:]/g, "-").slice(0, 31) || "Sheet";
  let i = 2;
  while (taken.has(n.toLowerCase())){
    const suf = " (" + i++ + ")";
    n = n.slice(0, 31 - suf.length) + suf;
  }
  taken.add(n.toLowerCase());
  return n;
}

/* sheets: [{name, rows, widths}] -> a zipped .xlsx as bytes */
function writeWorkbook(sheets, zipFn){
  const taken = new Set();
  const named = sheets.map(s => Object.assign({}, s, {name: tabName(s.name, taken)}));
  const files = {};
  files["[Content_Types].xml"] =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
    named.map((s, i) =>
      `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
    ).join("") + "</Types>";
  files["_rels/.rels"] =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
    "</Relationships>";
  files["xl/workbook.xml"] =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' +
    named.map((s, i) => `<sheet name="${esc(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("") +
    "</sheets></workbook>";
  files["xl/_rels/workbook.xml.rels"] =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    named.map((s, i) =>
      `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`
    ).join("") +
    `<Relationship Id="rId${named.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
    "</Relationships>";
  /* style 0 is the default, style 1 is the bold heading row */
  files["xl/styles.xml"] =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font>' +
    '<font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
    '<fills count="2"><fill><patternFill patternType="none"/></fill>' +
    '<fill><patternFill patternType="gray125"/></fill></fills>' +
    '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
    '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>' +
    "</styleSheet>";
  named.forEach((s, i) => {
    files[`xl/worksheets/sheet${i + 1}.xml`] = sheetXml(s.rows || [], s.widths);
  });
  const enc = new TextEncoder();
  const raw = {};
  for (const k of Object.keys(files)) raw[k] = enc.encode(files[k]);
  return zipFn(raw);
}

root.FLEET_XLSX = {writeWorkbook, sheetXml, colName};
})(typeof globalThis !== "undefined" ? globalThis : this);
