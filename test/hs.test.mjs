/* The High Speed book is the depot's Class 395 Allocations Sheet, not a
   berthing sheet: a worksheet per day, a block per depot, last night's
   arrivals on the left and today's allocations on the right. */
import test from "node:test";
import assert from "node:assert/strict";
import { built, legacy, normalizeWorkbook } from "./helpers/compare.mjs";
import { makePdf, SUMMARY_LINES, DETAIL_LINES } from "./helpers/synth.mjs";

const res = ctx => ctx.GENIUS.build(
  [makePdf(SUMMARY_LINES, ctx.fflate), makePdf(DETAIL_LINES, ctx.fflate)]);

test("High Speed is timed off the first move, the way their sheet is", async () => {
  const N = built();
  const D = N.SHEETS_DATA;
  const hs = Array.from(D.PROFILES_G).find(p => p.bucket === "hs");
  assert.equal(hs.firstDepAll, true,
    "their 18/08 sheet has AZ601 at 04+19 where the platform departure is 05+03");
  /* …on the reports side only. The weekend High Speed book is still a
     berthing book and nobody has held one against a copy timed that way. */
  const wk = Array.from(D.PROFILES).find(p => /395/.test(String(p.label || p.road)));
  assert.equal(wk.first_dep_all, false, "the weekend book keeps the platform time");
});

test("the sheet uses the allocation sheet's own berth codes", () => {
  const H = built().SHEETS_HS;
  // ASH appears 2019 times in the real sheet's ENDS columns against AFK's 6
  assert.equal(H.endsCode("AFK"), "ASH");
  assert.equal(H.endsCode("RE"), "RAM");
  assert.equal(H.endsCode("FAV"), "FAV", "one it already agrees on");
  assert.equal(H.endsCode(""), "", "and nothing stays nothing");
});

test("a worksheet per day, named the way their workbook names them", async () => {
  const N = built();
  const H = N.SHEETS_HS;
  const r = await res(N);
  const sheets = H.sheetsFor(r.hsSecs, r.labels, r.dates);
  assert.ok(sheets.length, "the fixture built a High Speed sheet");
  for (const sh of sheets) {
    assert.match(sh.name, /^[A-Z][a-z]{2} \d\d \d\d$/,
      "named like their own tabs — 'Tue 18 08': " + sh.name);
    assert.ok(sh.name.length <= 31, "Excel takes 31 characters in a tab name");
    /* Dressed in the workbook's own records, not the house looks: the exact
       styleSheet rides on the layout, the tab is their yellow, the columns
       are their <cols> verbatim, and there is no pageSetup because their
       tab carries none. */
    const o = sh.layout.opts;
    assert.ok(/^<\?xml/.test(o.stylesXml), "the skin's styleSheet is used");
    assert.ok(o.stylesXml.includes("FF00B050"), "their green is in it");
    assert.equal(o.tabColor, "FFFFFF00", "their yellow tab");
    assert.match(o.colsXml, /^<cols>/, "their column widths, verbatim");
    assert.equal(o.noPageSetup, true, "no pageSetup, like their tab");
    assert.ok(o.condFmt.length, "the MG mileage colours ride along");
    assert.match(o.condFmt[0], /dxfId="0".*lessThan.*500/s, "green under 500");
  }
  /* …and the saved workbook really carries all of it. */
  const bytes = H.writeHsBook(r.hsSecs, r.labels, r.dates,
                              f => N.fflate.zipSync(f, { level: 6 }));
  const files = N.fflate.unzipSync(bytes);
  const styles = new TextDecoder().decode(files["xl/styles.xml"]);
  assert.ok(styles.includes("FF00B050") && styles.includes("<dxfs count=\"2\">"),
    "their styles and the two mileage dxfs are in the saved file");
  /* No theme colours. The workbook painted its greys as theme-0-with-tint,
     and a generated book has no theme part to resolve them against - Excel
     drew every such fill as a dotted haze. The skin ships pure rgb, resolved
     against their own theme's palette: the between-tables grey is D9D9D9
     ("white, darker 15%"), the under-500-miles chip is A9D18E. */
  assert.ok(!styles.includes('theme="'), "no unresolvable theme colours");
  assert.ok(styles.includes("FFD9D9D9"), "the grey resolved to its rgb");
  assert.ok(styles.includes("FFA9D18E"), "and the mileage chip to its green");
  /* Excel's reserved slots - the second cause of the haze. Excel paints
     every UNTOUCHED cell of the grid with cellXfs 0 and expects fill 0 to
     be patternType none and fill 1 gray125; the renumbered skin once put
     the workbook's solid-white applyFill record at 0 and the whole
     background rendered dotted. The slots must stay conventional. */
  assert.ok(styles.includes('<fill><patternFill patternType="none"/></fill>' +
    '<fill><patternFill patternType="gray125"/></fill>'),
    "fills 0 and 1 are the reserved none/gray125 pair");
  assert.match(styles,
    /<cellXfs count="\d+"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"\/>/,
    "cellXfs 0 is a plain default");
  const xml = new TextDecoder().decode(files["xl/worksheets/sheet1.xml"]);
  assert.ok(xml.includes('<tabColor rgb="FFFFFF00"/>'), "yellow tab saved");
  assert.ok(xml.includes("<conditionalFormatting"), "mileage colours saved");
  assert.ok(!xml.includes("<pageSetup"), "and no pageSetup, like theirs");

  /* And the whole workbook survives a REAL parser. String checks above
     cannot see malformed XML: the first cut of the skin extractor swallowed
     the <borders count="..."> section header into border record 0, the
     styleSheet nested a second unclosed <borders>, and Excel repaired the
     file by throwing the styles part away. ExcelJS would have refused it
     the same way Excel did. */
  const wb = await normalizeWorkbook(legacy(), bytes);
  assert.ok(wb.length >= 1, "the workbook loads in a real parser");
  assert.ok(wb[0].cells.length > 20, "with its cells intact: " + wb[0].cells.length);
  const vals = wb[0].cells.map(([, , rec]) => rec.v);
  assert.ok(vals.includes("INT CLEAN") && vals.includes("Mileage Guide"),
    "and the legend text survives the round trip");

  /* The drop-downs their sheet keeps: the fleet roster on both UNIT columns
     (built at runtime from first+count, so no unit numbers ride in the
     skin), 6/12, the CET mark, and FP/RP. */
  const dv = /<dataValidations count="4">([\s\S]*?)<\/dataValidations>/.exec(xml);
  assert.ok(dv, "four drop-down lists saved");
  for (const list of ['"6,12"', '"YES,N"', '"FP,RP"'])
    assert.ok(dv[1].includes("<formula1>" + list + "</formula1>"), list);
  assert.match(dv[1], /<formula1>"395001,(?:39500\d,)+/, "the fleet roster");
  assert.match(dv[1], /sqref="D\d+:D\d+ N\d+:N\d+/, "on both UNIT columns");

  /* And the standing route notes, as classic comments on the DIAGRAM
     cells - the same knowledge their workbook keeps there, carried by
     headcode like ROUTE_BY_HC. The synthetic fixture's headcodes are not in
     the lookup, so one of the lookup's own is driven through: a note needs
     its comments part, its VML twin, the rels binding both, the sheet
     pointing at them and the content types declaring them, or Excel shows
     nothing at all. */
  const notes = N.SHEETS_HS_SKIN.hcNotes;
  assert.ok(Object.keys(notes).length >= 5,
    "the skin carries the standing notes: " + Object.keys(notes).length);
  const hc = Object.keys(notes)[0];
  const one = { M: new Map([["ASHFORD", [{ time: 300, time_kind: "ecs",
    dest: "STP", headcode: hc,
    units: [{ diag: "601", code: "AZ", am: "", pm: "AFK", ends: "AFK PM",
              mg: 250, miles: 500 }] }]]]) };
  const lay = H.layoutDay("M", { M: "03/08/26" }, one, null);
  assert.equal(lay.comments.length, 1, "the note is raised for " + hc);
  assert.match(lay.comments[0].ref, /^I\d+$/, "on the DIAGRAM cell");
  assert.equal(lay.comments[0].text, notes[hc].join("\n"), "with its own words");
  const bytes2 = N.SHEETS_XLSX.writeWorkbook([{ name: "T", layout: lay }],
    f => N.fflate.zipSync(f, { level: 6 }));
  const f2 = N.fflate.unzipSync(bytes2);
  assert.ok(f2["xl/comments1.xml"], "a comments part is written");
  assert.ok(f2["xl/drawings/vmlDrawing1.vml"], "with its VML twin");
  assert.ok(f2["xl/worksheets/_rels/sheet1.xml.rels"], "and the sheet rels");
  const sx = new TextDecoder().decode(f2["xl/worksheets/sheet1.xml"]);
  assert.match(sx, /<legacyDrawing r:id="rId1"\/>/, "the sheet points at them");
  const cmt = new TextDecoder().decode(f2["xl/comments1.xml"]);
  assert.match(cmt, /Not over high level|Avoids North Kent/,
    "the standing note made it in");
  const types = new TextDecoder().decode(f2["[Content_Types].xml"]);
  assert.ok(types.includes('Extension="vml"') && types.includes("/xl/comments1.xml"),
    "and the content types declare both parts");
  const wb2 = await normalizeWorkbook(legacy(), bytes2);
  assert.ok(wb2[0].cells.length > 5, "and that workbook still loads");
});

test("every depot the workbook lays out gets its block and its arrivals", () => {
  /* Two silent losses, both invisible with a single day of reports. The
     block list left Faversham out, so a day with a Faversham departure had
     it quietly missing from the sheet - their own workbook carries a
     Faversham block on 97 of its daily tabs. And the arrivals side compared
     a berth code against a full location name, which only ever matched
     Ashford through a special case: every other depot's table stayed empty
     however many days were loaded. */
  const N = built();
  const H = N.SHEETS_HS;
  // spread: the tool runs in its own realm, so its arrays are not this
  // realm's Array and a strict deep compare fails on the prototype alone
  assert.deepEqual([...H.DEPOTS], ["ASHFORD", "FAVERSHAM", "MARGATE", "RAMSGATE"],
    "all four depots their workbook uses, in its own order");
  // an arrival is recognised into each of them, off the day before's entries
  for (const [depot, berth] of [["ASHFORD", "AFK"], ["FAVERSHAM", "FKE"],
                                ["MARGATE", "MAR"], ["RAMSGATE", "RE"]]) {
    const yday = new Map([["ANY", [{ time: 1200, time_kind: "ecs", dest: "X",
      headcode: "5X01", units: [{ diag: "601", code: "AZ", am: "", pm: berth,
      ends: berth + " PM", unit: "395001", miles: 500 }] }]]]);
    const got = H.arrivalsInto(depot, yday);
    assert.equal(got.length, 1, depot + " sees a unit that berthed there");
    assert.equal(got[0].unit, "395001", "by its unit number");
    /* The reports say what the unit LEFT on, not what it arrived on: the
       columns headed TRAIN ID and ARRIVAL TIME are the depot's to fill. */
    assert.equal(got[0].hc, "", "no departure headcode under an arrival heading");
    assert.equal(got[0].at, "", "and no departure time under ARRIVAL TIME");
  }
  // and a day carrying one of each writes a block for every one of them
  const day = (secs) => H.layoutDay("T", { M: "03/08/26", T: "04/08/26" }, secs, "M");
  const entry = dest => [{ time: 500, time_kind: "ecs", dest,
    headcode: "5X02", units: [{ diag: "602", code: "AZ", am: "", pm: "AFK",
    ends: "AFK PM", miles: 400 }] }];
  const lay = day({ M: new Map(), T: new Map(H.DEPOTS.map(d => [d, entry(d)])) });
  const titles = lay.cells.filter(c => /UNIT ALLOCATIONS/.test(c.v))
                          .map(c => c.v.replace(/ UNIT ALLOCATIONS.*/, ""));
  assert.deepEqual([...titles], [...H.DEPOTS], "a block each, in their order");
});

test("MG is a real number cell, so the mileage colours can fire", () => {
  /* The cellIs rules compare numbers; a mileage written as inline TEXT is
     invisible to them, and the depot saw every MG cell sit on the red base
     fill whatever the figure said. The operator's own K cells are plain
     <v> number cells, so the generated ones are too - the headers stay
     text. */
  const N = built();
  const H = N.SHEETS_HS;
  const one = { M: new Map([["ASHFORD", [{ time: 300, time_kind: "ecs",
    dest: "STP", headcode: "5Z99",
    units: [{ diag: "601", code: "AZ", am: "", pm: "AFK", ends: "AFK PM",
              mg: 143, miles: 500 }] }]]]) };
  const lay = H.layoutDay("M", { M: "03/08/26" }, one, null);
  const bytes = N.SHEETS_XLSX.writeWorkbook([{ name: "T", layout: lay }],
    f => N.fflate.zipSync(f, { level: 6 }));
  const xml = new TextDecoder().decode(
    N.fflate.unzipSync(bytes)["xl/worksheets/sheet1.xml"]);
  assert.match(xml, /<c r="K\d+" s="\d+"><v>143<\/v><\/c>/,
    "the working's 143 miles is a number cell");
  assert.ok(!/<c r="K\d+"[^>]*t="inlineStr"><is><t[^>]*>\d/.test(xml),
    "and no K cell holds a mileage as text");
});

test("the high-level note reads the working itself, not the headcode", () => {
  /* "Not over high level" is derived: a stint with a leg between Ebbsfleet
     and Gravesend goes over the high level, one without does not. The
     lookup's own copy of the note must stand aside when the legs have been
     read - their 18/08 tab puts the note on AZ623's morning and evening
     rows while the same diagram's positioning start makes the transit. */
  const N = built();
  const H = N.SHEETS_HS;
  const notes = N.SHEETS_HS_SKIN.hcNotes;
  const hc = Object.keys(notes).find(k =>
    notes[k].some(t => /North Kent/.test(t)) &&
    notes[k].some(t => /high level/i.test(t)));
  assert.ok(hc, "the lookup carries a headcode with both standing notes");
  const mk = hl => ({ M: new Map([["ASHFORD", [{ time: 300, time_kind: "ecs",
    dest: "STP", headcode: hc,
    units: [{ diag: "601", code: "AZ", am: "", pm: "AFK", ends: "AFK PM",
              mg: 250, miles: 500, hl }] }]]]) });
  const day = s => H.layoutDay("M", { M: "03/08/26" }, s, null);
  const over = day(mk(true)).comments;
  assert.equal(over.length, 1, "the North Kent note still rides for " + hc);
  assert.ok(!/high level/i.test(over[0].text),
    "but a working that makes the transit does not say 'not over'");
  const not = day(mk(false)).comments;
  assert.match(not[0].text, /Not over high level$/,
    "a working with no such leg says so");
  assert.ok(/North Kent/.test(not[0].text),
    "alongside the standing note, not instead of it");
  const blind = day(mk(undefined)).comments;
  assert.equal(blind[0].text, notes[hc].join("\n"),
    "with no legs to read - a PDF-fed build - the lookup stands as-is");
});

test("each depot block is arrivals on the left, allocations on the right", async () => {
  const N = built();
  const H = N.SHEETS_HS;
  const r = await res(N);
  const sh = H.sheetsFor(r.hsSecs, r.labels, r.dates)[0];
  const at = new Map();
  for (const c of sh.layout.cells) at.set(c.r + "," + c.c, c.v);

  // the legend block sits above everything, exactly as the workbook has it
  assert.equal(at.get("2,7"), "INT CLEAN");
  assert.equal(at.get("3,7"), "EXT CLEAN");
  assert.equal(at.get("2,8"), "Mileage Guide");
  assert.equal(at.get("2,19"), "Date Sent");
  assert.equal(at.get("3,19"), "", "the sent date is the sender's to fill in");

  // find a block heading and check the pair, and the header row under it
  let head = null;
  for (let n = 1; n < sh.layout.maxRow; n++)
    if (/PM ARRIVALS/.test(at.get(n + ",2") || "")) { head = n; break; }
  assert.ok(head, "a depot block was written");
  assert.match(at.get(head + ",2"), /^[A-Z ]+ PM ARRIVALS /, "arrivals on the left");
  assert.match(at.get(head + ",8"), /^[A-Z ]+ UNIT ALLOCATIONS /, "allocations on the right");
  // the header row, in their own words and their own columns
  for (const [c, want] of [[2, "TRAIN ID"], [3, "ARRIVAL TIME"], [4, "UNIT NUMBER"],
                           [5, "6 OR 12 CAR"], [6, "CET DUE"], [8, "TRAIN ID"],
                           [9, "DIAGRAM"], [11, "MG"], [12, "TIME"], [13, "FP/RP"],
                           [14, "UNIT NO"], [15, "ENDS AM"], [17, "ENDS PM"],
                           [18, "TRAIN ID"], [19, "ARRIVES"], [20, "WORKS"]])
    assert.equal(at.get((head + 1) + "," + c), want, "column " + c);
  /* With one day's reports there is no day before, so the arrivals table is
     empty and the heading says so rather than looking like a quiet nothing. */
  assert.match(at.get(head + ",2"), /no previous day loaded/,
    "a single day's reports cannot fill last night's arrivals");
  // and the standing house notes close the sheet
  let note = false;
  for (const c of sh.layout.cells) if (c.v === "NOTE") note = true;
  assert.ok(note, "the footer notes block is re-anchored under the last depot");
});

test("the columns the reports cannot fill are ruled and empty", async () => {
  const N = built();
  const H = N.SHEETS_HS;
  const r = await res(N);
  const sh = H.sheetsFor(r.hsSecs, r.labels, r.dates)[0];
  const at = new Map(), styled = new Map();
  for (const c of sh.layout.cells) {
    at.set(c.r + "," + c.c, c.v);
    styled.set(c.r + "," + c.c, c.sides);
  }
  let firstData = null;
  for (let n = 1; n < sh.layout.maxRow; n++)
    if (/^[A-Z]{2}\d{3}$/.test(at.get(n + ",9") || "")) { firstData = n; break; }
  assert.ok(firstData, "a diagram row was written");
  // N/M M/O, FP/RP, ARRIVES, the next working and the notes are hand-kept
  for (const c of [10, 13, 16, 18, 19, 20]) {
    assert.equal(at.get(firstData + "," + c), "", "column " + c + " left empty");
    assert.ok(styled.get(firstData + "," + c), "…but ruled, not missing");
  }
  // and the ones it can fill, are
  assert.match(at.get(firstData + ",9"), /^[A-Z]{2}\d{3}$/, "DIAGRAM");
  assert.match(at.get(firstData + ",12"), /^\d\d[ +]\d\d$/, "TIME");
});

test("the 395 preview is drawn in the workbook's own dress", () => {
  /* The saved book names an exact style record per cell, and the preview had
     only the coarse house look to go on — so what you checked on screen was
     bare text while what you saved was the operator's ruled, filled,
     coloured sheet. That is the one thing a preview must not do. The skin
     carries the same records as CSS, built from the very font/fill/border
     records that go into the styleSheet, so the two cannot drift. */
  const N = built();
  const H = N.SHEETS_HS;
  const SKIN = N.SHEETS_HS_SKIN;
  assert.equal(SKIN.xfCss.length,
    (SKIN.stylesXml.match(/<cellXfs count="(\d+)"/) || [])[1] * 1,
    "one CSS record per style record");
  const day = mg => ({ M: new Map([["ASHFORD", [{ time: 300, time_kind: "ecs",
    dest: "STP", headcode: "5X01",
    units: [{ diag: "601", code: "AZ", am: "", pm: "AFK", ends: "AFK PM",
              mg, miles: 500 }] }]]]) });
  const html = mg => N.SHEETS_XLSX.previewHtml(
    H.layoutDay("M", { M: "03/08/26" }, day(mg), null));

  const under = html(143);
  assert.match(under, /class="sheet calibri"/, "set in the sheet's own face");
  assert.match(under, /border-left:2px solid/, "and ruled, not bare text");
  assert.ok(under.includes("#00B050"), "the depot's green on the block titles");
  /* Excel paints the mileage rules over the cell when the book opens, so the
     preview paints them too — otherwise MG shows its base fill on screen and
     a different colour in the workbook. */
  assert.ok(under.includes(SKIN.dxfCss[0].match(/background:(#\w+)/)[1]),
    "under 500 miles is green, the way the key above it says");
  assert.ok(html(951).includes(SKIN.dxfCss[1].match(/background:(#\w+)/)[1]),
    "and 500 or over is red");
  assert.ok(!under.includes("font-size:undefined"),
    "no look without a size behind it");
});

test("a merged panel's box comes from the range's edges, not the anchor's sides", () => {
  /* A merged range is ONE cell on the page, and the spreadsheet draws its box
     from the cells around the range's EDGE — the bottom rule off its bottom
     row, the right off its right-hand column. The preview took the anchor
     cell's own four sides, and an anchor does not own the far edges of its
     range: on the 395 sheet the COMMENTS panel and the NOTE block carry their
     bottom and right on cells further down and across, so both came out as
     open boxes with the lines simply missing. */
  const N = built();
  const H = N.SHEETS_HS, X = N.SHEETS_XLSX, SKIN = N.SHEETS_HS_SKIN;
  const lay = H.layoutDay("M", { M: "03/08/26" }, { M: new Map([["ASHFORD", [
    { time: 300, time_kind: "ecs", dest: "STP", headcode: "5X01",
      units: [{ diag: "601", code: "AZ", am: "", pm: "AFK", ends: "AFK PM",
                mg: 143, miles: 500 }] }]]]) }, null);
  const at = new Map();
  for (const c of lay.cells) at.set(c.r + "," + c.c, c);
  const colNum = s => { let n = 0; for (const ch of s) n = n * 26 + ch.charCodeAt(0) - 64; return n; };
  // what one cell's own style record draws on one of its sides
  const side = (r, c, s) => {
    const cell = at.get(r + "," + c);
    const m = new RegExp("border-" + s + ":([^;]*)")
      .exec((cell && SKIN.xfCss[cell.xf]) || "");
    const v = m ? m[1].trim() : "";
    return (!v || v === "0" || v === "none") ? "" : v;
  };
  // the tall COMMENTS panel: the deepest merge on the page
  let deep = null, rows = 0;
  for (const m of Array.from(lay.merges)) {
    const p = /^([A-Z]+)(\d+):([A-Z]+)(\d+)$/.exec(m);
    if (!p) continue;
    if (+p[4] - +p[2] + 1 > rows) {
      rows = +p[4] - +p[2] + 1;
      deep = { c1: colNum(p[1]), r1: +p[2], c2: colNum(p[3]), r2: +p[4] };
    }
  }
  assert.ok(rows > 1, "the sheet has a panel merged over several rows");
  // the fault, pinned at the source: the anchor does not carry the far sides
  assert.equal(side(deep.r1, deep.c1, "bottom"), "",
    "the anchor cell of the panel has no bottom rule of its own");
  const want = {
    top: side(deep.r1, deep.c1, "top"), left: side(deep.r1, deep.c1, "left"),
    bottom: side(deep.r2, deep.c1, "bottom"), right: side(deep.r1, deep.c2, "right"),
  };
  for (const s of Object.keys(want))
    assert.ok(want[s], "the workbook rules the panel's " + s + " edge");
  const td = new RegExp('<td colspan="' + (deep.c2 - deep.c1 + 1) +
    '" rowspan="' + rows + '" style="([^"]*)"').exec(X.previewHtml(lay));
  assert.ok(td, "the panel is one cell on the page");
  for (const s of Object.keys(want)) {
    // the last declaration wins in an inline style, as it does in the browser
    const all = td[1].split(";").filter(d => d.trim().startsWith("border-" + s + ":"));
    assert.equal((all.pop() || "").split(":").slice(1).join(":").trim(), want[s],
      "the panel's " + s + " is drawn where the workbook draws it");
  }
});
