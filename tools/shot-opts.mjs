/* One-off: screenshot the headcode-toggle fieldset on both panels. */
import { BUILT_URL, launch } from "./browser.mjs";
const browser = await launch();
for (const [w, tag] of [[860, "wide"], [430, "narrow"]]) {
  const page = await browser.newPage({ viewport: { width: w, height: 1000 } });
  await page.goto(BUILT_URL);
  const fs = page.locator("fieldset.opts").first();
  await fs.scrollIntoViewIfNeeded();
  const b = await fs.boundingBox();
  await page.screenshot({ path: `tools/shot-14-opts-${tag}.png`,
    clip: { x: b.x - 8, y: b.y - 14, width: b.width + 16, height: b.height + 22 } });
  await page.close();
}
await browser.close();
console.log("SHOT OK");
