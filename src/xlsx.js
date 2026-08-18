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
/* How long a break in a location's work has to be before a double line is
   ruled in it, and the hour after which a second one is drawn - see
   sectionRows for which breaks qualify. */
const BREAK_GAP = 180;
const PM_BREAK = SHEETS_RULEBOOK.PM_BREAK;

/* ==== generic writer (ex weekend engine) ==== */
function esc(s){
  /* A control character anywhere in a cell makes the WHOLE workbook
     unreadable, not just that cell, so they come out before anything else
     is escaped. Tab, newline and return are legal and are left alone. */
  /* U+FFFE and U+FFFF are excluded from XML's Char production just as the
     control characters are, and take the whole part down the same way. */
  return String(s).replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\ufffe\uffff]/g,"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
                  .replace(/"/g,"&quot;");
}
function colName(n){         // 1 -> A
  let s = ""; while (n > 0){ const r = (n-1) % 26; s = String.fromCharCode(65+r) + s;
    n = (n - r - 1) / 26; }
  return s;
}
/* Looks: [fontId, horizontal alignment, wrap?, fillId]. Fonts are indexed
   into FONTS below. Looks 7-9 are the allocation sheets' own dress - bold
   Calibri 9, the block titles in the operator's green, headers wrapped, and
   a white fill where their sheet fills a cell rather than leaving it clear. */
const LOOKS = {1:[1,"center"], 2:[2,"right"], 3:[3,"center"],
               4:[4,"center"], 5:[4,"right"], 6:[5,"center"],
               7:[6,"center",1], 8:[7,"center",1], 9:[6,"center",0,1]};
/* No theme colours here. These books ship no theme part, and Excel has no
   way to resolve a theme reference without one - that was the first cause of
   the dotted haze on the 395 sheet, where the skin was taught to resolve
   every one to rgb. Font 0 is what cellXfs 0 uses, which is what Excel paints
   every untouched cell of the grid with, so it is the last place to leave one. */
const FONTS_XML =
'<font><sz val="11"/><color rgb="FF000000"/><name val="Calibri"/><family val="2"/></font>' +
'<font><b/><sz val="12"/><name val="Arial"/><family val="2"/></font>' +
'<font><sz val="14"/><name val="Arial"/><family val="2"/></font>' +
'<font><b/><sz val="11"/><name val="Arial"/><family val="2"/></font>' +
'<font><sz val="10"/><name val="Arial"/><family val="2"/></font>' +
'<font><b/><sz val="10"/><name val="Arial"/><family val="2"/></font>' +
'<font><b/><sz val="9"/><color rgb="FF000000"/><name val="Calibri"/><family val="2"/></font>' +
'<font><b/><sz val="9"/><color rgb="FF00B050"/><name val="Calibri"/><family val="2"/></font>';
const FONT_COUNT = 8;
/* fill 0 none, 1 gray125 (Excel reserves both), 2 solid white */
const FILLS_XML =
'<fill><patternFill patternType="none"/></fill>' +
'<fill><patternFill patternType="gray125"/></fill>' +
'<fill><patternFill patternType="solid"><fgColor rgb="FFFFFFFF"/>' +
'<bgColor indexed="64"/></patternFill></fill>';
const FILL_COUNT = 3;

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
    const fill = (L && L[3]) ? 2 : 0;
    x += '<xf numFmtId="0" fontId="' + (L ? L[0] : 0) + '" fillId="' + fill +
         '" borderId="' + f.border + '" xfId="0" applyFont="1" applyBorder="1"' +
         (fill ? ' applyFill="1"' : "") +
         (L ? ' applyAlignment="1">' + '<alignment horizontal="' + L[1] +
              '" vertical="center"' + (L[2] ? ' wrapText="1"' : "") +
              '/></xf>' : "/>");
  }
  x += "</cellXfs>";
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
   '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
   '<fonts count="' + FONT_COUNT + '">' + FONTS_XML + '</fonts>' +
   '<fills count="' + FILL_COUNT + '">' + FILLS_XML + '</fills>' + b +
   '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
   x + '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
   '</styleSheet>';
};

/* ---- print setup ----
   The books are printed, not read on screen, and until now they came out of
   here with no scale and no page breaks: Excel put a page break down the
   middle of the eight columns, so every page printed twice with the notes
   column stranded on its own sheet, and cut sections in half wherever the
   paper ran out.

   The operator sets this by hand on the books they print - their TUE 18/08
   is A4 portrait at 88%, house margins, with six manual row breaks, every
   one of them immediately before a section header. So: A4 portrait, and a
   scale small enough that the columns fit the width AND the longest single
   section fits the height, then breaks packed so no section straddles a
   page. Their 88% and the 87% this arrives at for the same book are the
   same decision, made the same way. */
const PAPER = { w: 8.2677, h: 11.6929 };            // A4, paperSize 9
const MARGIN = { l: 0.7, r: 0.7, t: 0.75, b: 0.75 };
/* Never shrink past this. A section longer than a page at this scale is
   split by Excel as before - better than printing the whole book too small
   to read. 74% is the smallest scale seen on a real book. */
const MIN_SCALE = 74;
function printPlan(merges, rowHeights, maxRow, opts){
  opts = opts || {};
  /* A row merged clean across A..G is a section header - the weekday and
     weekend layouts both write one, and nothing else in either book is
     merged that way. */
  /* A layout that knows its own unbreakable blocks says so. The Metro sheet
     writes no A:G merge, so nothing was ever found here and it printed with
     NO breaks at all - a three-unit formation split across the fold, page
     two opening on position 3 with no headcode, time or destination beside
     it. Its blocks are its entries. */
  const heads = (opts.blockRows && opts.blockRows.length)
    ? opts.blockRows.slice().sort(function(a,b){ return a-b; })
    : [];
  if (!heads.length) {
    for (const m of merges){
      const mm = /^A(\d+):G\1$/.exec(m);
      if (mm) heads.push(+mm[1]);
    }
    heads.sort(function(a,b){ return a-b; });
  }
  const rowH = r => rowHeights.get(r) || 15;        // an untouched row is 15pt
  const secs = heads.map(function(h, i){
    // up to the row before the next header: the blank spacers ride with the
    // section they follow, because that is where they take up the paper
    const end = (i + 1 < heads.length ? heads[i + 1] - 1 : maxRow - 1);
    let pts = 0;
    for (let r = h; r <= end; r++) pts += rowH(r);
    return { start: h, pts };
  });
  // landscape turns the paper on its side, so the two swap over
  const land = !!opts.landscape;
  const pw = land ? PAPER.h : PAPER.w, ph = land ? PAPER.w : PAPER.h;
  const pageW = (pw - MARGIN.l - MARGIN.r) * 72;
  const pageH = (ph - MARGIN.t - MARGIN.b) * 72;
  // Excel's character width -> pixels, and pixels -> points at 96dpi
  const contentW = (opts.widths || HOUSE_WIDTHS).reduce(function(t, w){
    return t + Math.round(w * 7) + 5;
  }, 0) * 0.75;
  /* The width has to fit whatever the book is - a Ramsgate book is one
     section and needs no breaks, but its eight columns still have to land on
     one page across, which is the half of this that was going wrong. A sheet
     that runs down as many pages as it needs (fitToHeight 0, which is how
     the Metro sheets are set) is a width question only. */
  const tallest = opts.fitToHeight === 0
    ? 0 : secs.reduce(function(t, s){ return Math.max(t, s.pts); }, 0);
  const fit = tallest ? Math.min(pageW / contentW, pageH / tallest)
                      : pageW / contentW;
  const scale = Math.max(MIN_SCALE, Math.min(100, Math.floor(100 * fit)));
  const budget = pageH * 100 / scale;
  const breaks = [];
  /* The title and column headings above the first block take up paper too,
     so the first page starts with them already spent - without this the
     first page was budgeted as if it were empty. */
  let used = 0;
  if (heads.length) for (let r = 1; r < heads[0]; r++) used += rowH(r);
  for (const s of secs){
    if (used && used + s.pts > budget){ breaks.push(s.start - 1); used = 0; }
    used += s.pts;
  }
  return { scale, breaks };
}

function buildSheetXml(cells, merges, rowHeights, maxRow, opts){
  /* The Metro sheets are a different document - fourteen columns, landscape,
     and as many pages down as the day needs - so the widths and the page
     setup come from the layout where it has an opinion. */
  opts = opts || {};
  const widths = opts.widths || HOUSE_WIDTHS;
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
      /* A number written as inline text is invisible to cellIs rules - the
         allocation sheet's MG colours never fired on "143". A cell marked
         num ships as a real number, the way the operator's own K cells do. */
      else if (c.num) sd += '<c r="' + ref + '" s="' + c.s + '"><v>' +
                            esc(c.v) + '</v></c>';
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
  const plan = opts.noPageSetup ? { scale: 100, breaks: [] }
                                : printPlan(merges, rowHeights, maxRow, opts);
  // rowBreaks comes after pageSetup in the schema, and Excel rejects the
  // part outright if it does not
  const brk = plan.breaks.length
    ? '<rowBreaks count="' + plan.breaks.length + '" manualBreakCount="' +
      plan.breaks.length + '">' +
      plan.breaks.map(function(r){
        return '<brk id="' + r + '" max="16383" man="1"/>';
      }).join("") + '</rowBreaks>'
    : "";
  const lastCol = opts.lastCol || colName(widths.length);
  const cf = (opts.condFmt || []).join("");
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
   '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"' +
   ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
   /* fitToHeight only means anything when fitToPage is set - without it
      Excel goes by scale and the attribute is inert. tabColor comes first
      inside sheetPr; pageSetUpPr after it. */
   (opts.tabColor || opts.fitToHeight === 0
     ? '<sheetPr>' +
       (opts.tabColor ? '<tabColor rgb="' + opts.tabColor + '"/>' : '') +
       (opts.fitToHeight === 0 ? '<pageSetUpPr fitToPage="1"/>' : '') +
       '</sheetPr>'
     : '') +
   '<dimension ref="A1:' + lastCol + Math.max(1, maxRow) + '"/>' +
   '<sheetViews><sheetView workbookViewId="0"/></sheetViews>' +
   '<sheetFormatPr defaultRowHeight="15"/>' +
   (opts.colsXml || cols) + sd + mg + cf + (opts.dataValidations || "") +
   '<pageMargins left="' + MARGIN.l + '" right="' + MARGIN.r + '" top="' +
   MARGIN.t + '" bottom="' + MARGIN.b + '" header="0.3" footer="0.3"/>' +
   (opts.noPageSetup ? '' :
    '<pageSetup paperSize="9" scale="' + plan.scale + '"' +
    (opts.fitToHeight === 0 ? ' fitToHeight="0"' : '') +
    ' orientation="' + (opts.landscape ? "landscape" : "portrait") + '"/>') +
   brk + (opts.hasComments ? '<legacyDrawing r:id="rId1"/>' : '') +
   '</worksheet>';
}

/* ---- classic cell notes ----
   The 395 allocation sheet carries standing route knowledge as comments on
   its DIAGRAM cells. Classic notes (a comments part plus a VML drawing) are
   what every Excel shows on hover, and they need no persons part. */
function commentsXml(comments){
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<comments xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<authors><author>Sheets Generator</author></authors><commentList>' +
    comments.map(function(c){
      return '<comment ref="' + c.ref + '" authorId="0"><text><r>' +
        '<rPr><sz val="9"/><color indexed="81"/><rFont val="Tahoma"/>' +
        '<family val="2"/></rPr><t xml:space="preserve">' + esc(c.text) +
        '</t></r></text></comment>';
    }).join("") + '</commentList></comments>';
}
function vmlXml(comments){
  const shapes = comments.map(function(c, i){
    const m = /^([A-Z]+)(\d+)$/.exec(c.ref);
    let col = 0;
    for (const ch of m[1]) col = col * 26 + ch.charCodeAt(0) - 64;
    const r0 = +m[2] - 1, c0 = col - 1;
    return '<v:shape id="_x0000_s' + (1025 + i) + '" type="#_x0000_t202" ' +
      "style='position:absolute;margin-left:80pt;margin-top:2pt;width:160pt;" +
      "height:48pt;z-index:" + (i + 1) + ";visibility:hidden' fillcolor=\"#ffffe1\" " +
      'o:insetmode="auto"><v:fill color2="#ffffe1"/>' +
      '<v:shadow on="t" color="black" obscured="t"/>' +
      "<v:path o:connecttype=\"none\"/><v:textbox style='mso-direction-alt:auto'>" +
      '</v:textbox><x:ClientData ObjectType="Note"><x:MoveWithCells/>' +
      '<x:SizeWithCells/><x:Anchor>' + (c0 + 1) + ', 15, ' + Math.max(0, r0 - 1) +
      ', 10, ' + (c0 + 4) + ', 15, ' + (r0 + 3) + ', 4</x:Anchor>' +
      '<x:AutoFill>False</x:AutoFill><x:Row>' + r0 + '</x:Row><x:Column>' +
      c0 + '</x:Column></x:ClientData></v:shape>';
  }).join("");
  return '<xml xmlns:v="urn:schemas-microsoft-com:vml" ' +
    'xmlns:o="urn:schemas-microsoft-com:office:office" ' +
    'xmlns:x="urn:schemas-microsoft-com:office:excel">' +
    '<o:shapelayout v:ext="edit"><o:idmap v:ext="edit" data="1"/></o:shapelayout>' +
    '<v:shapetype id="_x0000_t202" coordsize="21600,21600" o:spt="202" ' +
    'path="m,l,21600r21600,l21600,xe"><v:stroke joinstyle="miter"/>' +
    '<v:path gradientshapeok="t" o:connecttype="rect"/></v:shapetype>' +
    shapes + '</xml>';
}
/* Multi-sheet workbook: shared styles, one worksheet part per sheet.
   sheets: [{name, layout:{cells, merges, rowHeights, maxRow}}]. Cells carry
   look + sides; the StyleBook indexes them across every sheet so the books
   stay small. */
function writeWorkbook(sheets, zipFn){
  /* Two dressings. The house books register styles as they need them, via
     the StyleBook. A book built to LOOK LIKE somebody else's document - the
     395 allocations sheet - instead carries that document's own styleSheet,
     lifted verbatim, and its cells name their exact style records (c.xf). */
  const raw = sheets.length && sheets[0].layout.opts &&
              sheets[0].layout.opts.stylesXml;
  const sb = raw ? null : new StyleBook();
  const parts = sheets.map(function(s){
    for (const c of s.layout.cells)
      c.s = raw ? (c.xf || 0) : sb.style(c.look, sb.border(c.sides));
    const o = s.layout.opts || {};
    if (s.layout.comments && s.layout.comments.length) o.hasComments = true;
    return buildSheetXml(s.layout.cells, s.layout.merges,
                         s.layout.rowHeights, s.layout.maxRow, o);
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
    const cm = sheets[i].layout.comments;
    if (cm && cm.length){
      files["xl/comments" + n + ".xml"] = enc.encode(commentsXml(cm));
      files["xl/drawings/vmlDrawing" + n + ".vml"] = enc.encode(vmlXml(cm));
      files["xl/worksheets/_rels/sheet" + n + ".xml.rels"] = enc.encode(
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/vmlDrawing" Target="../drawings/vmlDrawing' + n + '.vml"/>' +
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments" Target="../comments' + n + '.xml"/>' +
        '</Relationships>');
      types += '<Override PartName="/xl/comments' + n + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.comments+xml"/>';
      if (types.indexOf('Extension="vml"') < 0)
        types += '<Default Extension="vml" ContentType="application/vnd.openxmlformats-officedocument.vmlDrawing"/>';
    }
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
  files["xl/styles.xml"] = enc.encode(raw || sb.xml());
  return zipFn(files);
}

/* ==== unified preview (ex weekend engine) ==== */
/* ---- on-screen preview, rendered from that same layout ------------------ */
const PREVIEW_PX = [12.4, 9.1, 7.3, 4.7, 5.4, 12.9, 11.9, 27.6].map(function(w){
  return Math.round(w * 7 + 5);
});
/* Looks 7-9 are the allocation sheets' own dress and had no entry here, so
   the 395 preview emitted "font-size:undefined" and the browser dropped the
   declaration. Bold Calibri 9, as the workbook has them. */
const LOOK_SIZE = {1:"12pt", 2:"14pt", 3:"11pt", 4:"10pt", 5:"10pt", 6:"10pt",
                   7:"9pt", 8:"9pt", 9:"9pt"};
const LOOK_BOLD = {1:true, 3:true, 6:true, 7:true, 8:true, 9:true};
function colNum(s){
  let n = 0;
  for (let i = 0; i < s.length; i++) n = n * 26 + (s.charCodeAt(i) - 64);
  return n;
}
function previewHtml(layout){
  // as many columns as the layout has: eight on a berthing sheet, fourteen
  // on a Metro one
  const NCOL = ((layout.opts && layout.opts.widths) || PREVIEW_PX).length;
  const PX = (layout.opts && layout.opts.widths)
    ? layout.opts.widths.map(function(w){ return Math.round(w * 7) + 5; })
    : PREVIEW_PX;
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
  /* The preview is meant to be what gets saved, so the page breaks show on
     it too - otherwise the only way to see where the paper falls is to save
     the book and open Page Break Preview in Excel. */
  /* the layout's own opts, so a landscape fourteen-column sheet is measured
     as one - the preview was sizing every book against the portrait house
     widths, which undercuts "what you look at is what you get" */
  const plan = printPlan(layout.merges, layout.rowHeights, layout.maxRow,
                         layout.opts);
  const pageAt = new Map();
  plan.breaks.forEach(function(b, i){ pageAt.set(b + 1, i + 2); });
  /* table-layout:fixed only takes effect on a table with a definite width -
     without one the browser lays the table out automatically and one long
     cell stretches its whole column, which is what the Metro sheet's
     sign-off line was doing to TRAIN I.D. */
  const totalPx = PX.reduce(function(t, px){ return t + px; }, 0);
  const face = (layout.opts && layout.opts.previewFont) || "";
  let h = '<table class="sheet' + (face ? " " + face : "") +
          '" style="width:' + totalPx + 'px"><colgroup>';
  for (const px of PX) h += '<col style="width:' + px + 'px">';
  h += "</colgroup><tbody>";
  for (let r = 1; r < layout.maxRow; r++){
    if (pageAt.has(r))
      h += '<tr class="pbrk"><td colspan="' + NCOL + '">Page ' + pageAt.get(r) +
           '</td></tr>';
    h += "<tr>";
    for (let c = 1; c <= NCOL; c++){
      if (covered.has(r + "," + c)) continue;
      const cell = at.get(r + "," + c);
      const sp = spans.get(r + "," + c);
      const look = cell ? cell.look : 0;
      const s = cell ? cell.sides : [null, null, null, null];
      /* A book dressed in somebody else's style records draws itself with
         them here too. The 395 sheet names an exact xf per cell and the
         preview had only the coarse house look to go on, so what you checked
         on screen was bare text and what you saved was the operator's own
         ruled, filled, coloured sheet - the one thing this preview exists
         not to do. The skin carries one CSS declaration per record. */
      let css;
      const xfCss = layout.opts && layout.opts.xfCss;
      if (xfCss && cell && cell.xf !== undefined && xfCss[cell.xf]) {
        // …and anything the workbook's own conditional formatting paints
        // over it when Excel opens the file
        css = xfCss[cell.xf] + ";" + (cell.cfCss ? cell.cfCss + ";" : "");
      } else {
        css = edge("top", s[2]) + edge("right", s[1]) +
              edge("bottom", s[3]) + edge("left", s[0]);
        if (look && LOOKS[look]){
          css += "text-align:" + LOOKS[look][1] + ";font-size:" + LOOK_SIZE[look] + ";";
          if (LOOK_BOLD[look]) css += "font-weight:700;";
        }
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
        /* "Via AFK" - the route only appears where a destination is reached
           more than one way and the rule table says which this is. It goes
           in the notes rather than against the time: column A is
           "HH MM DDD" in every real book and never more (the longest value
           in any of them is nine characters), so putting it there widened
           the column for the whole page. */
        if (e.via) notes.push(`Via ${e.via}`);
        if (originNote) notes.push(originNote);
        if (e.attachment) notes.push("ATTACHMENT");
        for (const x of e.extra_notes) notes.push(x);
      }
      /* Where a section names BOTH ends - Dover Priory's FKE/CBE pair - the
         marker says which of the two leads, so it takes two units to mean
         anything and a lone unit gets none. Where a section names only one
         end - West Marina's HGS END - it says which way the unit leaves,
         which is as true of one unit as of three, and the hand book marks
         those singles (05+55 and 07+13 on 12/08). The rear marker already
         required a pair; the leading one did not. */
      if (u.end) notes.push(u.end);
      else if (ends && (n > 1 || !ends[1])) {
        const [firstEnd, lastEnd] = ends;
        if (i === 0 && firstEnd) notes.push(firstEnd);
        else if (i === n - 1 && lastEnd) notes.push(lastEnd);
      }
      yield { a, cls: u.cls.replace(/\//g, "-"), am: u.am || "", diag: u.diag || "",
              pm: u.pm || "", unit: u.unit || "", flag: i === 0 ? e.flag : "",
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
    /* A double line rules off a break in the day's work: the FIRST break of
       at least BREAK_GAP, and any later one whose work resumes after 20 00.
       So a location can carry two - the 12/08 book rules Slade Green under
       06+36 and again under 18+04, which no single-line rule can draw - but
       a mid-afternoon lull draws nothing.

       Every double line in the operator's own TUE 18/08 book is one or the
       other: Ashford under 08 28 and again under 16 00 (22+53 next), Dover
       under 07 45, Slade Green under 06+31, Tonbridge under 06 16, Victoria
       under 06 55 and again under 17 40 (23 40 next), West Marina under
       07+24 (23+07 next). The one break of 180 minutes or more they leave
       unruled is Tonbridge's 11+32 to 14+40 - neither the first of the day
       nor the way into the night - and ruling it was what put a line on that
       page that does not belong there.

       Earlier readings all tried to find THE one break - the biggest gap (a
       long evening lull outbids the real one, Ashford's 16 00 to 22+53), the
       gap containing midday (a section that works through the middle of the
       day breaks earlier), the biggest gap starting before midday (right six
       times out of seven, and structurally unable to draw Slade Green's
       second). All were measured against the real books' own border styles.

       Grove Park is never ruled: neither real book rules it, and the
       mainline book's two-table layout already does the job. */
    const gapAt = new Set();
    if (name !== "GROVE PARK") {
      let seen = false;
      for (let i = 1; i < entries.length; i++) {
        if (tkey(entries[i]) - tkey(entries[i - 1]) < BREAK_GAP) continue;
        if (!seen || tkey(entries[i]) >= PM_BREAK) gapAt.add(i);
        seen = true;
      }
    }
    const divideAt = new Set();
    const flagSpans = [];
    entries.forEach((e, i) => {
      if (gapAt.has(i) && flat.length) divideAt.add(flat.length - 1);
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
      if (divideAt.has(idx) && !lastSec) bot = "double";
      rows.push({ kind: "data",
        /* 6 is the unit column: the allocated unit where the export names
           it, and otherwise an empty ruled cell for the depot to write in. */
        vals: { 1: v.a, 2: v.cls, 3: v.diag, 4: v.am, 5: v.pm, 6: v.unit,
                7: v.flag, 8: v.note },
        top: first ? "medium" : null,
        bot,
        flag: !!v.flag,
        flagSpan: spanStart.has(idx) ? spanStart.get(idx) : 0 });
    });
    /* One blank row between sections, which is what the hand-built books
       use - the operator's TUE 18/08 runs Ashford to row 46, leaves 47
       blank and heads Dover Priory at 48. Two of them cost a row a section
       on paper and put the tool's sheet 15 rows longer than the same day's
       real book. */
    rows.push({ kind: "gap" });
  }

  function layoutSheet(secs, dateLbl, ram, fullOrder, allHc, gpSplit) {
    /* Only the mainline books split Grove Park, and the caller says so.
       Testing the order array by identity never worked: bookOrder returns a
       fresh array every call, so the guard was always true. */
    if (gpSplit === undefined) gpSplit = true;
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
      if (name === "GROVE PARK" && gpSplit) {
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
  const gpSplit = opts.gpSplit !== undefined ? !!opts.gpSplit : base === MAIN_ORDER;
  const dayKeys = ["M", "T", "W", "TH", "F"].filter(d => d in dateLabels);
  const allHc = !!opts.allHeadcodes;
  const sheets = dayKeys.map(day => ({
    name: DAY_SHEET[day],
    layout: rowsToLayout(layoutSheet(secsByDay[day], dateLabels[day], ram, fullOrder, allHc, gpSplit)),
  }));
  return writeWorkbook(sheets, opts.zipFn || (f => fflate.zipSync(f, { level: 6 })));
}

function dayPreviewHtml(secs, label, ram, order, allHc, gpSplit) {
  return previewHtml(rowsToLayout(layoutSheet(secs, label, ram, order, allHc, gpSplit)));
}

return { writeBooks, bookOrder, layoutSheet, rowsToLayout, writeWorkbook,
         previewHtml, dayPreviewHtml, StyleBook, buildSheetXml, esc, colName,
         DAY_SHEET, MAIN_ORDER, METRO_ORDER, HS_ORDER, BREAK_GAP, printPlan };
})();
if (typeof module !== "undefined" && module.exports) module.exports = SHEETS_XLSX;
if (typeof globalThis !== "undefined") globalThis.SHEETS_XLSX = SHEETS_XLSX;
