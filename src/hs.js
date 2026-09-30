/* SHEETS_HS — the Class 395 Allocations Sheet, in the depot's own dress.

   Not a berthing sheet. The layout is the operator's own workbook: one
   worksheet per day, a block per depot (see DEPOTS below), each
   block two tables side by side - last night's arrivals on the left, the
   day's allocations on the right - with the clean-marks and mileage key
   above and the standing house notes below.

   Everything about how it LOOKS comes from SHEETS_HS_SKIN, which is the
   workbook's own style records lifted verbatim (tools/make-hs-skin.py):
   the exact borders, fills, fonts, row heights, column widths, yellow tab,
   each depot's own colour, and the mileage key's three colours for the MG
   column - green under 400 miles, amber 400 to 700, red 700 and over. This
   file only decides what goes in which cell.

   The mileage is the strongest check that the reports are read the way the
   depot reads them: on 18/08 the sheet's MG column and the Detail export
   agree to the mile on AZ601 (951), AZ602 (828) and AZ603 (1012). */
"use strict";
const SHEETS_HS = (() => {
const X = SHEETS_XLSX;
const SKIN = SHEETS_HS_SKIN;
const { fmtTime } = SHEETS_CORE;
const { DAY_ROLL } = SHEETS_RULEBOOK;

/* The sheet's own berth vocabulary, which is not the berthing books'. Taken
   from the columns of the real sheet: ASH 2019 times against AFK 6, and RAM
   throughout for Ramsgate. Anything it does not name is passed through. */
const ENDS_CODE = { AFK: "ASH", RE: "RAM", FKE: "FAV" };
/* A berth code as the allocation sheet's ENDS columns write it. */
const endsCode = c => ENDS_CODE[String(c || "").toUpperCase()] ||
                      String(c || "").toUpperCase();

/* The depots that get a block, in the order their workbook lays them out:
   of its daily tabs, 97 run Ashford > Faversham > Ramsgate, 23 run Ashford >
   Margate > Ramsgate and 9 carry all four in this order. A depot with
   nothing to show is skipped, so a tab only ever has the blocks it needs -
   which is why Faversham being left out of this list was invisible until a
   day's reports had a Faversham departure in them and it went quietly
   missing from the sheet. */
const DEPOTS = ["ASHFORD", "FAVERSHAM", "MARGATE", "RAMSGATE"];
/* …and what each is called in the sheet's own ENDS columns, so an arrival
   can be recognised as one. Comparing a berth code against a full location
   name only ever matched Ashford, through a special case; every other
   depot's arrivals table stayed empty however many days were loaded. */
const DEPOT_CODE = { ASHFORD: "ASH", FAVERSHAM: "FAV",
                     MARGATE: "MAR", RAMSGATE: "RAM" };
const COL = l => l.charCodeAt(0) - 64;              // "B" -> 2
/* The weekday reports' day keys - the only days a Genius or Integrale pair
   ever carries. */
const DAY_NAME = { M: "Monday", T: "Tuesday", W: "Wednesday", TH: "Thursday",
                   F: "Friday", SA: "Saturday", SU: "Sunday" };
/* The weekend build hands in one day of its own, so SA and SU are here
   beside the weekday keys - a bank holiday Monday's prints come in on M
   like any other Monday. */
const DAY_ORDER = ["M", "T", "W", "TH", "F", "SA", "SU"];
const longDate = (dayKey, date) =>
  (DAY_NAME[dayKey] || "") + " " + String(date || "");
/* the same, from the date alone - a weekend's included, for Monday's arrivals */
const WEEKDAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
function dateOf(s) {
  const m = /^(\d\d)\/(\d\d)\/(\d\d)$/.exec(String(s || ""));
  return m ? new Date(Date.UTC(2000 + +m[3], +m[2] - 1, +m[1])) : null;
}
const shortDate = d => String(d.getUTCDate()).padStart(2, "0") + "/" +
  String(d.getUTCMonth() + 1).padStart(2, "0") + "/" + String(d.getUTCFullYear() % 100).padStart(2, "0");
const dayBefore = s => { const d = dateOf(s); return d ? shortDate(new Date(d.getTime() - 86400000)) : null; };
const longOfDate = s => { const d = dateOf(s); return d ? WEEKDAY[d.getUTCDay()] + " " + s : ""; };

/* ---------- the 395 network, as far as which way a 12-car faces ----------
   The sheet names the two units of a 12-car by the end each is at - FP and
   RP leaving Ashford and Faversham (the London end first), MAR and MIN at
   Ramsgate (the Margate end and the Minster end), and L or C on an arrival.
   No report says which unit that is. The Summary gives each diagram's
   position where a working starts, position 1 leading the first move; after
   that the order is carried move by move, and turned round wherever the
   train goes back out the side of a station it came in by. So every station
   the AZ diagrams use has its neighbours sorted into sides here. A move
   through a station this table does not know, or past a neighbour it does
   not list, leaves the order unknown, and the sheet leaves the end blank
   rather than guess.

   Read against the planner's own sheets for 18, 19 and 20/09 this names
   every departure end they wrote (twelve pairs) and every arrival end that
   does not pass the Faversham sidings (ten of eleven; that one is left
   blank). The one arrangement fitted to those sheets rather than known is
   the Ashford Down Yard: a through road between the depot and the station,
   joining it on the London side - of the four ways it could lie, the only
   one that agrees with all ten. */
const RAM_NORTH = ["MARGATE", "BRSR", "RAMSDRW", "RAM5143", "RAM5145", "RAMSGTD", "RAMMKEX", "RAMSUSW"];
const FAV_LONDON = ["GLNGHMK", "STNGBRN", "STROOD", "GRVSEND", "RNHM", "CHTM", "RCHT"];
const HS1_LONDON = ["EBSFLTI", "WENGTNX", "STFORDI", "STPANCI"];
const SIDES = {
  STPANCI: "TERMINUS",
  EBSFLTI: { L: ["WENGTNX", "STFORDI", "STPANCI"], C: ["ASHFKY", "GRVSEND", "ASHFDYW"] },
  WENGTNX: { L: ["STFORDI", "STPANCI"], C: ["EBSFLTI", "ASHFKY", "GRVSEND"] },
  STFORDI: { L: ["STPANCI"], C: ["WENGTNX", "EBSFLTI", "ASHFKY"] },
  ASHFKY: { L: HS1_LONDON.concat(["ASHFDYW", "ASHFDNS"]),
            C: ["CNTBW", "DOVERP", "FLKSTNC", "FLKSWST", "SWCH", "MINSTER", "RAMSGTE"] },
  // the Down Yard: a through road, the depot one side, the station and the lines on
  ASHFDYW: { D: ["ASHFDNS"], S: ["ASHFKY", "CNTBW", "DOVERP", "EBSFLTI", "WENGTNX"] },
  CNTBW: { A: ["ASHFKY", "ASHFDYW", "ASHFDNS"], M: ["MINSTER", "RAMSGTE", "RAMSGTD", "SWCH"] },
  MINSTER: { C: ["CNTBW", "ASHFKY"], R: ["RAMSGTE", "RAMSDRW", "RAMSGTD", "RAM5143", "RAM5145"],
             S: ["SWCH", "DOVERP"] },
  SWCH: { M: ["MINSTER", "RAMSGTE", "CNTBW"], D: ["DOVERP", "ASHFKY"] },
  DOVERP: { A: ["ASHFKY", "FLKSTNC"],
            R: ["RAMSGTE", "SWCH", "MINSTER", "RAMSGTD", "RAMSDRW", "RAM5143", "RAM5145"] },
  // Ramsgate is a through station: the Margate line and the depot one side, Minster the other
  RAMSGTE: { N: RAM_NORTH, W: ["MINSTER", "CNTBW", "SWCH", "DOVERP"] },
  MARGATE: { E: ["RAMSGTE", "RAMSGTD", "BRSR", "RAMMKEX", "RAMSDRW", "RAM5143", "RAM5145"],
             W: ["FAVRSHM", "HERNEBAY", "WHTSTBL"].concat(FAV_LONDON) },
  BRSR: { M: ["MARGATE", "FAVRSHM"], R: ["RAMSGTE", "RAMSGTD", "RAMSDRW"] },
  FAVRSHM: { L: FAV_LONDON, C: ["MARGATE", "DOVERP", "CNTBE", "WHTSTBL", "HERNEBAY", "RAMSGTE", "RAMSGTD"] },
  GLNGHMK: { L: ["STROOD", "GRVSEND", "RCHT", "CHTM"], C: ["FAVRSHM", "STNGBRN", "RNHM", "MARGATE"] },
  STROOD: { L: ["GRVSEND"], C: ["GLNGHMK", "RCHT", "CHTM", "FAVRSHM", "MSTONEW"] },
  GRVSEND: { L: HS1_LONDON, C: ["STROOD", "GLNGHMK", "FAVRSHM"] },
  RAMSDRW: { D: ["RAMSGTD"], S: ["RAMSGTE", "MINSTER", "DOVERP", "MARGATE"] },
  RAMMKEX: { D: ["RAMSGTD"], S: ["MARGATE", "BRSR", "RAMSGTE", "FAVRSHM"] },
  RAM5143: { D: ["RAMSGTD"], S: ["RAMSGTE", "MINSTER", "DOVERP", "MARGATE"] },
  RAM5145: { D: ["RAMSGTD"], S: ["RAMSGTE", "MINSTER", "DOVERP", "MARGATE"] },
  /* Ramsgate depot has two ways out: the Margate end, and the station end by
     the reception road - which is why its sheet speaks of a MAR end and a
     MIN end. Position 1 leaves by whichever the working takes. */
  RAMSGTD: { M: ["MARGATE", "RAMMKEX", "BRSR", "FAVRSHM"],
             S: ["RAMSDRW", "RAMSGTE", "RAM5143", "RAM5145", "RAMSUSW", "DOVERP", "MINSTER"] },
};
function sideAt(st, n) {
  const t = SIDES[st];
  if (!t || t === "TERMINUS") return null;
  for (const k of Object.keys(t)) if (t[k].indexOf(n) >= 0) return k;
  return undefined;
}
/* true, false, or "?" where the station or a neighbour is not in the table */
function reverses(prev, at, next) {
  if (!prev || !next) return false;
  if (prev === next) return true;
  const t = SIDES[at];
  if (t === "TERMINUS") return true;
  if (!t) return "?";
  const a = sideAt(at, prev), b = sideAt(at, next);
  if (a === undefined || b === undefined) return "?";
  return a === b;
}
/* The ends, by the direction of the move: [the unit leading, the other]. */
function arrivalEnds(code, from) {
  if (code === "ASHFDNS") return from === "ASHFDYW" ? ["L", "C"] : null;
  if (code === "RAMSGTD") { const s = sideAt("RAMSGTD", from); return s === "M" ? ["MIN", "MAR"] : s === "S" ? ["MAR", "MIN"] : null; }
  if (code === "FAVRSHM") { const s = sideAt("FAVRSHM", from); return s === "L" ? ["C", "L"] : s === "C" ? ["L", "C"] : null; }
  if (code === "MARGATE") { const s = sideAt("MARGATE", from); return s === "E" ? ["L", "C"] : s === "W" ? ["C", "L"] : null; }
  return null;
}
/* ...and leaving: [position 1, position 2] in the sheet's FP/RP column. */
function departureEnds(code, next) {
  if (code === "ASHFDNS") return next === "ASHFDYW" ? ["RP", "FP"] : null;
  if (code === "RAMSGTD") { const s = sideAt("RAMSGTD", next); return s === "M" ? ["MAR", "MIN"] : s === "S" ? ["MIN", "MAR"] : null; }
  if (code === "FAVRSHM") { const s = sideAt("FAVRSHM", next); return s === "L" ? ["FP", "RP"] : s === "C" ? ["RP", "FP"] : null; }
  if (code === "MARGATE") { const s = sideAt("MARGATE", next); return s === "W" ? ["FP", "RP"] : s === "E" ? ["RP", "FP"] : null; }
  return null;
}

/* ---------- one day's 395 diagrams, move by move ----------
   Every move of every diagram, grouped into trains by where and when it
   leaves and on what; for each move of each diagram, the unit it runs with
   and which of the two leads. Built once per day from the Detail's stops
   and the Summary's positions. */
function dayFacts(hsDay) {
  if (!hsDay || !hsDay.stops) return null;
  const S = hsDay.stops, rows = hsDay.rows || [];
  const moves = [];
  for (const [d, st] of S) for (let k = 0; k + 1 < st.length; k++)
    if (st[k].dep != null) moves.push({ d, k, from: st[k].code, to: st[k + 1].code, dep: st[k].dep, hc: st[k].hcOut });
  const trains = new Map();
  for (const m of moves) {
    const key = m.from + "|" + m.dep + "|" + (m.hc || "");
    if (!trains.has(key)) trains.set(key, []);
    trains.get(key).push(m);
  }
  const posAt = (d, t) => { const r = rows.find(x => x.diag === d && x.start === t); return r ? r.pos : null; };
  const mate = new Map(), lead = new Map(), state = new Map();
  for (const ms of [...trains.values()].sort((a, b) => a[0].dep - b[0].dep)) {
    if (ms.length !== 2) {
      for (const m of ms) { state.set(m.d, { mate: null, lead: true }); if (ms.length > 2) mate.set(m.d + "@" + m.k, "?"); }
      continue;
    }
    const [a, b] = ms, sa = state.get(a.d), sb = state.get(b.d), stA = S.get(a.d), stB = S.get(b.d);
    let leadA;
    if (sa && sb && sa.mate === b.d && sb.mate === a.d) {
      const rv = reverses(a.k ? stA[a.k - 1].code : null, a.from, a.to);
      leadA = sa.lead === "?" || rv === "?" ? "?" : (rv ? !sa.lead : sa.lead);
    } else {
      const pa = posAt(a.d, a.dep), pb = posAt(b.d, b.dep);
      if (pa != null && pb != null && pa !== pb) leadA = pa < pb;
      else {
        /* they meet here: the later arrival couples on, and leads only if the
           train goes back out the side it came in by */
        const arrA = a.k ? stA[a.k].arr : -1, arrB = b.k ? stB[b.k].arr : -1;
        const X = arrA >= arrB ? a : b, stX = S.get(X.d);
        const rv = reverses(X.k ? stX[X.k - 1].code : null, X.from, X.to);
        leadA = rv === "?" ? "?" : (X === a ? rv : !rv);
      }
    }
    state.set(a.d, { mate: b.d, lead: leadA });
    state.set(b.d, { mate: a.d, lead: leadA === "?" ? "?" : !leadA });
    mate.set(a.d + "@" + a.k, b.d); mate.set(b.d + "@" + b.k, a.d);
    lead.set(a.d + "@" + a.k, leadA);
    lead.set(b.d + "@" + b.k, leadA === "?" ? "?" : !leadA);
  }
  /* the unit on a diagram at the end of its day, whole - the sheet writes
     395028 where the berthing books print 028 */
  const unitAtEnd = d => {
    const rs = rows.filter(r => r.diag === d).sort((x, y) => x.start - y.start);
    for (let i = rs.length - 1; i >= 0; i--) {
      if (rs[i].units && rs[i].units.length === 1) return rs[i].units[0];
      if (rs[i].unit) return fullUnit(rs[i].unit);
    }
    return "";
  };
  return { S, mate, lead, unitAtEnd, date: hsDay.date };
}
const fullUnit = u => /^\d{3}$/.test(String(u || "")) ? "395" + u : String(u || "");
/* The end a unit arrives at, where the order is known: "L", "C", "MIN",
   "MAR" - or "" where it came in alone, and null where it was one of two
   but which one cannot be said. */
function arrivalEnd(F, d, k) {
  const st = F.S.get(d);
  if (!st || k < 1) return "";
  const key = d + "@" + (k - 1);
  const m = F.mate.get(key);
  if (!m) return "";
  if (m === "?") return null;
  const ends = arrivalEnds(st[k].code, st[k - 1].code);
  const l = F.lead.get(key);
  if (!ends || l === "?" || l == null) return null;
  return l ? ends[0] : ends[1];
}
/* N/M: this part of the diagram never runs coupled; M/O: it never runs
   alone - written the way their sheet writes both */
function multipleMark(F, d, sa, sb) {
  let shared = 0, alone = 0;
  const st = F.S.get(d);
  if (!st) return "";
  for (let k = sa; k < sb && k + 1 < st.length; k++) {
    if (st[k].dep == null) continue;
    F.mate.has(d + "@" + k) ? shared++ : alone++;
  }
  return shared + alone === 0 ? "" : shared === 0 ? "N/M" : alone === 0 ? "M/O" : "";
}
/* where the sheet writes a place in its ENDS columns */
const PLACE3 = [[/^ASHF/, "ASH"], [/^RAM/, "RAM"], [/^FAV/, "FAV"], [/^MARGATE$/, "MAR"],
                [/^STPANCI$/, "SPX"], [/^DOVERP/, "DOV"], [/^CNTBW/, "CBW"], [/^STFORDI$/, "SFA"],
                [/^EBSFLTI$/, "EBD"], [/^GRVSEND$/, "GRV"], [/^GLNGHMK$/, "GLM"], [/^STROOD$/, "SOO"]];
const place3 = code => { for (const [re, w] of PLACE3) if (re.test(code || "")) return w; return code || ""; };
/* The TRAIN ID column names the working and where THAT working goes - "5J03
   AFK" for an empty run from the depot to Ashford station, "1F11 SPX" - so
   the place is where the headcode itself stops running, in the sheet's own
   words, which are not the berthing books' (DOV, not DVP; SPX, not STP). */
const TRAIN_DEST = { ASHFKY: "AFK", ASHFDNS: "AFK", ASHFDYW: "AFK", STPANCI: "SPX", DOVERP: "DOV",
  RAMSGTE: "RAM", RAMSGTD: "RAM", RAMSDRW: "RAM", MARGATE: "MAR", FAVRSHM: "FAV", FAVRUPS: "FAV",
  CNTBW: "CBW", SWCH: "SDW", BRSR: "BSR", EBSFLTI: "EBD", STFORDI: "SFA", GRVSEND: "GRV",
  GLNGHMK: "GLM", STROOD: "SOO", MSTONEW: "MDW", MINSTER: "MSR" };
const BOOK_DEST = { DVP: "DOV", STP: "SPX" };
function trainDest(st, sa, hc, fallback) {
  if (hc && st) {
    let k = sa;
    while (k < st.length - 1 && st[k].hcOut !== hc) k++;
    if (k < st.length - 1) {
      while (k < st.length - 1 && st[k].hcOut === hc) k++;
      if (TRAIN_DEST[st[k].code]) return TRAIN_DEST[st[k].code];
    }
  }
  return BOOK_DEST[fallback] || fallback || "";
}
const DEPOT_OF = code => /^ASHF/.test(code || "") ? "ASHFORD" : /^RAM/.test(code || "") ? "RAMSGATE"
  : /^FAV/.test(code || "") ? "FAVERSHAM" : code === "MARGATE" ? "MARGATE" : null;
/* depot roads and sidings - a stand there is a berthing, not a platform stand */
const NOT_PLATFORM = /^(ASHFD|ASHFE|ASHFU|RAMSGTD|RAMSD|RAMMK|RAMSN|RAMSU|RAM5|FAVRU|FAVRB|FAV4|CNTBW\d|DOVERPS)/;
const kindOf = hc => /^[12]/.test(hc || "") ? "pax" : "ecs";
/* A part of the day that comes back into a depot and goes out again sits in
   ENDS AM when it is back before this, in ENDS PM from it. Their own sheets
   put 09+33 to 14+16 returns in ENDS AM and a 19+16 one in ENDS PM; the
   house AM/PM line at 14 00 would have put 14+12 and 14+16 wrong. Four in
   the afternoon, written as a number because the build refuses a second
   bare cut-off made of hours. */
const RETURN_PM_FROM = 960;
/* a stand long enough to be a reference on an all-day diagram */
const LONG_STAND = 90;
/* Where each block's bar goes. A unit's first move of the day, off its
   overnight berth, is above it if it leaves before this - the morning
   run-out - and everything else is below it, in time order. From their own
   tabs: on a weekday every first move up to 09:40 is above the bar, while
   5R27 at 09:54 is below it on 44 tabs and 5J25 at 10:05 on 45 of 55 (the
   planner: "the green bar for Ashford needs to go before 10 05"). The
   weekend runs out later - Saturdays up to 10:18 above, nothing below
   before 12:43; Sundays up to 08:50 - so midday there. The house AM/PM
   line at 14:00 put 10:05 above it. */
const RUN_OUT_TO = 9 * 60 + 45;
const RUN_OUT_TO_WEEKEND = 12 * 60;

/* Rough per-column widths for the on-screen preview only - the saved file
   carries the workbook's own <cols> verbatim from the skin. */
const PREVIEW_W = [8.4, 8.6, 8.4, 8.6, 8.1, 8.1, 8.4, 8.6, 8.1, 6.4, 5.6,
                   7.1, 6.3, 7.3, 8.3, 7.7, 7.9, 7.7, 8.4, 8.4];

/* Yesterday's arrivals into this depot, read off the day before's own
   entries: one row per unit whose PM berth is here, off its last stint of
   the day. The reports say what the unit LEFT on and when - the departure
   that took it there - not what it arrived on or at what time, so TRAIN ID
   and ARRIVAL TIME are left blank for the depot to fill in rather than
   printed with the departure's figures under the wrong headings. */
function arrivalsInto(depot, secs) {
  const last = new Map();      // diagram -> its latest stint into the depot
  if (!secs) return [];
  const want = DEPOT_CODE[depot] || endsCode(depot);
  const key = t => (t % 1440) < DAY_ROLL ? (t % 1440) + 1440 : (t % 1440);
  for (const [, list] of secs)
    for (const e of list)
      for (const u of e.units) {
        const pm = endsCode(u.pm || (u.ends || "").split(" ")[0]);
        if (pm !== want) continue;
        const id = (u.code || "") + u.diag;
        const prev = last.get(id);
        if (!prev || key(e.time) >= key(prev.time))
          last.set(id, { id, time: e.time, unit: u.unit || "",
                         cars: e.units.length > 1 ? "12" : "6" });
      }
  return Array.from(last.values())
    .sort((a, b) => key(a.time) - key(b.time) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map(a => ({ hc: "", at: "", unit: a.unit, cars: a.cars }));
}

/* Last night's arrivals into this depot, off that day's own Detail: every
   diagram whose day ends here, with the working it came in on, the time it
   got in, its unit, whether it came in alone or as half of a 12, and - for
   a 12 - which end it is, where the order can be followed that far. This
   is what arrivalsInto could not do from the books alone. */
function arrivalsFrom(depot, F) {
  const out = [];
  for (const [d, st] of F.S) {
    const n = st.length - 1;
    if (n < 1) continue;
    const end = st[n];
    if (DEPOT_OF(end.code) !== depot) continue;
    const t = end.arr != null ? end.arr : end.dep;
    const hc = end.hcIn || "";
    const twelve = F.mate.has(d + "@" + (n - 1));
    const e = arrivalEnd(F, d, n);
    out.push({ d, time: t, hc, unit: F.unitAtEnd(d), cars: twelve ? "12" : "6",
               at: fmtTime(t, kindOf(hc)) + (e ? " " + e : "") });
  }
  const key = t => (t % 1440) < DAY_ROLL ? (t % 1440) + 1440 : (t % 1440);
  return out.sort((a, b) => key(a.time) - key(b.time) || (a.d < b.d ? -1 : a.d > b.d ? 1 : 0));
}

/* The fleet roster for the UNIT drop-downs, built at runtime from
   first+count so no unit numbers ride in the skin. */
function rosterList() {
  const out = [];
  for (let i = 0; i < SKIN.dv.unitCount; i++) out.push(SKIN.dv.unitFirst + i);
  return out.join(",");
}

/* Which band of the mileage key a figure is in, tested in the skin's
   order (High first) so a figure on a boundary lands where Excel's own
   priority puts it. */
function mgBand(n) {
  return SKIN.mg.find(b => {
    const a = +b.f[0];
    return b.op === "greaterThanOrEqual" ? n >= a : b.op === "greaterThan" ? n > a
      : b.op === "lessThan" ? n < a : b.op === "lessThanOrEqual" ? n <= a
      : b.op === "between" ? n >= a && n <= +b.f[1] : false;
  }) || null;
}
/* A row's place in its run of n - which decides the rules over and under
   it - and the style record for that place. A record with no run variants
   (the bars, the plain G) is its own for every place. */
const runPos = (i, n) => n <= 1 ? "only" : i === 0 ? "first" : i === n - 1 ? "last" : "mid";
const ruled = (xf, pos) => (SKIN.rowRules[xf] && SKIN.rowRules[xf][pos]) || xf;

/* rows [9,10,11,13] -> "K9:K11 K13" */
function kRanges(rows) {
  const out = [];
  for (let i = 0; i < rows.length; i++) {
    let j = i;
    while (j + 1 < rows.length && rows[j + 1] === rows[j] + 1) j++;
    out.push(i === j ? "K" + rows[i] : "K" + rows[i] + ":K" + rows[j]);
    i = j;
  }
  return out.join(" ");
}

/* One day's worksheet: the legend, a block per depot with entries, and the
   standing notes, every cell naming the skin's style record. prevKey is
   the day before (its entries fill the arrivals tables) or null. */
function layoutDay(dayKey, dates, hsSecs, prevKey, hsDays) {
  const cells = [], merges = [], rowHeights = new Map(), condFmt = [];
  const comments = [];
  /* the drop-downs: per-kind cell ranges, filled in block by block */
  const dvRanges = { cet: [], fprp: [], cars: [], unit: [] };
  /* Every cell names the skin's exact style record (xf), which both the
     saved file and the on-screen preview draw it with. */
  const put = (r, c, xf, v, num) => {
    const cell = { r, c, xf, v: v === undefined || v === null ? "" : String(v),
                   sides: [null, null, null, null] };
    // a real number cell, so the MG colour rules can compare it
    if (num) cell.num = true;
    cells.push(cell);
  };
  const secs = hsSecs[dayKey];
  const prev = prevKey ? hsSecs[prevKey] : null;
  const runOutTo = dayKey === "SA" || dayKey === "SU" ? RUN_OUT_TO_WEEKEND : RUN_OUT_TO;
  const today = longDate(dayKey, dates[dayKey]);
  /* the day's own stops, and the night before's - by DATE, so Sunday's
     reports give Monday its arrivals although no Sunday tab is built */
  const F = hsDays ? dayFacts(hsDays[dates[dayKey]]) : null;
  const Fp = hsDays ? dayFacts(hsDays[dayBefore(dates[dayKey])]) : null;
  const yday = Fp ? longOfDate(Fp.date) : prevKey ? longDate(prevKey, dates[prevKey]) : "";
  /* every departure of each diagram today, in order: a part of the day that
     comes back in and goes out again names the working it goes out on */
  const departures = new Map();
  if (secs) for (const [, l] of secs) for (const e of l) for (const u of e.units) {
    const id = (u.code || "") + u.diag;
    if (!departures.has(id)) departures.set(id, []);
    departures.get(id).push({ time: e.time, hc: e.headcode || "" });
  }
  for (const l of departures.values()) l.sort((a, b) => a.time - b.time);

  // the legend block, rows 1-6, exactly as the workbook has it
  for (const [lr, c, xf, v] of SKIN.legend) put(lr, COL(c), xf, v);
  for (const [lr, h] of Object.entries(SKIN.legendHts)) rowHeights.set(+lr, +h);
  merges.push(...SKIN.legendMerges);

  let r = 7;
  let pri = 1;
  let blocks = 0;
  for (const depot of DEPOTS) {
    const list = (secs && secs.get(depot)) || [];
    let arr = Fp ? arrivalsFrom(depot, Fp) : prev ? arrivalsInto(depot, prev) : [];
    if (!list.length && !arr.length) continue;
    blocks++;

    // title row, merged across each of its two tables
    for (const [c, xf] of Object.entries(SKIN.titles[depot])) {
      const v = c === "B" ? depot + " PM ARRIVALS " +
                  (yday || "— no previous day loaded")
              : c === "H" ? depot + " UNIT ALLOCATIONS " + today : "";
      put(r, COL(c), xf, v);
    }
    merges.push("B" + r + ":F" + r, "H" + r + ":T" + r);
    r++;
    /* G: Ashford's grey strip runs down the whole block; the other depots'
       G carries WORKS against each morning allocation instead */
    const strip = depot === "ASHFORD";
    for (const [c, xf, v] of SKIN.header)
      put(r, COL(c), c === "G" && !strip ? SKIN.headG : xf, v);
    rowHeights.set(r, +SKIN.headerHt);
    r++;

    // the allocations, one row per unit, in the order they leave
    const rows = [];
    for (const e of list.slice().sort((a, b) => a.time - b.time)) {
      const pair = e.units.length === 2 && e.units.every(u => u.pos === 1 || u.pos === 2) &&
                   e.units[0].pos !== e.units[1].pos;
      const us = e.units.map(u => {
        const diag = (u.code || "") + u.diag;
        const st = F && F.S.get(diag);
        const has = !!st && u.sa != null && u.sb != null && u.sb < st.length && u.sa < u.sb;
        const row = {
          id: (e.headcode || "") + (e.dest ? " " + e.dest : ""),
          diag,
          // per WORKING, as their sheet keeps it - the day total only
          // where the stint figure is missing (a PDF-fed build)
          mg: u.mg != null ? u.mg
            : (u.miles == null ? "" : Math.round(u.miles)),
          hl: u.hl,
          time: fmtTime(e.time, e.time_kind), unit: fullUnit(u.unit),
          endsAm: "", amAt: "", endsPm: "", pmId: "", pmAt: "", works: "", nm: "", fprp: "", note: null,
          /* the morning run-out - a unit's first move of the day, off its
             overnight berth - goes above the bar. The weekend prints do not
             say which move is the first; there it is the time alone. */
          am: (e.overnight === undefined || !!e.overnight) && e.time < runOutTo,
          follows: false,
        };
        if (!has) {
          // no stops to read (a PDF build): the berth codes the books carry, as before
          row.endsAm = endsCode(u.am); row.endsPm = endsCode(u.pm);
          return row;
        }
        row.id = (e.headcode || "") + ((e.headcode || e.dest) ? " " + trainDest(st, u.sa, e.headcode, e.dest) : "");
        /* leaving as a 12: which end, off the Summary's position and the way
           the first move goes */
        if (pair) {
          const de = departureEnds(st[u.sa].code, st[u.sa + 1] && st[u.sa + 1].code);
          if (de) row.fprp = de[u.pos - 1];
        }
        /* where this part of the day ends, what it comes in on and when -
           and whether it came in as half of a 12, and which half. The last
           part of a diagram's day runs to the end of its day: a stop in a
           depot that no later row leaves from - AZ612 on 18/09 has nineteen
           minutes in Ramsgate depot on its way from Margate to Ashford - is
           not where it ends up, and their sheet does not treat it as such. */
        const later = (departures.get(diag) || []).filter(x => x.time > e.time);
        /* a later part of the day: some earlier row's WORKS names this
           working, and both are marked yellow so the pair can be found */
        row.follows = (departures.get(diag) || []).some(x => x.time < e.time);
        const sb = later.length ? u.sb : st.length - 1;
        const end = st[sb], t = end.arr != null ? end.arr : end.dep, hc = end.hcIn || "";
        const endLetter = arrivalEnd(F, diag, sb);
        if (later.length) {
          /* back into a depot and out again: a return, in ENDS AM before
             four in the afternoon and ENDS PM after, and the WORKS column
             names the working it goes out on next */
          row.works = later[0].hc;
          if (t < RETURN_PM_FROM) { row.endsAm = place3(end.code); row.amAt = fmtTime(t, kindOf(hc)); }
          else { row.endsPm = place3(end.code); row.pmId = hc; row.pmAt = fmtTime(t, kindOf(hc)) + (endLetter ? " " + endLetter : ""); }
        } else {
          row.endsPm = place3(end.code); row.pmId = hc;
          row.pmAt = fmtTime(t, kindOf(hc)) + (endLetter ? " " + endLetter : "");
          /* an all-day diagram: its first platform stand of an hour and a
             half or more goes in ENDS AM, as a reference, beside the end */
          for (let k = u.sa + 1; k < sb; k++) {
            const s = st[k];
            if (s.arr == null || s.dep == null || NOT_PLATFORM.test(s.code)) continue;
            if (s.dep - s.arr >= LONG_STAND) { row.endsAm = place3(s.code); row.amAt = fmtTime(s.arr, kindOf(s.hcIn)); break; }
          }
        }
        /* The note their sheet keeps on the DIAGRAM cell: this part of the
           day never goes via Gravesend. Their own tabs for 18, 19 and 20/09
           carry it on 77 parts of 83 and on no part that does call there;
           the other six never call there either, and were not marked. */
        row.note = st.slice(u.sa, sb + 1).some(s => s.code === "GRVSEND") ? "" : "not over high level";
        row.nm = multipleMark(F, diag, u.sa, sb);
        return row;
      });
      // the London end first leaving Ashford and Faversham, the Margate end first at Ramsgate
      const rank = x => x.fprp === "FP" || x.fprp === "MAR" ? 0 : x.fprp ? 1 : 0;
      if (us.every(x => x.fprp)) us.sort((a, b) => rank(a) - rank(b));
      // a 12 shows its train ID once, on its first line
      us.forEach((x, i) => { if (i > 0 && us.length > 1) x.id = ""; });
      rows.push(...us);
    }
    /* Their sheet splits each block with a coloured bar: the morning's
       allocations above it, everything that goes out later below - 5R27 at
       09:54 on 01/10 is under Ashford's bar, because AZ623 came in from
       Ramsgate first. Each side stays in time order. */
    const amN = rows.filter(v => v.am).length;
    rows.splice(0, rows.length, ...rows.filter(v => v.am), ...rows.filter(v => !v.am));
    /* Ramsgate's own rule, written on their sheet: an arrival is shown on
       the same line as the diagram its unit is allocated to. Where the units
       are known both sides, each arrival goes on its unit's line; the rest
       fill the lines left, in the order they got in. */
    if (depot === "RAMSGATE" && arr.some(a => a.unit) && rows.some(v => v.unit)) {
      const placed = new Array(Math.max(rows.length, arr.length)).fill(null), rest = [];
      for (const a of arr) {
        const i = a.unit ? rows.findIndex((v, j) => v.unit === a.unit && !placed[j]) : -1;
        if (i >= 0) placed[i] = a; else rest.push(a);
      }
      for (let j = 0; j < placed.length && rest.length; j++) if (!placed[j]) placed[j] = rest.shift();
      arr = placed.concat(rest);
      while (arr.length && !arr[arr.length - 1]) arr.pop();
    }
    const n = Math.max(rows.length, arr.length);
    const d0 = r;
    const mgRows = [];
    /* Each table is boxed in a bold rule with thin ones inside: the
       arrivals, run through the bar, as one box; the allocations as two,
       above the bar and below it. A row's record is the same as row 9's
       with the rules over and under set for its place in its run. */
    const bar = rows.length ? 1 : 0;
    const lines = n + bar;
    let li = 0;                                  // line of the block, the bar included
    const leftAt = () => runPos(li, lines);
    const rightAt = i => i < amN ? runPos(i, amN) : runPos(i - amN, n - amN);
    for (let i = 0; i <= n; i++) {
      /* the bar, between the last AM allocation and the first PM one - on
         every block that has allocations, with or without a PM side, as
         theirs has. The arrivals table runs on through it, ruled and empty,
         so each arrival stays level with the allocation it belongs to. */
      if (i === amN && bar) {
        for (const [c, xf] of Object.entries(SKIN.data))
          if (COL(c) < 7) put(r, COL(c), ruled(xf, leftAt()), "");
        put(r, 7, strip ? ruled(SKIN.data.G, leftAt()) : SKIN.plainG, "");
        const b = SKIN.bars[depot];
        for (let k = COL("H"); k <= COL("T"); k++)
          put(r, k, k === COL("H") ? b.H : k === COL("T") ? b.T : b.mid, "");
        merges.push("H" + r + ":T" + r);
        r++; li++;
      }
      if (i === n) break;
      const a = arr[i], v = rows[i];
      for (const [c, xf] of Object.entries(SKIN.data)) {
        if (COL(c) >= 7) continue;
        const val = c === "B" ? (a ? a.hc : "") : c === "C" ? (a ? a.at : "")
                  : c === "D" ? (a ? a.unit : "") : c === "E" ? (a ? a.cars : "")
                  : "";
        // UNIT NUMBER and 6 OR 12 CAR are numbers on their sheet too
        put(r, COL(c), ruled(xf, leftAt()), val,
            (c === "D" || c === "E") && /^\d+$/.test(String(val)));
      }
      /* WORKS against each morning allocation outside Ashford: what that
         unit forms next is filled in by hand, from what the stock
         controller can see and the reports cannot */
      if (strip) put(r, 7, ruled(SKIN.data.G, leftAt()), "");
      else if (v && i < amN) put(r, 7, ruled(SKIN.worksG.first, runPos(i, amN)), "WORKS");
      else put(r, 7, SKIN.plainG, "");
      for (const [c, xf] of Object.entries(SKIN.data)) {
        if (COL(c) < 8) continue;
        const val = !v ? ""
          : c === "H" ? v.id : c === "I" ? v.diag : c === "J" ? v.nm : c === "K" ? v.mg
          : c === "L" ? v.time : c === "M" ? v.fprp : c === "N" ? v.unit
          : c === "O" ? v.endsAm : c === "P" ? v.amAt
          : c === "Q" ? v.endsPm : c === "R" ? v.pmId : c === "S" ? v.pmAt
          : c === "T" ? v.works : "";
        const num = (c === "K" || c === "N") && val !== "" &&
                    /^\d+$/.test(String(val));
        /* their yellow marks: N/M and M/O in red; the working a unit goes
           back out on, in WORKS; and that later working's own TRAIN ID -
           both lines of a 12, as theirs has it - so each return can be
           traced from the row it comes back on to the row it leaves on */
        const mark = c === "J" && val ? SKIN.flag
          : c === "T" && /^[125][A-Z]\d\d$/.test(String(val)) ? SKIN.worksT
          : c === "H" && v && v.follows ? SKIN.laterH : xf;
        put(r, COL(c), ruled(mark, rightAt(i)), val, num);
        /* Excel paints the mileage rules over the cell when the book opens.
           The preview has to do it itself, or MG shows its base fill and the
           sheet on screen disagrees with the one in the workbook. Same
           bands, in the same order, as the conditional formatting below. */
        if (c === "K" && num) {
          const b = mgBand(Number(val));
          if (b) cells[cells.length - 1].cfCss = b.css;
          mgRows.push(r);
        }
      }
      /* The route note their sheet keeps as a comment on the DIAGRAM cell.
         Off the day's own stops, one note and only one: "not over high
         level" on a part of the day that never calls at Gravesend - which
         is also what their "avoids North Kent" means. The standing lookup
         by headcode is only for a build with no stops to read (a PDF), and
         there a stint with no Ebbsfleet-Gravesend leg gets the note too. */
      if (v && v.note != null) {
        if (v.note) comments.push({ ref: "I" + r, text: v.note });
      } else if (v) {
        const std = SKIN.hcNotes[v.id.split(" ")[0]] || [];
        const notes = v.hl === undefined ? std
          : std.filter(t => !/high level/i.test(t))
               .concat(v.hl ? [] : ["Not over high level"]);
        if (notes.length) comments.push({ ref: "I" + r, text: notes.join("\n") });
      }
      r++; li++;
    }
    /* Their sheet colours the MG column by the mileage key above it - High,
       Average and Low, dxf 0, 1 and 2 in the skin. Only the cells with a
       figure in: Excel reads an empty cell as 0, and would paint the bar
       and every blank line green. */
    if (mgRows.length)
      condFmt.push('<conditionalFormatting sqref="' + kRanges(mgRows) + '">' +
        SKIN.mg.map((b, i) =>
          '<cfRule type="cellIs" dxfId="' + i + '" priority="' + pri++ +
          '" operator="' + b.op + '">' +
          b.f.map(f => '<formula>' + f + '</formula>').join("") +
          '</cfRule>').join("") +
        '</conditionalFormatting>');
    /* the drop-downs their sheet keeps on these columns: the fleet on
       both UNIT columns, 6/12, the CET mark, and FP/RP */
    if (r > d0) {
      const span = (col) => col + d0 + ":" + col + (r - 1);
      dvRanges.unit.push(span("D"), span("N"));
      dvRanges.cars.push(span("E"));
      dvRanges.cet.push(span("F"));
      dvRanges.fprp.push(span("M"));
    }
    // the ruled strip that closes a block, then a clear row
    for (const [c, xf] of Object.entries(SKIN.gapRow)) put(r, COL(c), xf, "");
    r += 2;
  }

  // the standing house notes, re-anchored under the last block
  const base = r + 1 - 60;
  for (const [fr, c, xf, v] of SKIN.footer) put(fr + base, COL(c), xf, v);
  for (const m of SKIN.footerMerges)
    merges.push(m.replace(/(\d+)/g, d => String(+d + base)));
  r = base + 67;

  const dvDefs = [["cars", SKIN.dv.cars], ["cet", SKIN.dv.cet],
                  ["fprp", SKIN.dv.fprp], ["unit", rosterList()]]
    .filter(([k]) => dvRanges[k].length);
  const dataValidations = dvDefs.length
    ? '<dataValidations count="' + dvDefs.length + '">' +
      dvDefs.map(([k, list]) =>
        '<dataValidation type="list" allowBlank="1" showInputMessage="1"' +
        ' showErrorMessage="1" sqref="' + dvRanges[k].join(" ") + '">' +
        '<formula1>"' + list + '"</formula1></dataValidation>').join("") +
      '</dataValidations>'
    : "";
  return { cells, merges, rowHeights, maxRow: r, comments, blocks,
           opts: { stylesXml: SKIN.stylesXml, colsXml: SKIN.colsXml,
                   // the same records again, as CSS, for the preview
                   xfCss: SKIN.xfCss, previewFont: "calibri",
                   tabColor: SKIN.tabColor, condFmt, dataValidations,
                   lastCol: "T", noPageSetup: true, widths: PREVIEW_W } };
}

/* One worksheet per day the reports carry, named the way the real workbook
   names them - "Tue 18 08". */
function sheetsFor(hsSecs, labels, dates, hsDays) {
  const days = DAY_ORDER.filter(d => d in labels);
  return days.map((d, i) => {
    const lbl = String(labels[d] || "");
    const m = /^([A-Z]{3}) (\d\d)\/(\d\d)/.exec(lbl);
    const name = m
      ? m[1].charAt(0) + m[1].slice(1).toLowerCase() + " " + m[2] + " " + m[3]
      : lbl || "SHEET";
    /* last night's arrivals are the previous CALENDAR day's, where it is in
       the build - a Wednesday and a Friday built together do not make
       Wednesday the night before Friday */
    const prev = DAY_ORDER[DAY_ORDER.indexOf(d) - 1];
    return { name: name.slice(0, 31),
             layout: layoutDay(d, dates, hsSecs, i > 0 && prev && prev in labels ? prev : null, hsDays) };
    /* A day with no 395 work gets no tab. Testing for "any filled cell in
       the block rows" looked equivalent and was not: with no blocks to
       anchor it the standing footer is re-anchored right up into that range,
       so an empty day satisfied the test and shipped a tab carrying the
       legend and the house notes and nothing else. Count the blocks. */
  }).filter(s => s.layout.blocks > 0);
}
/* The whole allocations workbook as bytes, or null when no day has any
   395 work. */
function writeHsBook(hsSecs, labels, dates, zipFn, hsDays) {
  const sheets = sheetsFor(hsSecs, labels, dates, hsDays);
  return sheets.length ? X.writeWorkbook(sheets, zipFn) : null;
}

return { writeHsBook, sheetsFor, layoutDay, endsCode, arrivalsInto, arrivalsFrom, DEPOTS, mgBand,
         dayFacts, arrivalEnd, multipleMark, reverses, departureEnds, arrivalEnds, SIDES };
})();
if (typeof module !== "undefined" && module.exports) module.exports = SHEETS_HS;
if (typeof globalThis !== "undefined") globalThis.SHEETS_HS = SHEETS_HS;
