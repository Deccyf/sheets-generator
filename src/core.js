/* SHEETS core — the shared helpers and drafting rules every engine leans
   on: name normalisation, destination codes, the berth AM/PM rule.
   (The retired ACWN workbook pipeline that used to live here was removed
   in the 2.0 overhaul — see git history for tracer3/builder3.) */
"use strict";
const SHEETS_CORE = (() => {
const { DEST_TLC, BERTH_SHEETS, NON_BERTH_VISIT, SIDING_CLASS_RE } = SHEETS_DATA;
/* csvParse lives with the file readers in src/prints-read.js - it is a
   plain CSV splitter with no berthing knowledge, and both tools need it.
   Re-exported here because every caller already asks SHEETS_CORE for it. */
const { csvParse } = SHEETS_PRINTS;
/* A number -> two digits, zero-padded ("05"). */
function pad2(n) { return String(n).padStart(2, "0"); }
const LOC_STRIP_RE = /\s*\((?:via|VIA)[^)]*\)|\s*\[[^\]]*\]|\s*\(E\)/g;
function cleanLoc(name) {
  if (name === null || name === undefined) return null;
  const s = String(name).replace(LOC_STRIP_RE, "").trim();
  return s.replace(/\s+/g, " ");
}
/* A location name as the tables key it: trimmed, trailing dots dropped,
   runs of space collapsed, upper case. null and undefined stay null. */
function norm(name) {
  if (name === null || name === undefined) return null;
  const s = String(name).trim().replace(/\.+$/, "").trim();
  return s.replace(/\s+/g, " ").toUpperCase();
}
/* A sheet title without its trailing "(CRS)": "Ashford (AFK)" -> "Ashford". */
function sheetStation(title) {
  return String(title).replace(/\s*\([A-Z]{2,4}\)\s*$/, "").trim();
}
function isSiding(locNorm) {
  if (!locNorm) return false;
  if (NON_BERTH_VISIT.has(locNorm)) return false;
  return SIDING_CLASS_RE.test(locNorm);
}
function locBinfo(locNorm) {
  const k = locNorm || "";
  return Object.prototype.hasOwnProperty.call(BERTH_SHEETS, k) ? BERTH_SHEETS[k] : undefined;
}
/* A raw destination name -> the code the sheet prints: DEST_TLC first,
   then the berth table's destination column, else the first three letters
   with a "?" on the end so the guess is visible. "?" for nothing at all. */
function destTlc(destRaw) {
  if (!destRaw) return "?";
  const c = norm(cleanLoc(destRaw));
  if (Object.prototype.hasOwnProperty.call(DEST_TLC, c)) return DEST_TLC[c];
  const b = BERTH_SHEETS[c];
  if (b) return b[3];
  return (c || "?").slice(0, 3) + "?";
}
// ---------- berth AM/PM rule (ex builder3) ----------
/* An entry at or after this is an afternoon one. This is the one definition:
   the rulebook (src/rulebook.js) loads after this module and re-exports it
   from here, so both engines and this rule read the same figure. */
const AM_CUTOFF = 14 * 60;
const PM_STAY = 18 * 60;
const SHUNT_DWELL = 65;
// a unit whose day ENDS standing in a platform (not a siding) from here up
// to the AM cutoff is a "stub" - it is parked mid-morning where nothing
// berths, and the sheet flags it rather than calling the platform a berth
const STUB_FROM = 5 * 60;
// a day that ends at a real berth before this is last night's tail, so the
// berth belongs in the PM column; from here to the cutoff it is a morning
// arrival, and with no earlier berth it is the unit's AM berth
const AM_SETTLE_FROM = 6 * 60 + 30;
// a berth visit as amPm keeps it: [code, arrival, departure, final, loc]
const V_CODE = 0, V_ARR = 1, V_DEP = 2, V_FINAL = 3, V_LOC = 4;
/* Minutes -> "HH MM" for a passenger working (kind "pax") or "HH+MM" for
   anything else, wrapped onto the 24-hour clock. */
function fmtTime(mins, kind) {
  const m = ((mins % 1440) + 1440) % 1440;
  const sep = kind === "pax" ? " " : "+";
  return pad2(Math.floor(m / 60)) + sep + pad2(m % 60);
}
function visitCode(loc) {
  const b = BERTH_SHEETS[loc || ""];
  if (b) return [b[1], b[0]];
  const key = loc || "";
  const dflt = (loc || "?").slice(0, 3);
  return [Object.prototype.hasOwnProperty.call(DEST_TLC, key) ? DEST_TLC[key] : dflt, null];
}
/* One unit's day -> its AM and PM berth codes. visits: [loc, arr, dep,
   final, via] in order, loc normalised, final marking where the day ends;
   flags: the unit's flag list, handed back with "stub" added when the day
   ends somewhere that is not a berth. Returns [am, pm, flags], "" where
   there is no berth for that half of the day. A siding only counts as a
   berth after SHUNT_DWELL minutes; the PM berth is the first landing after
   the cutoff the unit keeps until PM_STAY, or failing that the first. */
function amPm(visits, flags) {
  const berthV = [];
  for (const [loc, arr, dep, final, via] of visits) {
    if (NON_BERTH_VISIT.has(loc)) continue;
    const [code] = visitCode(loc);
    if (final) berthV.push([code, arr, null, true, loc]);
    else if (isSiding(loc) && dep !== null &&
             arr !== null && dep - arr >= SHUNT_DWELL) {
      berthV.push([code, arr, dep, false, loc]);
    }
  }
  if (!berthV.length) return ["", "", flags];
  let am = "";
  for (const v of berthV) {
    if (!v[V_FINAL] && v[V_ARR] !== null && v[V_ARR] < AM_CUTOFF) { am = v[V_CODE]; break; }
  }
  // PM = first berth landing at/after the cutoff that the unit keeps
  // into the evening; short afternoon stagings it leaves again before
  // PM_STAY are skipped in favour of the true overnight berth.
  let pmV = null;
  for (const v of berthV) {
    if (v[V_ARR] !== null && v[V_ARR] >= AM_CUTOFF &&
        (v[V_DEP] === null || v[V_DEP] >= PM_STAY)) { pmV = v; break; }
  }
  if (pmV === null) {
    for (const v of berthV) {
      if (v[V_ARR] !== null && v[V_ARR] >= AM_CUTOFF) { pmV = v; break; }
    }
  }
  if (pmV !== null) return [am, pmV[V_CODE], flags];
  let settle = null;
  for (const v of berthV) { if (v[V_FINAL]) { settle = v; break; } }
  if (settle !== null) {
    const b = locBinfo(settle[V_LOC]);
    const realBerth = isSiding(settle[V_LOC]) ||
      (b !== undefined && b !== null && b[0] !== null);
    if (!realBerth) {
      if (!flags.includes("loop") && !flags.includes("brokenref")) {
        flags.push("stub");
      }
      return [am, "", flags];
    }
    if (!isSiding(settle[V_LOC]) && settle[V_ARR] !== null &&
        settle[V_ARR] >= STUB_FROM && settle[V_ARR] < AM_CUTOFF &&
        !flags.includes("loop") && !flags.includes("brokenref")) {
      flags.push("stub");
    }
    if (settle[V_ARR] !== null && settle[V_ARR] >= AM_SETTLE_FROM &&
        settle[V_ARR] < AM_CUTOFF && !am) {
      return [settle[V_CODE], "", flags];
    }
    return [am, settle[V_CODE], flags];
  }
  return [am, "", flags];
}

return { pad2, norm, sheetStation, destTlc, fmtTime, amPm, csvParse,
         AM_CUTOFF, BERTH_SHEETS };
})();
if (typeof module !== "undefined" && module.exports) module.exports = SHEETS_CORE;
if (typeof globalThis !== "undefined") globalThis.SHEETS_CORE = SHEETS_CORE;
