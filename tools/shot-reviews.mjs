import { writeFileSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadSandbox } from "../test/helpers/sandbox.mjs";
import { makePdf, SUMMARY_LINES, DETAIL_LINES } from "../test/helpers/synth.mjs";
import { BUILT, BUILT_URL, launch } from "./browser.mjs";
const ctx = loadSandbox(BUILT);
const dir = mkdtempSync(join(tmpdir(), "rev-"));
const f = (n, b) => { const p = join(dir, n); writeFileSync(p, b); return p; };
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 794, height: 620 } });
await page.goto(BUILT_URL);
await page.setInputFiles("#file",
  [f("Diagram Summary.pdf", makePdf(SUMMARY_LINES, ctx.fflate)),
   f("Diagram Detail.pdf", makePdf(DETAIL_LINES, ctx.fflate))]);
await page.waitForFunction(() =>
  document.querySelector("#status").textContent.includes("Books built"));

async function openReview(cardIx, shot) {
  const card = page.locator("#roads .road").nth(cardIx);
  const look = card.locator(".btn", { hasText: "Look at it" });
  const opened = await look.count() > 0;
  if (opened) await look.click();
  const rev = card.locator(".tab", { hasText: "Review" });
  // Only the roads the fixture gives something to review have the tab -
  // say so and move on rather than waiting out the click timeout.
  if (!await rev.count()) {
    console.log(await card.locator(".road-name").textContent(), "- nothing to review");
    if (opened) await card.locator(".btn", { hasText: "Close" }).click();
    return;
  }
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
await openReview(1, "tools/shot-10-review-ram.png");   // RAM SHEETS
await openReview(2, "tools/shot-9-review-metro.png");  // METRO SHEETS
await browser.close();
console.log("review shots done");
