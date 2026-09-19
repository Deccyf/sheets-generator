/* Sanity checks on the built artifact itself. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BUILT, built } from "./helpers/compare.mjs";

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
  assert.ok(html.length < 900 * 1024,
    "under 900 KB (was 1.2 MB); this build is " +
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
