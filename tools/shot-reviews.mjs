import { createRequire } from "node:module";
import { writeFileSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { loadSandbox } from "../test/helpers/sandbox.mjs";
import { makePdf, SUMMARY_LINES, DETAIL_LINES } from "../test/helpers/synth.mjs";
const require = createRequire("/opt/node22/lib/node_modules/playwright/");
const { chromium } = require("playwright");
const BUILT = fileURLToPath(new URL("../Sheets Generator.html", import.meta.url));
const ctx = loadSandbox(BUILT);
const dir = mkdtempSync(join(tmpdir(), "rev-"));
const f = (n, b) => { const p = join(dir, n); writeFileSync(p, b); return p; };
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage({ viewport: { width: 794, height: 620 } });
await page.goto("file://" + BUILT.replace(/ /g, "%20"));
await page.setInputFiles("#file",
  [f("Diagram Summary.pdf", makePdf(SUMMARY_LINES, ctx.fflate)),
   f("Diagram Detail.pdf", makePdf(DETAIL_LINES, ctx.fflate))]);
await page.waitForFunction(() =>
  document.querySelector("#status").textContent.includes("Books built"));

async function openReview(cardIx, shot) {
  const card = page.locator("#roads .road").nth(cardIx);
  const look = card.locator(".btn", { hasText: "Look at it" });
  if (await look.count()) await look.click();
  const rev = card.locator(".tab", { hasText: "Review" });
  await rev.click();
  await card.scrollIntoViewIfNeeded();
  await page.waitForTimeout(150);
  await page.screenshot({ path: shot });
  console.log(await card.locator(".road-name").textContent(), "review tab:",
    await rev.textContent(), "->",
    (await card.locator(".view").textContent()).trim().slice(0, 90));
  await card.locator(".btn", { hasText: "Close" }).click();
}
await openReview(0, "tools/shot-8-review-main.png");   // SHEETS
await openReview(2, "tools/shot-9-review-metro.png");  // METRO SHEETS
await browser.close();
console.log("review shots done");
