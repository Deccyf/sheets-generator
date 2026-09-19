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

/* ---- the shortages and variations road ---- */
await page.reload();
await page.locator("#mode_sv").click();
if (!(await page.locator("#svPanel").isVisible())) throw new Error("the shortages panel should open on its tab");
console.log("sv idle     :", (await page.textContent("#svstatus")).trim());
{
  /* Its two reports, written as their text comes out of the PDF and the CSV
     export, so the panel is driven the way a person drives it. */
  const { OPERATING_LINES, SHORTAGE_DETAIL_CSV, SHORTAGE_SUMMARY_LINES } =
    await import("../test/helpers/shortage-synth.mjs");
  const opPath = f("uoperatd.txt", OPERATING_LINES.join("\n"));
  const detPath = f("diagdet2.csv", SHORTAGE_DETAIL_CSV);
  const sumPath = f("udiagsum.txt", SHORTAGE_SUMMARY_LINES.join("\n"));
  await page.setInputFiles("#svfile", [opPath, detPath, sumPath]);
  await page.waitForFunction(() => !document.querySelector("#svout").hidden,
    null, { timeout: 20000 });
  console.log("sv built    :", (await page.textContent("#svstatus")).trim());
  const list = await page.textContent("#svout");
  if (!/3 CAR WRONG END \(RM301\/RM901\)/.test(list)) throw new Error("the 3-car swap is missing: " + list);
  if (!/3\.375 V 4\.375 \(RM903\)/.test(list)) throw new Error("the real shortfall is missing: " + list);
  if (!/3 CAR INTER VICE END \(RM302\/RM905\)/.test(list)) throw new Error("the middle case is missing: " + list);
  const note = await page.textContent("#svnote");
  if (!/positions from the Summary/.test(note)) throw new Error("the Summary should be read: " + note);
  console.log("sv list     :", list.split("\n")[0]);
  await page.locator("#svclear").click();
  if (!(await page.locator("#svout").isHidden())) throw new Error("start over should clear the list");
  console.log("sv cleared  :", (await page.textContent("#svstatus")).trim());

  /* And the same report SAVED rather than printed: dropped as the .csv
     export it used to read as no rows at all, which looked like a clean
     day. Driven through the panel because that is where it was reported. */
  const { SHORTAGE_OPERATING_CSV } = await import("../test/helpers/shortage-synth.mjs");
  await page.setInputFiles("#svfile",
    [f("uoperatd.csv", SHORTAGE_OPERATING_CSV), detPath, sumPath]);
  await page.waitForFunction(() => !document.querySelector("#svout").hidden,
    null, { timeout: 20000 });
  const csvList = await page.textContent("#svout");
  if (csvList !== list) throw new Error("the saved report should give the same list:\n" + csvList);
  console.log("sv csv      :", (await page.textContent("#svstatus")).trim());

  /* The depot's own lettered hand, off the same build. */
  await page.locator("#svlettered").check();
  await page.waitForFunction(() =>
    /^A\)/.test(document.querySelector("#svout").textContent), null, { timeout: 10000 });
  const letters = (await page.textContent("#svout")).split("\n")
    .filter(l => /^[A-Z]+\)    /.test(l)).map(l => l.split(")")[0]);
  if (letters.join(",") !== "A,B,C,D")
    throw new Error("a letter per case and one for the fleet list: " + letters.join(","));
  console.log("sv lettered :", (await page.textContent("#svout")).split("\n")[0].replace(/\t/g, "  "));
  await page.locator("#svlettered").uncheck();
  if ((await page.textContent("#svout")) !== csvList)
    throw new Error("unticking should give the plain list back");

  /* The other two layout switches, off the same read. */
  await page.locator("#svbyfamily").check();
  await page.locator("#svramarr").check();
  await page.waitForFunction(() =>
    !/ - CST \(ARR/.test(document.querySelector("#svout").textContent), null, { timeout: 10000 });
  const trimmed = (await page.textContent("#svout")).split("\n").filter(Boolean);
  if (trimmed.some(l => /\(ARR /.test(l) && !/ - RAM | - RE /.test(l)))
    throw new Error("arrivals should be left only on Ramsgate:\n" + trimmed.join("\n"));
  const fleet = trimmed.filter(l => /^375/.test(l));
  if (!/^375\/9 V 375/.test(fleet[0]) || !/^375 V 375\/9/.test(fleet[fleet.length - 1]))
    throw new Error("one way round then the other:\n" + fleet.join("\n"));
  console.log("sv layout   :", fleet[0]);
  await page.locator("#svbyfamily").uncheck();
  await page.locator("#svramarr").uncheck();
  await page.waitForTimeout(200);
  if ((await page.textContent("#svout")) !== csvList)
    throw new Error("unticking both should give the plain list back");
}

/* ---- berth requests: off the weekday build, so it needs a Summary with
   units on it - the CSV export the way the evening print has it ---- */
{
  const { geniusSummaryCsvWithUnits, geniusDetailCsv } = await import("../test/helpers/synth.mjs");
  await page.reload();
  await page.locator("#mode_br").click();
  console.log("br idle     :", (await page.textContent("#brstatus")).trim());
  await page.locator("#mode_wk").click();
  await page.setInputFiles("#file", [
    f("udiagsum.csv", geniusSummaryCsvWithUnits({ GT101: "375601.", GT102: "375602." })),
    f("diagdet2.csv", geniusDetailCsv())]);
  await page.waitForFunction(() =>
    document.querySelector("#status").textContent.includes("Books built"), null, { timeout: 20000 });
  await page.locator("#mode_br").click();
  console.log("br ready    :", (await page.textContent("#brstatus")).trim());
  await page.fill("#brplan", ["Exams", "Unit Nr \tExam\t\tWhere\tAction",
    "375601\tA\tTUE AM 04/08\tAFK\tAFK HOLD", "375602\tB\tMON PM 03/08\tAFK\t",
    "375699\tA\tTUE AM 04/08\tRE\tSTOPPED RE"].join("\n"));
  await page.fill("#brignore", "375699");
  await page.locator("#brgo").click();
  await page.waitForFunction(() => !document.querySelector("#brout").hidden, null, { timeout: 10000 });
  /* the plan back in its own shape: a table per section, the exam rows in
     the workbook's colours, the empty Action filled in bold */
  const rows = await page.locator("#brout table.brtable tr").count();
  if (rows < 4) throw new Error("the plan should come back as a table: " + rows + " rows");
  const first = await page.locator("#brout tr.ex-a td").allTextContents();
  if (!/on GT101 · ENDS DVP 23\+50 · calls AFK/.test(first[6])) throw new Error("375601 should be placed: " + first.join(" | "));
  if (!/AFK BERTH off 2A01/.test(first[5])) throw new Error("375601's suggestion: " + first[5]);
  if (first[4] !== "AFK HOLD") throw new Error("the planner's action is kept as pasted: " + first[4]);
  const green = await page.locator("#brout tr.ex-b td").allTextContents();
  if (!/ends where it is wanted/.test(green[6])) throw new Error("375602 ends at Ashford: " + green.join(" | "));
  if (!/O\/O\/S — ignored/.test(await page.textContent("#brout"))) throw new Error("the ignore box should take");
  console.log("br built    :", (await page.textContent("#brstatus")).trim());
  console.log("br note     :", (await page.textContent("#brnote")).trim());
  await page.locator("#brlist").click();
  if (!/== NEXT: today, tomorrow/.test(await page.textContent("#brout"))) throw new Error("nearest-first should list");
  await page.locator("#brlist").click();
  if (!(await page.locator("#brout table.brtable").count())) throw new Error("and back to the plan");
  /* the blurb and the warning box are on the tab */
  const lead = await page.textContent("#brPanel");
  if (!/Stuck on finding berth requests for your\s+Telex/.test(lead)) throw new Error("the tab should say what it is for");
  if (!/Equinox or EMS/.test(lead)) throw new Error("and where the defects come from");
  if (!/Do not use this to build your Telex/i.test(await page.textContent("#brPanel .brwarn"))) throw new Error("the warning box");
  /* the defects export pasted on its own is a plan: 375601's defect comes
     back as a Defects line with the fault's couple of words, and its
     notice header says CONTAINING */
  await page.fill("#brplan", "");
  await page.fill("#brignore", "");
  await page.fill("#brdefects", [
    "Date Occurred\tDays O/S\tAsset No\tCoach No\tCatalogue No.\tStock Description\tRepair Location\tDiagram End Location\tArrival Date\tSystem Code\tFault Description\tFacility Failure\tReport\tPriority\tTarget Due Date",
    "06/07/2026 15:48:00\t28\t375601\t67875\t\t\t+ CON RED\tRAMSGTD\t02/08/2026 19:54:00\tHA\tUMD1234 No Cab Air Con - Requires HVAC\tNo\tWR0000001\t2. Restriction MO\t04/08/2026 00:00:00",
  ].join("\n"));
  await page.locator("#brgo").click();
  await page.waitForFunction(() => /1 plan lines read/.test(document.querySelector("#brstatus").textContent), null, { timeout: 10000 });
  const def = await page.textContent("#brout");
  if (!/NO CAB AIR CON/.test(def)) throw new Error("the fault's couple of words should be on the line: " + def.slice(0, 300));
  if (!/RED · CON/.test(def)) throw new Error("RED and CON should be on the line: " + def.slice(0, 300));
  console.log("br defects  :", (await page.textContent("#brstatus")).trim());
  /* MSE: the export flags 375602, the hint names it, listing it in the box
     answers the question */
  await page.fill("#brdefects", [
    "Date Occurred\tDays O/S\tAsset No\tCoach No\tCatalogue No.\tStock Description\tRepair Location\tDiagram End Location\tArrival Date\tSystem Code\tFault Description\tFacility Failure\tReport\tPriority\tTarget Due Date",
    "06/07/2026 15:48:00\t28\t375602\t67876\t\t\t+ MSE\tASHFEBS\t02/08/2026 19:54:00\tDR\tMDC wiper not working\tNo\tWR0000002\t2. Restriction MO\t04/08/2026 00:00:00",
  ].join("\n"));
  await page.locator("#brgo").click();
  await page.waitForFunction(() => /MSE on: 375602/.test(document.querySelector("#brmsehint").textContent), null, { timeout: 10000 });
  console.log("br mse hint :", (await page.textContent("#brmsehint")).trim());
  await page.fill("#brmse", "375602");
  await page.locator("#brgo").click();
  await page.waitForFunction(() => /MSE ATTENDING — NO REQUEST/.test(document.querySelector("#brout").textContent), null, { timeout: 10000 });
  console.log("br mse      : attending — no request");
  await page.fill("#brmse", "");
  /* the tab's own drop zone takes a Saturday's pair, which the weekday
     books refuse */
  const { geniusPairCsv } = await import("../test/helpers/synth.mjs");
  const p = geniusPairCsv([{ code: "RM101", units: "375601.", stops: [
    { code: "RAMSGTD", arr: "", dep: "05:00", hc: "5J70" }, { code: "GRVPKUS", arr: "07:00", dep: "", hc: "" }] }]);
  await page.setInputFiles("#brfile", [
    f("satsum.csv", p.summary.replace(/03\/08\/26/g, "08/08/26")),
    f("satdet.csv", p.detail.replace(/03\/08\/26/g, "08/08/26"))]);
  await page.waitForFunction(() => /Summary 08\/08\/26/.test(document.querySelector("#brberthtxt").textContent), null, { timeout: 10000 });
  console.log("br own pair :", (await page.textContent("#brberthtxt")).trim());
  await page.locator("#brgo").click();
  await page.waitForFunction(() => /against 08\/08\/26/.test(document.querySelector("#brstatus").textContent), null, { timeout: 10000 });
  console.log("br saturday :", (await page.textContent("#brstatus")).trim());
  /* each dropped report has a chip that takes it off again, the plan staying put */
  const nChips = await page.locator("#brfiles .chip").count();
  if (nChips !== 3) throw new Error("two reports and a remove-all: " + nChips);
  await page.locator("#brfiles .chip", { hasText: "Detail" }).first().click();
  await page.waitForFunction(() => /no Detail yet/.test(document.querySelector("#brberthtxt").textContent), null, { timeout: 10000 });
  if (!(await page.inputValue("#brdefects")).length) throw new Error("the defects box should be untouched");
  console.log("br chip off :", (await page.textContent("#brberthtxt")).trim().slice(0, 60));
  await page.locator("#brfiles .chip").first().click();
  await page.waitForFunction(() => document.querySelector("#brfiles").hidden, null, { timeout: 10000 });
  console.log("br chips    : all off, zone idle");
}

await browser.close();
console.log("SMOKE OK");
