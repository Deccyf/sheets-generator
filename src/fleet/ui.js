/* Wiring: files in, report on the screen, spreadsheet out. */
;(function(){
"use strict";
const F = FLEET, P = SHEETS_PRINTS, FP = FLEET_PRINTS, R = FLEET_REPORT;

const $ = id => document.getElementById(id);
const el = (tag, cls, txt) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (txt != null) n.textContent = txt;
  return n;
};
function say(msg, kind){
  const s = $("status");
  s.textContent = msg;
  s.className = "status" + (kind ? " " + kind : "");
}

/* ---- the depot settings, remembered on this computer ---- */
const CFG_KEY = "diagramAnalyser.depots.v1";
let cfg = load();
function load(){
  try {
    const raw = localStorage.getItem(CFG_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e){ /* private window, or storage switched off - use the defaults */ }
  return {};
}
function save(){
  try { localStorage.setItem(CFG_KEY, JSON.stringify(cfg)); }
  catch (e){ /* nothing to do: the settings just will not outlive the tab */ }
}
const cfgFor = k => Object.assign({}, F.FLEETS[k], cfg[k]);

let ALL = [], REP = {}, CURRENT = null;

/* ---- reading the files ---- */
function handle(files){
  if (!files || !files.length) return;
  say("Reading " + files.length + " file" + (files.length === 1 ? "" : "s") + "…");
  const jobs = Array.prototype.map.call(files, f =>
    f.arrayBuffer().then(b => ({name: f.name, bytes: new Uint8Array(b)})));
  Promise.all(jobs).then(read).catch(e => say(e.message || String(e), "err"));
}
function read(files){
  const got = [], bad = [];
  for (const f of files){
    try {
      const lines = P.readPrints(f.bytes, fflate.unzipSync);
      const ds = FP.parsePrints(lines);
      if (!ds.length) throw new Error("no diagrams in it");
      for (const d of ds) got.push(Object.assign(d, {book: f.name}));
    } catch (e){
      bad.push(f.name + " — " + (e.message || String(e)));
    }
  }
  if (!got.length){
    say(bad.length ? bad[0] : "Nothing in those files reads as the diagram prints.", "err");
    return;
  }
  ALL = got;
  const mon = F.referenceMonday(ALL);
  if (mon == null){
    say("Those prints carry no From/Until dates, so a week cannot be measured.", "err");
    return;
  }
  const stab = ALL.filter(d => d.stabled).length;
  say(ALL.length + " diagrams read (" + stab + " standing still all day) · week of " +
      new Date(mon).toLocaleDateString("en-GB", {day:"2-digit",month:"short",year:"numeric"}) +
      (bad.length ? " · " + bad.length + " file(s) skipped" : ""), "go");
  if (bad.length) console.warn(bad.join("\n"));
  drawSetup();
  rebuild();
}

/* ---- depot settings panel ---- */
function drawSetup(){
  const box = $("depots");
  box.textContent = "";
  const names = Object.keys(F.DEPOTS);
  for (const k of fleetsPresent()){
    const c = cfgFor(k);
    const card = el("div", "dep");
    card.appendChild(el("h3", null, "Class " + c.label));
    card.appendChild(el("p", "who", countOf(k) + " diagrams in these prints"));

    const hl = el("label", null, "Home depot");
    hl.htmlFor = "home-" + k;
    card.appendChild(hl);
    const sel = el("select");
    sel.id = "home-" + k;
    for (const n of names){
      const o = el("option", null, n);
      o.value = n;
      if (n === c.home) o.selected = true;
      sel.appendChild(o);
    }
    sel.addEventListener("change", () => {
      cfg[k] = Object.assign({}, cfg[k], {home: sel.value});
      /* The home depot must always be somewhere it can be repaired, or the
         report contradicts itself on its own front page. */
      const rep = (cfg[k].repair || c.repair).slice();
      if (rep.indexOf(sel.value) === -1) rep.push(sel.value);
      cfg[k].repair = rep;
      save(); drawSetup(); rebuild();
    });
    card.appendChild(sel);

    card.appendChild(el("label", null, "Repaired at"));
    const reps = el("div", "reps");
    for (const n of names){
      const lab = el("label");
      const cb = el("input");
      cb.type = "checkbox";
      cb.checked = c.repair.indexOf(n) !== -1;
      cb.disabled = n === c.home;
      cb.addEventListener("change", () => {
        const set = new Set(cfgFor(k).repair);
        if (cb.checked) set.add(n); else set.delete(n);
        set.add(cfgFor(k).home);
        cfg[k] = Object.assign({}, cfg[k], {repair: Array.from(set)});
        save(); rebuild();
      });
      lab.appendChild(cb);
      lab.appendChild(el("span", null, n));
      reps.appendChild(lab);
    }
    card.appendChild(reps);
    if (c.derived && !(cfg[k] && cfg[k].home))
      card.appendChild(el("p", "derived",
        "Worked out from the prints, not told to the tool — check it."));
    box.appendChild(card);
  }
  $("setup").hidden = false;
}
const fleetsPresent = () =>
  Object.keys(F.FLEETS).filter(k => ALL.some(d => F.fleetOf(d) === k));
const countOf = k => ALL.filter(d => F.fleetOf(d) === k).length;

/* ---- the report ---- */
function rebuild(){
  REP = {};
  const keys = fleetsPresent();
  for (const k of keys){
    try { REP[k] = R.build(ALL, k, cfg); }
    catch (e){ console.error("fleet " + k, e); }
  }
  const bar = $("fleetbar");
  bar.textContent = "";
  for (const k of keys){
    if (!REP[k]) continue;
    const b = el("button", "ftab");
    b.type = "button";
    b.setAttribute("role", "tab");
    b.appendChild(el("span", null, "Class " + REP[k].cfg.label));
    b.appendChild(el("span", "n", REP[k].a.day.length + " a day · " + REP[k].cfg.home));
    b.addEventListener("click", () => show(k));
    bar.appendChild(b);
  }
  $("out").hidden = false;
  show(keys.indexOf(CURRENT) !== -1 ? CURRENT : keys[0]);
}

function show(k){
  if (!REP[k]) return;
  CURRENT = k;
  const keys = fleetsPresent().filter(x => REP[x]);
  Array.prototype.forEach.call($("fleetbar").children, (b, i) =>
    b.setAttribute("aria-selected", keys[i] === k ? "true" : "false"));
  const box = $("report");
  box.textContent = "";
  for (const s of REP[k].secs) box.appendChild(section(s));
}

function section(s){
  const wrap = el("section");
  wrap.appendChild(el("h2", "sech", s.title));
  const n = el("p", "secn");
  n.innerHTML = s.lede;          // the ledes carry <b> and a note span
  wrap.appendChild(n);
  if (s.stat && s.stat.length){
    const g = el("div", "stats");
    for (const [label, v] of s.stat){
      const c = el("div", "stat");
      c.appendChild(el("b", null, String(v)));
      c.appendChild(el("span", null, label));
      g.appendChild(c);
    }
    wrap.appendChild(g);
  }
  if (s.rows && s.rows.length){
    wrap.appendChild(table(s.head, s.rows));
    if (s.rows.length > 14)
      wrap.appendChild(el("p", "rowcount", s.rows.length + " rows — the box scrolls"));
  } else if (s.head){
    wrap.appendChild(el("p", "rowcount", "Nothing to list."));
  }
  if (s.extra) wrap.appendChild(more(s.extra.title, s.extra.head, s.extra.rows));
  for (const d of s.detail || []) wrap.appendChild(more(d.title, d.head, d.rows));
  return wrap;
}
function table(head, rows){
  const tw = el("div", "tw" + (rows.length > 14 ? " tall" : ""));
  const t = el("table", "rep");
  const th = el("thead"), tr = el("tr");
  for (const h of head) tr.appendChild(el("th", null, h));
  th.appendChild(tr);
  t.appendChild(th);
  const tb = el("tbody");
  for (const r of rows){
    const row = el("tr");
    r.forEach((v, i) => {
      const td = el("td", null, v === "" || v == null ? "" : String(v));
      if (typeof v === "number") td.className = "num";
      else if (/^NO —/.test(String(v))) td.className = "no";
      else if (/^yes/.test(String(v))) td.className = "yes";
      else if (String(v).length > 24) td.className = "wide";
      row.appendChild(td);
    });
    tb.appendChild(row);
  }
  t.appendChild(tb);
  tw.appendChild(t);
  return tw;
}
function more(title, head, rows){
  const d = el("details", "more");
  d.appendChild(el("summary", null, title));
  d.appendChild(table(head, rows));
  return d;
}

/* ---- saving ---- */
function download(name, bytes){
  const blob = new Blob([bytes],
    {type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
}
const stamp = ms => new Date(ms).toISOString().slice(0, 10).replace(/-/g, "");
function saveOne(){
  const rep = REP[CURRENT];
  if (!rep) return;
  const bytes = FLEET_XLSX.writeWorkbook(R.sheets(rep),
    f => fflate.zipSync(f, {level: 6}));
  download("DIAGRAMS_" + rep.cfg.label.replace(/\//g, "-") + "_" +
           stamp(rep.monday) + ".xlsx", bytes);
  say("Saved the " + rep.cfg.label + " workbook.", "go");
}
function saveAll(){
  const sheets = [];
  for (const k of fleetsPresent()){
    if (!REP[k]) continue;
    for (const s of R.sheets(REP[k]))
      sheets.push({name: REP[k].cfg.label + " " + s.name, rows: s.rows});
  }
  if (!sheets.length) return;
  const bytes = FLEET_XLSX.writeWorkbook(sheets, f => fflate.zipSync(f, {level: 6}));
  download("DIAGRAMS_ALL_" + stamp(F.referenceMonday(ALL)) + ".xlsx", bytes);
  say("Saved every fleet.", "go");
}

/* ---- events ---- */
function wire(){
  const zone = $("zone"), file = $("file");
  if (!zone) return;
  zone.addEventListener("click", () => file.click());
  file.addEventListener("change", () => { handle(file.files); file.value = ""; });
  for (const t of ["dragenter", "dragover"])
    zone.addEventListener(t, e => { e.preventDefault(); zone.classList.add("dragover"); });
  for (const t of ["dragleave", "drop"])
    zone.addEventListener(t, e => { e.preventDefault(); zone.classList.remove("dragover"); });
  zone.addEventListener("drop", e => {
    e.preventDefault();
    handle(e.dataTransfer && e.dataTransfer.files);
  });
  document.addEventListener("dragover", e => e.preventDefault());
  document.addEventListener("drop", e => e.preventDefault());
  $("save").addEventListener("click", saveOne);
  $("saveall").addEventListener("click", saveAll);
  $("resetcfg").addEventListener("click", () => {
    cfg = {};
    save();
    if (ALL.length){ drawSetup(); rebuild(); }
  });
  /* Anything without these cannot read the files at all, and the failure is
     otherwise a silent do-nothing on the drop zone. */
  if (typeof Promise === "undefined" || !window.File ||
      !File.prototype.arrayBuffer || typeof TextDecoder === "undefined"){
    const w = $("oldbrowser");
    if (w) w.hidden = false;
  }
}
if (document.readyState === "loading")
  document.addEventListener("DOMContentLoaded", wire);
else wire();
})();
