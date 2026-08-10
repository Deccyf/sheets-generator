/* Sanity checks on the built artifact itself. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BUILT, built } from "./helpers/compare.mjs";

test("the built file is self-contained and lean", () => {
  const html = readFileSync(BUILT, "utf8");
  assert.ok(html.length < 400 * 1024, "under 400 KB (was 1.2 MB)");
  assert.ok(!/src="https?:|href="https?:|fetch\(|XMLHttpRequest/.test(html),
    "no external references");
  assert.ok(!html.includes("/*! ExcelJS"), "ExcelJS bundle is gone");
  assert.ok(!html.includes("pako_inflate.umd"), "pako bundle is gone");
  assert.match(html, /id="lineup"/, "fleet lineup present");
  assert.match(html, /Class 395 Javelin/, "sprites present");
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
