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
  const cache = {};
  const btns = panes.map(([name, htmlFn], ix) => {
    const tb = document.createElement("button");
    tb.type = "button"; tb.className = "tab"; tb.textContent = name;
    tb.setAttribute("role", "tab");
    tb.addEventListener("click", () => select(ix));
    tabs.appendChild(tb);
    return { tb, htmlFn };
  });
  function select(ix) {
    if (cache[ix] === undefined) cache[ix] = btns[ix].htmlFn();
    view.innerHTML = cache[ix];
    view.scrollTop = 0; view.scrollLeft = 0;
    btns.forEach((b, j) =>
      b.tb.setAttribute("aria-selected", j === ix ? "true" : "false"));
  }
  tabs.addEventListener("keydown", e => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    const cur = btns.findIndex(b => b.tb.getAttribute("aria-selected") === "true");
    const next = (cur + (e.key === "ArrowRight" ? 1 : btns.length - 1)) % btns.length;
    btns[next].tb.focus(); select(next);
    e.preventDefault();
  });
  return { tabs, view, select };
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
/* A road card: header + animated unit + review line + actions + panel. */
function roadCard(i, road, fleetLabel, spriteCls, unitHtml, reviewCount, panes, saves) {
  const art = document.createElement("article");
  art.className = "road";
  const head = document.createElement("div");
  head.className = "road-head";
  head.innerHTML = '<span class="road-no">Road ' + (i + 1) + "</span>" +
    '<h2 class="road-name">' + escHtml(road) + "</h2>" +
    '<span class="road-fleet">' + escHtml(fleetLabel) + "</span>" +
    '<span class="road-sprite" aria-hidden="true">' + sprite(spriteCls) + "</span>";
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
        dlall = $("#dlall");
  let built = null;
  const have = {};           // sum / det, whichever has arrived
  let queue = Promise.resolve();

  async function buildGenius() {
    say("Reading Genius reports …"); await paint();
    const res = await GENIUS.build([have.sum, have.det]);
    say("Writing books …"); await paint();
    const X = SHEETS_XLSX;
    const dayKeys = ["M", "T", "W", "TH", "F"].filter(k => k in res.labels);
    const mainOrder = X.bookOrder(res.secsByDay, X.MAIN_ORDER, true);
    const metroOrder = X.bookOrder(res.metroSecs, X.METRO_ORDER, false);
    const hsAny = Object.values(res.hsSecs || {}).some(m => m && m.size);
    const books = [
      { road: "SHEETS", label: "Mainline 375/376/377", spriteCls: "375",
        name: "SHEETS_" + res.tag + ".xlsx",
        bytes: X.writeBooks(res.secsByDay, res.labels, false),
        secs: res.secsByDay, ram: false, order: mainOrder },
      { road: "RAM SHEETS", label: "Ramsgate", spriteCls: "375",
        name: "RAM_SHEETS_" + res.tag + ".xlsx",
        bytes: X.writeBooks(res.secsByDay, res.labels, true),
        secs: res.secsByDay, ram: true, order: null },
      { road: "METRO SHEETS", label: "Metro 465/466/707", spriteCls: "465",
        name: "METRO_SHEETS_" + res.tag + ".xlsx",
        bytes: X.writeBooks(res.metroSecs, res.labels, false,
          { baseOrder: X.METRO_ORDER, splitRamsgate: false }),
        secs: res.metroSecs, ram: false, order: metroOrder },
    ];
    if (hsAny) {
      books.push({ road: "HS SHEETS", label: "High Speed 395", spriteCls: "395",
        name: "HS_SHEETS_" + res.tag + ".xlsx",
        bytes: X.writeBooks(res.hsSecs, res.labels, false,
          { baseOrder: [], splitRamsgate: false }),
        secs: res.hsSecs, ram: false,
        order: X.bookOrder(res.hsSecs, X.HS_ORDER, false) });
    }
    roadsEl.textContent = "";
    books.forEach((b, i) => {
      const panes = dayKeys.map(d => [X.DAY_SHEET[d], () => {
        const secs = b.secs[d];
        if (!secs || !secs.size) return '<p class="noreviews">No entries this day.</p>';
        return X.dayPreviewHtml(secs, res.labels[d], b.ram, b.order);
      }]);
      panes.push(["Review" + (res.review.length ? " (" + res.review.length + ")" : ""),
                  () => reviewPane(res.review)]);
      let entries = 0;
      const secNames = new Set();
      const splitByRamsgate = b.secs === res.secsByDay;
      for (const d of dayKeys) {
        for (const [name, list] of (b.secs[d] || new Map())) {
          if (splitByRamsgate && b.ram !== (name === "RAMSGATE")) continue;
          if (list.length) { secNames.add(name); entries += list.length; }
        }
      }
      const unitHtml = "<b>" + entries + "</b> entries · " + secNames.size +
        " section" + (secNames.size === 1 ? "" : "s");
      roadsEl.appendChild(roadCard(i, b.road, b.label, b.spriteCls, unitHtml,
        res.review.length, panes,
        [["Save book", () => download(b.name, b.bytes, XLSX_MIME)]]));
    });
    built = books;
    allbar.hidden = false;
    allnote.textContent = Object.values(res.labels).join(", ");
    const n = res.review.length;
    const rv = n
      ? (n === 1 ? " 1 item for a human eye is on the Review tab."
                 : " " + n + " items for a human eye are on the Review tab.")
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
    if (!nm.endsWith(".pdf")) {
      say("This tool reads the Genius Diagram Summary & Detail reports (.pdf) for the daily sheets — weekend diagram prints (.docx / .doc) go in the panel below.", "err");
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
    have[kind] = u8;
    if (have.sum && have.det) {
      try {
        await buildGenius();
      } catch (err) {
        say("Genius build failed: " + err.message, "err");
      }
      delete have.sum; delete have.det;
    } else {
      say((kind === "sum" ? "Summary" : "Detail") +
          " report loaded ✓ — now drop the " +
          (kind === "sum" ? "Diagram Detail" : "Diagram Summary") + " report.");
    }
  }

  dlall.addEventListener("click", () => {
    if (!built) return;
    for (const b of built) download(b.name, b.bytes, XLSX_MIME);
  });
  // Files are read one after another so a Summary + Detail pair dropped
  // together can't race the build.
  wireDrop($("#berth"), $("#file"), files => {
    for (const f of files) queue = queue.then(() => accept(f));
  });
})();

/* ================= weekend panel: diagram prints ================= */
(function weekend() {
  const say = sayer($("#we_status"));
  const roadsEl = $("#we_roads"), allbar = $("#we_allbar"),
        allnote = $("#we_allnote");
  let built = null;
  let loadedDocs = [];
  const SPRITE_FOR = { Mainline: "375", Metro: "465", "High Speed": "395" };

  function render(res) {
    roadsEl.textContent = "";
    res.books.forEach((b, i) => {
      if (b.skipped) {
        const art = document.createElement("article");
        art.className = "road";
        art.innerHTML = '<div class="road-head"><span class="road-no">Road ' + (i + 1) +
          '</span><h2 class="road-name">' + escHtml(b.road) + "</h2>" +
          '<span class="road-sprite" aria-hidden="true">' +
          sprite(SPRITE_FOR[b.road] || "375") + "</span></div>" +
          '<p style="margin:14px 0 0;color:#79818A">No ' + escHtml(b.label) +
          " diagrams in this weekend's prints — nothing to berth.</p>";
        roadsEl.appendChild(art);
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
    allnote.textContent = res.banner + " · " + res.diagrams +
      " diagrams read";
  }

  function rebuildFromLoaded() {
    const res = SheetsEngine.run(loadedDocs,
      b => fflate.unzipSync(b),
      f => fflate.zipSync(f, { level: 6 }));
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
        } else {
          try { rebuildFromLoaded(); } catch (e2) { /* keep previous view */ }
        }
        say(err && err.message ? err.message
            : "That file couldn't be read as diagram prints.", "err");
      }
    }).catch(err => say(err.message, "err"));
  }

  wireDrop($("#we_berth"), $("#we_file"), build);
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
    for (const b of built.books) {
      if (b.skipped) continue;
      download(b.name, b.xlsx, XLSX_MIME);
    }
  });
})();
}
})();
