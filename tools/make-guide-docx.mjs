/* Builds "HOW TO USE.docx" — the same guide as HOW TO USE.md, laid out for
   printing and circulating.

   The only script here that needs a package: `npm i docx` first (the tool
   itself and its tests stay dependency-free). Then:

     node tools/make-guide-docx.mjs "HOW TO USE.docx"

   Edit HOW TO USE.md and this script together — the Word file is generated,
   not edited by hand.

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
  children: [new TextRun({ text, font: HEAD, size: 30, bold: true, color: INK })],
  spacing: { before: 420, after: 40 },
  border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: RULE, space: 6 } },
});

const h3 = text => new Paragraph({
  heading: HeadingLevel.HEADING_2,
  children: [new TextRun({ text, font: MONO, size: 20, bold: true, color: INK2,
                           characterSpacing: 20 })],
  spacing: { before: 280, after: 90 },
});

const lead = text => new Paragraph({
  children: [new TextRun({ text: text.toUpperCase(), font: MONO, size: 17,
                           color: CHALK, characterSpacing: 24 })],
  spacing: { before: 100, after: 180 },
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

/* A callout: one shaded cell with a coloured left rule. */
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
    rows: [new TableRow({ children: [new TableCell({
      width: { size: W, type: WidthType.DXA },
      shading: { type: ShadingType.CLEAR, fill: PAPER, color: "auto" },
      margins: { top: 140, bottom: 140, left: 200, right: 200 },
      children: [
        new Paragraph({
          children: [new TextRun({ text: title.toUpperCase(), font: MONO,
                                   size: 17, bold: true, color: colour,
                                   characterSpacing: 24 })],
          spacing: { after: 70 },
        }),
        new Paragraph({ children: runs(text), spacing: { ...LINE } }),
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

const children = [
  h1("How to use the Sheets Generator"),
  sub("THE WEEK'S BOOKS, BUILT FROM THE PLANS"),
  p("One file turns the planning paperwork into the unit berthing books — every " +
    "diagram number, AM and PM column, flag and note filled in the way the " +
    "hand-built books do them. This is the whole job, start to finish. No " +
    "training needed: if you can find the reports, the page does the rest."),
  gap(120),
  callout("Nothing is uploaded",
    "All the work happens in the browser on your own machine. No internet " +
    "connection, no login, nothing installed. It works on a train with no signal."),
  gap(60),

  h2("1. What this is"),
  lead("One file · no install · nothing leaves the machine"),
  p("`Sheets Generator.html` builds the unit berthing books — the SHEETS — from " +
    "the paperwork you already produce."),
  ...bullets([
    "**Monday to Friday** — the *Diagram Summary* and *Diagram Detail* reports " +
      "for the date: from Genius as PDFs or CSVs, or from Integrale as its " +
      "two CSVs.",
    "**Saturday and Sunday** — the weekend *diagram prints* Word document, plus " +
      "any reissues.",
  ]),
  p("Out come finished Excel workbooks, ready to check and send."),

  h2("2. The two-minute version"),
  ...steps([
    "Double-click **Sheets Generator.html**.",
    "Drop the **two weekday reports** on the top panel — or the **weekend " +
      "prints** on the bottom one.",
    "The books appear straight away. Click **Look at it** on each and read the " +
      "**Review** tab.",
    "Click **Save book** on each, or **Save all books (.zip)** for the lot.",
  ]),
  p("That's the whole job. The rest of this guide is detail for when you want it."),

  h2("3. Opening the page"),
  p("Double-click the file. It opens in your browser like any web page."),
  ...bullets([
    "Use **Edge, Chrome or Firefox**. If it opens in something older and says " +
      "so, right-click the file, choose **Open with**, and pick Edge.",
    "Keep it wherever suits — desktop, network drive, memory stick. It behaves " +
      "the same from any of them.",
    "There is nothing to install and no update to run. Sent a newer copy? Just " +
      "use that one instead.",
  ]),
  p("The page has two panels, one above the other:"),
  grid([1400, 3200, W - 4600],
    ["Panel", "Sign at the top", "What it takes"],
    [["Top", "Weekdays · Mon – Fri", "The two Diagram reports — PDFs or CSVs"],
     ["Bottom", "Weekend · Sat & Sun", "The weekend diagram prints — .docx or .doc"]],
    [0, 1]),
  gap(160),
  p("Drop your files on the matching one. Put weekend prints on the weekday " +
    "panel by mistake and it will say so, and point you downstairs."),

  h2("4. Getting the paperwork"),
  h3("From Genius — two reports, PDF or CSV"),
  /* The one warning in this guide that cannot be recovered from, and the
     printed copy did not carry it at all - not the phrase, not the setting,
     nothing. It is in the Markdown guide, the README and the page itself. */
  callout("Check this one setting first",
    "**File → Session Settings** → make sure **“Show diagram sections on the " +
    "diagram summary report”** is **ticked**. Without it you only get the AM " +
    "unit positions; it needs to be ticked to get the PM ones as well. The " +
    "books still build, but every formation that comes together later in the " +
    "day prints in its morning order — Grove Park in the afternoon worst of " +
    "all. **It cannot be put right afterwards**: the Detail report carries no " +
    "Position column, so once the Summary has been exported without it the " +
    "order is simply gone. The review list will tell you it happened; it " +
    "cannot tell you the right answer.", AMBER),
  gap(60),
  ...steps([
    "Make sure a **Control Cycle** exists for the date. For the Metro and High " +
      "Speed books, Control Cycles must exist for those fleets too — this is " +
      "the usual reason a book comes up empty.",
    "Run **Diagrams → Summary Report…** and save it as a **PDF** or a **CSV**.",
    "Run **Diagrams → Detail Report…** and save that the same way.",
  ]),
  p("Either format is read, and you can mix them — a PDF summary with a CSV " +
    "detail builds fine. Save both from Genius itself; a scan or a photo of a " +
    "printout cannot be read."),

  h3("From Integrale — two CSVs"),
  p("**The Diagram Summary file**"),
  ...steps([
    "Open the **Stock Diagrams** list and click **[GO→]** without selecting a filter.",
    "Click **[Export To Excel]**.",
    "Save it in a sensible folder under a sensible name, with **File Type** set " +
      "to **.csv**, then **[Save]**.",
  ]),
  p("**The Diagram Detail file**"),
  ...steps([
    "Open the **Stock Diagrams** list and click **[GO→]** again, still without " +
      "a filter.",
    "Click **Stock Diagram Detail Report** on the toolbar.",
    "The dialog opens at the bottom of the screen — click **[…]** under " +
      "**Output Path**.",
    "Pick the same folder as the Summary, give it a sensible name, **File Type " +
      ".csv** again, then **[Save]**.",
    "Click **[OK]** — you may have to scroll down to see it. It takes a minute " +
      "or so, then tells you it is done.",
  ]),
  p("The same steps *with screenshots* are inside the page itself: look for " +
    "**Getting the two CSVs out of Integrale** in the quick start at the top."),
  gap(60),
  /* "both give the same books" was not true, and it steered people towards
     the weaker source. Integrale carries one Position per DIAGRAM, so
     afternoon formations come out in their morning order: 13 of 13 right
     from Genius against the real 12/08 book, 0 of 13 from Integrale. */
  callout("If you have the choice, use Genius",
    "Both build, but they are not equal. Integrale gives one position per " +
    "**diagram**, so any formation that comes together later in the day is " +
    "printed in its morning order — against the real 12/08 book that is 13 " +
    "formations right out of 13 from Genius, and 0 out of 13 from Integrale. " +
    "Integrale's advantage is that it names the allocated units, which Genius " +
    "often does not. So: **Genius for the order, Integrale for the unit " +
    "numbers**. What you cannot do is pair them up — a Genius Summary with an " +
    "Integrale Detail will not build, and the page will tell you which is " +
    "which.", AMBER),
  gap(60),
  h3("The weekend prints"),
  p("Get the weekend **diagram prints** Word document — .docx, or an older " +
    ".doc. If **reissued** prints have come out, get those too. Any file with " +
    "*reissue* or *re-issue* in its name is treated as one."),

  h2("5. Building the weekday books"),
  lead("Monday to Friday"),
  ...steps([
    "**Drop both reports** on the top panel — together, or one and then the " +
      "other. You can also click the panel to browse for them.",
    "It works out which report is which by reading it, so the order doesn't " +
      "matter. Drop one and it tells you what it is still waiting for: " +
      "*“Genius Summary loaded ✓ — now drop the Diagram Detail report.”*",
    "As soon as it has the pair the books are built: *“Books built — look " +
      "them over below, then save.”*",
    "**Look them over.** **Look at it** shows the finished sheet on screen, day " +
      "by day, exactly as it will print. The tabs are the days — MON, TUE… — " +
      "plus **Review**.",
    "**Save.** **Save book** on each one, or **Save all books (.zip)** at the " +
      "bottom for the lot.",
  ]),
  gap(60),
  callout("A whole week at once",
    "If the reports cover several dates you get one tab per date inside each " +
    "workbook, MON to FRI. Dates that land on a weekend are skipped, with a " +
    "note pointing you at the weekend panel."),
  gap(60),
  p("A book with nothing in it says so — *“No Metro diagrams in these " +
    "reports — nothing to sheet”* — rather than handing you an empty " +
    "workbook; the berthing books say *“nothing to berth”*. For Metro and " +
    "High Speed it also reminds you to check the Control Cycle."),
  gap(60),
  /* The route for locked-down machines. It was in the Markdown guide and on
     the page, and missing from the printed one - which is the copy handed to
     the person most likely to be sat at such a machine. */
  h3("If you can't get the files onto the machine"),
  p("Some machines will not let the reports be saved anywhere the browser can " +
    "reach. Both panels take the paperwork **pasted in** instead."),
  ...steps([
    "Click **paste them instead** under the drop zone.",
    "Open the CSV, select all (**Ctrl+A**), copy (**Ctrl+C**), and paste into " +
      "the box (**Ctrl+V**). One box for the Summary, one for the Detail.",
    "Click **Build from what I have pasted**.",
  ]),
  p("It reads what you paste the same way it reads a dropped file, so a pasted " +
    "pair and a dropped pair cannot build differently. Put them in the wrong " +
    "boxes and it builds anyway and says so; paste only one and it builds " +
    "against whichever report is already loaded. **PDFs cannot be pasted** — " +
    "there is no text in one to copy — so on a machine like that, export the " +
    "CSVs."),

  h2("6. Building the weekend sheets"),
  lead("Saturday and Sunday"),
  ...steps([
    "**Drop the prints** on the bottom panel.",
    "**Drop the reissues too**, if there are any — with the prints, or in a " +
      "later drop once you have already built. Reissued diagrams replace their " +
      "originals, new ones are added, and everything is rebuilt. The status " +
      "line says how many were replaced.",
    "**Look each sheet over** and save it, the same as the weekday books.",
    "If a reissue was merged and the prints were a .docx, you also get **Save " +
      "updated prints (.docx)** — the original document with the reissued " +
      "diagrams spliced in, so there is one clean copy to circulate.",
    "**Start over** clears everything and lets you begin again.",
  ]),
  p("A reissue dropped on its own won't build — the full prints need to come " +
    "with it, or first. A reissue for a different date is refused too."),

  h2("7. What you get"),
  h3("Weekdays — four roads"),
  grid([2100, 3000, W - 5100],
    ["Road", "File", "What's in it"],
    [["SHEETS", "SHEETS_MON-03-08.xlsx",
      "The mainline book — 375s, 376s, 377s — every section from Ashford to " +
      "West Marina, with Ramsgate cut out"],
     ["RAM SHEETS", "RAM_SHEETS_….xlsx",
      "Ramsgate's own book, cut from the same day's work"],
     ["METRO SHEETS", "METRO_SHEETS_….xlsx",
      "The metro book — 465s, 466s, 707s. Not a berthing sheet — see below"],
     ["HIGH SPEED ALLOCATION SHEETS", "HS_SHEETS_….xlsx",
      "The High Speed book — 395s. Not a berthing sheet — see below"]],
    [0, 1]),
  gap(160),
  h3("Two of them are not berthing sheets"),
  p("The **Metro** and **High Speed** books are your own documents rather " +
    "than berthing sheets, and the tool builds them that way. The Metro book " +
    "is a tab per location, landscape, fourteen columns, read by **Position** " +
    "— lowest first, straight down each formation — with the timing point, " +
    "the road, comments, S, R/T and L/S ruled and left for you to write in."),
  p("The High Speed book is the **Class 395 Allocations Sheet**: a tab per " +
    "day named the way yours are, a block for each depot down it (Ashford, " +
    "Faversham, Margate, Ramsgate), last night's arrivals on the left and " +
    "today's allocations on the right. It uses your berth codes — `ASH`, " +
    "`RAM`, `FAV` — and your drop-downs are on the cells that had them."),
  ...bullets([
    "`MG` is the miles **that working** runs, not the diagram's total for " +
    "the day, so a diagram that comes out twice has a figure for each time. " +
    "It is a number, so your colouring works on it: **green under 500 " +
    "miles, red at 500 and over**.",
    "The **DIAGRAM cells carry the route notes** as comments, same as " +
    "yours. *Not over high level* is worked out from the diagram itself — a " +
    "working that runs **between Ebbsfleet and Gravesend**, either way " +
    "round, goes over the high level, and one that does not gets the note. " +
    "It is per working, so a diagram can position out over the high level " +
    "first thing and still be marked on its later workings.",
    "*Avoids North Kent* is not something the reports can show, so it comes " +
    "from a standing list of the workings that carry it.",
  ]),
  p("Neither has a **Unit order** tab — there is no formation order on them " +
    "to turn round — and each one's **Rules** tab describes that sheet " +
    "rather than a berthing one."),
  gap(160),
  h3("Weekends — three books"),
  p("One workbook per fleet for the day — **Mainline**, **Metro**, **High " +
    "Speed** — plus the updated prints document when a reissue has been merged."),
  p("File names carry the date, so `SHEETS_MON-03-08.xlsx` and " +
    "`SHEETS_SAT_02_AUG.xlsx` never get muddled in a folder."),

  h2("8. Reading a sheet"),
  p("Each section — ASHFORD, GILLINGHAM, SLADE GREEN and so on — is a ruled box " +
    "with the section name and the date at the top. Inside it, one **entry** " +
    "per departure and one row per unit."),
  p("Which unit comes first is taken from the diagram's **Position** in the " +
    "Summary. Broadly the mainline book lists the lowest Position first and the " +
    "metro and High Speed books the highest — but that is not a rule without " +
    "exceptions. A few sections and some individual sidings run the other way, " +
    "and known formations can be pinned outright; all of it is written down in " +
    "the tables rather than worked out on the fly, so it does not drift. Where " +
    "two units share a Position — they started the day in different formations " +
    "— the reports genuinely cannot say which way round they go, and the entry " +
    "is named on the review list for you to check."),
  p("**If an order comes out wrong, say so.** A formation can be pinned for one " +
    "departure, for a whole section, or wherever it appears in the week, so the " +
    "same correction only has to be made once. Report the section, the time and " +
    "the diagram numbers."),
  sheetSample(),
  caption("The 06:45 to Charing Cross: a four-car 375 on diagram 117, off to " +
    "Dartford Up Sidings next and finishing the day at Slade Green."),
  grid([900, W - 3200, 2300],
    ["Col", "What it says", "Example"],
    [["A", "Time and where it's going", "06 45 CHX"],
     ["B", "What the unit is — cars and class", "4 375"],
     ["C", "The three-digit diagram number", "117"],
     ["D", "**AM** — the unit's next berth during the day", "DFU"],
     ["E", "**PM** — where it finishes the day", "SG"],
     ["F", "Unit number, where the report names one — otherwise ruled and " +
      "empty for you to write in", "465012"],
     ["G", "Flag", "SPLITS"],
     ["H", "Notes — sidings, attachments, end markers, headcodes", "EAST SIDINGS"]],
    [0, 2]),
  gap(200),
  p("**Times.** A plain space is a passenger working — `06 45`. A **+** means " +
    "empty stock — `05+32`. The usual house convention."),
  p("**SPLITS** means the units on this departure part company during the day. " +
    "**SPLITS PM** means they only part in the evening — the AM and PM columns " +
    "tell you who ends up where."),
  p("**Notes** carry the house annotations: which siding a unit comes off " +
    "(`EAST SIDINGS`, `UP SIDINGS`, `JUB`…), `ATTACHMENT` when another unit " +
    "joins the departure, the end markers where the two ends of a train are " +
    "named for the way out (`FKE END` / `CBE END` at Dover Priory, and so on), " +
    "and the headcode in the sections that quote it."),
  gap(60),
  callout("Left off on purpose",
    "Empty moves into a berth with no passenger work afterwards aren't listed — " +
    "the same as the hand-built sheets. So is a unit that stands somewhere for " +
    "the last time in the day and then runs empty to a depot without ever " +
    "being shunted where it stood: that is a wait on the way home, and the " +
    "line belongs to the depot it is going to. Every one of them is named on " +
    "the review list, so nothing disappears quietly."),
  gap(60),
  h3("The Metro and High Speed timings"),
  p("Both are timed off the **first time the unit moves**, because both of " +
    "those sheets are written that way. A unit that runs empty out of the " +
    "sidings at `05+52` to form the 06 00 off the platform is listed at " +
    "**05+52**, with the empty move's headcode, still showing where the " +
    "service it forms is going. A train that starts in the platform keeps " +
    "its platform time, because that *is* its first move. Mainline is timed " +
    "off the booked departure — except at **Grove Park** and **Slade Green**, " +
    "where it too is the moment the unit first moves off the berth. The " +
    "**weekend** High Speed book keeps the platform time; that one is a " +
    "berthing sheet, not the allocations sheet."),
  h3("The double lines"),
  p("Double lines rule off the breaks in the day's work: the **first** break " +
    "of **three hours or more**, and any later one where the work picks up " +
    "**after 20:00**. So a page can carry two — Slade Green is ruled under " +
    "its 06+36 and again under its 18+04 — but a lull in the middle of the " +
    "afternoon draws nothing: Tonbridge stands from 11+32 to 14+40 and is " +
    "left unruled. A page that is busy right through gets none, and Grove " +
    "Park is never ruled. The weekend sheets follow the same rule."),

  h2("9. The review list — always read it"),
  p("Every build produces one: everything the rules had to decide for " +
    "themselves, named openly rather than quietly guessed at. It is the " +
    "**Review** tab on each book, and each book shows only its own fleet's items."),
  p("The line above the buttons on each road says either *“Nothing flagged " +
    "for review”* or *“3 review items — read before the sheets go " +
    "out”*."),
  h3("What turns up there"),
  ...bullets([
    "**A location the section list doesn't know.** It gets its own heading in " +
      "alphabetical order and a note. Check it is in the right place — and say " +
      "if it ought to live under an existing section, so the tables can be " +
      "corrected.",
    "**Empty moves left off**, each with its diagram number, so you can confirm " +
      "it should be off. Only moves that stay inside the section are dropped — " +
      "an empty run that takes a unit to another depot for the night is " +
      "printed, because the section it leaves has to show it going.",
    "**A unit order pinned somewhere but not here.** Where a formation's order " +
      "has been written down for one departure and this one is not covered, it " +
      "says so and tells you where the order *is* recorded. Usually it means " +
      "either this one needs pinning too, or the working has moved and the " +
      "existing pin no longer reaches it.",
    "**A diagram whose page didn't read cleanly**, or a date with no matching " +
      "detail report.",
    "**An end marker with no rule to fit.** Rather than guess which end leads, " +
      "it says so and leaves it to you.",
    "**The Folkestone East Train Roads arrivals**, worked out " +
      "last-in-first-out from tonight's arrivals — always worth checking " +
      "against the ACWN.",
  ]),
  p("A clean list is normal on a straightforward day. A long one isn't a fault " +
    "— it is the tool showing its working."),
  gap(60),
  h2("10. The headcode switches"),
  p("Once a panel has built something, a box marked **HEADCODES** appears " +
    "with it. It only shows up alongside books, because ticking one " +
    "rebuilds them."),
  ...bullets([
    "On the **weekday** panel there is one tick-box, **Mainline**, which " +
      "covers the mainline and Ramsgate books. Metro and High Speed are not " +
      "on it: every line of both carries its headcode already, so a tick-box " +
      "for either would change nothing.",
    "On the **weekend** panel there are three — **Mainline**, **Metro** and " +
      "**High Speed** — because all three of those are berthing sheets.",
    "**Left off** — how they start — each book follows the house rules, and " +
      "headcodes appear only in the sections that have always quoted them: " +
      "Gillingham, Victoria and Grove Park.",
    "**Ticked**, that book puts *every* headcode in the notes column — empty " +
      "moves and platform starters alike.",
  ]),
  p("On the weekend panel they work per book, so you can have all the " +
    "headcodes on the Metro sheets and the usual rules on the Mainline."),
  gap(60),
  callout("Change your mind any time",
    "Tick or untick after a build and the books are rebuilt on the spot — no " +
    "need to drop the files again. Just save them again afterwards; it reminds you."),
  gap(60),
  /* The second box on the weekday panel. It has its own tests and its own
     tick box, and the printed guide never mentioned it. */
  h3("Long platform stands"),
  p("Under the HEADCODES box, on the **weekday** panel, there is a second box: " +
    "**Platform stands**."),
  p("A unit that sits in a platform for an hour or more has arguably berthed " +
    "there. The tool handles it three ways:"),
  ...bullets([
    "If the report **shunts the unit on the spot** while it stands, that is the " +
      "report saying it was put away — it gets a line on the sheet either way.",
    "Without a shunt it is left off, and **named on the review list** with the " +
      "location and the time, so you can decide.",
    "Tick **Count long platform stands as berthings** and every one of them " +
      "goes on the sheets too. The books rebuild as you tick.",
  ]),
  p("Left unticked — how it starts — the sheets match the hand-built books, " +
    "which do not carry them."),

  h2("11. If something looks wrong"),
  grid([4200, W - 4200],
    ["What you see", "What it means"],
    [["“No Diagram Summary rows found” / “No Detail itineraries found”",
      "One of the two reports is missing or is the wrong kind. Both are needed, " +
      "for the same date."],
     ["“The Summary is from Genius but the Detail is from Integrale”",
      "The pair have to come from the same system. Two PDFs, or two CSVs."],
     ["“…doesn't look like a Genius report”",
      "The PDF's text couldn't be read. Make sure it was saved from Genius, not " +
      "scanned or photographed."],
     ["“…doesn't look like an Integrale export”",
      "Check you exported the Stock Diagrams list and the Stock Diagram Detail " +
      "Report, both as .csv."],
     ["A road says “nothing to berth” or “nothing to sheet”",
      "No diagrams for that fleet are in the paperwork. Nothing wrong — but in " +
      "Genius, check a Control Cycle exists for that fleet."],
     ["A location has its own heading",
      "A unit berthed somewhere the section list has never heard of. It is on " +
      "the review list; check where it should live."],
     ["A train seems to be missing",
      "Read the review list first — empty moves into a berth are left off " +
      "deliberately and each one is named. If it isn't there, note the diagram " +
      "number and report it."],
     ["“That file is damaged or isn't a Word document”",
      "Open the prints in Word, re-save as .docx, drop the new file."],
     ["“That looks like a reissue on its own”",
      "Drop the full weekly prints with it, or first."],
     ["“…belongs to a different day”",
      "The reissue's date doesn't match the prints it came with."],
     ["The page says the browser is too old",
      "Right-click the file, choose **Open with**, and pick Edge, Chrome or Firefox."],
     ["Two units are the wrong way round",
      "If the review list flagged the entry, the reports couldn't settle it. If " +
      "it didn't, the order came from the tables and is wrong there — report " +
      "the section, time and diagram numbers and it can be pinned."],
     ["Nothing happens when you drop a file",
      "Click the panel and browse for it instead — some setups block drag-and-drop."]]),
  gap(240),

  h2("12. Before the books go out"),
  ...bullets([
    "**Read the review list.** Every time. It exists to be read.",
    "**Check the sheets against the ACWNs** — especially the Folkestone East " +
      "Train Roads notes, which are worked out from last night's arrivals and " +
      "flagged for exactly that reason.",
    "**Check the date on the tab** is the day you meant to build.",
    "Remember it is a **drafting tool**. It applies the house rules faithfully " +
      "and tells you where it had to make a call — but the books are yours, and " +
      "a human signs them off.",
  ]),
  gap(240),

  h2("13. The diagram analyser — a separate tool"),
  lead("A second page, opened the same way as this one. It reads the SAME " +
    "diagram print books, but instead of building berthing sheets it answers " +
    "the questions maintenance planning keeps asking."),
  p("Drop **all** the print books on it at once — FSX, FO, SO and Sun " +
    "together. Each fleet gets a tab across the top, and for whichever fleet " +
    "you have picked you get:"),
  grid([4600, W - 4600],
    ["Section", "What it tells you"],
    [["Arrivals into <depot>",
      "How many diagrams bring a unit home, split morning, afternoon and " +
      "after midnight — and how many stands are nowhere near a depot that " +
      "can repair the fleet."],
     ["Home before 20:00",
      "Which diagrams are back early enough to be worked on the same " +
      "evening, and where each one started that morning."],
     ["Diagrams a restricted unit can work",
      "The diagrams that stay coupled all day — the only ones you can put " +
      "an MO unit on — and whether that work carries over to the next day."],
     ["Does the week close on itself?",
      "Whether the plan runs itself or units have to be moved at the end of " +
      "a day. One line per join, Monday through Sunday."],
     ["Mileage per unit",
      "What one UNIT covers a day, a week and a year — split by sub-fleet, " +
      "because a 375/6 works harder than a 375/3. Also the units the plan " +
      "needs, and the whole-fleet annual total."],
     ["Where a unit stands long enough to be attended",
      "Every place a unit sits still for two hours or more during the day — " +
      "where MSE or MIST can actually get to it."],
     ["Where a restricted unit cannot be contained",
      "The places where every diagram leaves a unit on its own at some " +
      "point, so a restricted unit standing there has nothing it can work."]]),
  gap(160),
  p("**Save this fleet as a spreadsheet** puts the lot into Excel, one tab " +
    "per section with the filters already on. **Save every fleet** does all " +
    "of them in one workbook."),
  callout("MO means two different things",
    "On the print, MO is a DAY CODE — Mondays Only. The tool always writes " +
    "day codes out in full (Mon only, Mon–Thu) so this can never be misread. " +
    "In the depot, an MO unit is a RESTRICTED unit that cannot run on its " +
    "own. Everywhere the analyser says \u201crestricted unit\u201d, that is " +
    "what it means."),
  h3("Set your depots first"),
  p("The prints do not say which depot owns a fleet, so the **Depots** panel " +
    "near the top lets you set it: a home depot, plus everywhere else the " +
    "fleet can be repaired. Tick Ramsgate and Slade Green for the 376s, for " +
    "instance, and both count as somewhere a 376 can be worked on. Your " +
    "choices are remembered on that computer, and everything below redraws " +
    "as soon as you change one."),
  p("The 377 setting is a **guess made from the prints** rather than " +
    "something the tool was told, and the card says so — check it."),
  p("As with the sheets, nothing leaves the computer."),

  gap(80),
  p("*A rule that doesn't match how your patch does it? Say so — the rules live " +
    "in one place and can be corrected.*"),
];

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
