/* Assembles the single-file deliverable from src/. No dependencies.
   Usage: node build.mjs  ->  "Sheets Generator.html" */
import { readFileSync, writeFileSync } from "node:fs";

const read = p => readFileSync(new URL(p, import.meta.url), "utf8");
const version = JSON.parse(read("./package.json")).version;

/* Load order matters: data before the engines, the writer before the
   engines that call it, UI last. */
const modules = [
  "src/vendor/fflate.js",
  "src/data.js",
  "src/core.js",
  "src/rulebook.js",
  "src/xlsx.js",
  "src/engine.js",
  "src/genius.js",
  "src/ui.js",
];

const scripts =
  `<script>\n"use strict";\nconst SHEETS_VERSION = ${JSON.stringify(version)};\n` +
  `if (typeof globalThis !== "undefined") globalThis.SHEETS_VERSION = SHEETS_VERSION;\n</script>\n` +
  modules.map(m => "<script>\n" + read("./" + m).trimEnd() + "\n</script>").join("\n");

const html = read("./src/page.html")
  .replace("{{CSS}}", () => read("./src/styles.css").trimEnd())
  .replace("{{SCRIPTS}}", () => scripts);

writeFileSync(new URL("./Sheets Generator.html", import.meta.url), html);
console.log(`built "Sheets Generator.html" v${version} — ${html.length} bytes ` +
  `(${(html.length / 1024).toFixed(0)} KB)`);
