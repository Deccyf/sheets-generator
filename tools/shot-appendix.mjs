/* One-off: screenshot the Sectional Appendix "Watch for" tab on a road card. */
import { writeFileSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadSandbox } from "../test/helpers/sandbox.mjs";
import { makePdf, SUMMARY_LINES, DETAIL_LINES } from "../test/helpers/synth.mjs";
import { BUILT, BUILT_URL, launch } from "./browser.mjs";
const ctx = loadSandbox(BUILT);
const dir = mkdtempSync(join(tmpdir(), "sa-"));
const f = (n, b) => { const p = join(dir, n); writeFileSync(p, b); return p; };
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 820, height: 900 } });
page.on("pageerror", e => { console.error("PAGE ERROR:", e.message); process.exitCode = 1; });
await page.goto(BUILT_URL);
await page.setInputFiles("#file",
  [f("Diagram Summary.pdf", makePdf(SUMMARY_LINES, ctx.fflate)),
   f("Diagram Detail.pdf", makePdf(DETAIL_LINES, ctx.fflate))]);
await page.waitForFunction(() =>
  document.querySelector("#status").textContent.includes("Books built"));
for (const [ix, name] of [[0, "main"], [2, "metro"]]) {
  const card = page.locator("#roads .road").nth(ix);
  const look = card.locator(".btn", { hasText: "Look at it" });
  if (await look.count()) await look.click();
  await card.locator(".tab", { hasText: "Watch for" }).click();
  await card.scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  console.log(await card.locator(".road-name").textContent(), "->",
    (await card.locator(".sa-notes li").count()) + " notes");
  await page.screenshot({ path: "tools/shot-18-appendix-" + name + ".png" });
  await card.locator(".btn", { hasText: "Close" }).click();
}
await browser.close();
console.log("appendix shots done");
