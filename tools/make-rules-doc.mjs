/* Builds "BERTHING SHEET RULES.html" — the rules the tool goes by, written
   out for colleagues who will never open the tool, let alone the code.

     node build.mjs && node tools/make-rules-doc.mjs "BERTHING SHEET RULES.html"

   Nothing here is typed out by hand. It loads the built single-file tool,
   reads the very tables the build uses, and asks SHEETS_RULES.explainHtml
   for the words — the same call the Rules tab inside the tool makes. So the
   handout, the tab and the books can only ever say the same thing: correct
   a table in src/data.js and all three move together.

   The result is one self-contained page. Open it in a browser, or print it
   to PDF and put it on the wall — there is nothing to install and it works
   with no network. */
import { readFileSync, writeFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = process.argv[2] || join(ROOT, "BERTHING SHEET RULES.html");

/* ---- load the built tool with no DOM, so only the tables run ---- */
const html = readFileSync(join(ROOT, "Sheets Generator.html"), "utf8");
const ctx = createContext({
  console, window: {}, navigator: {}, setTimeout,
  TextDecoder, TextEncoder,
});
for (const m of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)) {
  /* ui.js bails out without a document; everything else is pure tables and
     functions. A script that needs the page simply does nothing here. */
  try { runInContext(m[1], ctx); } catch (e) { /* page wiring only */ }
}
const D = ctx.SHEETS_DATA, RULES = ctx.SHEETS_RULES,
      RB = ctx.SHEETS_RULEBOOK, X = ctx.SHEETS_XLSX;
if (!D || !RULES || !RB || !X) {
  console.error("Sheets Generator.html did not load — run `node build.mjs` first.");
  process.exit(1);
}

/* ---- the four books, exactly as the tool splits them ---- */
const BOOKS = [
  { title: "Mainline", sub: "375s and 377s — the main book",
    profile: 0, sections: D.MAIN_ORDER.filter(s => s !== "RAMSGATE") },
  { title: "Ramsgate", sub: "375s and 377s — Ramsgate's own book",
    profile: 0, sections: ["RAMSGATE"] },
  /* Two of the four are not berthing sheets - they are the depot's own
     documents - and the rulebook writes each of them its own description.
     Without these flags the handout described all four as berthing sheets,
     which is the one thing the Metro and High Speed pages are not. */
  { title: "Metro", sub: "465s, 466s and 707s — the depot's own sheet",
    profile: 1, sections: D.METRO_ORDER, kind: "metro" },
  /* The 395 sheet's own blocks, not HS_ORDER: the two lists differ, and the
     handout printed one in its section strip and the other in its prose -
     "ASHFORD · FAVERSHAM · RAMSGATE" directly above a sentence naming
     Margate as well. What the sheet lays out is what the page should say. */
  { title: "High Speed", sub: "395s — the Class 395 Allocations Sheet",
    profile: 2, sections: [...ctx.SHEETS_HS.DEPOTS], kind: "hs" },
];
/* …and the sections that are about a berthing sheet come off those two. The
   rulebook decides which, so this handout and the tool's own Rules tab
   cannot drift apart again; the handout takes the corrections inline, where
   the tool keeps them on the Unit order tab. */
const pickFor = book => RULES.pickFor(book.kind, true);

function envFor(book) {
  const prof = D.PROFILES_G[book.profile];
  return {
    sections: book.sections,
    metro: book.kind === "metro",
    hs: book.kind === "hs",
    fleets: prof.fleets,
    posAsc: [...prof.posAsc],
    roadPosAsc: prof.roadPosAsc ? [...prof.roadPosAsc] : [],
    platformTurn: Object.keys(D.PLATFORM_TURN),
    firstDep: [...(prof.firstDep || [])].sort(),
    firstDepAll: !!prof.firstDepAll,
    ecsOnlyOk: [...(prof.ecsOnlyOk || [])].sort(),
    headcodeSections: [...D.HEADCODE_SECTIONS],
    endStyle: D.END_STYLE,
    routeByHc: D.ROUTE_BY_HC,
    dayRoll: RB.DAY_ROLL, pmBreak: RB.PM_BREAK, runRound: RB.RUN_ROUND,
    breakGap: X.BREAK_GAP,
    hsDepots: [...ctx.SHEETS_HS.DEPOTS],
    gpSplit: book.profile === 0,
    orderFix: D.ORDER_FIX,
  };
}

/* ---- the page ---- */
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
/* Dated from the build, not the clock: stamping `new Date()` rewrote this
   file on every build on a new day, so `npm test` dirtied the working tree
   and trained everyone to check the build outputs back out - the very habit
   that ships a stale deliverable. Same treatment as the Word guide. */
const stamp = (process.env.SOURCE_DATE_EPOCH
  ? new Date(+process.env.SOURCE_DATE_EPOCH * 1000)
  : new Date(Date.UTC(2026, 7, 18)))
  .toISOString().slice(0, 10).split("-").reverse().join("/");

const CSS = `
:root{
  --ink:#262E33; --steel:#3C464D; --chalk:#79818A; --rule:#C4C7BF;
  --apron:#E4E5E0; --paper:#F5F4EF; --signal:#0E7C42; --amber:#8A5210;
}
*{box-sizing:border-box}
body{margin:0; background:var(--paper); color:var(--ink);
  font:15px/1.6 "Segoe UI",Frutiger,Calibri,system-ui,sans-serif;
  -webkit-print-color-adjust:exact; print-color-adjust:exact}
.wrap{max-width:860px; margin:0 auto; padding:32px 24px 64px; background:#fff;
  min-height:100vh; box-shadow:0 0 0 1px var(--apron)}
header{border-bottom:3px solid var(--ink); padding-bottom:14px; margin-bottom:8px}
h1{font-size:26px; margin:0 0 4px; letter-spacing:.01em}
.lede{color:var(--steel); margin:0; font-size:15px}
.stamp{font-size:12px; color:var(--chalk); margin:10px 0 0;
  letter-spacing:.04em; text-transform:uppercase}
nav{background:var(--paper); border:1px solid var(--apron); border-radius:4px;
  padding:14px 18px; margin:22px 0 28px}
nav h2{font-size:11px; letter-spacing:.1em; text-transform:uppercase;
  color:var(--chalk); margin:0 0 8px; font-weight:600}
nav ol{margin:0; padding-left:20px; columns:2; column-gap:28px}
nav li{margin:0 0 4px; break-inside:avoid}
nav a{color:var(--ink); text-decoration:none; border-bottom:1px solid var(--rule)}
nav a:hover{border-bottom-color:var(--ink)}
.book{margin:0 0 12px; padding-top:8px}
.book > h2{font-size:20px; margin:0 0 2px; padding-bottom:8px;
  border-bottom:2px solid var(--ink)}
.book > .sub{color:var(--chalk); font-size:13px; margin:0 0 4px;
  letter-spacing:.04em; text-transform:uppercase}
.rule-sec{margin:0 0 20px; break-inside:avoid-page}
.rule-sec h3{font-size:12px; letter-spacing:.1em; text-transform:uppercase;
  color:var(--steel); margin:20px 0 8px; font-weight:600}
.rule-sec p{margin:0 0 10px}
.rule-sec ul{margin:0 0 12px; padding-left:20px}
.rule-sec li{margin:0 0 6px}
.rule-note{border-left:3px solid var(--signal); background:var(--paper);
  padding:10px 14px; margin:0 0 12px !important; color:var(--steel);
  font-size:14px}
.rules-t{border-collapse:collapse; width:100%; margin:0 0 14px; font-size:13.5px}
.rules-t th{text-align:left; font-size:10.5px; letter-spacing:.09em;
  text-transform:uppercase; color:var(--chalk); font-weight:600;
  border-bottom:1.5px solid var(--rule); padding:5px 10px 5px 0}
.rules-t td{padding:5px 10px 5px 0; border-bottom:1px solid var(--apron);
  vertical-align:top}
.rules-t tr:nth-child(even) td{background:#FBFBF9}
footer{margin-top:36px; padding-top:14px; border-top:1px solid var(--rule);
  color:var(--chalk); font-size:12.5px}
@media print{
  body{background:#fff; font-size:10.5pt}
  .wrap{box-shadow:none; max-width:none; padding:0}
  nav{break-after:page}
  .book{break-before:page}
  .book:first-of-type{break-before:auto}
  a{color:inherit; text-decoration:none; border:0}
}
`;

const parts = [];
parts.push("<title>Berthing Sheet Rules</title>");
parts.push("<style>" + CSS + "</style>");
parts.push('<div class="wrap">');
parts.push("<header><h1>Berthing sheet rules</h1>" +
  '<p class="lede">How the unit berthing sheets are put together — what ' +
  "each column means, which movements get a line, and why the units are in " +
  "the order they are in. Written for anybody who has to read or check a " +
  "sheet.</p>" +
  '<p class="stamp">Generated from the tool on ' + stamp +
  " · Southeastern unit berthing</p></header>");

parts.push('<nav><h2>The four weekday books</h2><ol>');
for (const b of BOOKS)
  parts.push('<li><a href="#b-' + esc(b.title.replace(/\s+/g, "-")) + '">' +
    esc(b.title) + "</a> — " + esc(b.sub) + "</li>");
parts.push("</ol>");
parts.push('<p style="margin:12px 0 0; font-size:13px; color:#3C464D">' +
  "The first two are berthing books, and most rules are the same in both. " +
  "Where one differs — which locations read which way round, which times " +
  "are used, which places keep their empty moves — its own section says so. " +
  "<b>Metro and High Speed are not berthing sheets at all</b>: they are the " +
  "depot's own Metro sheet and Class 395 Allocations Sheet, so their " +
  "sections describe those documents and leave off the rules that only " +
  "belong to a berthing one.</p>");
/* The Saturday and Sunday sheets are built from the weekend diagram prints
   by the other half of the tool. Nearly every rule below is shared, but the
   which-way-round list is NOT, so the difference is named here as well as in
   the order section - somebody checking a Sunday sheet has to know before
   they start reading, not four sections in. */
parts.push('<p style="margin:8px 0 0; font-size:13px; color:#3C464D">' +
  "These are the <b>Monday to Friday</b> books. Saturday and Sunday sheets " +
  "are built from the weekend diagram prints and follow the same rules with " +
  "one exception: they list units lowest position number first everywhere, " +
  "rather than by the which-way-round list below.</p>");
parts.push("</nav>");

for (const b of BOOKS) {
  parts.push('<div class="book" id="b-' + esc(b.title.replace(/\s+/g, "-")) + '">');
  parts.push('<p class="sub">Book</p><h2>' + esc(b.title) + "</h2>");
  parts.push('<p class="sub" style="margin-top:8px">' + esc(b.sub) + " · " +
    esc(b.sections.join(" · ")) + "</p>");
  parts.push(RULES.explainHtml(envFor(b), pickFor(b)));
  parts.push("</div>");
}

parts.push("<footer>Generated straight from the tool's own tables — nothing " +
  "on this page is typed out separately, so it cannot fall behind what the " +
  "books actually do. If something here is wrong, the tool is wrong too: say " +
  "so and it gets fixed in one place. This page is about how the sheets are " +
  "written, not about what may run where — route and gauge questions go to " +
  "the Sectional Appendix and the Weekly Operating Notice.</footer>");
parts.push("</div>");

writeFileSync(OUT, parts.join("\n") + "\n");
console.log("wrote " + OUT);
