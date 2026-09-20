/* SHEETS_BERTH_HS — the High Speed side of the berth-request road: the
   Class 395 Disposition Statement.

   The 395s have no maintenance plan with a berth request per line. Their
   telex is the disposition statement: one row per unit with where it is,
   what it is fit for, what the depot wants of it on each of the next five
   days, and - the planner's part - the diagram it goes out on, when it
   leaves, where it ends and when it gets in. This road reads the sheet as
   it is pasted from the workbook, takes the day's AZ diagrams off the
   Diagram Detail and the units' whereabouts off the Allocation Summary,
   and fills the four planning columns: a unit goes out from the depot it
   is at, on a diagram it is fit for, with the depot's own wishes for the
   day - a hold, an early finish, low mileage, stable if possible - read
   off its cell. The sheet comes back cell for cell in the workbook's own
   dress (SHEETS_HS_DISP_SKIN), with a Why beside every unit on the page.

   The rules here are a first reading of one day's sheet against its
   reports, and are written to be corrected: each is one clause of fit()
   below, and the Why names which clause placed a unit. */
"use strict";
const SHEETS_BERTH_HS = (() => {
const SKIN = typeof SHEETS_HS_DISP_SKIN !== "undefined" ? SHEETS_HS_DISP_SKIN : null;
const COLS = "ABCDEFGHIJKLMNOP";          // A is the sheet's spacer column; the table runs B to P
const DAY3 = ["Sun", "Mon", "Tue", "Wed", "Thur", "Fri", "Sat"];   // as the sheet spells them
/* The sheet's own words for the places the reports code. */
const WORDS = [[/^ASHF/, "Ashford"], [/^RAM/, "Ramsgate"], [/^FAVR/, "Faversham"], [/^MARGATE/, "Margate"],
               [/^STPANCI/, "St Pancras"], [/^DOVERP/, "Dover"], [/^EBSFLTI/, "Ebbsfleet"], [/^STFORDI/, "Stratford"],
               [/^CNTBW/, "Canterbury"], [/^GLNGHMK/, "Gillingham"], [/^STROOD/, "Strood"], [/^GRVSEND/, "Gravesend"],
               [/^MINSTER/, "Minster"], [/^WENGTNX/, "Westenhanger"], [/^SNDWICH/, "Sandwich"], [/^DEAL/, "Deal"], [/^FLKS/, "Folkestone"]];
const word = code => { for (const [re, w] of WORDS) if (re.test(code || "")) return w; return code || ""; };
/* a depot as the sheet's DEPT LOCATION column writes it, from its word */
const depotWord = s => { const t = String(s || "").trim().toUpperCase(); return /^ASH/.test(t) ? "Ashford" : /^RAM/.test(t) ? "Ramsgate" : /^FAV/.test(t) ? "Faversham" : /^MAR/.test(t) ? "Margate" : String(s || "").trim(); };
const isEbb = c => /^EBSFLTI/.test(c || ""), isGrv = c => /^GRVSEND/.test(c || "");
/* the North Kent line, for a unit that must avoid it */
const NORTH_KENT = new Set(["GRVSEND", "STROOD", "RCHT", "CHTM", "GLNGHMK", "RNHM", "STNGBRN", "FAVRSHM", "HGHM", "SOLE", "NFLT", "GNHT", "SWLY", "DFD"]);
/* The windows the sheet's own words point at, in minutes from midnight.
   Named, not written into the clauses: a bare hour in the code reads like
   a second AM/PM cutoff, and the build refuses one of those. */
const EARLY_PM_FROM = 11 * 60, EARLY_PM_TO = 960;        // "Early PM" - back at the depot between the peaks' ends
const PEAKS_FROM = 9 * 60 + 30, PEAKS_TO = 15 * 60;      // "Between Peaks"
const EVENING_FROM = 18 * 60;                            // "PM" - a finish later than this is what it wants
const NIGHT_END = 6 * 60;                                // the small hours a night's diagram lands in
const t4 = (m, plus) => m == null ? "" : String(Math.floor(m / 60) % 24).padStart(2, "0") + (plus ? "+" : " ") + String(m % 60).padStart(2, "0");
const ecs = hc => /^[35]/.test(hc || "");
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/* ---------- the paste ----------
   Excel copies a multi-line cell quoted, with the line breaks inside the
   quotes, so the sheet is read as quoted tab-separated records. */
function records(text) {
  const out = []; let row = [], cell = "", q = false;
  const s = String(text || "").replace(/\r\n?/g, "\n");
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (q) { if (ch === '"') { if (s[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; }
    else if (ch === '"' && cell === "") q = true;
    else if (ch === "\t") { row.push(cell); cell = ""; }
    else if (ch === "\n") { row.push(cell); out.push(row); row = []; cell = ""; }
    else cell += ch;
  }
  if (cell !== "" || row.length) { row.push(cell); out.push(row); }
  return out.map(r => r.map(c => c.replace(/[ \t]+\n/g, "\n").trim()));
}
const headingOf = recs => recs.findIndex(r => r.some(c => /^UNIT\b/i.test(c)) && r.some(c => /^DIAGRAM\b/i.test(c)) && r.some(c => /DEP\s*TIME/i.test(c)));
/* whether a paste is the disposition statement rather than a maintenance plan */
function isDisposition(text) { return headingOf(records(text)) >= 0; }

function parse(text) {
  const recs = records(text), reviews = [];
  const hi = headingOf(recs);
  if (hi < 0) throw new Error("no heading row with UNIT, DIAGRAM and DEP TIME — paste the Disposition Sheet tab from its top-left corner");
  const H = recs[hi], find = re => H.findIndex(c => re.test(c));
  const ci = { unit: find(/^UNIT\b/i), ftr: find(/FTR/i), depot: find(/DEPT|^LOCATION/i), mc: find(/^MC\b/i), status: find(/STATUS/i),
               restr: find(/RESTRICTION|COMMENT/i), diag: find(/^DIAGRAM\b/i), dep: find(/DEP\s*TIME/i), end: find(/END\s*LOCATION/i), arr: find(/ARRIVAL/i) };
  const dayCols = [];
  H.forEach((c, i) => { const m = /^(Sun|Mon|Tue|Wed|Thu|Fri|Sat)[a-z]*\.?\s+(\d\d)\/(\d\d)/i.exec(c); if (m) dayCols.push({ i, label: c, dd: m[2], mm: m[3] }); });
  if (!dayCols.length) reviews.push("The heading row has no day columns (\"Sun 20/09\" and so on), so what the depot wants of each unit today cannot be read.");
  let state = "", version = "", title = "";
  for (const r of recs.slice(0, hi)) for (const c of r) {
    if (/^(Actual|Provisional)$/i.test(c)) state = c;
    else if (/^Version\s*\d+/i.test(c)) version = c;
    else if (/DISPOSITION STATEMENT/i.test(c)) title = c;
  }
  const units = [];
  for (let i = hi + 1; i < recs.length; i++) {
    const r = recs[i], m = /(\d{6})/.exec(r[ci.unit] || "");
    if (!m) continue;
    const at = k => ci[k] >= 0 ? (r[ci[k]] || "") : "";
    units.push({ unit: m[1], hash: /#/.test(r[ci.unit]), ftr: at("ftr"), depot: at("depot"), mc: at("mc"), status: at("status"), restr: at("restr"),
                 days: dayCols.map(d => r[d.i] || ""), diag: at("diag"), dep: at("dep"), endLoc: at("end"), arr: at("arr"), line: i + 1 });
  }
  if (!units.length) reviews.push("No unit rows under the heading — the sheet lists a unit number in its UNIT column.");
  return { units, dayCols, state, version, title, reviews };
}

/* ---------- the day's diagrams ----------
   Off the Detail's stops: where each AZ diagram starts and when, on what,
   where it ends and when, its miles, whether it goes over the high level
   (a leg between Ebbsfleet and Gravesend, as the allocations sheet reads
   it) or along the North Kent, and where it stands an hour or more. */
function diagramsFor(days) {
  const out = [];
  if (!days) return out;
  for (const d of days.values()) {
    if (!/^AZ6/.test(d.diag) && !/^395/.test(d.fleet || "")) continue;
    const st = d.stops || [];
    if (st.length < 2) continue;
    const first = st[0], last = st[st.length - 1];
    const dep = first.dep, arr = last.arr != null ? last.arr : last.dep;
    const miles = last.ml != null ? Math.round(last.ml) : null;
    if (dep == null || (miles !== null && miles < 5)) continue;   // a diagram with no work on it
    const hl = st.some((s, i) => i > 0 && ((isEbb(s.code) && isGrv(st[i - 1].code)) || (isGrv(s.code) && isEbb(st[i - 1].code))));
    const nk = st.some(s => NORTH_KENT.has(s.code));
    const stands = st.slice(1, -1).filter(s => s.arr != null && s.dep != null && s.dep - s.arr >= 60)
      .map(s => ({ code: s.code, word: word(s.code), arr: s.arr, dep: s.dep }));
    /* the units the DIAGRAM SUMMARY puts on it. The ones the pool fills in
       from the Allocation Summary are not those: a Summary printed before
       the day was allocated leaves every row empty and the allocation then
       stands in with last night's tail, which named the wrong diagram for
       fourteen of the Sunday's nineteen units until this told them apart. */
    const fromSummary = (d.rows || []).some(r => !r.viaAlloc && r.units && r.units.length);
    out.push({ diag: d.diag, from: first.code, home: word(first.code), dep, hc: first.hcOut || "", to: last.code, endWord: word(last.code), arr,
               hcIn: last.hcIn || "", miles, hl, nk, stands, fromSummary, units: fromSummary ? (d.units || []).slice() : [] });
  }
  return out.sort((a, b) => a.dep - b.dep || cmp(a.diag, b.diag));
}

/* ---------- what the depot wants of a unit today ---------- */
function needsOf(u, ti) {
  const today = u.days[ti] || "", all = (u.restr + "\n" + today).toUpperCase();
  const flat = today.replace(/\s+/g, " ").trim();
  return {
    stopped: /STOPPED/i.test(u.status), spare: /SPARE/i.test(u.status),
    hold: /\bHOLD\b/i.test(today) || /\bSTOPPED\b/i.test(today),
    stable: /STABLE/i.test(today) || /STABLED/i.test(u.status),
    low: /LOW MILEAGE/i.test(u.mc) || /LOW MILEAGE/i.test(today),
    noHL: /HIGH LEVEL/.test(all), noNK: /NORTH KENT/.test(all),
    earlyAM: /EARLY AM/i.test(today), earlyPM: /EARLY PM/i.test(today), pm: /\bPM\b/i.test(today) && !/EARLY PM/i.test(today),
    peaks: /BETWEEN PEAKS/i.test(today), text: flat,
  };
}
/* when a diagram is back at a place between two times: its end there, or a
   stand there of an hour or more */
function backAt(d, home, from, to) {
  if (d.endWord === home && d.arr >= from && d.arr <= to) return { at: d.arr, ends: true };
  const s = d.stands.find(x => x.word === home && x.arr >= from && x.arr <= to);
  return s ? { at: s.arr, until: s.dep } : null;
}
/* How well a diagram fits a unit today: null where it cannot take it, or a
   score (lower is better) and the clauses that made it. */
function fit(u, n, d) {
  if (d.home !== u.depotWord) return null;
  if (n.noHL && d.hl) return null;
  if (n.noNK && d.nk) return null;
  let score = 0; const why = [];
  if (n.low && d.miles != null) { score += d.miles; why.push(d.miles + " miles"); }
  if (n.earlyPM) { const b = backAt(d, u.depotWord, EARLY_PM_FROM, EARLY_PM_TO); if (b) { score -= 1000; why.push("back at " + u.depotWord + " " + t4(b.at, true) + (b.until ? " (stands to " + t4(b.until, true) + ")" : "")); } else score += 500; }
  if (n.pm) { if (d.endWord === u.depotWord) { score -= 500 - Math.max(0, d.arr - EVENING_FROM) / 4; why.push("ends " + u.depotWord + " " + t4(d.arr, ecs(d.hcIn))); } else score += 300; }
  if (n.peaks) { const b = backAt(d, u.depotWord, PEAKS_FROM, PEAKS_TO); if (b && b.until) { score -= 1000; why.push("stands " + u.depotWord + " " + t4(b.at, true) + "-" + t4(b.until, true)); } else score += 500; }
  if (n.earlyAM) { score -= d.dep / 4; why.push("leaves " + t4(d.dep, ecs(d.hc)) + ", after the early work"); }
  if (n.noHL) why.push("not over the high level");
  if (n.noNK) why.push("avoids the North Kent");
  return { score, why };
}

/* ---------- the allocation ---------- */
function allocate(sheet, diagrams, ti, landed, sumAlloc) {
  const free = new Map(diagrams.map(d => [d.diag, d]));
  const byDiag = new Map(diagrams.map(d => [d.diag, d]));
  const out = [];
  for (const u of sheet.units) {
    const n = needsOf(u, ti);
    const r = { unit: u.unit, row: u, needs: n, depotWord: depotWord(u.depot), diag: null, why: [], state: "" };
    u.depotWord = r.depotWord;
    const land = landed && landed.get(u.unit);
    if (land && !r.depotWord) { r.depotWord = u.depotWord = land.word; r.why.push("at " + land.word + " off " + land.diag + " " + t4(land.at, true) + " by the Allocation Summary"); }
    else if (land && land.word !== r.depotWord) r.why.push("the Allocation Summary lands it at " + land.word + " off " + land.diag + " " + t4(land.at, true) + ", not " + r.depotWord + " — the sheet's word is kept");
    out.push(r);
  }
  /* A diagram already given to another unit is not given again - two units
     on one diagram was the first thing the Sunday sheet showed up, and the
     offered count then counts a diagram twice and a unit not at all. */
  const held = new Map();
  const fix = (r, diag, how) => {
    if (held.has(diag)) { r.why.push(diag + " is already " + held.get(diag) + "'s, so it is left to the rules"); return false; }
    const d = byDiag.get(diag);
    r.diag = d || { diag, unknown: true };
    r.fixed = how;
    held.set(diag, r.unit);
    if (d) free.delete(diag);
    return true;
  };
  // what the sheet already has, then what the reports already allocate
  for (const r of out) {
    const m = /\b(AZ\d{3})\b/i.exec(r.row.diag || "");
    if (m && fix(r, m[1].toUpperCase(), "sheet"))
      r.why.push("the sheet has it on " + m[1].toUpperCase() + (byDiag.has(m[1].toUpperCase()) ? "" : ", which is not on the Detail"));
  }
  for (const r of out) if (!r.diag && sumAlloc && sumAlloc.has(r.unit)) {
    const dg = sumAlloc.get(r.unit);
    if (fix(r, dg, "reports")) r.why.push("the reports have it on " + dg + " today");
  }
  for (const r of out) {
    const n = r.needs;
    if (r.diag) continue;
    if (n.stopped) { r.state = "stopped"; r.why.push("stopped" + (n.text ? ": " + n.text : "")); }
    else if (n.hold) { r.state = "held"; r.why.push("held today: " + n.text); }
  }
  const wants = r => !r.diag && !r.state && (r.needs.noHL || r.needs.noNK || r.needs.low || r.needs.earlyPM || r.needs.pm || r.needs.peaks || r.needs.earlyAM);
  const pick = r => {
    let best = null;
    for (const d of free.values()) {
      const f = fit(r, r.needs, d);
      if (!f) continue;
      if (!best || f.score < best.f.score || (f.score === best.f.score && d.dep < best.d.dep)) best = { d, f };
    }
    return best;
  };
  const take = (r, best, how) => { r.diag = best.d; free.delete(best.d.diag); r.how = how; if (best.f.why.length) r.why.push(best.f.why.join(", ")); };
  // 1. the units the depot has a wish for, or a restriction on, take the diagram that fits them best
  for (const r of out.filter(wants).sort((a, b) => (b.needs.noHL + b.needs.noNK) - (a.needs.noHL + a.needs.noNK) || cmp(a.unit, b.unit))) {
    const best = pick(r);
    if (best) take(r, best, "wish");
    else r.why.push("nothing left at " + r.depotWord + " fits" + (r.needs.noHL ? " not over the high level" : "") + (r.needs.noNK ? " avoiding the North Kent" : ""));
  }
  // 2. the rest, in unit order, on the diagrams left at their depot in the order they leave; a "stable if possible" unit last
  const plain = out.filter(r => !r.diag && !r.state && !r.needs.stable && !r.needs.spare);
  for (const r of plain.sort((a, b) => cmp(a.unit, b.unit))) {
    const best = pick(r);
    if (best) take(r, best, "next");
  }
  for (const r of out.filter(r => !r.diag && !r.state && (r.needs.stable || r.needs.spare))) {
    const best = pick(r);
    if (best) { take(r, best, "needed"); r.why.push((r.needs.stable ? "stable if possible, but " : "spare on the sheet, but ") + r.depotWord + " has a diagram nobody else can take"); }
    else { r.state = r.needs.stable ? "stabled" : "spare"; r.why.push(r.needs.stable ? "stabled, as asked" : "spare"); }
  }
  for (const r of out) if (!r.diag && !r.state) { r.state = "spare"; r.why.push("spare — nothing left at " + (r.depotWord || "its depot") + " for it"); }
  const unfilled = [...free.values()];
  return { rows: out, unfilled };
}

/* ---------- the run ---------- */
function run(planText, genius, opts, B) {
  const sheet = parse(planText);
  const reviews = sheet.reviews.slice();
  const allocDates = genius && genius.alloc && genius.alloc.keys ? [...genius.alloc.keys()] : [];
  const sumDates = [...new Set((genius && genius.summary || []).map(r => r.date))].filter(Boolean);
  const date = opts.date || B.runDate(sumDates, allocDates);
  const today = date ? B.parseShort(date) : null;
  if (!date) reviews.push("No reports are loaded, so the day's diagrams are not known — drop the day's Diagram Summary and Detail, and its Allocation Summary.");
  const days = date ? B.allDays(genius, date) : null;
  const diagrams = diagramsFor(days);
  if (date && !diagrams.length) reviews.push("No AZ diagrams on the " + date + " Diagram Detail — the 395s are on their own control, so drop the High Speed Detail for the day.");
  // which of the sheet's day columns is today
  let ti = 0;
  if (today) {
    const dd = String(today.getUTCDate()).padStart(2, "0"), mm = String(today.getUTCMonth() + 1).padStart(2, "0");
    const k = sheet.dayCols.findIndex(c => c.dd === dd && c.mm === mm);
    if (k >= 0) ti = k;
    else if (sheet.dayCols.length) reviews.push("The sheet's day columns start " + sheet.dayCols[0].label + " and the reports are for " + date + " — the first column is read as today.");
  }
  // where each unit lands at the start of the day, off the Allocation Summary: the night's diagram ending in the small hours
  /* A unit's line on the Allocation Summary is read for what it is. Printed
     before the day was allocated, it carries only the tail of last night's
     diagram - a start just after midnight and a finish in the small hours -
     and that says where the unit LANDS, not what it does today. Printed
     after, the same line runs to an evening finish, and then its finishing
     diagram is the unit's work for the day. On the Sunday sheet that told
     the five allocated units from the fourteen not yet allocated, and named
     the same diagram the planner had written for every one of them. */
  const landed = new Map(), sumAlloc = new Map();
  const runsToday = dg => diagrams.some(d => d.diag === dg);
  const alloc = B.allocFor(genius, date);
  if (alloc) for (const rec of alloc.values()) {
    if (!/^395/.test(rec.unit)) continue;
    /* the raw finish, not the clock face: a record finishing 00+19 the NEXT
       morning carries +1440 and is a full day's work, while one finishing
       01+34 the same morning is last night's tail */
    const night = rec.end != null && rec.end <= NIGHT_END;
    if (night && rec.endLoc) landed.set(rec.unit, { word: word(rec.endLoc), diag: rec.endDiag, at: rec.end });
    if (!night) {
      const dg = runsToday(rec.endDiag) ? rec.endDiag : runsToday(rec.startDiag) ? rec.startDiag : null;
      if (dg) sumAlloc.set(rec.unit, dg);
    }
  }
  // …and a Diagram Summary printed after allocation names the units on each working outright
  for (const d of diagrams) for (const u of d.units) if (/^395/.test(u) && !sumAlloc.has(u)) sumAlloc.set(u, d.diag);
  const a = allocate(sheet, diagrams, ti, landed, sumAlloc);
  const rows = a.rows;
  for (const r of rows) {
    const d = r.diag;
    r.suggest = !d || d.unknown ? { diag: d ? d.diag : "", hc: "", dep: "", endLoc: "", arr: "" }
      : { diag: d.diag, hc: d.hc, dep: t4(d.dep, ecs(d.hc)), endLoc: d.endWord, arr: t4(d.arr, ecs(d.hcIn)) };
    if (d && !d.unknown) {
      r.why.unshift(d.diag + " " + d.hc + " " + t4(d.dep, ecs(d.hc)) + " " + d.home + " → " + d.endWord + " " + t4(d.arr, ecs(d.hcIn)) + (d.miles != null ? ", " + d.miles + " miles" : "") +
        (d.stands.length ? " · stands " + d.stands.map(s => s.word + " " + t4(s.arr, true) + "-" + t4(s.dep, true)).join(", ") : ""));
      if (d.hl) r.why.push("over the high level");
      // what the sheet wrote against a diagram it already had, where it differs from the Detail
      if (r.fixed === "sheet") {
        const had = [r.row.dep, r.row.endLoc, r.row.arr].map(x => x.replace(/\s+/g, " ").trim());
        const mine = [r.suggest.dep, r.suggest.endLoc, r.suggest.arr];
        const diff = had.map((h, i) => h && h.toUpperCase().indexOf(mine[i].toUpperCase()) < 0 ? h + " (Detail: " + mine[i] + ")" : null).filter(Boolean);
        if (diff.length) r.why.push("the sheet has " + diff.join(", "));
      }
    }
    if (r.needs.text && !r.state) r.why.push("today: " + r.needs.text);
    if (r.row.restr) r.why.push("restriction: " + r.row.restr.replace(/\s+/g, " ").trim());
    r.status = r.state === "stopped" ? (r.row.status || "Stopped") : r.state === "held" ? (r.row.status || "Available") : r.state === "spare" ? "Spare" : r.state === "stabled" ? "Stabled" : (r.row.status || "Available");
  }
  const counts = {
    required: diagrams.length,
    offered: rows.filter(r => r.diag && !r.diag.unknown).length,
    spare: rows.filter(r => r.state === "spare").length,
    stopped: rows.filter(r => r.state === "stopped").length,
    stabled: rows.filter(r => r.state === "stabled" || r.state === "held").length,
  };
  if (a.unfilled.length) reviews.push("No unit for " + a.unfilled.map(d => d.diag + " " + d.hc + " " + t4(d.dep, ecs(d.hc)) + " from " + d.home).join(", ") + " — " +
    (rows.some(r => r.state === "stabled") ? "a stabled unit could take one. " : "") + "the sheet's offered count is short by " + a.unfilled.length + ".");
  if (landed.size === 0 && date) reviews.push("The Allocation Summary for " + date + " lands no 395 in the small hours, so each unit is taken to be where the sheet's DEPT LOCATION says.");
  const dayLabels = sheet.dayCols.length ? sheet.dayCols.map(c => c.label) : (today ? [0, 1, 2, 3, 4].map(k => { const d = new Date(today.getTime() + k * 86400000); return DAY3[d.getUTCDay()] + " " + String(d.getUTCDate()).padStart(2, "0") + "/" + String(d.getUTCMonth() + 1).padStart(2, "0"); }) : ["", "", "", "", ""]);
  return { kind: "hs", rows, reviews, date, today, dayLabels, ti, counts, diagrams, sheet, lines: rows.length, units: rows.length,
           inTraffic: counts.offered, suggested: rows.filter(r => r.diag && !r.fixed).length, ignored: 0, mseUnits: [], notices: [], swaps: [], groups: [], order: [] };
}

/* ---------- the sheet back, cell for cell ---------- */
const serial = d => d ? Math.round((d.getTime() - Date.UTC(1899, 11, 30)) / 86400000) : null;
const longDate = d => d ? ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][d.getUTCDay()] + ", " +
  ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][d.getUTCMonth()] + " " +
  String(d.getUTCDate()).padStart(2, "0") + ", " + d.getUTCFullYear() : "";
const shortDate = d => d ? String(d.getUTCDate()).padStart(2, "0") + "/" + String(d.getUTCMonth() + 1).padStart(2, "0") + "/" + d.getUTCFullYear() : "";
/* every row of the sheet: its cells by column letter, each with its value
   and the skin's style record; a unit row carries its Why */
function rows(res) {
  if (!SKIN) throw new Error("the High Speed sheet's dress is not in this build");
  const out = [];
  const S = SKIN, xfOf = (r, c) => { const h = S.head.find(x => x[0] === r && x[1] === c); return h ? h[2] : 0; };
  const V = S.variants, L = S.lastVariants;
  const heads = new Map();
  for (const [r, c, xf, v] of S.head) { if (!heads.has(r)) heads.set(r, new Map()); heads.get(r).set(c, { v, xf }); }
  const vars = {
    "2:B": { v: res.sheet.state || "Provisional" }, "3:B": { v: res.sheet.version || "" },
    "2:M": { v: longDate(res.today), num: serial(res.today) }, "6:G": { v: shortDate(res.today), num: serial(res.today) },
    "3:L": { v: String(res.counts.required), num: res.counts.required }, "6:L": { v: String(res.counts.offered), num: res.counts.offered },
    "10:L": { v: String(res.counts.spare), num: res.counts.spare }, "13:L": { v: String(res.counts.stopped), num: res.counts.stopped },
    "16:L": { v: String(res.counts.stabled), num: res.counts.stabled },
  };
  for (let r = 1; r <= 19; r++) {
    const cells = new Map();
    const h = heads.get(r);
    if (h) for (const [c, x] of h) { const vv = vars[r + ":" + c]; cells.set(c, vv ? { v: vv.v, xf: x.xf, num: vv.num } : { v: x.v, xf: x.xf }); }
    out.push({ r, type: "head", cells, ht: +(S.headHts[r] || 15) });
  }
  const hdr = new Map();
  let di = 0;
  for (const [c, xf, v] of S.header) hdr.set(c, { v: "HIJKL".indexOf(c) >= 0 ? (res.dayLabels[di++] || "") : v, xf });
  out.push({ r: 20, type: "header", cells: hdr, ht: +(S.headHts[20] || 75) });
  let r = 21;
  const isLast = i => i === res.rows.length - 1;
  res.rows.forEach((u, i) => {
    const last = isLast(i), B = last ? S.last : S.body, cells = new Map();
    const row = u.row, s = u.suggest;
    const dayXf = (k, text) => {
      const red = /\bHOLD\b|STOPPED|DAMAGE|OVERHAUL|\bEXAM\b/i.test(text), lastCol = k === 4;
      if (last) return lastCol ? L.dayLBlank : (red ? L.dayRed : text ? V.dayBlue : L.dayBlank);
      return lastCol ? (text ? (red ? V.dayLRed : V.dayLBlue) : V.dayLBlank) : (text ? (red ? V.dayRed : V.dayBlue) : V.dayBlank);
    };
    cells.set("B", { v: (row.hash ? "#\n" : "") + u.unit, xf: last ? B.B : (row.hash ? V.unitHash : B.B) });
    cells.set("C", { v: row.ftr, xf: B.C });
    cells.set("D", { v: row.depot || u.depotWord || "", xf: B.D });
    cells.set("E", { v: row.mc, xf: /LOW MILEAGE/i.test(row.mc) && !last ? V.lowMileage : B.E });
    cells.set("F", { v: u.status, xf: B.F, status: u.status });
    cells.set("G", { v: row.restr, xf: last ? B.G : (row.restr ? V.restriction : V.noRestriction) });
    "HIJKL".split("").forEach((c, k) => cells.set(c, { v: row.days[k] || "", xf: dayXf(k, row.days[k] || "") }));
    cells.set("M", { v: s.diag ? s.diag + (s.hc ? "\n" + s.hc : "") : "", xf: B.M });
    cells.set("N", { v: s.dep, xf: B.N });
    cells.set("O", { v: s.endLoc, xf: B.O });
    cells.set("P", { v: s.arr, xf: B.P });
    out.push({ r, type: "unit", cells, ht: +S.bodyHt, why: u.why.join(" · "), unit: u, filled: !!(u.diag && !u.fixed) });
    r++;
  });
  out.push({ r, type: "close", cells: new Map(), ht: +S.closeHt });
  return { rows: out, merges: S.headMerges.slice(), skin: S, lastUnitRow: r - 1 };
}
const esc = v => String(v == null ? "" : v).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
/* tab-separated, sixteen columns from A, a cell with a line break quoted the way Excel copies it */
function toText(res, opts) {
  opts = opts || {};
  const R = rows(res), lines = [];
  const q = v => /[\t\n"]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  for (const row of R.rows) {
    const cells = COLS.split("").map(c => { const x = row.cells.get(c); return x ? q(x.v) : ""; });
    if (!opts.workbook && row.type === "unit") cells.push(q(row.why));
    if (!opts.workbook && row.type === "header") cells.push("Why");
    while (cells.length && !cells[cells.length - 1]) cells.pop();
    lines.push(cells.join("\t"));
  }
  return lines.join("\n");
}
/* the sheet as the workbook draws it: every cell with its own record, the
   header block's merges as spans, the status colours as the tab's rules
   paint them; on the page the Why sits beside each unit */
function toHtml(res, inline, opts) {
  opts = opts || {};
  const R = rows(res), S = R.skin, why = !opts.workbook, px = w => Math.round(w * 7) + 5, pt = h => Math.round(h * 4 / 3);
  const span = new Map(), covered = new Set();
  for (const m of R.merges) {
    const [a, b] = m.split(":"), ca = a.match(/[A-Z]+/)[0], ra = +a.match(/\d+/)[0], cb = b.match(/[A-Z]+/)[0], rb = +b.match(/\d+/)[0];
    span.set(a, { cs: COLS.indexOf(cb) - COLS.indexOf(ca) + 1, rs: rb - ra + 1 });
    for (let r = ra; r <= rb; r++) for (let c = COLS.indexOf(ca); c <= COLS.indexOf(cb); c++) if (!(r === ra && c === COLS.indexOf(ca))) covered.add(COLS[c] + r);
  }
  const base = "font-family:Calibri,Carlito,Arial,sans-serif;font-size:11pt;vertical-align:middle;padding:0 3px;overflow:hidden";
  const css = xf => base + ";" + (S.xfCss[xf] || "");
  const width = S.widths.reduce((a, w) => a + px(w), 0) + (why ? 420 : 0);
  const out = ['<table class="brtable brplan brhs" style="border-collapse:collapse;table-layout:fixed;width:' + width + 'px;background:#fff' + (why ? ";zoom:0.7" : "") + '">',
    "<colgroup>" + S.widths.map(w => '<col style="width:' + px(w) + 'px">').join("") + (why ? '<col style="width:420px">' : "") + "</colgroup><tbody>"];
  for (const row of R.rows) {
    const tds = [];
    for (const c of COLS) {
      if (covered.has(c + row.r)) continue;
      const x = row.cells.get(c), sp = span.get(c + row.r);
      const st = x ? css(x.xf) + (x.status && S.statusCss[x.status] ? ";" + S.statusCss[x.status] : "") + (why && c === "M" && row.filled ? ";font-weight:700" : "") : base;
      tds.push("<td" + (sp ? ' colspan="' + sp.cs + '" rowspan="' + sp.rs + '"' : "") + ' style="' + st + '">' + (x ? esc(x.v).replace(/\n/g, "<br>") : "") + "</td>");
    }
    if (why) tds.push('<td style="font-family:Arial,sans-serif;font-size:13pt;color:#3C464D;font-style:italic;padding:0 6px;white-space:normal;vertical-align:middle">' + (row.type === "header" ? "Why" : row.type === "unit" ? esc(row.why) : "") + "</td>");
    out.push('<tr style="height:' + pt(row.ht) + 'px">' + tds.join("") + "</tr>");
  }
  out.push("</tbody></table>");
  return out.join("\n");
}
/* the workbook: the sheet's records, widths, heights and merges, the
   UNIT STATUS column coloured by the tab's own rules, and a Why sheet */
function toXlsx(res, zipFn, X) {
  const R = rows(res), S = R.skin;
  const sheet = (name, withWhy) => {
    const cells = [], rowHeights = new Map();
    for (const row of R.rows) {
      rowHeights.set(row.r, row.ht);
      for (const c of COLS) {
        const x = row.cells.get(c);
        if (!x) continue;
        const cell = { r: row.r, c: COLS.indexOf(c) + 1, v: x.num != null ? String(x.num) : x.v, xf: x.xf, sides: [null, null, null, null] };
        if (x.num != null) cell.num = true;
        if (x.v || row.type !== "unit") cells.push(cell);
      }
      if (withWhy && row.type === "unit" && row.why) cells.push({ r: row.r, c: COLS.length + 1, v: row.why, xf: 0, sides: [null, null, null, null] });
      if (withWhy && row.type === "header") cells.push({ r: row.r, c: COLS.length + 1, v: "Why", xf: 0, sides: [null, null, null, null] });
    }
    const last = R.lastUnitRow;
    const condFmt = last >= 21 ? ['<conditionalFormatting sqref="F21:F' + last + '">' + S.statusOrder.map((t, i) =>
      '<cfRule type="containsText" dxfId="' + i + '" priority="' + (i + 1) + '" operator="containsText" text="' + t + '"><formula>NOT(ISERROR(SEARCH("' + t + '",F21)))</formula></cfRule>').join("") + "</conditionalFormatting>"] : [];
    return { name, layout: { cells, merges: R.merges, rowHeights, maxRow: R.rows[R.rows.length - 1].r,
             opts: { stylesXml: S.stylesXml, widths: withWhy ? S.widths.concat([90]) : S.widths, noPageSetup: true, defaultRowHeight: 15, condFmt, lastCol: withWhy ? "Q" : "P" } } };
  };
  return X.writeWorkbook([sheet("Disposition Sheet", false), sheet("Why", true)], zipFn);
}
/* the day's diagrams, depot by depot, in the order they leave */
function render(res) {
  const lines = ["== THE " + (res.date || "") + " DIAGRAMS, AS THEY LEAVE =="];
  const by = new Map();
  for (const d of res.diagrams) { if (!by.has(d.home)) by.set(d.home, []); by.get(d.home).push(d); }
  const on = new Map(res.rows.filter(r => r.diag && !r.diag.unknown).map(r => [r.diag.diag, r.unit]));
  for (const [home, list] of by) {
    lines.push("", home.toUpperCase());
    for (const d of list) lines.push("  " + d.diag.padEnd(6) + " " + (d.hc || "").padEnd(5) + " " + t4(d.dep, ecs(d.hc)) + "  " + (on.get(d.diag) || "— no unit").padEnd(10) + " → " + d.endWord + " " + t4(d.arr, ecs(d.hcIn)) + (d.miles != null ? "  " + d.miles + " ml" : "") + (d.hl ? "  HL" : ""));
  }
  const rest = res.rows.filter(r => !r.diag);
  if (rest.length) { lines.push("", "NOT OUT"); for (const r of rest) lines.push("  " + r.unit + "  " + (r.depotWord || "") + "  " + r.status + (r.why.length ? " — " + r.why[0] : "")); }
  return lines.join("\n");
}
return { run, parse, records, isDisposition, diagramsFor, needsOf, fit, allocate, rows, toText, toHtml, toXlsx, render, word, depotWord };
})();
if (typeof module !== "undefined" && module.exports) module.exports = SHEETS_BERTH_HS;
if (typeof globalThis !== "undefined") globalThis.SHEETS_BERTH_HS = SHEETS_BERTH_HS;
