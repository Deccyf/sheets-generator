/* What the diagram prints say about looking after the units.

   The berthing sheets answer "where is every unit tonight". This answers
   the maintenance planner's questions instead: when does a fleet come home,
   what stands still long enough to be worked on, what can carry a
   restricted unit, and where does a diagram break apart.

   Two words are worth pinning down before anything below makes sense.

   MO means two different things and both matter here.
     - On a print it is a DAY CODE: Mondays Only. That is all it says about
       the diagram, and it is read by daysOf() with the rest of them.
     - In the depot it is a RESTRICTED UNIT: one that may not run on its
       own and has to be coupled to another unit. A diagram can carry such
       a unit only if the unit is attached for every leg it works. That is
       moCapable() below, and it has nothing to do with the day code.

   HOME is the depot that owns the fleet. REPAIR depots are everywhere the
   fleet can actually be worked on, which is usually more places than one.
   Both are settings, not facts of the data - see FLEETS.                 */
;(function(root){
"use strict";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/* ---- day codes ---------------------------------------------------------
   A code names the days a diagram runs. "FSX" is the Monday-to-Thursday
   book (Fridays and Saturdays excepted; Sunday has its own). Otherwise it
   is day letters with "O" for Only - MO, WThO, MTWO. "Th" has to be read
   before "T" or Thursday becomes Tuesday followed by a stray H.          */
function daysOf(code){
  const c = (code || "").trim();
  if (c === "FSX") return ["Mon", "Tue", "Wed", "Thu"];
  if (/^F(O)?$/.test(c)) return ["Fri"];
  if (/^S(O)?$/.test(c)) return ["Sat"];
  if (/^Su/.test(c)) return ["Sun"];
  const body = c.replace(/O$/, "");
  const out = [];
  let i = 0;
  while (i < body.length){
    if (body.startsWith("Th", i)){ out.push("Thu"); i += 2; continue; }
    const ch = body[i++];
    if (ch === "M") out.push("Mon");
    else if (ch === "T") out.push("Tue");
    else if (ch === "W") out.push("Wed");
    else if (ch === "F") out.push("Fri");
    else if (ch === "S") out.push("Sat");
  }
  return out;
}
/* Spelt out, for a heading. "MO" on its own is ambiguous to a reader who
   has the other MO in mind, so it is never printed bare. */
function daysLabel(code){
  const d = daysOf(code);
  if (!d.length) return code || "?";
  if (d.length === 7) return "every day";
  if (d.length === 1) return d[0] + " only";
  const runs = [];
  let a = 0;
  for (let i = 1; i <= d.length; i++)
    if (i === d.length || DAYS.indexOf(d[i]) !== DAYS.indexOf(d[i - 1]) + 1){
      runs.push(i - a > 1 ? d[a] + "–" + d[i - 1] : d[a]);
      a = i;
    }
  return runs.join(", ");
}

/* ---- depots ------------------------------------------------------------
   "roads" are inside the depot, where a unit can be worked on. "area" adds
   the sidings and the station alongside: a unit there is at home for
   planning, but it is not standing over a pit.                           */
const DEPOTS = {
  Ramsgate:   {roads: ["Ram Depot", "RM DRW"],
               area: ["RamsNewSd", "Ram", "RM EK4985", "RM EK5145",
                      "RM EK5143", "RM EK4981"]},
  Ashford:    {roads: ["Ashfrd DS", "AshfDYWRd"],
               area: ["Ashfd EBS", "Ash Up Sd", "Ashford I"]},
  "Slade Green": {roads: ["S Gn Dep"], area: ["S Gn U Sd", "S Gn"]},
  Gillingham: {roads: ["Gill Dep"], area: ["Gill US", "Gill ReRd", "Gill"]},
  "Grove Park": {roads: ["G Pk Dep"], area: ["G Pk DnSd", "G Pk UpSd"]},
};

/* Which fleet a diagram belongs to, off its Fleet line. The diagram prefix
   will not do: SG covers both the 376s and the Metro classes. */
function fleetOf(d){
  const f = d.fleet || "";
  if (/^375/.test(f)) return "375";
  if (/^376/.test(f)) return "376";
  if (/^377/.test(f)) return "377";
  if (/^395/.test(f)) return "395";
  if (/^(465|466|707)/.test(f)) return "Metro";
  return "other";
}

/* Home and repair depots per fleet. These are the depot's arrangements,
   not something the prints state, so they are settings the tool carries
   and the user can change - a fleet moving depot must not need a new
   version of this file. */
const FLEETS = {
  "375": {label: "375", home: "Ramsgate", repair: ["Ramsgate"]},
  "376": {label: "376", home: "Gillingham",
          repair: ["Gillingham", "Ramsgate", "Slade Green"]},
  "377": {label: "377", home: "Ashford", repair: ["Ashford"], derived: true},
  "395": {label: "395", home: "Ashford", repair: ["Ashford"]},
  "Metro": {label: "465/466/707", home: "Slade Green", repair: ["Slade Green"]},
};

function depotSet(names, which){
  const s = new Set();
  for (const n of names || []){
    const d = DEPOTS[n];
    if (!d) continue;
    for (const l of d.roads) s.add(l);
    if (which === "area") for (const l of d.area) s.add(l);
  }
  return s;
}

/* ---- times -------------------------------------------------------------
   A diagram that starts at 05.00 and finishes at 00.54 finishes AFTER
   midnight, not before breakfast. Rolling the clock forward keeps the
   order of the day right; every time below is a rolled one, so 25:02
   means two minutes past one the following morning. Without this an
   overnight arrival reads as the earliest arrival of the day, and the
   morning/afternoon split comes out backwards.                           */
function roll(d){
  let prev = -1;
  const rows = d.rows.map(s => {
    const r = v => {
      if (v == null) return null;
      let x = v;
      while (x < prev - 60) x += 1440;
      if (x > prev) prev = x;
      return x;
    };
    const arr = r(s.arr), dep = r(s.dep);
    return Object.assign({}, s, {arr, dep});
  });
  return Object.assign({}, d, {rows});
}
const hm = v => v == null ? "—"
  : String(Math.floor(v / 60)).padStart(2, "0") + ":" + String(v % 60).padStart(2, "0");

/* ---- berths ------------------------------------------------------------
   A stand is written across two lines: the unit arrives on one (arrive
   filled, depart blank, often with ATTACH or DETACH against it) and leaves
   on the next. So a berth is an arrival paired with the NEXT departure,
   never a subtraction inside one line - do it inside the line and every
   mid-day stand disappears.                                              */
function berthsOf(d){
  const out = [], rows = d.rows;
  for (let i = 0; i < rows.length; i++){
    if (rows[i].arr == null) continue;
    let j = i;
    while (j < rows.length && rows[j].dep == null) j++;
    const dep = j < rows.length ? rows[j].dep : null;
    out.push({loc: rows[i].loc, from: rows[i].arr, to: dep,
              mins: dep == null ? null : dep - rows[i].arr,
              last: dep == null,
              act: rows.slice(i, j + 1).map(r => r.act).filter(Boolean).join("/")});
    i = j;
  }
  return out;
}
/* Long enough for somebody to get to the unit and do something to it. */
const ATTENDABLE = 120;

const startsAt = d => ({loc: d.rows[0].loc,
                        t: d.stabled ? null : (d.rows[0].dep ?? d.rows[0].arr)});
function endsAt(d){
  const last = d.rows[d.rows.length - 1];
  return {loc: last.loc, t: d.stabled ? null : (last.arr ?? last.dep)};
}

/* ---- coupling ----------------------------------------------------------
   A working leg is a move with a headcode. The formation column names the
   units in the train; a leg with none is a unit running on its own. A
   RESTRICTED unit - the depot's "MO" - may never do that, so it can only
   take a diagram whose every leg is formed with somebody else.           */
const legsOf = d => d.rows.filter(r => r.hc && r.dep != null);
function coupling(d){
  const L = legsOf(d);
  if (!L.length) return {legs: 0, alone: 0, moCapable: false, partners: []};
  const alone = L.filter(r => !r.form).length;
  const partners = new Set();
  for (const r of L){
    const re = /(\d+)\s*\(\d+\)/g;
    let m;
    while ((m = re.exec(r.form || "")) !== null)
      if (m[1] !== String(d.num)) partners.add(m[1]);
  }
  return {legs: L.length, alone, moCapable: alone === 0,
          partners: Array.from(partners).sort()};
}
const moCapable = d => coupling(d).moCapable;

/* Where a diagram parts company. A unit that has to stay coupled cannot be
   left behind by one of these, so the places they happen are the places a
   restriction cannot be contained. */
const SPLIT = /^(DETACH|DETTT)$/i;
const splitsOf = d => d.rows.filter(r => SPLIT.test(r.act || ""))
  .map(r => ({loc: r.loc, t: r.arr ?? r.dep}));

/* ---- which diagrams are in force, and when -----------------------------
   Counting every printed diagram counts a re-issued one twice, so
   everything is measured on a date: the diagrams valid that day, running
   that weekday. A whole week of those is one clean timetable.            */
const parseDMY = FLEET_PRINTS.parseDMY;
const dayName = ms => DAYS[(new Date(ms).getUTCDay() + 6) % 7];
function validOn(d, ms){
  const a = parseDMY(d.from), b = parseDMY(d.until);
  if (a != null && ms < a) return false;
  if (b != null && ms > b) return false;
  return true;
}
const runsOn = (d, ms) => validOn(d, ms) && daysOf(d.days).indexOf(dayName(ms)) !== -1;
const weekFrom = ms => DAYS.map((_, i) => ms + i * 86400000);
/* The middle of the period the books cover, so every diagram is in force. */
function referenceMonday(all){
  const f = [], u = [];
  for (const d of all){
    const a = parseDMY(d.from), b = parseDMY(d.until);
    if (a != null) f.push(a);
    if (b != null) u.push(b);
  }
  if (!f.length) return null;
  const mid = (Math.min.apply(null, f) + Math.max.apply(null, u.length ? u : f)) / 2;
  let ms = Math.floor(mid / 86400000) * 86400000;
  while (dayName(ms) !== "Mon") ms -= 86400000;
  return ms;
}

/* ---- mileage, per unit and per sub-fleet -------------------------------
   A diagram is worked by ONE unit, and the diagram's Total miles is the
   distance that unit covers. Two units running coupled are two diagrams,
   each carrying the whole distance - so miles per diagram IS miles per
   unit, and no allowance has to be made for the formation.

   What the depot needs is the mileage a UNIT does, not what the fleet
   racks up between them: exams fall due on a unit's clock. So each day's
   miles are divided by the diagrams in force that day, and those daily
   averages are added across a week. A unit works one diagram a day, so the
   week's figure is what one unit covers in a week, and annualising it
   gives the mileage a unit accrues in a year.

   Sub-fleet matters because they are not worked alike - within the 375s
   the /6s do a fifth more than the /3s and /9s.                          */
const WEEKS = 365.25 / 7;

function mileage(all, fleet, monday){
  const mine = all.filter(d => fleetOf(d) === fleet);
  const week = weekFrom(monday);
  const subs = Array.from(new Set(mine.map(d => d.fleet))).sort();

  const measure = (label, pick) => {
    const perDay = week.map((ms, i) => {
      const ds = mine.filter(d => pick(d) && runsOn(d, ms));
      const miles = ds.reduce((t, d) => t + (d.totalMiles || 0), 0);
      const idle = ds.filter(d => d.stabled).length;
      return {day: DAYS[i], diagrams: ds.length, idle, miles,
              perUnit: ds.length ? miles / ds.length : 0};
    });
    const weeklyPerUnit = perDay.reduce((t, x) => t + x.perUnit, 0);
    const weeklyTotal = perDay.reduce((t, x) => t + x.miles, 0);
    /* The units the PLAN needs, which is the busiest day's diagram count.
       It is not the fleet as owned - there is no spare or exam float in a
       diagram book, so the real fleet is always larger. */
    const units = perDay.reduce((m, x) => Math.max(m, x.diagrams), 0);
    return {sub: label, perDay, units,
            dailyPerUnit: weeklyPerUnit / 7, weeklyPerUnit,
            annualPerUnit: weeklyPerUnit * WEEKS,
            weeklyTotal, annualTotal: weeklyTotal * WEEKS};
  };

  return {rows: subs.map(s => measure(s, d => d.fleet === s)),
          total: measure("All " + fleet, () => true)};
}

function analyse(all, fleet, cfg){
  const c = Object.assign({}, FLEETS[fleet], cfg && cfg[fleet]);
  const monday = (cfg && cfg.monday) || referenceMonday(all);
  const mine = all.filter(d => fleetOf(d) === fleet);
  const roads = depotSet(c.repair, "roads");
  const homeRoads = depotSet([c.home], "roads");
  const homeArea = depotSet([c.home], "area");
  const atRepair = l => roads.has(l);
  const atHome = l => homeRoads.has(l);
  const inHome = l => homeArea.has(l);

  /* one weekday, so the counts read as "on a typical Monday" */
  const day = mine.filter(d => runsOn(d, monday)).map(roll);
  const work = day.filter(d => !d.stabled);
  const still = day.filter(d => d.stabled);

  /* Every arrival: the end of a diagram, plus any stand long enough to
     matter on the way. Bucketed on the rolled clock, so a diagram running
     past midnight lands in "after midnight" and not in the morning. */
  const arrivals = [];
  for (const d of work){
    const bs = berthsOf(d);
    for (const b of bs){
      if (!b.last && !(b.mins >= 60)) continue;
      arrivals.push({d, loc: b.loc, t: b.from, mins: b.mins, last: b.last,
                     start: startsAt(d)});
    }
  }
  const when = t => t == null ? "?" : t < 720 ? "AM" : t < 1440 ? "PM" : "NIGHT";
  const bucket = f => {
    const b = {AM: [], PM: [], NIGHT: []};
    for (const a of arrivals) if (f(a.loc)) (b[when(a.t)] || []).push(a);
    return b;
  };

  /* Stands a unit can be attended in: two hours or more, and not the one
     it finishes the day on. */
  const attend = [];
  for (const d of work)
    for (const b of berthsOf(d))
      if (!b.last && b.mins != null && b.mins >= ATTENDABLE)
        attend.push({d, b});
  for (const d of still)
    attend.push({d, b: {loc: d.rows[0].loc, from: null, to: null,
                        mins: null, last: true, act: "STABLD"}});

  /* Restricted units: the diagrams that never leave one on its own, and
     where a diagram has to be standing to be taken up. */
  const mo = work.map(d => ({d, c: coupling(d)}));
  const moOk = mo.filter(x => x.c.moCapable);
  const byStart = new Map();
  for (const x of mo){
    const l = startsAt(x.d).loc;
    if (!byStart.has(l)) byStart.set(l, {loc: l, n: 0, ok: 0, okD: [], badD: []});
    const r = byStart.get(l);
    r.n++;
    if (x.c.moCapable){ r.ok++; r.okD.push(x.d.key); } else r.badD.push(x.d.key);
  }
  const containment = Array.from(byStart.values()).sort((a, b) => b.n - a.n);

  /* Where diagrams actually come apart. */
  const splitAt = new Map();
  for (const d of work)
    for (const s of splitsOf(d)){
      if (!splitAt.has(s.loc)) splitAt.set(s.loc, {loc: s.loc, n: 0, ds: new Set()});
      const r = splitAt.get(s.loc);
      r.n++;
      r.ds.add(d.key);
    }

  /* Mileage over one real week, then annualised. */
  const perDay = {};
  for (const nm of DAYS) perDay[nm] = {miles: 0, diagrams: 0};
  const dupes = [];
  for (const ms of weekFrom(monday)){
    const nm = dayName(ms), seen = new Map();
    for (const d of mine){
      if (!runsOn(d, ms)) continue;
      seen.set(d.key, (seen.get(d.key) || 0) + 1);
      perDay[nm].miles += d.totalMiles || 0;
      perDay[nm].diagrams++;
    }
    for (const e of seen) if (e[1] > 1) dupes.push(nm + " " + e[0] + " ×" + e[1]);
  }
  const weekly = DAYS.reduce((t, nm) => t + perDay[nm].miles, 0);
  const miles = mileage(all, fleet, monday);

  return {
    fleet, cfg: c, monday, all: mine, day, work, still,
    arrivals, home: bucket(atHome), homeArea: bucket(inHome),
    repair: bucket(atRepair), away: bucket(l => !atRepair(l)),
    attend, mo, moOk, containment,
    splits: Array.from(splitAt.values()).sort((a, b) => b.n - a.n),
    perDay, weekly, annual: weekly * WEEKS, daily: weekly * WEEKS / 365.25,
    miles,
    dupes, atHome, inHome, atRepair,
  };
}

/* ---- does the plan close on itself? ------------------------------------
   A unit can only take up a diagram that starts where its last one
   finished. So for a fleet to run without anybody moving units about, the
   places diagrams END must match the places the next day's diagrams START.
   Where they do not, something has to be repositioned, and that is where
   a cycle breaks.                                                        */
function balance(all, fleet, ms, msNext){
  const on = t => all.filter(d => fleetOf(d) === fleet && runsOn(d, t)).map(roll);
  const today = on(ms), next = on(msNext);
  const ends = new Map(), starts = new Map();
  for (const d of today) ends.set(endsAt(d).loc, (ends.get(endsAt(d).loc) || 0) + 1);
  for (const d of next) starts.set(startsAt(d).loc, (starts.get(startsAt(d).loc) || 0) + 1);
  const locs = new Set();
  for (const k of ends.keys()) locs.add(k);
  for (const k of starts.keys()) locs.add(k);
  const rows = Array.from(locs).map(l => ({
    loc: l, ends: ends.get(l) || 0, starts: starts.get(l) || 0,
    diff: (ends.get(l) || 0) - (starts.get(l) || 0),
  })).sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff) || b.ends - a.ends);
  return {rows, moved: rows.reduce((t, r) => t + Math.max(0, r.diff), 0),
          today: today.length, next: next.length,
          matched: rows.filter(r => r.diff === 0).length, locations: rows.length};
}
/* The whole week's joins, so "cyclic or not" is answered day by day. */
function week(all, fleet, monday){
  const w = weekFrom(monday);
  return w.map((ms, i) => ({
    from: DAYS[i], to: DAYS[(i + 1) % 7],
    b: balance(all, fleet, ms, w[(i + 1) % 7]),
  }));
}

/* The same question asked of the restricted work only, which is the one that
   actually matters for an MO unit. A unit that has to stay coupled can only
   move from one MO-capable diagram to another, and only where the first
   leaves it standing. So the fleet plan closing on itself is not enough:
   the MO-capable SUBSET has to close as well, and it is a much smaller set.
   Where it does not, the unit is stranded overnight and somebody has to
   reposition it before it can work again. */
function moBalance(all, fleet, ms, msNext){
  const on = t => all.filter(d => fleetOf(d) === fleet && runsOn(d, t)).map(roll)
    .filter(d => !d.stabled && moCapable(d));
  const today = on(ms), next = on(msNext);
  const ends = new Map(), starts = new Map();
  for (const d of today) ends.set(endsAt(d).loc, (ends.get(endsAt(d).loc) || 0) + 1);
  for (const d of next) starts.set(startsAt(d).loc, (starts.get(startsAt(d).loc) || 0) + 1);
  const locs = new Set();
  for (const k of ends.keys()) locs.add(k);
  for (const k of starts.keys()) locs.add(k);
  let carries = 0, stranded = 0;
  const at = [];
  for (const l of locs){
    const e = ends.get(l) || 0, s = starts.get(l) || 0;
    carries += Math.min(e, s);
    if (e > s){ stranded += e - s; at.push({loc: l, n: e - s}); }
  }
  at.sort((a, b) => b.n - a.n);
  return {today: today.length, next: next.length, carries, stranded, at};
}
function moWeek(all, fleet, monday){
  const w = weekFrom(monday);
  return w.map((ms, i) => ({
    from: DAYS[i], to: DAYS[(i + 1) % 7],
    b: moBalance(all, fleet, ms, w[(i + 1) % 7]),
  }));
}

root.FLEET = {DAYS, DEPOTS, FLEETS, daysOf, daysLabel, fleetOf, depotSet,
              roll, hm, berthsOf, ATTENDABLE, startsAt, endsAt, legsOf,
              coupling, moCapable, splitsOf, dayName, validOn, runsOn,
              weekFrom, referenceMonday, mileage, analyse, balance, week, moBalance,
              moWeek};
})(typeof globalThis !== "undefined" ? globalThis : this);
