/* One-off: screenshot the headcode-toggle fieldset on both panels. */
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire("/opt/node22/lib/node_modules/playwright/");
const { chromium } = require("playwright");
const BUILT = fileURLToPath(new URL("../Sheets Generator.html", import.meta.url));
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
for (const [w, tag] of [[860, "wide"], [430, "narrow"]]) {
  const page = await browser.newPage({ viewport: { width: w, height: 1000 } });
  await page.goto("file://" + BUILT.replace(/ /g, "%20"));
  const fs = page.locator("fieldset.opts").first();
  await fs.scrollIntoViewIfNeeded();
  const b = await fs.boundingBox();
  await page.screenshot({ path: `tools/shot-14-opts-${tag}.png`,
    clip: { x: b.x - 8, y: b.y - 14, width: b.width + 16, height: b.height + 22 } });
  await page.close();
}
await browser.close();
console.log("SHOT OK");
