/* Browser smoke test: load the built file in Chromium, feed both panels
   through the real file inputs, and screenshot the results. */
import { writeFileSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadSandbox } from "../test/helpers/sandbox.mjs";
import { makePdf, makeDocx, SUMMARY_LINES, DETAIL_LINES, PRINTS_LINES,
         REISSUE_LINES } from "../test/helpers/synth.mjs";
import { BUILT, BUILT_URL, launch } from "./browser.mjs";

const ctx = loadSandbox(BUILT);
const dir = mkdtempSync(join(tmpdir(), "sheets-smoke-"));
const f = (name, bytes) => { const p = join(dir, name); writeFileSync(p, bytes); return p; };
const sumPdf = f("Diagram Summary.pdf", makePdf(SUMMARY_LINES, ctx.fflate));
const detPdf = f("Diagram Detail.pdf", makePdf(DETAIL_LINES, ctx.fflate));
const prints = f("WEEKEND PRINTS.docx", makeDocx(PRINTS_LINES, ctx.fflate));
const reissue = f("WEEKEND PRINTS reissue.docx", makeDocx(REISSUE_LINES, ctx.fflate));

const browser = await launch();
const page = await browser.newPage({ viewport: { width: 860, height: 1100 } });
page.on("pageerror", e => { console.error("PAGE ERROR:", e.message); process.exitCode = 1; });
page.on("console", m => { if (m.type() === "error") console.error("CONSOLE:", m.text()); });
await page.goto(BUILT_URL);

// Weekday: Summary first — the drop zone should start guiding.
await page.setInputFiles("#file", [sumPdf]);
await page.waitForFunction(() =>
  document.querySelector("#berth .berth-txt strong").textContent.includes("Summary loaded"),
  null, { timeout: 10000 });
await page.screenshot({ path: "tools/shot-7-zone.png",
  clip: { x: 0, y: 240, width: 860, height: 330 } });
console.log("zone guidance:", await page.textContent("#berth .berth-txt strong"));
await page.setInputFiles("#file", [detPdf]);
await page.waitForFunction(() =>
  document.querySelector("#status").textContent.includes("Books built"), null, { timeout: 20000 });
console.log("zone reset:", await page.textContent("#berth .berth-txt strong"));
console.log("weekday status:", await page.textContent("#status"));
console.log("weekday roads:", await page.locator("#roads .road").count());
const dl = page.waitForEvent("download", { timeout: 10000 });
await page.locator("#dlall").click();
console.log("save-all zip:", (await dl).suggestedFilename());
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

await page.screenshot({ path: "tools/smoke-top.png", clip: { x: 0, y: 0, width: 860, height: 900 } });
await page.locator("#roads").scrollIntoViewIfNeeded();
await page.screenshot({ path: "tools/smoke-weekday.png" });
await page.locator("#we_roads").scrollIntoViewIfNeeded();
await page.screenshot({ path: "tools/smoke-weekend.png" });
await browser.close();
console.log("SMOKE OK");
