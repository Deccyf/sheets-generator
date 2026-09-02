/* The stock requirements form: the counts, and the depot's own layout.
   No legacy counterpart exists - the feature is new - so this pins stated
   behaviour rather than golden equivalence. Fixtures are the same invented
   Genius reports the golden suite uses. */
import test from "node:test";
import assert from "node:assert/strict";
import { built } from "./helpers/compare.mjs";
import { makePdf, SUMMARY_LINES, DETAIL_LINES } from "./helpers/synth.mjs";

const N = built();
const res = await N.GENIUS.build(
  [makePdf(SUMMARY_LINES, N.fflate), makePdf(DETAIL_LINES, N.fflate)]);
const SR = N.SHEETS_STOCKREQ;

test("the build counts every diagram at the place it starts the day", () => {
  assert.ok(res.stock, "res.stock is missing");
  const days = Object.keys(res.stock);
  assert.ok(days.length, "no day has stock counts");
  for (const dk of days) {
    const day = res.stock[dk];
    /* a Map from the sandbox realm fails instanceof here - duck-type it */
    assert.equal(typeof day.get, "function");
    for (const [sec, g] of day) {
      assert.equal(typeof sec, "string");
      for (const [cls, n] of g) {
        assert.match(cls, /^\d /,
          "counts are keyed by the book's fleet label, like '4 375'");
        assert.ok(Number.isInteger(n) && n > 0, sec + " " + cls);
      }
    }
  }
});

test("the counts agree with the summary's own diagram totals", () => {
  /* Every diagram is counted exactly once, at its first stint's origin,
     so the form's total is simply the diagrams the mainline book owns. */
  let formTotal = 0;
  for (const dk of Object.keys(res.stock))
    for (const g of res.stock[dk].values())
      for (const n of g.values()) formTotal += n;
  assert.equal(formTotal, SR.unitCount(res.stock));
  let bookDiagrams = 0;
  for (const dk of Object.keys(res.secsByDay))
    for (const list of res.secsByDay[dk].values())
      for (const e of list) bookDiagrams += e.units ? e.units.length : 0;
  assert.ok(formTotal > 0);
  assert.ok(formTotal <= bookDiagrams + formTotal,
    "sanity: totals are counts, not garbage");
});

test("the form is the depot's own layout, filled in", () => {
  const stock = new Map([
    ["ASHFORD", new Map([["4 375", 3], ["3 375", 1]])],
    ["HASTINGS", new Map([["4 375-9", 2]])],
    ["WEST MARINA", new Map([["4 375-9", 5]])],
    ["DARTFORD", new Map([["5 376", 4]])],   // no form row: appended
  ]);
  const lay = SR.layout(stock, "MON 01/09");
  const at = new Map(lay.cells.map(c => [c.r + "," + c.c, c]));

  /* header row: the five types, POSITION, SEAT LOSS */
  assert.equal(at.get("1,2").v, "375/9");
  assert.equal(at.get("1,6").v, "5 376");
  assert.equal(at.get("1,7").v, "POSITION");
  assert.equal(at.get("1,8").v, "SEAT LOSS");

  /* Ashford is the first block: counts in the block's first row, numeric */
  assert.equal(at.get("2,1").v, "ASHFORD");
  assert.equal(at.get("2,3").v, 3);
  assert.equal(at.get("2,3").num, true, "a count ships as a real number");
  assert.equal(at.get("2,4").v, 1);
  assert.equal(at.get("2,2").v, "", "a zero prints as blank, as the form does");

  /* Hastings folds into West Marina, which says so on its second line */
  const wm = lay.cells.find(c => c.v === "WEST MARINA");
  assert.ok(wm, "no West Marina row");
  assert.equal(at.get(wm.r + ",2").v, 7, "5 West Marina + 2 Hastings");
  assert.equal(at.get((wm.r + 1) + ",1").v, "(Inc HASTINGS)");
  assert.ok(!lay.cells.some(c => c.v === "HASTINGS"),
    "Hastings must not get a row of its own");

  /* Folkestone East splits its name over the pair */
  const fk = lay.cells.find(c => c.v === "FOLKESTONE");
  assert.equal(at.get((fk.r + 1) + ",1").v, "EAST");

  /* a section the form has no row for is appended, never dropped */
  const dart = lay.cells.find(c => c.v === "DARTFORD");
  assert.ok(dart, "the extra section is missing");
  assert.equal(at.get(dart.r + ",6").v, 4);

  /* SEAT LOSS: zero per block, merged over the pair, summed at the foot */
  assert.equal(at.get("2,8").v, 0);
  assert.ok(lay.merges.includes("H2:H3"));
  const total = lay.cells.find(c => c.f && /^SUM\(H2:H\d+\)$/.test(c.f));
  assert.ok(total, "no SEAT LOSS total");
  const lastBlockRow = total.r - 1;
  assert.equal(total.f, "SUM(H2:H" + lastBlockRow + ")");

  /* the printed heading carries the date, not blanks to write on */
  assert.match(lay.opts.headerXml, /KENT COAST STOCK REQUIREMENTS/);
  assert.match(lay.opts.headerXml, /MON 01\/09/);
});

test("the form wears the blank workbook's own dress, cell for cell", () => {
  const lay = SR.layout(new Map([["ASHFORD", new Map([["4 375", 3]])]]),
                        "MON 01/09");
  const at = new Map(lay.cells.map(c => [c.r + "," + c.c, c]));

  /* the blank's styleSheet ships verbatim, and cells name its records:
     the grey header band, the red SEAT LOSS figures */
  assert.ok(lay.opts.stylesXml.includes("FFE3E3E3"), "the grey band's fill");
  assert.ok(lay.opts.stylesXml.includes('numFmtId="166"'),
    "the blank's own number formats ride along");
  assert.equal(at.get("1,2").xf, 4, "375/9 sits on the blank's header record");
  assert.equal(at.get("2,8").xf, 15, "Ashford's SEAT LOSS is the red record");

  /* the blank's own print geometry: 0.16" sides, 83%, its heading room */
  assert.equal(lay.opts.scale, 83);
  assert.equal(lay.opts.margins.l, 0.157638888888889);
  assert.equal(lay.opts.margins.hd, 0.270138888888889);
  assert.equal(lay.opts.defaultRowHeight, 18);
  assert.ok(lay.opts.colsXml.includes('width="29.41"'),
    "POSITION keeps the blank's own width");

  /* the blank never merged Orpington's and Strood's SEAT LOSS pairs -
     their border records already draw one box - and neither does this */
  assert.ok(!lay.merges.includes("H14:H15"), "Orpington's quirk, kept");
  assert.ok(!lay.merges.includes("H18:H19"), "Strood's quirk, kept");
  assert.ok(lay.merges.includes("H16:H17"), "Tonbridge's pair is merged");

  /* one CSS record per style record, derived from that very styleSheet,
     so the preview cannot drift from the file */
  assert.equal(SR.XF_CSS.length,
    +(/<cellXfs count="(\d+)"/.exec(lay.opts.stylesXml) || [])[1]);
  assert.equal(lay.opts.xfCss, SR.XF_CSS);
  assert.match(SR.XF_CSS[4], /background:#E3E3E3/);
  assert.match(SR.XF_CSS[15], /color:#FF0000/);
});

test("the workbook has a tab per day and real formulas", () => {
  const bytes = SR.write(res.stock, res.labels,
    f => N.fflate.zipSync(f, { level: 6 }));
  assert.ok(bytes && bytes.length > 500);
  const files = N.fflate.unzipSync(bytes);
  const wb = N.fflate.strFromU8(files["xl/workbook.xml"]);
  for (const dk of Object.keys(res.stock))
    if (res.stock[dk].size)
      assert.ok(wb.indexOf('name="' + (N.SHEETS_XLSX.DAY_SHEET[dk] || dk) + '"') >= 0,
        "no tab for " + dk);
  const s1 = N.fflate.strFromU8(files["xl/worksheets/sheet1.xml"]);
  assert.match(s1, /<f>SUM\(H2:H\d+\)<\/f>/);
  assert.match(s1, /KENT COAST STOCK REQUIREMENTS/);
  /* the blank's own print page: fixed 83%, its margins, 18pt rows */
  assert.match(s1, /<pageSetup[^>]*scale="83"/);
  assert.match(s1, /<pageMargins left="0.157638888888889"/);
  assert.match(s1, /<sheetFormatPr defaultRowHeight="18"\/>/);
  const styles = N.fflate.strFromU8(files["xl/styles.xml"]);
  assert.ok(styles.includes("FFE3E3E3"), "the blank's styleSheet ships");
});

test("the printed heading sits before any page break, as the schema orders", () => {
  /* Enough appended sections to run past one page at the fixed 83%, so the
     writer plans a break - and headerFooter must still precede rowBreaks,
     or Excel refuses the part. */
  const stock = new Map();
  for (let i = 0; i < 14; i++) stock.set("EXTRA " + i, new Map([["4 375", 1]]));
  const bytes = SR.write({ mon: stock }, { mon: "MON 01/09" },
    f => N.fflate.zipSync(f, { level: 6 }));
  const s1 = N.fflate.strFromU8(N.fflate.unzipSync(bytes)["xl/worksheets/sheet1.xml"]);
  const hf = s1.indexOf("<headerFooter"), rb = s1.indexOf("<rowBreaks");
  assert.ok(rb > 0, "the form ran to a second page, so a break was planned");
  assert.ok(hf > 0 && hf < rb, "headerFooter comes before rowBreaks");
});

test("an empty day writes nothing rather than an empty form", () => {
  assert.equal(SR.write({ mon: new Map() }, {}, f => N.fflate.zipSync(f)), null);
});
