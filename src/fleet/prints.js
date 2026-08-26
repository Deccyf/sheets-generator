/* The diagram prints, read for the fleet's sake rather than the berth's.

   SHEETS_PRINTS opens the file and hands back the paragraphs. The berthing
   sheets then keep only what a berthing sheet needs - where a unit stands
   and in what order. Maintenance planning asks different questions, so this
   keeps the columns that one throws away: the day code, the validity dates,
   the running miles, and the activity against every line.

   Column layout of a stop line, tab separated:
     [2] location  [3] arrive  [4] depart  [5] headcode
     [6] activity  [7] running miles  [8] formation                        */
;(function(root){
"use strict";

/* Times are "05.03" for a passenger working and "05+03" for empty stock -
   the same convention the berthing sheets read. A colon is accepted too:
   the planning system does not write one, but a spreadsheet round-trip
   does, and the berthing sheets have always tolerated it. */
const TIME = /^(\d{1,2})[.+:](\d{2})$/;
function tmin(s){
  const m = TIME.exec((s || "").trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}
const isEcs = s => /\+/.test(s || "");

function num(s){
  const t = (s || "").trim();
  return t && !isNaN(Number(t)) ? Number(t) : null;
}

function parsePrints(lines){
  const out = [];
  let cur = null;
  const push = () => { if (cur && cur.rows.length) out.push(finish(cur)); };
  for (const ln of lines){
    if (ln.indexOf("Diagram:") !== -1){
      const m = /Diagram:\t(\w+)\t(\d+)\t(\S*)/.exec(ln);
      if (m){
        push();
        cur = {code: m[1], num: parseInt(m[2], 10), days: (m[3] || "").trim(),
               fleet: "", from: "", until: "", works: "",
               totalMiles: null, loadedMiles: null, emptyMiles: null, rows: []};
      }
      continue;
    }
    if (!cur) continue;
    if (ln.indexOf("Fleet:") !== -1){
      const m = /Fleet:\t([\d/]+)/.exec(ln); if (m) cur.fleet = m[1];
      continue;
    }
    if (ln.indexOf("From:") !== -1){
      const m = /From:\t(\d{2}\/\d{2}\/\d{4})/.exec(ln); if (m) cur.from = m[1];
      const u = /Until:\t(\d{2}\/\d{2}\/\d{4})/.exec(ln); if (u) cur.until = u[1];
      continue;
    }
    if (ln.indexOf("Until:") !== -1){
      const u = /Until:\t(\d{2}\/\d{2}\/\d{4})/.exec(ln); if (u) cur.until = u[1];
      continue;
    }
    if (ln.indexOf("Total miles") !== -1){
      const t = /Total miles:\t([\d.]+)/.exec(ln);
      const l = /Total miles loaded:\t([\d.]+)/.exec(ln);
      const e = /Total miles empty:\t([\d.]+)/.exec(ln);
      if (t) cur.totalMiles = Number(t[1]);
      if (l) cur.loadedMiles = Number(l[1]);
      if (e) cur.emptyMiles = Number(e[1]);
      continue;
    }
    if (ln.indexOf("Works:") !== -1){
      const m = /Works:\t(.*)/.exec(ln); if (m) cur.works = m[1].trim();
      continue;
    }
    const g = ln.split("\t");
    if (g.length < 6) continue;
    while (g.length < 9) g.push("");
    const pick = i => (g[i] || "").trim();
    const loc = pick(2);
    if (!loc) continue;
    const arr = pick(3), dep = pick(4), act = pick(6);
    /* A STABLD line carries a place and no times at all - the unit is not
       used and stands where it is. Skipping any line without a time threw
       away every diagram that never moves, which is precisely the set
       maintenance can reach. Keep it; the diagram is marked stabled below. */
    if (!arr && !dep && !act) continue;
    cur.rows.push({loc, arrRaw: arr, depRaw: dep, arr: tmin(arr), dep: tmin(dep),
                   ecs: isEcs(arr) || isEcs(dep),
                   hc: pick(5), act, miles: num(pick(7)), form: pick(8)});
  }
  push();
  return out;
}

function finish(d){
  d.key = d.code + d.num;
  /* Not used at all that day: every line is STABLD and it runs no miles. */
  d.stabled = d.rows.every(r => /STABLD/i.test(r.act)) && !(d.totalMiles > 0);
  return d;
}

/* A diagram is printed once per validity period, so the same number appears
   more than once with different From/Until dates whenever an engineering
   period splits it. Anything counted over the whole book therefore counts
   those twice - which is why every total here is measured on a date. */
function parseDMY(s){
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec((s || "").trim());
  return m ? Date.UTC(+m[3], +m[2] - 1, +m[1]) : null;
}

root.FLEET_PRINTS = {parsePrints, tmin, isEcs, parseDMY};
})(typeof globalThis !== "undefined" ? globalThis : this);
