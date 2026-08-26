/* Assembles the single-file deliverable from src/. No dependencies.
   Usage: node build.mjs  ->  "Sheets Generator.html" */
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const read = p => readFileSync(new URL(p, import.meta.url), "utf8");
const pkg = JSON.parse(read("./package.json"));
const version = pkg.version;
const released = pkg.released || "";

/* Load order matters: data before the engines, the writer before the
   engines that call it, UI last. */
const modules = [
  "src/vendor/fflate.js",
  "src/data.js",
  "src/rules.js",
  "src/prints-read.js",
  "src/core.js",
  "src/rulebook.js",
  "src/xlsx.js",
  "src/metro.js",
  "src/hs-skin.js",
  "src/hs.js",
  "src/engine.js",
  "src/genius.js",
  "src/ui.js",
];

const scripts =
  modules.map(m => "<script>\n" + read("./" + m).trimEnd() + "\n</script>").join("\n");

const html = read("./src/page.html")
  .replace("{{CSS}}", () => read("./src/styles.css").trimEnd())
  .replace("{{SCRIPTS}}", () => scripts)
  /* Stamped into the page so a copy can be identified. Once this file is
     emailed round, synced and put on SharePoint there is no other way to
     tell which one somebody is looking at - a fix reported as "still
     wrong" is usually an old copy. */
  .replace("{{VERSION}}", () => version)
  .replace("{{RELEASED}}", () => released);

writeFileSync(new URL("./Sheets Generator.html", import.meta.url), html);
console.log(`built "Sheets Generator.html" v${version} — ${html.length} bytes ` +
  `(${(html.length / 1024).toFixed(0)} KB)`);

/* The second deliverable. It reads the same prints through the same reader
   and is otherwise its own tool: the berthing sheets say where a unit
   stands tonight, this says what the plan means for looking after it. */
const fleetModules = [
  "src/vendor/fflate.js",
  "src/prints-read.js",
  "src/fleet/prints.js",
  "src/fleet/fleet.js",
  "src/fleet/report.js",
  "src/fleet/xlsx.js",
  "src/fleet/ui.js",
];
const fleetHtml = read("./src/fleet/page.html")
  .replace("{{CSS}}", () =>
    read("./src/styles.css").trimEnd() + "\n\n" + read("./src/fleet/fleet.css").trimEnd())
  .replace("{{SCRIPTS}}", () =>
    fleetModules.map(m => "<script>\n" + read("./" + m).trimEnd() + "\n</script>").join("\n"))
  .replace("{{VERSION}}", () => version)
  .replace("{{RELEASED}}", () => released);
writeFileSync(new URL("./Diagram Analyser.html", import.meta.url), fleetHtml);
console.log(`built "Diagram Analyser.html" v${version} — ${fleetHtml.length} bytes ` +
  `(${(fleetHtml.length / 1024).toFixed(0)} KB)`);

/* The documents that are generated FROM the tool are part of the build, not
   an afterthought - the Word guide sat a day behind for exactly as long as
   it took nobody to remember to run it by hand. The rules page needs only
   the file we have just written; the Word guide needs the `docx` package,
   so it is built when that is installed and skipped, loudly, when it is
   not. Neither failure stops the tool being built. */
async function extras() {
  const here = new URL("./", import.meta.url);
  try {
    await import("./tools/make-rules-doc.mjs");
  } catch (e) {
    console.error('  ! "BERTHING SHEET RULES.html" NOT rebuilt: ' + e.message);
  }
  try {
    createRequire(import.meta.url).resolve("docx");
  } catch (e) {
    console.log('  - "HOW TO USE.docx" skipped (run `npm i docx` to build it)');
    return;
  }
  try {
    process.argv[2] = fileURLToPath(new URL("./HOW TO USE.docx", here));
    await import("./tools/make-guide-docx.mjs");
  } catch (e) {
    console.error('  ! "HOW TO USE.docx" NOT rebuilt: ' + e.message);
  }
}
await extras();
