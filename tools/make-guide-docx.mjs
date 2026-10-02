/* Builds "HOW TO USE.docx" — the same guide as HOW TO USE.md, laid out for
   printing and circulating.

   The only script here that needs a package: `npm i docx` first (the tool
   itself and its tests stay dependency-free). Then:

     node tools/make-guide-docx.mjs "HOW TO USE.docx"

   The words are HOW TO USE.md's - this script only lays them out (see
   fromMarkdown below), so edit the Markdown and rebuild. The Word file is
   generated, not edited by hand.

   To check the result, render it the way Word would:

     apt-get install -y --no-install-recommends libreoffice-writer \
       poppler-utils fonts-crosextra-carlito
     soffice --headless --convert-to pdf "HOW TO USE.docx"
     pdftoppm -jpeg -r 100 "HOW TO USE.pdf" page

   A bare libreoffice-core cannot open any document at all - it fails with
   "source file could not be loaded" even on a text file - so Writer has to
   be there. Carlito has Calibri's metrics, which is what the guide is set
   in, so the line breaks land where Word puts them. */
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
/* The tool's own zip, used to repack the result deterministically (below).
   It is a UMD bundle and this package is "type": "module", so requiring it
   by path hands it to the ESM loader and its module/exports branch is never
   taken. Run it as the CommonJS it is and take what it exports. */
const fflate = (() => {
  const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)),
                                "..", "src", "vendor", "fflate.js"), "utf8");
  const mod = { exports: {} };
  new Function("module", "exports", src)(mod, mod.exports);
  return mod.exports;
})();
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle,
  Table, TableRow, TableCell, WidthType, ShadingType, LevelFormat, Footer,
  PositionalTab, PositionalTabAlignment, PositionalTabLeader, PageNumber,
  LineRuleType,
} = require("docx");

/* Line spacing has to say AUTO: a bare w:line is taken as a fixed leading,
   which collides the lines of anything set larger than the body text. */
const LINE = { line: 276, lineRule: LineRuleType.AUTO };

/* ---- house palette, taken from the tool itself ---- */
const INK = "262E33", INK2 = "3C464D", CHALK = "79818A",
      SIGNAL = "0E7C42", AMBER = "8A5210", RULE = "C4C7BF",
      PAPER = "F5F4EF", SHEET_RULE = "8C8C8C";
const BODY = "Calibri", MONO = "Consolas", HEAD = "Segoe UI";

/* The document properties' date. Deliberately a constant and not "now" -
   see the Document below. Bump it only if it ever matters what it says. */
const BUILD_STAMP = new Date("2026-01-01T00:00:00Z");

const PAGE_W = 11906, MARGIN = 1418;          // A4, 2.5 cm margins
const W = PAGE_W - MARGIN * 2;                // usable width, DXA

/* ---- inline markup: **bold**, *italic*, `mono` ---- */
function runs(text, base = {}) {
  text = text.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");   // a link reads as its text
  const out = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let last = 0, m;
  const push = (t, extra) => {
    if (t) out.push(new TextRun({ text: t, font: BODY, size: 21, color: INK,
                                  ...base, ...extra }));
  };
  while ((m = re.exec(text)) !== null) {
    push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("**")) push(tok.slice(2, -2), { bold: true });
    else if (tok.startsWith("`"))
      out.push(new TextRun({ text: tok.slice(1, -1), font: MONO, size: 19,
                             color: INK, ...base }));
    else push(tok.slice(1, -1), { italics: true });
    last = m.index + tok.length;
  }
  push(text.slice(last));
  return out;
}

const p = (text, opts = {}) => new Paragraph({
  children: runs(text), spacing: { after: 140, ...LINE }, ...opts });

const h1 = text => new Paragraph({
  children: [new TextRun({ text, font: HEAD, size: 56, bold: true, color: INK })],
  spacing: { after: 60 },
});

const sub = text => new Paragraph({
  children: [new TextRun({ text, font: MONO, size: 20, color: CHALK,
                           characterSpacing: 30 })],
  spacing: { after: 300 },
});

const h2 = text => new Paragraph({
  heading: HeadingLevel.HEADING_1,
  keepNext: true,
  children: [new TextRun({ text, font: HEAD, size: 30, bold: true, color: INK })],
  spacing: { before: 420, after: 40 },
  border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: RULE, space: 6 } },
});

const h3 = text => new Paragraph({
  heading: HeadingLevel.HEADING_2,
  keepNext: true,
  children: [new TextRun({ text, font: MONO, size: 20, bold: true, color: INK2,
                           characterSpacing: 20 })],
  spacing: { before: 280, after: 90 },
});

let stepInstance = 0;
const steps = list => {
  const instance = stepInstance++;
  return list.map(t => new Paragraph({
    children: runs(t),
    numbering: { reference: "steps", level: 0, instance },
    spacing: { after: 110, ...LINE },
  }));
};

let bulletInstance = 0;
const bullets = list => {
  const instance = bulletInstance++;
  return list.map(t => new Paragraph({
    children: runs(t),
    numbering: { reference: "dots", level: 0, instance },
    spacing: { after: 110, ...LINE },
  }));
};

/* A callout: one shaded cell with a coloured left rule; the text is one
   paragraph or a list of them. */
function callout(title, text, colour = SIGNAL) {
  return new Table({
    columnWidths: [W],
    width: { size: W, type: WidthType.DXA },
    borders: {
      top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE },
      left: { style: BorderStyle.SINGLE, size: 18, color: colour },
      insideHorizontal: { style: BorderStyle.NONE },
      insideVertical: { style: BorderStyle.NONE },
    },
    rows: [new TableRow({ cantSplit: true, children: [new TableCell({
      width: { size: W, type: WidthType.DXA },
      shading: { type: ShadingType.CLEAR, fill: PAPER, color: "auto" },
      margins: { top: 140, bottom: 140, left: 200, right: 200 },
      children: [
        ...(title ? [new Paragraph({
          children: [new TextRun({ text: title.toUpperCase(), font: MONO,
                                   size: 17, bold: true, color: colour,
                                   characterSpacing: 24 })],
          spacing: { after: 70 },
        })] : []),
        ...[].concat(text).map((t, i, all) => new Paragraph({
          children: runs(t),
          spacing: { ...LINE, after: i < all.length - 1 ? 100 : 0 } })),
      ],
    })] })],
  });
}

/* A data table: first row is the head. `mono` lists the 0-based columns set
   in Consolas (codes, file names, times). */
function grid(widths, head, rows, mono = []) {
  const cell = (text, i, isHead) => new TableCell({
    width: { size: widths[i], type: WidthType.DXA },
    shading: isHead ? { type: ShadingType.CLEAR, fill: PAPER, color: "auto" }
                    : undefined,
    margins: { top: 90, bottom: 90, left: 120, right: 120 },
    children: [new Paragraph({
      children: isHead
        ? [new TextRun({ text: text.toUpperCase(), font: MONO, size: 16,
                         color: CHALK, characterSpacing: 24 })]
        : (mono.includes(i)
            ? [new TextRun({ text, font: MONO, size: 18, color: INK })]
            : runs(text)),
      spacing: { line: 264, lineRule: LineRuleType.AUTO },
    })],
  });
  return new Table({
    columnWidths: widths,
    width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    borders: {
      top: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: RULE },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: RULE },
      insideVertical: { style: BorderStyle.NONE },
    },
    rows: [
      new TableRow({ tableHeader: true,
        children: head.map((t, i) => cell(t, i, true)) }),
      ...rows.map(r => new TableRow({ children: r.map((t, i) => cell(t, i, false)) })),
    ],
  });
}

/* A facsimile of two ruled entries, as they appear in the workbook. */
function sheetSample() {
  const cols = [1700, 900, 800, 800, 800];
  const total = cols.reduce((a, b) => a + b, 0);
  const cell = (text, i, opts = {}) => new TableCell({
    width: { size: cols[i], type: WidthType.DXA },
    margins: { top: 50, bottom: 50, left: 110, right: 110 },
    children: [new Paragraph({
      alignment: opts.centre ? AlignmentType.CENTER : AlignmentType.LEFT,
      children: [new TextRun({ text, font: "Arial", size: 18, color: "000000",
                               bold: !!opts.bold })],
    })],
  });
  return new Table({
    columnWidths: cols,
    width: { size: total, type: WidthType.DXA },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: SHEET_RULE },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: SHEET_RULE },
      left: { style: BorderStyle.SINGLE, size: 4, color: SHEET_RULE },
      right: { style: BorderStyle.SINGLE, size: 4, color: SHEET_RULE },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: SHEET_RULE },
      insideVertical: { style: BorderStyle.SINGLE, size: 4, color: SHEET_RULE },
    },
    rows: [
      new TableRow({ children: [new TableCell({
        width: { size: total, type: WidthType.DXA },
        columnSpan: 5,
        margins: { top: 60, bottom: 60, left: 110, right: 110 },
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: "ASHFORD  ·  MON 03/08", font: "Arial",
                                   size: 18, bold: true, color: "000000" })],
        })],
      })] }),
      new TableRow({ children: ["06 45 CHX", "4 375", "117", "DFU", "SG"]
        .map((t, i) => cell(t, i)) }),
      new TableRow({ children: ["05+32 VIC", "4 375", "116", "GI", "GI"]
        .map((t, i) => cell(t, i)) }),
    ],
  });
}

const caption = text => new Paragraph({
  children: [new TextRun({ text, font: BODY, size: 19, italics: true,
                           color: CHALK })],
  spacing: { before: 100, after: 200 },
});

const gap = (after = 200) => new Paragraph({ text: "", spacing: { after } });

/* ------------------------------------------------------------------ */

/* ---- the guide itself: HOW TO USE.md, read and laid out ----
   The Word file used to be written out here by hand, beside the Markdown,
   and the two drifted - the printed copy went on describing a page with two
   tabs long after it had five. Now the Markdown is the one text and this
   only lays it out, so the two cannot disagree.

   What it reads is the Markdown the guide is written in, no more:
     # / ## / ###        title, numbered section, sub-heading
     paragraphs          wrapped lines, joined
     * item / - item     bullets, continuation lines indented
     1. item             numbered steps, continuation lines indented
     | a | b |           a table, first row the head
     > **Title** …       a callout box (amber after <!-- docx: amber -->)
     ---                 a rule - the section headings carry their own
     <!-- docx: sheet-sample -->   the facsimile of two ruled entries
   The Contents list is left out: a printed copy has page numbers, not
   links. */
const GUIDE = join(dirname(fileURLToPath(import.meta.url)), "..", "HOW TO USE.md");

/* A table's column widths, shared out by how much each column holds. A
   cell of code is set in Consolas and the heads in spaced capitals, both
   wider than the prose, so they count for more; a long prose column is
   capped, since it can wrap and a file name cannot. */
function widthsFor(rows) {
  const len = (t, head) => {
    const plain = t.replace(/\*\*|\*/g, "");
    const code = /^`[^`]*`$/.test(plain.trim());
    return plain.replace(/`/g, "").length * (head ? 1.6 : code ? 1.35 : 1);
  };
  const n = rows[0].length;
  const weight = [];
  for (let c = 0; c < n; c++) {
    const longest = Math.max(...rows.map((r, i) => len(r[c] || "", i === 0)));
    weight.push(Math.min(Math.max(longest, 9), 60));
  }
  const sum = weight.reduce((a, b) => a + b, 0);
  const out = weight.map(w => Math.round(W * w / sum));
  out[n - 1] += W - out.reduce((a, b) => a + b, 0);   // exactly the page
  return out;
}

function fromMarkdown(md) {
  const out = [];
  const lines = md.replace(/\r/g, "").split("\n");
  let section = 0, amber = false, para = [];
  const flush = () => { if (para.length) { out.push(p(para.join(" "))); para = []; } };
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i];
    let m;
    if (/^\s*$/.test(ln) || /^---\s*$/.test(ln)) { flush(); continue; }
    if ((m = /^<!--\s*docx:\s*([\w-]+)\s*-->/.exec(ln))) {
      flush();
      if (m[1] === "amber") amber = true;
      if (m[1] === "sheet-sample") {
        out.push(sheetSample(),
          caption("The 06:45 to Charing Cross: a four-car 375 on diagram 117, " +
                  "off to Dartford Up Sidings next and finishing the day at " +
                  "Slade Green."));
      }
      continue;
    }
    if ((m = /^# (.+)/.exec(ln))) {
      flush();
      out.push(h1(m[1]), sub("THE WEEK'S BOOKS, BUILT FROM THE PLANS"));
      continue;
    }
    if ((m = /^## (.+)/.exec(ln))) {
      flush();
      if (/^Contents$/i.test(m[1].trim())) {            // links, not for paper
        while (i + 1 < lines.length && !/^## /.test(lines[i + 1])) i++;
        continue;
      }
      out.push(h2(++section + ". " + m[1]));
      continue;
    }
    if ((m = /^### (.+)/.exec(ln))) { flush(); out.push(h3(m[1])); continue; }
    if (/^>/.test(ln)) {
      flush();
      const body = [];
      while (i < lines.length && /^>/.test(lines[i])) body.push(lines[i++].replace(/^> ?/, ""));
      i--;
      let title = "";
      const t = /^\*\*(.+)\*\*\s*$/.exec(body[0] || "");
      if (t) { title = t[1]; body.shift(); }
      const paras = body.join("\n").split(/\n\s*\n/)
        .map(x => x.replace(/\s*\n\s*/g, " ").trim()).filter(Boolean);
      out.push(callout(title, paras, amber ? AMBER : SIGNAL), gap(60));
      amber = false;
      continue;
    }
    if (/^\|/.test(ln)) {
      flush();
      const rows = [];
      while (i < lines.length && /^\|/.test(lines[i])) {
        const cells = lines[i++].trim().replace(/^\||\|$/g, "").split("|").map(c => c.trim());
        if (!cells.every(c => /^:?-+:?$/.test(c))) rows.push(cells);
      }
      i--;
      const head = rows.shift().map(h => h.replace(/\*\*/g, ""));
      out.push(grid(widthsFor([head, ...rows]), head, rows), gap(160));
      continue;
    }
    if ((m = /^(\*|-|\d+\.) (.*)/.exec(ln))) {
      flush();
      const numbered = /\d/.test(m[1]);
      const items = [m[2]];
      while (i + 1 < lines.length) {
        const nx = lines[i + 1];
        const more = numbered ? /^\d+\. (.*)/.exec(nx) : /^(?:\*|-) (.*)/.exec(nx);
        if (more) { items.push(more[1]); i++; }
        else if (/^\s{2,}\S/.test(nx)) { items[items.length - 1] += " " + nx.trim(); i++; }
        else break;
      }
      out.push(...(numbered ? steps(items) : bullets(items)));
      continue;
    }
    para.push(ln.trim());
  }
  flush();
  return out;
}

const children = fromMarkdown(readFileSync(GUIDE, "utf8"));

const doc = new Document({
  creator: "Sheets Generator",
  title: "How to use the Sheets Generator",
  description: "A plain-English guide to building the unit berthing books.",
  /* A fixed stamp, so the same words always produce the same file. Left to
     itself the library writes the moment of the build into docProps, and
     since the .docx is committed, every `node build.mjs` - anyone's, for any
     reason - left the repository dirty with a document whose only change was
     the time it was generated. */
  createdAt: BUILD_STAMP, modifiedAt: BUILD_STAMP,
  numbering: {
    config: [
      { reference: "steps", levels: [{
        level: 0, format: LevelFormat.DECIMAL, text: "%1.",
        alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 460, hanging: 340 } },
                 run: { font: MONO, size: 20, bold: true, color: SIGNAL } },
      }] },
      { reference: "dots", levels: [{
        level: 0, format: LevelFormat.BULLET, text: "•",
        alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 400, hanging: 260 } },
                 run: { color: SIGNAL } },
      }] },
    ],
  },
  styles: {
    default: {
      document: { run: { font: BODY, size: 21, color: INK },
                  paragraph: { spacing: { ...LINE } } },
    },
  },
  sections: [{
    properties: { page: { margin: { top: MARGIN, bottom: MARGIN,
                                    left: MARGIN, right: MARGIN } } },
    footers: { default: new Footer({ children: [new Paragraph({
      children: [
        new TextRun({ text: "Sheets Generator — how to use", font: MONO,
                      size: 16, color: CHALK }),
        new TextRun({ children: [
          new PositionalTab({ alignment: PositionalTabAlignment.RIGHT,
                              relativeTo: "margin",
                              leader: PositionalTabLeader.NONE }),
          PageNumber.CURRENT,
        ], font: MONO, size: 16, color: CHALK }),
      ],
      border: { top: { style: BorderStyle.SINGLE, size: 4, color: RULE, space: 8 } },
    })] }) },
    children,
  }],
});

/* ---- deterministic output ----
   The library stamps the moment of the build into docProps/core.xml and into
   every zip entry's date, so two builds of the identical guide produced two
   different files. The .docx is committed, so that left the repository dirty
   after any `node build.mjs` - the guide "changed" when nothing about it had.
   Repacking with one fixed date makes the file a function of its words
   alone: it only changes when the guide does. fflate is the copy the tool
   itself ships, so this costs no new dependency. */
function deterministic(buf) {
  const files = fflate.unzipSync(new Uint8Array(buf));
  const stamp = BUILD_STAMP.toISOString();
  const core = "docProps/core.xml";
  if (files[core]) {
    const xml = new TextDecoder().decode(files[core]).replace(
      /<dcterms:(created|modified)([^>]*)>[^<]*<\/dcterms:\1>/g,
      (_, tag, attrs) => "<dcterms:" + tag + attrs + ">" + stamp +
                         "</dcterms:" + tag + ">");
    files[core] = new TextEncoder().encode(xml);
  }
  // one mtime for every entry, in the order the library wrote them
  const opts = { level: 6, mtime: BUILD_STAMP };
  const stamped = {};
  for (const name of Object.keys(files)) stamped[name] = [files[name], opts];
  return Buffer.from(fflate.zipSync(stamped, opts));
}

const out = process.argv[2] || "HOW TO USE.docx";
const buf = deterministic(await Packer.toBuffer(doc));
writeFileSync(out, buf);
console.log("wrote " + out + " — " + Math.round(buf.length / 1024) + " KB");
