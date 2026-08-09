/* One-shot: pull the page shell (CSS + markup) out of the legacy monolith
   into src/styles.css and src/page.html, adding the fleet-lineup mount and
   the version line. Script blocks become a {{SCRIPTS}} placeholder. */
import { readFileSync, writeFileSync } from "node:fs";
const SRC = readFileSync("test/fixtures/legacy.html", "utf8").split("\n");
const cut = (a, b) => SRC.slice(a - 1, b).join("\n");
const must = (t, n, w) => { if (!t.includes(n)) throw new Error(w + ": missing " + n); return t; };

let css = cut(8, 230);
css += `

  /* ---------- fleet sprites ---------- */
  .lineup{display:flex; gap:32px; align-items:flex-end; margin:26px 0 0; flex-wrap:wrap}
  .lineup figure{margin:0}
  .lineup svg{height:32px; width:auto; display:block}
  .lineup figcaption{font-family:var(--mono); font-size:10.5px; letter-spacing:.16em;
    text-transform:uppercase; color:var(--chalk); margin-top:7px}
  .road-sprite{margin-left:14px; align-self:center}
  .road-sprite svg{height:20px; width:auto; display:block}
  .unit svg{height:16px; width:auto; display:block}
  .version{margin:12px 0 0; font-family:var(--mono); font-size:11px;
    color:var(--chalk); letter-spacing:.08em}
`;
writeFileSync("src/styles.css", css + "\n");

let bodyTop = cut(234, 348);
must(bodyTop, '<p class="lede">', "page: lede");
bodyTop = bodyTop.replace(
  /(computer — no file is sent anywhere\.<\/p>)/,
  `$1

    <div class="lineup" id="lineup" aria-hidden="true"></div>`);
must(bodyTop, 'id="lineup"', "page: lineup inserted");

let weekend = cut(5440, 5533);
weekend = weekend.replace(
  /(<p class="smallprint">[\s\S]*?<\/p>)/,
  `$1
    <p class="version">Sheets Generator <span id="ver"></span> — build stamped for traceability.</p>`);
must(weekend, 'id="ver"', "page: version line inserted");

const guard = cut(349, 361);

/* Scripts sit at the END of body: the legacy build wired the weekend
   panel before its markup existed, which crashed on load and left the
   weekend drop zone dead. */
const page = `<!DOCTYPE html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Berthing sheets — Genius reports &amp; weekend prints to SHEETS</title>
<style>
{{CSS}}
</style>
</head>
<body>
${bodyTop}
${guard}
${weekend}
{{SCRIPTS}}
</body>
</html>
`;
writeFileSync("src/page.html", page);
console.log("wrote src/styles.css src/page.html");
