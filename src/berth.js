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
  GI:   ["GLNGDEP", "GLNGHMK", "GLNGMUS"],
  GLM:  ["GLNGHMK"],
  SG:   ["SLADEGD", "SLADGUS", "SLADGDP", "SLADGEH", "SLADEGN"],
  SGUPS:["SLADGUS"],
  GP:   ["GRVPCSD", "GRVPKDS", "GRVPKUS", "GRVPDCE", "GRVPKLE", "GRVPUHS"],
  GPD:  ["GRVPKDS"],
  AFK:  ["ASHFDNS", "ASHFEBS", "ASHFUPS", "ASHFKY", "ASHFDYW"],
  XSE:  ["STLNWCS", "STLNWMS", "STLNSHN", "STLNCET"],
  FKE:  ["FLKSETR", "FLKSTNE"],
  DVP:  ["DOVERP", "DOVERPS"],
  TON:  ["TONBDG", "TONBPMY", "TONBDMS"],
  HGS:  ["HASTING", "HASTPSD"],
  FAV:  ["FAVRSHM", "FAVRUPS", "FAVRBRD"],
  VIC:  ["VICTRIE", "VICTGCS"],
  CHX:  ["CHRX"],
  CST:  ["CANONST"],
  SU:   ["VICTRIE", "VICTGCS"],
  // the metro fleet's outstations
  ORP:  ["ORPNDSG", "ORPNGTN"],
  DFD:  ["DARTFUS", "DARTFD"],
};
/* The roads of a place, by the name the depot uses for each. A unit goes
   out from the road it landed on - the Up Sidings at Slade Green have
   their own diagrams, Ashford's East Berthing and Up Sidings theirs - so a
   request names departures off that road, and says so where it has to
   offer another. A code not here is named as the Detail prints it. */
const ROAD_NAMES = {
  GRVPKUS: "Up Sidings", GRVPKDS: "Down Sidings", GRVPCSD: "Carriage Shed", GRVPDCE: "Depot exit", GRVPUHS: "Up headshunt",
  SLADGUS: "Up Sidings", SLADEGD: "Depot", SLADGEH: "Depot", SLADGDP: "Depot", SLADEGN: "station",
  ASHFDNS: "Down Sidings", ASHFEBS: "East Berthing", ASHFUPS: "Up Sidings", ASHFDYW: "Down Yard", ASHFKY: "station",
  RAMSGTD: "EMU Depot", RAMSNEW: "New Sidings", RAMSDRW: "Depot reception", RAMSGTE: "station",
  DOVERPS: "Sidings", DOVERP: "station", STLNWCS: "Carriage Sidings", STLNWMS: "West Marina", STLNSHN: "shunt neck", STLNCET: "CET road",
  TONBDMS: "Down Main sidings", TONBPMY: "Jubilee Sidings", TONBDG: "platform", HASTPSD: "Park Sidings", HASTING: "station",
  FAVRUPS: "Up Sidings", FAVRBRD: "Back Road", FAVRSHM: "station", VICTGCS: "Grosvenor Sidings", VICTRIE: "station",
  GLNGDEP: "Depot", GLNGHMK: "platform", GLNGMUS: "Up Sidings", FLKSETR: "Turnback Road", FLKSTNE: "station",
  DARTFUS: "Up Sidings", DARTFD: "station", ORPNDSG: "Down Sidings", ORPNGTN: "station",
};
const roadName = code => ROAD_NAMES[code] || code;
// the roads a unit cannot be shunted off for a departure, and the depots that are one road
const STRICT_ROADS = new Set(["SLADGUS", "ASHFUPS"]);
const ONE_ROAD = new Set(["RE"]);
// the outstations whose roads matter too: Tonbridge is the Jubilee, the Down Main and the platform
const ROADED_OUTSTATIONS = new Set(["TON"]);
/* The depots - where a unit is worked on, and where a berth request can
   put it. A call here is a chance to hold it; a call at a station is not. */
const DEPOTS = new Set(["RE", "GI", "SG", "GP", "AFK", "XSE", "FKE", "VIC", "SU"]);
/* Where a changeover can be made: Ramsgate, and the London terminals. */
const CHANGEOVER_AT = new Set(["RAMSGTE", "CHRX", "CANONST", "VICTRIE", "LNDNBDG"]);
// ...and the depot stations where a unit can be taken off a working into the depot behind them
const TAKEN_OFF_AT = new Set([...CHANGEOVER_AT, "GLNGHMK", "ASHFKY"]);
/* Where there is nobody to do anything: no request is made at Folkestone
   East or Hastings. Where a train can be requested but not split down:
   Faversham, and those two. */
const NO_REQUEST_AT = new Set(["FKE", "HGS"]);
const NO_SPLIT_AT = new Set(["FKE", "HGS", "FAV"]);
/* The night turn's window: a unit whose allocation finishes between 09+00
   and 16+30 is on hand at a depot, and the departures it is offered are
   the ones between 09+00 and 16+30 first. Minutes from midnight. */
const PM_WINDOW = [540, 990];
/* A unit into a depot in the morning that sits there is "ENDS GP AM", as
   the plan writes it: a finish between 03+00 (after the night's arrivals)
   and midday. Minutes from midnight. */
const AM_FINISH = [180, 720];
/* On hand by 16 00 is on hand for the day shift: what ASAP, a mileage
   trigger and a defect want. Minutes from midnight. */
const DAY_SHIFT_END = 960;
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
/* Where a unit stands for a request: the depot, and every road of it - a
   unit in the Up Sidings at Slade Green is Slade Green's to put on any of
   its departures, one on the platform at Ramsgate is Ramsgate's. */
const homeOf = place => (place && DEPOTS.has(depotOf(place))) ? depotOf(place) : place;
const codesAt = place => [...new Set((PLACES[homeOf(place)] || []).concat(PLACES[place] || []))];
/* Selhurst is reached at Victoria, and the fleet move takes the unit over:
   a line for SU is answered with whatever gets it to Victoria, and the
   move - "GP BERTH 5F42 - VIC BERTH 5Y41", "VIC HOLD FOR 5Y41". */
const REACH_VIA = { SU: "VIC" };
const reachOf = t => REACH_VIA[t] || t;
const targetsOf = r => [...new Set(r.places.map(depotOf).filter(Boolean).map(reachOf))];
const minOf = t => { const m = /^(\d\d)[+ :](\d\d)$/.exec(String(t || "")); return m ? +m[1] * 60 + +m[2] : null; };
// a move that runs as two headcodes is named by the one it arrives as, the way the plan writes it
const moveName = m => m.hc.split("/").pop();

/* ---------- how far each place is from each depot ----------
   Rail miles, near enough: what they decide is only which of two places
   is NEARER a depot, for a unit due in three days that cannot get home
   yet and is moved as close as it can be - Ashford for Ramsgate, Grove
   Park for Victoria. Home is nearest of all. */
const MILES = {
  RE:  { RE: 0, RAM: 0, FAV: 30, DVP: 21, FKE: 30, AFK: 26, GI: 50, GLM: 50, TON: 52, GP: 70, GPD: 70, SG: 65, SGUPS: 65, CST: 78, CHX: 79, VIC: 79, SU: 87, XSE: 82, HGS: 80 },
  GI:  { GI: 0, GLM: 0, FAV: 17, RE: 50, RAM: 50, DVP: 45, FKE: 55, AFK: 45, SG: 20, SGUPS: 20, GP: 25, GPD: 25, CST: 33, CHX: 34, VIC: 34, SU: 42, TON: 40, XSE: 75, HGS: 73 },
  SG:  { SG: 0, SGUPS: 0, GP: 8, GPD: 8, GI: 20, GLM: 20, CST: 15, CHX: 16, VIC: 20, SU: 25, FAV: 40, RE: 65, RAM: 65, DVP: 70, FKE: 70, AFK: 60, TON: 30, XSE: 62, HGS: 60 },
  GP:  { GP: 0, GPD: 0, SG: 8, SGUPS: 8, CST: 9, CHX: 10, VIC: 14, SU: 12, GI: 25, GLM: 25, TON: 22, FAV: 45, RE: 70, RAM: 70, DVP: 70, FKE: 65, AFK: 47, XSE: 57, HGS: 55 },
  AFK: { AFK: 0, FKE: 15, DVP: 20, FAV: 28, RE: 26, RAM: 26, TON: 27, HGS: 35, XSE: 37, GI: 45, GLM: 45, GP: 47, GPD: 47, SG: 60, SGUPS: 60, CST: 56, CHX: 57, VIC: 56, SU: 64 },
  XSE: { XSE: 0, HGS: 2, TON: 33, AFK: 37, FKE: 50, DVP: 55, FAV: 62, RE: 82, RAM: 82, GI: 75, GLM: 75, GP: 57, GPD: 57, SG: 62, SGUPS: 62, CST: 66, CHX: 67, VIC: 70, SU: 75 },
  VIC: { VIC: 0, SU: 8, CST: 3, CHX: 2, GP: 14, GPD: 14, SG: 20, SGUPS: 20, GI: 34, GLM: 34, FAV: 50, RE: 79, RAM: 79, DVP: 77, FKE: 70, AFK: 56, TON: 40, XSE: 70, HGS: 72 },
  FKE: { FKE: 0, DVP: 7, AFK: 15, RE: 30, RAM: 30, FAV: 40, TON: 42, HGS: 45, XSE: 47, GI: 55, GLM: 55, GP: 65, GPD: 65, SG: 70, SGUPS: 70, CST: 70, CHX: 71, VIC: 70, SU: 78 },
};
MILES.SU = MILES.VIC;
// the metro outstations, from each depot
Object.assign(MILES.RE, { ORP: 68, DFD: 60 }); Object.assign(MILES.GI, { ORP: 28, DFD: 17 });
Object.assign(MILES.SG, { ORP: 14, DFD: 3 });  Object.assign(MILES.GP, { ORP: 5, DFD: 12 });
Object.assign(MILES.AFK, { ORP: 40, DFD: 50 }); Object.assign(MILES.XSE, { ORP: 45, DFD: 60 });
Object.assign(MILES.VIC, { ORP: 14, DFD: 20 }); Object.assign(MILES.FKE, { ORP: 60, DFD: 65 });
const distTo = (place, depot) => { const t = MILES[depot]; if (!t) return 999; const v = t[place] != null ? t[place] : t[homeOf(place)]; return v == null ? 999 : v; };

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
  if (/^(465|466|707)/.test(unit)) return "SG/GI";   // the metro fleets
  if (/^395/.test(unit)) return "AFK";               // the High Speed fleet, at Ashford
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
    rows.push(row);
    const rl = String(row.repairAt || "").toUpperCase();
    row.amat = /\bAMAT\b/.test(rl); row.mse = /\bMSE\b/.test(rl); row.red = /\bRED\b/.test(rl);
    row.con = /\bCON\b/.test(rl); row.gtr = /GTR/.test(rl);
    row.repairDepot = /RAMSGATE/.test(rl) ? "RE" : /GILLINGHAM/.test(rl) ? "GI" : /SLADE/.test(rl) ? "SG" :
                      /GROVE/.test(rl) ? "GP" : /ASHFORD/.test(rl) ? "AFK" : /SELHURST/.test(rl) ? "VIC" : null;
    row.category = defectCategory(row.priority);
    row.summary = faultSummary(row.fault);
  }
  // text in the box that read as no defect at all is said, not passed over
  if (n && !rows.length)
    reviews.push("The defects box holds " + n + " line" + (n === 1 ? "" : "s") + " but no defect row was read from it — paste the export as it comes, headings and all.");
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
/* Where the plan's own Action column says a unit stands - STOPPED RE, O/H
   AFK, SP @ GP, ENDS DVP, RE HOLD, AFK HOLD FOR MON, RE C/O AND HOLD, GP
   BERTH 5N32/5F28 - for a unit the reports have on no working. */
function placeFromAction(action) {
  const a = String(action || "").toUpperCase().replace(/\s+/g, " ").trim();
  if (!a) return null;
  const known = p => p && (PLACES[p] || DEPOT_OF[p]) ? p : null;
  let m = /(?:^|\b)(?:STOPPED|O\/H|O\/O\/S|SP ?@|ENDS|AT)\s+([A-Z]{2,6})\b/.exec(a);
  if (m && known(m[1])) return m[1];
  m = /^([A-Z]{2,6})\s+(?:HOLD|C\/O|BERTH)\b/.exec(a);
  if (m && known(m[1])) return m[1];
  return null;
}
function parsePlan(text) {
  const rows = [], reviews = [], order = [];
  let section = null, n = 0;
  for (const raw of String(text || "").split(/\r?\n/)) {
    const f = raw.split("\t").map(x => x.trim());
    if (!f.some(Boolean)) continue;
    n++;
    const title = SECTION_RE.exec(f[0]);
    if (title) {
      // the section word alone: "Exams — wk 39" is still the Exams
      section = title[1].replace(/\s*\/\s*/, "/").toUpperCase();
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
  if (dm) {
    out.date = dateFrom(+dm[1], +dm[2], dm[3] ? +dm[3] : null, today);
    // a day and month with no year, read from a late-December report: "02/01" is next year's
    if (!dm[3] && today && out.date - today < -180 * 86400000)
      out.date = new Date(Date.UTC(out.date.getUTCFullYear() + 1, out.date.getUTCMonth(), out.date.getUTCDate()));
  }
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
  if (ahead <= SOON_DAYS) return 2;
  return 3;
}
/* How far ahead a request is made: the planner's own plans ask one to
   three days ahead and write where the unit ends beyond that - on a
   Tuesday the Friday lines read ENDS, on a Thursday the Monday ones do.
   The weekend rule stands on top: Saturday, Sunday and Monday are near
   from Friday on. */
const SOON_DAYS = 3;

/* ---------- the reports ---------- */
function parseShort(s) {          // "dd/mm/yy" -> Date
  const m = /^(\d{2})\/(\d{2})\/(\d{2})$/.exec(String(s || "").trim());
  return m ? dateFrom(+m[1], +m[2], +m[3]) : null;
}
const shortOf = d => String(d.getUTCDate()).padStart(2, "0") + "/" + String(d.getUTCMonth() + 1).padStart(2, "0") + "/" + String(d.getUTCFullYear() % 100).padStart(2, "0");
const LONG_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const hhmm = (t, ecs) => {
  if (t == null) return "";
  const m = ((t % 1440) + 1440) % 1440;
  return String(Math.floor(m / 60)).padStart(2, "0") + (ecs ? "+" : " ") + String(m % 60).padStart(2, "0");
};
/* ---------- the Allocation Summary ----------
   A row per UNIT: the diagram it starts on, where and when, the diagram
   it finishes on, where and when. Where the Diagram Summary has no row
   for a unit - or was not dropped at all - this is what says where the
   unit is. Read as the CSV export (its labels on every line) or the
   printed text. Map date -> Map unit -> record, the date being the day
   the unit's day starts. */
const ALLOC_DT = /^(\d\d\/\d\d\/\d\d)\s+(\d\d:\d\d)$/;
function parseAllocation(text) {
  const out = new Map();
  const add = rec => {
    if (!out.has(rec.date)) out.set(rec.date, new Map());
    out.get(rec.date).set(rec.unit, rec);
  };
  const mins = t => { const m = /^(\d\d):(\d\d)$/.exec(t); return m ? +m[1] * 60 + +m[2] : null; };
  const daysApart = (a, b) => { const p = parseShort(a), q = parseShort(b); return p && q ? Math.round((q - p) / 86400000) : 0; };
  const make = (unit, depot, startDiag, sd, st, startLoc, ed, et, endLoc, endDiag) => ({
    unit, depot, startDiag, startLoc, start: mins(st), endDiag: endDiag || startDiag, endLoc,
    end: mins(et) != null ? mins(et) + 1440 * Math.max(0, daysApart(sd, ed)) : null, date: sd, endDate: ed,
  });
  const txt = String(text || "");
  if (/ALLOCATION SUMMARY/i.test(txt) && txt.indexOf(",") >= 0 && typeof SHEETS_CORE !== "undefined") {
    for (const f of SHEETS_CORE.csvParse(txt)) {
      const g = f.map(x => String(x == null ? "" : x).trim());
      const mi = g.lastIndexOf("MAINTENANCE");
      if (mi < 0) continue;
      const d = g.slice(mi + 1);
      if (!/^\d{6}$/.test(d[0] || "") || !/^[A-Z]{2}\d{3}$/.test(d[2] || "")) continue;
      const sm = ALLOC_DT.exec((d[4] || "").replace(/\s+/g, " ")), em = ALLOC_DT.exec((d[6] || "").replace(/\s+/g, " "));
      if (!sm) continue;
      add(make(d[0], d[1], d[2], sm[1], sm[2], d[5], em ? em[1] : sm[1], em ? em[2] : "", d[7] || "", /^[A-Z]{2}\d{3}$/.test(d[9] || "") ? d[9] : null));
    }
    if (out.size) return out;
  }
  /* the print: one unit per line, the two clocks as the anchor; the finish
     diagram is there only where it differs from the start diagram */
  const RE = /^(\d{6})\s+([A-Z]{2})\s+([A-Z]{2}\d{3})\s+\S+\s+(\d\d\/\d\d\/\d\d)\s+(\d\d:\d\d)\s+([A-Z0-9]+)\s+(\d\d\/\d\d\/\d\d)\s+(\d\d:\d\d)\s+([A-Z0-9]+)(?:(?:\s+\S+)?\s+([A-Z]{2}\d{3}))?/;
  for (const raw of txt.split("\n")) {
    const m = RE.exec(raw.trim().replace(/\s{2,}/g, "  "));
    if (m) add(make(m[1], m[2], m[3], m[4], m[5], m[6], m[7], m[8], m[9], m[10] || null));
  }
  return out;
}
/* The Summary rows a unit's allocation stands in for: one segment on the
   diagram it starts and ends on, or two where they differ - the first to
   its diagram's last call, the second from its diagram's first. */
function allocRows(rec, dets) {
  const stopsFor = diag => { const raw = dets && dets.get(diag); return raw ? stopsOf(raw) : []; };
  const base = { date: rec.date, fleet: "", pos: 1, units: [rec.unit], unit: rec.unit.slice(-3), viaAlloc: true };
  if (!rec.endDiag || rec.endDiag === rec.startDiag)
    return [{ ...base, diag: rec.startDiag, start: rec.start, from: rec.startLoc, to: rec.endLoc, end: rec.end }];
  const a = stopsFor(rec.startDiag), b = stopsFor(rec.endDiag);
  const za = a[a.length - 1];
  const cut = za ? (za.arr != null ? za.arr : za.dep) : rec.start;     // where the first segment ends
  // the second segment begins on the end diagram's first call after that
  const b0 = b.find(x => (x.dep != null ? x.dep : x.arr) >= cut);
  const t0 = b0 ? Math.max(cut, b0.dep != null ? b0.dep : b0.arr) : cut;
  return [
    { ...base, diag: rec.startDiag, start: rec.start, from: rec.startLoc, to: za ? za.code : rec.startLoc, end: cut },
    { ...base, diag: rec.endDiag, start: t0, from: b0 ? b0.code : rec.endLoc, to: rec.endLoc, end: rec.end },
  ];
}
function allocFor(genius, date) {
  return genius && genius.alloc && genius.alloc.get ? (genius.alloc.get(date) || null) : null;
}
/* Today: the day the Diagram Summary is for; with none, the day the
   Allocation Summary is for. An Allocation Summary for the day before the
   Summary (up to three days before - the Friday's dropped with a Monday's)
   is today instead: it says where every unit ends tonight, and the Summary
   dropped with it is tomorrow's, for tomorrow's units. One for any other
   day places nothing, and the review says so. */
const dayOf = d => { const t = parseShort(d); return t ? t.getTime() : 0; };
function runDate(sumDates, allocDates) {
  const s = sumDates.slice().sort((a, b) => dayOf(a) - dayOf(b))[0] || null;
  const as = allocDates.slice().sort((a, b) => dayOf(a) - dayOf(b));
  for (const a of as) {
    const n = s ? Math.round((dayOf(s) - dayOf(a)) / 86400000) : 0;
    if (!s || (n >= 1 && n <= 3)) return a;
  }
  return s || as[0] || null;
}

/* ---------- the weekend diagram prints as a Detail ----------
   The prints name places the depot's short way - "Ram Depot", "G Pk Dep",
   "St L Shed" - and the road works in Genius codes, so the ones it has a
   word for are mapped and the rest keep the print's own name, which is
   what the line then shows. A print row is a call: the working that
   leaves it, its clock rolled past midnight the way the Detail's is. */
const PRINT_CODES = {
  "CX": "CHRX", "C St": "CANONST", "Lndon BrE": "LNDNBDG", "Vic (E)": "VICTRIE", "VictGroSh": "VICTGCS",
  "Ram": "RAMSGTE", "Ram Depot": "RAMSGTD", "RM DRW": "RAMSDRW", "RamsNewSd": "RAMSNEW", "RMUSW": "RAMSGTD",
  "RM EK5143": "RAMMKEX", "RM EK5145": "RAMMKEX", "RM EK4985": "RAMMKEX",
  "Ashford I": "ASHFKY", "Ashfrd DS": "ASHFDNS", "Ashfd EBS": "ASHFEBS", "Ash Up Sd": "ASHFUPS", "AshfDYWRd": "ASHFDYW",
  "G Pk Dep": "GRVPCSD", "G Pk DnSd": "GRVPKDS", "G Pk UpSd": "GRVPKUS", "GrPkDCtEE": "GRVPDCE", "Gvpuphs": "GRVPKUS", "Grove Par": "GRVPK",
  "S Gn Dep": "SLADEGD", "S Gn U Sd": "SLADGUS", "SldGrDEHs": "SLADEGD", "S Gn": "SLADEGN",
  "Gill Dep": "GLNGDEP", "Gill": "GLNGHMK", "Gill US": "GLNGMUS",
  "St L Shed": "STLNWCS", "St L ShNk": "STLNWMS", "Folk E TR": "FLKSETR",
  "Dover P": "DOVERP", "Dover PSd": "DOVERPS", "Dover621": "DOVERP", "Dover623": "DOVERP",
  "Tonbridge": "TONBDG", "TonbJubS": "TONBPMY", "Ton DMS": "TONBDMS", "Tonbdg160": "TONBDG",
  "Hastings": "HASTING", "Hast Pk S": "HASTPSD",
  "Fav": "FAVRSHM", "Fav Up Sd": "FAVRUPS", "Fav Bk Rd": "FAVRBRD",
  "Mgate": "MARGATE", "Dart": "DARTFD", "Orp": "ORPNGTN", "StPancInt": "STPANCI", "Gend": "GRVSEND",
  "Brom S": "BROMLYS", "Brom N": "BROMLYN", "Sevenoaks": "SEVNOAKS", "Boro Gn": "BOROGRN", "Strood": "STROOD", "Strood625": "STROOD",
  "TunbdgWls": "TUNWELL", "TunWellTB": "TUNWELL", "Padd W": "PKWD", "Sheer": "SHRNSOS", "Sitt": "STNGBRN",
  "CantrbryW": "CNTBW", "Maid W": "MSTONEW", "Maid E": "MSTONEE", "Roch": "RCHT", "Bell Sd": "BELNGMS", "Hither Gn": "HTHRGRN",
};
const printMins = t => {
  const m = /^(\d{1,2})[:.+ ](\d{2})(?::\d{2})?$/.exec(String(t == null ? "" : t).trim());
  return m ? +m[1] * 60 + +m[2] : null;
};
const printDate = d => {
  const m = /^(\d{2})\/(\d{2})\/(\d{2})?(\d{2})$/.exec(String(d || "").trim());
  return m ? m[1] + "/" + m[2] + "/" + m[4] : null;
};
function detailFromPrints(diags) {
  const byDate = new Map();
  for (const d of diags.values()) {
    const date = printDate(d.date);
    if (!date) continue;
    const diag = d.code + String(d.num).padStart(3, "0");
    const rows = []; let prev = -1;
    const roll = v => { if (v === null) return null; while (v < prev - 60) v += 1440; prev = Math.max(prev, v); return v; };
    for (const r of d.rows) {
      if (!r.loc) continue;
      const arr = roll(printMins(r.arr)), dep = roll(printMins(r.dep));
      rows.push({ code: PRINT_CODES[r.loc] || r.loc, name: r.loc, arr, dep,
                  hc: r.hc && /^\d[A-Z]\d\d/.test(r.hc) ? r.hc.slice(0, 4) : null,
                  ev: /^(ATTTT|ATTACH|DETACH|DETTT)$/i.test(r.ev || "") ? r.ev.toUpperCase() : null,
                  act: r.ev === "#" ? "#" : null });
    }
    if (!rows.length) continue;
    if (!byDate.has(date)) byDate.set(date, new Map());
    byDate.get(date).set(diag, rows);
  }
  return byDate;
}

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
  return Math.floor(12 / (f === "375/3" ? 3 : f === "376" || f === "707" ? 5 : f === "395" ? 6 : f === "466" ? 2 : 4));
}
/* A claim on a working names the day too: today's 5H91 06+01 and
   tomorrow's are two trains, and a request on one must not use up the
   other. */
const dayKey = (pool, key) => ((pool && pool.date) || "") + "|" + key;
function allDays(genius, date) {
  const out = new Map();
  out.workings = new Map();
  out.date = date;
  out.lines = bookLines(genius, date);   // the sheets for the day, where they were built
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
  /* the Allocation Summary places the units the Diagram Summary does not:
     a diagram with no row of its own takes the rows its units' allocations
     stand in for */
  const alloc = allocFor(genius, date);
  if (alloc) for (const rec of alloc.values())
    for (const r of allocRows(rec, dets)) if (!rowsOf.has(r.diag) || !rowsOf.get(r.diag).some(x => x.units.length))
      rowsOf.set(r.diag, (rowsOf.get(r.diag) || []).filter(x => x.units.length).concat([r]));
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
/* ---------- the sheets' own names ----------
   The depots and outstations work from the berthing books, so a request
   names a working the way the book prints it: the line for that diagram
   at that place - by headcode where the book carries one, by the time it
   leaves the platform where it does not, "+" for an empty move. Read off
   the books built from the same Summary and Detail; where none could be
   built, the Detail's own times stand in under the same rule. */
const SECTION_OF = { GP: "GROVE PARK", GPD: "GROVE PARK", XSE: "WEST MARINA", AFK: "ASHFORD", RE: "RAMSGATE", RAM: "RAMSGATE",
  TON: "TONBRIDGE", GI: "GILLINGHAM", GLM: "GILLINGHAM", SG: "SLADE GREEN", SGUPS: "SLADE GREEN", VIC: "VICTORIA", SU: "VICTORIA",
  DVP: "DOVER PRIORY", FAV: "FAVERSHAM", FKE: "FOLKESTONE EAST", HGS: "HASTINGS", CHX: "CHARING CROSS", CST: "CANNON STREET",
  ORP: "ORPINGTON", DFD: "DARTFORD" };
/* the books for a date: dropped on the tab and built there (genius.lines),
   or the weekday books themselves (secsByDay, keyed by weekday letter) */
function bookLines(genius, date) {
  if (!genius || !date) return null;
  if (genius.lines && genius.lines.get) return genius.lines.get(date) || null;
  const b = genius.books || (genius.secsByDay ? genius : null);
  if (!b || !b.dates) return null;
  for (const k of Object.keys(b.dates)) if (b.dates[k] === date)
    return { main: b.secsByDay && b.secsByDay[k], metro: b.metroSecs && b.metroSecs[k] };
  return null;
}
const secLines = (m, name) => !m ? [] : (typeof m.get === "function" ? m.get(name) : m[name]) || [];
function sheetName(pool, place, diag, hc, dep) { const l = sheetLine(pool, place, diag, hc, dep); return l ? l.name : null; }
/* the book's line for a departure: its printed name, and where it goes -
   two departures printing the same time are told apart by that, "05 55
   VIC" and "05 55 RAM", the way the plan writes them */
function sheetLine(pool, place, diag, hc, dep) {
  const lines = pool && pool.lines, sec = SECTION_OF[place] || SECTION_OF[homeOf(place)];
  if (!lines || !sec || dep == null) return null;
  const all = secLines(lines.main, sec).concat(secLines(lines.metro, sec));
  const gap = t => { const a = (((t - dep) % 1440) + 1440) % 1440; return Math.min(a, 1440 - a); };
  let best = null, bestGap = 91;
  for (const e of all) {
    if (!e.units || !e.units.some(u => (u.code || "") + (u.diag || "") === diag)) continue;
    const g = gap(e.time);
    if (e.headcode === hc && g <= 180) { best = e; break; }   // the working itself
    if (g < bestGap) { best = e; bestGap = g; }
  }
  if (!best) return null;
  const depot = depotOf(homeOf(place)) || place;
  const name = HEADCODE_DEPOTS.has(depot) ? (best.headcode || null)
             : typeof SHEETS_CORE !== "undefined" && SHEETS_CORE.fmtTime ? SHEETS_CORE.fmtTime(best.time, best.time_kind) : null;
  return name ? { name, dest: best.dest || "" } : null;
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
  // the first place a code is listed under names it: Victoria's sidings are Victoria's, not Selhurst's
  for (const [place, codes] of Object.entries(PLACES)) {
    const d = depotOf(place);
    if (d && DEPOTS.has(d)) for (const c of codes) if (!m.has(c)) m.set(c, d);
  }
  // a station platform is a call, not a stand
  for (const c of ["RAMSGTE", "GLNGHMK", "ASHFKY", "VICTRIE", "SLADEGN"]) m.delete(c);
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
  const dets = genius.detail && genius.detail.get(date);
  let rows = (genius.summary || []).filter(r => r.date === date &&
    (r.units ? r.units.indexOf(unit) >= 0 : r.unit === unit));
  let viaAlloc = false;
  if (!rows.length) {
    const alloc = allocFor(genius, date);
    const rec = alloc && alloc.get(unit);
    if (!rec) return null;
    rows = allocRows(rec, dets); viaAlloc = true;
  }
  rows.sort((a, b) => a.start - b.start);
  const diags = [...new Set(rows.map(r => r.diag))];
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
    let seg = stopsWithin(stopsOf(raw), row).map(s => ({ ...s, diag: row.diag }));
    /* a segment the Detail has no calls for still ends where the row says:
       the row's own end stands in, so the day ends where the unit does */
    if (!seg.length && row.to) seg = [{ code: row.to, name: row.to, arr: row.end, dep: null, hcIn: null, hcOut: null, act: null, diag: row.diag }];
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
    unit, diags, rows, stops, splits, splitsAt, raw: rawAll, viaAlloc,
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
/* ---------- the departures out of where the unit is ----------
   The planner's own request: every departure out of the place the unit
   stands at that gets it home, or to a depot that can send it on, named
   as the sheet prints it, the depot to choose - "XSE BERTH 06+13/06+23/
   07+24", "AFK BERTH 05 05/05 42/06 26/07 05/07 10/08 28", "RE BERTH RP
   05 25". A departure counts when its diagram (a) ends at the depot
   wanted or stands there, (b) calls at that depot's terminal where a
   changeover is made - Victoria, for a 377 bound for Selhurst - or (c)
   stands half an hour or more at a depot nearer the one wanted, Grove
   Park for Ramsgate, from where it is sent on when due. A unit at its own
   depot, not due tonight, is offered the departures that come back to it
   or stand at any depot that can send it back, so it earns its keep. The
   unit's own fleet is listed; the variation only where the same fleets
   have nothing. MO needs a train of two diagrams or more. One request per
   diagram: the unit takes a slot on the first departure listed, and a
   departure with no slot left is not offered to the next unit, but is
   named as spoken for. Where no departure comes of it, the reason is
   returned as {why}, for the line to carry. */
function departuresFrom(r, pool, from0, targets, taken, opts) {
  opts = opts || {};
  const from = homeOf(from0), codes = codesAt(from0);
  if (!from0 || from0 === "?" || !codes.length || !pool || !pool.size || !targets.length) return null;
  const lab = opts.today ? "today's" : (pool.on || "tomorrow's");
  const on = opts.proxy ? "today's" : lab;
  const target = targets[0], atHome = targets.indexOf(from) >= 0;
  const wname = (hc, dep) => hc + " " + hhmm(dep, /^5/.test(hc));
  if (NO_REQUEST_AT.has(from)) {
    const outs = [];
    for (const d of pool.values()) {
      const s0 = d.stops[0];
      if (!s0 || codes.indexOf(s0.code) < 0 || s0.dep == null || !s0.hcOut) continue;
      if (!targets.some(t => reaches(d, t)) || (!fits(r.unit, d.fleet) && !fitsLoosely(r.unit, d.fleet))) continue;
      const k = wname(s0.hcOut, s0.dep); if (outs.indexOf(k) < 0) outs.push(k);
    }
    return { why: ["no request at " + from + " — none are made there" +
      (outs.length ? "; " + lab + " " + outs.slice(0, 3).join(", ") + " out of it " + (outs.length > 1 ? "get" : "gets") + " to " + targets.join("/") + " all the same" : "")] };
  }
  const mates = opts.mates || [];
  const splits = mates.length > 0 && !mates.every(u => targets.some(t => ((opts.wanted && opts.wanted.get(u)) || []).indexOf(t) >= 0));
  if (splits && NO_SPLIT_AT.has(from))
    return { why: ["the train it came in on (" + mates.join("+") + " with it) would have to be split at " + from + ", where none is"] };
  const here = atHome ? Infinity : distTo(from, target);
  // into the depot over a stand there, over a call at its terminal, over a nearer depot
  const RANK = { ends: 0, stands: 1, calls: 2, hub: 3 };
  const byKey = new Map();
  // the fleet moves out of this place on the day: a unit back here from the peak can go on by one
  const ownMoves = opts.dow != null && DEPOTS.has(from) && !NO_REQUEST_AT.has(from) ? movesFrom(from, targets, opts.dow) : [];
  for (const d of pool.values()) {
    /* the unit's own fleet, a 375/9 and a plain 375 counting as one - the
       plan lists them together - and never a 3-car, a 376 or a 377 on
       another's diagram */
    if (!fitsLoosely(r.unit, d.fleet)) continue;
    // a diagram whose own unit the plan wants at that depot now is not taken off it
    const guarded = !!(opts.wanted && d.units.some(u => u !== r.unit && (opts.wanted.get(u) || []).some(x => targets.indexOf(x) >= 0)));
    /* where the diagram leaves this place: the start of its day; and at
       the London-end depots, where the AM/PM berth is worked, a stand it
       goes on from later - the PM working off an AM berth, "GP BERTH
       5F87". A unit at its own depot is offered the morning departures:
       those are what go out and come back. */
    const outs = [];
    const s0 = d.stops[0];
    const startsHere = !!(s0 && codes.indexOf(s0.code) >= 0);
    if (startsHere && s0.dep != null && s0.hcOut) outs.push({ idx: 0, code: s0.code, dep: s0.dep, hc: s0.hcOut });
    // a diagram that starts here is named by its start: its PM leg off a stand back here is the same working
    if (!atHome && !startsHere && (HEADCODE_DEPOTS.has(from) || opts.nested))
      for (const st of depotStands(d.stops)) if (codes.indexOf(st.code) >= 0 && st.hcOut) outs.push({ idx: st.idx, code: st.code, dep: st.dep, hc: st.hcOut });
    for (const o of outs) {
      const rest = o.idx ? { ...d, stops: d.stops.slice(o.idx) } : d;
      const wk = workingKey(o.code, o.hc, o.dep), wid = dayKey(pool, wk);
      const sharing = (pool.workings && pool.workings.get(wk)) || [d.diag];
      /* where it gets to: home, the depot's terminal, or a nearer depot.
         At its own depot, a call or a stand there within two hours of
         leaving is the shunt out to the platform, not a return. */
      const real = x => !atHome || x == null || x - o.dep >= 120;
      let how = null, via = null, when = null, ends = false;
      const t = targets.find(x => reaches(rest, x));
      if (t) {
        const st = rest.endDepot === t ? null : rest.stops.slice(1).find(x => DEPOT_CODES.has(x.code) && depotOf(placeOf(x.code)) === t && x.arr != null && real(x.arr));
        if (st || rest.endDepot === t) { how = st ? "stands" : "ends"; via = t; when = st ? st.arr : rest.endTime; }
      }
      if (!how) {
        // a changeover at the depot's station, in the morning: the evening peak is nobody's to swap in
        const c = rest.stops.slice(1).find(x => TAKEN_OFF_AT.has(x.code) && x.arr != null && x.arr < 12 * 60 && targets.indexOf(depotOf(placeOf(x.code))) >= 0 && real(x.arr));
        if (c) { how = "calls"; via = depotOf(placeOf(c.code)); when = c.arr; }
      }
      if (!how && !opts.nested) {
        /* a depot nearer the one wanted that it ends at, or stands at for
           the day: that depot sends it on when it is due. Its own place
           counts where it comes back for the day and a fleet move goes on
           from there. */
        let best = null;
        const hubs = depotStands(rest.stops).map(st => ({ H: st.depot, arr: st.arr, ends: false }));
        if (rest.endDepot && DEPOTS.has(rest.endDepot) && rest.endTime != null) hubs.push({ H: rest.endDepot, arr: rest.endTime, ends: true });
        for (const h of hubs) {
          if (NO_REQUEST_AT.has(h.H)) continue;
          if (h.H === from) { if (ownMoves.length && !h.ends && h.arr - o.dep >= 120 && (!best || best.H !== from)) best = { ...h, dist: here }; continue; }
          const dist = distTo(h.H, target);
          if (dist < 999 && dist < here && (!best || dist < best.dist)) best = { ...h, dist };
        }
        if (best) { how = "hub"; via = best.H; when = best.arr; ends = best.ends; }
      }
      if (!how) continue;
      /* the due time: a unit wanted at home tomorrow has to be back by
         then, and a day at some other depot does not bring it back; and
         a unit for Selhurst has to be at Victoria before the last move
         over */
      if (opts.backBy != null && (how === "hub" ? atHome : (when == null || when > opts.backBy))) continue;
      if (opts.reachBy != null && how !== "hub" && when != null && when > opts.reachBy) continue;
      if (!byKey.has(wid)) {
        const line = sheetLine(pool, from0, d.diag, o.hc, o.dep);
        byKey.set(wid, { wid, hc: o.hc, dep: o.dep, start: !o.idx, road: o.code, sharing, diags: [], reach: [], dest: line ? line.dest : "",
                         name: line ? line.name : (HEADCODE_DEPOTS.has(from) ? o.hc : hhmm(o.dep, /^5/.test(o.hc))) });
      }
      const e = byKey.get(wid);
      e.reach.push(d.diag);
      /* a peak diagram: out for the morning peak, two hours or more at a
         depot away from home in the middle of the day, out again for the
         evening - what a unit at its own depot is sent out on when it is
         not due tomorrow */
      const peak = depotStands(rest.stops).some(st => st.depot !== from && st.dep - st.arr >= 120);
      if (!guarded) e.diags.push({ d, how, via, when, ends, peak, own: r.diags.indexOf(d.diag) >= 0, pos: d.pos });
    }
  }
  const all = [...byKey.values()].filter(e => e.diags.length);
  if (!all.length) return { why: ["nothing out of " + from + " on " + on + " Detail gets to " + targets.join("/") + ", or to a depot that could send it on"] };
  /* Every unit at a place is offered the same departures - the plan
     writes the one list against each of them and the depot chooses - so
     nothing is claimed; a departure already on another unit's list is
     said to be. */
  const kind = opts.today ? "today" : "next";
  const givenTo = x => (taken && taken.get("G:" + x.d.diag + "@" + (pool.date || "") + "@" + kind)) || [];
  const order = (a, b) => (RANK[a.how] - RANK[b.how]) || ((a.when || 0) - (b.when || 0));
  for (const e of all) {
    e.diags.sort(order);
    e.by = [...new Set(((taken && taken.get("U:" + e.wid)) || []).concat(...e.diags.map(givenTo)))].filter(u => u !== r.unit);
  }
  /* the diagrams that do best out of a working - into the depot over a
     call at its terminal - and, for multiple only, two or more of them
     have to get there together */
  const top = e => e.diags.filter(x => x.how === e.diags[0].how && x.via === e.diags[0].via);
  const fitMO = es => es.filter(e => !opts.mo || top(e).length >= 2);
  /* A unit at its own depot, not due tomorrow, goes out on a peak diagram
     - one that stands at Grove Park or Victoria through the day, from
     where it is brought back the night before it is due - not on one
     that is back the same day; those are the plan's lists. Only where
     there is no such diagram is it offered the rest. */
  const peak = atHome && opts.backBy == null
    ? fitMO(all.map(e => ({ ...e, diags: e.diags.filter(x => x.peak) })).filter(e => e.diags.length)) : [];
  const fit = peak.length ? peak : fitMO(all);
  if (!fit.length) return { why: ["MO — " + lab + " " + all.map(e => e.name).join(", ") + " out of " + from + " would run it on alone to " + targets.join("/")] };
  // (opts.mo: multiple only on any of the unit's lines, so every line's request keeps it coupled)
  /* the morning departures where there are any - the unit goes out on one
     of them - and the PM workings off a stand, which are the depot's own */
  const am = fit.filter(e => e.start && e.dep < 12 * 60);
  const morning = fit.filter(e => !e.start || !am.length || e.dep < 12 * 60);
  /* The road it landed on, at a depot: its own road's departures come
     first, and another road's after them, said to be a shunt across - the
     depot can divert a unit, but from where it stands. The Up Sidings at
     Slade Green and at Ashford are strict: an Up Sidings unit goes out on
     an Up Sidings diagram, and another road's is offered only where its
     own has none. Ramsgate is one road, the staff shunting depot to
     station; so is an outstation whose sidings feed its platforms - but
     not Tonbridge, whose Jubilee, Down Main and platform are three. */
  const road = opts.code && (DEPOTS.has(from) || ROADED_OUTSTATIONS.has(from)) && !ONE_ROAD.has(from) && codes.indexOf(opts.code) >= 0 ? opts.code : null;
  const strict = !!road && STRICT_ROADS.has(road);
  const onRoad = road ? morning.filter(e => e.road === road) : morning;
  const offRoad = road ? morning.filter(e => e.road !== road) : [];
  const pick0 = strict && onRoad.length ? onRoad : morning;
  const ownFirst = (a, b) => road ? ((a.road === road ? 0 : 1) - (b.road === road ? 0 : 1)) : 0;
  /* Which come first: back nearest the time it is due, where there is one;
     for ASAP, a mileage trigger or a defect, on hand in the day - by 16 00
     - so the depot has it for the day shift; otherwise into the depot over
     a stand, a call or a nearer depot, the earliest out first. And no more
     than the depot can use: where there are more departures than units on
     that road, the best three, the rest noted. */
  const arrives = e => top(e)[0].when != null ? top(e)[0].when : 9999;
  const soonest = e => Math.min(...e.diags.map(x => x.when != null ? x.when : 9999));   // on hand somewhere useful, by any diagram of it
  const rankOf = e => RANK[top(e)[0].how];
  const best = opts.backBy != null ? (a, b) => (arrives(b) - arrives(a)) || (a.dep - b.dep)
             : opts.dayFirst ? (a, b) => ((soonest(a) <= DAY_SHIFT_END ? 0 : 1) - (soonest(b) <= DAY_SHIFT_END ? 0 : 1)) || (rankOf(a) - rankOf(b)) || (a.dep - b.dep)
             : (a, b) => (rankOf(a) - rankOf(b)) || (a.dep - b.dep);
  const ranked = pick0.slice().sort((a, b) => ownFirst(a, b) || best(a, b));
  const cap = ranked.length > (opts.demand || 1) ? 3 : 6;
  // in the order the sheet prints them, which is the order the plan lists them in
  const printed = e => { const m = /^(\d\d)[ +](\d\d)$/.exec(e.name); return m ? +m[1] * 60 + +m[2] : e.dep; };
  const byPrint = (a, b) => (printed(a) - printed(b)) || (a.dep - b.dep);
  const listed = ranked.slice(0, cap).sort(byPrint);
  const more = ranked.slice(cap).sort(byPrint);
  /* the portion, where only that part of the train goes into the depot -
     "RP 05 25" - and none where every portion gets there one way or
     another, the depot to say which it takes off */
  const portionOf_ = e => {
    if (e.sharing.length < 2) return "";
    const f = top(e);
    if (f.length >= e.sharing.length || (RANK[f[0].how] >= RANK.calls && e.reach.length >= e.sharing.length)) return "";
    const poss = e.sharing.map(g => (pool.get(g) || {}).pos || 1);
    const ps = [...new Set(f.map(x => x.pos <= Math.min(...poss) ? "FP" : x.pos >= Math.max(...poss) ? "RP" : "MP"))];
    return ps.length === 1 ? ps[0] : "";
  };
  const twins = e => listed.filter(x => x.name === e.name).length > 1 && e.dest;
  const nameOf = e => (portionOf_(e) ? portionOf_(e) + " " : "") + e.name + (twins(e) ? " " + e.dest : "");
  const names = [...new Set(listed.map(nameOf))];
  const lead = listed[0], first = top(lead)[0];
  const whereTo = x => (x.how === "ends" ? (atHome ? "back " : "ends ") : x.how === "stands" ? (atHome ? "back " : "stands ") : x.how === "calls" ? "calls " : x.ends ? "ends " : x.via === from ? "back " : "stands ") +
                       x.via + " " + hhmm(x.when, true) + (x.how === "calls" ? ", where it can be taken off" : x.how === "hub" ? (x.via === from ? " — for the fleet move on" : (atHome ? "" : ", nearer " + target) + " — " + x.via + " to send it on") : "");
  const notes = listed.map(e => lab + " " + e.hc + " " + hhmm(e.dep, /^5/.test(e.hc)) + (e.sharing.length > 1 ? " (" + e.sharing.join("+") + ")" : "") + ": " +
                                e.diags.map(x => x.d.diag + (x.own ? " (its own diagram)" : "") + " " + whereTo(x)).join(", "));
  if (names.length > 1) notes.push("the depot to choose");
  if (opts.proxy && !opts.today) notes.push("check tomorrow's diagram" + (listed.length > 1 ? "s run" : " runs") + " the same");
  const shared = listed.filter(e => e.by.length);
  if (shared.length) notes.push(shared.map(e => nameOf(e) + " is on " + e.by.join(", ") + "'s list too").join("; "));
  /* what the nearer depot has on to the one wanted, once the unit is there:
     its own PM departures, and the fleet move on the day. Where every
     departure listed tracks the unit back through the one depot, that is
     the next leg, written as the plan writes it: "TON BERTH 06+00 THEN
     AFK BERTH 15+00/5R51". */
  let then = "";
  if (!opts.nested) {
    const hubs = [...new Set(listed.flatMap(e => top(e).filter(x => x.how === "hub").map(x => x.via)))];
    for (const H of hubs) {
      const on2 = H === from ? null : departuresFrom(r, pool, H, targets, null, { proxy: opts.proxy, today: opts.today, nested: true });
      const legs = on2 && on2.action ? on2.action.replace(/^\S+ BERTH /, "").split("/") : [];
      const moves = H === from ? ownMoves : opts.dow != null ? movesFrom(H, targets, opts.dow) : [];
      const parts = legs.concat(moves.map(m => "fleet move " + m.hc + " " + m.time + " (" + m.days + ")"));
      notes.push("then " + H + " has " + (parts.length ? parts.join(", ") : "nothing on the Detail") + " to " + targets.join("/") + " when it is due");
      const next = legs.concat(moves.map(moveName));
      if (!atHome && hubs.length === 1 && H !== from && next.length && listed.every(e => top(e)[0].how === "hub" && top(e)[0].via === H))
        then = " THEN " + H + " BERTH " + [...new Set(next)].join("/");
    }
  }
  if (more.length) notes.push("also: " + more.map(nameOf).join(", "));
  const shunted = listed.filter(e => road && e.road !== road);
  if (road && !onRoad.length) notes.push("nothing off the " + roadName(road) + " gets there — these leave the " +
    [...new Set(listed.map(e => roadName(e.road)))].join(" and ") + ", a shunt to check with the depot");
  else if (strict && offRoad.length) notes.push("off the " + roadName(road) + ", where it lands; " +
    [...new Set(offRoad.map(e => roadName(e.road)))].join(" and ") + ": " + offRoad.sort(byPrint).slice(0, 4).map(nameOf).join(", ") + " — a shunt across, to check with the depot");
  else if (shunted.length) notes.push("off the " + roadName(road) + " first; " +
    shunted.map(e => nameOf(e) + " leaves the " + roadName(e.road)).join(", ") + " — a shunt across");
  const later = fit.filter(e => morning.indexOf(e) < 0);
  if (later.length) notes.push("or, later in the day, " + later.slice(0, 3).map(nameOf).join(", "));
  if (peak.length) {
    const back = fitMO(all).filter(e => !peak.some(p => p.wid === e.wid)).sort((a, b) => a.dep - b.dep);
    if (back.length) notes.push("peak diagrams, out for the day; back here the same day: " + back.slice(0, 4).map(e => e.name).join(", "));
  }
  return { action: from + " BERTH " + names.join("/") + then, notes, taken: { diag: first.d.diag, work: lead.wid, kind }, mates,
           sharing: lead.sharing, workName: lead.hc, reach: first.via, how: first.how, portioned: !!portionOf_(lead) };
}
function matesAtStart(mine, days) {
  const s0 = mine.stops[0];
  if (!s0 || !s0.hcOut || s0.dep == null || !days.workings) return [];
  const out = [];
  for (const g of days.workings.get(workingKey(s0.code, s0.hcOut, s0.dep)) || [])
    if (mine.diags.indexOf(g) < 0 && days.get(g)) for (const u of unitAt(days.get(g), s0.dep)) if (u !== mine.unit && out.indexOf(u) < 0) out.push(u);
  return out;
}
function candidatesFor(r, mine, days, wanted, taken, keep) {
  const targets = targetsOf(r);
  const out = [];
  const myFleet = mine.rows[0] && mine.rows[0].fleet;
  for (const d of days.values()) {
    if (!d.endDepot || targets.indexOf(d.endDepot) < 0) continue;
    // its own diagram, if it is still on it at the end - a diagram it was
    // on in the morning, that another unit takes home, is a way home
    if (d.units.indexOf(r.unit) >= 0) continue;
    if (!d.units.length) continue;
    /* One unit per diagram: one request displaces it, and a unit the plan
       wants at that same depot is not to be taken off it. */
    if (d.units.some(u => (wanted.get(u) || []).indexOf(d.endDepot) >= 0)) continue;
    // the same fleet both ways - or, once the same fleets are exhausted,
    // the 375/9 variation - and the displaced unit has to fit my diagram
    const fitsBoth = fitOn => fitOn(r.unit, d.fleet) && (!myFleet || d.units.every(u => fitOn(u, myFleet)));
    const strict = fitsBoth(fits);
    if (!strict && !fitsBoth(fitsLoosely)) continue;
    const displaced = d.units.join("/");
    /* a request is made where the unit is: a swap at a place both are
       today - a terminal changeover, or the depot's own AM/PM berth */
    const swap = swapBetween(mine, d);
    if (!swap) continue;
    /* The working the unit would take is one train, whichever diagrams run
       it coupled - a 12-car is three diagrams on one working - and it
       carries a request per diagram, never more than a 12-car of this
       unit's kind: three 375s, two 376s. */
    const w = { code: swap.theirs.code, hc: swap.theirs.hcOut, dep: swap.theirs.dep };
    const wkey = workingKey(w.code, w.hc, w.dep), wid = dayKey(days, wkey);
    const sharing = (days.workings && days.workings.get(wkey)) || [d.diag];
    const cap = Math.min(maxUnits(r.unit), sharing.length);
    // this diagram's unit on this working displaced once, not twice
    if (taken && taken.get("D:" + d.diag + "@" + wid)) continue;
    const usedW = taken ? (taken.get("W:" + wid) || 0) : 0;
    if (usedW >= cap) continue;
    // a restriction is a formation: multiple only needs a train of two
    // diagrams or more. No multiple is no multiple on ONE END, which is
    // a check on which end couples, not a bar on coupling - said below.
    if (r.mo && sharing.length < 2) continue;
    /* the portion, where the train splits before the depot and only this
       diagram's goes there: "RP 5F87" - and multiple only cannot be that
       portion, which runs on alone */
    const portion = portionOf(d, sharing, days, d.endDepot);
    if (r.mo && portion) continue;
    /* A unit whose formation-mate has already been given this working goes
       with it, so a 12-car that arrives as one train is not split three
       ways for three requests: a mate is already on this working, or every
       mate is wanted at this same depot now and the train has room. */
    const mates = matesOn(mine, swap, days);
    const together = !!(taken && (taken.get("U:" + wid) || []).some(u => mates.indexOf(u) >= 0)) ||
      (mates.length > 0 && cap >= mates.length + 1 && mates.every(u => (wanted.get(u) || []).indexOf(d.endDepot) >= 0));
    const cand = { day: d, swap, name: requestName(d.endDepot, d.final), variation: !strict, rank: 0, together, mates, portion,
                   displaced, work: wid, workName: w.hc || hhmm(w.dep, true), sharing, slot: usedW + 1, slots: cap };
    /* Splitting the train it arrived in. Never where there is nobody to
       do it - Folkestone East, Hastings - nor at Faversham, where a train
       can be requested but not split; and with "keep trains together" on,
       only where nothing else gets it home. */
    const splitsTrain = mates.length > 0 && !together;
    const where = swap.kind === "depot" ? swap.mine.depot : placeOf(swap.at);
    if (swap.kind === "depot" && NO_REQUEST_AT.has(swap.mine.depot)) continue;
    if (splitsTrain && where && NO_SPLIT_AT.has(depotOf(where) || where)) continue;
    cand.splitsTrain = splitsTrain; cand.where = where;
    // the unit's own fleet first, always; a swap that leaves the other train whole before one that splits it
    cand.rank = (strict ? 0 : 10) + (swap.splitsTheirs ? 0.25 : 0) - (together ? 0.5 : 0) + (splitsTrain && keep ? 5 : 0);
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
  // seen from Friday or Saturday: on the Sunday night, Monday is tomorrow and the hold is a plain one
  const due = r.when.date.getUTCDay(), now = r.today.getUTCDay();
  return (due === 6 || due === 0 || due === 1) && (now === 5 || now === 6);
}
function suggest(r, ctx) {
  const s = suggestCore(r, ctx);
  /* Selhurst: what gets it to Victoria, and the move over from there. A
     unit is wanted at Selhurst on the day or the day before, not sooner,
     so the move is asked for only when the line is due today or tomorrow;
     further out, the request gets it to Victoria and the move is noted. */
  if (r.places.length === 1 && r.places[0] === "SU" && s.action) {
    const mv = FLEET_MOVES.filter(m => m.from === "VIC" && m.to === "SU");
    const name = mv.length ? moveName(mv[0]) : "5Y41";
    const when = mv.map(m => m.hc + " " + m.time).join(" or ") + (mv.length ? " (" + mv[0].days + ")" : "");
    const dueNow = r.tier === 1 && (r.ahead === null || r.ahead <= 1);
    // a weekend hold keeps its Monday: "VIC HOLD FOR MON - 5Y41"
    const toVic = s.reach === "VIC" || (!s.reach && /^VIC /.test(s.action));
    if (/^VIC HOLD/.test(s.action)) { if (dueNow) s.action = "VIC HOLD FOR " + (/FOR MON$/.test(s.action) ? "MON - " : "") + name; }
    // the move over, the way the plan writes it: "GP BERTH 5F42 - VIC BERTH 5Y50"
    else if (dueNow && toVic && /BERTH/.test(s.action) && !/5Y/.test(s.action)) s.action += /^VIC /.test(s.action) ? "/" + name : " - VIC BERTH " + name;
    if ((toVic || /VIC/.test(s.action)) && mv.length)
      s.notes.push(dueNow ? "over to Selhurst on " + when : "then over to Selhurst on " + when + " the day before it is due, or on the day");
  }
  return s;
}
function suggestCore(r, ctx) {
  const s = { action: "", notes: [], notice: null };
  const t = r.places[0] || "";
  const targets = targetsOf(r);
  if (r.ignored) { s.action = "O/O/S"; return s; }
  if (r.amat && !/^(MO|NM)$/.test(r.category || "")) {
    s.action = "AMAT — NO REQUEST"; return s;
  }
  if (r.mse && ctx && ctx.mse && ctx.mse.has(r.unit)) { s.action = "MSE ATTENDING — NO REQUEST"; return s; }
  if (r.mse) s.notes.push("MSE — no request if they are attending");
  if (!r.inTraffic && !r.standing) { s.action = "NOT IN TRAFFIC"; return s; }
  /* the plan's own words for a unit that stands somewhere - STOPPED RE,
     O/H FKE, SP @ GP - are what the Telex reads, so they are kept where
     nothing better is suggested; a unit that is STOPPED or out of service
     is not offered a train at all */
  const planned = String(r.action || "").trim().toUpperCase();
  const standingWord = () => /^(STOPPED|O\/H|O\/O\/S|SP ?@|ENDS|AT)\b/.test(planned) ? planned : "AT " + r.ends.place;
  const stopped = !!r.standing && /^(STOPPED|O\/O\/S)\b/.test(planned);
  if (r.standing) {
    s.notes.push("not in traffic — at " + r.standing + " per the plan (" + (r.action || "").trim() + ")");
    if (stopped) { s.action = standingWord(); return s; }
  }
  /* A unit on several lines - an exam and a defect, say - is asked for
     once, on the line that came first; its other lines carry the same
     request rather than take a second train the unit cannot be on. */
  if (ctx && ctx.already) {
    s.action = ctx.already;
    if (r.tier <= 2 && targets.length && r.inTraffic && ctx.days && ctx.days.size && !r.endsAtTarget) s.notes.push("no call at " + r.places.join("/") + " today");
    s.notes.push("the same request as its other line");
    return s;
  }
  /* a restriction is a formation, and today's is checked: multiple only
     on a working of one unit, or no multiple on a working of two, is said */
  const legName = l => (l.hcOut || "?") + " " + hhmm(l.dep, /^5/.test(l.hcOut || ""));
  if (r.mo && r.alone && r.alone.length)
    s.notes.push("MO — multiple only, but runs as one unit on " + legName(r.alone[0]) + " today: check");
  if (r.category === "NM" && r.coupled && r.coupled.length)
    s.notes.push("NM — no multiple on one end: check which end couples on " + legName(r.coupled[0]) + " today");
  const endsAt = depotOf(r.ends.place);
  /* where it ends, the way the plan writes it: a unit into a depot in the
     morning that sits there is "ENDS GP AM" */
  const endsWord = () => "ENDS " + r.ends.place +
    (r.ends.time != null && !r.afterMidnight && r.ends.time >= AM_FINISH[0] && r.ends.time < AM_FINISH[1] && DEPOTS.has(homeOf(r.ends.place)) ? " AM" : "");
  /* near: today, tomorrow, ASAP, overdue, or this coming weekend and
     Monday - holds and requests. Soon: the next three days - requests,
     after the near lines have had theirs. A defect is soon whenever it is
     due: a repair is wanted as soon as the unit can be got there. */
  const near = r.tier === 1, soon = r.tier <= 2 || !!r.isDefect;
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
  /* the departures out of a place, for the request: today's from where
     the unit starts, where the day is still to run; otherwise tomorrow's
     from where it ends, or today's standing in for them */
  const pool = ctx && (ctx.tomDays || ctx.days), proxy = !ctx || !ctx.tomDays || ctx.tomDays === ctx.days;
  const dow = ctx && ctx.tomDow != null ? ctx.tomDow : r.today ? (r.today.getUTCDay() + 1) % 7 : 1;
  /* a unit for Selhurst is at Victoria before the last move over on the day */
  const mins = x => { const m = /^(\d\d)[+ ](\d\d)$/.exec(x || ""); return m ? +m[1] * 60 + +m[2] : null; };
  const reachBy = REACH_VIA[t] ? movesFrom(REACH_VIA[t], [t], dow).map(m => mins(m.time)).filter(x => x != null).reduce((a, b) => Math.max(a, b), -1) : -1;
  const listFrom = (from, extra) => {
    if (!ctx || !ctx.mine || !pool) return null;
    /* the road it landed on, where the reports say; a unit placed by the
       plan's own word is anywhere in the depot. ASAP, a mileage trigger
       or a defect is wanted in the day. */
    const base = { dow, wanted: ctx.wanted, demand: ctx.demand || 1, mo: !!r.mo,
                   dayFirst: !!(r.when.asap || r.when.miles != null || r.isDefect), ...(reachBy >= 0 ? { reachBy } : {}) };
    if (ctx.dayToRun && r.starts && r.starts.place && r.starts.place !== "?") {
      const t = departuresFrom(r, ctx.days, r.starts.place, targets, ctx.taken, { ...base, today: true, code: r.starts.code, mates: matesAtStart(ctx.mine, ctx.days), ...(extra || {}) });
      if (t && t.action) return t;
    }
    return departuresFrom(r, pool, from, targets, ctx.taken, { ...base, proxy, code: r.standing ? null : r.ends.code, mates: matesOn(ctx.mine, null, ctx.days), ...(extra || {}) });
  };
  const useList = lst => {
    s.action = lst.action;
    if (!near) s.notes.push("due " + dueOf(r));
    s.notes = s.notes.concat(lst.notes);
    s.taken = lst.taken; s.matesOn = lst.mates; s.reach = lst.reach;
    // a train of two diagrams or more, unless the request is for one portion of it
    if (lst.sharing.length > 1 && !lst.portioned) s.notes.push(lst.workName + " runs as " + lst.sharing.length + " units (" + lst.sharing.join("+") + ")");
    if (r.category === "NM" && lst.sharing.length > 1) s.notes.push("NM — check which end couples on " + lst.workName);
    return s;
  };
  if (r.endsAtTarget) {
    /* at the depot it is wanted at. Due today, or tomorrow morning: held.
       Due tomorrow afternoon or evening, ASAP, or later in the week: it
       can work and come back, so the departures that bring it back are
       the request - "RE BERTH RP 05 25" - and only where none does is it
       held. */
    /* held: due today, ASAP, tomorrow morning, or over the weekend for
       Monday; and at Victoria for Selhurst tomorrow, whichever half,
       since the move over is the depot's to make */
    const forMove = r.ahead === 1 && !!REACH_VIA[t] && REACH_VIA[t] === endsAt;
    const dueAM = r.ahead !== null && (r.ahead <= 0 || (r.ahead === 1 && (r.when.half === "AM" || !r.when.half)) || forMove);
    const hold = () => {
      s.action = A_HOLD(depotOf(r.ends.place) || r.ends.place, mon);
      if (r.when.half === "PM" && r.ahead === 1 && !forMove) s.notes.push("PM — could run the morning first");
      backBy();
      return s;
    };
    if (near && (dueAM || (mon && r.ahead !== 1))) return hold();
    if (soon) {
      // back by the time it is due: 20 00 for a Ramsgate exam, midnight for end of day - and ASAP is back tonight, whatever the hour
      const by = r.ahead === 1 ? (r.when.time != null ? r.when.time : r.when.half === "PM" && endsAt === "RE" ? 20 * 60 : 24 * 60) : r.when.asap ? 30 * 60 : null;
      const lst = listFrom(r.ends.place, by != null ? { backBy: by } : null);
      if (lst && lst.action) { useList(lst); if (by != null) s.notes.push(by >= 24 * 60 ? "back here tonight, whatever the hour" : "back here by " + hhmm(by, true) + ", when it is due"); return s; }
      if (near) { hold(); if (lst && lst.why) s.notes = s.notes.concat(lst.why); return s; }
      if (r.standing) { s.action = standingWord(); if (lst && lst.why) s.notes = s.notes.concat(lst.why); return s; }
      s.action = endsWord();
      s.notes.push("due " + dueOf(r) + " — where it ends tonight, not yet a hold");
      if (lst && lst.why) s.notes = s.notes.concat(lst.why);
      return s;
    }
    s.action = r.standing ? standingWord() : endsWord();
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
    s.reach = d;
    // the one place the rule bites: taking a unit off or onto a working
    if (r.splits) s.notes.push("splits at " + r.splitsAt.join("/"));
    s.notes.push("at " + at.place + " " + hhmm(at.arr, /^5/.test(at.hcIn || "")) +
      (at.stay != null && at.stay >= 60 ? " for " + Math.round(at.stay / 60 * 10) / 10 + " h" : "") +
      (at.hc ? ", leaves on " + at.hc.slice(0, 4) : ""));
    return s;
  }
  let why = null;
  if (soon && targets.length && ctx && ctx.mine) {
    /* Today's swap first: a changeover at a terminal both are at, or the
       depot's own AM/PM berth - "GP BERTH 5F87/5F85/5F91" */
    const cands = candidatesFor(r, ctx.mine, ctx.days, ctx.wanted, ctx.taken, ctx.keep);
    const c = cands[0];
    if (c) {
      const depot = c.day.endDepot, sw = c.swap;
      if (!near) s.notes.push("due " + dueOf(r));
      s.taken = { diag: c.day.diag, work: c.work };
      s.matesOn = c.mates; s.reach = depot;
      if (c.variation) s.notes.push("VARIATION — " + (c.day.fleet || "?") + " diagram, same fleets exhausted");
      /* every departure the depot could put it on, the depot to choose -
         never the arrival, the depot has that on its own allocation */
      const listed = [c];
      if (sw.kind === "depot") {
        /* on hand at the depot from the AM berth: the PM workings out of
           it that end where it is wanted - "GP BERTH 5F87/5F85/5F91" -
           named the way that depot names workings */
        const at = sw.mine.depot;
        const nm = w => HEADCODE_DEPOTS.has(at) ? (w.hc || hhmm(w.dep, /^5/.test(w.hc || ""))) : hhmm(w.dep, /^5/.test(w.hc || ""));
        const outName = k => (k.portion ? k.portion + " " : "") +
          (sheetName(ctx.days, at, k.day.diag, k.swap.theirs.hcOut, k.swap.theirs.dep) || nm({ hc: k.swap.theirs.hcOut, dep: k.swap.theirs.dep }));
        const outs = [outName(c)];
        for (const k of cands.slice(1)) {
          if (k.swap.kind !== "depot" || k.swap.mine.depot !== at || k.variation !== c.variation) continue;
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
      } else {
        s.action = depot + " BERTH " + (c.portion ? c.portion + " " : "") + c.name + " — T/F AT " + stationOf(sw.at);
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
      if (sw.kind !== "depot") s.notice = noticeOf(r, c);
      if (c.day.splitsAt.length) s.notes.push(c.day.diag + " splits at " + c.day.splitsAt.join("/"));
      const rest = cands.filter(k => listed.indexOf(k) < 0).slice(0, 2);
      if (rest.length) s.notes.push("or " + rest.map(k => k.day.diag + " " + k.name + (k.variation ? " (variation)" : "")).join(", "));
      return s;
    }
    /* Then the departures out of where it is: before it goes out, where
       the day is still to run, or tomorrow's from where it ends tonight. */
    const lst = listFrom(r.ends.place);
    if (lst && lst.action) return useList(lst);
    why = lst && lst.why;
  }
  /* The Detail has nothing out of there that gets to the depot. The
     standing fleet move out of the depot it is at, on the day, is a
     request the depot knows - "SG BERTH 5L17". */
  if (soon && targets.length && r.ends) {
    const at = homeOf(r.ends.place);
    const lab = (ctx && ctx.tomDays && ctx.tomDays.on) || "tomorrow's";
    const mv = DEPOTS.has(at) && !NO_REQUEST_AT.has(at) ? movesFrom(at, targets, dow) : [];
    if (mv.length) {
      s.action = at + " BERTH " + [...new Set(mv.map(moveName))].join("/");
      if (!near) s.notes.push("due " + dueOf(r));
      if (why) s.notes = s.notes.concat(why);
      for (const m of mv) s.notes.push(lab + " fleet move " + m.hc + " " + m.time + " " + m.from + " - " + m.to + " (" + m.days + ")");
      if (mv.length > 1) s.notes.push("the depot to choose");
      return s;
    }
  }
  s.action = r.standing ? standingWord() : endsWord();
  /* why not, in words the planner can check: no call there today (where it
     ran today), and then what is out of where it ends - nobody there to
     ask, the trains that get there spoken for, or none that do */
  if (soon && targets.length) {
    if (r.inTraffic && ctx && ctx.days && ctx.days.size) s.notes.push("no call at " + r.places.join("/") + " today");
    if (why) s.notes = s.notes.concat(why);
    else s.notes.push("no working it could be put on gets to " + r.places.join("/"));
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
  /* the plan's defect lines by unit, category and date - a list per key,
     since a unit can carry two lines of one kind for one date and both
     have to come back */
  const kept = new Map();
  for (const r of planned) { const k = keyOf(r); if (!kept.has(k)) kept.set(k, []); kept.get(k).push(r); }
  const rows = plan.rows.filter(r => r.section !== "DEFECTS");
  const order = plan.order.slice();
  if (order.indexOf("DEFECTS") < 0) order.push("DEFECTS");
  for (const d of defects.rows) {
    const twins = kept.get(d.unit + "|" + d.category + "|" + (d.target || "").slice(0, 10));
    const twin = twins && twins.length ? twins.shift() : null;
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
    rows.push(row);
  }
  // plan defect lines the export did not carry stay as they were
  for (const rs of kept.values()) for (const r of rs) rows.push(r);
  return { rows, reviews: plan.reviews.concat(defects.reviews), order };
}
function run(planText, genius, opts) {
  opts = opts || {};
  const plan = mergeDefects(parsePlan(planText), opts.defects ? parseDefects(opts.defects) : null);
  const reviews = plan.reviews.slice();
  const allocDates = genius && genius.alloc && genius.alloc.keys ? [...genius.alloc.keys()] : [];
  const sumDates = [...new Set((genius && genius.summary || []).map(r => r.date))].filter(Boolean);
  const date = opts.date || runDate(sumDates, allocDates);
  const today = date ? parseShort(date) : null;
  if (!date) reviews.push("No weekday reports are loaded, so nothing can be said about where any unit is — build the weekday books first.");
  const ignore = new Set(String(opts.ignore || "").match(/\d{6}/g) || []);
  // the units the mobile engineers are going out to: no request for those
  const mse = new Set(String(opts.mse || "").match(/\d{6}/g) || []);
  const dayRows = (genius && genius.summary || []).filter(r => r.date === date);
  const filled = dayRows.filter(r => r.units && r.units.length).length;
  const allocHere = allocFor(genius, date);
  if (allocHere) reviews.push("The Allocation Summary for " + date + " places " + allocHere.size + " units" +
    (dayRows.length ? " — used for any unit the Diagram Summary has no row for." : " — no Diagram Summary for " + date + ", so it places every unit."));
  else if (allocDates.length && date)
    reviews.push("The Allocation Summary dropped is for " + allocDates.join(", ") + ", not " + date + " — it places nothing today. " +
                 "Drop the one for " + date + " (or the day before it, with tomorrow's Summary and Detail).");
  if (date && !filled && allocHere) { /* the allocation does the placing */ }
  else if (date && !filled)
    reviews.push("The Diagram Summary has no units on it — it was printed before the day was allocated. " +
                 "Drop the print that was run after allocation (the evening one) and this can say where each unit is.");
  else if (date && filled < dayRows.length) {
    /* part allocated: the metro diagrams done and the 375s not, say, so a
       375 is on no working it knows of - said by diagram prefix, which is
       what the planner will recognise */
    const pre = new Map();
    for (const r of dayRows) { const k = r.diag.slice(0, 2); const e = pre.get(k) || { rows: 0, units: 0 }; e.rows++; if (r.units && r.units.length) e.units++; pre.set(k, e); }
    const none = [...pre.entries()].filter(([, e]) => !e.units).map(([k]) => k);
    if (none.length)
      reviews.push("The Diagram Summary for " + date + " has units on " + filled + " of " + dayRows.length + " workings and none on the " +
                   none.join(", ") + " diagrams — those were not allocated when it was printed, so a unit of theirs is 'not in traffic' " +
                   "unless the plan's own Action says where it stands. For where each unit ends tonight, drop TODAY'S Summary printed after allocation.");
  }
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
  // any other day's diagrams, read once
  const dayCache = new Map([[date, days], [tomDate, tomDays]]);
  const daysFor = k => { if (!dayCache.has(k)) dayCache.set(k, allDays(genius, k)); return dayCache.get(k); };
  /* how the lines name that day's workings: "tomorrow's 5H91", or
     "Monday's 5H91" when the Detail is for the day after that */
  if (tomDate) tomDays.on = tomAhead === 1 ? "tomorrow's" : LONG_DAYS[parseShort(tomDate).getUTCDay()] + "'s";
  const haveToday = !!(date && genius && genius.detail && genius.detail.get(date));
  const on = tomAhead === 1 ? "tomorrow's" : tomAhead + " days on";
  if (date && !haveToday)
    reviews.push("No Diagram Detail for " + date + ": where each unit ends tonight is read off the Summary alone, and no changeover " +
                 "or depot swap today can be seen. " + (tomDate ? "The departures are off the " + tomDate + " Detail, " + on + "." : "Drop the Detail for " + date + ", or for the day after, for more."));
  else if (tomDate)
    reviews.push("The departures are off the " + tomDate + " Diagram Detail, " + on + ", not today's taken as a proxy.");
  /* The days between today and the Detail's - the Sunday, with Saturday's
     allocation and Monday's Detail. A unit placed on one of them by its
     Summary or allocation is placed by the latest of those, since that is
     where it is when the departures leave; every other unit is taken to
     stand where today leaves it, and one that works that day will not.
     Said, so the requests are read for what they are. */
  const between = [];
  if (today && tomDate && tomAhead >= 2) for (let n = 1; n < tomAhead; n++) between.push(shortOf(new Date(today.getTime() + n * 86400000)));
  const placedBy = k => { const a = allocFor(genius, k); return (a ? a.size : 0) + (genius.summary || []).filter(x => x.date === k && x.units && x.units.length).length; };
  const blank = between.filter(k => !(genius.detail && genius.detail.get(k)) && placedBy(k) < placedBy(date) / 2);
  if (blank.length) {
    const part = blank.filter(k => placedBy(k)).map(k => "the " + k + " Allocation Summary places " + placedBy(k) + " units, so it was printed before that day was allocated");
    reviews.push("Nothing is loaded for " + blank.join(", ") + (part.length ? " (" + part.join("; ") + ")" : "") + ": every " + (part.length ? "other " : "") +
                 "unit is taken to stand where " + date + " leaves it until the " + tomDate + " departures, and a unit that works on " + blank.join(", ") +
                 " will not be there. Drop that day's Detail, or its Allocation Summary once it is done, and the requests are made from where each unit really is.");
  }
  if (opts.dayToRun && date)
    reviews.push("Read as a day still to run: every unit is where its first working starts, and can be asked for from there before it goes out.");
  /* the sheets are what the depots work from, so the requests read as the
     sheets print them wherever the books could be built */
  const namedBy = [...new Set([days, tomDays].filter(p => p && p.lines && (p.lines.main || p.lines.metro)).map(p => p.date))];
  if (namedBy.length) reviews.push("The requests are named as the " + namedBy.join(" and ") + " books print them — the same line the depot reads on its sheet.");
  else if (date) reviews.push("No books could be built from what was dropped (a Diagram Summary and Detail for one weekday build them), so the requests are named off the Diagram Detail by the books' own rule.");
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
    const ds = targetsOf(r);
    if (ds.length) wanted.set(r.unit, (wanted.get(r.unit) || []).concat(ds));
  }
  // the day the departures leave on, for the fleet moves that run that day
  const tomDow = tomDate ? parseShort(tomDate).getUTCDay() : today ? (today.getUTCDay() + 1) % 7 : 1;
  /* The lines are answered nearest first - and at the same date a RED
     defect first, then one with a concession - so that where two want the
     same working home, the one that matters more gets it and the other is
     given the next. The plan comes back in its own order all the same. */
  const out = [], notices = [], taken = new Map(), requested = new Map();
  /* Where every unit is tonight, first - so that each request can know how
     many units share its road - then the requests, nearest first. */
  for (const r of dated) {
    const row = r;
    let day = date ? unitDay(row.unit, genius, date) : null;
    // placed on a later day before the departures: that is where it is
    r.placedOn = null;
    for (const k of between) { const dd = unitDay(row.unit, genius, k); if (dd) { day = dd; r.placedOn = k; } }
    /* On no working the reports know of: where the plan's own Action says
       it stands is where it is tonight, and tomorrow's departures from
       there are what can be asked for. */
    let standing = null;
    if (!day) {
      standing = placeFromAction(row.action) ||
        plan.rows.filter(o => o.unit === row.unit && o !== row).map(o => placeFromAction(o.action)).find(Boolean) || null;
      if (standing) day = { unit: row.unit, diags: [], rows: [], stops: [], splits: false, splitsAt: [], raw: [],
                            endCode: (PLACES[standing] || [])[0] || standing, endTime: null, startCode: null, startTime: null };
    }
    r.standing = standing;
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
    r.inTraffic = !!day && !standing;
    r.viaAlloc = !!(day && day.viaAlloc);
    /* how it runs today, working by working: the diagrams coupled with it
       on each, off the Detail - one unit per diagram, so a 12-car is three
       diagrams on one working */
    const legDays = r.placedOn ? daysFor(r.placedOn) : days;   // the day it was placed on, not today's
    const legs = day ? day.stops.filter(s => s.hcOut && s.dep != null)
      .map(s => ({ ...s, n: ((legDays.workings && legDays.workings.get(workingKey(s.code, s.hcOut, s.dep))) || [s.diag]).length })) : [];
    r.alone = legs.filter(l => l.n <= 1);
    r.coupled = legs.filter(l => l.n > 1);
    r.day = day;
  }
  /* multiple only on any line of a unit is multiple only on all of them:
     the one request every line carries has to keep it coupled */
  const moUnits = new Set(dated.filter(x => x.category === "MO").map(x => x.unit));
  for (const r of dated) r.mo = moUnits.has(r.unit);
  /* the units on each road tonight, by fleet: a road with more departures
     than units to put on them is offered the best few, not all */
  const roadKey = r => r.ends ? (r.standing ? homeOf(r.ends.place) : r.ends.code) + "|" + loosely(familyOfUnit(r.unit)) : null;
  const onRoad = new Map();
  for (const r of dated) { const k = roadKey(r); if (k) { if (!onRoad.has(k)) onRoad.set(k, new Set()); onRoad.get(k).add(r.unit); } }
  for (const r of dated.slice().sort(byPriority)) {
    const row = r, day = r.day;
    const k = roadKey(r);
    r.suggest = suggest(r, { mine: day, days, tomDays, tomDow, wanted, taken, mse, keep: !!opts.keep, dayToRun: !!opts.dayToRun,
                             already: requested.get(row.unit) || null, demand: k ? onRoad.get(k).size : 1 });
    if (/BERTH|C\/O|HOLD/.test(r.suggest.action) && !requested.has(row.unit)) requested.set(row.unit, r.suggest.action);
    if (r.suggest.taken) {
      const t = r.suggest.taken;
      if (!t.kind) {                                                   // a swap today: one unit off that working, once
        taken.set("D:" + t.diag + "@" + t.work, 1);                  // that diagram's unit displaced off that working
        taken.set("W:" + t.work, (taken.get("W:" + t.work) || 0) + 1);   // a request on that train
      }
      taken.set("U:" + t.work, (taken.get("U:" + t.work) || []).concat(r.unit));
      if (t.kind) {                                                    // that diagram on a unit's list, so the next unit's says so
        const g = "G:" + t.diag + "@" + t.work.split("|")[0] + "@" + t.kind;
        taken.set(g, (taken.get(g) || []).concat(r.unit));
      }
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
  /* A unit held on one line and ending elsewhere on another: the other
     line points at the hold rather than read as nothing. */
  const held = new Map();
  for (const r of out.slice().sort(byPriority))
    if (!held.has(r.unit) && /HOLD/.test(r.suggest.action)) held.set(r.unit, r.suggest.action);
  for (const r of out)
    if (held.has(r.unit) && /^(ENDS|AT) /.test(r.suggest.action) && !r.suggest.notes.some(n => /asked for on its other line/.test(n)))
      r.suggest.notes.push("asked for on its other line — " + held.get(r.unit));
  /* The berth requests have run out for an exam that is near - nothing
     ends or calls where it is wanted and nothing it could take does - so
     the exams are swapped around: another unit on the plan whose exam is
     due later and that DOES end at that depot tonight has its exam
     brought forward, and this one's put back to that slot. Never a unit
     that other maintenance wants somewhere else now, and each unit is
     swapped once. */
  const swaps = [], swapped = new Set();
  const clashes = (unit, depot) => out.some(o => o.unit === unit && o.tier === 1 && !o.ignored &&
    o.places.length && targetsOf(o).indexOf(depot) < 0);
  for (const r of out.slice().sort(byPriority)) {
    if (r.section !== "EXAMS" || r.tier !== 1 || r.ignored || !r.inTraffic) continue;
    if (!/^ENDS /.test(r.suggest.action) || swapped.has(r.unit)) continue;
    const targets = targetsOf(r);
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
  if (!r.inTraffic) return "not in traffic today" + (r.standing ? " — at " + r.standing + " per the plan" : "") + tail;
  const bits = [];
  if (r.viaAlloc) bits.push("placed by the " + (r.placedOn ? r.placedOn + " " : "") + "Allocation Summary");
  else if (r.placedOn) bits.push("placed by the " + r.placedOn + " Summary");
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
/* Why: what the plan had where the suggestion differs, the reasons the
   suggestion carries, and where the unit is today. */
function whyOf(r) {
  const s = r.suggest || { action: "", notes: [] };
  const parts = [];
  const had = String(r.action || "").trim();
  if (had && had !== s.action) parts.push("plan had: " + had);
  // where the unit stands is said once, by the facts, not again by the note
  for (const n of s.notes) if (r.inTraffic || !/^not in traffic — at /.test(n)) parts.push(n);
  const f = factsOf(r);
  if (f) parts.push(f);
  return parts.join(" · ");
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
   it was. The suggestion is written in the ACTION column - in bold where
   it differs from what the plan had - and a WHY column beside it carries
   what the plan had, the reasons, and where the unit is today. The exam
   rows keep the workbook's colours by exam type. */
const ACTION_COL = 4;
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
      headers: (SECTION_COLS[sec] || SECTION_COLS.REQUESTS).concat(["Why"]),
      rows: rows.map(r => {
        const action = (r.suggest && r.suggest.action) || r.raw[ACTION_COL] || "";
        return {
          cells: r.raw.slice(0, ACTION_COL).concat([action, whyOf(r)]),
          cls: sec === "EXAMS" ? EXAM_CLASS(r.what) : (r.ignored ? "ex-x" : "ex-a"),
          filled: !!(r.suggest && r.suggest.action) && action !== String(r.action || "").trim(),
          r,
        };
      }),
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
        const filled = i === ACTION_COL && row.filled;
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
                 tier === 2 ? "== THE NEXT THREE DAYS, and the mileage triggers ==" :
                              "== LATER: where it ends tonight ==");
    }
    lines.push(pad(r.unit, W.unit) + " " + pad(r.section, W.sec) + " " + pad(r.places.join("/") || "—", W.needs) + " " +
               pad(dueOf(r), W.due) + " " + pad(r.action, W.action) + " " + pad(r.suggest.action, W.sugg) + " " + factsOf(r));
  }
  const n = noticesText(res);
  return lines.join("\n") + (n ? "\n\n" + n : "");
}

return { run, render, shape, toText, toHtml, noticesText, parsePlan, parseDefects, faultSummary, whenOf, suggest, placeFromAction,
         detailFromPrints, PRINT_CODES, parseAllocation,
         finalWorking, requestName, terminalCalls, depotStands, swapBetween, fits, fitsLoosely, priorityOf, mergeDefects, candidatesFor, matesOn, unitDay, allDays,
         PLACES, placeOf, roadName, maxUnits, defectHome, FLEET_MOVES, movesFrom };
})();
if (typeof module !== "undefined" && module.exports) module.exports = SHEETS_BERTH;
if (typeof globalThis !== "undefined") globalThis.SHEETS_BERTH = SHEETS_BERTH;
