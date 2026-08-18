/* The headcode and platform-stand boxes, on both panels, at two widths.

     node build.mjs && node tools/shot-opts.mjs

   They are hidden until a panel has built something - ticking one rebuilds
   the books, so there is nothing for them to do before that - which is why
   this used to time out waiting for a fieldset that was never going to
   appear. It builds first now, from the synthetic fixtures. */
import { writeFileSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { BUILT, BUILT_URL, launch } from "./browser.mjs";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const { loadSandbox } = await import(join(ROOT, "test/helpers/sandbox.mjs"));
const { makePdf, SUMMARY_LINES, DETAIL_LINES, makeDocx, PRINTS_LINES } =
  await import(join(ROOT, "test/helpers/synth.mjs"));

const ctx = loadSandbox(BUILT);
const dir = mkdtempSync(join(tmpdir(), "opts-"));
const put = (name, bytes) => {
  const p = join(dir, name);
  writeFileSync(p, bytes);
  return p;
};

const browser = await launch();
for (const [w, tag] of [[860, "wide"], [430, "narrow"]]) {
  const page = await browser.newPage({ viewport: { width: w, height: 1200 } });
  await page.goto(BUILT_URL);
  // the weekday boxes
  await page.setInputFiles("#file", [
    put("Diagram Summary.pdf", makePdf(SUMMARY_LINES, ctx.fflate)),
    put("Diagram Detail.pdf", makePdf(DETAIL_LINES, ctx.fflate)),
  ]);
  await page.waitForFunction(() =>
    document.querySelector("#status").textContent.includes("Books built"),
    null, { timeout: 60000 });
  // …and the weekend one, so both are on the page at once
  await page.setInputFiles("#we_file",
    [put("WEEKEND PRINTS.docx", makeDocx(PRINTS_LINES, ctx.fflate))]);
  await page.waitForFunction(() =>
    document.querySelector("#we_status").textContent.includes("Berthed"),
    null, { timeout: 60000 });

  for (const [sel, name] of [["#opts", "hc"], ["#opts2", "stands"],
                             ["#we_opts", "we-hc"]]) {
    const fs = page.locator(sel);
    if (await fs.isHidden()) { console.log("hidden, skipped: " + sel); continue; }
    await fs.scrollIntoViewIfNeeded();
    const b = await fs.boundingBox();
    await page.screenshot({
      path: `tools/shot-14-opts-${name}-${tag}.png`,
      clip: { x: b.x - 8, y: b.y - 14, width: b.width + 16, height: b.height + 22 },
    });
  }
  console.log(tag + ": weekday toggles " +
    JSON.stringify(await page.locator("#opts label").allTextContents()) +
    ", weekend " +
    JSON.stringify(await page.locator("#we_opts label").allTextContents()));
  await page.close();
}
await browser.close();
console.log("SHOT OK");
