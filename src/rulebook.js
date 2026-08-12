/* Shared rulebook primitives used by both the Genius and the prints
   engines: the day-shape constants and the stop-collapsing walk. The
   engines keep their own field extraction — only the structure is shared. */
"use strict";
const SHEETS_RULEBOOK = (() => {
  const DAY_ROLL = 180;      // times below this have wrapped past midnight
  const AM_CUTOFF = 14 * 60; // an entry after this is an afternoon one (the
                             // prints engine keeps its own copy, since it is
                             // loaded before this module)
  const PM_BREAK = 20 * 60;  // a berth still occupied this late is the PM end
  const RUN_ROUND = 60;      // out and straight back inside this, nothing
                             // worked, is a run-round not a departure
  /* Consecutive rows at one location form one stop. Returns [i0, i1] index
     runs; isCont marks rows that continue the current run regardless of
     location (the prints' blank-location rows). */
  function runsOf(items, locOf, isCont) {
    const out = [];
    let i = 0;
    while (i < items.length) {
      const loc = locOf(items[i]);
      let j = i;
      while (j < items.length &&
             (locOf(items[j]) === loc || (isCont && isCont(items[j])))) j++;
      out.push([i, j - 1]);
      i = j;
    }
    return out;
  }
  return { DAY_ROLL, AM_CUTOFF, PM_BREAK, RUN_ROUND, runsOf };
})();
if (typeof module !== "undefined" && module.exports) module.exports = SHEETS_RULEBOOK;
if (typeof globalThis !== "undefined") globalThis.SHEETS_RULEBOOK = SHEETS_RULEBOOK;
