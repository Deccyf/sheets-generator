/* Browser smoke test: load the built file in Chromium, feed both panels
   through the real file inputs, and screenshot the results. */
import { writeFileSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadSandbox } from "../test/helpers/sandbox.mjs";
import { makePdf, makeDocx, SUMMARY_LINES, DETAIL_LINES, PRINTS_LINES,
         REISSUE_LINES } from "../test/helpers/synth.mjs";
import { BUILT, BUILT_URL, launch } from "./browser.mjs";

const ctx = loadSandbox(BUILT);
const dir = mkdtempSync(join(tmpdir(), "sheets-smoke-"));
const f = (name, bytes) => { const p = join(dir, name); writeFileSync(p, bytes); return p; };
const sumPdf = f("Diagram Summary.pdf", makePdf(SUMMARY_LINES, ctx.fflate));
const detPdf = f("Diagram Detail.pdf", makePdf(DETAIL_LINES, ctx.fflate));
const prints = f("WEEKEND PRINTS.docx", makeDocx(PRINTS_LINES, ctx.fflate));
const reissue = f("WEEKEND PRINTS reissue.docx", makeDocx(REISSUE_LINES, ctx.fflate));

const browser = await launch();
const page = await browser.newPage({ viewport: { width: 860, height: 1100 } });
page.on("pageerror", e => { console.error("PAGE ERROR:", e.message); process.exitCode = 1; });
page.on("console", m => { if (m.type() === "error") { console.error("CONSOLE:", m.text()); process.exitCode = 1; } });
await page.goto(BUILT_URL);

// Weekday: Summary first — the drop zone should start guiding.
await page.setInputFiles("#file", [sumPdf]);
await page.waitForFunction(() =>
  document.querySelector("#berth .berth-txt strong").textContent.includes("Summary loaded"),
  null, { timeout: 10000 });
await page.screenshot({ path: "tools/shot-7-zone.png",
  clip: { x: 0, y: 240, width: 860, height: 330 } });
console.log("zone guidance:", await page.textContent("#berth .berth-txt strong"));
await page.setInputFiles("#file", [detPdf]);
await page.waitForFunction(() =>
  document.querySelector("#status").textContent.includes("Books built"), null, { timeout: 20000 });
console.log("zone reset:", await page.textContent("#berth .berth-txt strong"));
console.log("weekday status:", await page.textContent("#status"));
console.log("weekday roads:", await page.locator("#roads .road").count());
const dl = page.waitForEvent("download", { timeout: 10000 });
await page.locator("#dlall").click();
console.log("save-all zip:", (await dl).suggestedFilename());
// previews are open by default: the first card shows its sheet without a click
await page.waitForSelector("#roads .road .view table.sheet");
console.log("weekday preview table rendered ✓");

// The stock requirements form is opt-in: tick it, expect its own card and
// its own file, untick it, expect the card gone again.
await page.locator("#stockreq").check();
await page.waitForFunction(() =>
  [...document.querySelectorAll("#roads .road")]
    .some(r => r.dataset.road === "Stock requirements"), null, { timeout: 15000 });
const srCard = page.locator('#roads .road[data-road="Stock requirements"]');
console.log("stock card:", (await srCard.locator(".unit").innerText())
  .replace(/\s+/g, " ").trim());
const srDl = page.waitForEvent("download", { timeout: 10000 });
await srCard.locator("button", { hasText: "Save form" }).click();
const srFile = await srDl;
console.log("stock form:", srFile.suggestedFilename());
if (!/^STOCK_REQUIREMENTS.*\.xlsx$/.test(srFile.suggestedFilename())) {
  console.error("FAIL: unexpected stock form name");
  process.exitCode = 1;
}
await page.locator("#stockreq").uncheck();
await page.waitForFunction(() =>
  ![...document.querySelectorAll("#roads .road")]
    .some(r => r.dataset.road === "Stock requirements"), null, { timeout: 15000 });
console.log("stock card removed on untick ✓");

// Weekend: prints then reissue in a second drop.
await page.setInputFiles("#we_file", [prints]);
await page.waitForFunction(() =>
  document.querySelector("#we_status").textContent.includes("Books built"), null, { timeout: 20000 });
console.log("mode after a weekend drop:", await page.$eval("#mode_we", e => e.getAttribute("aria-selected")));
await page.setInputFiles("#we_file", [reissue]);
await page.waitForFunction(() =>
  document.querySelector("#we_status").textContent.includes("Reissue applied"), null, { timeout: 20000 });
console.log("weekend status:", await page.textContent("#we_status"));
console.log("updated-prints button hidden:", await page.locator("#we_dlupd").isHidden());
await page.waitForSelector("#we_roads .road .view table.sheet");
console.log("weekend preview table rendered ✓");

/* The Metro and High Speed roads are the depot's own documents on a weekend
   too, so their cards carry a picker over the sheets rather than one page. */
for (const [road, what] of [["Metro", "Location"], ["High Speed", "Day"]]) {
  const card = page.locator('#we_roads .road[data-road="' + road + '"]').first();
  const toggle = card.locator(".btn.ghost").first();  // the preview toggle
  if (!(await toggle.count())) {
    console.log("weekend " + road + ": nothing to show on this fixture");
    continue;
  }
  // cards come up open; only click when this one is not
  if ((await toggle.textContent()).includes("Open")) await toggle.click();
  await card.locator(".pickbar select").waitFor({ timeout: 10000 });
  const opts = await card.locator(".pickbar select option").count();
  const ok = await card.locator("table.sheet").count();
  console.log("weekend " + road + ": " + what + " picker with " + opts +
              " sheet(s), table rendered: " + (ok > 0));
  if (!opts || !ok) throw new Error("weekend " + road + " card did not render its document");

}
console.log("lineup sprites:", await page.locator("#lineup svg").count());

/* ---- the weekend prints pasted in instead of dropped ---- */
await page.reload();
await page.locator("#mode_we").click();
const wePut = (sel, text) => page.evaluate(([s, v]) => {
  const el = document.querySelector(s);
  el.value = v;
  el.dispatchEvent(new Event("input", { bubbles: true }));
}, [sel, text]);
const weSay = () => page.textContent("#we_paste_say");

if (!(await page.locator("#we_pastebox").isHidden()))
  throw new Error("the weekend paste panel should start shut");
await page.locator("#we_pastetoggle").click();
if (await page.locator("#we_pastebox").isHidden())
  throw new Error("it should open when the link is used");

// text that lost its tabs is refused before the engine ever sees it
await wePut("#we_paste_main", PRINTS_LINES.join("\n").replace(/\t/g, " "));
await page.locator("#we_paste_go").click();
console.log("flattened   :", (await weSay()).trim());
if (!/does not read as the diagram prints/.test(await weSay()))
  throw new Error("flattened prints should be refused with a reason");

// the prints as text, which is what a copy out of Word gives
await wePut("#we_paste_main", PRINTS_LINES.join("\n"));
await page.locator("#we_paste_go").click();
await page.waitForFunction(() =>
  document.querySelector("#we_status").textContent.includes("Books built"),
  null, { timeout: 20000 });
console.log("pasted      :", await page.textContent("#we_status"));
console.log("paste note  :", (await weSay()).trim());
const wePasted = await page.locator("#we_roads .road").count();
console.log("weekend roads:", wePasted);
if (!wePasted) throw new Error("a pasted prints document built no roads");

// with a reissue in the second box
await wePut("#we_paste_re", REISSUE_LINES.join("\n"));
await page.locator("#we_paste_go").click();
await page.waitForFunction(() =>
  document.querySelector("#we_status").textContent.includes("Reissue applied"),
  null, { timeout: 20000 });
console.log("with reissue:", await page.textContent("#we_status"));
// there is no base .docx to splice into, so no updated-prints download
if (!(await page.locator("#we_dlupd").isHidden()))
  throw new Error("pasted prints cannot produce an updated .docx");

await page.locator("#we_clearall").click();
if (await page.$eval("#we_paste_main", e => e.value) !== "")
  throw new Error("Start over should clear the pasted text too");

await page.screenshot({ path: "tools/smoke-top.png", clip: { x: 0, y: 0, width: 860, height: 900 } });
await page.screenshot({ path: "tools/smoke-weekend.png" });
await page.locator("#mode_wk").click();
await page.screenshot({ path: "tools/smoke-weekday.png" });
/* ---- the prints saved as a CSV, dropped and pasted ---- */
const asCsv = PRINTS_LINES.map(l => l.split("\t")
  .map(c => /[",\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c)
  .join(",")).join("\r\n");
await page.reload();
await page.setInputFiles("#we_file", [f("WEEKEND PRINTS.csv", Buffer.from(asCsv, "utf8"))]);
await page.waitForFunction(() =>
  document.querySelector("#we_status").textContent.includes("Books built"), null, { timeout: 20000 });
console.log("csv dropped :", await page.textContent("#we_status"));
await page.locator("#we_pastetoggle").click();
await page.evaluate(v => {
  const el = document.querySelector("#we_paste_main");
  el.value = v; el.dispatchEvent(new Event("input", { bubbles: true }));
}, asCsv);
await page.locator("#we_paste_go").click();
await page.waitForFunction(() =>
  document.querySelector("#we_status").textContent.includes("Books built"), null, { timeout: 20000 });
console.log("csv pasted  :", await page.textContent("#we_paste_say"));

await browser.close();
console.log("SMOKE OK");
