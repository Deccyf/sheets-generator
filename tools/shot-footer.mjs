import { BUILT_URL, launch } from "./browser.mjs";
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 794, height: 700 } });
await page.goto(BUILT_URL);
await page.locator("footer").scrollIntoViewIfNeeded();
await page.waitForTimeout(150);
await page.screenshot({ path: "tools/shot-4-footer.png" });
await browser.close();
console.log("footer shot done");
