/* Page wiring for both panels. The weekday panel drives GENIUS + the shared
   xlsx writer; the weekend panel drives SheetsEngine. Previews on both
   panels render the same cell layout that gets saved. */
"use strict";
(function () {
if (typeof document === "undefined" || !document.querySelector) return;
/* The legacy build wired the panels while the parser was still mid-body and
   crashed on the weekend elements; wire only once the DOM is complete. */
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
function init() {
const $ = s => document.querySelector(s);
const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/* ---------------- shared helpers ---------------- */
function sayer(el) {
  return (msg, kind) => {
    el.textContent = msg;
    el.className = "status" + (kind ? " " + kind : "");
  };
}
function download(name, data, mime) {
  const blob = new Blob([data], { type: mime || XLSX_MIME });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
function escHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
}
/* One zip beats a burst of separate downloads the browser may block. */
function downloadZip(name, files) {
  const bag = {};
  for (const [n, bytes] of files) bag[n] = bytes;
  download(name, fflate.zipSync(bag, { level: 6 }), "application/zip");
}
const paint = () => new Promise(r => setTimeout(r, 30));

/* Drag-and-drop + click wiring shared by both berths. */
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
["dragover", "drop"].forEach(ev =>
  document.addEventListener(ev, e => e.preventDefault()));

/* Tab strip with lazy panes and arrow-key navigation. */
function tabbed(panes) {
  const tabs = document.createElement("div");
  tabs.className = "tabs"; tabs.setAttribute("role", "tablist");
  const view = document.createElement("div");
  view.className = "view";
  view.setAttribute("role", "tabpanel");
  const cache = {};
  const btns = panes.map(([name, htmlFn], ix) => {
    const tb = document.createElement("button");
    tb.type = "button"; tb.className = "tab"; tb.textContent = name;
    tb.setAttribute("role", "tab");
    tb.tabIndex = ix === 0 ? 0 : -1;
    tb.addEventListener("click", () => select(ix));
    tabs.appendChild(tb);
    return { tb, htmlFn };
  });
  function select(ix) {
    if (cache[ix] === undefined) cache[ix] = btns[ix].htmlFn();
    const pane = cache[ix];
    if (pane && pane.nodeType) { view.textContent = ""; view.appendChild(pane); }
    else view.innerHTML = pane;
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
  return { tabs, view, select };
}

/* ---------------- local rule edits ----------------
   The tool ships one order table; a tester can overlay it here to see a
   correction take effect straight away. The overlay lives on this machine
   only, so the point of it is the export: a correction is not finished
   until it is baked into the tool for everyone. Everything below is built
   so that state cannot go quiet - see the banner and the review notes. */
const RULES_LS_KEY = "sheetsRules.v1";
const rulesStore = (() => {
  try { return window.localStorage; } catch (e) { return null; }
})();
let ruleEdits = (() => {
  if (!rulesStore) return {};
  const parsed = SHEETS_RULES.parse(rulesStore.getItem(RULES_LS_KEY) || "");
  return parsed ? parsed.orderFix : {};
})();
const editCount = () => Object.keys(ruleEdits).length;
/* when the overlay was last written, so the exported file can say */
const savedAt = () => {
  if (!rulesStore) return null;
  const p = SHEETS_RULES.parse(rulesStore.getItem(RULES_LS_KEY) || "");
  return p ? p.saved : null;
};
function persistEdits() {
  if (!rulesStore) return false;
  try {
    rulesStore.setItem(RULES_LS_KEY,
      SHEETS_RULES.serialize(ruleEdits, new Date().toISOString()));
    return true;
  } catch (e) { return false; }
}


/* The Rules pane. Everything it shows comes from the build that produced
   these very books - res.rules is the table that ran, not the tables read
   again at display time - so it cannot drift from what you are looking at.
   Editing is unit order and nothing else: it is the table testers actually
   correct, and it has a closed grammar that can be checked. */
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
    firstDep: [...(prof.firstDep || [])].sort(),
    firstDepAll: !!prof.firstDepAll,
    ecsOnlyOk: [...(prof.ecsOnlyOk || [])].sort(),
    headcodeSections: [...SHEETS_DATA.HEADCODE_SECTIONS],
    endStyle: SHEETS_DATA.END_STYLE,
    routeByHc: SHEETS_DATA.ROUTE_BY_HC,
    dayRoll: RB.DAY_ROLL, pmBreak: RB.PM_BREAK, runRound: RB.RUN_ROUND,
    breakGap: SHEETS_XLSX.BREAK_GAP,
    gpSplit: isMain,
    orderFix: res.rules.orderFix,
  };
}

/* The reference half: every rule this build followed, in plain English.
   Read-only on purpose - it is the thing a new starter opens, and nothing
   on it can change a book. The order corrections live on the Unit order
   tab instead, next to the buttons that write them. */
function rulesPane(b, res, secNames) {
  const el = document.createElement("div");
  el.className = "rules";
  const h = [];
  h.push('<p class="sa-src">Everything the tool followed to build this very ' +
    'book, written out in plain English. It is what actually ran, not a ' +
    'description of it — change a setting and rebuild, and this changes ' +
    'with it. To put a formation right, use the Unit order tab.</p>');
  h.push(SHEETS_RULES.explainHtml(rulesEnv(b, res, secNames),
                                  { skip: ["corrections"] }));
  el.innerHTML = h.join("");
  return el;
}

/* The working half: what this build printed coupled, and a button to turn
   any of it round. */
function orderPane(b, res, rebuild, secNames) {
  const el = document.createElement("div");
  el.className = "rules";
  const R = res.rules;
  const isMain = b.hc === "main";
  /* One list is built per fleet into the same array, so the book is picked
     out by its bucket first and only then by the Ramsgate split. Listed
     once each however many days were fed in. */
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

  /* Every coupled formation this build produced, so an order can be put
     right from what is on the sheet rather than by writing anything. */
  h.push('<section class="rule-sec"><h3>Check the coupled formations in ' +
    "this build</h3>");
  if (!coupled.length)
    h.push('<p class="noreviews">Nothing in this book runs coupled, so there ' +
      "is no order to check.</p>");
  else {
    h.push("<p>Every formation of two or more units the tool printed, and " +
      "the order it printed them in. Hold it against the real book: if one " +
      "is the wrong way round, press Reverse.</p>");
    h.push('<table class="rules-t"><thead><tr><th>Where and when</th>' +
      "<th>Printed in this order</th><th>Decided by</th><th></th>" +
      "</tr></thead><tbody>");
    coupled.forEach((c, ix) => {
      /* A row you turned round yourself, as opposed to one the shipped
         corrections list already had: it is marked, and the button undoes
         it rather than reversing it a second time. */
      const mine = !!c.applied &&
        Object.prototype.hasOwnProperty.call(R.edits, c.applied);
      h.push('<tr class="' + (mine ? "flipped" : "") + '"><td>' +
        esc(c.sec + " " + c.timeText) +
        (mine ? ' <span class="flag-you">turned round by you</span>' : "") +
        "</td><td>" + esc(c.units.join(", ")) + "</td><td>" +
        (mine ? "you, on this computer"
              : c.applied ? "the corrections list"
                          : "the position numbers in the report") +
        '</td><td><button type="button" class="btn ghost" ' +
        (mine ? 'data-unflip="' + esc(c.applied) + '">Undo'
              : 'data-flip="' + ix + '">Reverse') +
        "</button></td></tr>");
    });
    h.push("</tbody></table>");
    h.push('<p class="opts-hint">Reverse turns that formation round and ' +
      "rebuilds the books straight away so you can see it. Anything you have " +
      "turned round is marked, and Undo puts it back. The changes stay on " +
      "this computer only — use “Export order corrections” on this " +
      "card and send us the file, and they get built in for everybody.</p>");
    h.push("</section>");
  }

  if (editCount()) {
    h.push('<section class="rule-sec"><h3>Changes you have made on this ' +
      "computer</h3>");
    h.push("<p>These are in force for every book built here until you clear " +
      "them, and they are what “Export order corrections” sends us.</p>");
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
    h.push('<p><button type="button" class="btn ghost" data-clear="1">' +
      "Undo all my changes</button></p>");
    h.push("</section>");
  }
  h.push(SHEETS_RULES.explainHtml(rulesEnv(b, res, secNames),
                                  { only: ["corrections"] }));
  el.innerHTML = h.join("");

  el.addEventListener("click", ev => {
    const flip = ev.target.getAttribute && ev.target.getAttribute("data-flip");
    if (flip !== null && flip !== undefined) {
      const c = coupled[Number(flip)];
      /* Off the deduplicated list: the same formation on Monday and on
         Tuesday is one working, not two, and must not be given a time it
         does not need. Two DIFFERENT departures of it must. */
      const seen = coupled.filter(x => x.lookupDiags === c.lookupDiags).length > 1;
      const forms = SHEETS_RULES.keyForms(c.sec, c.timeText,
                                          c.lookupDiags.split(","));
      const key = SHEETS_RULES.chooseKey(forms, seen, false);
      /* Reverse what is printed. The key is the one the lookup itself
         recorded, so a pin can never be written against a key the build
         would not consult. */
      const order = c.units.slice().reverse();
      const bad = SHEETS_RULES.validEdit(key, order);
      if (bad) return;
      ruleEdits[key] = order;
      persistEdits();
      rebuild();
      return;
    }
    const un = ev.target.getAttribute && ev.target.getAttribute("data-unflip");
    if (un) {
      // back to whatever the tool ships, which may be an order of its own
      delete ruleEdits[un];
      persistEdits();
      rebuild();
      return;
    }
    if (ev.target.getAttribute && ev.target.getAttribute("data-clear")) {
      ruleEdits = {};
      persistEdits();
      rebuild();
    }
  });
  return el;
}

/* ---------------- fleet sprites ---------------- */
/* Stylised side profiles in the Southeastern manner: dark blue Electrostars
   and Javelins with yellow ends, white Networker metro stock. Decorative
   only — everything is inline SVG so the file stays offline. */
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
  // 375 Electrostar — Southeastern's dark blue livery, yellow warning end
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
/* The head of a road card, shared by the built and the empty ones. */
function roadHead(i, road, fleetLabel, spriteCls) {
  const head = document.createElement("div");
  head.className = "road-head";
  head.innerHTML = '<span class="road-no">Road ' + (i + 1) + "</span>" +
    '<h2 class="road-name">' + escHtml(road) + "</h2>" +
    '<span class="road-fleet">' + escHtml(fleetLabel) + "</span>" +
    '<span class="road-sprite" aria-hidden="true">' + sprite(spriteCls) + "</span>";
  return head;
}

/* A road with nothing on it: same head, one line saying why. Every book
   with no diagrams gets this, so an empty Metro road reads like an empty
   High Speed one rather than offering an empty workbook to save. */
function emptyRoadCard(i, road, fleetLabel, spriteCls, why) {
  const art = document.createElement("article");
  art.className = "road";
  const p = document.createElement("p");
  p.className = "nothing";
  p.textContent = why;
  art.append(roadHead(i, road, fleetLabel, spriteCls), p);
  return art;
}

/* A road card: header + animated unit + review line + actions + panel. */
function roadCard(i, road, fleetLabel, spriteCls, unitHtml, reviewCount, panes, saves) {
  const art = document.createElement("article");
  art.className = "road";
  const head = roadHead(i, road, fleetLabel, spriteCls);
  const track = document.createElement("div");
  track.className = "track";
  const unit = document.createElement("div");
  unit.className = "unit";
  unit.style.animationDelay = (i * 90) + "ms";
  unit.innerHTML = sprite(spriteCls) + unitHtml;
  track.appendChild(unit);
  const rline = document.createElement("p");
  rline.className = "reviewline" + (reviewCount ? "" : " clean");
  rline.textContent = reviewCount
    ? reviewCount + " review item" + (reviewCount === 1 ? "" : "s") +
      " — read before the sheets go out"
    : "Nothing flagged for review.";
  const acts = document.createElement("div");
  acts.className = "acts";
  const bp = document.createElement("button");
  bp.type = "button"; bp.className = "btn"; bp.textContent = "Look at it";
  acts.appendChild(bp);
  for (const [label, fn] of saves) {
    const b = document.createElement("button");
    b.type = "button"; b.className = "btn ghost"; b.textContent = label;
    b.addEventListener("click", fn);
    acts.appendChild(b);
  }
  const panel = document.createElement("div");
  panel.className = "panel"; panel.hidden = true;
  const { tabs, view, select } = tabbed(panes);
  panel.append(tabs, view);
  let opened = false;
  bp.addEventListener("click", () => {
    panel.hidden = !panel.hidden;
    bp.textContent = panel.hidden ? "Look at it" : "Close";
    if (!panel.hidden && !opened) { opened = true; select(0); }
  });
  art.append(head, track, rline, acts, panel);
  return art;
}
function reviewPane(items) {
  return items.length
    ? '<ul class="reviews">' +
      items.map(it => "<li>" + escHtml(it) + "</li>").join("") + "</ul>"
    : '<p class="noreviews">Nothing flagged for review.</p>';
}

/* ================= weekday panel: Genius reports ================= */
(function weekday() {
  const say = sayer($("#status"));
  const roadsEl = $("#roads"), allbar = $("#allbar"), allnote = $("#allnote"),
        dlall = $("#dlall"), optsEl = $("#opts");
  const zoneStrong = document.querySelector("#berth .berth-txt strong");
  const zoneSub = document.querySelector("#berth .berth-txt span");
  const ZONE_DEFAULT = [zoneStrong.textContent, zoneSub.textContent];
  function zone(strong, sub) {
    zoneStrong.textContent = strong;
    zoneSub.textContent = sub;
  }
  let built = null, zipName = "SHEETS_BOOKS.zip";
  let lastRes = null;        // kept so the headcode toggles can rebuild
  /* the dropped pair itself, kept so a rule edit can rebuild in place: the
     order lookup happens inside the build, so re-rendering is not enough */
  let lastInputs = null;
  const have = {};           // sum / det, whichever has arrived
  let queue = Promise.resolve();
  const hcToggles = {
    main: $("#hc_main"), metro: $("#hc_metro"), hs: $("#hc_hs"),
  };
  const hcOn = k => !!(hcToggles[k] && hcToggles[k].checked);

  /* A rule edit changes what the build does, so it re-runs the build - the
     order lookup is inside it. Serialised on the same queue the headcode
     toggles use, so clicks cannot overlap. */
  function rebuildForRules() {
    if (!lastInputs) return;
    queue = queue.then(async () => {
      try {
        await buildGenius();
        say("Books rebuilt with your order correction — save them again if needed.");
      } catch (err) { say("Rebuild failed: " + err.message, "err"); }
    });
  }
  async function buildGenius() {
    say("Reading the reports …"); await paint();
    if (have.sum && have.det)
      lastInputs = { csv: have.sum.fmt === "csv",
                     pair: have.sum.data.concat(have.det.data) };
    const opts = { orderFix: ruleEdits };
    const res = lastInputs.csv
      ? GENIUS.buildIntegrale(lastInputs.pair, opts)
      : await GENIUS.build(lastInputs.pair, opts);
    lastRes = res;
    await renderBooks(res);
  }

  async function renderBooks(res) {
    say("Writing books …"); await paint();
    const X = SHEETS_XLSX;
    const dayKeys = ["M", "T", "W", "TH", "F"].filter(k => k in res.labels);
    const mainOrder = X.bookOrder(res.secsByDay, X.MAIN_ORDER, true);
    const metroOrder = X.bookOrder(res.metroSecs, X.METRO_ORDER, false);
    // Each book carries its own fleet's review items. The Ramsgate book is
    // cut from the mainline build, so it keeps the mainline items tagged
    // RAMSGATE plus the section-less general ones (unreadable diagrams,
    // date notices, location look-ups).
    const msgs = list => list.map(x => x.msg);
    const revs = {
      main: msgs(res.reviews.main),
      ram: msgs(res.reviews.main.filter(x => !x.sec || x.sec === "RAMSGATE")),
      metro: msgs(res.reviews.metro),
      hs: msgs(res.reviews.hs),
    };
    // Every fleet gets a road whether or not the reports carry its diagrams.
    // What it holds is decided below by the entry count, so an empty Metro
    // road reads exactly like an empty High Speed one.
    const plan = [
      { road: "SHEETS", fleet: "Mainline", label: "Mainline 375/376/377",
        spriteCls: "375", file: "SHEETS_", hc: "main",
        secs: res.secsByDay, ram: false, order: mainOrder, review: revs.main,
        opts: {} },
      { road: "RAM SHEETS", fleet: "Ramsgate", label: "Ramsgate",
        spriteCls: "375", file: "RAM_SHEETS_", hc: "main",
        secs: res.secsByDay, ram: true, order: null, review: revs.ram,
        opts: {} },
      { road: "METRO SHEETS", fleet: "Metro", label: "Metro 465/466/707",
        spriteCls: "465", file: "METRO_SHEETS_", hc: "metro", cycle: true,
        secs: res.metroSecs, ram: false, order: metroOrder, review: revs.metro,
        opts: { baseOrder: X.METRO_ORDER, splitRamsgate: false } },
      { road: "HS SHEETS", fleet: "High Speed", label: "High Speed 395",
        spriteCls: "395", file: "HS_SHEETS_", hc: "hs", cycle: true,
        secs: res.hsSecs, ram: false,
        order: X.bookOrder(res.hsSecs, X.HS_ORDER, false), review: revs.hs,
        opts: { baseOrder: [], splitRamsgate: false } },
    ];
    roadsEl.textContent = "";
    const books = [];
    plan.forEach((b, i) => {
      let entries = 0;
      const secNames = new Set();
      const splitByRamsgate = b.secs === res.secsByDay;
      for (const d of dayKeys) {
        for (const [name, list] of (b.secs[d] || new Map())) {
          if (splitByRamsgate && b.ram !== (name === "RAMSGATE")) continue;
          if (list.length) { secNames.add(name); entries += list.length; }
        }
      }
      if (!entries) {
        roadsEl.appendChild(emptyRoadCard(i, b.road, b.label, b.spriteCls,
          "No " + b.fleet + " diagrams in these reports — nothing to berth." +
          (b.cycle ? " (A " + b.fleet + " Control Cycle must exist in Genius" +
                     " for its diagrams to appear.)" : "")));
        return;
      }
      const allHc = hcOn(b.hc);
      const opts = { allHeadcodes: allHc };
      for (const k of Object.keys(b.opts)) opts[k] = b.opts[k];
      const book = { road: b.road, name: b.file + res.tag + ".xlsx",
        bytes: X.writeBooks(b.secs, res.labels, b.ram, opts) };
      books.push(book);
      const panes = dayKeys.map(d => [X.DAY_SHEET[d], () => {
        const secs = b.secs[d];
        if (!secs || !secs.size) return '<p class="noreviews">No entries this day.</p>';
        return X.dayPreviewHtml(secs, res.labels[d], b.ram, b.order, allHc,
                                b.hc === "main");
      }]);
      panes.push(["Review" + (b.review.length ? " (" + b.review.length + ")" : ""),
                  () => reviewPane(b.review)]);
      panes.push(["Unit order" + (editCount() ? " (" + editCount() + ")" : ""),
                  () => orderPane(b, res, rebuildForRules, secNames)]);
      panes.push(["Rules", () => rulesPane(b, res, secNames)]);
      const unitHtml = "<b>" + entries + "</b> entries · " + secNames.size +
        " section" + (secNames.size === 1 ? "" : "s");
      const acts = [["Save book", () => download(book.name, book.bytes, XLSX_MIME)]];
      if (editCount()) acts.push(["Export order corrections",
        () => download("SHEETS_ORDER_CORRECTIONS_" + res.tag + ".txt",
                       SHEETS_RULES.exportText(ruleEdits, res.tag, savedAt()),
                       "text/plain")]);
      roadsEl.appendChild(roadCard(i, b.road, b.label, b.spriteCls, unitHtml,
        b.review.length, panes, acts));
    });
    built = books;
    zipName = "SHEETS_BOOKS_" + res.tag + ".zip";
    allbar.hidden = books.length === 0;
    /* The headcode toggles rebuild the books, so they belong with the books
       rather than above an empty page - they were the second thing a new
       user saw, before they had dropped anything. */
    optsEl.hidden = books.length === 0;
    allnote.textContent = Object.values(res.labels).join(", ");
    const n = res.review.length;
    const rv = n
      ? (n === 1 ? " 1 item for a human eye is on its book's Review tab."
                 : " " + n + " items for a human eye are on the books' Review tabs.")
      : " Nothing needed a human eye.";
    say("Books built — look them over below, then save." + rv,
        res.review.length ? "warn" : "go");
  }

  async function accept(file) {
    const nm = file.name.toLowerCase();
    if (nm.endsWith(".docx") || nm.endsWith(".doc")) {
      say("Weekend diagram prints go in the weekend panel below — drop them there.", "err");
      return;
    }
    if (nm.endsWith(".xlsx") || nm.endsWith(".xls")) {
      say("ACWN workbooks aren't read any more — the weekday books are built from the Genius reports (PDF or CSV) or the Integrale CSV exports.", "err");
      return;
    }
    if (nm.endsWith(".csv")) {
      const text = new TextDecoder("utf-8").decode(await file.arrayBuffer());
      let kind = null, fmt = "csv";
      try { kind = GENIUS.sniffIntegrale(text); } catch (e) {}
      if (!kind) {
        try { kind = GENIUS.sniffGeniusCsv(text); fmt = "gcsv"; } catch (e) {}
      }
      if (!kind) {
        say("“" + file.name + "” isn't a report this reads — it takes the " +
            "Diagram Summary and Diagrams CSVs from Integrale, or the " +
            "Diagram Summary and Detail reports from Genius saved as CSV.", "err");
        return;
      }
      await stash(kind, fmt, text);
      return;
    }
    if (!nm.endsWith(".pdf")) {
      say("This tool reads the Genius Diagram Summary & Detail reports (PDF or CSV) or the Integrale CSV exports for the daily sheets — weekend diagram prints (.docx / .doc) go in the panel below.", "err");
      return;
    }
    const u8 = new Uint8Array(await file.arrayBuffer());
    let kind = "?";
    try {
      const t = GENIUS.pdfText(u8);
      if (/DIAGRAM SUMMARY REPORT/i.test(t)) kind = "sum";
      else if (/Diagram Detail Report/i.test(t)) kind = "det";
    } catch (e) {}
    if (kind === "?") {
      say("“" + file.name + "” doesn't look like a Genius report — save the Diagram Summary and Diagram Detail reports from Genius as PDFs and drop both here.", "err");
      return;
    }
    await stash(kind, "pdf", u8);
  }

  // Genius comes as the report PDFs or as CSV exports of the same two
  // reports; either pairs with the other, so they are one source.
  let dropId = 0;
  const srcName = fmt => fmt === "csv" ? "Integrale" : "Genius";
  const family = fmt => fmt === "csv" ? "integrale" : "genius";
  /* Two reports of the same kind in ONE drop are two days of the same
     report, so they are kept together; a later drop starts the slot again. */
  function stash(kind, fmt, data) {
    if (have[kind] && have[kind].drop === dropId &&
        family(have[kind].fmt) === family(fmt)) have[kind].data.push(data);
    else have[kind] = { fmt, data: [data], drop: dropId };
  }
  async function drained() {
    if (have.sum && have.det) {
      if (family(have.sum.fmt) !== family(have.det.fmt)) {
        say("The Summary is from " + srcName(have.sum.fmt) + " but the Detail is from " +
            srcName(have.det.fmt) + " — drop a matching pair together: both from Genius, or both from Integrale.", "err");
        zone("Mixed sources loaded",
             "drop a matching pair — both from Genius, or both from Integrale");
        // nothing that was just refused is kept: a leftover half pairs with
        // the next drop's first file and builds the wrong day
        delete have.sum; delete have.det;
        return;
      }
      try {
        await buildGenius();
      } catch (err) {
        say("Build failed: " + err.message, "err");
        /* Books from an earlier drop must not survive a failed one: they are
           one click from a zip named for the day that failed. */
        roadsEl.textContent = "";
        allbar.hidden = true;
        optsEl.hidden = true;
        allnote.textContent = "";
        built = null; lastRes = null; lastInputs = null;
      }
      delete have.sum; delete have.det;
      zone(ZONE_DEFAULT[0], ZONE_DEFAULT[1]);
    } else if (have.sum || have.det) {
      const kind = have.sum ? "sum" : "det";
      const fmt = have[kind].fmt;
      const got = kind === "sum" ? "Summary" : "Detail";
      const want = kind === "sum" ? "Diagram Detail" : "Diagram Summary";
      const what = family(fmt) === "integrale" ? "CSV" : "report";
      say(srcName(fmt) + " " + got + " loaded ✓ — now drop the " + want + " " + what + ".");
      zone("Diagram " + got + " loaded ✓ (" + srcName(fmt) + ")",
           "now drop the " + want + " " + what + " · or click to choose it");
    }
  }

  dlall.addEventListener("click", () => {
    if (!built || !built.length) return;
    downloadZip(zipName, built.map(b => [b.name, b.bytes]));
  });
  for (const k of Object.keys(hcToggles)) {
    if (!hcToggles[k]) continue;
    hcToggles[k].addEventListener("change", () => {
      if (!lastRes) return;
      queue = queue.then(async () => {
        await renderBooks(lastRes);
        say("Books rebuilt with the new headcode setting — save them again if needed.", "go");
      });
    });
  }
  /* One drop is one job: every file in it is read before anything is built.
     Reading them as separate jobs meant a pair dropped together built once
     off the first file and a leftover half from an earlier drop - Friday's
     summary against Wednesday's detail - and then reported no weekday dates
     at all. A file that cannot be read says so and does not take the panel
     down with it. */
  wireDrop($("#berth"), $("#file"), files => {
    dropId++;
    queue = queue.then(async () => {
      for (const f of files) {
        try { await accept(f); }
        catch (err) {
          say("Couldn't read “" + f.name + "”: " + (err && err.message || err) +
              " — copy it to this computer's desktop and drop that.", "err");
        }
      }
      await drained();
    }).catch(err => say("Couldn't read that drop: " +
      (err && err.message || err), "err"));
  });
})();

/* ================= weekend panel: diagram prints ================= */
(function weekend() {
  const say = sayer($("#we_status"));
  const roadsEl = $("#we_roads"), allbar = $("#we_allbar"),
        allnote = $("#we_allnote"), optsEl = $("#we_opts");
  let built = null;
  let loadedDocs = [];
  const SPRITE_FOR = { Mainline: "375", Metro: "465", "High Speed": "395" };

  function render(res) {
    roadsEl.textContent = "";
    res.books.forEach((b, i) => {
      if (b.skipped) {
        roadsEl.appendChild(emptyRoadCard(i, b.road, b.label,
          SPRITE_FOR[b.road] || "375",
          "No " + b.road + " diagrams in this weekend's prints — nothing" +
          " to berth."));
        return;
      }
      const items = b.report.split("\n").filter(l => l.startsWith("- "))
        .map(l => l.slice(2));
      const panes = [
        ["Sheet", () => SheetsEngine.previewHtml(b.layout)],
        ["Review list" + (items.length ? " (" + items.length + ")" : ""),
         () => reviewPane(items)],
      ];
      const unitHtml = "<b>" + b.entries + "</b> entries · " + b.sections + " sections";
      roadsEl.appendChild(roadCard(i, b.road, b.label,
        SPRITE_FOR[b.road] || "375", unitHtml, items.length, panes,
        [["Save sheet", () => download(b.name, b.xlsx, XLSX_MIME)]]));
    });
    const live = res.books.filter(b => !b.skipped);
    allbar.hidden = live.length === 0;
    optsEl.hidden = live.length === 0;
    allnote.textContent = res.banner + " · " + res.diagrams +
      " diagrams read";
  }

  const weHc = {
    Mainline: $("#we_hc_main"), Metro: $("#we_hc_metro"),
    "High Speed": $("#we_hc_hs"),
  };
  function rebuildFromLoaded() {
    const allHeadcodes = {};
    for (const road of Object.keys(weHc))
      allHeadcodes[road] = !!(weHc[road] && weHc[road].checked);
    const res = SheetsEngine.run(loadedDocs,
      b => fflate.unzipSync(b),
      f => fflate.zipSync(f, { level: 6 }),
      { allHeadcodes });
    built = res;
    render(res);
    const dlupd = $("#we_dlupd");
    if (dlupd) dlupd.hidden = !res.updated;
    const total = res.books.filter(b => !b.skipped)
                           .reduce((a, b) => a + b.entries, 0);
    let msg = "Berthed — " + total + " entries for " + res.banner + ".";
    if (res.merge) {
      msg += " Reissue cross-referenced: " + res.merge.replaced.length +
             " diagram(s) replaced" +
             (res.merge.added.length ? ", " + res.merge.added.length + " added" : "") + ".";
    } else if (loadedDocs.length > 1) {
      msg += " (" + loadedDocs.length + " documents loaded.)";
    }
    say(msg, "go");
  }

  function build(files) {
    if (!files.length) return;
    say("Reading " + files.map(f => f.name).join(", ") + "…");
    Promise.all(files.map(f => new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onerror = () => rej(new Error("Couldn't read " + f.name +
        ". Try copying it to the desktop first."));
      fr.onload = () => res({ name: f.name, bytes: new Uint8Array(fr.result) });
      fr.readAsArrayBuffer(f);
    }))).then(newDocs => {
      for (const d of newDocs) {
        const i = loadedDocs.findIndex(x => x.name === d.name);
        if (i >= 0) loadedDocs[i] = d; else loadedDocs.push(d);
      }
      try {
        rebuildFromLoaded();
      } catch (err) {
        loadedDocs = loadedDocs.filter(d => !newDocs.some(n => n.name === d.name));
        if (!loadedDocs.length) {
          built = null; roadsEl.textContent = ""; allbar.hidden = true;
          optsEl.hidden = true;
        } else {
          try { rebuildFromLoaded(); } catch (e2) { /* keep previous view */ }
        }
        say(err && err.message ? err.message
            : "That file couldn't be read as diagram prints.", "err");
      }
    }).catch(err => say(err.message, "err"));
  }

  wireDrop($("#we_berth"), $("#we_file"), build);
  for (const road of Object.keys(weHc)) {
    if (!weHc[road]) continue;
    weHc[road].addEventListener("change", () => {
      if (!loadedDocs.length) return;
      try {
        rebuildFromLoaded();
        say("Sheets rebuilt with the new headcode setting — save them again if needed.", "go");
      } catch (e) { /* keep previous view */ }
    });
  }
  $("#we_dlupd").addEventListener("click", () => {
    if (built && built.updated)
      download(built.updated.name, built.updated.bytes, DOCX_MIME);
  });
  $("#we_clearall").addEventListener("click", () => {
    loadedDocs = [];
    built = null;
    roadsEl.textContent = "";
    allbar.hidden = true;
    const dlupd = $("#we_dlupd");
    if (dlupd) dlupd.hidden = true;
    say("Cleared — drop this weekend's prints to start again.");
  });
  $("#we_dlall").addEventListener("click", () => {
    if (!built) return;
    downloadZip("SHEETS_" + built.stamp + ".zip",
      built.books.filter(b => !b.skipped).map(b => [b.name, b.xlsx]));
  });
})();
}
})();
