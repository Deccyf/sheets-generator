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
/* Where there is nobody to do anything: no request is made at Folkestone
   East or Hastings. Where a train can be requested but not split down:
   Faversham, and those two. */
const NO_REQUEST_AT = new Set(["FKE", "HGS"]);
const NO_SPLIT_AT = new Set(["FKE", "HGS", "FAV"]);
/* The night turn's window: a unit whose allocation finishes between 09+00
   and 16+30 is on hand at a depot, and the departures it is offered are
   the ones between 09+00 and 16+30 first. Minutes from midnight. */
const PM_WINDOW = [540, 990];
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
/* ---------- the defects export ----------
   The End of Day, Restriction and Performance Defect lists come out of the
   maintenance system as one shape: Date Occurred, Days O/S, Asset No,
   Coach No, Catalogue No, Stock Description, Repair Location, Diagram End
   Location, Arrival Date, System Code, Fault Description, Facility
   Failure, Report, Priority, Target Due Date. Pasted as they come. The
   REPAIR LOCATION carries the words that change what a defect needs -
   "+ AMAT", "+ MSE", "+ CON RED", "xGTR", "Ramsgate Train Care Depot" -
   and the FAULT DESCRIPTION gives the notice its couple of words. */
const DEFECT_COLS = ["occurred", "days", "unit", "coach", "catalogue", "stock", "repairAt",
                     "endLoc", "arrival", "system", "fault", "facility", "report", "priority", "target"];
function parseDefects(text) {
  const rows = [], reviews = [];
  let cols = null, n = 0;
  for (const raw of String(text || "").split(/\r?\n/)) {
    const f = raw.split("\t").map(x => x.trim());
    if (!f.some(Boolean)) continue;
    n++;
    if (/^Date Occurred/i.test(f[0])) {
      // the columns by their headings, so a column added or dropped by the
      // export is survived
      cols = f.map(h => h.toLowerCase());
      continue;
    }
    const at = name => {
      if (cols) {
        const i = cols.findIndex(h => h.indexOf(name) >= 0);
        return i >= 0 ? (f[i] || "") : "";
      }
      return "";
    };
    let row;
    if (cols) {
      row = { unit: at("asset"), days: parseInt(at("days"), 10), repairAt: at("repair location"),
              endLoc: at("diagram end"), arrival: at("arrival"), system: at("system"),
              fault: at("fault"), report: at("report"), priority: at("priority"), target: at("target") };
    } else if (f.length >= 15 && UNIT_RE.test(f[2])) {
      row = {}; DEFECT_COLS.forEach((k, i) => { row[k] = f[i] || ""; });
      row.days = parseInt(row.days, 10);
    } else continue;
    if (!UNIT_RE.test(row.unit)) continue;
    row.line = n;
    const rl = String(row.repairAt || "").toUpperCase();
    row.amat = /\bAMAT\b/.test(rl); row.mse = /\bMSE\b/.test(rl); row.red = /\bRED\b/.test(rl);
    row.con = /\bCON\b/.test(rl); row.gtr = /GTR/.test(rl);
    row.repairDepot = /RAMSGATE/.test(rl) ? "RE" : /GILLINGHAM/.test(rl) ? "GI" : /SLADE/.test(rl) ? "SG" :
                      /GROVE/.test(rl) ? "GP" : /ASHFORD/.test(rl) ? "AFK" : /SELHURST/.test(rl) ? "VIC" : null;
    row.category = defectCategory(row.priority);
    row.summary = faultSummary(row.fault);
    rows.push(row);
  }
  return { rows, reviews };
}
/* A couple of words for the notice, off the fault description: the codes
   and prefixes the system puts in front are dropped, the sentence is cut
   at its first dash or stop, and the first five words are kept. Shown on
   the line so it can be corrected by hand where it reads badly. */
const FAULT_NOISE = /^(UMD\s*\d+|WR\d+|\d+\s*X|X|TCMS|CODE:?|\d+|MDC|GTR|ACM|SHUNTER|REPORTS|DRIVER|[-–:]+)$/i;
function faultSummary(desc) {
  /* a full stop ends a sentence only after a word of four letters or more:
     "Cab Air Con. high pressure" is one thought, "solenoid. Toilet" two */
  const parts = String(desc || "").replace(/\([^)]*\)/g, " ")
    .replace(/(\w{4,})\.\s+/g, "$1 | ").split(/\s[-–]\s|\s\|\s|[;,]\s|\.\s*$/);
  for (const part of parts) {
    const words = part.trim().split(/\s+/).filter(Boolean);
    while (words.length && FAULT_NOISE.test(words[0])) words.shift();
    while (words.length && /^(RED|NIL|STOCK|CET|REQUIRED)$/i.test(words[words.length - 1]) && words.length > 2) words.pop();
    if (words.length < 2 && parts.length > 1) continue;
    if (!words.length) continue;
    if (/^(REQUIRES|CAN BE DONE|NIL STOCK|RED)$/i.test(words.join(" "))) continue;
    return words.slice(0, 5).map(w => w.replace(/[.,;:]+$/, "")).join(" ").toUpperCase();
  }
  return String(desc || "").trim().split(/\s+/).slice(0, 4).join(" ").toUpperCase();
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
const workingKey = (code, hc, dep) => code + "@" + hc + "@" + dep;
/* Tomorrow's diagrams come with no Summary, so their fleet is read off the
   diagram code: RM3xx a 3-car, RM9xx a 375/9, any other RM a plain 375,
   GT a 377, SG a 376. */
function fleetFromDiag(diag) {
  if (/^RM3/.test(diag)) return "375/3";
  if (/^RM9/.test(diag)) return "375/9";
  if (/^RM/.test(diag)) return "375/6";
  if (/^GT/.test(diag)) return "377/5";
  if (/^SG/.test(diag)) return "376/0";
  return "";
}
/* How many units of this unit's kind make a 12-car: three 4-car 375s or
   377s, two 5-car 376s, four 3-car 375/3s. */
function maxUnits(unit) {
  const f = familyOfUnit(unit);
  return Math.floor(12 / (f === "375/3" ? 3 : f === "376" ? 5 : 4));
}
function allDays(genius, date) {
  const out = new Map();
  out.workings = new Map();
  const dets = genius.detail && genius.detail.get(date);
  if (!dets) return out;
  /* the Summary's rows per diagram, in time order: each is a working
     segment with the unit on it, and the unit on the diagram at its END is
     the last row's - the one a request would displace */
  const rowsOf = new Map(), fleetOf = new Map();
  for (const r of genius.summary || []) if (r.date === date) {
    rowsOf.set(r.diag, (rowsOf.get(r.diag) || []).concat([{ ...r, units: r.units || (r.unit ? [r.unit] : []) }]));
    if (r.fleet && !fleetOf.has(r.diag)) fleetOf.set(r.diag, r.fleet);
  }
  for (const rs of rowsOf.values()) rs.sort((a, b) => a.start - b.start);
  const unitsOf = new Map(), posOf = new Map();
  for (const [diag, rs] of rowsOf) {
    const z = rs[rs.length - 1];
    unitsOf.set(diag, z.units);
    posOf.set(diag, z.pos || 1);
  }
  for (const [diag, raw] of dets) {
    const stops = stopsOf(raw).map(s => ({ ...s, diag }));
    if (!stops.length) continue;
    const last = stops[stops.length - 1];
    const splitsAt = [];
    for (const r of raw) if (/^(ATTTT|ATTACH|DETACH|DETTT)$/.test(r.ev || "")) {
      const p = placeOf(r.code); if (splitsAt.indexOf(p) < 0) splitsAt.push(p);
    }
    out.set(diag, { diag, stops, units: [...new Set(unitsOf.get(diag) || [])], fleet: fleetOf.get(diag) || fleetFromDiag(diag), pos: posOf.get(diag) || 1,
                    rows: rowsOf.get(diag) || [],
                    endCode: last.code, endPlace: placeOf(last.code), endDepot: depotOf(placeOf(last.code)),
                    endTime: last.arr != null ? last.arr : last.dep, splitsAt,
                    final: finalWorking(stops), raw });
    /* every working each diagram leaves a place on, so that a working two
       diagrams run coupled - one 12-car train - is known to be one train */
    for (const s of stops) if (s.hcOut && s.dep != null) {
      const k = workingKey(s.code, s.hcOut, s.dep);
      if (!out.workings.has(k)) out.workings.set(k, []);
      if (out.workings.get(k).indexOf(diag) < 0) out.workings.get(k).push(diag);
    }
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
/* The Summary has a row per WORKING SEGMENT of a diagram, each with the
   unit on it: RM912 is 375609 from Ramsgate to Grove Park in the morning
   and 375827 out of Grove Park to Ramsgate in the evening, the unit
   changing at the depot. So a unit's day is its own rows, and the stops
   are the diagram's cut to each row's window - not the whole diagram. */
function stopsWithin(stops, row) {
  const inWin = s => (s.dep != null && s.dep >= row.start && s.dep <= row.end) ||
                     (s.arr != null && s.arr >= row.start && s.arr <= row.end);
  let i = stops.findIndex(s => s.code === row.from && s.dep === row.start);
  let j = -1;
  for (let k = stops.length - 1; k >= 0; k--) if (stops[k].code === row.to && stops[k].arr === row.end) { j = k; break; }
  let out;
  if (i >= 0 && j >= i) out = stops.slice(i, j + 1);
  else out = stops.filter(inWin);
  if (!out.length) return [];
  // the segment starts at its first stop and ends at its last
  out = out.map(s => ({ ...s }));
  if (out[0].dep != null && out[0].dep >= row.start) out[0].arr = null;
  const z = out[out.length - 1];
  if (z.arr != null && z.arr <= row.end) { z.dep = null; z.hcOut = null; }
  return out;
}
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
  for (const row of rows) {
    const raw = dets && dets.get(row.diag);
    if (!raw) continue;
    const win = raw.filter(r => (r.dep != null && r.dep >= row.start && r.dep <= row.end) || (r.arr != null && r.arr >= row.start && r.arr <= row.end));
    rawAll = rawAll.concat(win.length ? win : raw);
    const seg = stopsWithin(stopsOf(raw), row).map(s => ({ ...s, diag: row.diag }));
    /* where one segment ends and the next begins at the same place, that
       is one stand: in on the first working, out on the second */
    const last = stops[stops.length - 1];
    const sameDepot = (a, b) => a === b || (!!DEPOT_CODES.get(a) && DEPOT_CODES.get(a) === DEPOT_CODES.get(b));
    if (last && seg.length && sameDepot(seg[0].code, last.code) && last.dep == null && seg[0].arr == null) {
      // in on one road of the depot, out on another: still one stand
      last.dep = seg[0].dep; last.hcOut = seg[0].hcOut; last.diagOut = seg[0].diag; last.codeOut = seg[0].code;
      stops = stops.concat(seg.slice(1));
    } else stops = stops.concat(seg);
    for (const r of (win.length ? win : raw)) if (/^(ATTTT|ATTACH|DETACH|DETTT)$/.test(r.ev || "")) {
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
/* The one variation the depot allows, and only once the same fleets and
   sub-fleets are exhausted: a 375/9 on a plain 375 diagram, or a plain 375
   on a 375/9 one. Never a 3-car, a 376 or a 377. */
const loosely = f => (f === "375" || f === "375/9") ? "375*" : f;
const fitsLoosely = (unit, fleet) => loosely(familyOfUnit(unit)) === loosely(familyOfFleet(fleet));
function splitsAfter(day, idx) {
  // a DETACH at or after this stop, by the raw rows' clock: the train
  // splits and the request has to name the portion. An attach after it is
  // nothing to a swap - the unit is on the diagram and goes where it goes.
  // A day that ends at this stop has nothing after it.
  const t = day.stops[idx].dep;
  if (t == null) return false;
  return day.raw.some(r => /^(DETACH|DETTT)$/.test(r.ev || "") &&
    r.dep != null && r.dep >= t);
}
function swapBetween(mine, theirs) {
  let best = null;
  const consider = (x, y, kind, at) => {
    /* each unit on hand before the working it takes leaves: no delay. A
       unit whose day ends at the depot has no working to leave on (dep
       null), and a diagram whose day starts there has no arrival: either
       is fine, it is the depot's AM/PM berth. */
    if (x.arr != null && y.dep != null && x.arr + SWAP_MARGIN > y.dep) return;
    if (y.arr != null && x.dep != null && y.arr + SWAP_MARGIN > x.dep) return;
    if (x.arr == null || y.dep == null) return;
    /* a diagram that detaches after the swap point is still a way home -
       the request names the portion - it just ranks after a clean one */
    const cand = { kind, at, mine: x, theirs: y, gap: Math.abs(x.arr - (y.arr != null ? y.arr : x.arr)),
                   splitsMine: splitsAfter(mine, x.idx), splitsTheirs: splitsAfter(theirs, y.idx) };
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
  /* the depot's AM/PM berth: a unit that ends its day at the depot in the
     morning is on hand for any working out of it later, and a diagram's
     segment that starts at the depot is one such working */
  const sa = depotStands(mine.stops).concat(depotEnds(mine.stops));
  const sb = depotStands(theirs.stops).concat(depotStarts(theirs.stops));
  for (const x of sa) for (const y of sb) {
    if (x.depot !== y.depot) continue;                   // any road of the same depot
    consider(x, y, "depot", x.code);
  }
  return best;
}
function depotEnds(stops) {
  const n = stops.length, s = stops[n - 1];
  if (n < 2 || !s || !DEPOT_CODES.get(s.code) || s.arr == null || s.dep != null) return [];
  let j = n - 2;
  while (j > 0 && stops[j - 1].hcOut === s.hcIn && stops[j - 1].dep != null) j--;
  return [{ idx: n - 1, code: s.code, depot: DEPOT_CODES.get(s.code), arr: s.arr, dep: null, hcIn: s.hcIn, hcOut: null,
            inFrom: stops[j].code, inDep: stops[j].dep, outTo: null }];
}
function depotStarts(stops) {
  const s = stops[0];
  if (stops.length < 2 || !s || !DEPOT_CODES.get(s.code) || s.dep == null || s.arr != null) return [];
  let k = 0;
  while (k < stops.length - 1 && stops[k].hcOut === s.hcOut && stops[k].dep != null) k++;
  return [{ idx: 0, code: s.code, depot: DEPOT_CODES.get(s.code), arr: null, dep: s.dep, hcIn: null, hcOut: s.hcOut,
            inFrom: null, inDep: null, outTo: stops[k].code }];
}
/* Whether a diagram gets to a depot: ends there, or stands there during
   the day. */
function reaches(d, depot) {
  if (!d) return false;
  if (d.endDepot === depot) return true;
  return d.stops.some(s => DEPOT_CODES.has(s.code) && depotOf(placeOf(s.code)) === depot && s.arr != null);
}
/* Which portion of a coupled train a diagram is, off the Summary's POS:
   the lowest position leads - FP, the front portion - the highest is the
   rear, RP, anything between MP. Named only where the train splits before
   the depot and this diagram's portion is the one that goes there, so the
   request says which portion to berth: "AFK BERTH RP 05 27". */
function portionOf(d, sharing, days, depot) {
  if (sharing.length < 2) return "";
  const others = sharing.filter(g => g !== d.diag).map(g => days.get(g)).filter(Boolean);
  if (!others.length || others.every(o => reaches(o, depot))) return "";
  const poss = sharing.map(g => (days.get(g) || {}).pos || 1);
  if (d.pos <= Math.min(...poss)) return "FP";
  if (d.pos >= Math.max(...poss)) return "RP";
  return "MP";
}
/* The units coupled with mine on the working I arrive at the swap point
   on - or, with no swap, on my last working - so a request can take the
   formation with it rather than split it. */
/* The unit on a diagram at a given time: the Summary row whose segment
   covers it, else the last row's. */
function unitAt(d, t) {
  if (!d || !d.rows || !d.rows.length) return d ? d.units : [];
  const row = d.rows.find(r => r.start <= t && t <= r.end) || d.rows[d.rows.length - 1];
  return row.units || [];
}
function matesOn(mine, swap, days) {
  let key = null, at = null;
  if (swap) { key = workingKey(swap.mine.inFrom, swap.mine.hcIn, swap.mine.inDep); at = swap.mine.inDep; }
  else { const fin = finalWorking(mine.stops); if (fin && fin.hc) { key = workingKey(fin.from, fin.hc, fin.dep); at = fin.dep; } }
  const sharing = key && days.workings ? (days.workings.get(key) || []) : [];
  const out = [];
  for (const g of sharing) if (mine.diags.indexOf(g) < 0 && days.get(g))
    for (const u of unitAt(days.get(g), at)) if (u !== mine.unit && out.indexOf(u) < 0) out.push(u);
  return out;
}
/* A unit that ends tonight where it is not wanted, at a place with a
   berth: tomorrow's working out of that place that gets to the depot,
   taken as today's Detail has it - tomorrow's diagrams are on no report
   read here, and the weekday ones repeat. Named the way that place names
   workings, with the portion where the train splits before the depot:
   "AFK BERTH RP 05 27". */
function morningFrom(r, days, mates, wanted, taken, proxy) {
  const from = r.ends && r.ends.place, codes = PLACES[from] || [];
  if (!codes.length || !days || !days.size) return null;
  if (NO_REQUEST_AT.has(depotOf(from) || from)) return null;   // nobody there to ask
  // the train it arrived in is split unless every unit of it is wanted at the same depot
  const targetsAll = r.places.map(depotOf).filter(Boolean);
  const splits = (mates || []).length > 0 &&
    !(mates || []).every(u => targetsAll.some(t => ((wanted && wanted.get(u)) || []).indexOf(t) >= 0));
  if (splits && NO_SPLIT_AT.has(depotOf(from) || from)) return null;
  const targets = r.places.map(depotOf).filter(Boolean);
  const cands = [];
  for (const d of days.values()) {
    const s0 = d.stops[0];
    if (!s0 || codes.indexOf(s0.code) < 0 || s0.dep == null || !s0.hcOut) continue;
    if (r.diags.indexOf(d.diag) >= 0) continue;
    const depot = targets.find(t => reaches(d, t));
    if (!depot) continue;
    if (!fits(r.unit, d.fleet) && !fitsLoosely(r.unit, d.fleet)) continue;
    const key = workingKey(s0.code, s0.hcOut, s0.dep);
    const sharing = (days.workings && days.workings.get(key)) || [d.diag];
    // this diagram's unit displaced once, and no more on a train than it has units
    if (taken && taken.get("D:" + d.diag + "@" + key)) continue;
    if (taken && (taken.get("W:" + key) || 0) >= Math.min(maxUnits(r.unit), sharing.length)) continue;
    if (r.category === "MO" && sharing.length < 2) continue;
    const ends = d.endDepot === depot;
    const at = ends ? null : d.stops.slice(1).find(s => DEPOT_CODES.has(s.code) && depotOf(placeOf(s.code)) === depot && s.arr != null);
    cands.push({ day: d, depot, ends, at, dep: s0.dep, hc: s0.hcOut, sharing, key,
                 portion: portionOf(d, sharing, days, depot), variation: !fits(r.unit, d.fleet),
                 name: HEADCODE_DEPOTS.has(depotOf(from)) ? s0.hcOut : hhmm(s0.dep, /^5/.test(s0.hcOut)) });
  }
  // the same fleet first, then the one that ends there, then the earliest out
  cands.sort((p, q) => ((p.variation ? 1 : 0) - (q.variation ? 1 : 0)) || ((q.ends ? 1 : 0) - (p.ends ? 1 : 0)) || (p.dep - q.dep));
  const c = cands[0];
  if (!c) return null;
  const where = c.ends ? "ends " + c.day.endPlace + " " + hhmm(c.day.endTime, true) : "stands " + placeOf(c.at.code) + " " + hhmm(c.at.arr, /^5/.test(c.at.hcIn || ""));
  return {
    taken: { diag: c.day.diag, work: c.key },
    action: from + " BERTH " + (c.portion ? c.portion + " " : "") + c.name,
    notes: ["tomorrow's " + c.hc + " " + hhmm(c.dep, /^5/.test(c.hc)) + " from " + from + (c.portion ? ", " + c.portion + " (" + c.sharing.join("+") + ")" : "") +
            " — " + (proxy ? "today's " : "tomorrow's ") + c.day.diag + " " + where + (proxy ? "; check tomorrow's diagram runs the same" : "")]
      .concat(c.variation ? ["VARIATION — " + (c.day.fleet || "?") + " diagram, same fleets exhausted"] : [])
      .concat(cands.length > 1 ? ["or " + cands.slice(1, 3).map(k => k.day.diag + " " + (k.portion ? k.portion + " " : "") + k.name + (k.variation ? " (variation)" : "")).join(", ")] : []),
  };
}
/* The workings that end where the line wants its unit, that it could be
   swapped onto. How many units a working can take requests for is how many
   sections it runs as on the sheets - a 12-car has three units on the
   Summary and can carry three requests, an 8-car two - less any unit on it
   the plan wants at that depot, which is not to be taken off it. Each
   request displaces one unit, so the formation is kept both ways. */
function candidatesFor(r, mine, days, wanted, taken, keep, tomDays) {
  const targets = r.places.map(depotOf).filter(Boolean);
  const out = [];
  const myFleet = mine.rows[0] && mine.rows[0].fleet;
  /* Today's diagrams are where a swap is made; tomorrow's, where they were
     dropped, are where tomorrow's departures come from - otherwise today's
     stand in for them and the line says to check. */
  const proxy = !tomDays || tomDays === days;
  const pools = proxy ? [[days, "both"]] : [[days, "swap"], [tomDays, "morning"]];
  for (const [pool, mode] of pools) for (const d of pool.values()) {
    if (!d.endDepot || targets.indexOf(d.endDepot) < 0) continue;
    // its own diagram, if it is still on it at the end - a diagram it was
    // on in the morning, that another unit takes home, is a way home
    if (d.units.indexOf(r.unit) >= 0) continue;
    if (!d.units.length && mode !== "morning") continue;
    /* One unit per diagram: one request displaces it, and a unit the plan
       wants at that same depot is not to be taken off it. */
    if (d.units.some(u => (wanted.get(u) || []).indexOf(d.endDepot) >= 0)) continue;
    // the same fleet both ways - or, once the same fleets are exhausted,
    // the 375/9 variation - and the displaced unit has to fit my diagram
    const fitsBoth = fitOn => fitOn(r.unit, d.fleet) && (!myFleet || d.units.every(u => fitOn(u, myFleet)));
    const strict = fitsBoth(fits);
    if (!strict && !fitsBoth(fitsLoosely)) continue;
    const displaced = d.units.join("/");        // empty for tomorrow's, not yet allocated
    const swap = mode === "morning" ? null : swapBetween(mine, d);
    /* The working the unit would take is one train, whichever diagrams run
       it coupled - a 12-car is three diagrams on one working - and it
       carries a request per diagram, never more than a 12-car of this
       unit's kind: three 375s, two 376s. */
    const w = swap ? { code: swap.theirs.code, hc: swap.theirs.hcOut, dep: swap.theirs.dep }
                   : { code: d.final.from, hc: d.final.hc, dep: d.final.dep };
    const wkey = workingKey(w.code, w.hc, w.dep);
    const sharing = (pool.workings && pool.workings.get(wkey)) || [d.diag];
    const cap = Math.min(maxUnits(r.unit), sharing.length);
    // this diagram's unit on this working displaced once, not twice
    if (taken && taken.get("D:" + d.diag + "@" + wkey)) continue;
    const usedW = taken ? (taken.get("W:" + wkey) || 0) : 0;
    if (usedW >= cap) continue;
    // a restriction is a formation: multiple only needs a train of two
    // diagrams or more. No multiple is no multiple on ONE END, which is
    // a check on which end couples, not a bar on coupling - said below.
    if (r.category === "MO" && sharing.length < 2) continue;
    /* the portion, where the train splits before the depot and only this
       diagram's goes there: "RP 5F87" */
    const portion = portionOf(d, sharing, pool, d.endDepot);
    /* the order: the unit's own fleet first, always - with a swap, then for
       a depot swap, then a diagram that splits with no swap point - and
       only once those are exhausted the variation, in the same order. A
       unit whose formation-mate has already been given this working goes
       with it, so a 12-car that arrives as one train is not split three
       ways for three requests. */
    const mates = matesOn(mine, swap, days);
    /* together: a mate is already on this working, or every mate is
       wanted at this same depot now and the train has room for them all,
       so they will follow */
    const together = !!(taken && (taken.get("U:" + wkey) || []).some(u => mates.indexOf(u) >= 0)) ||
      (mates.length > 0 && cap >= mates.length + 1 && mates.every(u => (wanted.get(u) || []).indexOf(d.endDepot) >= 0));
    /* No swap, but the working starts tomorrow where my unit ends
       tonight: the request goes to that place and names the working out
       of it, with the portion - "AFK BERTH RP 05 27" - taken as today's
       Detail has it, since tomorrow's diagrams are on no report read
       here. That is a concrete request, so it comes before a depot swap
       with no place to make it. */
    const s0 = d.stops[0];
    const morning = !swap && r.ends && (PLACES[r.ends.place] || []).indexOf(s0.code) >= 0 && s0.dep != null && !!s0.hcOut;
    /* a request is made where the unit is: a swap at a place both are, or
       a departure from where it ends. A working with no place to make the
       swap is no request, however well it ends. */
    if (!swap && !morning) continue;
    if (mode === "swap" && !swap) continue;
    if (mode === "morning" && !morning) continue;
    const cand = { day: d, swap, name: requestName(d.endDepot, d.final), variation: !strict, rank: 0, together, mates, portion,
                   displaced, work: wkey, workName: w.hc || hhmm(w.dep, true), sharing, slot: usedW + 1, slots: cap };
    if (morning) {
      const k0 = workingKey(s0.code, s0.hcOut, s0.dep);
      if (taken && taken.get("D:" + d.diag + "@" + k0)) continue;
      cand.morning = { from: r.ends.place, hc: s0.hcOut, dep: s0.dep, sharing: (pool.workings && pool.workings.get(k0)) || [d.diag] };
      cand.morning.portion = portionOf(d, cand.morning.sharing, pool, d.endDepot);
      cand.morning.name = HEADCODE_DEPOTS.has(depotOf(r.ends.place)) ? s0.hcOut : hhmm(s0.dep, /^5/.test(s0.hcOut));
      // the unit displaced is the one on the diagram's FIRST segment
      cand.displaced = (d.rows[0] && d.rows[0].units.length ? d.rows[0].units : d.units).join("/");
      cand.work = k0; cand.workName = s0.hcOut; cand.sharing = cand.morning.sharing; cand.portion = cand.morning.portion;
      cand.slots = Math.min(maxUnits(r.unit), cand.sharing.length); cand.slot = (taken ? (taken.get("W:" + k0) || 0) : 0) + 1;
      if (cand.slot > cand.slots) continue;
    }
    /* Splitting the train it arrived in. Never where there is nobody to
       do it - Folkestone East, Hastings - nor at Faversham, where a train
       can be requested but not split; and with "keep trains together" on,
       only where nothing else gets it home. */
    const splitsTrain = mates.length > 0 && !together;
    const where = swap ? (swap.kind === "depot" ? swap.mine.depot : placeOf(swap.at)) : morning ? r.ends.place : null;
    if (swap && swap.kind === "depot" && NO_REQUEST_AT.has(swap.mine.depot)) continue;
    if (morning && NO_REQUEST_AT.has(depotOf(r.ends.place) || r.ends.place)) continue;
    if (splitsTrain && where && NO_SPLIT_AT.has(depotOf(where) || where)) continue;
    cand.splitsTrain = splitsTrain; cand.where = where; cand.proxy = proxy;
    cand.rank = (strict ? 0 : 10) + (swap ? (swap.splitsTheirs ? 0.25 : 0) : morning ? 0.5 : 1) +
                (!swap && !morning && d.splitsAt.length ? 1 : 0) - (together ? 0.5 : 0) +
                (splitsTrain && keep ? 5 : 0);
    out.push(cand);
  }
  out.sort((p, q) => (p.rank - q.rank) || (p.day.endTime - q.day.endTime));
  return out;
}
/* Which line goes first when two want the same working: the nearer due
   date, then a RED defect, then one with a concession (CON), then the plan's
   own order. A concession does not jump a line that is due sooner. */
function priorityOf(r) {
  return [r.tier, r.ahead === null ? 99 : r.ahead, r.red ? 0 : 1, r.con ? 0 : 1, r.line];
}
function byPriority(a, b) {
  const p = priorityOf(a), q = priorityOf(b);
  for (let i = 0; i < p.length; i++) if (p[i] !== q[i]) return p[i] - q[i];
  return 0;
}
/* The notice, in the depot's own form:
     375609 CONTAINING MO RESTRICTION - CHX PLEASE NOTE
     2W30 10 28 DVP - CHX T/F 1H34 12 45 CHX - HGS
     1H76 10 50 HGS - CHX T/F 2R34 12 34 CHX - RAM */
const leg = (hc, dep, from, to) => (hc || "????") + " " + hhmm(dep, /^5/.test(hc || "")) + " " + stationOf(from) + " - " + stationOf(to);
/* What the notice says the unit is: a defect is CONTAINING its kind and
   a couple of words for the fault; anything else is REQD at the depot by
   end of day for the work - "REQD RE EOD FOR A EXAM". */
function reasonOf(r) {
  if (r.isDefect) {
    const kind = r.category === "MO" || r.category === "NM" ? r.category + " RESTRICTION"
               : r.category === "EOD" ? "EOD DEFECT" : "PERFORMANCE DEFECT";
    return "CONTAINING " + kind + (r.summary ? " - " + r.summary : "");
  }
  const depot = (r.places[0] && depotOf(r.places[0])) || r.places[0] || "DEPOT";
  const work = r.section === "EXAMS" ? (r.what || "").toUpperCase() + " EXAM" : (r.what || r.section).toUpperCase();
  return "REQD " + depot + " EOD FOR " + work;
}
function noticeOf(r, c) {
  const sw = c.swap, x = sw.mine, y = sw.theirs;
  const at = sw.kind === "depot" ? sw.mine.depot : stationOf(sw.at);
  const lines = [r.unit + " " + reasonOf(r) + " - " + at + " PLEASE NOTE"];
  lines.push(leg(x.hcIn, x.inDep, x.inFrom, x.code) + " T/F " + leg(y.hcOut, y.dep, y.code, y.outTo));
  lines.push(leg(y.hcIn, y.inDep, y.inFrom, y.code) + " T/F " + leg(x.hcOut, x.dep, x.code, x.outTo) +
             (sw.splitsMine ? "  (" + (c.displaced || "the other unit") + " takes a working that splits)" : ""));
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
  // this coming weekend: Monday is three days off a Friday, no further
  const ahead = daysAhead(r.when, r.today);
  if (ahead === null || ahead < 0 || ahead > 3) return false;
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
  if (r.mse && ctx && ctx.mse && ctx.mse.has(r.unit)) { s.action = "MSE ATTENDING — NO REQUEST"; return s; }
  if (r.mse) s.notes.push("MSE — no request if they are attending");
  if (!r.inTraffic) { s.action = "NOT IN TRAFFIC"; return s; }
  /* a restriction is a formation, and today's is checked: multiple only
     on a working of one unit, or no multiple on a working of two, is said */
  const legName = l => (l.hcOut || "?") + " " + hhmm(l.dep, /^5/.test(l.hcOut || ""));
  if (r.category === "MO" && r.alone && r.alone.length)
    s.notes.push("MO — multiple only, but runs as one unit on " + legName(r.alone[0]) + " today: check");
  if (r.category === "NM" && r.coupled && r.coupled.length)
    s.notes.push("NM — no multiple on one end: check which end couples on " + legName(r.coupled[0]) + " today");
  const endsAt = depotOf(r.ends.place);
  /* near: today, tomorrow, ASAP, overdue, or this coming weekend and
     Monday - holds and requests. Soon: the rest of the week - requests,
     after the near lines have had theirs, but no hold, since the unit
     works again before it is due. */
  const near = r.tier === 1, soon = r.tier <= 2;
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
      /* it ends where it is wanted TONIGHT, but works again before it is
         due, so that is where it is and not yet a hold */
      s.action = "ENDS " + r.ends.place;
      if (soon) s.notes.push("due " + dueOf(r) + " — where it ends tonight, not yet a hold");
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
  if (soon && targets.length && ctx && ctx.mine) {
    const cands = candidatesFor(r, ctx.mine, ctx.days, ctx.wanted, ctx.taken, ctx.keep, ctx.tomDays);
    const c = cands[0];
    if (c) {
      const depot = c.day.endDepot, sw = c.swap;
      if (!near) s.notes.push("due " + dueOf(r));
      s.taken = { diag: c.day.diag, work: c.work };
      s.matesOn = c.mates;
      if (c.variation) s.notes.push("VARIATION — " + (c.day.fleet || "?") + " diagram, same fleets exhausted");
      /* every departure the depot could put it on, the depot to choose -
         never the arrival, the depot has that on its own allocation */
      const listed = [c];
      if (sw && sw.kind === "depot") {
        /* on hand at the depot from the AM berth: the PM workings out of
           it that end where it is wanted - "GP BERTH 5F87/5F85/5F91" -
           named the way that depot names workings */
        const at = sw.mine.depot;
        const nm = w => HEADCODE_DEPOTS.has(at) ? (w.hc || hhmm(w.dep, /^5/.test(w.hc || ""))) : hhmm(w.dep, /^5/.test(w.hc || ""));
        const outName = k => (k.portion ? k.portion + " " : "") + nm({ hc: k.swap.theirs.hcOut, dep: k.swap.theirs.dep });
        const outs = [outName(c)];
        for (const k of cands.slice(1)) {
          if (!k.swap || k.swap.kind !== "depot" || k.swap.mine.depot !== at || k.variation !== c.variation) continue;
          const name = outName(k);
          if (outs.indexOf(name) >= 0) continue;
          outs.push(name); listed.push(k);
        }
        /* the night turn's window: the departures between 09+00 and 16+30
           are the ones the depot works its AM/PM berth by, so they lead */
        const inWin = k => k.swap.theirs.dep >= PM_WINDOW[0] && k.swap.theirs.dep <= PM_WINDOW[1];
        const order = listed.map((k, n) => ({ k, name: outs[n] }))
          .sort((a, b) => ((inWin(b.k) ? 1 : 0) - (inWin(a.k) ? 1 : 0)) || (a.k.swap.theirs.dep - b.k.swap.theirs.dep));
        listed.splice(0, listed.length, ...order.map(o => o.k)); outs.splice(0, outs.length, ...order.map(o => o.name));
        s.action = at + " BERTH " + outs.join("/");
        s.notes.push("in on " + (sw.mine.hcIn || "?") + " " + hhmm(sw.mine.arr, /^5/.test(sw.mine.hcIn || "")) +
                     (sw.mine.dep != null ? ", booked out " + hhmm(sw.mine.dep, /^5/.test(sw.mine.hcOut || "")) + " on " + (sw.mine.hcOut || "?") : ", stays"));
        listed.forEach((k, n) => s.notes.push("out on " + outs[n] + ": " + k.day.diag + ", ends " + k.day.endPlace + " " + hhmm(k.day.endTime, true) +
                     ", " + k.displaced + " off it" + (sw.mine.hcOut ? " (takes " + sw.mine.hcOut + ")" : " (stays at " + placeOf(sw.at) + ")")));
        if (outs.length > 1) s.notes.push("the depot to choose");
      } else if (c.morning) {
        /* tomorrow's departures out of where it ends tonight, every one that
           fits, in the order they leave */
        const outs = [];
        listed.length = 0;
        const ms = cands.filter(k => k.morning && k.morning.from === c.morning.from && k.variation === c.variation)
          .sort((a, b) => a.morning.dep - b.morning.dep);
        for (const k of ms) {
          const name = (k.morning.portion ? k.morning.portion + " " : "") + k.morning.name;
          if (outs.indexOf(name) >= 0) continue;
          outs.push(name); listed.push(k);
        }
        s.action = c.morning.from + " BERTH " + outs.join("/");
        for (const k of listed) {
          const m = k.morning;
          s.notes.push("tomorrow's " + m.hc + " " + hhmm(m.dep, /^5/.test(m.hc)) + " from " + m.from +
                       (m.portion ? ", " + m.portion + " (" + m.sharing.join("+") + ")" : "") +
                       " — " + (k.proxy ? "today's " : "tomorrow's ") + k.day.diag + " ends " + k.day.endPlace + " " + hhmm(k.day.endTime, true) +
                       (k.displaced ? ", " + k.displaced + " off it" : ", not yet allocated"));
        }
        const tail = [];
        if (c.proxy) tail.push("check tomorrow's diagram" + (listed.length > 1 ? "s run" : " runs") + " the same");
        if (outs.length > 1) tail.push("the depot to choose");
        if (tail.length) s.notes.push(tail.join("; "));
      } else {
        s.action = depot + " BERTH " + (c.portion ? c.portion + " " : "") + c.name + (sw ? " — T/F AT " + stationOf(sw.at) : " (no shared terminal — depot swap)");
        s.notes.push("on " + c.day.diag + ", ends " + c.day.endPlace + " " + hhmm(c.day.endTime, true) +
                     ", " + c.displaced + " off it");
      }
      // a 12-car carries three requests, an 8-car two: which this one is
      if (c.slots > 1) s.notes.push(c.workName + " runs as " + c.slots + " units (" + c.sharing.join("+") + ") — request " + c.slot + " of " + c.slots);
      // no multiple on one end: the working couples, so which end is the check
      if (r.category === "NM" && c.sharing.length > 1) s.notes.push("NM — check which end couples on " + c.workName);
      /* the notice is for a changeover at a terminal. At a depot there is
         none to make: the unit goes there empty in the AM and sits to the
         PM, so it ends there in the AM and the request is all that is
         needed. */
      if (sw && sw.kind !== "depot") s.notice = noticeOf(r, c);
      if (c.day.splitsAt.length) s.notes.push(c.day.diag + " splits at " + c.day.splitsAt.join("/"));
      const rest = cands.filter(k => listed.indexOf(k) < 0).slice(0, 2);
      if (rest.length) s.notes.push("or " + rest.map(k => k.day.diag + " " + k.name + (k.variation ? " (variation)" : "")).join(", "));
      return s;
    }
  }
  /* Nothing today reaches the depot. Where it ends is a place with a
     berth: tomorrow's working out of there that does - "AFK BERTH RP
     05 27", the portion named where the train splits before the depot. */
  const mf = soon && targets.length && ctx && ctx.mine
    ? morningFrom(r, ctx.tomDays || ctx.days, matesOn(ctx.mine, null, ctx.days), ctx.wanted, ctx.taken, !ctx.tomDays || ctx.tomDays === ctx.days) : null;
  if (mf) { s.action = mf.action; if (!near) s.notes.push("due " + dueOf(r)); s.notes = s.notes.concat(mf.notes); s.taken = mf.taken; return s; }
  s.action = "ENDS " + r.ends.place;
  if (soon && targets.length) s.notes.push("no call at " + r.places.join("/") + " today" +
    (ctx && ctx.days && ctx.days.size ? ", and no working it could be put on gets to " + r.places.join("/") : ""));
  if (r.today && endsAt && r.tier <= 2) {
    const dow = (r.today.getUTCDay() + 1) % 7;    // tomorrow, when it is where it ends
    for (const m of movesFrom(endsAt, targets, dow))
      s.notes.push("fleet move " + m.hc + " " + m.time + " " + m.from + " - " + m.to + " (" + m.days + ")");
  }
  if (at && !near) s.notes.push("calls " + at.place + " " + hhmm(at.arr, /^5/.test(at.hcIn || "")) + (at.hc ? " off " + at.hc.slice(0, 4) : ""));
  return s;
}

/* ---------- one plan, one day ---------- */
/* The export's rows become the plan's DEFECTS lines. Where the plan also
   has a Defects section, the export's row for the same unit and priority
   wins - it knows the fault and the repair location - and the planner's
   own Action for it is kept. */
function mergeDefects(plan, defects) {
  if (!defects || !defects.rows.length) return plan;
  const planned = plan.rows.filter(r => r.section === "DEFECTS");
  const keyOf = r => r.unit + "|" + defectCategory(r.what || r.priority) + "|" + (r.when || r.target || "").slice(0, 10);
  const kept = new Map(planned.map(r => [keyOf(r), r]));
  const rows = plan.rows.filter(r => r.section !== "DEFECTS");
  const order = plan.order.slice();
  if (order.indexOf("DEFECTS") < 0) order.push("DEFECTS");
  for (const d of defects.rows) {
    const twin = kept.get(d.unit + "|" + d.category + "|" + (d.target || "").slice(0, 10));
    const row = {
      section: "DEFECTS", unit: d.unit, line: 100000 + d.line,
      days: d.days, what: d.priority, when: d.target, isDefect: true, category: d.category,
      where: d.repairDepot || defectHome(d.unit),
      action: twin ? twin.action : "",
      raw: [d.unit, String(isNaN(d.days) ? "" : d.days), d.priority, d.target, twin ? twin.action : ""],
      fault: d.fault, summary: d.summary, report: d.report, repairAt: d.repairAt,
      amat: d.amat, mse: d.mse, red: d.red, con: d.con, gtr: d.gtr,
      endLoc: d.endLoc, arrival: d.arrival,
    };
    row.places = row.where.split(/[\/,]/).map(x => x.trim().toUpperCase()).filter(Boolean);
    if (twin) kept.delete(keyOf(twin));
    rows.push(row);
  }
  // plan defect lines the export did not carry stay as they were
  for (const r of kept.values()) rows.push(r);
  return { rows, reviews: plan.reviews.concat(defects.reviews), order };
}
function run(planText, genius, opts) {
  opts = opts || {};
  const plan = mergeDefects(parsePlan(planText), opts.defects ? parseDefects(opts.defects) : null);
  const reviews = plan.reviews.slice();
  const date = (genius && genius.summary && genius.summary.length)
    ? (opts.date || genius.summary[0].date) : null;
  const today = date ? parseShort(date) : null;
  if (!date) reviews.push("No weekday reports are loaded, so nothing can be said about where any unit is — build the weekday books first.");
  const ignore = new Set(String(opts.ignore || "").match(/\d{6}/g) || []);
  // the units the mobile engineers are going out to: no request for those
  const mse = new Set(String(opts.mse || "").match(/\d{6}/g) || []);
  const filled = (genius && genius.summary || []).filter(r => r.date === date && r.units && r.units.length).length;
  if (date && !filled)
    reviews.push("The Diagram Summary has no units on it — it was printed before the day was allocated. " +
                 "Drop the print that was run after allocation (the evening one) and this can say where each unit is.");
  const days = date ? allDays(genius, date) : new Map();
  /* Tomorrow's Diagram Detail, where it was dropped: then tomorrow's
     departures are its own, not today's taken as a proxy. And without
     today's Detail the Summary alone says where every unit ends tonight -
     a swap today cannot be seen, a departure tomorrow can. */
  /* the next day the Detail is for: tomorrow, or the Monday dropped on a
     Friday, whichever is the first after today */
  let tomDate = null, tomAhead = 0;
  if (today && genius && genius.detail)
    for (const k of genius.detail.keys()) {
      const d = parseShort(k), n = d ? Math.round((d - today) / 86400000) : 0;
      if (n >= 1 && (!tomDate || n < tomAhead)) { tomDate = k; tomAhead = n; }
    }
  const tomDays = tomDate ? allDays(genius, tomDate) : days;
  const haveToday = !!(date && genius && genius.detail && genius.detail.get(date));
  const on = tomAhead === 1 ? "tomorrow's" : tomAhead + " days on";
  if (date && !haveToday)
    reviews.push("No Diagram Detail for " + date + ": where each unit ends tonight is read off the Summary alone, and no changeover " +
                 "or depot swap today can be seen. " + (tomDate ? "The departures are off the " + tomDate + " Detail, " + on + "." : "Drop the Detail for " + date + ", or for the day after, for more."));
  else if (tomDate)
    reviews.push("The departures are off the " + tomDate + " Diagram Detail, " + on + ", not today's taken as a proxy.");
  /* When each line is due, first, because what a swap may not do depends
     on it. */
  const dated = plan.rows.map(row => {
    const when = whenOf(row.when, today);
    /* An end-of-day defect with no target date is due TODAY - back at a
       maintenance depot by the end of the day is what EOD means. */
    if (row.category === "EOD" && !when.date && !when.asap && when.miles === null && today) {
      when.date = today; when.half = "EOD"; when.text = when.text || "EOD";
    }
    const ahead = daysAhead(when, today);
    /* a line due over the weekend or on Monday, seen from Friday or the
       weekend, is held for Monday - so it is near, though Monday is three
       days off a Friday */
    const tier = weekendHold({ when, today }) ? 1 : tierOf(when, ahead);
    return { ...row, when, ahead, today, tier, ignored: ignore.has(row.unit) };
  });
  /* What the plan wants NOW - today, tomorrow, ASAP, overdue - so a swap
     never takes a unit off the diagram that was getting it home for work
     that is about to happen. A unit wanted somewhere on Wednesday is not
     protected on Monday: swapping it costs it nothing yet. */
  const wanted = new Map();
  for (const r of dated) {
    if (r.tier !== 1) continue;
    const ds = r.places.map(depotOf).filter(Boolean);
    if (ds.length) wanted.set(r.unit, (wanted.get(r.unit) || []).concat(ds));
  }
  /* The lines are answered nearest first - and at the same date a RED
     defect first, then one with a concession - so that where two want the
     same working home, the one that matters more gets it and the other is
     given the next. The plan comes back in its own order all the same. */
  const out = [], notices = [], taken = new Map();
  for (const r of dated.slice().sort(byPriority)) {
    const row = r;
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
    /* how it runs today, working by working: the diagrams coupled with it
       on each, off the Detail - one unit per diagram, so a 12-car is three
       diagrams on one working */
    const legs = day ? day.stops.filter(s => s.hcOut && s.dep != null)
      .map(s => ({ ...s, n: ((days.workings && days.workings.get(workingKey(s.code, s.hcOut, s.dep))) || [s.diag]).length })) : [];
    r.alone = legs.filter(l => l.n <= 1);
    r.coupled = legs.filter(l => l.n > 1);
    r.formation = legs.reduce((m, l) => Math.max(m, l.n), day ? 1 : 0);
    r.suggest = suggest(r, { mine: day, days, tomDays, wanted, taken, mse, keep: !!opts.keep });
    if (r.suggest.taken) {
      const t = r.suggest.taken;
      taken.set("D:" + t.diag + "@" + t.work, 1);                  // that diagram's unit displaced off that working
      taken.set("W:" + t.work, (taken.get("W:" + t.work) || 0) + 1);   // a request on that train
      taken.set("U:" + t.work, (taken.get("U:" + t.work) || []).concat(r.unit));
    }
    if (r.suggest.notice && !notices.some(n => n[0] === r.suggest.notice[0])) notices.push(r.suggest.notice);
    out.push(r);
  }
  out.sort((a, b) => a.line - b.line);
  /* A unit that ran in a formation today: whether its request takes the
     formation with it or splits it - a 12-car that arrived as one train
     and is asked to go three ways upsets the depot, so it is said, and the
     ranking above keeps formation-mates on one working where it can. */
  for (const r of out) {
    const t = r.suggest.taken, mates = r.suggest.matesOn || [];
    if (!t || !mates.length) continue;
    const withMe = taken.get("U:" + t.work) || [];
    const left = mates.filter(u => withMe.indexOf(u) < 0);
    if (!left.length) r.suggest.notes.push("with its formation " + mates.join("+"));
    else r.suggest.notes.push("splits the " + (mates.length + 1) + "-unit formation it arrives in — " + left.join("+") + " left");
  }
  /* The berth requests have run out for an exam that is near - nothing
     ends or calls where it is wanted and nothing it could take does - so
     the exams are swapped around: another unit on the plan whose exam is
     due later and that DOES end at that depot tonight has its exam
     brought forward, and this one's put back to that slot. Never a unit
     that other maintenance wants somewhere else now, and each unit is
     swapped once. */
  const swaps = [], swapped = new Set();
  const clashes = (unit, depot) => out.some(o => o.unit === unit && o.tier === 1 && !o.ignored &&
    o.places.length && o.places.map(depotOf).indexOf(depot) < 0);
  for (const r of out.slice().sort(byPriority)) {
    if (r.section !== "EXAMS" || r.tier !== 1 || r.ignored || !r.inTraffic) continue;
    if (!/^ENDS /.test(r.suggest.action) || swapped.has(r.unit)) continue;
    const targets = r.places.map(depotOf).filter(Boolean);
    const cands = out.filter(o => o.section === "EXAMS" && o.unit !== r.unit && !o.ignored && o.inTraffic &&
      !swapped.has(o.unit) && o.ahead !== null && r.ahead !== null && o.ahead > r.ahead &&
      o.ends && targets.indexOf(depotOf(o.ends.place)) >= 0 && !clashes(o.unit, depotOf(o.ends.place)));
    if (!cands.length) continue;
    // the same exam first, then the one due soonest after this
    cands.sort((a, b) => ((a.what === r.what ? 0 : 1) - (b.what === r.what ? 0 : 1)) || (a.ahead - b.ahead) || (a.line - b.line));
    const o = cands[0], depot = depotOf(o.ends.place);
    const sw = { unit: r.unit, what: r.what, due: dueOf(r), other: o.unit, otherWhat: o.what, otherDue: dueOf(o),
                 depot, ends: hhmm(o.ends.time, true), afterMidnight: o.afterMidnight };
    swaps.push(sw); swapped.add(r.unit); swapped.add(o.unit);
    r.suggest.action = "SWAP EXAM WITH " + o.unit;
    r.suggest.notes.unshift(o.unit + "'s " + (o.what || "") + " exam " + sw.otherDue + " brought forward — it ends " + depot + " " + sw.ends + " tonight");
    o.suggest.notes.push("exam brought forward for " + r.unit + " — see EXAM SWAPS");
  }
  const tiered = out.slice().sort(byPriority);
  const inTraffic = new Set(out.filter(r => r.inTraffic).map(r => r.unit)).size;
  return { rows: out, tiered, notices, swaps, order: plan.order, reviews, date, today, lines: out.length,
           units: new Set(plan.rows.map(r => r.unit)).size, inTraffic, ignored: ignore.size,
           mseUnits: [...new Set(out.filter(r => r.mse).map(r => r.unit))], mseAttending: mse.size,
           suggested: out.filter(r => !r.action && r.suggest.action).length };
}

/* ---------- what each line says ---------- */
function factsOf(r) {
  if (r.ignored) return "O/O/S — ignored";
  const flags = [];
  if (r.category) flags.push(r.category);
  if (r.summary) flags.push(r.summary);
  if (r.amat) flags.push("AMAT");
  if (r.mse) flags.push("MSE");
  if (r.red) flags.push("RED");
  if (r.con) flags.push("CON");
  if (r.gtr) flags.push("GTR");
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
  const out = [];
  if (res.notices && res.notices.length) {
    out.push("CHANGEOVERS & BALANCING", "========================", "");
    res.notices.forEach((n, i) => {
      out.push((i + 1) + ") " + n[0]);
      for (const l of n.slice(1)) out.push("   " + l);
      out.push("");
    });
  }
  /* the exams swapped around where the requests ran out: the unit that
     could not get there, and the one already ending there tonight whose
     exam is brought forward */
  if (res.swaps && res.swaps.length) {
    if (out.length) out.push("");
    out.push("EXAM SWAPS", "==========", "");
    res.swaps.forEach((s, i) => {
      out.push((i + 1) + ") " + s.unit + " " + (s.what || "").toUpperCase() + " EXAM " + s.due.toUpperCase() +
               " — SWAP WITH " + s.other + " (" + (s.otherWhat || "").toUpperCase() + " EXAM " + s.otherDue.toUpperCase() + ")," +
               " ENDS " + s.depot + " " + s.ends + (s.afterMidnight ? " AFTER MIDNIGHT" : " TONIGHT"));
    });
    out.push("");
  }
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
  if ((res.notices && res.notices.length) || (res.swaps && res.swaps.length)) {
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

return { run, render, shape, toText, toHtml, noticesText, parsePlan, parseDefects, faultSummary, whenOf, suggest,
         finalWorking, requestName, terminalCalls, depotStands, swapBetween, fits, fitsLoosely, priorityOf, mergeDefects, candidatesFor, matesOn, unitDay, allDays,
         PLACES, placeOf, FLEET_MOVES, movesFrom };
})();
if (typeof module !== "undefined" && module.exports) module.exports = SHEETS_BERTH;
if (typeof globalThis !== "undefined") globalThis.SHEETS_BERTH = SHEETS_BERTH;
