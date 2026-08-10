/* One-off: feed reports that carry Mainline diagrams only, so the Metro and
   High Speed roads come up empty, and screenshot all four roads. */
import { createRequire } from "node:module";
import { writeFileSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { loadSandbox } from "../test/helpers/sandbox.mjs";
import { makePdf, makeDocx, SUMMARY_LINES, DETAIL_LINES, PRINTS_LINES }
  from "../test/helpers/synth.mjs";

const require = createRequire("/opt/node22/lib/node_modules/playwright/");
const { chromium } = require("playwright");
const BUILT = fileURLToPath(new URL("../Sheets Generator.html", import.meta.url));
const ctx = loadSandbox(BUILT);

// keep the GT (mainline) diagrams only
const sum = SUMMARY_LINES.filter(l => !/^G[NH]\d/.test(l));
const det = [];
let keep = true;
for (const l of DETAIL_LINES) {
  const m = /^Diagram (G[TNH])/.exec(l);
  if (m) keep = m[1] === "GT";
  if (keep) det.push(l);
}
const dir = mkdtempSync(join(tmpdir(), "sheets-empty-"));
const f = (n, b) => { const p = join(dir, n); writeFileSync(p, b); return p; };
const sumPdf = f("Diagram Summary.pdf", makePdf(sum, ctx.fflate));
const detPdf = f("Diagram Detail.pdf", makePdf(det, ctx.fflate));

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage({ viewport: { width: 860, height: 1400 } });
page.on("pageerror", e => { console.error("PAGE ERROR:", e.message); process.exitCode = 1; });
await page.goto("file://" + BUILT.replace(/ /g, "%20"));
await page.setInputFiles("#file", [sumPdf, detPdf]);
await page.waitForFunction(() =>
  document.querySelector("#status").textContent.includes("Books built"), null, { timeout: 20000 });
console.log("roads:", await page.locator("#roads .road").count());
for (const t of await page.locator("#roads .road").allTextContents())
  console.log(" -", t.replace(/\s+/g, " ").trim().slice(0, 110));
const dl = page.waitForEvent("download", { timeout: 10000 });
await page.locator("#dlall").click();
console.log("save-all zip:", (await dl).suggestedFilename());
const roads = page.locator("#roads");
const b = await roads.boundingBox();
await page.screenshot({ path: "tools/shot-16-empty-roads.png",
  clip: { x: b.x - 8, y: b.y - 8, width: b.width + 16, height: Math.min(b.height + 16, 1380) } });
// the weekend prints carry no High Speed diagrams, so that road is skipped
const prints = f("WEEKEND PRINTS.docx", makeDocx(PRINTS_LINES, ctx.fflate));
await page.setInputFiles("#we_file", [prints]);
await page.waitForFunction(() =>
  document.querySelector("#we_status").textContent.includes("Berthed"), null, { timeout: 20000 });
for (const t of await page.locator("#we_roads .road").allTextContents())
  console.log(" w", t.replace(/\s+/g, " ").trim().slice(0, 110));
const wb = await page.locator("#we_roads").boundingBox();
await page.locator("#we_roads").scrollIntoViewIfNeeded();
const wb2 = await page.locator("#we_roads").boundingBox();
await page.screenshot({ path: "tools/shot-17-empty-weekend.png",
  clip: { x: wb2.x - 8, y: wb2.y - 8, width: wb2.width + 16, height: Math.min(wb2.height + 16, 1380) } });
await browser.close();
console.log("SHOT OK");
