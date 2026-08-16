/* SHEETS_RULES — the pure part of local rule edits: the key grammar, the
   merge, and the export. No DOM, no storage, no build knowledge, so it can
   be reasoned about and tested on its own.

   An edit is one entry in an object keyed exactly as ORDER_FIX is keyed:
   an array pins the order, null switches a shipped pin off. That is the
   whole vocabulary - the tool ships a table, the operator overlays it, and
   the overlay exports as lines that can be pasted back into data.js so the
   correction stops being local. Editing anything richer than unit order is
   deliberately not offered: order is the table testers actually correct,
   and it is the one with a closed, checkable grammar. */
"use strict";
const SHEETS_RULES = (() => {
  const VERSION = 1;
  /* "SECTION HH+MM|d,d" (most specific) | "SECTION|d,d" | "d,d" (everywhere).
     Times take the sheet's own two forms - a space for a passenger working,
     a + for empty stock. */
  const KEY_RE =
    /^(?:([A-Z][A-Z0-9 .&'-]*?)(?: (\d\d[ +]\d\d))?\|)?(\d{3}(?:,\d{3})+)$/;

  function parseKey(key) {
    const m = KEY_RE.exec(String(key || ""));
    if (!m) return null;
    const diags = m[3].split(",");
    // the key's diagram list is always sorted: that is what the lookup builds
    const sorted = diags.slice().sort();
    if (diags.join(",") !== sorted.join(",")) return null;
    return { sec: m[1] || null, time: m[2] || null, diags };
  }

  /* An order must name exactly the diagrams in its own key - no more, no
     fewer, no repeats. Anything else would print a formation the key can
     never match, which is worse than no pin at all because it looks set. */
  function validEdit(key, order) {
    const k = parseKey(key);
    if (!k) return "that is not a rule key";
    if (order === null) return null;
    if (!Array.isArray(order)) return "an order is a list of diagrams, or null to switch a pin off";
    const a = order.slice().sort().join(","), b = k.diags.slice().sort().join(",");
    if (a !== b) return "the order must name exactly the diagrams in the key";
    if (new Set(order).size !== order.length) return "a diagram is listed twice";
    return null;
  }

  function mergeOrderFix(base, edits) {
    const out = {};
    for (const k of Object.keys(base || {})) out[k] = base[k];
    for (const k of Object.keys(edits || {})) {
      if (edits[k] === null) delete out[k];
      else out[k] = edits[k];
    }
    return out;
  }

  function keyForms(sec, timeText, diags) {
    const tail = diags.slice().sort().join(",");
    return { timed: sec + " " + timeText + "|" + tail,
             section: sec + "|" + tail, bare: tail };
  }

  /* Which form to write, following the mark-up sheet's rule: a formation
     that turns up more than once in the day needs its time, or the pin
     would silently reorder the other appearance too. */
  function chooseKey(forms, seenMoreThanOnce, everywhere) {
    if (everywhere) return forms.bare;
    return seenMoreThanOnce ? forms.timed : forms.section;
  }

  function parse(jsonText) {
    let o;
    try { o = JSON.parse(String(jsonText || "")); }
    catch (e) { return null; }
    if (!o || typeof o !== "object" || o.v !== VERSION) return null;
    const src = o.orderFix;
    if (!src || typeof src !== "object") return null;
    const orderFix = {};
    for (const k of Object.keys(src)) {
      // one bad entry voids the lot: a half-trusted overlay is worse than none
      if (validEdit(k, src[k])) return null;
      orderFix[k] = src[k];
    }
    return { v: VERSION, orderFix, saved: o.saved || null };
  }

  function serialize(orderFix, savedIso) {
    const keys = Object.keys(orderFix || {}).sort();
    const body = {};
    for (const k of keys) body[k] = orderFix[k];
    return JSON.stringify({ v: VERSION, saved: savedIso || null, orderFix: body },
                          null, 2);
  }

  /* Exactly the shape of an ORDER_FIX line in data.js, so the answer to a
     correction is to paste it in - the same convention the mark-up sheet
     generator already follows. */
  function dataJsLines(orderFix) {
    const out = [];
    for (const k of Object.keys(orderFix || {}).sort()) {
      const v = orderFix[k];
      if (v === null) out.push('    // remove from ORDER_FIX: "' + k + '"');
      else out.push('    "' + k + '": ["' + v.join('", "') + '"],');
    }
    return out;
  }

  function exportText(orderFix, tag) {
    const n = Object.keys(orderFix || {}).length;
    const lines = [
      "Unit order corrections" + (tag ? " from " + tag : ""),
      n + " edit" + (n === 1 ? "" : "s") + " made on the machine that built these books.",
      "",
      "Paste these into ORDER_FIX in src/data.js to make them permanent:",
      "",
    ].concat(dataJsLines(orderFix), [
      "",
      "The same edits as this page stores them:",
      "",
      serialize(orderFix, null),
    ]);
    return lines.join("\n");
  }

  return { VERSION, parseKey, validEdit, mergeOrderFix, keyForms, chooseKey,
           parse, serialize, dataJsLines, exportText };
})();
if (typeof module !== "undefined" && module.exports) module.exports = SHEETS_RULES;
if (typeof globalThis !== "undefined") globalThis.SHEETS_RULES = SHEETS_RULES;
