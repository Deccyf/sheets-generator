/* SHEETS_BERTH — berth requests off the maintenance plan.

   The planner pastes the maintenance plan out of the Telex workbook, and
   for every line of it this says where that unit is today, on which
   diagram, where and when it ends tonight, whether it calls at the place
   the plan wants it, and whether the diagram it is on splits - read off the
   same Diagram Summary and Diagram Detail the weekday books were just built
   from. Then, off those facts and the depot's own rules, it SUGGESTS an
   action in the depot's own words - RE HOLD, RE C/O AND HOLD, GP BERTH off
   5N32, ENDS DVP - beside whatever the planner has already written, which
   is never written over. A plan pasted with the Action column empty comes
   back with the suggestions filling it.

   The plan comes back in its own shape: the same sections, the same
   columns, the same order, the exam rows in the same colours, so what is
   on screen and what is copied is the workbook with two columns added.

   One day's reports say where every unit is today and where it ends
   tonight; they do not say which diagram it takes tomorrow, because that is
   the allocator's choice each morning. So the nearer a line's date the
   more this can say, and past a few days out it says where the unit ends
   tonight - which is what the plan itself writes. */
"use strict";
const SHEETS_BERTH = (() => {
const stopsOf = GENIUS._stopsOf;
/* The changeover notice names places the way the controller's list does -
   DVP, CHX, HGS, RAM - so it borrows that road's table and falls back to
   the plan's own words. */
const STATION = (typeof SHEETS_SHORTAGE !== "undefined" && SHEETS_SHORTAGE.ABBR) || {};
const stationOf = code => STATION[code] || CODE_TO_PLACE.get(code) || code || "?";

/* ---------- the plan's places ----------
   The plan writes the depot; the reports write Genius location codes. RE is
   any road at Ramsgate, GP any of the three Grove Park roads, and so on.
   Selhurst is not on this network: a 377 bound there goes over on a fleet
   move from Victoria, so a line for SU is answered at Victoria. */
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
  SU:   ["VICTRIE", "VICTGCS"],
};
/* The depots - where a unit is worked on, and where a berth request can
   put it. A call here is a chance to hold it; a call at a station is not. */
const DEPOTS = new Set(["RE", "GI", "SG", "GP", "AFK", "XSE", "FKE", "VIC", "SU"]);
/* Where a changeover can be made: Ramsgate, and the London terminals. */
const CHANGEOVER_AT = new Set(["RAMSGTE", "CHRX", "CANONST", "VICTRIE", "LNDNBDG"]);
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
/* The depot a place belongs to, for the fleet moves and the holds. */
const DEPOT_OF = { RE: "RE", RAM: "RE", GI: "GI", GLM: "GI", SG: "SG", SGUPS: "SG",
                   GP: "GP", GPD: "GP", AFK: "AFK", XSE: "XSE", FKE: "FKE",
                   VIC: "VIC", SU: "SU" };
const depotOf = place => DEPOT_OF[place] || null;

/* ---------- the standing fleet moves ----------
   Engineering Planning's own sheet (September 2026): the empty paths that
   run between the depots, and the days they run. A unit that is at the
   right depot in time for one can be sent on it. "SuX" is Sundays
   excepted, "SO" Saturdays only, "M-F" the weekdays. */
const FLEET_MOVES = [
  ["5Y17", "SuX", "10+10", "SG", "RE"], ["5Y19", "SuX", "13+10", "RE", "SG"],
  ["5L17", "M-F", "10+10", "SG", "GI"], ["5G71", "M-F", "09+35", "GI", "GP"],
  ["5G70", "M-F", "14+29", "GP", "GI"], ["5A19", "M-F", "09+35", "GI", "SG"],
  ["5L19", "M-F", "13+12", "SG", "GI"], ["5Y20", "SO",  "10+08", "RE", "SG"],
  ["5Y21", "SO",  "14+06", "SG", "RE"], ["5W39", "M-F", "20+09", "RE", "AFK"],
  ["5R51", "M-F", "22+31", "AFK", "RE"], ["5R00", "M-F", "11+12", "GP", "RE"],
  ["5W00", "M-F", "14+18", "RE", "GP"], ["5N01", "M-F", "10+29", "GP", "SG"],
  ["5D01", "M-F", "11+54", "SG", "GP"], ["5N02", "M-F", "21+45", "GP", "SG"],
  ["5D00", "M-F", "03+50", "SG", "GP"], ["5U92", "M-F", "20+08", "SG", "RE"],
  ["5U93", "M-F", "22+33", "RE", "SG"], ["5L92", "M-F", "20+08", "SG", "GI"],
  ["5Y39/5Y41", "SuX", "11+02", "VIC", "SU"], ["5Y43/5Y44", "SuX", "13+16", "SU", "VIC"],
  ["5Y40/5Y41", "SuX", "20+18", "VIC", "SU"], ["5Y43/5Y44", "SuX", "22+20", "SU", "VIC"],
].map(([hc, days, time, from, to]) => ({ hc, days, time, from, to }));
const runsOn = (days, dow) =>            // dow: 0 Sunday .. 6 Saturday
  days === "SuX" ? dow !== 0 : days === "SO" ? dow === 6 : dow >= 1 && dow <= 5;
function movesFrom(depot, targets, dow) {
  return FLEET_MOVES.filter(m => m.from === depot && targets.indexOf(m.to) >= 0 && runsOn(m.days, dow));
}

/* ---------- the plan ----------
   Pasted straight out of the workbook: tab-separated, a section title on a
   line of its own, its column headings under it, then a row per unit. The
   sections carry different columns, so each row keeps the section it came
   from and the fields are read by what the section is. */
const SECTION_RE = /^(Exams|Campaigns|Scheduled Maint|Requests|UAT|MLT\s*\/\s*LATHE|Defects)\b/i;
const SECTION_COLS = {
  "EXAMS":           ["Unit Nr", "Exam", "When", "Where", "Action"],
  "DEFECTS":         ["Unit Nr", "Days", "Priority", "Target Date", "Action"],
  "CAMPAIGNS":       ["Unit Nr", "Where", "When", "For", "Action"],
  "SCHEDULED MAINT": ["Unit Nr", "Where", "When", "For", "Action"],
  "REQUESTS":        ["Unit Nr", "Where", "When", "For", "Action"],
  "UAT":             ["Unit Nr", "Where", "When", "For", "Action"],
  "MLT/LATHE":       ["Unit Nr", "Where", "When", "For", "Action"],
};
const SECTION_TITLE = { "EXAMS": "Exams", "DEFECTS": "Defects", "CAMPAIGNS": "Campaigns",
  "SCHEDULED MAINT": "Scheduled Maint", "REQUESTS": "Requests", "UAT": "UAT", "MLT/LATHE": "MLT/ LATHE" };
/* Where a defect is worked on is a matter of class, not of the line: a 376
   goes back to Slade Green or Gillingham, a 375 to Ramsgate, a 375/3 to
   Ramsgate or Gillingham. A 377 is Selhurst's and gets there on the fleet
   move from Victoria, so Victoria is where it has to be. */
function defectHome(unit) {
  if (/^376/.test(unit)) return "SG/GI";
  if (/^3753/.test(unit)) return "RE/GI";
  if (/^375/.test(unit)) return "RE";
  if (/^377/.test(unit)) return "VIC";
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
  const rows = [], reviews = [], order = [];
  let section = null, n = 0;
  for (const raw of String(text || "").split(/\r?\n/)) {
    const f = raw.split("\t").map(x => x.trim());
    if (!f.some(Boolean)) continue;
    n++;
    if (SECTION_RE.test(f[0]) && !UNIT_RE.test(f[0])) {
      section = f[0].replace(/\s*\/\s*/, "/").toUpperCase();
      if (order.indexOf(section) < 0) order.push(section);
      continue;
    }
    if (/^Unit\s*Nr/i.test(f[0])) continue;
    if (!UNIT_RE.test(f[0])) continue;
    if (!section) {
      reviews.push("Line " + n + " (" + f[0] + ") is above any section title, so which list it belongs to is not known — it is read as a request.");
      section = "REQUESTS"; if (order.indexOf(section) < 0) order.push(section);
    }
    const row = { section, unit: f[0], line: n, raw: f.slice(0, 5) };
    while (row.raw.length < 5) row.raw.push("");
    if (section === "EXAMS") {
      row.what = f[1] || ""; row.when = f[2] || ""; row.where = f[3] || ""; row.action = f[4] || "";
    } else if (section === "DEFECTS") {
      row.days = parseInt(f[1], 10); row.what = f[2] || ""; row.when = f[3] || "";
      row.where = defectHome(row.unit); row.action = f[4] || ""; row.isDefect = true;
      row.category = defectCategory(row.what);
    } else {
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
  return { rows, reviews, order };
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
  const out = { text: t, date: null, half: null, miles: null, asap: false, time: null };
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
function parseShort(s) {          // "dd/mm/yy" -> Date
  const m = /^(\d{2})\/(\d{2})\/(\d{2})$/.exec(String(s || "").trim());
  return m ? dateFrom(+m[1], +m[2], +m[3]) : null;
}
const hhmm = (t, ecs) => {
  if (t == null) return "";
  const m = ((t % 1440) + 1440) % 1440;
  return String(Math.floor(m / 60)).padStart(2, "0") + (ecs ? "+" : " ") + String(m % 60).padStart(2, "0");
};
/* ---------- every diagram's day ----------
   The candidates for a swap are the diagrams that end tonight where a unit
   is wanted, so the whole day is read once: each diagram's stops, its
   units, where it ends, what it ends on. */
function allDays(genius, date) {
  const out = new Map();
  const dets = genius.detail && genius.detail.get(date);
  if (!dets) return out;
  const unitsOf = new Map(), fleetOf = new Map();
  for (const r of genius.summary || []) if (r.date === date) {
    unitsOf.set(r.diag, (unitsOf.get(r.diag) || []).concat(r.units || (r.unit ? [r.unit] : [])));
    if (r.fleet && !fleetOf.has(r.diag)) fleetOf.set(r.diag, r.fleet);
  }
  for (const [diag, raw] of dets) {
    const stops = stopsOf(raw).map(s => ({ ...s, diag }));
    if (!stops.length) continue;
    const last = stops[stops.length - 1];
    const splitsAt = [];
    for (const r of raw) if (/^(ATTTT|ATTACH|DETACH|DETTT)$/.test(r.ev || "")) {
      const p = placeOf(r.code); if (splitsAt.indexOf(p) < 0) splitsAt.push(p);
    }
    out.set(diag, { diag, stops, units: [...new Set(unitsOf.get(diag) || [])], fleet: fleetOf.get(diag) || "",
                    endCode: last.code, endPlace: placeOf(last.code), endDepot: depotOf(placeOf(last.code)),
                    endTime: last.arr != null ? last.arr : last.dep, splitsAt,
                    final: finalWorking(stops), raw });
  }
  return out;
}
/* The working a diagram ENDS on, and how the depot names it: Gillingham,
   Victoria and Grove Park by its headcode; everywhere else by the time it
   left - off the platform if it went into the platform first, off the
   stop if it ran empty from somewhere. That is the time the berthing book
   writes for it, and the berth request is written the same way. */
const HEADCODE_DEPOTS = new Set(["GI", "VIC", "GP", "SU"]);
function finalWorking(stops) {
  const n = stops.length;
  if (n < 2) return null;
  const hc = stops[n - 2].hcOut;
  let j = n - 2;
  while (j > 0 && stops[j - 1].hcOut === hc && stops[j - 1].dep != null) j--;
  const origin = stops[j];
  return { hc, from: origin.code, dep: origin.dep, arr: stops[n - 1].arr, ecs: /^5/.test(hc || "") };
}
function requestName(depot, fin) {
  if (!fin) return "";
  return HEADCODE_DEPOTS.has(depot) ? (fin.hc || hhmm(fin.dep, fin.ecs)) : hhmm(fin.dep, fin.ecs);
}
/* Where a diagram calls at a place a changeover can be made - Ramsgate or
   a London terminal - with what it came in on and from where, and what it
   goes out on and to where. */
function terminalCalls(stops) {
  const out = [];
  for (let i = 1; i < stops.length - 1; i++) {
    const s = stops[i];
    if (!CHANGEOVER_AT.has(s.code) || s.arr == null || s.dep == null) continue;
    let j = i - 1;
    while (j > 0 && stops[j - 1].hcOut === s.hcIn && stops[j - 1].dep != null) j--;
    let k = i;
    while (k < stops.length - 1 && stops[k].hcOut === s.hcOut && stops[k].dep != null) k++;
    out.push({ idx: i, code: s.code, arr: s.arr, dep: s.dep, hcIn: s.hcIn, hcOut: s.hcOut,
               inFrom: stops[j].code, inDep: stops[j].dep, outTo: stops[k].code });
  }
  return out;
}
/* Where a diagram STANDS at a depot during the day - an hour in the Grove
   Park up sidings between the peaks, say - with what it came in on and
   what it goes out on. That is the weekday AM berth, and the PM request is
   the working it leaves on; a unit that has come out of Ramsgate to Grove
   Park for the morning and is wanted back at a maintenance depot is got
   there by swapping the afternoon working with one that ends there. */
const DEPOT_CODES = (() => {
  const m = new Map();
  for (const [place, codes] of Object.entries(PLACES)) {
    const d = depotOf(place);
    if (d && DEPOTS.has(d)) for (const c of codes) m.set(c, d);
  }
  // a station platform is a call, not a stand
  for (const c of ["RAMSGTE", "GLNGHMK", "ASHFKY", "VICTRIE"]) m.delete(c);
  return m;
})();
const STAND_MIN = 30;
function depotStands(stops) {
  const out = [];
  for (let i = 1; i < stops.length - 1; i++) {
    const s = stops[i];
    const depot = DEPOT_CODES.get(s.code);
    if (!depot || s.arr == null || s.dep == null || s.dep - s.arr < STAND_MIN) continue;
    let j = i - 1;
    while (j > 0 && stops[j - 1].hcOut === s.hcIn && stops[j - 1].dep != null) j--;
    let k = i;
    while (k < stops.length - 1 && stops[k].hcOut === s.hcOut && stops[k].dep != null) k++;
    out.push({ idx: i, code: s.code, depot, arr: s.arr, dep: s.dep, hcIn: s.hcIn, hcOut: s.hcOut,
               inFrom: stops[j].code, inDep: stops[j].dep, outTo: stops[k].code });
  }
  return out;
}
/* Everything the day knows about one unit: its diagram(s), the stops in
   order, where it ends and when, whether the diagram splits. */
function unitDay(unit, genius, date) {
  const rows = (genius.summary || []).filter(r => r.date === date &&
    (r.units ? r.units.indexOf(unit) >= 0 : r.unit === unit));
  if (!rows.length) return null;
  rows.sort((a, b) => a.start - b.start);
  const diags = [...new Set(rows.map(r => r.diag))];
  const dets = genius.detail && genius.detail.get(date);
  /* A diagram that attaches or detaches during the day is portion working -
     on the Kent Coast that is at Ashford, Faversham, Ramsgate, Victoria and
     Dover, and 131 of the 296 diagrams on the 18/09 Detail do it. Said with
     the places, because "splits" alone tells the planner nothing they can
     check. */
  let stops = [], splitsAt = [], rawAll = [];
  for (const d of diags) {
    const raw = dets && dets.get(d);
    if (!raw) continue;
    rawAll = rawAll.concat(raw);
    stops = stops.concat(stopsOf(raw).map(s => ({ ...s, diag: d })));
    for (const r of raw) if (/^(ATTTT|ATTACH|DETACH|DETTT)$/.test(r.ev || "")) {
      const p = placeOf(r.code);
      if (splitsAt.indexOf(p) < 0) splitsAt.push(p);
    }
  }
  const splits = splitsAt.length > 0;
  const last = rows[rows.length - 1];
  const lastStop = stops.length ? stops[stops.length - 1] : null;
  return {
    unit, diags, rows, stops, splits, splitsAt, raw: rawAll,
    endCode: lastStop ? lastStop.code : last.to,
    endTime: lastStop ? (lastStop.arr != null ? lastStop.arr : lastStop.dep) : last.end,
    startCode: rows[0].from, startTime: rows[0].start,
  };
}
/* The calls a unit makes at the plan's place today: arrival, departure,
   what it came in on and what it leaves on. Where it started the day is
   not a call. */
function callsAt(day, places) {
  const want = new Set([].concat(...places.map(p => PLACES[p] || [])));
  if (!want.size) return [];
  const out = [];
  for (const s of day.stops) {
    if (!want.has(s.code)) continue;
    if (s.arr == null) continue;
    const stay = s.dep != null ? s.dep - s.arr : null;
    out.push({ code: s.code, place: placeOf(s.code), arr: s.arr, dep: s.dep,
               hcIn: s.hcIn, hc: s.hcOut, stay, diag: s.diag, ends: s.dep == null });
  }
  return out;
}

/* ---------- a swap ----------
   A unit that does not reach the depot it is wanted at can change over
   with a unit whose diagram does end there, at Ramsgate or a London
   terminal, if the two are there around the same time. Cross-referenced,
   as the depot put it: the diagrams that go into London around the same
   time and form a service back out, that end back at the depot.

   The conditions are the depot's. No delay to the next service: each unit
   has to be on the platform ten minutes before the working it takes
   leaves. Around the same time: the two arrivals within ninety minutes.
   Splits and joins: the formations have to match, and neither diagram may
   attach or detach after the swap point, because the other unit would be
   taken into it. Nothing lost back to the depot: the unit displaced must
   not be one the plan wants at that same depot. */
const SWAP_MARGIN = 10, SWAP_WINDOW = 90;
/* Fleets stay on their own diagrams: a 375/9 on a 375/9 diagram, a 3-car
   on a 3-car diagram, a 375/6, /7 or /8 on a plain 375 one, a 376 on a 376
   diagram, a 377 on a GT diagram - and none of them couples to another
   fleet. The diagram's fleet is the Summary's FLEET column; the unit's is
   its number. */
function familyOfUnit(u) {
  const n = String(u);
  if (/^3759/.test(n)) return "375/9";
  if (/^3753/.test(n)) return "375/3";
  if (/^375/.test(n)) return "375";
  return n.slice(0, 3);
}
function familyOfFleet(f) {
  const m = /^(\d{3})(?:\/(\d))?/.exec(String(f || ""));
  if (!m) return "";
  if (m[1] === "375") return m[2] === "9" ? "375/9" : m[2] === "3" ? "375/3" : "375";
  return m[1];
}
const fits = (unit, fleet) => familyOfUnit(unit) === familyOfFleet(fleet);
function splitsAfter(day, idx) {
  // an attach or detach at or after this stop, by the raw rows' clock
  const t = day.stops[idx].dep;
  return day.raw.some(r => /^(ATTTT|ATTACH|DETACH|DETTT)$/.test(r.ev || "") &&
    r.dep != null && r.dep >= t);
}
function swapBetween(mine, theirs) {
  let best = null;
  const consider = (x, y, kind, at) => {
    // each unit on hand before the working it takes leaves: no delay
    if (x.arr + SWAP_MARGIN > y.dep || y.arr + SWAP_MARGIN > x.dep) return;
    const cand = { kind, at, mine: x, theirs: y, gap: Math.abs(x.arr - y.arr),
                   splitsMine: splitsAfter(mine, x.idx), splitsTheirs: splitsAfter(theirs, y.idx) };
    if (cand.splitsTheirs) return;
    // a swap where both stand at a depot is the easier one to make
    const rank = (kind === "depot" ? 0 : 1000) + cand.gap;
    if (!best || rank < best.rank) best = { ...cand, rank };
  };
  const ta = terminalCalls(mine.stops), tb = terminalCalls(theirs.stops);
  for (const x of ta) for (const y of tb) {
    if (x.code !== y.code) continue;
    if (Math.abs(x.arr - y.arr) > SWAP_WINDOW) continue;   // around the same time
    consider(x, y, "terminal", x.code);
  }
  const sa = depotStands(mine.stops), sb = depotStands(theirs.stops);
  for (const x of sa) for (const y of sb) {
    if (x.depot !== y.depot) continue;                   // any road of the same depot
    consider(x, y, "depot", x.code);
  }
  return best;
}
function candidatesFor(r, mine, days, wanted) {
  const targets = r.places.map(depotOf).filter(Boolean);
  const out = [];
  const myFleet = mine.rows[0] && mine.rows[0].fleet;
  const myCount = mine.rows[0] && mine.rows[0].units ? mine.rows[0].units.length : 1;
  for (const d of days.values()) {
    if (!d.endDepot || targets.indexOf(d.endDepot) < 0) continue;
    if (mine.diags.indexOf(d.diag) >= 0) continue;
    if (!d.units.length) continue;
    // the same number of units go on the service, and the same fleet both ways
    if (d.units.length !== myCount) continue;
    if (!fits(r.unit, d.fleet)) continue;
    if (myFleet && d.units.some(u => !fits(u, myFleet))) continue;
    // a unit the plan wants at that same depot is not to be taken off it
    if (d.units.some(u => (wanted.get(u) || []).indexOf(d.endDepot) >= 0)) continue;
    const swap = swapBetween(mine, d);
    out.push({ day: d, swap, name: requestName(d.endDepot, d.final) });
  }
  // a swap that can be made first, then the earlier home the better
  out.sort((p, q) => ((q.swap ? 1 : 0) - (p.swap ? 1 : 0)) || (p.day.endTime - q.day.endTime));
  return out;
}
/* The notice, in the depot's own form:
     375609 CONTAINING MO RESTRICTION - CHX PLEASE NOTE
     2W30 10 28 DVP - CHX T/F 1H34 12 45 CHX - HGS
     1H76 10 50 HGS - CHX T/F 2R34 12 34 CHX - RAM */
const leg = (hc, dep, from, to) => (hc || "????") + " " + hhmm(dep, /^5/.test(hc || "")) + " " + stationOf(from) + " - " + stationOf(to);
function reasonOf(r) {
  if (r.isDefect) return r.category === "MO" || r.category === "NM" ? r.category + " RESTRICTION"
                       : r.category === "EOD" ? "EOD DEFECT" : "PERFORMANCE DEFECT";
  if (r.section === "EXAMS") return (r.what || "").toUpperCase() + " EXAM";
  return (r.what || r.section).toUpperCase();
}
function noticeOf(r, c) {
  const sw = c.swap, x = sw.mine, y = sw.theirs;
  const at = sw.kind === "depot" ? sw.mine.depot : stationOf(sw.at);
  const lines = [r.unit + " CONTAINING " + reasonOf(r) + " - " + at + " PLEASE NOTE"];
  lines.push(leg(x.hcIn, x.inDep, x.inFrom, x.code) + " T/F " + leg(y.hcOut, y.dep, y.code, y.outTo));
  lines.push(leg(y.hcIn, y.inDep, y.inFrom, y.code) + " T/F " + leg(x.hcOut, x.dep, x.code, x.outTo) +
             (sw.splitsMine ? "  (" + (c.day.units[0] || "the other unit") + " takes a working that splits)" : ""));
  return lines;
}

/* ---------- the suggestion ----------
   The depot's rules, applied to the facts. In the depot's own words, and
   only where the facts support one; otherwise where the unit ends, which
   is what the plan writes for a line that is not yet near. */
const A_HOLD = (p, mon) => p + " HOLD" + (mon ? " FOR MON" : "");
function weekendHold(r) {
  // a line due Saturday, Sunday or Monday, seen from Friday or the weekend,
  // is held for Monday - the depot's own form for it
  if (!r.when.date || !r.today) return false;
  const due = r.when.date.getUTCDay(), now = r.today.getUTCDay();
  return (due === 6 || due === 0 || due === 1) && (now === 5 || now === 6 || now === 0);
}
function suggest(r, ctx) {
  const s = { action: "", notes: [], notice: null };
  const t = r.places[0] || "";
  const targets = r.places.map(depotOf).filter(Boolean);
  if (r.ignored) { s.action = "O/O/S"; return s; }
  if (r.amat && !/^(MO|NM)$/.test(r.category || "")) {
    s.action = "AMAT — NO REQUEST"; return s;
  }
  if (r.mse) s.notes.push("MSE — no request if they are attending");
  if (!r.inTraffic) { s.action = "NOT IN TRAFFIC"; return s; }
  const endsAt = depotOf(r.ends.place);
  const near = r.tier === 1;
  const mon = weekendHold(r);
  // exams: Ramsgate wants them back by 20 00 where it can be done, never after 22 00
  const backBy = () => {
    const m = r.ends.time;
    if (m == null) return;
    if (r.afterMidnight) { s.notes.push("back " + hhmm(m, true) + ", after midnight — counts"); return; }
    if (r.section !== "EXAMS" || endsAt !== "RE") return;
    if (m > 22 * 60) s.notes.push("back " + hhmm(m, true) + " — after 22 00");
    else if (m > 20 * 60) s.notes.push("back " + hhmm(m, true) + " — after 20 00");
  };
  if (r.endsAtTarget) {
    if (near) {
      s.action = A_HOLD(depotOf(r.ends.place) || r.ends.place, mon);
      if (r.when.half === "PM" && r.ahead === 1) s.notes.push("PM — could run the morning first");
      backBy();
    } else {
      s.action = "ENDS " + r.ends.place;
      if (r.tier === 2) s.notes.push("ends where it is wanted");
    }
    return s;
  }
  // a call at the target during the day: a changeover at Ramsgate or a
  // London terminal, a berth at any other depot, off the working it is on
  const stands = r.calls.filter(c => !c.ends);
  const co = stands.find(c => CHANGEOVER_AT.has(c.code) && depotOf(c.place) && targets.indexOf(depotOf(c.place)) >= 0);
  const berth = stands.find(c => depotOf(c.place) && targets.indexOf(depotOf(c.place)) >= 0 && DEPOTS.has(depotOf(c.place)));
  const at = co || berth;
  if (at && near) {
    const d = depotOf(at.place);
    s.action = co ? d + " C/O AND HOLD" + (mon ? " FOR MON" : "")
                  : d + " BERTH" + (at.hc ? " off " + at.hc.slice(0, 4) : "");
    // the one place the rule bites: taking a unit off or onto a working
    if (r.splits) s.notes.push("splits at " + r.splitsAt.join("/"));
    s.notes.push("at " + at.place + " " + hhmm(at.arr, /^5/.test(at.hcIn || "")) +
      (at.stay != null && at.stay >= 60 ? " for " + Math.round(at.stay / 60 * 10) / 10 + " h" : "") +
      (at.hc ? ", leaves on " + at.hc.slice(0, 4) : ""));
    return s;
  }
  /* Nothing today. A berth request names a working that DOES end where
     the unit is wanted - a swap onto it at a terminal where it can be
     made, or failing that the working itself, for a depot swap. */
  if (near && targets.length && ctx && ctx.mine) {
    const cands = candidatesFor(r, ctx.mine, ctx.days, ctx.wanted);
    const c = cands[0];
    if (c) {
      const depot = c.day.endDepot, sw = c.swap;
      if (sw && sw.kind === "depot") {
        /* the AM berth it is already booked to make, and the PM working out
           of it that ends where it is wanted - the depot's own "GP BERTH
           5N32/5F28" - named the way that depot names workings */
        const at = sw.mine.depot;
        const nm = w => HEADCODE_DEPOTS.has(at) ? (w.hc || hhmm(w.dep, /^5/.test(w.hc || ""))) : hhmm(w.dep, /^5/.test(w.hc || ""));
        s.action = at + " BERTH " + nm({ hc: sw.mine.hcIn, dep: sw.mine.inDep }) + "/" + nm({ hc: sw.theirs.hcOut, dep: sw.theirs.dep });
        s.notes.push("AM at " + placeOf(sw.at) + " " + hhmm(sw.mine.arr, /^5/.test(sw.mine.hcIn || "")) + "–" + hhmm(sw.mine.dep, /^5/.test(sw.mine.hcOut || "")) +
                     "; PM take " + c.day.diag + "'s " + (sw.theirs.hcOut || "?") + " " + hhmm(sw.theirs.dep, /^5/.test(sw.theirs.hcOut || "")) +
                     ", ends " + c.day.endPlace + " " + hhmm(c.day.endTime, true) +
                     (c.day.units.length ? "; " + c.day.units.join("+") + " takes " + (sw.mine.hcOut || "?") : ""));
      } else {
        s.action = depot + " BERTH " + c.name + (sw ? " — T/F AT " + stationOf(sw.at) : " (no shared terminal — depot swap)");
        s.notes.push("on " + c.day.diag + ", ends " + c.day.endPlace + " " + hhmm(c.day.endTime, true) +
                     (c.day.units.length ? ", " + c.day.units.join("+") + " off it" : ""));
      }
      if (sw) s.notice = noticeOf(r, c);
      if (c.day.splitsAt.length) s.notes.push(c.day.diag + " splits at " + c.day.splitsAt.join("/"));
      if (cands.length > 1) s.notes.push("or " + cands.slice(1, 3).map(k => k.day.diag + " " + k.name).join(", "));
      return s;
    }
  }
  s.action = "ENDS " + r.ends.place;
  if (near && targets.length) s.notes.push("no call at " + r.places.join("/") + " today" +
    (ctx && ctx.days && ctx.days.size ? ", and nothing of its class ends at " + r.places.join("/") + " that it could take" : ""));
  if (r.today && endsAt && r.tier <= 2) {
    const dow = (r.today.getUTCDay() + 1) % 7;    // tomorrow, when it is where it ends
    for (const m of movesFrom(endsAt, targets, dow))
      s.notes.push("fleet move " + m.hc + " " + m.time + " " + m.from + " - " + m.to + " (" + m.days + ")");
  }
  if (at && !near) s.notes.push("calls " + at.place + " " + hhmm(at.arr, /^5/.test(at.hcIn || "")) + (at.hc ? " off " + at.hc.slice(0, 4) : ""));
  return s;
}

/* ---------- one plan, one day ---------- */
function run(planText, genius, opts) {
  opts = opts || {};
  const plan = parsePlan(planText);
  const reviews = plan.reviews.slice();
  const date = (genius && genius.summary && genius.summary.length)
    ? (opts.date || genius.summary[0].date) : null;
  const today = date ? parseShort(date) : null;
  if (!date) reviews.push("No weekday reports are loaded, so nothing can be said about where any unit is — build the weekday books first.");
  const ignore = new Set(String(opts.ignore || "").match(/\d{6}/g) || []);
  const filled = (genius && genius.summary || []).filter(r => r.date === date && r.units && r.units.length).length;
  if (date && !filled)
    reviews.push("The Diagram Summary has no units on it — it was printed before the day was allocated. " +
                 "Drop the print that was run after allocation (the evening one) and this can say where each unit is.");
  const days = date ? allDays(genius, date) : new Map();
  /* What every unit on the plan wants, so a swap never takes a unit off the
     diagram that was getting it home. */
  const wanted = new Map();
  for (const row of plan.rows) {
    const ds = row.places.map(depotOf).filter(Boolean);
    if (ds.length) wanted.set(row.unit, (wanted.get(row.unit) || []).concat(ds));
  }
  const out = [], notices = [];
  for (const row of plan.rows) {
    const when = whenOf(row.when, today);
    /* An end-of-day defect with no target date is due TODAY - back at a
       maintenance depot by the end of the day is what EOD means. */
    if (row.category === "EOD" && !when.date && !when.asap && when.miles === null && today) {
      when.date = today; when.half = "EOD"; when.text = when.text || "EOD";
    }
    const ahead = daysAhead(when, today);
    const r = { ...row, when, ahead, today, tier: tierOf(when, ahead), ignored: ignore.has(row.unit) };
    const day = date ? unitDay(row.unit, genius, date) : null;
    if (day) {
      r.diags = day.diags; r.splits = day.splits; r.splitsAt = day.splitsAt;
      r.ends = { code: day.endCode, place: placeOf(day.endCode), time: day.endTime };
      r.starts = { code: day.startCode, place: placeOf(day.startCode), time: day.startTime };
      r.calls = callsAt(day, row.places);
      r.endsAtTarget = row.places.some(p => (PLACES[p] || []).indexOf(day.endCode) >= 0);
      r.afterMidnight = day.endTime != null && day.endTime >= 1440;
    } else {
      r.diags = []; r.ends = null; r.calls = []; r.endsAtTarget = false; r.splits = false; r.splitsAt = [];
    }
    r.inTraffic = !!day;
    r.suggest = suggest(r, { mine: day, days, wanted });
    if (r.suggest.notice && !notices.some(n => n[0] === r.suggest.notice[0])) notices.push(r.suggest.notice);
    out.push(r);
  }
  const tiered = out.slice().sort((a, b) => (a.tier - b.tier) || (a.line - b.line));
  const inTraffic = new Set(out.filter(r => r.inTraffic).map(r => r.unit)).size;
  return { rows: out, tiered, notices, order: plan.order, reviews, date, today, lines: out.length,
           units: new Set(plan.rows.map(r => r.unit)).size, inTraffic, ignored: ignore.size,
           suggested: out.filter(r => !r.action && r.suggest.action).length };
}

/* ---------- what each line says ---------- */
function factsOf(r) {
  if (r.ignored) return "O/O/S — ignored";
  const flags = [];
  if (r.category) flags.push(r.category);
  if (r.amat) flags.push("AMAT");
  if (r.mse) flags.push("MSE");
  const tail = flags.length ? "  [" + flags.join(" · ") + "]" : "";
  if (!r.inTraffic) return "not in traffic today" + tail;
  const bits = [];
  bits.push("on " + r.diags.join("+") + (r.splits ? " (splits at " + r.splitsAt.join("/") + ")" : ""));
  bits.push("ENDS " + r.ends.place + " " + hhmm(r.ends.time, true) + (r.afterMidnight ? " (after midnight)" : ""));
  const at = r.calls.filter(c => !c.ends);
  if (r.endsAtTarget) bits.push("ends where it is wanted");
  else if (at.length) {
    // the first three, then how many more: a Victoria shuttle calls there
    // fourteen times and nobody needs all fourteen on the line
    const show = at.slice(0, 3);
    bits.push("calls " + show.map(c => c.place + " " + hhmm(c.arr, /^5/.test(c.hcIn || "")) +
      (c.stay != null && c.stay >= 60 ? " (stands " + Math.round(c.stay / 60 * 10) / 10 + " h)" : "") +
      (c.hc ? " off " + c.hc.slice(0, 4) : "")).join(", ") +
      (at.length > 3 ? " +" + (at.length - 3) + " more" : ""));
  } else if (r.places.length && !r.places.every(p => !(PLACES[p] || []).length)) {
    bits.push("does not call at " + r.places.join("/") + " today");
  }
  return bits.join(" · ") + tail;
}
function suggestedOf(r) {
  const s = r.suggest || { action: "", notes: [] };
  return s.action + (s.notes.length ? " (" + s.notes.join("; ") + ")" : "");
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

/* ---------- the plan, given back in its own shape ----------
   The same sections in the same order, the same columns, every row where
   it was, with SUGGESTED and TODAY added on the right. The exam rows keep
   the workbook's colours by exam type. */
const EXAM_CLASS = what => {
  const w = String(what || "").toUpperCase();
  if (/^B\b/.test(w)) return "ex-b";
  if (/^C\b/.test(w)) return "ex-c";
  if (/^M\d/.test(w)) return "ex-m";
  if (/^T\d/i.test(w)) return "ex-t";
  if (/^XS/.test(w)) return "ex-x";
  return "ex-a";
};
function shape(res) {
  const sections = [];
  for (const sec of res.order) {
    const rows = res.rows.filter(r => r.section === sec);
    if (!rows.length) continue;
    sections.push({
      key: sec, title: SECTION_TITLE[sec] || sec,
      headers: (SECTION_COLS[sec] || SECTION_COLS.REQUESTS).concat(["Suggested", "Today"]),
      rows: rows.map(r => ({
        cells: r.raw.concat([suggestedOf(r), factsOf(r)]),
        cls: sec === "EXAMS" ? EXAM_CLASS(r.what) : (r.ignored ? "ex-x" : "ex-a"),
        filled: !r.action && !!r.suggest.action,
        r,
      })),
    });
  }
  return sections;
}
function noticesText(res) {
  if (!res.notices || !res.notices.length) return "";
  const out = ["CHANGEOVERS & BALANCING", "========================", ""];
  res.notices.forEach((n, i) => {
    out.push((i + 1) + ") " + n[0]);
    for (const l of n.slice(1)) out.push("   " + l);
    out.push("");
  });
  return out.join("\n");
}
function toText(res) {
  const out = [];
  for (const s of shape(res)) {
    if (out.length) out.push("");
    out.push(s.title);
    out.push(s.headers.join("\t"));
    for (const row of s.rows) out.push(row.cells.join("\t"));
  }
  const n = noticesText(res);
  return out.join("\n") + (n ? "\n\n" + n : "");
}
const esc = v => String(v == null ? "" : v).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
function toHtml(res, inline) {
  const colour = { "ex-a": "#000000", "ex-b": "#00B050", "ex-c": "#FF0000", "ex-m": "#7030A0", "ex-t": "#0070C0", "ex-x": "#0070C0" };
  const style = c => inline ? ' style="color:' + colour[c] + ';font-family:Calibri,Arial,sans-serif;font-size:11pt"' : ' class="' + c + '"';
  const out = [];
  for (const s of shape(res)) {
    out.push('<table class="brtable"' + (inline ? ' style="border-collapse:collapse;font-family:Calibri,Arial,sans-serif;font-size:11pt"' : "") + ">");
    out.push('<caption' + (inline ? ' style="text-align:left;font-weight:700"' : "") + ">" + esc(s.title) + "</caption>");
    out.push("<thead><tr>" + s.headers.map(h => "<th" + (inline ? ' style="text-align:left;padding:2px 8px;border-bottom:1px solid #999"' : "") + ">" + esc(h) + "</th>").join("") + "</tr></thead><tbody>");
    for (const row of s.rows) {
      const tds = row.cells.map((c, i) => {
        const filled = i === 5 && row.filled;
        return "<td" + (inline ? ' style="padding:2px 8px;white-space:nowrap' + (filled ? ";font-weight:700" : "") + '"' : (filled ? ' class="filled"' : "")) + ">" + esc(c) + "</td>";
      });
      out.push("<tr" + style(row.cls) + ">" + tds.join("") + "</tr>");
    }
    out.push("</tbody></table>");
  }
  if (res.notices && res.notices.length) {
    const pre = inline ? ' style="font-family:Calibri,Arial,sans-serif;font-size:11pt;font-weight:700;white-space:pre-wrap"' : ' class="brnotices"';
    out.push("<pre" + pre + ">" + esc(noticesText(res)) + "</pre>");
  }
  return out.join("\n");
}
/* The nearest-first fixed-column text, for whoever wants the day's lines
   in the order they need doing rather than the order the workbook holds. */
function render(res) {
  const W = { unit: 7, sec: 10, needs: 9, due: 26, action: 22, sugg: 34 };
  const pad = (s, n) => String(s == null ? "" : s).padEnd(n).slice(0, n);
  const head = pad("UNIT", W.unit) + " " + pad("LIST", W.sec) + " " + pad("NEEDS", W.needs) + " " +
               pad("DUE", W.due) + " " + pad("PLAN SAYS", W.action) + " " + pad("SUGGESTED", W.sugg) + " TODAY";
  const lines = [head, "-".repeat(head.length + 40)];
  let tier = 0;
  for (const r of res.tiered) {
    if (r.tier !== tier) {
      tier = r.tier;
      if (lines.length > 2) lines.push("");
      lines.push(tier === 1 ? "== NEXT: today, tomorrow, ASAP and overdue ==" :
                 tier === 2 ? "== THIS WEEK, and the mileage triggers ==" :
                              "== LATER: where it ends tonight ==");
    }
    lines.push(pad(r.unit, W.unit) + " " + pad(r.section, W.sec) + " " + pad(r.places.join("/") || "—", W.needs) + " " +
               pad(dueOf(r), W.due) + " " + pad(r.action, W.action) + " " + pad(r.suggest.action, W.sugg) + " " + factsOf(r));
  }
  const n = noticesText(res);
  return lines.join("\n") + (n ? "\n\n" + n : "");
}

return { run, render, shape, toText, toHtml, noticesText, parsePlan, whenOf, suggest,
         finalWorking, requestName, terminalCalls, depotStands, swapBetween, fits,
         PLACES, placeOf, FLEET_MOVES, movesFrom };
})();
if (typeof module !== "undefined" && module.exports) module.exports = SHEETS_BERTH;
if (typeof globalThis !== "undefined") globalThis.SHEETS_BERTH = SHEETS_BERTH;
