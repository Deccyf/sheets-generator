/* Browser check: the Genius CSV exports go in through the real drop zone. */
import { writeFileSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { geniusSummaryCsv, geniusDetailCsv } from "../test/helpers/synth.mjs";
import { BUILT_URL, launch } from "./browser.mjs";

const dir = mkdtempSync(join(tmpdir(), "sheets-gcsv-"));
const f = (n, t) => { const p = join(dir, n); writeFileSync(p, t, "utf8"); return p; };
const sum = f("udiagsum.csv", geniusSummaryCsv());
const det = f("diagdet.csv", geniusDetailCsv());

const browser = await launch();
const page = await browser.newPage({ viewport: { width: 900, height: 1000 } });
page.on("pageerror", e => { console.error("PAGE ERROR:", e.message); process.exitCode = 1; });
await page.goto(BUILT_URL);
await page.setInputFiles("#file", [sum]);
await page.waitForFunction(() =>
  document.querySelector("#status").textContent.includes("loaded"), null, { timeout: 10000 });
console.log("after the summary:", await page.textContent("#status"));
await page.setInputFiles("#file", [det]);
await page.waitForFunction(() =>
  document.querySelector("#status").textContent.includes("Books built"), null, { timeout: 20000 });
console.log("after the detail :", await page.textContent("#status"));
console.log("roads:", await page.locator("#roads .road").count());
await browser.close();
console.log("GENIUS CSV SMOKE OK");
