/* Browser check: the Genius CSV exports go in through the real drop zone. */
import { writeFileSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { geniusSummaryCsv, geniusDetailCsv } from "../test/helpers/synth.mjs";
import { BUILT_URL, launch } from "./browser.mjs";

const dir = mkdtempSync(join(tmpdir(), "sheets-gcsv-"));
const f = (n, t) => { const p = join(dir, n); writeFileSync(p, t, "utf8"); return p; };
const sum = f("udiagsum.csv", geniusSummaryCsv());
const det = f("diagdet.csv", geniusDetailCsv());

const browser = await launch();
const page = await browser.newPage({ viewport: { width: 900, height: 1000 } });
page.on("pageerror", e => { console.error("PAGE ERROR:", e.message); process.exitCode = 1; });
page.on("console", m => { if (m.type() === "error") { console.error("CONSOLE:", m.text()); process.exitCode = 1; } });
await page.goto(BUILT_URL);
await page.setInputFiles("#file", [sum]);
await page.waitForFunction(() =>
  document.querySelector("#status").textContent.includes("loaded"), null, { timeout: 10000 });
console.log("after the summary:", await page.textContent("#status"));
await page.setInputFiles("#file", [det]);
await page.waitForFunction(() =>
  document.querySelector("#status").textContent.includes("Books built"), null, { timeout: 20000 });
console.log("after the detail :", await page.textContent("#status"));
console.log("roads:", await page.locator("#roads .road").count());

/* ---- and the same two reports pasted in instead of dropped ---- */
await page.reload();
const say = () => page.textContent("#paste_say");
const put = (sel, text) => page.evaluate(([s, v]) => {
  // as a paste leaves it: value set, one input event. fill() re-types the
  // value a character at a time and cannot cope with a real report.
  const el = document.querySelector(s);
  el.value = v;
  el.dispatchEvent(new Event("input", { bubbles: true }));
}, [sel, text]);

if (!(await page.locator("#pastebox").isHidden()))
  throw new Error("the paste panel should start shut");
await page.locator("#pastetoggle").click();
if (await page.locator("#pastebox").isHidden())
  throw new Error("the paste panel should open when the link is used");

// one box filled is not a pair
await put("#paste_sum", geniusSummaryCsv());
await page.locator("#paste_go").click();
console.log("one box  :", (await say()).trim());
if (!/Diagram Detail/.test(await say())) throw new Error("should ask for the other report");

// pasted the wrong way round: it says so and builds anyway
await put("#paste_sum", geniusDetailCsv());
await put("#paste_det", geniusSummaryCsv());
await page.locator("#paste_go").click();
await page.waitForFunction(() =>
  document.querySelector("#status").textContent.includes("Books built"), null, { timeout: 20000 });
console.log("swapped  :", (await say()).trim());
if (!/other way round/.test(await say())) throw new Error("a swapped pair should say so");

// and the right way round
await put("#paste_sum", geniusSummaryCsv());
await put("#paste_det", geniusDetailCsv());
await page.locator("#paste_go").click();
await page.waitForFunction(() =>
  document.querySelector("#status").textContent.includes("Books built"), null, { timeout: 20000 });
console.log("pasted   :", await page.textContent("#status"));
const pastedRoads = await page.locator("#roads .road").count();
console.log("roads    :", pastedRoads);
if (!pastedRoads) throw new Error("a pasted pair built no roads");
if ((await say()).trim()) throw new Error("a clean build should leave no note: " + await say());

await page.locator("#paste_clear").click();
if (await page.$eval("#paste_sum", e => e.value) !== "")
  throw new Error("Clear both should empty the boxes");

/* ---- the awkward half dropped, the easy half pasted ----
   The Diagram Detail is megabytes where the Summary is a couple of hundred
   kilobytes, so it is the one a locked-down machine will not paste. Dropping
   it and pasting the other has to work, in either order. */
for (const [order, first, second] of [
  ["detail dropped, summary pasted", "det", "sum"],
  ["summary dropped, detail pasted", "sum", "det"],
]) {
  await page.reload();
  await page.setInputFiles("#file",
    [first === "det" ? det : sum]);
  await page.waitForFunction(() =>
    document.querySelector("#status").textContent.includes("loaded"), null, { timeout: 10000 });
  await page.locator("#pastetoggle").click();
  await put(second === "sum" ? "#paste_sum" : "#paste_det",
            second === "sum" ? geniusSummaryCsv() : geniusDetailCsv());
  await page.locator("#paste_go").click();
  await page.waitForFunction(() =>
    document.querySelector("#status").textContent.includes("Books built"), null, { timeout: 20000 });
  console.log(order.padEnd(31) + ": " + (await say()).trim());
  if (!await page.locator("#roads .road").count())
    throw new Error(order + " built no roads");
}

/* ---- the two routes that need no clipboard at all ----
   Some machines block Ctrl+V into a browser. Dragging is a different road,
   and the page used to swallow it: a document-level drop handler called
   preventDefault on everything, so a selection dragged out of Excel into a
   box did nothing at all. */
await page.reload();
await page.locator("#pastetoggle").click();
const swallowed = await page.evaluate(() => {
  const el = document.querySelector("#paste_sum");
  const dt = new DataTransfer();
  dt.setData("text/plain", "x");
  const ev = new DragEvent("drop", { dataTransfer: dt, bubbles: true, cancelable: true });
  el.dispatchEvent(ev);
  return ev.defaultPrevented;
});
console.log("text dragged into a box  :", swallowed ? "SWALLOWED" : "left to the browser");
if (swallowed) throw new Error("the page must not swallow a text drop into a box");

const dropFile = (sel, text, fname) => page.evaluate(([s, t, n]) => {
  const el = document.querySelector(s);
  const dt = new DataTransfer();
  dt.items.add(new File([t], n, { type: "text/csv" }));
  for (const type of ["dragenter", "dragover", "drop"])
    el.dispatchEvent(new DragEvent(type, { dataTransfer: dt, bubbles: true, cancelable: true }));
}, [sel, text, fname]);
await dropFile("#paste_sum", geniusSummaryCsv(), "udiagsum.csv");
await dropFile("#paste_det", geniusDetailCsv(), "diagdet.csv");
await page.waitForFunction(() =>
  document.querySelector("#paste_sum").value.length > 100 &&
  document.querySelector("#paste_det").value.length > 100, null, { timeout: 10000 });
await page.locator("#paste_go").click();
await page.waitForFunction(() =>
  document.querySelector("#status").textContent.includes("Books built"), null, { timeout: 20000 });
console.log("files dragged into boxes :", await page.textContent("#status"));
if (!await page.locator("#roads .road").count())
  throw new Error("files dragged into the boxes built no roads");

/* ---- the printed book's memory: save, rebuild a changed plan, be told ----
   The books on screen are for MON 03/08. Saving stores their fingerprint;
   a re-export of the same date with GT101 gone - its Ashford pair now runs alone. (GT106 would be no test: its only move is an empty hop to a berth, which the books suppress.)
   must then lead the Review tab with the difference, and say so up top. */
await page.locator("#roads .road").first().locator("button:has-text('Save book')").click();
await page.waitForFunction(() =>
  document.querySelector("#status").textContent.includes("Saved"), null, { timeout: 10000 });
const changedSum = geniusSummaryCsv().split("\r\n")
  .filter(l => !l.includes('"GT101"')).join("\r\n");
const changedDet = geniusDetailCsv().split("\r\n")
  .filter(l => !l.includes('"GT101"')).join("\r\n");
await put("#paste_sum", changedSum);
await put("#paste_det", changedDet);
await page.locator("#paste_go").click();
await page.waitForFunction(() =>
  document.querySelector("#status").textContent.includes("Books built"), null, { timeout: 20000 });
const movedStatus = await page.textContent("#status");
console.log("plan moved after save    :", movedStatus.slice(0, 120));
if (!/plan has changed/.test(movedStatus))
  throw new Error("a changed re-export of a saved date must say the plan moved");
await page.locator("#roads .road").first().locator(".tab", { hasText: "Review" }).click();
const review = await page.locator("#roads .road").first().locator(".view").textContent();
if (!/MON 03\/08 book was saved/.test(review))
  throw new Error("the Review tab should open with what moved since the save");
if (!/101/.test(review))
  throw new Error("the vanished diagram should be named in the differences");
console.log("review leads with        : the moved-plan differences, naming 101");

/* and a re-export that matches the saved book stays quiet */
await put("#paste_sum", geniusSummaryCsv());
await put("#paste_det", geniusDetailCsv());
await page.locator("#paste_go").click();
await page.waitForFunction(() =>
  document.querySelector("#status").textContent.includes("Books built"), null, { timeout: 20000 });
if (/plan has changed/.test(await page.textContent("#status")))
  throw new Error("an unchanged re-export must not claim the plan moved");
console.log("unchanged re-export      : quiet, as it should be");

await browser.close();
console.log("GENIUS CSV SMOKE OK");
