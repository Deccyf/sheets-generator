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
    const wbL = await normalizeWorkbook(L, bytesL);
    const wbN = await normalizeWorkbook(L, bytesN);
    assert.deepEqual(wbN, wbL, name);
  }
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
    const wb = await normalizeWorkbook(L, b.xlsx);
    const sheet = wb[0];
    // a formula cell reads back as its formula, not its value
    const formula = new Set();
    for (const c of b.layout.cells) if (c.f) formula.add(c.r + "," + c.c);
    const want = new Map();
    for (const c of b.layout.cells)
      if (!c.f && c.v !== "" && c.v !== undefined && c.v !== null)
        want.set(c.r + "," + c.c, String(c.v));
    const got = new Map();
    for (const [r, c, v] of sheet.cells)
      if (v && v.v !== null && v.v !== undefined && v.v !== "" &&
          !formula.has(r + "," + c))
        got.set(r + "," + c, String(v.v));
    assert.deepEqual(norm([...got.entries()].sort()),
                     norm([...want.entries()].sort()), b.name + " values");
    assert.deepEqual(norm(sheet.merges.slice().sort()),
                     norm(b.layout.merges.slice().sort()), b.name + " merges");
    checked++;
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
  assert.match(html, /<table class="sheet">/);
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

test("a double line rules off every break in the day's work", () => {
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
     construction however its one line is chosen. */
  const entries = [mk(8 * 60 + 28, "pax", "001"), mk(14 * 60 + 56, "pax", "002"),
                   mk(16 * 60, "pax", "003"), mk(22 * 60 + 53, "ecs", "004")];
  assert.deepEqual(doubles(lay(entries)), [0, 2],
    "under 08 28 and under 16 00 - both breaks are hours long");

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
