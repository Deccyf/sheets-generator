/* The Kent Coast stock requirements form, filled from the day's plan.

   The depot keeps this as a blank spreadsheet - thirteen locations down
   the side, the five mainline unit types across the top, POSITION and
   SEAT LOSS beside them - and fills it in by hand on a Sunday night or
   before a bank holiday: how many of each type must be standing at each
   place when the next morning opens.

   The plan already knows that number: it is the diagrams starting the
   day out of each location, counted per section by fleet type (see the
   stock collector in genius.js) - the same figure a person gets running a
   finger down a section's morning departures in the book, which is the
   check the depot makes. So this writes the depot's own form, cell for
   cell - same
   columns, same two-row blocks, same SEAT LOSS total, same printed
   header - with the counts filled in and POSITION and SEAT LOSS left for
   the planner, whose judgement they are.

   The layout is lifted from the depot's own BLANK_STOCK_REQUIREMENTS
   workbook: two rows per location, Folkestone East and West Marina
   carrying their second words on the second row, Hastings folded into
   West Marina as the form itself says, and H2:H27 summed at the foot. */
const SHEETS_STOCKREQ = (() => {
const X = SHEETS_XLSX;

/* The form's columns, left to right, by the book's own fleet label. */
const TYPES = [["4 375-9", "375/9"], ["4 375", "375"], ["3 375", "375/3"],
               ["4 377", "377"], ["5 376", "5 376"]];
/* The form's rows, top to bottom. Second array entry is the second line
   of a split name. HASTINGS has no row: the form folds it into West
   Marina - "(Inc HASTINGS)" is printed on the form itself. */
const ROWS = [
  { sec: "ASHFORD",         name: ["ASHFORD"] },
  { sec: "DOVER PRIORY",    name: ["DOVER PRIORY"] },
  { sec: "FAVERSHAM",       name: ["FAVERSHAM"] },
  { sec: "FOLKESTONE EAST", name: ["FOLKESTONE", "EAST"] },
  { sec: "GILLINGHAM",      name: ["GILLINGHAM"] },
  { sec: "GROVE PARK",      name: ["GROVE PARK"] },
  { sec: "ORPINGTON",       name: ["ORPINGTON"] },
  { sec: "TONBRIDGE",       name: ["TONBRIDGE"] },
  { sec: "STROOD",          name: ["STROOD"] },
  { sec: "VICTORIA",        name: ["VICTORIA"] },
  { sec: "WEST MARINA",     name: ["WEST MARINA", "(Inc HASTINGS)"],
    also: ["HASTINGS"] },
  { sec: "RAMSGATE",        name: ["RAMSGATE"] },
  { sec: "SLADE GREEN",     name: ["SLADE GREEN"] },
];
/* The blank form is 21/10.7x5/29.4/18.7, but it prints with 0.16" side
   margins and the house books print with 0.7" - on the house page the
   eighth column fell one percent over the fold and SEAT LOSS printed on a
   page of its own. POSITION and SEAT LOSS give up the difference. */
const WIDTHS = [21.13, 10.71, 10.71, 10.71, 10.71, 10.71, 26, 17];
const T = "thin";

/* One day's form. stock: Map(section -> Map(fleet label -> count)). */
function layout(stock, dateLabel) {
  const cells = [], merges = [], rowHeights = new Map();
  const put = (r, c, v, look, sides, num) =>
    cells.push({ r, c, v, look, sides, num: !!num });

  /* header row: the five types, POSITION, SEAT LOSS */
  put(1, 1, "", 4, [T, T, T, T]);
  TYPES.forEach(([, head], i) => put(1, 2 + i, head, 3, [T, T, T, T]));
  put(1, 7, "POSITION", 3, [T, T, T, T]);
  put(1, 8, "SEAT LOSS", 3, [T, T, T, T]);
  rowHeights.set(1, 19);

  /* Sections the plan opened stock at that the form has no row for are
     appended as extra blocks rather than dropped: a unit standing at
     Dartford is still a unit somebody has to know about. */
  const named = new Set();
  for (const row of ROWS) { named.add(row.sec); (row.also || []).forEach(s => named.add(s)); }
  const extras = [...stock.keys()].filter(s => !named.has(s)).sort()
    .map(sec => ({ sec, name: [sec] }));

  let r = 2;
  for (const row of ROWS.concat(extras)) {
    const counts = new Map(stock.get(row.sec) || []);
    for (const other of row.also || [])
      for (const [cls, n] of stock.get(other) || [])
        counts.set(cls, (counts.get(cls) || 0) + n);
    put(r, 1, row.name[0], 3, [T, T, T, null]);
    put(r + 1, 1, row.name[1] || "", row.name[1] ? 4 : 3, [T, T, null, T]);
    TYPES.forEach(([cls], i) => {
      const n = counts.get(cls) || 0;
      put(r, 2 + i, n || "", 4, [T, T, T, null], n > 0);
      put(r + 1, 2 + i, "", 4, [T, T, null, T]);
    });
    put(r, 7, "", 4, [T, T, T, null]);          // POSITION: the planner's
    put(r + 1, 7, "", 4, [T, T, null, T]);
    put(r, 8, 0, 4, [T, T, T, null], true);      // SEAT LOSS: theirs too
    put(r + 1, 8, "", 4, [T, T, null, T]);
    merges.push("H" + r + ":H" + (r + 1));
    rowHeights.set(r, 18);
    rowHeights.set(r + 1, 19);
    r += 2;
  }

  /* the foot: SEAT LOSS totalled, exactly as the blank form does it */
  put(r, 1, "", 4, [null, null, T, null]);
  for (let c = 2; c <= 6; c++) put(r, c, "", 4, [null, null, T, null]);
  put(r, 7, "Total", 3, [T, T, T, null]);
  put(r + 1, 7, "", 3, [T, T, null, T]);
  cells.push({ r, c: 8, f: "SUM(H2:H" + (r - 1) + ")",
               look: 3, sides: [T, T, T, null] });
  put(r + 1, 8, "", 3, [T, T, null, T]);
  merges.push("G" + r + ":G" + (r + 1));
  merges.push("H" + r + ":H" + (r + 1));
  rowHeights.set(r, 18);
  rowHeights.set(r + 1, 19);

  return { cells, merges, rowHeights, maxRow: r + 1, opts: {
    widths: WIDTHS,
    /* the blank form's own print setting: fit the width, run down as far
       as needed - which for 29 rows is one page. A computed scale left
       SEAT LOSS two points over the fold on some renderers. */
    fitToHeight: 0,
    /* each two-row block holds together on the page */
    blockRows: ROWS.concat(extras).map((_, i) => 2 + i * 2),
    /* the blank form's own printed heading, with the date filled in
       rather than left as blanks to write on */
    headerXml: '<headerFooter differentFirst="false" differentOddEven="false">' +
      '<oddHeader>&amp;C&amp;"Arial,Bold Italic"&amp;14&amp;U' +
      'KENT COAST STOCK REQUIREMENTS &#10;FOR  ' + X.esc(dateLabel || "") +
      '</oddHeader><oddFooter>&amp;C&amp;D</oddFooter></headerFooter>',
  } };
}

/* The workbook: a tab per day that has any stock, named like the books'. */
function write(stockByDay, labels, zipFn) {
  const sheets = [];
  for (const dk of Object.keys(stockByDay)) {
    const stock = stockByDay[dk];
    if (!stock || !stock.size) continue;
    sheets.push({ name: X.DAY_SHEET[dk] || dk,
                  layout: layout(stock, labels[dk] || "") });
  }
  if (!sheets.length) return null;
  return X.writeWorkbook(sheets, zipFn);
}

/* How many units the form asks for in all - the card's one-line summary. */
function unitCount(stockByDay) {
  let n = 0;
  for (const dk of Object.keys(stockByDay))
    for (const g of (stockByDay[dk] || new Map()).values())
      for (const c of g.values()) n += c;
  return n;
}

return { layout, write, unitCount, TYPES, ROWS };
})();
if (typeof module !== "undefined" && module.exports) module.exports = SHEETS_STOCKREQ;
if (typeof globalThis !== "undefined") globalThis.SHEETS_STOCKREQ = SHEETS_STOCKREQ;
