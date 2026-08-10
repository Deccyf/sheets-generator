/* One-off: build the Metro book from the real Integrale exports and
   screenshot the Dartford / Gillingham tables showing the first-move times. */
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire("/opt/node22/lib/node_modules/playwright/");
const { chromium } = require("playwright");
const BUILT = fileURLToPath(new URL("../Sheets Generator.html", import.meta.url));
const U = "/root/.claude/uploads/a92fd59d-eda0-5a2d-858d-3481c8939b31/";

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage({ viewport: { width: 900, height: 1200 } });
page.on("pageerror", e => { console.error("PAGE ERROR:", e.message); process.exitCode = 1; });
await page.goto("file://" + BUILT.replace(/ /g, "%20"));
await page.setInputFiles("#file", [U + "7c8a4698-Diagram_Summary_100826.csv",
                                   U + "96235384-Diagrams_100826.csv"]);
await page.waitForFunction(() =>
  document.querySelector("#status").textContent.includes("Books built"), null, { timeout: 60000 });
console.log("status:", await page.textContent("#status"));
const metro = page.locator("#roads .road").nth(2);
console.log("book:", (await metro.locator(".road-name").first().textContent()).trim());
await metro.locator(".btn", { hasText: "Look at it" }).click();
await page.waitForSelector("#roads .road .view table.sheet");
const rows = await metro.locator("table.sheet tr").allTextContents();
const want = ["DARTFORD", "GILLINGHAM"];
let show = [], keep = false;
for (const r of rows) {
  const t = r.replace(/\s+/g, " ").trim();
  if (want.some(w => t.startsWith(w))) keep = true;
  else if (/^[A-Z][A-Z .]{3,}/.test(t) && !/^\d/.test(t)) keep = false;
  if (keep && t) show.push(t);
}
console.log(show.slice(0, 24).join("\n"));
const tbl = metro.locator("table.sheet").filter({ hasText: "DARTFORD" }).first();
await tbl.scrollIntoViewIfNeeded();
const box = await tbl.boundingBox();
await page.screenshot({ path: "tools/shot-13-metro-first-move.png",
  clip: { x: box.x, y: box.y, width: Math.min(box.width, 900), height: Math.min(box.height, 900) } });
await browser.close();
console.log("SHOT OK");
