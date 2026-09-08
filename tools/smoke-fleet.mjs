/* Browser smoke test for the diagram analyser: load the built file in
   Chromium, drop an invented set of prints through the real file input, and
   check the report and the workbook come back.

   The unit tests run in a vm with a stubbed DOM, so ui.js only has to PARSE
   to pass them. Only a real browser catches a selector that no longer
   matches anything. */
import { writeFileSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadSandbox } from "../test/helpers/sandbox.mjs";
import { makeDocx, FLEET_LINES } from "../test/helpers/synth.mjs";
import { BUILT, ANALYSER_URL, launch } from "./browser.mjs";

const ctx = loadSandbox(BUILT);
const dir = mkdtempSync(join(tmpdir(), "fleet-smoke-"));
const prints = join(dir, "DIAGRAM PRINTS FSX.docx");
writeFileSync(prints, makeDocx(FLEET_LINES, ctx.fflate));

const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 1200 } });
let failed = false;
page.on("pageerror", e => { console.error("PAGE ERROR:", e.message); failed = true; });
page.on("console", m => { if (m.type() === "error") console.error("CONSOLE:", m.text()); });
await page.goto(ANALYSER_URL);

const die = msg => { console.error("FAIL: " + msg); failed = true; };

await page.setInputFiles("#file", [prints]);
await page.waitForFunction(
  () => document.querySelector("#status").textContent.includes("diagrams read"),
  null, { timeout: 20000 });
const status = await page.textContent("#status");
console.log("status:", status);
if (!/7 diagrams read \(1 standing still all day\)/.test(status))
  die("the status line did not report the diagrams it read");

/* Both fleets in the fixture get a card, each with its questions on tabs. */
const cards = await page.locator("#roads .road").count();
console.log("fleet cards:", cards);
if (cards !== 2) die("expected a card per fleet, got " + cards);

const card = page.locator('#roads .road[data-road="375"]');
const tabs = await card.locator(".tabs .tab").allTextContents();
console.log("tabs on the 375 card:", tabs.join(" | "));
/* Nine for a fleet whose home is on this network; a tenth appears when it
   is not, and that path is covered by the unit tests. */
if (tabs.length !== 9) die("expected nine tabs, got " + tabs.length);
for (const want of [/restricted/i, /place codes/i, /mileage/i, /back to/i,
                    /apart/i])
  if (!tabs.some(t => want.test(t))) die("a question is missing: " + want);

/* Every tab draws its section when it is picked, and between them they
   draw rows - a tab with none of its own is legitimate (a fleet with no
   arrivals into the depot that day), a card with none at all is not. */
let rows = 0;
for (let i = 0; i < tabs.length; i++){
  await card.locator(".tabs .tab").nth(i).click();
  const h = await card.locator(".view .sech").first().textContent();
  if (!h) die("tab " + tabs[i] + " drew no section");
  rows += await card.locator("table.rep tbody tr").count();
}
console.log("every tab draws, " + rows + " rows between them \u2713");
if (!rows) die("the card drew no rows at all");

/* The place nothing coupled leaves must be called out in red. */
const contain = tabs.findIndex(t => /cannot contain/i.test(t));
await card.locator(".tabs .tab").nth(contain).click();
const no = await card.locator("td.no").allTextContents();
console.log("cannot-contain cells:", no.length);
if (!no.length) die("no location was flagged as unable to contain a restriction");

/* Changing a depot must redraw against the new setting. */
await page.selectOption("#home-375", "Ashford");
await page.waitForFunction(
  () => /Arrivals into Ashford/i.test(
    document.querySelector("#roads .road .view .sech").textContent),
  null, { timeout: 5000 });
console.log("after moving home depot:", await page.locator("#roads .road .view .sech").first().textContent());

await page.selectOption("#home-375", "Ramsgate");
await page.waitForFunction(
  () => /Arrivals into Ramsgate/i.test(
    document.querySelector("#roads .road .view .sech").textContent),
  null, { timeout: 5000 });

await page.screenshot({ path: "tools/smoke-fleet.png", fullPage: false });

const dl = page.waitForEvent("download", { timeout: 15000 });
await card.locator(".btn", { hasText: "Save this fleet" }).click();
const got = await dl;
console.log("download:", got.suggestedFilename());
if (!/^DIAGRAMS_375_\d{8}\.xlsx$/.test(got.suggestedFilename()))
  die("the workbook came out with an unexpected name");

const all = page.waitForEvent("download", { timeout: 15000 });
await page.locator("#saveall").click();
console.log("download:", (await all).suggestedFilename());

/* Start over clears the prints and the report but keeps the depot
   settings, and the page has to accept a fresh drop afterwards. */
await page.selectOption("#home-375", "Ashford");
await page.locator("#startover").click();
await page.waitForFunction(() => document.getElementById("out").hidden,
  null, { timeout: 5000 });
if (await page.locator("#roads .road").count()) die("the report was not cleared");
if (!(await page.locator("#setup").isHidden())) die("the depot panel was not cleared");
if (await page.textContent("#status")) die("the status line was not cleared");
if (!(await page.locator("#startover").isHidden()))
  die("Start over is still offered with nothing loaded");
console.log("after start over: report and panels cleared");

await page.setInputFiles("#file", [prints]);
await page.waitForFunction(
  () => document.querySelector("#status").textContent.includes("diagrams read"),
  null, { timeout: 20000 });
const kept = await page.locator("#roads .road .view .sech").first().textContent();
console.log("second drop:", await page.textContent("#status"), "| first section:", kept);
if (!/Arrivals into Ashford/i.test(kept))
  die("the depot setting was lost across Start over");

await browser.close();
if (failed) process.exitCode = 1;
else console.log("\nanalyser smoke OK");
