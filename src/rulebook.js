/* Shared rulebook primitives used by both the Genius and the prints
   engines: the day-shape constants and the stop-collapsing walk. The
   engines keep their own field extraction — only the structure is shared. */
"use strict";
const SHEETS_RULEBOOK = (() => {
  const DAY_ROLL = 180;      // times below this have wrapped past midnight
  /* How long a unit has to stand on a SHUNT SPUR before the stop counts
     as putting it away. A home berthing siding splits a diagram whenever
     the identity changes there, however short the sit - the books list
     every re-departure off those roads. A spur is different: it hosts
     brief working calls all day and is never listed as a re-departure,
     so under this it is a turnround. Both pipelines read it. */
  const BERTH_STAY = 65;
  // an entry at or after this is an afternoon one. Defined once, in
  // src/core.js (the berth AM/PM rule owns it, and core loads before this
  // module, so the copy can only go this way round); carried here so the
  // engines can take every day-shape constant from one place.
  const AM_CUTOFF = SHEETS_CORE.AM_CUTOFF;
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
  return { DAY_ROLL, AM_CUTOFF, PM_BREAK, RUN_ROUND, BERTH_STAY, runsOf };
})();
if (typeof module !== "undefined" && module.exports) module.exports = SHEETS_RULEBOOK;
if (typeof globalThis !== "undefined") globalThis.SHEETS_RULEBOOK = SHEETS_RULEBOOK;
