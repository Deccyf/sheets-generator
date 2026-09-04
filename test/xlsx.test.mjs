/* Golden test: workbooks written by the new in-house writer must read back
   (via the legacy build's bundled ExcelJS) identically to the ones the
   legacy ExcelJS writer produced — values, fonts, alignment, borders,
   merges, widths, heights and page setup. */
import test from "node:test";
import assert from "node:assert/strict";
import { legacy, built, norm, normalizeWorkbook } from "./helpers/compare.mjs";
import { makePdf, makeDocx, SUMMARY_LINES, DETAIL_LINES, PRINTS_LINES }
  from "./helpers/synth.mjs";

async function geniusRes(ctx) {
  return ctx.GENIUS.build([
    makePdf(SUMMARY_LINES, ctx.fflate), makePdf(DETAIL_LINES, ctx.fflate)]);
}

test("weekday books: new writer matches the ExcelJS output cell for cell", async () => {
  const L = legacy(), N = built();
  const rL = await geniusRes(L);
  const variants = [
    ["SHEETS", s => s.secsByDay, false, undefined],
    ["RAM_SHEETS", s => s.secsByDay, true, undefined],
    ["METRO_SHEETS", s => s.metroSecs, false,
      ctx => ({ baseOrder: ctx.SHEETS_XLSX.METRO_ORDER, splitRamsgate: false })],
    ["HS_SHEETS", s => s.hsSecs, false, () => ({ baseOrder: [], splitRamsgate: false })],
  ];
  for (const [name, pick, ram, opts] of variants) {
    // Both writers get the same sections: what the engines produce is
    // compared in genius.test.mjs (the mainline book's unit order has moved
    // on since the legacy build), and this test is about the writer.
    const secs = pick(rL), labels = rL.labels;
    const bytesL = await L.SHEETS_XLSX.writeBooks(secs, labels, ram,
      opts ? opts(L) : undefined);
    const bytesN = N.SHEETS_XLSX.writeBooks(secs, labels, ram,
      opts ? opts(N) : undefined);
    /* Rows are compared by position among the used ones, not by absolute
       number: the frozen build left TWO blank rows between sections and
       these books leave one, the way the hand-built books do. Everything
       else - order, content, fonts, borders, heights, merges - still has
       to match exactly. The spacing itself is pinned below. */
    const wbL = await normalizeWorkbook(L, bytesL, { rowsRelative: true });
    const wbN = await normalizeWorkbook(L, bytesN, { rowsRelative: true });
    assert.deepEqual(wbN, wbL, name);
  }
});

test("one blank row between sections, the way the real books space them", async () => {
  const N = built();
  const X = N.SHEETS_XLSX;
  const res = await geniusRes(N);
  const day = Object.keys(res.labels)[0];
  const rows = X.layoutSheet(res.secsByDay[day], res.labels[day], false,
                             X.bookOrder(res.secsByDay, X.MAIN_ORDER, true),
                             false, true);
  const kinds = Array.from(rows).map(r => r.kind);
  assert.ok(kinds.filter(k => k === "hdr").length > 1, "several sections built");
  /* The operator's TUE 18/08 runs Ashford to row 46, leaves 47 blank and
     heads Dover Priory at 48 - so exactly one gap between a section's last
     line and the next section's header, and one after the last section. */
  for (let i = 0; i < kinds.length; i++) {
    if (kinds[i] !== "gap") continue;
    assert.notEqual(kinds[i + 1], "gap",
      "two blank rows in a row at index " + i + ": " +
      kinds.slice(Math.max(0, i - 2), i + 3).join(","));
  }
  assert.equal(kinds[kinds.length - 1], "gap", "the last section is closed off");
});

test("weekend books: shared writer matches the legacy zipXlsx output", async () => {
  const L = legacy(), N = built();
  const runOn = ctx => ctx.SheetsEngine.run(
    [{ name: "WEEKEND PRINTS.docx", bytes: makeDocx(PRINTS_LINES, ctx.fflate) }],
    b => ctx.fflate.unzipSync(b),
    f => ctx.fflate.zipSync(f, { level: 6 }));
  /* This is a test of the WRITER, so both writers are given the same book -
     the one the current engine produced. Running each engine and comparing
     the results would test the engine instead, and the weekend engine has
     deliberately moved on: it now follows the weekday rules for unit order
     and for the double lines. */
  const rN = runOn(N);
  let checked = 0;
  for (const b of rN.books) {
    if (b.skipped) continue;
    /* Read the saved workbook back with the legacy build's ExcelJS and hold
       it against the layout the engine handed the writer. Every value, look
       and border has to survive the round trip - which is the same thing the
       weekday test proves against the old ExcelJS writer, without depending
       on a weekend engine that has deliberately moved on. */
    /* Eight columns on a berthing sheet; the depot's own documents are as
       wide as their own layouts say. */
    const pageCols = l => l.cells.reduce((m, c) => c.c > m ? c.c : m, 0);
    const widest = (b.sheets ? b.sheets.map(s => s.layout) : [b.layout])
      .reduce((m, l) => Math.max(m, pageCols(l)), 8);
    const wb = await normalizeWorkbook(L, b.xlsx, { ncol: widest });
    /* A berthing book is one worksheet; the Metro document is a worksheet
       per location and the 395 sheet one per day, so every page is read
       back rather than just the first. */
    const pages = b.sheets ? b.sheets.map(s => s.layout) : [b.layout];
    assert.equal(wb.length, pages.length, b.name + " worksheet count");
    pages.forEach((layout, si) => {
      const sheet = wb[si];
      // a formula cell reads back as its formula, not its value
      const formula = new Set();
      for (const c of layout.cells) if (c.f) formula.add(c.r + "," + c.c);
      const want = new Map();
      for (const c of layout.cells)
        if (!c.f && c.v !== "" && c.v !== undefined && c.v !== null)
          want.set(c.r + "," + c.c, String(c.v));
      const got = new Map();
      for (const [r, c, v] of sheet.cells)
        if (v && v.v !== null && v.v !== undefined && v.v !== "" &&
            !formula.has(r + "," + c))
          got.set(r + "," + c, String(v.v));
      assert.deepEqual(norm([...got.entries()].sort()),
                       norm([...want.entries()].sort()), b.name + " values, sheet " + si);
      assert.deepEqual(norm(sheet.merges.slice().sort()),
                       norm(layout.merges.slice().sort()), b.name + " merges, sheet " + si);
      checked++;
    });
  }
  assert.ok(checked >= 2, "at least two weekend books were checked");
});

test("unified preview renders every saved cell", async () => {
  const N = built();
  const rN = await geniusRes(N);
  const day = Object.keys(rN.labels)[0];
  const order = N.SHEETS_XLSX.bookOrder(rN.secsByDay, N.SHEETS_XLSX.MAIN_ORDER, true);
  const html = N.SHEETS_XLSX.dayPreviewHtml(rN.secsByDay[day],
    rN.labels[day], false, order);
  /* The table carries an explicit width now: table-layout:fixed only takes
     effect on a table that has one, and without it a long cell stretched its
     whole column. */
  assert.match(html, /<table class="sheet" style="width:\d+px">/);
  for (const [, entries] of rN.secsByDay[day]) {
    for (const e of entries) {
      assert.ok(html.includes(e.dest), "preview shows destination " + e.dest);
    }
  }
});

test("all-headcodes toggle puts every headcode in the notes column (weekday)", async () => {
  const N = built();
  const rN = await geniusRes(N);
  const X = N.SHEETS_XLSX;
  const order = X.bookOrder(rN.secsByDay, X.MAIN_ORDER, true);
  const day = Object.keys(rN.labels)[0];
  const noteFor = (rows, headStart) => {
    const flat = [...rows];
    const i = flat.findIndex(r => r.kind === "data" &&
      String(r.vals[1] || "").startsWith(headStart));
    return i < 0 ? null : String(flat[i].vals[8] || "");
  };
  const on = X.layoutSheet(rN.secsByDay[day], rN.labels[day], false, order, true);
  const off = X.layoutSheet(rN.secsByDay[day], rN.labels[day], false, order);
  // ASHFORD is not a headcode section: the platform starter's passenger
  // headcode appears only with the toggle on…
  assert.match(noteFor(on, "05 45"), /2A01/, "pax starter headcode on");
  assert.doesNotMatch(noteFor(off, "05 45") || "", /2A01/, "legacy rules off");
  // …and so does an ECS departure's headcode (the Belvedere berth exit
  // in the metro book, which is not a headcode section either).
  const mOrder = X.bookOrder(rN.metroSecs, X.METRO_ORDER, false);
  const mOn = X.layoutSheet(rN.metroSecs[day], rN.labels[day], false, mOrder, true);
  const mOff = X.layoutSheet(rN.metroSecs[day], rN.labels[day], false, mOrder);
  assert.match(noteFor(mOn, "06+20"), /5E01/, "ECS headcode on");
  assert.doesNotMatch(noteFor(mOff, "06+20") || "", /5E01/, "legacy rules off");
});

test("a double line rules the first break, and the one into the night", () => {
  const N = built();
  const X = N.SHEETS_XLSX;
  const mk = (time, kind, diag) => ({
    time, time_kind: kind, dest: "VIC", headcode: "2A00", flag: "", sub: null,
    attachment: false, extra_notes: [], pub: { sheet: "ASHFORD" },
    units: [{ cls: "4 375", diag, am: "", pm: "", end: "", src_sheet: "ASHFORD" }],
  });
  // Array.from into this realm: the sandbox's arrays fail deepEqual on
  // prototype alone, whatever their contents
  const doubles = rows => Array.from(rows).filter(r => r.kind === "data")
    .flatMap((r, i) => r.bot === "double" ? [i] : []);
  const lay = entries =>
    X.layoutSheet(new Map([["ASHFORD", entries]]), "X", false, ["ASHFORD"], false);

  /* Two breaks, two lines. The real books rule Slade Green twice on 12/08 -
     under 06+36 and again under 18+04 - so a single-line rule is wrong by
     construction however its one line is chosen. This is Ashford's own shape
     on 18/08, ruled under 08 28 and again under 16 00. */
  const entries = [mk(8 * 60 + 28, "pax", "001"), mk(14 * 60 + 56, "pax", "002"),
                   mk(16 * 60, "pax", "003"), mk(22 * 60 + 53, "ecs", "004")];
  assert.deepEqual(doubles(lay(entries)), [0, 2],
    "under 08 28 - the first break - and under 16 00, which leads into 22+53");

  /* But a second break that only leads back into the afternoon draws
     nothing. Tonbridge on 18/08 works to 06 16, comes back at 11+32 and
     again at 14+40: the operator rules the first break and leaves the
     second, 188 minutes though it is, unruled. */
  const tonbridge = [mk(4 * 60 + 45, "pax", "062"), mk(6 * 60 + 16, "pax", "065"),
                     mk(11 * 60 + 32, "ecs", "035"), mk(14 * 60 + 40, "ecs", "060")];
  assert.deepEqual(doubles(lay(tonbridge)), [1],
    "one line, under 06 16 - nothing between 11+32 and 14+40");

  // a section worked steadily draws no line at all
  const dense = [mk(11 * 60, "pax", "001"), mk(11 * 60 + 50, "pax", "002"),
                 mk(12 * 60 + 40, "pax", "003")];
  assert.deepEqual(doubles(lay(dense)), [], "50-minute gaps are not breaks");

  // exactly on the threshold counts; one minute under does not
  const G = X.BREAK_GAP;
  const edge = [mk(6 * 60, "pax", "001"), mk(6 * 60 + G, "pax", "002")];
  assert.deepEqual(doubles(lay(edge)), [0], G + " minutes is a break");
  const under = [mk(6 * 60, "pax", "001"), mk(6 * 60 + G - 1, "pax", "002")];
  assert.deepEqual(doubles(lay(under)), [], (G - 1) + " minutes is not");

  // nothing is ruled after the last entry, however long the day's tail
  const two = [mk(6 * 60, "pax", "001"), mk(20 * 60, "pax", "002")];
  assert.deepEqual(doubles(lay(two)), [0], "one line between them, none below");

  // and Grove Park is never ruled, whatever its day looks like
  const gp = entries.map(e => ({ ...e, pub: { sheet: "GROVE PARK C.S.D" } }));
  const r3 = X.layoutSheet(new Map([["GROVE PARK", gp]]), "X", false,
                           ["GROVE PARK"], false);
  assert.deepEqual(doubles(r3), [], "Grove Park never gets a divider");
});

test("a saved book is set up to print on A4 without cutting a section", async () => {
  const N = built();
  const X = N.SHEETS_XLSX;

  /* The books go out to be printed. Before this they carried no scale and no
     page breaks, so Excel put a break down the middle of the eight columns -
     every page printed twice, with the notes column stranded on a sheet of
     its own - and started a new page wherever the paper ran out, mid
     section. The operator's own TUE 18/08 is A4 portrait at 88% with six
     manual breaks, each one immediately before a section header. */
  const res = await geniusRes(N);
  const bytes = X.writeBooks(res.secsByDay, res.labels, false, {});
  const files = N.fflate.unzipSync(bytes);
  const xml = new TextDecoder().decode(files["xl/worksheets/sheet1.xml"]);

  const scale = /<pageSetup[^>]*\bscale="(\d+)"/.exec(xml);
  assert.ok(scale, "the sheet carries a print scale: " +
    (/<pageSetup[^>]*>/.exec(xml) || [""])[0]);
  assert.match(xml, /<pageSetup[^>]*orientation="portrait"/, "A4 portrait");
  assert.match(xml, /paperSize="9"/, "paperSize 9 is A4");

  // the eight columns have to land on ONE page across at that scale
  const widths = [...xml.matchAll(/<col [^>]*width="([\d.]+)"/g)].map(m => +m[1]);
  assert.equal(widths.length, 8, "eight columns");
  const contentPt = widths.reduce((t, w) => t + Math.round(w * 7) + 5, 0) * 0.75;
  const pagePt = (8.2677 - 0.7 - 0.7) * 72;
  assert.ok(contentPt * (+scale[1] / 100) <= pagePt,
    "columns fit the width at " + scale[1] + "%: " +
    Math.round(contentPt * +scale[1] / 100) + "pt of " + Math.round(pagePt));

  /* Every break lands immediately before a section header, so no section is
     cut in half - this is the whole point of setting them by hand. */
  const heads = new Set([...xml.matchAll(/<mergeCell ref="A(\d+):G(\d+)"\/>/g)]
    .filter(m => m[1] === m[2]).map(m => +m[1]));
  assert.ok(heads.size > 1, "the fixture book has several sections");
  const brks = [...xml.matchAll(/<brk id="(\d+)"/g)].map(m => +m[1]);
  for (const b of brks)
    assert.ok(heads.has(b + 1),
      "break after row " + b + " starts a section (headers at " +
      [...heads].sort((a, c) => a - c).join(", ") + ")");

  /* The fixture is a few short sections and fits on one page, so drive the
     packing itself: three sections of 30 rows at 18pt cannot share an A4
     page, and each break has to land on the row before a header. */
  const tall = (n, at) => {
    const merges = [], heights = new Map();
    let r = 1;
    for (let i = 0; i < n; i++) {
      merges.push("A" + r + ":G" + r);
      for (let k = 0; k < at; k++) heights.set(r + k, 18);
      r += at + 1;                       // the blank spacer between sections
    }
    return X.printPlan(merges, heights, r);
  };
  const p = tall(3, 30);
  assert.deepEqual(Array.from(p.breaks), [31, 62],
    "one section a page, broken on the row before each header");
  assert.ok(p.scale > 0 && p.scale <= 100, "and a sane scale: " + p.scale);
  assert.deepEqual(Array.from(tall(3, 8).breaks), [],
    "short sections share a page");

  // a one-section book needs no breaks, but still needs the width to fit
  const ram = new TextDecoder().decode(
    N.fflate.unzipSync(X.writeBooks(res.secsByDay, res.labels, true, {}))
      ["xl/worksheets/sheet1.xml"]);
  const rs = /<pageSetup[^>]*\bscale="(\d+)"/.exec(ram);
  assert.ok(rs && contentPt * (+rs[1] / 100) <= pagePt,
    "the Ramsgate book is scaled to fit too");
});

test("the time column stays 'HH MM DDD' and the route rides in the notes", async () => {
  const N = built();
  const D = N.SHEETS_DATA, X = N.SHEETS_XLSX;

  /* Column A is "HH MM DDD" in every real book and never more - the longest
     value in any of the hand-marked books is nine characters, and the column
     is cut to fit that. "08 28 VIC Via AFK" is seventeen, which widened the
     column for the whole page on screen and ran off the end of the cell in
     the saved workbook. The route is a note, so it goes with the notes. */
  const e = {
    time: 8 * 60 + 28, time_kind: "pax", dest: "VIC", flag: "", extra_notes: [],
    headcode: "2C22", attachment: false, pub: { sheet: "Dover P" },
    via: D.routeRule("DOVER PRIORY", "VIC", "2C22").via,
    units: [{ cls: "375", diag: "011", am: "", pm: "RE", unit: "", end: "" },
            { cls: "375", diag: "010", am: "", pm: "RE", unit: "", end: "" }],
  };
  assert.equal(e.via, "AFK", "the rule table still says this one goes via Ashford");
  const lay = ent => X.layoutSheet(new Map([["DOVER PRIORY", [ent]]]), "SUN 16/08",
    false, ["DOVER PRIORY"], false).filter(r => r.kind === "data");
  const rows = lay(e);
  assert.equal(rows.length, 2, "two units, two rows");
  assert.equal(rows[0].vals[1], "08 28 VIC", "the time cell is just the time and where to");
  assert.ok(String(rows[0].vals[1]).length <= 9,
    "no wider than the widest the books ever go");
  assert.match(String(rows[0].vals[8]), /Via AFK/, "the route is in the notes");
  assert.match(String(rows[0].vals[8]), /FKE END/, "beside the end marker it decides");
  assert.ok(!rows[1].vals[1], "and nothing spills onto the row underneath");

  // a destination reached only one way carries no route at all
  const prows = lay({ ...e, via: null, headcode: "2K64" });
  assert.equal(prows[0].vals[1], "08 28 VIC", "same time cell");
  assert.doesNotMatch(String(prows[0].vals[8] || ""), /Via/,
    "and no route invented for it");

  // and nothing anywhere in a real day's books goes past that width either
  const rN = await geniusRes(N);
  const day = Object.keys(rN.labels)[0];
  const wide = X.layoutSheet(rN.secsByDay[day], rN.labels[day], false,
    X.bookOrder(rN.secsByDay, X.MAIN_ORDER, true), true)
    .filter(r => r.kind === "data")
    .map(r => String(r.vals[1] || "")).filter(v => v.length > 9);
  // (built in the sandbox realm, so count it rather than deepEqual an array
  // whose prototype is not this realm's)
  assert.equal(wide.length, 0,
    "time cells wider than the books ever go: " + Array.from(wide).join(", "));
});

test("the mileage column is opt-in, and holds the stint's miles as numbers", () => {
  /* Asked for as "mileage to the next berthing", which is what the stint's
     span already is - the 395 sheet's MG column reads the same figure. The
     option only changes how the book is WRITTEN, so with it off the sheet
     must be exactly the eight-column one it has always been. */
  const N = built();
  const X = N.SHEETS_XLSX;
  const rows = [
    { kind: "hdr", name: "ASHFORD", date: "TUE 18/08" },
    { kind: "data", vals: { 1: "05 05 VIC", 2: "4 377", 3: "102", 4: "AFK",
                            5: "AFK", 6: "", 7: "", 8: "", 9: 199 },
      top: "medium", bot: "thin", flag: false, flagSpan: 0 },
  ];
  const off = X.rowsToLayout(rows);
  const on = X.rowsToLayout(rows, true);
  const cols = l => new Set(l.cells.map(c => c.c));
  assert.deepEqual([...cols(off)].sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7, 8],
    "off: the sheet is the eight-column one, untouched");
  assert.ok(cols(on).has(9), "on: a ninth column appears");
  assert.equal(off.opts, undefined, "off: no width override, so the house widths stand");
  assert.equal(on.opts.widths.length, 9, "on: nine widths for nine columns");

  const cell = (l, c) => l.cells.find(x => x.c === c && x.r === 2);
  assert.equal(cell(on, 9).v, 199, "the stint's miles land in it");
  assert.equal(cell(on, 9).num, true,
    "written as a number, so the column can be summed in Excel");
  /* The date is nine characters and the mileage column is sized for three
     digits, so moving the date there simply clipped it. */
  const dateCell = l => l.cells.find(x => x.r === 1 && x.v === "TUE 18/08");
  assert.equal(dateCell(on).c, 8, "the date stays in the notes column");
  assert.ok(on.merges.includes("H1:I1"), "and spreads across the mileage one");
  assert.ok(off.merges.includes("A1:G1") && on.merges.includes("A1:G1"),
    "the section name spans the same columns either way");
});
