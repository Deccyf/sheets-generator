/* Page wiring: the mode switch, the two panels, and the book cards.

   Inputs: the DOM in src/page.html (ids are the contract - the smokes and
   this file share them), GENIUS / SheetsEngine for the builds, SHEETS_XLSX,
   SHEETS_METRO, SHEETS_HS and SHEETS_STOCKREQ for the workbooks and their
   previews. Output: cards on the page and files in the Downloads folder.

   Two panels, one shape: makePanel() owns the status board, the paste box,
   the drop zone, the cards container and the build queue, and the weekday
   and weekend closures below only add what differs - which reports they
   take and which books come back. Every sentence the page can say is in
   MSG, so the two panels cannot drift apart in their wording. */
"use strict";
(function () {
if (typeof document === "undefined" || !document.querySelector) return;
/* wire only once the DOM is complete - the parser is mid-body when this
   script block runs */
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
function init() {
const $ = s => document.querySelector(s);
const METRO = SHEETS_METRO;
const HS = SHEETS_HS;
const X = SHEETS_XLSX;
const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const zipFn = f => fflate.zipSync(f, { level: 6 });
const plural = (n, one, many) => n + " " + (n === 1 ? one : (many || one + "s"));

/* ---------------- what the page says ----------------
   One vocabulary: a BOOK is a file, a SHEET is a page in it, the REVIEW tab
   is where anything needing a human eye is named. */
const MSG = {
  idle: "Nothing built yet — drop the Diagram Summary and Diagram Detail above.",
  weIdle: "Nothing built yet — drop the weekend prints above.",
  reading: "Reading the reports …",
  readingFiles: names => "Reading " + names.join(", ") + " …",
  writing: "Writing the books …",
  built: (labels, review, moved, edits) =>
    "Books built for " + labels + " — look them over below, then save." +
    (moved ? " The plan has changed since a book for this date was saved on " +
             "this computer — the changes are listed first on each Review tab." : "") +
    (review ? " " + review + " to review — see each book's Review tab."
            : " Nothing to review.") +
    (edits ? " " + plural(edits, "order correction") + " made on this computer " +
             (edits === 1 ? "is" : "are") + " in force — see the Unit order tab." : ""),
  weBuilt: (banner, entries, merge, docs) =>
    "Books built for " + banner + " — " + plural(entries, "entry", "entries") +
    ". Look them over below, then save." +
    (merge ? " Reissue applied: " + plural(merge.replaced, "diagram") + " replaced" +
             (merge.added ? ", " + merge.added + " added" : "") + "."
           : (docs > 1 ? " (" + docs + " documents loaded.)" : "")),
  rebuilt: what => "Books rebuilt " + what + " — save them again if needed.",
  failed: e => "Build failed: " + (e && e.message || e) + ". Check the files and drop them again.",
  readFailed: (name, e) => "Couldn't read “" + name + "”: " + (e && e.message || e) +
    " — copy it to this computer's desktop and drop that.",
  saved: name => "Saved " + name + " — look in this computer's Downloads folder.",
  savedZip: (name, n) => "Saved " + name + " — " + plural(n, "book") +
    " in it, in this computer's Downloads folder.",
  savedUpdated: name => "Saved " + name + " — the prints with the reissue's diagrams spliced in.",
  cleared: "Cleared — drop this day's two reports to start again.",
  weCleared: "Cleared — drop this weekend's prints to start again.",
  stockOn: "Stock requirements form added — it is on its own card below.",
  stockOff: "Stock requirements form removed.",
  half: (src, got, want, what, hadBooks) =>
    src + " " + got + " loaded ✓ — now drop the " + want + " " + what + "." +
    (hadBooks ? " The books on screen were the previous build, so they have been cleared." : ""),
  zoneHalf: (src, got, want, what) => ["Diagram " + got + " loaded ✓ (" + src + ")",
    "now drop the " + want + " " + what + " · or click to choose it"],
  mixed: (sumSrc, detSrc) => "The Summary is from " + sumSrc + " but the Detail is from " +
    detSrc + " — drop a matching pair: both from Genius, or both from Integrale.",
  zoneMixed: ["Mixed sources loaded", "drop a matching pair — both from Genius, or both from Integrale"],
  sentToWeekend: name => "“" + name + "” is weekend diagram prints — sent to the Weekend panel.",
  sentToWeekday: name => "“" + name + "” is one of the weekday Diagram reports — sent to the Weekday panel.",
  notASheetInput: "This panel doesn't read spreadsheets. Drop the Diagram Summary and Diagram Detail reports (.pdf or .csv) instead.",
  notAReport: name => "“" + name + "” isn't a report this reads — it takes the Diagram Summary and Diagrams CSVs from Integrale, or the Diagram Summary and Detail reports from Genius saved as CSV.",
  notThisPanel: "This panel takes the Diagram Summary and Diagram Detail reports (.pdf or .csv). Weekend prints go on the Weekend panel.",
  notAGeniusPdf: name => "“" + name + "” doesn't look like a Genius report — save the Diagram Summary and Diagram Detail reports from Genius as PDFs and drop both here.",
  pdfUnreadable: name => "“" + name + "” couldn't be read as a PDF — save it again from Genius and drop the new file.",
  emptyBook: (fleet, cycle, prints) =>
    "No " + fleet + " diagrams in " + (prints ? "this weekend's prints" : "these reports") +
    " — nothing to build." +
    (cycle ? " (A " + fleet + " Control Cycle must exist in Genius for its diagrams to appear.)" : ""),
  noEntries: "No entries this day.",
  nothingToReview: "Nothing to review.",
  toReview: n => n + " to review",
  storageOff: "This browser blocks local storage, so order corrections, the printed-book memory and the options will not be kept between visits.",
  rulesDiscarded: "The order corrections stored on this computer could not be read and have been set aside — Reverse any that are still needed.",
  editNotKept: "That correction is applied to these books, but this browser would not store it — it will be gone when the page is closed.",
  weRebuildFailed: e => "Couldn't rebuild the books: " + (e && e.message || e) +
    " — the books on screen are the previous ones.",
  // the paste boxes
  readIntoBox: name => "Read " + name + " into the box.",
  boxReadFailed: name => "Couldn't read “" + name + "” — open it and paste the text instead.",
  boxesCleared: "Both boxes cleared.",
  pasteOne: "Paste a report into one of the boxes — both are needed, both for the same date.",
  pasteSame: which => "Both boxes hold the " + which + " — put the other report in the other box.",
  pasteNeeds: want => "Still needs the " + want + " — paste it into the other box, or drop the file on the panel above. Either way round works.",
  pasteSwapped: "Read the boxes the other way round — the Summary was in the Detail box.",
  pasteUsedLoaded: used => "Built with the " + used + " already loaded.",
  pastePartial: label => "The " + label + " box holds a report, but the copy starts part way through a line — select from the very top of the file, first line and all, and copy again.",
  pasteNotReport: label => "The " + label + " box does not read as one of the reports. Copy the whole file, first line and all — and paste a CSV export, not a PDF.",
  pasteUnreadable: e => "Couldn't read that: " + (e && e.message || e),
  wePasteEmpty: "Paste the weekend diagram prints into the first box.",
  wePasteWeekday: "That is one of the weekday Diagram reports — it builds the Monday-to-Friday books, on the Weekday panel.",
  wePasteFlat: "That does not read as the diagram prints — no “Diagram:” line with its columns intact. Copy the whole document out of Word, and paste it as it comes.",
  wePasteReissue: "The reissue box does not read as diagram prints. Leave it empty if there is no reissue.",
  wePasted: re => re ? "Built from the pasted prints and reissue." : "Built from the pasted prints.",
  wePasteFailed: e => (e && e.message) || "That could not be read as diagram prints.",
  weReadFailed: name => "Couldn't read " + name + ". Try copying it to the desktop first.",
  weUnreadable: "That file couldn't be read as diagram prints.",
};

/* ---------------- shared helpers ---------------- */
function escHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function download(name, data, mime) {
  const blob = new Blob([data], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
/* One zip beats a burst of separate downloads the browser may block. The
   books inside are already deflated, so the bundle is stored, not squeezed
   a second time. */
function downloadZip(name, files) {
  const bag = {};
  for (const [n, bytes] of files) bag[n] = bytes;
  download(name, fflate.zipSync(bag, { level: 0 }), "application/zip");
}
const paint = () => new Promise(r => setTimeout(r, 30));

/* Drag-and-drop + click wiring shared by the drop zones. */
function wireDrop(berth, fileIn, onFiles) {
  berth.addEventListener("click", () => fileIn.click());
  fileIn.addEventListener("change", () => {
    if (fileIn.files.length) onFiles(Array.from(fileIn.files));
    fileIn.value = "";
  });
  for (const evn of ["dragenter", "dragover"]) {
    berth.addEventListener(evn, e => {
      e.preventDefault(); berth.classList.add("dragover");
    });
  }
  for (const evn of ["dragleave", "drop"]) {
    berth.addEventListener(evn, e => {
      e.preventDefault(); berth.classList.remove("dragover");
    });
  }
  berth.addEventListener("drop", e => {
    const f = e.dataTransfer && e.dataTransfer.files;
    if (f && f.length) onFiles(Array.from(f));
  });
}
/* A file dropped anywhere but a drop zone must not navigate the page away
   from itself. A TEXT drop into a text box is the browser's own business:
   dragging a selection out of Excel is often the only road open where policy
   blocks Ctrl+V. */
const carriesFiles = e => {
  const dt = e.dataTransfer;
  if (!dt) return false;
  if (dt.types) for (let i = 0; i < dt.types.length; i++)
    if (dt.types[i] === "Files") return true;
  return !!(dt.files && dt.files.length);
};
const isTextBox = t => !!t && (t.tagName === "TEXTAREA" ||
  (t.tagName === "INPUT" && /^(text|search|url|tel|email)$/i.test(t.type || "")));
["dragover", "drop"].forEach(ev =>
  document.addEventListener(ev, e => {
    if (isTextBox(e.target) && !carriesFiles(e)) return;
    e.preventDefault();
  }));

/* The file itself dropped straight into a paste box. after(name, err) is
   told what happened either way. */
function wireBoxDrop(el, after) {
  if (!el) return;
  for (const evn of ["dragenter", "dragover"])
    el.addEventListener(evn, e => {
      if (carriesFiles(e)) { e.preventDefault(); el.classList.add("dragover"); }
    });
  for (const evn of ["dragleave", "dragend"])
    el.addEventListener(evn, () => el.classList.remove("dragover"));
  el.addEventListener("drop", e => {
    el.classList.remove("dragover");
    const f = e.dataTransfer && e.dataTransfer.files;
    if (!f || !f.length) return;          // a text drop: leave it to the browser
    e.preventDefault();
    const fr = new FileReader();
    fr.onerror = () => { if (after) after(f[0].name, fr.error || new Error("unreadable")); };
    fr.onload = () => {
      el.value = String(fr.result || "");
      el.dispatchEvent(new Event("input", { bubbles: true }));
      if (after) after(f[0].name, null);
    };
    fr.readAsText(f[0]);
  });
}

/* Tab strip with lazy panes and arrow-key navigation. */
let tabSeq = 0;
function tabbed(panes) {
  const id = "tabs" + (++tabSeq);
  const tabs = document.createElement("div");
  tabs.className = "tabs"; tabs.setAttribute("role", "tablist");
  const view = document.createElement("div");
  view.className = "view"; view.id = id + "-view";
  view.setAttribute("role", "tabpanel");
  const cache = {};
  const btns = panes.map(([name, htmlFn], ix) => {
    const tb = document.createElement("button");
    tb.type = "button"; tb.className = "tab"; tb.textContent = name;
    tb.id = id + "-" + ix;
    tb.setAttribute("role", "tab");
    tb.setAttribute("aria-controls", view.id);
    tb.tabIndex = ix === 0 ? 0 : -1;
    tb.addEventListener("click", () => select(ix));
    tabs.appendChild(tb);
    return { tb, htmlFn };
  });
  let sel = 0;
  function select(ix) {
    sel = ix;
    if (cache[ix] === undefined) cache[ix] = btns[ix].htmlFn();
    const pane = cache[ix];
    if (pane && pane.nodeType) { view.textContent = ""; view.appendChild(pane); }
    else view.innerHTML = pane;
    view.setAttribute("aria-labelledby", btns[ix].tb.id);
    view.scrollTop = 0; view.scrollLeft = 0;
    btns.forEach((b, j) => {
      b.tb.setAttribute("aria-selected", j === ix ? "true" : "false");
      b.tb.tabIndex = j === ix ? 0 : -1;
    });
  }
  tabs.addEventListener("keydown", e => {
    const cur = btns.findIndex(b => b.tb.getAttribute("aria-selected") === "true");
    let next = null;
    if (e.key === "ArrowRight") next = (cur + 1) % btns.length;
    else if (e.key === "ArrowLeft") next = (cur + btns.length - 1) % btns.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = btns.length - 1;
    if (next === null) return;
    btns[next].tb.focus(); select(next);
    e.preventDefault();
  });
  return { tabs, view, select, current: () => sel };
}

/* ---------------- this computer's memory ----------------
   Three things live in the browser's storage, all optional: the order
   corrections made with Reverse, a fingerprint of every book saved (so a
   later export of the same date can say what moved), and the option boxes.
   Every read copes with the store being blocked or the blob being corrupt. */
const store = (() => {
  try { return window.localStorage; } catch (e) { return null; }
})();
const RULES_LS_KEY = "sheetsRules.v1";
const PRINTED_LS_KEY = "sheetsPrinted.v1";
const OPTS_LS_KEY = "sheetsOpts.v1";
let rulesDiscarded = false;
let ruleEdits = (() => {
  if (!store) return {};
  const raw = store.getItem(RULES_LS_KEY) || "";
  const parsed = SHEETS_RULES.parse(raw);
  if (raw && !parsed) rulesDiscarded = true;
  return parsed ? parsed.orderFix : {};
})();
const editCount = () => Object.keys(ruleEdits).length;
function persistEdits() {
  if (!store) return false;
  try {
    store.setItem(RULES_LS_KEY,
      SHEETS_RULES.serialize(ruleEdits, new Date().toISOString()));
    return true;
  } catch (e) { return false; }
}
function loadJson(key) {
  if (!store) return {};
  try { return JSON.parse(store.getItem(key) || "{}") || {}; }
  catch (e) { return {}; }
}
function saveJson(key, obj) {
  if (!store) return;
  try { store.setItem(key, JSON.stringify(obj)); } catch (e) { /* full or blocked */ }
}

/* the option boxes and the mode, restored on the next visit */
const OPT_IDS = ["hc_main", "platstand", "milescol", "stockreq",
                 "we_hc_main", "we_hc_metro", "we_hc_hs"];
const savedOpts = loadJson(OPTS_LS_KEY);
for (const id of OPT_IDS) {
  const el = document.getElementById(id);
  if (el && typeof savedOpts[id] === "boolean") el.checked = savedOpts[id];
}
function rememberOpts(extra) {
  const o = {};
  for (const id of OPT_IDS) { const el = document.getElementById(id); if (el) o[id] = !!el.checked; }
  o.mode = (extra && extra.mode) || currentMode();
  saveJson(OPTS_LS_KEY, o);
}

/* ---- the printed book's memory ----
   A fingerprint of every book at the moment it is SAVED (saving precedes
   printing); a later build of the same date label says what no longer
   matches, at the top of the Review tab. Newest eight labels kept. */
function bookFingerprint(secs, day) {
  const out = [];
  const m = secs && secs[day];
  if (!m || typeof m.get !== "function") return out;
  for (const [sec, ents] of m)
    for (const e of ents)
      out.push([sec, e.time, e.time_kind || "",
        (e.units || []).map(u =>
          u.diag + ":" + (u.am || "") + "/" + (u.pm || "")).join(","),
        e.dest || ""].join(""));
  return out.sort();
}
function storePrinted(res) {
  if (!store || !res) return;
  const all = loadJson(PRINTED_LS_KEY);
  for (const day of Object.keys(res.labels)) {
    all[res.labels[day]] = {
      saved: new Date().toISOString(),
      main: bookFingerprint(res.secsByDay, day),
      metro: bookFingerprint(res.metroSecs, day),
      hs: bookFingerprint(res.hsSecs, day),
    };
  }
  const labels = Object.keys(all)
    .sort((a, b) => String(all[b].saved).localeCompare(String(all[a].saved)));
  for (const l of labels.slice(8)) delete all[l];
  saveJson(PRINTED_LS_KEY, all);
}
/* Entries pair on section + time; a pair with different units or berths is
   "changed", the rest are gone or new. */
function printedDiff(oldFp, newFp) {
  const fmtT = (t, k) => SHEETS_CORE.fmtTime(Number(t), k || "pax");
  const key = l => l.split("").slice(0, 3).join("");
  const byKey = list => {
    const m = new Map();
    for (const l of list) { const k = key(l);
      if (!m.has(k)) m.set(k, []); m.get(k).push(l); }
    return m;
  };
  const A = byKey(oldFp), B = byKey(newFp), out = [];
  const units = l => (l.split("")[3] || "")
    .split(",").filter(Boolean).map(x => x.split(":")[0]).join(",");
  for (const [k, was] of A) {
    const now = B.get(k);
    const [sec, t, kind] = k.split("");
    const at = sec + " " + fmtT(t, kind);
    if (!now) { out.push({ sec, msg: at + " (" + units(was[0]) + "): in the " +
      "saved book, not in this plan" }); continue; }
    if (was.join("") !== now.join(""))
      out.push({ sec, msg: at + ": the saved book has " + units(was[0]) +
        " — this plan has " + units(now[0]) +
        (units(was[0]) === units(now[0]) ? " with different berths" : "") });
  }
  for (const [k, now] of B) if (!A.has(k)) {
    const [sec, t, kind] = k.split("");
    out.push({ sec, msg: sec + " " + fmtT(t, kind) + " (" + units(now[0]) +
      "): not in the saved book" });
  }
  return out;
}
/* Capped so a wholly different day cannot bury the real notes. */
function sinceSaved(res, secs, bucketKey) {
  if (!store) return [];
  const all = loadJson(PRINTED_LS_KEY), out = [];
  for (const day of Object.keys(res.labels)) {
    const rec = all[res.labels[day]];
    if (!rec || !rec[bucketKey]) continue;
    const diffs = printedDiff(rec[bucketKey], bookFingerprint(secs, day));
    if (!diffs.length) continue;
    const when = String(rec.saved).replace(/T/, " at ").slice(0, 19);
    out.push({ sec: null, msg: "A " + res.labels[day] + " book was saved on " +
      "this computer on " + when + ". The plan has changed since — check " +
      "the printed copy against these:" });
    out.push(...diffs.slice(0, 20));
    if (diffs.length > 20)
      out.push({ sec: null, msg: "…and " + (diffs.length - 20) +
        " more entries differ. Compare the whole book." });
  }
  return out;
}

/* ---------------- the Rules and Unit order tabs ----------------
   Everything shown comes from the build that produced these very books -
   res.rules is the table that ran - so it cannot drift from the sheet. */
function rulesEnv(b, res, secNames) {
  const isMain = b.hc === "main";
  const prof = SHEETS_DATA.PROFILES_G[isMain ? 0 : (b.hc === "metro" ? 1 : 2)];
  const RB = SHEETS_RULEBOOK;
  const here = [...(secNames || [])].sort();
  return {
    sections: here,
    fleets: prof.fleets,
    posAsc: [...prof.posAsc],
    roadPosAsc: prof.roadPosAsc ? [...prof.roadPosAsc] : [],
    platformTurn: Object.keys(SHEETS_DATA.PLATFORM_TURN),
    firstDep: [...(prof.firstDep || [])].sort(),
    firstDepAll: !!prof.firstDepAll,
    ecsOnlyOk: [...(prof.ecsOnlyOk || [])].sort(),
    headcodeSections: [...SHEETS_DATA.HEADCODE_SECTIONS],
    endStyle: SHEETS_DATA.END_STYLE,
    routeByHc: SHEETS_DATA.ROUTE_BY_HC,
    dayRoll: RB.DAY_ROLL, pmBreak: RB.PM_BREAK, runRound: RB.RUN_ROUND,
    breakGap: SHEETS_XLSX.BREAK_GAP,
    hsDepots: [...HS.DEPOTS],
    gpSplit: isMain,
    orderFix: res.rules.orderFix,
    inTool: true,
  };
}

/* The reference half: read-only, the thing a new starter opens. */
function rulesPane(b, res, secNames, kind) {
  const el = document.createElement("div");
  el.className = "rules";
  const notBerth = kind === "metro" || kind === "hs";
  const env = rulesEnv(b, res, secNames);
  env.metro = kind === "metro";
  env.hs = kind === "hs";
  el.innerHTML = '<p class="sa-src">Every rule this book was built with, ' +
    'written out in plain English from the tables that ran — change a ' +
    'setting and rebuild, and this changes with it.' +
    (notBerth ? "" : " To put a formation right, use the Unit order tab.") +
    "</p>" + SHEETS_RULES.explainHtml(env, SHEETS_RULES.pickFor(kind, false));
  return el;
}

/* The working half: what this build printed coupled, and a button to turn
   any of it round. notify(msg, kind) reaches the panel's status board. */
function orderPane(b, res, rebuild, secNames, notify) {
  const el = document.createElement("div");
  el.className = "rules";
  const R = res.rules;
  const isMain = b.hc === "main";
  const mine = c => c.bucket === b.hc &&
    (!isMain || b.ram === (c.sec === "RAMSGATE"));
  const seenRow = new Set();
  const coupled = R.coupled.filter(c => {
    if (!mine(c)) return false;
    const k = c.sec + "|" + c.timeText + "|" + c.units.join(",");
    if (seenRow.has(k)) return false;
    seenRow.add(k);
    return true;
  });
  const h = [];
  const esc = escHtml;
  h.push('<section class="rule-sec"><h3>Check the coupled formations in ' +
    "this build</h3>");
  if (!coupled.length)
    h.push('<p class="noreviews">Nothing in this book runs coupled, so there ' +
      "is no order to check.</p>");
  else {
    h.push("<p>Every formation of two or more units the tool printed, in the " +
      "order it printed them. Hold it against the real book: if one is the " +
      "wrong way round, press Reverse — it turns the formation round and " +
      "rebuilds the books straight away. Undo puts it back.</p>");
    h.push('<table class="rules-t"><thead><tr><th>Where and when</th>' +
      "<th>Printed in this order</th><th>Decided by</th><th></th>" +
      "</tr></thead><tbody>");
    coupled.forEach((c, ix) => {
      const yours = !!c.applied &&
        Object.prototype.hasOwnProperty.call(R.edits, c.applied);
      const at = c.sec + " " + c.timeText;
      h.push('<tr class="' + (yours ? "flipped" : "") + '"><td>' + esc(at) +
        (yours ? ' <span class="flag-you">turned round by you</span>' : "") +
        "</td><td>" + esc(c.units.join(", ")) + "</td><td>" +
        (yours ? "you, on this computer"
               : c.applied ? "the corrections list"
                           : "the position numbers in the report") +
        '</td><td><button type="button" class="btn ghost small" ' +
        (yours ? 'data-unflip="' + esc(c.applied) + '" aria-label="Undo ' +
                 esc(c.units.join("+")) + " at " + esc(at) + '">Undo'
               : 'data-flip="' + ix + '" aria-label="Reverse ' +
                 esc(c.units.join("+")) + " at " + esc(at) + '">Reverse') +
        "</button></td></tr>");
    });
    h.push("</tbody></table></section>");
  }
  if (editCount()) {
    h.push('<section class="rule-sec"><h3>Order corrections made on this ' +
      "computer</h3>");
    h.push("<p>In force for every book built here until you undo them, and " +
      "on this computer only — read this table out to us and they get built " +
      "into the tool for everybody.</p>");
    h.push('<table class="rules-t"><thead><tr><th>Location</th><th>When</th>' +
      "<th>Diagrams running together</th><th>Prints in this order</th>" +
      "</tr></thead><tbody>");
    for (const k of Object.keys(ruleEdits).sort()) {
      const row = SHEETS_RULES.orderRow(k, ruleEdits[k] || []);
      if (!row) continue;
      h.push("<tr><td>" + esc(row.where) + "</td><td>" + esc(row.when) +
        "</td><td>" + esc(row.formation) + "</td><td>" +
        (ruleEdits[k] === null ? "<i>correction switched off</i>"
                               : esc(row.prints)) + "</td></tr>");
    }
    h.push("</tbody></table>");
    h.push('<p><button type="button" class="btn ghost small" data-clear="1">' +
      "Undo all my corrections</button></p></section>");
  }
  h.push(SHEETS_RULES.explainHtml(rulesEnv(b, res, secNames),
                                  { only: ["corrections"] }));
  el.innerHTML = h.join("");

  const keep = () => { if (!persistEdits() && notify) notify(MSG.editNotKept, "warn"); };
  el.addEventListener("click", ev => {
    const t = ev.target;
    if (!t.getAttribute) return;
    const flip = t.getAttribute("data-flip");
    if (flip !== null) {
      const c = coupled[Number(flip)];
      /* the same formation on Monday and on Tuesday is one working; two
         DIFFERENT departures of it are two, and need a time in the key */
      const seen = coupled.filter(x => x.lookupDiags === c.lookupDiags).length > 1;
      const forms = SHEETS_RULES.keyForms(c.sec, c.timeText,
                                          c.lookupDiags.split(","));
      const key = SHEETS_RULES.chooseKey(forms, seen, false);
      const order = c.units.slice().reverse();
      if (SHEETS_RULES.validEdit(key, order)) return;
      ruleEdits[key] = order;
      keep(); rebuild();
      return;
    }
    const un = t.getAttribute("data-unflip");
    if (un) { delete ruleEdits[un]; keep(); rebuild(); return; }
    if (t.getAttribute("data-clear")) { ruleEdits = {}; keep(); rebuild(); }
  });
  return el;
}

/* ---------------- fleet sprites ----------------
   Stylised side profiles in the Southeastern manner: dark blue Electrostars
   and Javelins with yellow ends, white Networker metro stock. Inline SVG so
   the file stays offline. */
function sprite(cls) {
  const wheels =
    '<circle cx="20" cy="27" r="3" fill="#23282C"/>' +
    '<circle cx="32" cy="27" r="3" fill="#23282C"/>' +
    '<circle cx="100" cy="27" r="3" fill="#23282C"/>' +
    '<circle cx="112" cy="27" r="3" fill="#23282C"/>';
  const rail = '<rect x="0" y="30" width="132" height="1.2" fill="#5A6169"/>';
  if (cls === "395") {
    return '<svg viewBox="0 0 132 32" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Class 395 Javelin">' +
      '<path d="M4 6 a3 3 0 0 1 3-3 h103 l18 15 v5 a1.5 1.5 0 0 1-1.5 1.5 h-119.5 a3 3 0 0 1-3-3 z" fill="#26356B"/>' +
      '<path d="M113 3 l15 15 v4.6 a1.5 1.5 0 0 1-1.5 1.5 h-6.5 l-16-21 z" fill="#F5C400"/>' +
      '<rect x="10" y="8" width="92" height="5.4" rx="1.4" fill="#8FA0CE"/>' +
      '<rect x="4" y="19" width="110" height="2.4" fill="#E8EAF2"/>' +
      '<rect x="46" y="7" width="5" height="14" fill="#1B2751"/>' +
      '<rect x="78" y="7" width="5" height="14" fill="#1B2751"/>' +
      wheels + rail + "</svg>";
  }
  if (cls === "465") {
    return '<svg viewBox="0 0 132 32" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Class 465 Networker">' +
      '<path d="M4 8 a4 4 0 0 1 4-4 h112 a8 8 0 0 1 8 8 v10 a3 3 0 0 1-3 3 h-117 a4 4 0 0 1-4-4 z" fill="#F2F3F1" stroke="#B9BDB6" stroke-width="1"/>' +
      '<path d="M120 4 a8 8 0 0 1 8 8 v10 a3 3 0 0 1-3 3 h-7 v-21 z" fill="#FFD335"/>' +
      '<rect x="4" y="6" width="114" height="2.6" fill="#C8CBC4"/>' +
      '<rect x="10" y="10" width="104" height="6" rx="1.6" fill="#3A4348"/>' +
      '<rect x="34" y="9" width="9" height="15" fill="#AEB4AE"/>' +
      '<rect x="44" y="9" width="9" height="15" fill="#AEB4AE"/>' +
      '<rect x="84" y="9" width="9" height="15" fill="#AEB4AE"/>' +
      '<rect x="94" y="9" width="9" height="15" fill="#AEB4AE"/>' +
      wheels + rail + "</svg>";
  }
  // 375 Electrostar - Southeastern's dark blue livery, yellow warning end
  return '<svg viewBox="0 0 132 32" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Class 375 Electrostar">' +
    '<path d="M4 8 a4 4 0 0 1 4-4 h110 l10 7 v10 a3 3 0 0 1-3 3 h-117 a4 4 0 0 1-4-4 z" fill="#24346E"/>' +
    '<path d="M118 4 l10 7 v10 a3 3 0 0 1-3 3 h-7 v-20 z" fill="#FFD335"/>' +
    '<rect x="4" y="6" width="112" height="2.6" fill="#18244F"/>' +
    '<rect x="10" y="10" width="102" height="6.4" rx="1.6" fill="#9DACD9"/>' +
    '<rect x="40" y="9" width="8" height="15" fill="#3D4F94"/>' +
    '<rect x="88" y="9" width="8" height="15" fill="#3D4F94"/>' +
    wheels + rail + "</svg>";
}
const lineupEl = $("#lineup");
if (lineupEl) {
  lineupEl.innerHTML = [["375", "Mainline"], ["465", "Metro"], ["395", "High Speed"]]
    .map(([c, name]) =>
      "<figure>" + sprite(c) + "<figcaption>" + c + " · " + name +
      "</figcaption></figure>").join("");
}

/* ---------------- the cards ---------------- */
function roadHead(i, road, fleetLabel, spriteCls) {
  const head = document.createElement("div");
  head.className = "road-head";
  head.innerHTML = '<span class="road-no">Road ' + (i + 1) + "</span>" +
    '<h2 class="road-name">' + escHtml(road) + "</h2>" +
    '<span class="road-fleet">' + escHtml(fleetLabel) + "</span>" +
    '<span class="road-sprite" aria-hidden="true">' + sprite(spriteCls) + "</span>";
  return head;
}
/* A road with nothing on it: same head, one line saying why. */
function emptyRoadCard(i, road, fleetLabel, spriteCls, why, wide) {
  const art = document.createElement("article");
  art.className = "road" + (wide ? " empty-wide" : "");
  art.dataset.road = road;
  const p = document.createElement("p");
  p.className = "nothing";
  p.textContent = why;
  art.append(roadHead(i, road, fleetLabel, spriteCls), p);
  return art;
}

/* The Review tab, grouped by what kind of thing each item is, so a wall of
   sentences reads as four short lists. The kinds are read off the wording
   the pipelines use; anything unrecognised is a plain note. */
const REVIEW_KINDS = [
  ["Plan changed since the book was saved", "plan changes", "moved",
    /plan has (moved|changed)|saved book|in this plan|entries differ/i],
  ["Left off the sheet", "left off", "", /^left off/i],
  ["Platform stands", "platform stands", "", /^(not counted as a berthing|taken as a berthing)/i],
  ["Reissue", "reissue notes", "", /reissue/i],
  ["Order to check", "order checks", "",
    /order|which way round|which end leads|end marker|formation|correction|position/i],
  ["Locations and codes", "look-ups", "",
    /look-up|no code|read as|section list|new section|location/i],
  ["Notes", "notes", "", /./],
];
function groupReviews(items) {
  const groups = REVIEW_KINDS.map(k => ({ kind: k, items: [] }));
  for (const it of items) {
    const g = groups.find(x => x.kind[3].test(it));
    (g || groups[groups.length - 1]).items.push(it);
  }
  return groups.filter(g => g.items.length);
}
function reviewPane(items) {
  if (!items.length) return '<p class="noreviews">' + MSG.nothingToReview + "</p>";
  return '<div class="reviews">' + groupReviews(items).map(g =>
    '<div class="revgroup"><h4><span class="chip' + (g.kind[2] ? " " + g.kind[2] : "") +
    '">' + escHtml(g.kind[0]) + " · " + g.items.length + "</span></h4><ul>" +
    g.items.map(it => "<li>" + escHtml(it) + "</li>").join("") + "</ul></div>").join("") +
    "</div>";
}
/* the chips on the card: the total, then the biggest three kinds */
function reviewChips(items) {
  if (!items.length) return [{ cls: "clean", text: MSG.nothingToReview }];
  const out = [{ cls: "review", text: MSG.toReview(items.length) }];
  for (const g of groupReviews(items).slice(0, 3))
    out.push({ cls: g.kind[2], text: g.items.length + " " + g.kind[1] });
  return out;
}

/* One worksheet per location (Metro) or per day (395): a picker, not a tab
   strip - fourteen tabs took the card over. */
function metroPane(sheets, what) {
  const wrap = document.createElement("div");
  const bar = document.createElement("div");
  bar.className = "pickbar";
  const lab = document.createElement("label");
  lab.textContent = what || "Location";
  const sel = document.createElement("select");
  sheets.forEach((sh, i) => {
    const o = document.createElement("option");
    o.value = String(i);
    o.textContent = sh.name;
    sel.appendChild(o);
  });
  lab.appendChild(sel);
  bar.appendChild(lab);
  const note = document.createElement("span");
  note.className = "picknote";
  note.textContent = sheets.length + " in this book · one worksheet each";
  bar.appendChild(note);
  const view = document.createElement("div");
  view.className = "metro-view";
  const draw = () => { view.innerHTML = X.previewHtml(sheets[+sel.value].layout); };
  sel.addEventListener("change", draw);
  draw();
  wrap.appendChild(bar);
  wrap.appendChild(view);
  return wrap;
}

/* A road card: head, the unit rolling in with the counts, the review chips,
   the actions, and the preview - open, on its first tab, unless the card
   was closed before a rebuild. */
function roadCard(spec) {
  const { i, road, fleetLabel, spriteCls, unitHtml, chips, panes, saves,
          restore, wide } = spec;
  const art = document.createElement("article");
  art.className = "road" + (wide ? " wide" : "");
  art.dataset.road = road;
  const head = roadHead(i, road, fleetLabel, spriteCls);
  const track = document.createElement("div");
  track.className = "track";
  const unit = document.createElement("div");
  unit.className = "unit";
  unit.style.animationDelay = (i * 90) + "ms";
  unit.innerHTML = '<span aria-hidden="true">' + sprite(spriteCls) + "</span>" + unitHtml;
  track.appendChild(unit);
  const chipRow = document.createElement("div");
  chipRow.className = "chips";
  chipRow.innerHTML = chips.map(c =>
    '<span class="chip' + (c.cls ? " " + c.cls : "") + '">' + escHtml(c.text) + "</span>").join("");
  const acts = document.createElement("div");
  acts.className = "acts";
  const bp = document.createElement("button");
  bp.type = "button"; bp.className = "btn ghost";
  acts.appendChild(bp);
  for (const [label, fn] of saves) {
    const b = document.createElement("button");
    b.type = "button"; b.className = "btn"; b.textContent = label;
    b.addEventListener("click", fn);
    acts.appendChild(b);
  }
  const panel = document.createElement("div");
  panel.className = "panel";
  panel.id = "panel-" + (++tabSeq);
  const { tabs, view, select, current } = tabbed(panes);
  panel.append(tabs, view);
  bp.setAttribute("aria-controls", panel.id);
  let opened = false;
  const show = open => {
    panel.hidden = !open;
    bp.textContent = open ? "Close preview" : "Open preview";
    bp.setAttribute("aria-expanded", open ? "true" : "false");
    if (open && !opened) { opened = true; select(0); }
  };
  bp.addEventListener("click", () => show(panel.hidden));
  if (restore && restore.open === false) show(false);
  else if (restore) {
    show(true);
    select(Math.min(restore.tab || 0, panes.length - 1));
    view.scrollTop = restore.top || 0;
    view.scrollLeft = restore.left || 0;
  } else show(true);
  art.openState = () => panel.hidden
    ? { open: false } : { open: true, tab: current(), top: view.scrollTop, left: view.scrollLeft };
  art.append(head, track, chipRow, acts, panel);
  return art;
}

/* ---------------- the mode switch ---------------- */
const MODES = { wk: { tab: $("#mode_wk"), panel: $("#wkPanel") },
                we: { tab: $("#mode_we"), panel: $("#wePanel") } };
function currentMode() {
  return MODES.we.tab && MODES.we.tab.getAttribute("aria-selected") === "true" ? "we" : "wk";
}
function switchMode(m) {
  for (const k of Object.keys(MODES)) {
    const on = k === m;
    if (MODES[k].tab) MODES[k].tab.setAttribute("aria-selected", on ? "true" : "false");
    if (MODES[k].panel) MODES[k].panel.hidden = !on;
  }
  rememberOpts({ mode: m });
}
for (const k of Object.keys(MODES))
  if (MODES[k].tab) MODES[k].tab.addEventListener("click", () => switchMode(k));
if (savedOpts.mode === "we") switchMode("we");

/* ---------------- one panel: what both share ---------------- */
function makePanel(ids) {
  const statusEl = $(ids.status);
  const say = (msg, kind) => {
    statusEl.textContent = msg;
    statusEl.className = "status" + (kind ? " " + kind : "");
  };
  /* Every build, rebuild and paste goes through one queue so clicks cannot
     overlap - and every job on it is caught, so a fault in one cannot leave
     the queue rejected and swallow the next drop. */
  let q = Promise.resolve();
  const enqueue = fn => {
    q = q.then(fn).catch(e => say(MSG.failed(e), "err"));
    return q;
  };
  const roadsEl = $(ids.roads), allbar = $(ids.allbar), allnote = $(ids.allnote),
        optsRow = $(ids.optsRow);
  /* what was open, and what had focus, so a rebuild puts both back */
  function captureOpen() {
    const open = new Map();
    for (const el of roadsEl.children)
      if (el.openState) open.set(el.dataset.road, el.openState());
    const a = document.activeElement;
    const card = a && a.closest ? a.closest(".road") : null;
    const focus = card && roadsEl.contains(card)
      ? { road: card.dataset.road, text: a.textContent } : null;
    return { open, focus };
  }
  function restoreFocus(state) {
    if (!state || !state.focus) return;
    for (const el of roadsEl.children) {
      if (el.dataset.road !== state.focus.road) continue;
      for (const b of el.querySelectorAll("button"))
        if (b.textContent === state.focus.text) { b.focus({ preventScroll: true }); return; }
    }
  }
  function showBars(on, labelText) {
    allbar.hidden = !on;
    if (optsRow) optsRow.hidden = !on;
    allnote.textContent = on ? (labelText || "") : "";
  }
  /* the paste box: toggle, filled-marking, a file dragged into a box, clear */
  const pw = $(ids.pasteWrap), pt = $(ids.pasteToggle), pSayEl = $(ids.pasteSay);
  const boxes = ids.boxes.map(s => $(s)).filter(Boolean);
  const pSay = (msg, cls) => {
    if (!pSayEl) return;
    pSayEl.textContent = msg || "";
    pSayEl.className = "paste-say" + (cls ? " " + cls : "");
  };
  const markFilled = el => { if (el) el.classList.toggle("filled", !!el.value.trim()); };
  if (pt && pw) pt.addEventListener("click", () => {
    const open = pw.hidden;
    pw.hidden = !open;
    pt.setAttribute("aria-expanded", open ? "true" : "false");
    if (open && boxes[0]) boxes[0].focus();
  });
  for (const el of boxes) {
    el.addEventListener("input", () => { markFilled(el); pSay(""); });
    wireBoxDrop(el, (name, err) =>
      pSay(err ? MSG.boxReadFailed(name) : MSG.readIntoBox(name), err ? "err" : "go"));
  }
  const clearEl = $(ids.pasteClear);
  if (clearEl) clearEl.addEventListener("click", () => {
    for (const el of boxes) { el.value = ""; markFilled(el); }
    pSay(MSG.boxesCleared);
    if (boxes[0]) boxes[0].focus();
  });
  const clearBoxes = () => { for (const el of boxes) { el.value = ""; markFilled(el); } pSay(""); };
  return { say, enqueue, roadsEl, allbar, allnote, showBars, captureOpen,
           restoreFocus, pSay, boxes, clearBoxes };
}

const panels = {};

/* ================= weekday panel: Genius / Integrale reports ================= */
(function weekday() {
  const P = makePanel({
    status: "#status", roads: "#roads", allbar: "#allbar", allnote: "#allnote",
    optsRow: "#optsrow", pasteWrap: "#pastebox", pasteToggle: "#pastetoggle",
    pasteSay: "#paste_say", pasteClear: "#paste_clear",
    boxes: ["#paste_sum", "#paste_det"],
  });
  const { say, enqueue, roadsEl } = P;
  const [pasteSum, pasteDet] = P.boxes;
  const zoneStrong = document.querySelector("#berth .berth-txt strong");
  const zoneSub = document.querySelector("#berth .berth-txt span");
  const ZONE_DEFAULT = [zoneStrong.textContent, zoneSub.textContent];
  const zone = (a, b) => { zoneStrong.textContent = a; zoneSub.textContent = b; };
  const opt = id => { const el = document.getElementById(id); return !!(el && el.checked); };
  const optsHelp = $("#optshelp"), optsHint = $("#optshint");
  if (optsHelp && optsHint) optsHelp.addEventListener("click", () => {
    const open = optsHint.hidden;
    optsHint.hidden = !open;
    optsHelp.setAttribute("aria-expanded", open ? "true" : "false");
  });

  let built = null, zipName = "SHEETS_BOOKS.zip";
  let lastRes = null;        // the last build, for the rebuilds and the toggles
  let lastInputs = null;     // the pair itself, for the rebuilds that re-run the build
  /* Books on screen are one click from a Save button and only their file
     name says which day they are, so they must not outlive the pair that
     built them. Returns whether anything was actually showing. */
  function clearBooks() {
    const had = !!(built && built.length);
    roadsEl.textContent = "";
    P.showBars(false);
    built = null; lastRes = null; lastInputs = null;
    return had;
  }
  const have = {};           // sum / det, whichever has arrived
  let dropId = 0;

  async function buildGenius() {
    say(MSG.reading); await paint();
    if (have.sum && have.det)
      lastInputs = { csv: have.sum.fmt === "csv",
                     pair: have.sum.data.concat(have.det.data) };
    const opts = { orderFix: ruleEdits, platformStands: opt("platstand") };
    const res = lastInputs.csv
      ? GENIUS.buildIntegrale(lastInputs.pair, opts)
      : await GENIUS.build(lastInputs.pair, opts);
    lastRes = res;
    await renderBooks(res);
  }
  const rebuild = (msg, rerun) => enqueue(async () => {
    if (!lastRes) return;
    if (rerun) await buildGenius(); else await renderBooks(lastRes);
    if (msg) say(msg, "go");
  });

  /* The books, one descriptor each: what to write, what to preview, which
     review items are its own. The Ramsgate book is cut from the mainline
     day, so it keeps the mainline items tagged RAMSGATE plus the general
     ones. The depot's own documents (Metro, 395) are not berthing books. */
  const BOOKS = [
    { road: "Mainline", file: "SHEETS_", kind: "berthing", hc: "main", ram: false,
      fleet: "Mainline", label: "375 / 376 / 377", sprite: "375",
      secs: r => r.secsByDay, order: r => X.bookOrder(r.secsByDay, X.MAIN_ORDER, true),
      rev: "main", opts: {} },
    { road: "Ramsgate", file: "RAM_SHEETS_", kind: "berthing", hc: "main", ram: true,
      fleet: "Ramsgate", label: "cut from the mainline day", sprite: "375",
      secs: r => r.secsByDay, order: () => null, rev: "ram", opts: {} },
    { road: "Metro", file: "METRO_SHEETS_", kind: "metro", hc: "metro", ram: false,
      fleet: "Metro", label: "465 / 466 / 707", sprite: "465", cycle: true, wide: true,
      secs: r => r.metroSecs, order: r => X.bookOrder(r.metroSecs, X.METRO_ORDER, false),
      rev: "metro", opts: { baseOrder: X.METRO_ORDER, splitRamsgate: false } },
    { road: "High Speed", file: "HS_SHEETS_", kind: "hs", hc: "hs", ram: false,
      fleet: "High Speed", label: "395", sprite: "395", cycle: true, wide: true,
      secs: r => r.hsSecs, order: r => X.bookOrder(r.hsSecs, X.HS_ORDER, false),
      rev: "hs", opts: { baseOrder: [], splitRamsgate: false } },
  ];
  const WRITE = {
    berthing: (b, res, opts) => X.writeBooks(b.secs(res), res.labels, b.ram, opts),
    metro: (b, res) => METRO.writeMetroBook(b.secs(res), res.labels, b.order(res), zipFn, res.dates),
    hs: (b, res) => HS.writeHsBook(b.secs(res), res.labels, res.dates, zipFn),
  };

  async function renderBooks(res) {
    say(MSG.writing); await paint();
    const dayKeys = ["M", "T", "W", "TH", "F"].filter(k => k in res.labels);
    const msgs = list => list.map(x => x.msg);
    /* what moved since a book for this date was saved here goes FIRST: a
       printed book that no longer matches the plan beats every other note */
    const moved = {
      main: sinceSaved(res, res.secsByDay, "main"),
      metro: sinceSaved(res, res.metroSecs, "metro"),
      hs: sinceSaved(res, res.hsSecs, "hs"),
    };
    const ramOnly = list => list.filter(x => !x.sec || x.sec === "RAMSGATE");
    const revs = {
      main: msgs(moved.main.concat(res.reviews.main)),
      ram: msgs(ramOnly(moved.main).concat(ramOnly(res.reviews.main))),
      metro: msgs(moved.metro.concat(res.reviews.metro)),
      hs: msgs(moved.hs.concat(res.reviews.hs)),
    };
    const movedCount = moved.main.length + moved.metro.length + moved.hs.length;
    const state = P.captureOpen();
    roadsEl.textContent = "";
    const books = [];
    for (let i = 0; i < BOOKS.length; i++) {
      const b = BOOKS[i];
      const secs = b.secs(res);
      let entries = 0;
      const secNames = new Set();
      const splitByRamsgate = b.kind === "berthing";
      for (const d of dayKeys)
        for (const [name, list] of (secs[d] || new Map())) {
          if (splitByRamsgate && b.ram !== (name === "RAMSGATE")) continue;
          if (list.length) { secNames.add(name); entries += list.length; }
        }
      if (!entries) {
        roadsEl.appendChild(emptyRoadCard(i, b.road, b.label, b.sprite,
          MSG.emptyBook(b.fleet, b.cycle, false), b.wide));
        continue;
      }
      const allHc = opt("hc_main") && b.hc === "main";
      /* mileage is a berthing-book column; the Metro book has MILES of its
         own and the 395 sheet its MG */
      const wantMiles = opt("milescol") && b.kind === "berthing";
      const opts = Object.assign({ allHeadcodes: allHc, miles: wantMiles }, b.opts);
      const review = revs[b.rev];
      /* the file is written when it is asked for - a toggle that changes one
         book no longer writes four */
      let bytes = null;
      const book = { road: b.road, name: b.file + res.tag + ".xlsx",
                     bytes: () => bytes || (bytes = WRITE[b.kind](b, res, opts)) };
      books.push(book);
      let panes;
      if (b.kind === "berthing") {
        panes = dayKeys.map(d => [X.DAY_SHEET[d], () => {
          const day = secs[d];
          if (!day || !day.size) return '<p class="noreviews">' + MSG.noEntries + "</p>";
          return X.dayPreviewHtml(day, res.labels[d], b.ram, b.order(res), allHc,
                                  true, wantMiles);
        }]);
      } else {
        const sheets = b.kind === "metro"
          ? METRO.sheetsFor(secs, res.labels, b.order(res), res.dates)
          : HS.sheetsFor(secs, res.labels, res.dates);
        panes = [[b.kind === "metro" ? "Sheet" : "Allocations",
                  () => metroPane(sheets, b.kind === "metro" ? "Location" : "Day")]];
      }
      panes.push(["Review" + (review.length ? " (" + review.length + ")" : ""),
                  () => reviewPane(review)]);
      /* no Unit order tab on the depot's own documents: the Metro sheet
         reads by position, and a button that changes nothing is worse
         than none */
      if (b.kind === "berthing")
        panes.push(["Unit order" + (editCount() ? " (" + editCount() + ")" : ""),
                    () => orderPane(b, res, () => rebuild(MSG.rebuilt("with your order correction"), true),
                                    secNames, say)]);
      panes.push(["Rules", () => rulesPane(b, res, secNames, b.kind === "berthing" ? null : b.kind)]);
      const unitHtml = "<b>" + entries + "</b> " + (entries === 1 ? "entry" : "entries") +
        " · " + plural(secNames.size, "section");
      roadsEl.appendChild(roadCard({
        i, road: b.road, fleetLabel: b.label, spriteCls: b.sprite, unitHtml,
        chips: reviewChips(review), panes, wide: b.wide,
        saves: [["Save book", () => {
          storePrinted(res);
          download(book.name, book.bytes(), XLSX_MIME);
          say(MSG.saved(book.name), "go");
        }]],
        restore: state.open.get(b.road),
      }));
      await paint();
    }
    /* the stock requirements form, when asked for: the depot's Kent Coast
       form with the counts filled in, on a card of its own */
    if (opt("stockreq") && res.stock) {
      let bytes = null;
      const book = { road: "Stock requirements",
                     name: "STOCK_REQUIREMENTS_" + res.tag + ".xlsx",
                     bytes: () => bytes || (bytes = SHEETS_STOCKREQ.write(res.stock, res.labels, zipFn)) };
      const units = SHEETS_STOCKREQ.unitCount(res.stock);
      const days = Object.keys(res.stock).filter(dk => res.stock[dk] && res.stock[dk].size);
      if (days.length) {
        books.push(book);
        roadsEl.appendChild(roadCard({
          i: BOOKS.length, road: "Stock requirements", fleetLabel: "Kent Coast form",
          spriteCls: "375", wide: true,
          unitHtml: "<b>" + units + "</b> " + (units === 1 ? "unit" : "units") +
            " standing at the start of the day",
          chips: [{ cls: "clean", text: "Counts filled in · POSITION and SEAT LOSS for the planner" }],
          panes: days.map(dk => [X.DAY_SHEET[dk] || dk,
            () => SHEETS_STOCKREQ.previewHtml(res.stock[dk], res.labels[dk])]),
          saves: [["Save form", () => {
            download(book.name, book.bytes(), XLSX_MIME);
            say(MSG.saved(book.name), "go");
          }]],
          restore: state.open.get("Stock requirements"),
        }));
      }
    }
    built = books;
    zipName = "SHEETS_BOOKS_" + res.tag + ".zip";
    const labels = Object.values(res.labels).join(", ");
    P.showBars(books.length > 0, labels);
    P.restoreFocus(state);
    const n = res.review.length, ed = editCount();
    say(MSG.built(labels, n, movedCount, ed),
        (movedCount || n || ed) ? "warn" : "go");
  }

  /* ---- what arrives on the drop zone ---- */
  const srcName = fmt => fmt === "csv" ? "Integrale" : "Genius";
  const family = fmt => fmt === "csv" ? "integrale" : "genius";
  /* Two reports of the same kind in ONE drop are two days of the same
     report, so they are kept together; a later drop starts the slot again. */
  function stash(kind, fmt, data) {
    if (have[kind] && have[kind].drop === dropId &&
        family(have[kind].fmt) === family(fmt)) have[kind].data.push(data);
    else have[kind] = { fmt, data: [data], drop: dropId };
  }
  async function accept(file) {
    const nm = file.name.toLowerCase();
    if (nm.endsWith(".docx") || nm.endsWith(".doc")) {
      /* the weekend's paperwork, on the weekday zone: sent where it goes */
      say(MSG.sentToWeekend(file.name));
      switchMode("we");
      panels.weekend.dropFiles([file]);
      return;
    }
    if (nm.endsWith(".xlsx") || nm.endsWith(".xls")) { say(MSG.notASheetInput, "err"); return; }
    if (nm.endsWith(".csv") || nm.endsWith(".txt")) {
      const text = decodeText(new Uint8Array(await file.arrayBuffer()));
      let kind = null, fmt = "csv";
      try { kind = GENIUS.sniffIntegrale(text); } catch (e) {}
      if (!kind) { try { kind = GENIUS.sniffGeniusCsv(text); fmt = "gcsv"; } catch (e) {} }
      if (!kind) {
        /* a text save of the weekend prints, sent where it goes */
        if (SHEETS_PRINTS.looksLikePrints(text) || SHEETS_PRINTS.printsFromCsv(text)) {
          say(MSG.sentToWeekend(file.name));
          switchMode("we");
          panels.weekend.dropFiles([file]);
          return;
        }
        say(MSG.notAReport(file.name), "err");
        return;
      }
      stash(kind, fmt, text);
      return;
    }
    if (!nm.endsWith(".pdf")) { say(MSG.notThisPanel, "err"); return; }
    const u8 = new Uint8Array(await file.arrayBuffer());
    let txt = null;
    try { txt = GENIUS.pdfText(u8); } catch (e) { say(MSG.pdfUnreadable(file.name), "err"); return; }
    let kind = null;
    if (/DIAGRAM SUMMARY REPORT/i.test(txt)) kind = "sum";
    else if (/Diagram Detail Report/i.test(txt)) kind = "det";
    if (!kind) { say(MSG.notAGeniusPdf(file.name), "err"); return; }
    /* the text, extracted once here and never again by the build */
    stash(kind, "pdf", { pdfText: txt });
  }
  async function drained() {
    if (have.sum && have.det) {
      if (family(have.sum.fmt) !== family(have.det.fmt)) {
        say(MSG.mixed(srcName(have.sum.fmt), srcName(have.det.fmt)), "err");
        zone(MSG.zoneMixed[0], MSG.zoneMixed[1]);
        /* nothing that was just refused is kept: a leftover half pairs with
           the next drop's first file and builds the wrong day */
        delete have.sum; delete have.det;
        return;
      }
      try { await buildGenius(); }
      catch (err) { say(MSG.failed(err), "err"); clearBooks(); }
      delete have.sum; delete have.det;
      zone(ZONE_DEFAULT[0], ZONE_DEFAULT[1]);
    } else if (have.sum || have.det) {
      const kind = have.sum ? "sum" : "det";
      const fmt = have[kind].fmt;
      const got = kind === "sum" ? "Summary" : "Detail";
      const want = kind === "sum" ? "Diagram Detail" : "Diagram Summary";
      const what = family(fmt) === "integrale" ? "CSV" : "report";
      /* a report arriving on top of a finished build makes those books the
         previous day's, and only the file name would say so */
      const had = clearBooks();
      say(MSG.half(srcName(fmt), got, want, what, had));
      const z = MSG.zoneHalf(srcName(fmt), got, want, what);
      zone(z[0], z[1]);
    }
  }
  /* One drop is one job: every file in it is read before anything is built,
     and a file that cannot be read says so without taking the rest down. */
  function dropFiles(files) {
    dropId++;
    enqueue(async () => {
      for (const f of files) {
        try { await accept(f); }
        catch (err) { say(MSG.readFailed(f.name, err), "err"); }
      }
      await drained();
    });
  }
  wireDrop($("#berth"), $("#file"), dropFiles);
  panels.weekday = { dropFiles };

  $("#dlall").addEventListener("click", () => {
    if (!built || !built.length) return;
    if (lastRes) storePrinted(lastRes);
    downloadZip(zipName, built.map(b => [b.name, b.bytes()]));
    say(MSG.savedZip(zipName, built.length), "go");
  });
  $("#clearall").addEventListener("click", () => {
    clearBooks();
    delete have.sum; delete have.det;
    P.clearBoxes();
    zone(ZONE_DEFAULT[0], ZONE_DEFAULT[1]);
    say(MSG.cleared);
  });
  /* the option boxes: headcodes, mileage and the form only change how the
     books are written out; platform stands change what the build produces */
  const onOpt = (id, fn) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("change", () => { rememberOpts(); fn(el.checked); });
  };
  onOpt("hc_main", () => rebuild(MSG.rebuilt("with the new headcode setting")));
  onOpt("milescol", on => rebuild(MSG.rebuilt(on ? "with the mileage column" : "without the mileage column")));
  onOpt("stockreq", on => rebuild(on ? MSG.stockOn : MSG.stockOff));
  onOpt("platstand", on => rebuild(MSG.rebuilt(on ? "with long platform stands counted" : "without platform stands"), true));

  /* ---- the same two reports pasted in as text ----
     Everything after the sniff is the drop path exactly: the same stash
     slots, the same drained(), so a pasted pair and a dropped pair cannot
     build differently. Which report a box holds is read off the text, not
     off which box it is. */
  function sniffPaste(el, label) {
    const raw = el ? el.value : "";
    const text = GENIUS.pastedCsv(raw);
    if (!text) return { empty: true, el, label };
    let kind = null, fmt = "csv";
    try { kind = GENIUS.sniffIntegrale(text); } catch (e) {}
    if (!kind) { try { kind = GENIUS.sniffGeniusCsv(text); fmt = "gcsv"; } catch (e) {} }
    if (kind) return { kind, fmt, text, el, label };
    /* the report titles sit on every line of a Genius export and the sniffer
       reads the first, so text that names the report but does not sniff is
       a copy that began part way through a line */
    const names = /Diagram Detail Report|DIAGRAM SUMMARY REPORT|Diagram Code|Diagram Summary for:/.test(text);
    return { err: names ? MSG.pastePartial(label) : MSG.pasteNotReport(label), el };
  }
  async function buildFromPaste() {
    const got = [sniffPaste(pasteSum, "Diagram Summary"),
                 sniffPaste(pasteDet, "Diagram Detail")];
    for (const g of got)
      if (g.err) { P.pSay(g.err, "err"); if (g.el) g.el.focus(); return; }
    const filled = got.filter(g => !g.empty);
    if (!filled.length) { P.pSay(MSG.pasteOne, "err"); if (pasteSum) pasteSum.focus(); return; }
    if (filled.length === 2 && filled[0].kind === filled[1].kind) {
      P.pSay(MSG.pasteSame(filled[0].kind === "sum" ? "Summary" : "Detail"), "err");
      return;
    }
    /* a box left empty is filled from whatever has already arrived -
       dropped as a file, or pasted before - and only a report that is
       nowhere at all is refused */
    const from = {};
    for (const g of filled) from[g.kind] = g;
    const NAME = { sum: "Diagram Summary", det: "Diagram Detail" };
    const missing = ["sum", "det"].filter(k => !from[k] && !have[k]);
    if (missing.length) {
      P.pSay(MSG.pasteNeeds(NAME[missing[0]]), "err");
      const other = got.find(g => g.empty);
      if (other && other.el) other.el.focus();
      return;
    }
    dropId++;
    for (const k of Object.keys(from))
      have[k] = { fmt: from[k].fmt, data: [from[k].text], drop: dropId };
    const swapped = !got[0].empty && got[0].kind !== "sum";
    const used = ["sum", "det"].filter(k => !from[k]);
    P.pSay(swapped ? MSG.pasteSwapped : (used.length ? MSG.pasteUsedLoaded(NAME[used[0]]) : ""),
           swapped || used.length ? "go" : "");
    await drained();
  }
  $("#paste_go").addEventListener("click", () =>
    enqueue(() => buildFromPaste().catch(err => P.pSay(MSG.pasteUnreadable(err), "err"))));

  /* the board's first line: idle, unless this computer's storage owes a notice */
  if (!store) say(MSG.storageOff, "warn");
  else if (rulesDiscarded) say(MSG.rulesDiscarded, "warn");
  else say(MSG.idle);
})();

/* ================= weekend panel: diagram prints ================= */
(function weekend() {
  const P = makePanel({
    status: "#we_status", roads: "#we_roads", allbar: "#we_allbar", allnote: "#we_allnote",
    optsRow: "#we_optsrow", pasteWrap: "#we_pastebox", pasteToggle: "#we_pastetoggle",
    pasteSay: "#we_paste_say", pasteClear: "#we_paste_clear",
    boxes: ["#we_paste_main", "#we_paste_re"],
  });
  const { say, enqueue, roadsEl } = P;
  const [wePasteMain, wePasteRe] = P.boxes;
  let built = null;
  let loadedDocs = [];
  const SPRITE_FOR = { Mainline: "375", Metro: "465", "High Speed": "395" };
  const roadName = r => r === "RAM SHEETS" ? "Ramsgate" : r;
  const isWide = r => r === "Metro" || r === "High Speed";

  function render(res) {
    const state = P.captureOpen();
    roadsEl.textContent = "";
    res.books.forEach((b, i) => {
      const road = roadName(b.road);
      if (b.skipped) {
        roadsEl.appendChild(emptyRoadCard(i, road, b.label, SPRITE_FOR[b.road] || "375",
          MSG.emptyBook(road, false, true), isWide(b.road)));
        return;
      }
      const items = b.report.split("\n").filter(l => l.startsWith("- ")).map(l => l.slice(2));
      const panes = [
        ["Sheet", () => X.previewHtml(b.layout)],
        ["Review" + (items.length ? " (" + items.length + ")" : ""), () => reviewPane(items)],
      ];
      roadsEl.appendChild(roadCard({
        i, road, fleetLabel: b.label, spriteCls: SPRITE_FOR[b.road] || "375",
        unitHtml: "<b>" + b.entries + "</b> " + (b.entries === 1 ? "entry" : "entries") +
          " · " + plural(b.sections, "section"),
        chips: reviewChips(items), panes, wide: isWide(b.road),
        saves: [["Save book", () => {
          download(b.name, b.xlsx, XLSX_MIME);
          say(MSG.saved(b.name), "go");
        }]],
        restore: state.open.get(road),
      }));
    });
    const live = res.books.filter(b => !b.skipped);
    P.showBars(live.length > 0, res.banner + " · " + plural(res.diagrams, "diagram") + " read");
    P.restoreFocus(state);
  }

  const weHc = { Mainline: $("#we_hc_main"), Metro: $("#we_hc_metro"),
                 "High Speed": $("#we_hc_hs") };
  function rebuildFromLoaded() {
    const allHeadcodes = {};
    for (const road of Object.keys(weHc))
      allHeadcodes[road] = !!(weHc[road] && weHc[road].checked);
    const res = SheetsEngine.run(loadedDocs,
      b => fflate.unzipSync(b), zipFn,
      /* Ramsgate as a book of its own, as the weekday panel has it */
      { allHeadcodes, splitRamsgate: true });
    built = res;
    render(res);
    const dlupd = $("#we_dlupd");
    if (dlupd) dlupd.hidden = !res.updated;
    const total = res.books.filter(b => !b.skipped).reduce((a, b) => a + b.entries, 0);
    say(MSG.weBuilt(res.banner, total,
      res.merge ? { replaced: res.merge.replaced.length, added: res.merge.added.length } : null,
      loadedDocs.length), "go");
  }

  /* One drop is one job. A file that cannot be read says so and the rest
     still build; one of the weekday reports dropped here is sent up. */
  function dropFiles(files) {
    if (!files.length) return;
    switchMode("we");
    enqueue(async () => {
      say(MSG.readingFiles(files.map(f => f.name)));
      const reads = await Promise.allSettled(files.map(f => new Promise((res, rej) => {
        const fr = new FileReader();
        fr.onerror = () => rej(new Error(MSG.weReadFailed(f.name)));
        fr.onload = () => res({ name: f.name, bytes: new Uint8Array(fr.result) });
        fr.readAsArrayBuffer(f);
      })));
      const newDocs = [];
      for (const r of reads) {
        if (r.status === "fulfilled") newDocs.push(r.value);
        else say(r.reason.message, "err");
      }
      const weekday = [];
      for (const d of newDocs) {
        if (!/\.(csv|txt)$/i.test(d.name)) continue;
        let txt = "";
        try { txt = decodeText(d.bytes.slice(0, 65536)); } catch (e) { txt = ""; }
        if (txt && !SHEETS_PRINTS.looksLikePrints(txt) && !SHEETS_PRINTS.printsFromCsv(txt) &&
            (GENIUS.sniffGeniusCsv(txt) || GENIUS.sniffIntegrale(txt))) weekday.push(d);
      }
      if (weekday.length) {
        say(MSG.sentToWeekday(weekday.map(d => d.name).join(", ")));
        switchMode("wk");
        panels.weekday.dropFiles(files.filter(f => weekday.some(d => d.name === f.name)));
      }
      const docs = newDocs.filter(d => !weekday.includes(d));
      if (!docs.length) return;
      for (const d of docs) {
        const i = loadedDocs.findIndex(x => x.name === d.name);
        if (i >= 0) loadedDocs[i] = d; else loadedDocs.push(d);
      }
      try { rebuildFromLoaded(); }
      catch (err) {
        loadedDocs = loadedDocs.filter(d => !docs.some(n => n.name === d.name));
        if (!loadedDocs.length) { built = null; roadsEl.textContent = ""; P.showBars(false); }
        else { try { rebuildFromLoaded(); } catch (e2) { /* keep the previous view */ } }
        say(err && err.message ? err.message : MSG.weUnreadable, "err");
      }
    });
  }
  wireDrop($("#we_berth"), $("#we_file"), dropFiles);
  panels.weekend = { dropFiles };

  /* ---- the prints pasted in as text ----
     A paste joins the pipeline one step in, as a document like any other;
     the tabs are the structure, so the text is handed over as pasted. */
  const asDoc = (name, text) => ({ name, bytes: new TextEncoder().encode(text) });
  const readsAsPrints = t => SHEETS_PRINTS.looksLikePrints(t) || !!SHEETS_PRINTS.printsFromCsv(t);
  $("#we_paste_go").addEventListener("click", () => enqueue(async () => {
    const main = (wePasteMain ? wePasteMain.value : "").replace(/^﻿/, "");
    const re = (wePasteRe ? wePasteRe.value : "").replace(/^﻿/, "");
    if (!main.trim()) { P.pSay(MSG.wePasteEmpty, "err"); if (wePasteMain) wePasteMain.focus(); return; }
    if (!readsAsPrints(main)) {
      const weekday = GENIUS.sniffGeniusCsv(main) || GENIUS.sniffIntegrale(main);
      P.pSay(weekday ? MSG.wePasteWeekday : MSG.wePasteFlat, "err");
      if (wePasteMain) wePasteMain.focus();
      return;
    }
    if (re.trim() && !readsAsPrints(re)) {
      P.pSay(MSG.wePasteReissue, "err"); if (wePasteRe) wePasteRe.focus(); return;
    }
    const docs = [asDoc("PASTED PRINTS.txt", main)];
    if (re.trim()) docs.push(asDoc("PASTED reissue prints.txt", re));
    const before = loadedDocs;
    loadedDocs = docs;
    try { rebuildFromLoaded(); P.pSay(MSG.wePasted(!!re.trim()), "go"); }
    catch (err) { loadedDocs = before; P.pSay(MSG.wePasteFailed(err), "err"); }
  }));
  for (const road of Object.keys(weHc)) {
    if (!weHc[road]) continue;
    weHc[road].addEventListener("change", () => enqueue(() => {
      rememberOpts();
      if (!loadedDocs.length) return;
      try { rebuildFromLoaded(); say(MSG.rebuilt("with the new headcode setting"), "go"); }
      catch (e) { say(MSG.weRebuildFailed(e), "err"); }
    }));
  }
  $("#we_dlupd").addEventListener("click", () => {
    if (!built || !built.updated) return;
    download(built.updated.name, built.updated.bytes, DOCX_MIME);
    say(MSG.savedUpdated(built.updated.name), "go");
  });
  $("#we_clearall").addEventListener("click", () => {
    loadedDocs = []; built = null;
    P.clearBoxes();
    roadsEl.textContent = "";
    P.showBars(false);
    const dlupd = $("#we_dlupd");
    if (dlupd) dlupd.hidden = true;
    say(MSG.weCleared);
  });
  $("#we_dlall").addEventListener("click", () => {
    if (!built) return;
    const live = built.books.filter(b => !b.skipped);
    const name = "SHEETS_" + built.stamp + ".zip";
    downloadZip(name, live.map(b => [b.name, b.xlsx]));
    say(MSG.savedZip(name, live.length), "go");
  });
  say(MSG.weIdle);
})();

/* A text file as the depot's machines save it: UTF-8 with or without a
   BOM, UTF-16 from Notepad's "Unicode", or Windows-1252 from an older
   export - told apart by the BOM and by whether UTF-8 decoding stumbles. */
function decodeText(u8) {
  if (u8.length >= 2 && u8[0] === 0xFF && u8[1] === 0xFE) return new TextDecoder("utf-16le").decode(u8);
  if (u8.length >= 2 && u8[0] === 0xFE && u8[1] === 0xFF) return new TextDecoder("utf-16be").decode(u8);
  try { return new TextDecoder("utf-8", { fatal: true }).decode(u8); }
  catch (e) { return new TextDecoder("windows-1252").decode(u8); }
}
}
})();
