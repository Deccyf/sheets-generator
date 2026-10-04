/* Sanity checks on the built artifact itself. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { BUILT, built } from "./helpers/compare.mjs";
import { loadSandbox } from "./helpers/sandbox.mjs";

test("the built file is self-contained and lean", () => {
  const html = readFileSync(BUILT, "utf8");
  /* A size cap, not a size target. What it is really guarding against is a
     library bundle creeping back in - ExcelJS alone was most of the 1.2 MB
     this file used to be, and those two are named on their own below. The
     ceiling is set with room for a feature or two above where the file
     actually sits, so that adding one is a decision rather than a test
     failure, and doubling it is still impossible without noticing. */
  /* 600 KB since the 395 skin began carrying its style records as CSS as
     well as XML (~16 KB): the preview named an exact style record per cell
     and had only the coarse house look to draw with, so the sheet on screen
     looked nothing like the workbook it previews. A deliberate feature, and
     the ceiling moved once for it rather than being nudged each build. */
  /* 660 KB since the stock requirements form began shipping the blank
     workbook's own styleSheet verbatim (~21 KB), the same way the 395
     skin ships its document's records - the price of the form being the
     depot's own, cell for cell, rather than a lookalike. */
  /* 700 KB at 3.1.3, and this one is not a feature: three releases of
     ordinary fixes ate the last of the 660 headroom a few hundred bytes at
     a time, and the ceiling is meant to sit ABOVE the file with room in it,
     or the next one-line fix fails this test instead of being a decision.
     Nothing here is a bundle - the two that matter are named below, and the
     file is still roughly half what it was when they were in it. */
  /* 760 KB since the shortages and variations road came in (~35 KB): a
     third report read, a third panel, and the leg/occurrence walk that
     traces a variation through every diagram sharing a working. It brought
     no library with it - it had its own copy of the PDF extractor and its
     own fflate, and both were dropped for the ones already here. */
  /* 800 KB at 3.4.0: the berth-request road - a fourth tab, its plan
     reader, the depot's rules, the standing fleet moves and the plan given
     back as a coloured table - is ~25 KB, and the ceiling is meant to sit
     above the file with room in it rather than be nudged each build. */
  /* 860 KB at 3.6.0: the berth-request road grew by the swap search across
     every diagram's day, the defects export reader and the rulebook that
     writes out each rule as the depot gave it (~35 KB over 3.4.0). The
     rulebook is the largest single piece and is prose, not code: it is what
     lets the planner check a suggestion against the rule that made it. */
  /* 900 KB at 3.8.0: the berth-request road now reads the weekend diagram
     prints as a Detail, takes a day still to run, places a unit off the
     plan's own Action, and lays the shortages list out for the Excel text
     box (~35 KB over 3.6.0). Still no library: the prints reader and the
     weekend engine's parser were already here and are called, not copied. */
  /* 950 KB at 3.8.3: the berth-request road answers in two legs, takes the
     standing fleet moves as requests and says why a line got none (~25 KB
     over 3.8.0), and the how-to names all four tabs. Still no library. The
     copy without that road is ~140 KB smaller, and is what most people
     open. */
  /* 1000 KB at 3.15.0: the plan goes back in the workbook's own dress - each
     control document's fonts, fills, borders and row heights carried as a
     style record per cell, for the preview, the clipboard and the Excel
     file alike (~15 KB over 3.14.0, most of it the two skins). No library:
     the workbook writer already here takes a raw stylesheet. */
  /* 1100 KB at 3.16.0: the High Speed disposition statement is a third
     control document, and it brings its own dress the same way (~60 KB of
     style records, the largest of the three because that tab is a hundred
     records deep) plus the road that reads it. The copy without the
     berth-request road carries none of it. */
  /* 1150 KB at 3.18.1: the 395 allocations sheet's tables are boxed in a
     bold rule with thin ones inside, as the depot's are, so each data
     record ships in the four places a row can have in its run (~15 KB of
     skin, trimmed back from ~21 KB by writing it without the indentation). */
  /* 1200 KB at 3.24.0: the October template - the service-trains table,
     Done to Genius and the sanding table - brings its own records (~9 KB of
     skin, less the ~1 KB of theme-font and unused fill markup it no longer
     carries). */
  /* 1300 KB at 3.32.1: the base diagrams' tab, the weekend's High Speed
     arrivals, the wording passes, the sanding switch and the variations'
     paste boxes took the file to 1198 KB - against a ceiling of 1200 that
     the next change of any size would break. Nothing in it is waste: the
     largest single parts are the two workbook skins (155 KB) and the how-to's
     screenshots (81 KB, already JPEG). If the file has to get smaller, the
     skins can travel deflated and be inflated by the bundled fflate when the
     page opens - about 100 KB - at the cost of a build step. */
  /* 1150 KB at 3.32.2: the skins now travel packed (see the test below and
     PACKED in build.mjs), which took the file from 1197 KB to 1062, so the
     ceiling comes back down to sit just above it again. */
  assert.ok(html.length < 1150 * 1024,
    "under 1150 KB; this build is " +
    Math.round(html.length / 1024) + " KB");
  assert.ok(!/src="https?:|href="https?:|fetch\(|XMLHttpRequest/.test(html),
    "no external references");
  assert.ok(!html.includes("/*! ExcelJS"), "ExcelJS bundle is gone");
  assert.ok(!html.includes("pako_inflate.umd"), "pako bundle is gone");
  assert.match(html, /id="lineup"/, "fleet lineup present");
  assert.match(html, /Class 395 Javelin/, "sprites present");
});

test("the page says which build it is", () => {
  /* Once this file is emailed round, synced, and put on SharePoint there is
     no other way to tell which copy somebody has open. A fix reported as
     "still wrong" is usually an old copy, and without a stamp on the page
     that costs a round trip every time to establish. */
  const html = readFileSync(BUILT, "utf8");
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  assert.ok(html.includes(">" + pkg.version + "<"),
    "the version from package.json reaches the page: " + pkg.version);
  assert.ok(pkg.released && html.includes(pkg.released),
    "and so does the release date: " + pkg.released);
  /* A placeholder that stops being substituted would print as itself, and
     the page would still look fine at a glance. */
  assert.ok(!/\{\{[A-Z_]+\}\}/.test(html),
    "no build placeholder was left unsubstituted");
});

test("the analyser says which build it is, with a stamp of its own", () => {
  /* The same check for the second deliverable, against package.json's
     `analyser` block: two different files with two different histories, so
     a fault reported against "version 2.6" has to name one of them. */
  const html = readFileSync(new URL("../Diagram Analyser.html", import.meta.url), "utf8");
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  const a = pkg.analyser;
  assert.ok(a && a.version && a.released, "package.json carries an analyser block");
  assert.ok(html.includes(">" + a.version + "<"),
    "the analyser version reaches its page: " + a.version);
  assert.ok(html.includes(a.released),
    "and so does its release date: " + a.released);
  assert.ok(!/\{\{[A-Z_]+\}\}/.test(html),
    "no build placeholder was left unsubstituted");
});

test("the copy without the berth-request road leaves out its tab, its panel and its module, and comes up clean", () => {
  const lite = new URL("../Sheets Generator (no berth requests).html", import.meta.url);
  const html = readFileSync(lite, "utf8");
  const full = readFileSync(BUILT, "utf8");
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  // the UI's own references to the module stay, behind the guard that returns when the panel is absent
  assert.ok(!/id="mode_br"|id="brPanel"|(const|let|var|window\.)\s*SHEETS_BERTH\s*=/.test(html), "no tab, no panel, no module");
  assert.ok(html.length < full.length, "and it is the smaller file");
  assert.ok(html.includes(">" + pkg.version + "<"), "stamped with the same version as the full copy");
  assert.match(html, /id="mode_sv"/, "the other three tabs are there");
  assert.ok(!/\{\{[A-Z_]+\}\}/.test(html), "no build placeholder was left unsubstituted");
  const ctx = loadSandbox(fileURLToPath(lite));
  for (const name of ["SHEETS_DATA", "SHEETS_CORE", "GENIUS", "SHEETS_SHORTAGE", "SheetsEngine"])
    assert.ok(ctx[name], name + " loaded");
  assert.equal(ctx.SHEETS_BERTH, undefined, "the berth-request module is not in it");
});

test("all modules come up in a clean context", () => {
  const ctx = built();
  for (const name of ["SHEETS_DATA", "SHEETS_CORE", "SHEETS_RULEBOOK",
                      "SHEETS_XLSX", "SheetsEngine", "GENIUS", "fflate"]) {
    assert.ok(ctx[name], name + " loaded");
  }
});

test("core keeps only what the live pipelines use", () => {
  const html = readFileSync(BUILT, "utf8");
  for (const dead of ["parseWorkbookGrid", "buildDaySections", "workbookToGrid",
                      "isFridayGrid", "docHealth", "_consumersOrphan"]) {
    assert.ok(!html.includes(dead), "dead symbol removed: " + dead);
  }
});

test("the two workbook skins travel packed, and unpack to exactly what src/ holds", () => {
  /* 155 KB of the page was the two skins' style records; the build packs
     them as deflated JSON and the page unpacks them with the bundled
     fflate. What comes out has to be what the lifters wrote, record for
     record - every 395 sheet and disposition statement is drawn from it. */
  const html = readFileSync(BUILT, "utf8");
  assert.ok(!html.includes('"stylesXml": "<?xml'), "no skin left unpacked in the page");
  assert.ok(!/\beval\(/.test(html), "unpacked with JSON.parse, never eval");
  /* the readable file, run as the script it is (the package is "type":
     "module", so require() would read it as an ES module and see nothing) */
  const fromSrc = (file, name) => new Function("module", "globalThis",
    readFileSync(new URL(file, import.meta.url), "utf8") + "\nreturn " + name + ";")({ exports: {} });
  const N = built();
  for (const [file, name] of [["../src/hs-skin.js", "SHEETS_HS_SKIN"],
                              ["../src/hs-disp-skin.js", "SHEETS_HS_DISP_SKIN"]]) {
    const src = fromSrc(file, name);
    assert.deepEqual(JSON.parse(JSON.stringify(N[name])), JSON.parse(JSON.stringify(src)),
      name + " unpacks to the source's object");
  }
});
