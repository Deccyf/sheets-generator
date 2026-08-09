/* Browser smoke test: load the built file in Chromium, feed both panels
   through the real file inputs, and screenshot the results. */
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
const dir = mkdtempSync(join(tmpdir(), "sheets-smoke-"));
const f = (name, bytes) => { const p = join(dir, name); writeFileSync(p, bytes); return p; };
const sumPdf = f("Diagram Summary.pdf", makePdf(SUMMARY_LINES, ctx.fflate));
const detPdf = f("Diagram Detail.pdf", makePdf(DETAIL_LINES, ctx.fflate));
const prints = f("WEEKEND PRINTS.docx", makeDocx(PRINTS_LINES, ctx.fflate));
const reissue = f("WEEKEND PRINTS reissue.docx", makeDocx(REISSUE_LINES, ctx.fflate));

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage({ viewport: { width: 860, height: 1100 } });
page.on("pageerror", e => { console.error("PAGE ERROR:", e.message); process.exitCode = 1; });
page.on("console", m => { if (m.type() === "error") console.error("CONSOLE:", m.text()); });
await page.goto("file://" + BUILT.replace(/ /g, "%20"));

// Weekday: drop both PDFs at once (exercises the sequential queue).
await page.setInputFiles("#file", [sumPdf, detPdf]);
await page.waitForFunction(() =>
  document.querySelector("#status").textContent.includes("Books built"), null, { timeout: 20000 });
console.log("weekday status:", await page.textContent("#status"));
console.log("weekday roads:", await page.locator("#roads .road").count());
await page.locator("#roads .road .btn", { hasText: "Look at it" }).first().click();
await page.waitForSelector("#roads .road .view table.sheet");
console.log("weekday preview table rendered ✓");

// Weekend: prints then reissue in a second drop.
await page.setInputFiles("#we_file", [prints]);
await page.waitForFunction(() =>
  document.querySelector("#we_status").textContent.includes("Berthed"), null, { timeout: 20000 });
await page.setInputFiles("#we_file", [reissue]);
await page.waitForFunction(() =>
  document.querySelector("#we_status").textContent.includes("Reissue cross-referenced"), null, { timeout: 20000 });
console.log("weekend status:", await page.textContent("#we_status"));
console.log("updated-prints button hidden:", await page.locator("#we_dlupd").isHidden());
await page.locator("#we_roads .road .btn", { hasText: "Look at it" }).first().click();
await page.waitForSelector("#we_roads .road .view table.sheet");
console.log("weekend preview table rendered ✓");
console.log("lineup sprites:", await page.locator("#lineup svg").count());
console.log("version line:", await page.textContent("#ver"));

await page.screenshot({ path: "tools/smoke-top.png", clip: { x: 0, y: 0, width: 860, height: 900 } });
await page.locator("#roads").scrollIntoViewIfNeeded();
await page.screenshot({ path: "tools/smoke-weekday.png" });
await page.locator("#we_roads").scrollIntoViewIfNeeded();
await page.screenshot({ path: "tools/smoke-weekend.png" });
await browser.close();
console.log("SMOKE OK");
