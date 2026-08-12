import { writeFileSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadSandbox } from "../test/helpers/sandbox.mjs";
import { makePdf, makeDocx, SUMMARY_LINES, DETAIL_LINES, PRINTS_LINES,
         REISSUE_LINES } from "../test/helpers/synth.mjs";
import { BUILT, BUILT_URL, launch } from "./browser.mjs";
const ctx = loadSandbox(BUILT);
const dir = mkdtempSync(join(tmpdir(), "sheets-shots-"));
const f = (n, b) => { const p = join(dir, n); writeFileSync(p, b); return p; };
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 860, height: 980 } });
await page.goto(BUILT_URL);
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
