/* One-off: screenshot the quick start's Integrale instructions panel. */
import { BUILT_URL, launch } from "./browser.mjs";
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 900, height: 1400 } });
page.on("pageerror", e => { console.error("PAGE ERROR:", e.message); process.exitCode = 1; });
await page.goto(BUILT_URL);
const det = page.locator("details.hint.wide");
console.log("summary:", await det.locator("summary").textContent());
await det.locator("summary").click();
await page.waitForTimeout(120);
const li = page.locator(".steps li").first();
const b = await li.boundingBox();
await page.screenshot({ path: "tools/shot-15-integrale-hint.png",
  clip: { x: b.x - 6, y: b.y - 6, width: Math.min(b.width + 12, 900), height: Math.min(b.height + 12, 1300) } });
console.log("images shown:", await det.locator("img").count());
await browser.close();
console.log("SHOT OK");
