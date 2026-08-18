/* The Metro sheet's first-move timing, on screen: a unit that runs empty out
   of the sidings before picking up its platform working is listed at the
   time it FIRST MOVES, with the empty move's headcode.

     node build.mjs && node tools/shot-metro-first-move.mjs

   Built from the synthetic first-move fixture, which exists for exactly this
   pair - GN611 out of the Dartford up sidings, GN612 starting in the
   platform. It used to load two real Integrale exports by absolute path from
   one machine's upload folder, which meant it ran nowhere else, pointed a
   committed script at real planning data, and had gone stale anyway: the
   Metro book became one tab with a location picker, so the DARTFORD table it
   waited for was never on the page. */
import { writeFileSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { BUILT_URL, launch } from "./browser.mjs";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const { METRO_MOVE_SUMMARY, METRO_MOVE_DETAIL } =
  await import(join(ROOT, "test/helpers/synth.mjs"));

const dir = mkdtempSync(join(tmpdir(), "metro-move-"));
const put = (name, bytes) => {
  const p = join(dir, name);
  writeFileSync(p, bytes);
  return p;
};

const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 1000 } });
page.on("pageerror", e => {
  console.error("PAGE ERROR:", e.message);
  process.exitCode = 1;
});
await page.goto(BUILT_URL);
// the fixture is the pair of Integrale CSV exports
await page.setInputFiles("#file", [
  put("Stock Diagrams.csv", METRO_MOVE_SUMMARY),
  put("Stock Diagram Detail.csv", METRO_MOVE_DETAIL),
]);
await page.waitForFunction(() =>
  document.querySelector("#status").textContent.includes("Books built"),
  null, { timeout: 60000 });

const metro = page.locator("#roads .road").filter({ hasText: "METRO SHEETS" }).first();
await metro.locator(".btn", { hasText: "Look at it" }).click();
await metro.scrollIntoViewIfNeeded();
await page.waitForSelector("#roads .road .view table.sheet");
for (const row of await metro.locator("table.sheet tr").allTextContents()) {
  const t = row.replace(/\s+/g, " ").trim();
  if (t) console.log("  " + t);
}
await metro.screenshot({ path: "tools/shot-13-metro-first-move.png" });
await browser.close();
console.log("SHOT OK");
