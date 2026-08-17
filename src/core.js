/* SHEETS core — the shared helpers and drafting rules every engine leans
   on: name normalisation, destination codes, the berth AM/PM rule.
   (The retired ACWN workbook pipeline that used to live here was removed
   in the 2.0 overhaul — see git history for tracer3/builder3.) */
"use strict";
const SHEETS_CORE = (() => {
const { DEST_TLC, BERTH_SHEETS, NON_BERTH_VISIT, SIDING_CLASS_RE } = SHEETS_DATA;
function pyStr(v) {
  if (typeof v === "number" && Number.isInteger(v)) return String(v);
  return String(v);
}
function strip(s) { return s.replace(/^\s+|\s+$/g, ""); }
function pad2(n) { return String(n).padStart(2, "0"); }
const LOC_STRIP_RE = /\s*\((?:via|VIA)[^)]*\)|\s*\[[^\]]*\]|\s*\(E\)/g;
function cleanLoc(name) {
  if (name === null || name === undefined) return null;
  const s = strip(pyStr(name).replace(LOC_STRIP_RE, ""));
  return s.replace(/\s+/g, " ");
}
function norm(name) {
  if (name === null || name === undefined) return null;
  let s = strip(strip(pyStr(name)).replace(/\.+$/, ""));
  return s.replace(/\s+/g, " ").toUpperCase();
}
function sheetStation(title) {
  return strip(pyStr(title).replace(/\s*\([A-Z]{2,4}\)\s*$/, ""));
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
function destTlc(destRaw) {
  if (!destRaw) return "?";
  const c = norm(cleanLoc(destRaw));
  if (Object.prototype.hasOwnProperty.call(DEST_TLC, c)) return DEST_TLC[c];
  const b = BERTH_SHEETS[c];
  if (b) return b[3];
  return (c || "?").slice(0, 3) + "?";
}
// ---------- berth AM/PM rule (ex builder3) ----------
const AM_CUTOFF = 14 * 60;
const PM_STAY = 18 * 60;
const SHUNT_DWELL = 65;
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
    if (!v[3] && v[1] !== null && v[1] < AM_CUTOFF) { am = v[0]; break; }
  }
  // PM = first berth landing at/after the cutoff that the unit keeps
  // into the evening; short afternoon stagings it leaves again before
  // PM_STAY are skipped in favour of the true overnight berth.
  let pmV = null;
  for (const v of berthV) {
    if (v[1] !== null && v[1] >= AM_CUTOFF &&
        (v[2] === null || v[2] >= PM_STAY)) { pmV = v; break; }
  }
  if (pmV === null) {
    for (const v of berthV) {
      if (v[1] !== null && v[1] >= AM_CUTOFF) { pmV = v; break; }
    }
  }
  if (pmV !== null) return [am, pmV[0], flags];
  let settle = null;
  for (const v of berthV) { if (v[3]) { settle = v; break; } }
  if (settle !== null) {
    const b = locBinfo(settle[4]);
    const realBerth = isSiding(settle[4]) ||
      (b !== undefined && b !== null && b[0] !== null);
    if (!realBerth) {
      if (!flags.includes("loop") && !flags.includes("brokenref")) {
        flags.push("stub");
      }
      return [am, "", flags];
    }
    if (!isSiding(settle[4]) && settle[1] !== null &&
        settle[1] >= 300 && settle[1] < 840 &&
        !flags.includes("loop") && !flags.includes("brokenref")) {
      flags.push("stub");
    }
    if (settle[1] !== null && settle[1] >= 390 && settle[1] < AM_CUTOFF &&
        !am) {
      return [settle[0], "", flags];
    }
    return [am, settle[0], flags];
  }
  return [am, "", flags];
}

/* One CSV reader for the whole tool. Both weekday report exports are CSVs,
   and so are the weekend prints when somebody has saved them out of a
   spreadsheet, so it cannot live in either engine. Quoted fields, doubled
   quotes inside them, CRLF or LF, and a leading byte-order mark. */
function csvParse(text) {
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  const rows = [];
  let row = [], field = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else q = false;
      } else field += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.length > 1 || row[0] !== "") rows.push(row);
  return rows;
}

return { strip, pyStr, pad2, cleanLoc, norm, sheetStation, isSiding,
         locBinfo, destTlc, fmtTime, amPm, csvParse,
         BERTH_SHEETS, DEST_TLC, NON_BERTH_VISIT };
})();
if (typeof module !== "undefined" && module.exports) module.exports = SHEETS_CORE;
if (typeof globalThis !== "undefined") globalThis.SHEETS_CORE = SHEETS_CORE;
