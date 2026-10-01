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
  /* …on both sides. The weekend High Speed road kept the platform departure
     for as long as it was a BERTHING book, which nobody had held against a
     copy timed off the first move. It builds this same allocations sheet
     now, so it is timed the same way: AZ601 is its 07+10 off the down
     sidings as 5R09, not the 07.47 out of the platform as 2R09. */
  const wk = Array.from(D.PROFILES).find(p => /395/.test(String(p.label || p.road)));
  assert.equal(wk.first_dep_all, true, "the weekend book is timed that way too");
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
    /* These prints carry no mileage, so there is no MG rule: Excel reads
       an empty cell as 0, and a rule over blanks paints them all green.
       The two rules every sheet has are the planner's: OFFERED red under
       REQUIRED, and the sanding miles. */
    assert.ok(!o.condFmt.some(c => /sqref="K/.test(c)), "no MG figures, no MG colours");
    assert.equal(o.condFmt.length, 2, "OFFERED and the sanding miles");
  }
  /* …and the saved workbook really carries all of it. */
  const bytes = H.writeHsBook(r.hsSecs, r.labels, r.dates,
                              f => N.fflate.zipSync(f, { level: 6 }));
  const files = N.fflate.unzipSync(bytes);
  const styles = new TextDecoder().decode(files["xl/styles.xml"]);
  assert.ok(styles.includes("FF00B050") && styles.includes("<dxfs count=\"4\">"),
    "their styles, the three mileage dxfs and the red figure are in the saved file");
  /* No theme colours. The workbook painted its greys as theme-0-with-tint,
     and a generated book has no theme part to resolve them against - Excel
     drew every such fill as a dotted haze. The skin ships pure rgb, resolved
     against their own theme's palette: Ashford's grey strip is BFBFBF
     ("white, darker 25%"), the Low mileage green is C5E0B4. */
  assert.ok(!styles.includes('theme="'), "no unresolvable theme colours");
  assert.ok(styles.includes("FFBFBFBF"), "the grey resolved to its rgb");
  assert.ok(styles.includes("FFC5E0B4"), "and the mileage chip to its green");
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
  assert.ok(!xml.includes("<pageSetup"), "and no pageSetup, like theirs");

  /* And the whole workbook survives a REAL parser. String checks above
     cannot see malformed XML: the first cut of the skin extractor swallowed
     the <borders count="..."> section header into border record 0, the
     styleSheet nested a second unclosed <borders>, and Excel repaired the
     file by throwing the styles part away. ExcelJS would have refused it
     the same way Excel did. */
  const wb = await normalizeWorkbook(legacy(), bytes, { ncol: 26 });
  assert.ok(wb.length >= 1, "the workbook loads in a real parser");
  assert.ok(wb[0].cells.length > 20, "with its cells intact: " + wb[0].cells.length);
  const vals = wb[0].cells.map(([, , rec]) => rec.v);
  assert.ok(vals.includes("SERVICE TRAINS REQUIRED AM / PM") && vals.includes("SANDING") &&
            vals.includes("Average"), "and the house text survives the round trip");

  /* The drop-downs their sheet keeps: the fleet roster on both UNIT columns
     (built at runtime from first+count, so no unit numbers ride in the
     skin), 6/12, the CET mark, and FP/RP. */
  const dv = /<dataValidations count="4">([\s\S]*?)<\/dataValidations>/.exec(xml);
  assert.ok(dv, "four drop-down lists saved");
  for (const list of ['"6,12"', '"YES,N"', '"FP,RP"'])
    assert.ok(dv[1].includes("<formula1>" + list + "</formula1>"), list);
  assert.match(dv[1], /<formula1>"395001,(?:39500\d,)+/, "the fleet roster");
  assert.match(dv[1], /sqref="D\d+:D\d+ N\d+:N\d+ I\d+:I\d+ O\d+:O\d+ W12:W40"/,
    "on both UNIT columns, and the stopped and sanding tables'");

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

  /* the top sits above everything, exactly as their October tab has it:
     the service-trains table, Done to Genius, the sent date and time */
  assert.equal(at.get("3,8"), "SERVICE TRAINS REQUIRED AM / PM");
  assert.equal(at.get("4,8"), "SERVICE TRAINS OFFERED AM / PM");
  assert.equal(at.get("7,8"), "TOTAL STABLED");
  assert.equal(at.get("4,2"), "Done to Genius");
  assert.equal(at.get("4,19"), "Date Sent");
  assert.equal(at.get("5,19"), "", "the sent date is the sender's to fill in");
  assert.equal(at.get("4,13"), "", "OFFERED is the planner's to fill in");
  assert.equal(at.get("8,19"), "", "and the version");

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

/* Without the day's own stops - a build that carries only the books - the
   columns that need them are ruled and left for the depot, rather than
   filled with something the books cannot know. With them, see the tests
   at the end of this file. */
test("with no stops to read, the columns that need them are ruled and empty", async () => {
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
     a different colour in the workbook. High, Average and Low, the way the
     key above it says: under 400 green, 400 to 700 amber, 700 on red. */
  const bg = band => SKIN.mg.find(b => b.band === band).css.match(/background:(#\w+)/)[1];
  assert.ok(under.includes(bg("Low")), "143 miles is Low, green");
  assert.ok(html(550).includes(bg("Average")), "550 is Average, amber");
  assert.ok(html(951).includes(bg("High")), "951 is High, red");
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

/* ---- the sheet filled from the day's own stops ----
   A Monday and a Tuesday of 395 work (test/helpers/hs-synth.mjs): a 12 out
   of Ramsgate to St Pancras and home to Ashford depot, a unit out of Ashford
   that comes back mid-morning and goes out again by Gravesend, and on the
   Tuesday two Ramsgate diagrams, one on Monday's AZ601 unit. */
import { hsWeekCsv } from "./helpers/hs-synth.mjs";
const COLS = "ABCDEFGHIJKLMNOPQRST";
async function week(...dates) {
  const N = built();
  const files = []; for (const d of dates) files.push(...hsWeekCsv(d));
  const r = await N.GENIUS.build(files);
  const sheets = N.SHEETS_HS.sheetsFor(r.hsSecs, r.labels, r.dates, r.hsDays);
  return { N, r, sheets, tab: name => {
    const sh = sheets.find(s => s.name === name);
    const g = new Map(), x = new Map();
    for (const c of sh.layout.cells) { g.set(c.r + ":" + COLS[c.c - 1], c.v); x.set(c.r + ":" + COLS[c.c - 1], c.xf); }
    const notes = new Map(sh.layout.comments.map(c => [c.ref, c.text]));
    const row = (diag, time) => { for (let r = 1; r <= sh.layout.maxRow; r++)
      if (g.get(r + ":I") === diag && g.get(r + ":L") === time) return { r, at: c => g.get(r + ":" + c) || "", xf: c => x.get(r + ":" + c), note: notes.get("I" + r) || "" };
      return null; };
    const title = re => { for (let r = 1; r <= sh.layout.maxRow; r++) if (re.test(g.get(r + ":B") || "")) return r; return null; };
    return { g, row, title, layout: sh.layout, at: (r, c) => g.get(r + ":" + c) || "", xf: (r, c) => x.get(r + ":" + c) };
  } };
}

test("each part of the day says where it ends, on what and when, and what it works next", async () => {
  const { tab } = await week("03/08/26");
  const t = tab("Mon 03 08");
  const am = t.row("AZ601", "06+00"), pm = t.row("AZ601", "16+00");
  // back into Ashford depot at ten and out again at four: ENDS AM, and WORKS names the next working
  assert.equal(am.at("O"), "ASH"); assert.equal(am.at("P"), "10+00");
  assert.equal(am.at("Q"), "", "a morning return is not where it ends the day");
  assert.equal(am.at("T"), "5R30", "WORKS: the working it goes back out on");
  // the last part runs to the end of the day: ENDS PM, the working it came in on, the time
  assert.equal(pm.at("Q"), "RAM"); assert.equal(pm.at("R"), "5R32"); assert.equal(pm.at("S"), "18+50");
  assert.equal(pm.at("T"), "", "nothing to work next that day");
});

test("N/M on a part of the day that never runs coupled, M/O on one that never runs alone", async () => {
  const { tab } = await week("03/08/26");
  const t = tab("Mon 03 08");
  assert.equal(t.row("AZ601", "06+00").at("J"), "N/M", "written the way their sheet writes it");
  assert.equal(t.row("AZ601", "16+00").at("J"), "N/M");
  assert.equal(t.row("AZ611", "05+00").at("J"), "M/O");
  assert.equal(t.row("AZ612", "05+00").at("J"), "M/O");
});

test("a 12 leaving Ramsgate names its Margate and Minster ends, Margate end first, the train ID once", async () => {
  const { tab } = await week("03/08/26");
  const t = tab("Mon 03 08");
  const a = t.row("AZ611", "05+00"), b = t.row("AZ612", "05+00");
  // position 1 leads the first move, and the first move is out of the Margate end
  assert.equal(a.at("M"), "MAR"); assert.equal(b.at("M"), "MIN");
  assert.equal(b.r, a.r + 1, "the Margate end on the first line");
  assert.equal(a.at("H"), "5J05 MAR"); assert.equal(b.at("H"), "", "the train ID once, for the pair");
});

test("a 12 arriving names the end each unit comes in at, where the order can be followed", async () => {
  const { tab } = await week("03/08/26");
  const t = tab("Mon 03 08");
  /* The order is carried from Ramsgate depot: turned at Margate, through
     Ramsgate and Canterbury, turned at St Pancras, turned at Ashford to go
     into the Down Yard, and in to the depot - so AZ612 leads the last move
     and stands at the London end. */
  assert.equal(t.row("AZ611", "05+00").at("S"), "09+50 C");
  assert.equal(t.row("AZ612", "05+00").at("S"), "09+50 L");
  assert.equal(t.row("AZ611", "05+00").at("R"), "5J20");
});

test("the TRAIN ID names where that working itself goes, in the sheet's own words", async () => {
  const { tab } = await week("03/08/26");
  const t = tab("Mon 03 08");
  assert.equal(t.row("AZ601", "06+00").at("H"), "5R01 AFK", "the empty run from the depot to Ashford station");
  assert.equal(t.row("AZ601", "16+00").at("H"), "5R30 AFK");
});

test("an all-day diagram's long platform stand is shown in ENDS AM, beside where it ends", async () => {
  const { tab } = await week("03/08/26");
  const a = tab("Mon 03 08").row("AZ611", "05+00");
  assert.equal(a.at("O"), "SPX", "nearly two hours at St Pancras");
  assert.equal(a.at("P"), "06 50");
  assert.equal(a.at("Q"), "ASH", "and ENDS PM still says where it ends");
});

test("the high-level note sits on a part of the day that never calls at Gravesend", async () => {
  const { tab } = await week("03/08/26");
  const t = tab("Mon 03 08");
  assert.equal(t.row("AZ601", "06+00").note, "not over high level", "Ashford to Dover and back");
  assert.equal(t.row("AZ601", "16+00").note, "", "out by Gravesend and the North Kent");
});

test("last night's arrivals come off that night's own reports: working, time, unit, 6 or 12 and the end", async () => {
  const { tab } = await week("03/08/26", "04/08/26");
  const t = tab("Tue 04 08");
  const h = t.title(/^ASHFORD PM ARRIVALS Monday 03\/08\/26$/);
  assert.ok(h, "titled with the night they are from");
  const rows = [h + 2, h + 3].map(r => ["B", "C", "D", "E"].map(c => t.at(r, c)));
  assert.deepEqual(rows, [["5J20", "09+50 C", "395011", "12"], ["5J20", "09+50 L", "395012", "12"]]);
});

test("UNIT NO is the stock controller's to fill in; last night's arrivals keep their units", async () => {
  /* The stock controller chooses the units for the day, so the allocations'
     UNIT NO is left ruled and empty on a weekday too, though the Summary
     names 395099 and 395001 for these two. The only units the sheet fills
     are the arrivals'. And with no allocated units to line them up by, the
     Ramsgate arrivals are listed in the order they got in, as everywhere. */
  const { tab } = await week("03/08/26", "04/08/26");
  const t = tab("Tue 04 08");
  const a = t.row("AZ620", "06+00"), b = t.row("AZ621", "07+00");
  assert.equal(a.at("N"), ""); assert.equal(b.at("N"), "");
  assert.deepEqual(["B", "C", "D", "E"].map(c => a.at(c)), ["5R32", "18+50", "395001", "6"],
    "Monday's AZ601 unit, in with its number");
});

test("a working that calls at Strood, Rochester or Gillingham has gone by the North Kent", () => {
  const H = built().SHEETS_HS;
  // "if it calls Strood, Gillingham, Rochester it will go via the North Kent"
  for (const c of ["GRVSEND", "STROOD", "RCHT", "GLNGHMK"]) assert.ok(H.NORTH_KENT.has(c), c);
  assert.equal(H.viaNorthKent("5J99", "FAVRSHM", "GLNGHMK"), true, "ending there, whatever the headcode");
  assert.equal(H.viaNorthKent("1F23", "FAVRSHM", "STPANCI"), true);
  assert.equal(H.viaNorthKent("1J21", "STPANCI", "MARGATE"), false);
  assert.equal(H.viaNorthKent("5F24", "FAVRSHM", "FAVRBRD"), false, "an empty F off the main line");
  // the prints' own names for them
  assert.deepEqual(["Strood", "Roch", "Gill"].map(n => H.PRINT_CODE[n]), ["STROOD", "RCHT", "GLNGHMK"]);
  /* and a print that shows the call is read by it: a J working, which by
     its headcode alone never goes that way, calling at Strood */
  const day = H.dayFromPrint("01/08/26", [{ diag: "AZ601", stops: [
    { loc: "Ashfrd DS", arr: null, dep: 420, hcIn: null, hcOut: "5J01" },
    { loc: "Strood", arr: 480, dep: 490, hcIn: "5J01", hcOut: "5J02" },
    { loc: "Ashfrd DS", arr: 560, dep: null, hcIn: "5J02", hcOut: null }] }]);
  assert.deepEqual(Array.from(day.stops.get("AZ601"), s => s.grv), [true, true, false],
    "both workings touch the North Kent");
});

test("Sunday's reports give Monday its arrivals, though Sunday has no tab of its own", async () => {
  const { sheets, tab } = await week("02/08/26", "03/08/26");
  assert.deepEqual(Array.from(sheets, s => s.name), ["Mon 03 08"]);
  const t = tab("Mon 03 08");
  const h = t.title(/^ASHFORD PM ARRIVALS Sunday 02\/08\/26$/);
  assert.ok(h);
  assert.deepEqual(["B", "C", "D", "E"].map(c => t.at(h + 2, c)), ["5J60", "20+05", "395030", "6"]);
});

test("an end is left blank where the order passes somewhere the sheet cannot follow it", () => {
  const H = built().SHEETS_HS;
  assert.equal(H.reverses("CNTBW", "NOWHERE", "EBSFLTI"), "?", "a station with no sides");
  assert.equal(H.reverses("STFORDI", "STPANCI", "STFORDI"), true, "St Pancras turns everything round");
  assert.equal(H.reverses("MARGATE", "RAMSGTE", "MINSTER"), false, "Ramsgate is a through station");
  assert.equal(H.reverses("EBSFLTI", "ASHFKY", "ASHFDYW"), true, "HS1 into Ashford and back out to the yard");
  // two units coupled from a depot, through a station the table does not know, into Ashford depot
  const S = (code, arr, dep, hcIn, hcOut) => ({ code, name: code, arr, dep, hcIn, hcOut });
  const leg = [S("RAMSGTD", null, 300, null, "5X01"), S("NOWHERE", 320, 330, "5X01", "5X01"),
               S("ASHFKY", 360, 365, "5X01", "5X01"), S("ASHFDYW", 370, 375, "5X01", "5X01"), S("ASHFDNS", 380, null, "5X01", null)];
  const F = H.dayFacts({ date: "03/08/26", stops: new Map([["AZ691", leg], ["AZ692", leg]]),
                         rows: [{ diag: "AZ691", start: 300, pos: 1 }, { diag: "AZ692", start: 300, pos: 2 }] });
  assert.equal(H.arrivalEnd(F, "AZ691", 4), null, "one of a 12, but which end cannot be said");
  assert.ok(F.mate.has("AZ691@3"), "…and still known to be one of a 12");
});

/* A row's record is its column's record with the rules over and under set
   for its place in its run; this gives back the column's own. */
const baseOf = SKIN => {
  const back = new Map();
  for (const [x, v] of Object.entries(SKIN.rowRules)) for (const y of Object.values(v)) back.set(y, +x);
  return xf => back.has(xf) ? back.get(xf) : xf;
};

test("each block's morning allocations sit above its coloured bar, the rest below", async () => {
  const { N, tab } = await week("03/08/26");
  const SKIN = N.SHEETS_HS_SKIN, base = baseOf(SKIN);
  const t = tab("Mon 03 08");
  const am = t.row("AZ601", "06+00"), pm = t.row("AZ601", "16+00");
  /* AZ601's first move off its overnight berth is above the bar; its 16+00,
     back out after a morning return, is below it - their sheet's split. */
  const bar = am.r + 1;
  assert.equal(t.xf(bar, "H"), SKIN.bars.ASHFORD.H, "Ashford's green bar straight after the morning");
  assert.equal(t.xf(bar, "M"), SKIN.bars.ASHFORD.mid);
  assert.equal(t.xf(bar, "T"), SKIN.bars.ASHFORD.T);
  assert.equal(pm.r, bar + 1, "and the afternoon under it");
  assert.ok(t.layout.merges.includes("H" + bar + ":T" + bar), "one merged bar, H to T");
  assert.ok([..."HIJKLMNOPQRST"].every(c => t.at(bar, c) === ""), "with nothing written in it");
  assert.equal(base(t.xf(bar, "B")), SKIN.data.B, "the arrivals table runs on through it, ruled");
  // Ramsgate's is blue, and comes after both halves of the 12
  const b = t.row("AZ612", "05+00").r + 1;
  assert.equal(t.xf(b, "H"), SKIN.bars.RAMSGATE.H, "Ramsgate's own colour");
  assert.notEqual(SKIN.bars.RAMSGATE.H, SKIN.bars.ASHFORD.H);
  /* the MG rule is kept off the bar: Excel reads a blank as 0 and would
     paint it green */
  const k = t.layout.opts.condFmt.map(f => /sqref="([^"]+)"/.exec(f)[1]).join(" ");
  assert.ok(!new RegExp("\\bK" + bar + "\\b").test(k.replace(/K(\d+):K(\d+)/g,
    (m, a, z) => Array.from({ length: z - a + 1 }, (_, i) => "K" + (+a + i)).join(" "))),
    "the bar is not under the MG rule: " + k);
  // the depot's own colour on its title as well
  assert.equal(t.xf(t.title(/^RAMSGATE PM ARRIVALS/), "B"), SKIN.titles.RAMSGATE.B);
});

test("WORKS in G against each morning allocation outside Ashford; Ashford keeps its strip", async () => {
  const { N, tab } = await week("03/08/26");
  const SKIN = N.SHEETS_HS_SKIN, base = baseOf(SKIN);
  const t = tab("Mon 03 08");
  const a = t.row("AZ611", "05+00"), b = t.row("AZ612", "05+00");
  assert.equal(a.at("G"), "WORKS"); assert.equal(b.at("G"), "WORKS");
  assert.equal(a.xf("G"), SKIN.worksG.first, "the first of the run ruled over the top");
  assert.equal(b.xf("G"), SKIN.worksG.last, "the last ruled under");
  assert.equal(t.xf(b.r + 1, "G"), SKIN.plainG, "nothing on the bar row");
  const ash = t.row("AZ601", "06+00");
  assert.equal(ash.at("G"), "", "Ashford's G is the grey strip, with nothing in it");
  assert.equal(base(ash.xf("G")), SKIN.data.G);
});

test("N/M, the WORKS headcode and the working it names are marked yellow", async () => {
  const { N, tab } = await week("03/08/26");
  const SKIN = N.SHEETS_HS_SKIN, base = baseOf(SKIN);
  const t = tab("Mon 03 08");
  const am = t.row("AZ601", "06+00"), pm = t.row("AZ601", "16+00");
  const yellow = x => /background:#FFFF00/.test(SKIN.xfCss[x]);
  assert.equal(am.at("J"), "N/M"); assert.equal(base(am.xf("J")), SKIN.flag);
  assert.ok(yellow(am.xf("J")), "N/M on yellow");
  assert.equal(am.at("T"), "5R30"); assert.equal(base(am.xf("T")), SKIN.worksT);
  assert.ok(yellow(am.xf("T")), "the working it goes back out on, on yellow");
  assert.equal(pm.at("H"), "5R30 AFK"); assert.equal(base(pm.xf("H")), SKIN.laterH);
  assert.ok(yellow(pm.xf("H")), "and that working's own train ID, on yellow");
  assert.equal(base(am.xf("H")), SKIN.data.H, "a first move is not marked");
  assert.equal(base(pm.xf("T")), SKIN.data.T, "nor an empty WORKS");
  assert.equal(base(t.row("AZ611", "05+00").xf("J")), SKIN.flag, "M/O too");
});

test("the MG column reads High, Average and Low, as the key above it does", () => {
  const N = built();
  const H = N.SHEETS_HS, SKIN = N.SHEETS_HS_SKIN;
  // the planner's own bands: up to 400 green, 400 to 700 amber, 700 on red
  for (const [n, band] of [[0, "Low"], [399, "Low"], [400, "Average"], [699, "Average"],
                           [700, "High"], [1012, "High"]])
    assert.equal(H.mgBand(n).band, band, n + " miles");
  assert.deepEqual(Array.from(SKIN.mg, b => b.band), ["High", "Average", "Low"],
    "High first, so Excel's priority settles 700 the same way");
  // the key sits under the notes now, a swatch = a word on each line
  const words = Array.from(SKIN.footer, l => l[3]);
  for (const w of ["High", "Average", "Low"]) assert.ok(words.includes(w), w);
  assert.ok(!words.concat(Array.from(SKIN.legend, l => l[3])).some(w => /500 Miles/.test(w)),
    "the old two-colour key is gone");
  // the CET key's second line: YES under each of its three day counts
  const yes = Array.from(SKIN.footer).filter(f => f[3] === "YES").map(f => f[1]);
  assert.deepEqual(yes, ["D", "E", "F"], "YES in each of the three coloured cells");
});

test("each table is boxed in a bold rule, with thin ones inside", async () => {
  const { N, tab } = await week("03/08/26");
  const SKIN = N.SHEETS_HS_SKIN;
  const t = tab("Mon 03 08");
  const rule = (r, c, side) => ((SKIN.xfCss[t.xf(r, c)] || "").match(new RegExp("border-" + side + ":(\\d)px")) || [])[1] || "0";
  /* Ramsgate: AZ611 and AZ612 are the morning's two - the first ruled bold
     over the top, the second bold underneath, thin between them - then the
     bar. The arrivals beside them run on through the bar as one box. */
  const a = t.row("AZ611", "05+00").r, b = t.row("AZ612", "05+00").r;
  for (const c of "HIJKLMNOPQRST") {
    assert.equal(rule(a, c, "top"), "2", c + a + " bold over the top of the box");
    assert.equal(rule(a, c, "bottom"), "1", c + a + " thin inside");
    assert.equal(rule(b, c, "top"), "1", c + b + " thin inside");
    assert.equal(rule(b, c, "bottom"), "2", c + b + " bold under the morning's box");
  }
  assert.equal(rule(a, "H", "left"), "2", "bold down the left side");
  assert.equal(rule(a, "T", "right"), "2", "and the right");
  assert.equal(rule(b, "B", "bottom"), "1", "the arrivals box does not close at AZ612");
  assert.equal(rule(b + 1, "B", "bottom"), "2", "it closes on its last line, the bar's");
  assert.equal(rule(b + 1, "B", "left"), "2", "bold down its left side");
  assert.equal(rule(b + 1, "F", "right"), "2", "and its right");
  /* Ashford: one line either side of its bar, each boxed on its own */
  const am = t.row("AZ601", "06+00").r, pm = t.row("AZ601", "16+00").r;
  for (const r of [am, pm]) for (const side of ["top", "bottom"])
    assert.equal(rule(r, "K", side), "2", "a run of one is boxed all round: K" + r + " " + side);
  assert.equal(rule(pm, "G", "bottom"), "2", "the grey strip closes with the block");
  assert.equal(rule(am, "G", "bottom"), "0", "and has no rules across it before then");
});

test("the bar closes the morning run-out: 5R27 at 09 54 and a first move at 10 05 both go under it, in time order", () => {
  const N = built();
  const H = N.SHEETS_HS, SKIN = N.SHEETS_HS_SKIN;
  const e = (time, headcode, diag, overnight) => ({ time, time_kind: "ecs", dest: "AFK",
    headcode, overnight, units: [{ diag, code: "AZ", am: "", pm: "AFK", ends: "AFK PM",
                                   mg: 100, miles: 100 }] });
  const day = key => ({ [key]: new Map([["ASHFORD", [
    e(15 * 60 + 35, "5L47", "625", false), e(10 * 60 + 5, "5J25", "625", true),
    e(9 * 60 + 54, "5R27", "623", false), e(5 * 60 + 58, "5R07", "610", true)]]]) });
  const order = key => {
    const lay = H.layoutDay(key, { [key]: "02/10/26" }, day(key), null);
    const out = [];
    // from under the title and the column headings
    for (let r = SKIN.firstRow + 2; r < lay.maxRow; r++) {
      const at = c => (lay.cells.find(x => x.r === r && x.c === c) || {});
      if (at(9).v === H.STOPPED.title) break;      // the block is over
      if (at(8).xf === SKIN.bars.ASHFORD.H) out.push("BAR");
      else if (at(9).v) out.push(at(12).v);
    }
    return out;
  };
  /* Thursday 01/10 on their sheet: the run-out, the bar, then 5R27 at 09 54
     and 5J25 at 10 05. On Friday AZ625 berths at Ashford and its 10 05 is
     its first move of the day - it still goes under the bar, as the planner
     asked and 45 of their weekday tabs have it. */
  assert.deepEqual(order("F"), ["05+58", "BAR", "09+54", "10+05", "15+35"]);
  // a Saturday runs out later: its 10 05 first move is still the morning
  assert.deepEqual(order("SA"), ["05+58", "10+05", "BAR", "09+54", "15+35"]);
});

test("the text is in each depot's colour, and where a unit gets to in that place's", async () => {
  /* As the depot's own tabs keep it: a block's workings in its depot's
     colour - Ashford green, Faversham red, Ramsgate blue, Margate purple -
     and ENDS AM, ENDS PM and the working out of a return in the colour of
     the place reached, St Pancras in the workbook's orange. N/M M/O, MG and
     the unit columns keep their own. */
  const { N, tab, sheets, r } = await week("03/08/26");
  const t = tab("Mon 03 08");
  const L = sheets.find(s => s.name === "Mon 03 08").layout;
  const COLS = "ABCDEFGHIJKLMNOPQRST";
  const fc = (row, c) => (L.cells.find(x => x.r === row && COLS[x.c - 1] === c) || {}).fc || null;
  const am = t.row("AZ601", "06+00").r, pm = t.row("AZ601", "16+00").r, ram = t.row("AZ611", "05+00").r;
  for (const c of "HILM") assert.equal(fc(am, c), "00B050", "Ashford's own, " + c);
  for (const c of "HILM") assert.equal(fc(ram, c), "0070C0", "Ramsgate's own, " + c);
  assert.equal(t.at(am, "O"), "ASH"); assert.equal(fc(am, "O"), "00B050"); assert.equal(fc(am, "P"), "00B050");
  assert.equal(t.at(am, "T"), "5R30"); assert.equal(fc(am, "T"), "00B050", "back out of Ashford");
  assert.equal(t.at(pm, "Q"), "RAM");
  for (const c of "QRS") assert.equal(fc(pm, c), "0070C0", "ends at Ramsgate, " + c);
  assert.equal(t.at(ram, "O"), "SPX"); assert.equal(fc(ram, "O"), "C55A11", "St Pancras orange");
  assert.equal(t.at(ram, "Q"), "ASH"); assert.equal(fc(ram, "Q"), "00B050");
  for (const c of "JKN") assert.equal(fc(am, c), null, c + " keeps its own");
  // the saved book carries them: a copy of each record with its font recoloured
  const bytes = N.SHEETS_HS.writeHsBook(r.hsSecs, r.labels, r.dates, f => N.fflate.zipSync(f), r.hsDays);
  const files = N.fflate.unzipSync(bytes);
  const styles = new TextDecoder().decode(files["xl/styles.xml"]);
  for (const c of ["FF0070C0", "FFC55A11", "FF00B050"]) assert.ok(styles.includes('<color rgb="' + c + '"/>'), c);
  const xfN = +/<cellXfs count="(\d+)"/.exec(styles)[1];
  assert.equal((styles.match(/<cellXfs[\s\S]*?<\/cellXfs>/)[0].match(/<xf /g) || []).length, xfN, "the count is right");
  const sheet = new TextDecoder().decode(files["xl/worksheets/sheet1.xml"]);
  const used = [...sheet.matchAll(/ s="(\d+)"/g)].map(m => +m[1]);
  assert.ok(used.every(s => s < xfN), "every cell names a record that is there");
  const wb = await normalizeWorkbook(legacy(), bytes);
  assert.ok(wb.length >= 1 && wb[0].cells.length > 20, "and a real parser reads it");
});

test("REQUIRED is the day's diagrams AM and PM, OFFERED goes red under it, and sanding takes a unit and colours its miles", async () => {
  /* Their sheet: SERVICE TRAINS REQUIRED AM / PM reads "22 / 24" for Friday
     02/10 - of the day's 25 diagrams, those out before midday and those
     still running after it; AZ622 is stabled all day and in none of its
     tables. The planner types OFFERED, AM and PM, and either figure goes
     red (the number, not the box) when it is fewer than its REQUIRED. The
     sanding table beside the blocks takes a unit off the fleet list and its
     miles: up to 6,000 green, 6,000-6,999 amber, 7,000 red. */
  const { N, sheets, r } = await week("03/08/26");
  const H = N.SHEETS_HS, SKIN = N.SHEETS_HS_SKIN;
  const L = sheets.find(s => s.name === "Mon 03 08").layout;
  const cell = (lay, ref) => { const m = /^([A-Z])(\d+)$/.exec(ref);
    return lay.cells.find(x => x.r === +m[2] && x.c === m[1].charCodeAt(0) - 64) || {}; };
  const R = SKIN.service.required, O = SKIN.service.offered;
  assert.deepEqual({ ...R }, { am: "M3", pm: "N3" }, "an AM cell and a PM cell");
  assert.ok(!SKIN.legendMerges.includes("M3:N3") && !SKIN.legendMerges.includes("M4:N4"),
    "no longer merged into one");
  const day = r.hsDays["03/08/26"];
  let am = 0, pm = 0;
  for (const st of day.stops.values()) {
    const f = st.find(s => s.dep != null);
    if (!f) continue;
    const z = st[st.length - 1], end = z.arr != null ? z.arr : z.dep;
    if (f.dep % 1440 < 720) am++;
    if (end >= 720 || f.dep >= 720) pm++;
  }
  assert.ok(am > 0 && pm > 0);
  assert.equal(cell(L, R.am).v, String(am), "AM: out before midday");
  assert.equal(cell(L, R.pm).v, String(pm), "PM: still running after it");
  assert.ok(cell(L, R.am).num && cell(L, R.pm).num, "numbers, for the rule to compare");
  assert.equal(cell(L, R.am).disp, am + " /", "the preview reads it as the sheet does: 22 / 24");
  const xfs = SKIN.stylesXml.match(/<cellXfs[\s\S]*<\/cellXfs>/)[0].match(/<xf [^>]*?(?:\/>|>[\s\S]*?<\/xf>)/g);
  const fmt = id => new RegExp('numFmtId="' + /numFmtId="(\d+)"/.exec(xfs[id])[1] + '" formatCode="([^"]*)"').exec(SKIN.stylesXml)[1];
  assert.equal(fmt(cell(L, R.am).xf), "0&quot; /&quot;", "the AM figure shows as 22 /");
  assert.match(fmt(cell(L, R.pm).xf), /^&quot; &quot;0;/, "and the PM one beside it");
  for (const ref of [O.am, O.pm]) assert.equal(cell(L, ref).v, "", "OFFERED is the planner's");
  for (const k of ["spare", "stabled"]) assert.equal(cell(L, SKIN.service[k]).v, "", k);
  assert.match(cell(L, SKIN.service.stopped).f, /^COUNTA\(/, "STOPPED counts its table (below)");
  // with no stops to read, by the first move off a depot, and every diagram for the PM
  const bare = H.sheetsFor(r.hsSecs, r.labels, r.dates).find(s => s.name === "Mon 03 08").layout;
  const onSheet = new Set(bare.cells.filter(c => c.c === 9 && /^AZ\d+$/.test(c.v)).map(c => c.v)).size;
  assert.equal(cell(bare, R.pm).v, String(onSheet));

  const cf = L.opts.condFmt.join("");
  assert.ok(cf.includes('<conditionalFormatting sqref="M4:N4"><cfRule type="expression" dxfId="' +
    SKIN.short.dxf + '"') && cf.includes("AND(ISNUMBER(M4),ISNUMBER(M3),M4&lt;M3)"),
    "each OFFERED figure red when fewer than its REQUIRED - relative, so N4 tests N3 - and only when both are figures");
  const dxfs = /<dxfs count="4">([\s\S]*)<\/dxfs>/.exec(SKIN.stylesXml)[1].match(/<dxf>[\s\S]*?<\/dxf>/g);
  assert.equal(dxfs[SKIN.short.dxf], '<dxf><font><color rgb="FFFF0000"/></font></dxf>',
    "the number in red - no fill, so not the box");

  // the sanding table: its title on the first block's heading row, then 29 rows
  assert.equal(cell(L, "W10").v, "SANDING");
  assert.equal(cell(L, "W11").v, "UNIT NO"); assert.equal(cell(L, "Y11").v, "MILES");
  for (const m of ["W10:Z10", "W11:X11", "Y11:Z11", "W12:X12", "Y12:Z12", "W40:X40", "Y40:Z40"])
    assert.ok(L.merges.includes(m), m);
  assert.ok(L.maxRow > 40 && L.opts.lastCol === "Z", "the sheet runs out to the table");
  assert.match(L.opts.dataValidations, /sqref="[^"]* W12:W40"><formula1>"395001,/,
    "a unit off the fleet list");
  const sand = /<conditionalFormatting sqref="Y12:Z40">([\s\S]*?)<\/conditionalFormatting>/.exec(cf);
  assert.ok(sand, "the miles are coloured");
  const rules = [...sand[1].matchAll(/dxfId="(\d)"[^>]*><formula>(.*?)<\/formula>/g)].map(m => [+m[1], m[2]]);
  assert.deepEqual(rules, [
    [0, "AND(ISNUMBER($Y12),$Y12&gt;=7000)"],
    [1, "AND(ISNUMBER($Y12),$Y12&gt;=6000,$Y12&lt;7000)"],
    [2, "AND(ISNUMBER($Y12),$Y12&lt;6000)"]], "red, amber, green - and an empty cell left white");
  assert.deepEqual(Array.from(SKIN.mg, b => b.band), ["High", "Average", "Low"],
    "dxf 0, 1, 2 are the key's red, amber and green");
  for (const [n, dxf] of [[0, 2], [5999, 2], [6000, 1], [6999, 1], [6999.5, 1], [7000, 0], [9100, 0]])
    assert.equal(H.SANDING_BANDS.find(b => b.at(n)).dxf, dxf, n + " miles");
});

test("STOPPED UNITS sits under Ashford's block: a red bar over four lines of two halves", async () => {
  /* As the planner's own sheet has it from 02/10: a row clear of Ashford's
     last allocation, STOPPED UNITS on red across I to S, then four lines
     split I:N and O:S, each half a unit off the fleet list - and the next
     depot's block a row clear of the table. */
  const { N, sheets } = await week("03/08/26");
  const H = N.SHEETS_HS, SKIN = N.SHEETS_HS_SKIN;
  const L = sheets.find(s => s.name === "Mon 03 08").layout;
  const at = (r, c) => L.cells.find(x => x.r === r && x.c === c.charCodeAt(0) - 64) || {};
  const titles = L.cells.filter(c => c.v === H.STOPPED.title);
  assert.equal(titles.length, 1, "one table, under the first block only");
  const top = titles[0].r;
  assert.equal(titles[0].c, 9, "from column I");
  // Ashford's last allocation two rows above, nothing written between
  let lastAsh = 0;
  for (const c of L.cells) if (c.c === 9 && /^AZ\d+$/.test(c.v) && c.r < top) lastAsh = Math.max(lastAsh, c.r);
  assert.equal(top, lastAsh + 2, "a row clear of the last allocation");
  assert.ok(/background:#FF0000/.test(SKIN.xfCss[at(top, "I").xf]), "on red");
  assert.ok(/font-weight:700/.test(SKIN.xfCss[at(top, "I").xf]), "in bold");
  assert.ok(L.merges.includes("I" + top + ":S" + top), "the bar across I to S");
  for (let i = 1; i <= 4; i++) {
    assert.ok(L.merges.includes("I" + (top + i) + ":N" + (top + i)) &&
              L.merges.includes("O" + (top + i) + ":S" + (top + i)), "line " + i + " in two halves");
    assert.equal(at(top + i, "I").v, "", "for the planner to fill in");
  }
  const rule = (r, c, side) => ((SKIN.xfCss[at(r, c).xf] || "").match(new RegExp("border-" + side + ":(\\d)px")) || [])[1] || "0";
  assert.equal(rule(top + 1, "I", "left"), "2", "bold down the outside");
  assert.equal(rule(top + 4, "S", "bottom"), "2", "and along the bottom");
  assert.equal(rule(top + 2, "K", "bottom"), "1", "thin between the lines");
  assert.equal(rule(top + 2, "N", "right"), "1", "and between the halves");
  assert.match(L.opts.dataValidations, new RegExp("I" + (top + 1) + ":I" + (top + 4) + " O" + (top + 1) + ":O" + (top + 4)),
    "each half takes a unit off the fleet list");
  const next = L.cells.filter(c => / UNIT ALLOCATIONS /.test(c.v) && c.r > top).map(c => c.r)[0];
  assert.equal(next, top + 4 + 2, "the next block a row clear of the table");
  /* TOTAL STOPPED, in the service table, counts the units written in it */
  const f = "COUNTA(I" + (top + 1) + ":I" + (top + 4) + ",O" + (top + 1) + ":O" + (top + 4) + ")";
  const total = at(+SKIN.service.stopped.slice(1), SKIN.service.stopped[0]);
  assert.equal(total.f, f, "a count of both halves");
  assert.equal(total.v, "0", "nought as built");
  const { r } = await week("03/08/26");
  const bytes = H.writeHsBook(r.hsSecs, r.labels, r.dates, z => N.fflate.zipSync(z), r.hsDays);
  const xml = new TextDecoder().decode(N.fflate.unzipSync(bytes)["xl/worksheets/sheet1.xml"]);
  assert.match(xml, new RegExp('<c r="' + SKIN.service.stopped + '" s="\\d+"><f>' +
    f.replace(/[()]/g, "\\$&") + "</f><v>0</v></c>"), "saved as a formula, with its figure");
});
