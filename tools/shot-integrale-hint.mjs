/* One-off: screenshot the quick start's Integrale instructions panel. */
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire("/opt/node22/lib/node_modules/playwright/");
const { chromium } = require("playwright");
const BUILT = fileURLToPath(new URL("../Sheets Generator.html", import.meta.url));
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage({ viewport: { width: 900, height: 1400 } });
page.on("pageerror", e => { console.error("PAGE ERROR:", e.message); process.exitCode = 1; });
await page.goto("file://" + BUILT.replace(/ /g, "%20"));
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
