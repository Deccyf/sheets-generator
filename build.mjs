/* Assembles the single-file deliverable from src/. No dependencies.
   Usage: node build.mjs  ->  "Sheets Generator.html" */
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const read = p => readFileSync(new URL(p, import.meta.url), "utf8");
const pkg = JSON.parse(read("./package.json"));

/* The stamp a page carries. A missing one is an error, not "0.0.0": a page
   stamped 0.0.0 still looks built and gets handed round, and the whole point
   of the stamp is that a copy in the wild names a real release. */
function stampOf(o, what) {
  const ok = v => typeof v === "string" && v.trim() !== "";
  if (!o || !ok(o.version) || !ok(o.released))
    throw new Error(`package.json: ${what} needs both "version" and "released"`);
  return { version: o.version, released: o.released };
}
/* Stamped into the page so a copy can be identified. Once this file is
   emailed round, synced and put on SharePoint there is no other way to
   tell which one somebody is looking at - a fix reported as "still
   wrong" is usually an old copy. */
const { version, released } = stampOf(pkg, "the berthing sheets");

/* One <script> block per module. A module containing "</script" would end
   its block early - the browser would run half the file, and the test
   sandbox, which cuts the page up on the same tag, would load half of it -
   so it is refused here, where the file name is known, rather than found
   as a dead page. */
function scriptBlocks(mods) {
  return mods.map(m => {
    const src = read("./" + m).trimEnd();
    if (/<\/script/i.test(src))
      throw new Error(`${m} contains "</script", which would end the page's ` +
                      `script block early - split the string ("<\\/script")`);
    return "<script>\n" + src + "\n</script>";
  }).join("\n");
}

/* Every placeholder, everywhere it appears - a template naming {{VERSION}}
   twice used to print the second one as itself. Function replacers, so a
   "$&" inside a module cannot be read as a substitution pattern. */
function fill(template, values) {
  let out = template;
  for (const [k, v] of Object.entries(values))
    out = out.replaceAll("{{" + k + "}}", () => v);
  return out;
}

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
  "src/stockreq.js",
  "src/metro.js",
  "src/hs-skin.js",
  "src/hs.js",
  "src/engine.js",
  "src/genius.js",
  "src/ui.js",
];

const html = fill(read("./src/page.html"), {
  CSS: read("./src/styles.css").trimEnd(),
  SCRIPTS: scriptBlocks(modules),
  VERSION: version,
  RELEASED: released,
});

writeFileSync(new URL("./Sheets Generator.html", import.meta.url), html);
console.log(`built "Sheets Generator.html" v${version} — ${html.length} bytes ` +
  `(${(html.length / 1024).toFixed(0)} KB)`);

/* The second deliverable. It reads the same prints through the same reader
   and is otherwise its own tool: the berthing sheets say where a unit
   stands tonight, this says what the plan means for looking after it. */
const fleetModules = [
  "src/vendor/fflate.js",
  /* The location names live with the rest of the tool's local knowledge
     in src/data.js, so the analyser reads them from there rather than
     keeping a second table that would drift. */
  "src/data.js",
  "src/prints-read.js",
  "src/fleet/prints.js",
  "src/fleet/fleet.js",
  "src/fleet/report.js",
  "src/fleet/xlsx.js",
  "src/fleet/ui.js",
];
/* Its own version, not the berthing sheets'. They are different files with
   different histories, and a fault reported against "version 2.6" has to
   name one file unambiguously. */
const fleet = stampOf(pkg.analyser, 'the diagram analyser ("analyser" block)');
const fleetHtml = fill(read("./src/fleet/page.html"), {
  CSS: read("./src/styles.css").trimEnd() + "\n\n" + read("./src/fleet/fleet.css").trimEnd(),
  SCRIPTS: scriptBlocks(fleetModules),
  VERSION: fleet.version,
  RELEASED: fleet.released,
});
writeFileSync(new URL("./Diagram Analyser.html", import.meta.url), fleetHtml);
console.log(`built "Diagram Analyser.html" v${fleet.version} — ${fleetHtml.length} bytes ` +
  `(${(fleetHtml.length / 1024).toFixed(0)} KB)`);

/* The documents that are generated FROM the tool are part of the build, not
   an afterthought - the Word guide sat a day behind for exactly as long as
   it took nobody to remember to run it by hand. The rules page needs only
   the file we have just written; the Word guide needs the `docx` package,
   so it is built when that is installed and skipped, loudly, when it is
   not. Neither failure stops the tool being built - locally. Under CI (the
   CI variable set) a document that did not build fails the build, because
   the freshness check that follows can only compare a document that was
   actually written, and a skipped one would pass as "in step" for ever. */
function extras() {
  const here = new URL("./", import.meta.url);
  let failed = false;
  const fail = (what, why) => {
    failed = true;
    console.error(`  ! "${what}" NOT rebuilt: ${why}`);
  };
  /* Both scripts take their output path as their first argument and nothing
     else, so they are run the way the command line runs them - as their own
     process - rather than imported with a doctored process.argv. A non-zero
     exit is the failure, and a process.exit() inside the script cannot take
     the build with it. */
  const run = (script, out) => {
    const r = spawnSync(process.execPath,
      [fileURLToPath(new URL(script, here)), fileURLToPath(new URL(out, here))],
      { stdio: "inherit" });
    if (r.error) throw r.error;
    if (r.status !== 0)
      throw new Error(script + " exited with " +
        (r.status === null ? "signal " + r.signal : "status " + r.status));
  };
  try { run("./tools/make-rules-doc.mjs", "./BERTHING SHEET RULES.html"); }
  catch (e) { fail("BERTHING SHEET RULES.html", e.message); }

  let haveDocx = true;
  try { createRequire(import.meta.url).resolve("docx"); }
  catch (e) { haveDocx = false; }
  if (!haveDocx) {
    if (process.env.CI) fail("HOW TO USE.docx", "the `docx` package is not installed (npm ci)");
    else console.log('  - "HOW TO USE.docx" skipped (run `npm i docx` to build it)');
  } else {
    try { run("./tools/make-guide-docx.mjs", "./HOW TO USE.docx"); }
    catch (e) { fail("HOW TO USE.docx", e.message); }
  }

  if (failed && process.env.CI) {
    console.error("  ! CI: a generated document did not build, so the build fails");
    process.exitCode = 1;
  }
}
extras();
