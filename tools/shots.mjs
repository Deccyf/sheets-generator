import { createRequire } from "node:module";
import { writeFileSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { loadSandbox } from "../test/helpers/sandbox.mjs";
import { makePdf, makeDocx, SUMMARY_LINES, DETAIL_LINES, PRINTS_LINES,
         REISSUE_LINES } from "../test/helpers/synth.mjs";
const require = createRequire("/opt/node22/lib/node_modules/playwright/");
const { chromium } = require("playwright");
const BUILT = fileURLToPath(new URL("../Sheets Generator.html", import.meta.url));
const ctx = loadSandbox(BUILT);
const dir = mkdtempSync(join(tmpdir(), "sheets-shots-"));
const f = (n, b) => { const p = join(dir, n); writeFileSync(p, b); return p; };
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage({ viewport: { width: 860, height: 980 } });
await page.goto("file://" + BUILT.replace(/ /g, "%20"));
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(200);
await page.screenshot({ path: "tools/shot-1-header.png" });
await page.setInputFiles("#file",
  [f("Diagram Summary.pdf", makePdf(SUMMARY_LINES, ctx.fflate)),
   f("Diagram Detail.pdf", makePdf(DETAIL_LINES, ctx.fflate))]);
await page.waitForFunction(() =>
  document.querySelector("#status").textContent.includes("Books built"));
await page.locator("#roads .road .btn", { hasText: "Look at it" }).first().click();
await page.waitForSelector("#roads .road .view table.sheet");
await page.locator("#roads .road").first().scrollIntoViewIfNeeded();
await page.waitForTimeout(250);
await page.screenshot({ path: "tools/shot-2-weekday.png" });
await page.setInputFiles("#we_file", [f("WEEKEND PRINTS.docx", makeDocx(PRINTS_LINES, ctx.fflate))]);
await page.waitForFunction(() =>
  document.querySelector("#we_status").textContent.includes("Berthed"));
await page.setInputFiles("#we_file", [f("WEEKEND PRINTS reissue.docx", makeDocx(REISSUE_LINES, ctx.fflate))]);
await page.waitForFunction(() =>
  document.querySelector("#we_status").textContent.includes("Reissue"));
await page.locator("#we_roads .road .btn", { hasText: "Look at it" }).first().click();
await page.waitForSelector("#we_roads .road .view table.sheet");
await page.locator("#we_roads .road").first().scrollIntoViewIfNeeded();
await page.waitForTimeout(250);
await page.screenshot({ path: "tools/shot-3-weekend.png" });
await browser.close();
console.log("shots done");
