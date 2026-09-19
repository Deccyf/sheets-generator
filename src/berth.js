/* SHEETS_BERTH — berth requests off the maintenance plan.

   Stage 1: the FACTS. The planner pastes the maintenance plan out of the
   Telex workbook, and for every line of it this says where that unit is
   today, on which diagram, where and when it ends tonight, and whether it
   calls at the place the plan wants it - read off the same Diagram Summary
   and Diagram Detail the weekday books were just built from. The planner's
   own Action column is shown beside it, never written over.

   What it does NOT yet do is decide. The rules for that were given by the
   depot and are written into the panel's rulebook, marked as coming, so
   they can be corrected in the open before any of them fires. The facts
   here are what those rules will be applied to, and the point of shipping
   the facts first is to prove the reading against the planner's own hand
   on real days before a suggestion is ever made off it.

   One day's reports say where every unit is today and where it ends
   tonight; they do not say which diagram it takes tomorrow, because that is
   the allocator's choice each morning. So the nearer a line's date the
   more this can say, and past a few days out it can only say where the
   unit ends tonight - which is what the plan itself does. */
"use strict";
const SHEETS_BERTH = (() => {
const stopsOf = GENIUS._stopsOf;

/* ---------- the plan's places ----------
   The plan writes the depot; the reports write Genius location codes. RE is
   any road at Ramsgate, GP any of the three Grove Park roads, and so on.
   Selhurst is not on this network - a 377 bound there goes over on a fleet
   move from Victoria - so SU maps to nothing a diagram can call at, and a
   line for SU is answered by where the unit ends instead. */
const PLACES = {
  RE:   ["RAMSGTD", "RAMSDRW", "RAMSNEW", "RAMMKEX", "RAMMIEX", "RAMSGTE"],
  RAM:  ["RAMSGTE"],
  GI:   ["GLNGDEP", "GLNGHMK"],
  GLM:  ["GLNGHMK"],
  SG:   ["SLADEGD", "SLADGUS", "SLADGDP", "SLADEGN"],
  SGUPS:["SLADGUS"],
  GP:   ["GRVPCSD", "GRVPKDS", "GRVPKUS", "GRVPDCE", "GRVPKLE"],
  GPD:  ["GRVPKDS"],
  AFK:  ["ASHFDNS", "ASHFEBS", "ASHFUPS", "ASHFKY", "ASHFDYW"],
  XSE:  ["STLNWCS", "STLNWMS"],
  FKE:  ["FLKSETR"],
  DVP:  ["DOVERP", "DOVERPS"],
  TON:  ["TONBDG", "TONBPMY", "TONBDMS"],
  HGS:  ["HASTING", "HASTPSD"],
  FAV:  ["FAVRSHM", "FAVRUPS", "FAVRBRD"],
  VIC:  ["VICTRIE", "VICTGCS"],
  CHX:  ["CHRX"],
  CST:  ["CANONST"],
  SU:   [],
};
/* A Genius code -> the plan's word for it, for saying where a unit ends. */
const CODE_TO_PLACE = (() => {
  const m = new Map();
  for (const [place, codes] of Object.entries(PLACES))
    for (const c of codes) if (!m.has(c)) m.set(c, place);
  // the depot words win over the station words where both cover a code
  m.set("RAMSGTE", "RAM"); m.set("GLNGHMK", "GLM"); m.set("ASHFKY", "AFK");
  m.set("SLADGUS", "SGUPS"); m.set("GRVPKDS", "GPD");
  return m;
})();
const placeOf = code => CODE_TO_PLACE.get(code) || code || "?";

/* ---------- the plan ----------
   Pasted straight out of the workbook: tab-separated, a section title on a
   line of its own, its column headings under it, then a row per unit. The
   sections carry different columns, so each row keeps the section it came
   from and the fields are read by what the section is. */
const SECTION_RE = /^(Exams|Campaigns|Scheduled Maint|Requests|UAT|MLT\s*\/\s*LATHE|Defects)\b/i;
/* Where a defect is worked on is a matter of class, not of the line: 376s
   go back to Slade Green or Gillingham, 375s to Ramsgate, and a 375/3 can
   go to Ashford as well. 377s are Selhurst's, and Ashford is where they are
   handed over. */
function defectHome(unit) {
  if (/^376/.test(unit)) return "SG/GI";
  if (/^3753/.test(unit)) return "RE/AFK";
  if (/^375/.test(unit)) return "RE";
  if (/^377/.test(unit)) return "AFK";
  return "RE";
}
/* The plan's priority column, boiled down: EOD (back at a maintenance
   depot by the end of the day), MO or NM (a restriction), PERF. */
function defectCategory(priority) {
  const p = String(priority || "").toUpperCase();
  if (/\bEOD\b|END OF DAY/.test(p)) return "EOD";
  if (/\bMO\b/.test(p)) return "MO";
  if (/\bNM\b/.test(p)) return "NM";
  if (/PERFORMANCE/.test(p)) return "PERF";
  return "";
}
const UNIT_RE = /^\d{6}$/;
function parsePlan(text) {
  const rows = [], reviews = [];
  let section = null, headers = null, n = 0;
  for (const raw of String(text || "").split(/\r?\n/)) {
    const f = raw.split("\t").map(x => x.trim());
    if (!f.some(Boolean)) continue;
    n++;
    if (SECTION_RE.test(f[0]) && !UNIT_RE.test(f[0])) {
      section = f[0].replace(/\s*\/\s*/, "/").toUpperCase(); headers = null; continue;
    }
    if (/^Unit\s*Nr/i.test(f[0])) { headers = f.map(h => h.toUpperCase()); continue; }
    if (!UNIT_RE.test(f[0])) continue;
    if (!section) { reviews.push("Line " + n + " (" + f[0] + ") is above any section title, so which list it belongs to is not known — it is read as a request."); section = "REQUESTS"; }
    const row = { section, unit: f[0], line: n, raw: f };
    if (section === "EXAMS") {
      // Unit  Exam  When  Where  Action
      row.what = f[1] || ""; row.when = f[2] || ""; row.where = f[3] || ""; row.action = f[4] || "";
    } else if (section === "DEFECTS") {
      // Unit  Days  Priority  Target Date  Action
      row.days = parseInt(f[1], 10); row.what = f[2] || ""; row.when = f[3] || "";
      row.where = defectHome(row.unit); row.action = f[4] || ""; row.isDefect = true;
      row.category = defectCategory(row.what);
    } else {
      // Unit  Where  When  For  Action
      row.where = f[1] || ""; row.when = f[2] || ""; row.what = f[3] || ""; row.action = f[4] || "";
    }
    row.places = row.where.split(/[\/,]/).map(x => x.trim().toUpperCase()).filter(Boolean);
    /* Two words anywhere on the line change what a defect needs. AMAT is
       awaiting materials - no berth request, unless it is also restricted;
       MSE is the mobile engineers, who may go out to it instead. */
    const all = f.join(" ").toUpperCase();
    row.amat = /\bAMAT\b/.test(all);
    row.mse = /\bMSE\b/.test(all);
    rows.push(row);
  }
  return { rows, reviews };
}

/* ---------- when a line is due ----------
   "SAT AM 19/09", "EOD SUN 20/09", "20 00 THU 24/09", "AFTER AM PEAK MON
   21/09", "ASAP", "AFTER 1250 MILES", and the Defects' "30/09/2026
   00:00:00". Returns the calendar day it is due, the half of the day, and
   whether it is a mileage trigger rather than a date. */
const DAY_NAMES = ["SUN","MON","TUE","WED","THU","FRI","SAT"];
function dateFrom(d, m, y, ref) {
  const year = y ? (y < 100 ? 2000 + y : y) : (ref ? ref.getUTCFullYear() : new Date().getUTCFullYear());
  return new Date(Date.UTC(year, m - 1, d));
}
function whenOf(text, today) {
  const t = String(text || "").trim().toUpperCase();
  const out = { text: t, date: null, half: null, miles: null, asap: false };
  if (!t) return out;
  if (/^ASAP$/.test(t)) { out.asap = true; return out; }
  const mi = /AFTER\s+(\d[\d,]*)\s+MILES/.exec(t);
  if (mi) { out.miles = parseInt(mi[1].replace(/,/g, ""), 10); return out; }
  const full = /(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?/.exec(t);
  if (full) {
    out.date = dateFrom(+full[1], +full[2], +full[3], today);
    if (full[4]) { const hm = +full[4] * 60 + +full[5]; out.half = hm === 0 ? null : (hm < 12 * 60 ? "AM" : "PM"); out.time = hm === 0 ? null : hm; }
    return out;
  }
  const dm = /(\d{1,2})\/(\d{1,2})(?:\/(\d{2}))?/.exec(t);
  if (dm) out.date = dateFrom(+dm[1], +dm[2], dm[3] ? +dm[3] : null, today);
  if (/\bEOD\b/.test(t)) out.half = "EOD";
  else if (/\bAFTER AM PEAK\b/.test(t)) out.half = "AFTER AM PEAK";
  else if (/\bAM\b/.test(t)) out.half = "AM";
  else if (/\bPM\b/.test(t)) out.half = "PM";
  const clock = /\b(\d{2})\s(\d{2})\b/.exec(t);
  if (clock && !dm) { /* a time with no date */ }
  if (clock) { out.time = +clock[1] * 60 + +clock[2]; if (!out.half) out.half = out.time < 12 * 60 ? "AM" : "PM"; }
  return out;
}
/* Days from the reports' date to the due date - 0 is the reports' own day,
   1 tomorrow. Null when the line has no date. */
function daysAhead(when, today) {
  if (!when.date || !today) return null;
  return Math.round((when.date - today) / 86400000);
}
/* How much can be said, by how near it is. */
function tierOf(when, ahead) {
  if (when.asap) return 1;
  if (when.miles !== null) return 2;
  if (ahead === null) return 3;
  if (ahead <= 1) return 1;
  if (ahead <= 6) return 2;
  return 3;
}

/* ---------- the reports ---------- */
function shortDate(d) {           // Date -> "dd/mm/yy" as the reports write it
  return String(d.getUTCDate()).padStart(2, "0") + "/" +
         String(d.getUTCMonth() + 1).padStart(2, "0") + "/" +
         String(d.getUTCFullYear() % 100).padStart(2, "0");
}
function parseShort(s) {          // "dd/mm/yy" -> Date
  const m = /^(\d{2})\/(\d{2})\/(\d{2})$/.exec(String(s || "").trim());
  return m ? dateFrom(+m[1], +m[2], +m[3]) : null;
}
const hhmm = (t, ecs) => {
  if (t == null) return "";
  const m = ((t % 1440) + 1440) % 1440;
  return String(Math.floor(m / 60)).padStart(2, "0") + (ecs ? "+" : " ") + String(m % 60).padStart(2, "0");
};
/* Everything the day knows about one unit: its diagram(s), the stops in
   order, where it ends and when, and each call at a place the plan names. */
function unitDay(unit, genius, date) {
  const rows = (genius.summary || []).filter(r => r.date === date &&
    (r.units ? r.units.indexOf(unit) >= 0 : r.unit === unit));
  if (!rows.length) return null;
  rows.sort((a, b) => a.start - b.start);
  const diags = [...new Set(rows.map(r => r.diag))];
  const dets = genius.detail && genius.detail.get(date);
  let stops = [];
  for (const d of diags) {
    const raw = dets && dets.get(d);
    if (raw) stops = stops.concat(stopsOf(raw).map(s => ({ ...s, diag: d })));
  }
  const last = rows[rows.length - 1];
  const lastStop = stops.length ? stops[stops.length - 1] : null;
  return {
    unit, diags, rows, stops,
    endCode: lastStop ? lastStop.code : last.to,
    endTime: lastStop ? (lastStop.arr != null ? lastStop.arr : lastStop.dep) : last.end,
    startCode: rows[0].from, startTime: rows[0].start,
  };
}
/* The calls a unit makes at the plan's place today: arrival, departure and
   the headcode it leaves on. A stand there of an hour or more is a stand,
   said as such. */
function callsAt(day, places) {
  const want = new Set([].concat(...places.map(p => PLACES[p] || [])));
  if (!want.size) return [];
  const out = [];
  for (const s of day.stops) {
    if (!want.has(s.code)) continue;
    // where it started the day is not a call it makes at the place
    if (s.arr == null) continue;
    const stay = s.dep != null ? s.dep - s.arr : null;
    out.push({ code: s.code, place: placeOf(s.code), arr: s.arr, dep: s.dep,
               hcIn: s.hcIn, hc: s.hcOut, stay, diag: s.diag,
               ends: s.dep == null });
  }
  return out;
}

/* ---------- one plan, one day ---------- */
function run(planText, genius, opts) {
  opts = opts || {};
  const plan = parsePlan(planText);
  const reviews = plan.reviews.slice();
  const dates = genius && genius.labels ? Object.keys(genius.dates || {}).map(k => genius.dates[k]) : [];
  const date = (genius && genius.summary && genius.summary.length)
    ? (opts.date || genius.summary[0].date) : null;
  const today = date ? parseShort(date) : null;
  if (!date) reviews.push("No weekday reports are loaded, so nothing can be said about where any unit is — build the weekday books first.");
  const ignore = new Set(String(opts.ignore || "").match(/\d{6}/g) || []);
  const filled = (genius && genius.summary || []).filter(r => r.date === date && r.unit).length;
  if (date && !filled)
    reviews.push("The Diagram Summary has no units on it — it was printed before the day was allocated. " +
                 "Drop the print that was run after allocation (the evening one) and this can say where each unit is.");
  const out = [];
  for (const row of plan.rows) {
    const when = whenOf(row.when, today);
    const ahead = daysAhead(when, today);
    const r = { ...row, when, ahead, tier: tierOf(when, ahead), ignored: ignore.has(row.unit) };
    const day = date ? unitDay(row.unit, genius, date) : null;
    if (day) {
      r.diags = day.diags;
      r.ends = { code: day.endCode, place: placeOf(day.endCode), time: day.endTime };
      r.starts = { code: day.startCode, place: placeOf(day.startCode), time: day.startTime };
      r.calls = callsAt(day, row.places);
      r.endsAtTarget = row.places.some(p => (PLACES[p] || []).indexOf(day.endCode) >= 0);
      r.afterMidnight = day.endTime != null && day.endTime >= 1440;
    } else {
      r.diags = []; r.ends = null; r.calls = []; r.endsAtTarget = false;
      r.inTraffic = false;
    }
    r.inTraffic = !!day;
    out.push(r);
  }
  // nearest first, then the plan's own order
  const sorted = out.slice().sort((a, b) => (a.tier - b.tier) || (a.line - b.line));
  const inTraffic = new Set(out.filter(r => r.inTraffic).map(r => r.unit)).size;
  return { rows: sorted, reviews, date, today, lines: out.length,
           units: new Set(plan.rows.map(r => r.unit)).size, inTraffic, ignored: ignore.size };
}

/* ---------- the table as text ----------
   Fixed columns, so it pastes into anything. One line per plan line, the
   nearest first. */
function factsOf(r) {
  if (r.ignored) return "O/O/S — ignored";
  const flags = [];
  if (r.category) flags.push(r.category);
  if (r.amat) flags.push(r.mse ? "AMAT" : "AMAT — no berth request unless restricted");
  if (r.mse) flags.push("MSE — ask whether they are attending");
  const tail = flags.length ? "  [" + flags.join(" · ") + "]" : "";
  if (!r.inTraffic) return "not in traffic today" + tail;
  const bits = [];
  bits.push("on " + r.diags.join("+"));
  bits.push("ENDS " + r.ends.place + " " + hhmm(r.ends.time, true) + (r.afterMidnight ? " (after midnight)" : ""));
  const at = r.calls.filter(c => !c.ends);
  if (r.endsAtTarget) bits.push("ends where it is wanted");
  else if (at.length) {
    // the ARRIVAL, marked empty or not by what it came in on, and what it
    // leaves on - the two things a berth request is written from
    bits.push("calls " + at.map(c => c.place + " " + hhmm(c.arr, /^5/.test(c.hcIn || "")) +
      (c.stay != null && c.stay >= 60 ? " (stands " + Math.round(c.stay / 60 * 10) / 10 + " h)" : "") +
      (c.hc ? " off " + c.hc.slice(0, 4) : "")).join(", "));
  } else if (r.places.length && !r.places.every(p => !(PLACES[p] || []).length)) {
    bits.push("does not call at " + r.places.join("/") + " today");
  }
  return bits.join(" · ") + tail;
}
function dueOf(r) {
  if (r.when.asap) return "ASAP";
  if (r.when.miles !== null) return "after " + r.when.miles + " mi";
  if (!r.when.date) return r.when.text || "—";
  const d = r.when.date;
  const label = DAY_NAMES[d.getUTCDay()] + " " + String(d.getUTCDate()).padStart(2, "0") + "/" + String(d.getUTCMonth() + 1).padStart(2, "0");
  const half = r.when.half === "EOD" ? " EOD" : r.when.half === "AFTER AM PEAK" ? " after AM peak" :
               r.when.time != null ? " " + hhmm(r.when.time) : r.when.half ? " " + r.when.half : "";
  const ahead = r.ahead === 0 ? " (today)" : r.ahead === 1 ? " (tomorrow)" : r.ahead > 1 ? " (+" + r.ahead + "d)" : r.ahead < 0 ? " (overdue)" : "";
  return label + half + ahead;
}
function render(res) {
  /* Fixed columns up to the plan's own action, then the facts, which run
     as long as they need to - a unit that calls at Ashford four times is
     not cut off after two. */
  const W = { unit: 7, sec: 10, needs: 9, due: 26, action: 22 };
  const pad = (s, n) => String(s == null ? "" : s).padEnd(n).slice(0, n);
  const head = pad("UNIT", W.unit) + " " + pad("LIST", W.sec) + " " + pad("NEEDS", W.needs) + " " +
               pad("DUE", W.due) + " " + pad("PLAN SAYS", W.action) + " " + "TODAY";
  const lines = [head, "-".repeat(head.length + 40)];
  let tier = 0;
  for (const r of res.rows) {
    if (r.tier !== tier) {
      tier = r.tier;
      if (lines.length > 2) lines.push("");
      lines.push(tier === 1 ? "== NEXT: today, tomorrow, ASAP and overdue ==" :
                 tier === 2 ? "== THIS WEEK, and the mileage triggers ==" :
                              "== LATER: where it ends tonight ==");
    }
    lines.push(pad(r.unit, W.unit) + " " + pad(r.section, W.sec) + " " + pad(r.places.join("/") || "—", W.needs) + " " +
               pad(dueOf(r), W.due) + " " + pad(r.action, W.action) + " " + factsOf(r));
  }
  return lines.join("\n");
}

return { run, render, parsePlan, whenOf, PLACES, placeOf };
})();
if (typeof module !== "undefined" && module.exports) module.exports = SHEETS_BERTH;
if (typeof globalThis !== "undefined") globalThis.SHEETS_BERTH = SHEETS_BERTH;
