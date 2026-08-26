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
  /* "roads" is the depot proper. A reception road or a washer road is
     passed through on the way in, never berthed in, so it belongs in the
     area rather than the depot - the same call src/data.js makes by
     putting RM DRW and AshfDYWRd on its transit list. */
  Ramsgate:   {roads: ["Ram Depot"],
               area: ["RM DRW", "RamsNewSd", "Ram"]},
  Ashford:    {roads: ["Ashfrd DS"],
               area: ["AshfDYWRd", "Ashfd EBS", "Ash Up Sd", "Ashford I"]},
  "Slade Green": {roads: ["S Gn Dep"], area: ["S Gn U Sd", "S Gn"]},
  Gillingham: {roads: ["Gill Dep"], area: ["Gill US", "Gill ReRd", "Gill"]},
  "Grove Park": {roads: ["G Pk Dep"], area: ["G Pk DnSd", "G Pk UpSd"]},
  /* A depot off the network these prints cover. Selhurst is a Southern
     depot and no diagram in these books ever calls there, so looking for
     it finds nothing - and "when does the fleet come home" is the wrong
     question to ask of the plan. What the plan CAN say is when a unit is
     standing somewhere it can be handed over from. Units reach Selhurst
     off Victoria, which does appear, so that is the handover point and
     the windows are when a trip can be made. */
  Selhurst: {roads: [], area: [], offNetwork: true,
             via: [{label: "Victoria", at: ["Vic (E)", "VictGroSh"],
                    windows: [{name: "morning", by: 11 * 60},
                              {name: "evening", by: 21 * 60}]}]},
};

/* ---- what a location code actually means -------------------------------
   The prints name places in nine characters, so one station arrives as
   several codes - Ashford as five - and they read as duplication until
   they are spelt out. The names live in SHEETS_DATA.PLACE_NAMES with the
   rest of the tool's local knowledge, never in a second table here.

   A code with no name is NOT guessed at. It is shown as its station plus
   the raw code, and reported as unnamed so it can be asked about and
   added: an invented road name would read as fact.                       */
const D = SHEETS_DATA;
const stationOf = code => {
  /* The code may simply BE the station's name - Ore, Hastings, Tonbridge. */
  const exact = D.STATIONS.find(x => x[0] === code);
  if (exact) return exact[0];
  const manual = D.MANUAL_LOC[code];
  if (manual) return manual[1];
  const tlc = D.BERTH_CODE[code] || D.DEST_CODE[code];
  /* STATIONS rows are [name, CRS, on the Southeastern roster]. */
  const st = tlc && D.STATIONS.find(x => x[1] === tlc);
  if (st) return st[0];
  /* Some berth codes are not station codes at all - the Ramsgate carriage
     roads answer to "RE" - so fall back to the book section the road
     belongs to, which does name the place. */
  for (const prof of D.PROFILES)
    for (const sec of Object.keys(prof.sections))
      if (prof.sections[sec].indexOf(code) !== -1) return titled(sec);
  return null;
};
/* "DOVER PRIORY" -> "Dover Priory". The section names are shouted because
   they are headings on a berthing sheet; here they are running text. */
const titled = s => s.toLowerCase().replace(/(^|[\s(-])([a-z])/g,
  (m, a, b) => a + b.toUpperCase());
/* A siding or depot road, as against a station platform. Only these need a
   name of their own: a station code resolves to the station and is already
   as clear as it is going to get. */
const isRoad = code => {
  /* A code that IS a station name is a station, whatever else it is listed
     under - New Cross is on the transit list because units pass through it,
     not because it is a siding. */
  if (D.STATIONS.some(x => x[0] === code)) return false;
  return D.BASE_STABLING.has(code) || D.TRANSIT.has(code) ||
    /(sd|sdg|sids?|sidings?|dep|depot|shed|yard|yd|dms|ebs|rd|tr)$/i.test(code.trim());
};

/* Somewhere a unit draws up to, reverses in or waits at on its way
   somewhere else - a signal, a headshunt, a turnback, a loop. The berthing
   sheets leave these out of the books, and so must anything here that
   counts where a unit is stabled, or shunting reads as berthing. */
const isShunt = code => D.NON_BERTH_PRINTS.has(code);

/* ---- one name per place ------------------------------------------------
   The roads at a station are one place to the person reading: a unit at
   Ramsgate platform, the depot or the New Sidings is "at Ramsgate", and
   the berthing sheets already group exactly this way - their section
   tables list every road under its heading. So the group IS the section,
   read from the same tables, and the report talks in groups everywhere
   with the road kept to a hover.

   The one carve-out is the depot's own: Faversham Back Road is spoken of
   apart from Faversham, so it stays its own place.                       */
const GROUP_APART = {"Fav Bk Rd": "Faversham Back Road"};
const groupCache = new Map();
function groupOf(code){
  if (groupCache.has(code)) return groupCache.get(code);
  let g = GROUP_APART[code];
  if (!g){
    for (const prof of D.PROFILES){
      for (const sec of Object.keys(prof.sections))
        if (prof.sections[sec].indexOf(code) !== -1){ g = titled(sec); break; }
      if (g) break;
    }
  }
  if (!g){
    const p = placeName(code);
    g = p.station || p.name || code;
  }
  groupCache.set(code, g);
  return g;
}

function placeName(code){
  const explicit = D.PLACE_NAMES[code];
  const st = stationOf(code);
  const shunt = isShunt(code);
  if (explicit){
    /* A code ending in a number is a signal - the commonest of these. */
    const kind = /signal/i.test(explicit) ? "signal"
      : shunt ? "shunt"
      : isRoad(code) ? "road" : "station";
    return {code, name: explicit, station: st, kind, shunt, named: true};
  }
  if (shunt)
    return {code, name: st ? st + " — " + code : code, station: st,
            kind: "shunt", shunt: true, named: false};
  if (isRoad(code))
    return {code, name: st ? st + " — " + code : code, station: st,
            kind: "road", shunt: false, named: false};
  /* An ordinary station: the code is short for the name and nothing more. */
  return {code, name: st || code, station: st, kind: "station",
          shunt: false, named: !!st};
}
/* Every place a set of diagrams touches, with how often, so the unnamed
   ones can be seen rather than hunted for. */
function places(ds){
  const seen = new Map();
  for (const d of ds)
    for (const r of d.rows){
      if (!seen.has(r.loc)) seen.set(r.loc, Object.assign(placeName(r.loc), {n: 0}));
      seen.get(r.loc).n++;
    }
  return Array.from(seen.values()).sort((a, b) => b.n - a.n);
}

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
  "377": {label: "377", home: "Selhurst", repair: ["Selhurst"]},
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

/* ---- getting units to a depot the prints never mention -----------------
   When the home depot is off this network the plan cannot say when a unit
   comes home, because it never does - it is handed over somewhere. What
   the plan CAN say is when a unit is standing at the handover point early
   enough for a trip to be made.

   Two kinds of chance, and the difference matters:
     - a FINISHER has done its work for the day, so taking it costs
       nothing;
     - a STAND is a unit parked mid-diagram. It is there and it is idle,
       but taking it leaves the rest of that diagram to be covered.
   They are never added together.                                         */
function deliveries(work, home, windows){
  const def = DEPOTS[home];
  if (!def || !def.offNetwork || !def.via) return null;
  const wins = windows || def.via[0].windows;
  /* A window is everything up to its cut-off that a later one has not
     already claimed, so they are read in order. */
  const bucket = t => {
    if (t == null) return null;
    for (const w of wins) if (t < w.by) return w.name;
    return null;
  };
  return def.via.map(v => {
    const at = new Set(v.at);
    const chances = [];
    for (const d of work)
      for (const b of berthsOf(d)){
        if (!at.has(b.loc)) continue;
        const win = bucket(b.from);
        if (!win) continue;
        if (b.last) chances.push({d, b, kind: "finisher", win});
        else if (b.mins != null && b.mins >= ATTENDABLE)
          chances.push({d, b, kind: "stand", win});
      }
    chances.sort((a, b) => a.b.from - b.b.from);
    const by = {};
    for (const w of wins) by[w.name] = {finisher: [], stand: []};
    for (const c of chances) by[c.win][c.kind].push(c);
    /* Everything that reaches the handover point too late to be any use -
       the count that says whether the windows are the binding constraint. */
    const missed = [];
    for (const d of work)
      for (const b of berthsOf(d))
        if (at.has(b.loc) && b.last && bucket(b.from) == null)
          missed.push({d, b});
    missed.sort((a, b) => a.b.from - b.b.from);
    return {label: v.label, at: v.at, windows: wins, chances, by, missed};
  });
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
  /* Home and repair are judged at the GROUP: a unit at Ramsgate platform,
     the depot or the New Sidings is at Ramsgate. */
  const repairGroups = new Set(c.repair);
  const atRepair = l => repairGroups.has(groupOf(l));
  const inHome = l => groupOf(l) === c.home;
  const atHome = inHome;
  const roads = depotSet(c.repair, "roads");

  /* one weekday, so the counts read as "on a typical Monday" */
  const day = mine.filter(d => runsOn(d, monday)).map(roll);
  const work = day.filter(d => !d.stabled);
  const still = day.filter(d => d.stabled);

  /* An arrival is the END of a diagram and nothing else. A unit that
     calls somewhere and goes out again the same day has not arrived - it
     is passing through, however long it stands - so mid-day berths are no
     part of this. They still feed the attendable stands below, which is
     where a window belongs. Bucketed on the rolled clock, so a diagram
     running past midnight lands in "after midnight", not the morning. */
  const arrivals = work.map(d => {
    const e = endsAt(d);
    return {d, loc: e.loc, t: e.t, last: true, start: startsAt(d)};
  });
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
      if (!b.last && b.mins != null && b.mins >= ATTENDABLE && !isShunt(b.loc))
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
    const l = groupOf(startsAt(x.d).loc);
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
      const g = groupOf(s.loc);
      if (!splitAt.has(g)) splitAt.set(g, {loc: g, n: 0, ds: new Set()});
      const r = splitAt.get(g);
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
  const deliver = deliveries(work, c.home, c.windows);
  /* Where a unit has to reach to be worked on - the home GROUP, or for a
     depot off this network the handover point, which is as far as the
     plan can take a unit. */
  const target = a0offNetwork(c)
    ? new Set((deliver || []).reduce((t, v) =>
        t.concat(v.at.map(groupOf)), []))
    : new Set([c.home]);
  const back = daysHome(all, fleet, monday, target);

  return {
    fleet, cfg: c, monday, all: mine, day, work, still,
    arrivals, home: bucket(atHome), homeArea: bucket(inHome),
    repair: bucket(atRepair), away: bucket(l => !atRepair(l)),
    attend, mo, moOk, containment,
    splits: Array.from(splitAt.values()).sort((a, b) => b.n - a.n),
    perDay, weekly, annual: weekly * WEEKS, daily: weekly * WEEKS / 365.25,
    miles, deliver, back, target,
    offNetwork: !!(DEPOTS[c.home] || {}).offNetwork,
    places: places(day),
    dupes, atHome, inHome, atRepair,
  };
}

/* ---- how long back to the depot? ---------------------------------------
   The question a maintenance planner actually asks: a unit is standing at
   West Marina - how many days before the diagrams put it back at Ramsgate
   for its exam?

   A unit can only take a diagram that STARTS where it is standing, and a
   diagram occupies a day. So the plan is a graph: each place is a node,
   each diagram an edge from where it starts to where it ends, costing one
   day. Standing still is an edge too - it costs a day and moves nothing,
   which is what happens when nothing starts from that place that day.

   The set of diagrams differs by weekday, so the walk is over (place, day
   of week) rather than place alone: leaving Tonbridge on a Sunday is not
   the same problem as leaving it on a Tuesday. The week repeats, so the
   day wraps at seven.

   A unit counts as home when a diagram ENDS at a repair depot - that is
   when it is handed over. A diagram that merely calls there mid-day takes
   the unit away again, and counting it would repeat the mistake the
   arrivals section had.                                                  */
const REACH_CAP = 14;          // a fortnight is already a failed answer
const a0offNetwork = c => !!(DEPOTS[c.home] || {}).offNetwork;

function daysHome(all, fleet, monday, target){
  const w = weekFrom(monday);
  /* what leaves each place on each day, and what is LEFT at each place */
  const byDay = w.map(ms => {
    const m = new Map();
    for (const d of all){
      if (fleetOf(d) !== fleet || !runsOn(d, ms) || d.stabled) continue;
      const r = roll(d);
      const from = groupOf(startsAt(r).loc), to = groupOf(endsAt(r).loc);
      if (!m.has(from)) m.set(from, []);
      m.get(from).push({key: r.key, to});
    }
    return m;
  });
  /* The day a diagram ENDS somewhere is the night the unit stands there, so
     it is available to be taken up the NEXT day. Asking "how long from
     Tonbridge starting Monday" is a fair question but not the real one:
     the plan only ever leaves a unit at Tonbridge on a Saturday, and the
     answer from a Monday - eight days of standing about - describes a
     situation that never arises. */
  const leftOn = new Map();
  w.forEach((ms, i) => {
    for (const d of all){
      if (fleetOf(d) !== fleet || !runsOn(d, ms) || d.stabled) continue;
      const to = groupOf(endsAt(roll(d)).loc);
      if (!leftOn.has(to)) leftOn.set(to, new Set());
      leftOn.get(to).add(i);
    }
  });

  const locs = new Set();
  for (const m of byDay)
    for (const e of m){ locs.add(e[0]); for (const x of e[1]) locs.add(x.to); }

  const walk = (start, day0) => {
    if (target.has(start)) return {days: 0, path: []};
    const seen = new Set([start + "|" + day0]);
    let q = [{loc: start, day: day0, n: 0, path: []}];
    while (q.length){
      const cur = q.shift();
      if (cur.n >= REACH_CAP) continue;
      for (const o of byDay[cur.day].get(cur.loc) || []){
        const path = cur.path.concat([{day: DAYS[cur.day], key: o.key, to: o.to}]);
        if (target.has(o.to)) return {days: cur.n + 1, path};
        const k = o.to + "|" + ((cur.day + 1) % 7);
        if (seen.has(k)) continue;
        seen.add(k);
        q.push({loc: o.to, day: (cur.day + 1) % 7, n: cur.n + 1, path});
      }
      /* nothing taken: the unit is still there tomorrow */
      const k = cur.loc + "|" + ((cur.day + 1) % 7);
      if (!seen.has(k)){
        seen.add(k);
        q.push({loc: cur.loc, day: (cur.day + 1) % 7, n: cur.n + 1,
                path: cur.path.concat([{day: DAYS[cur.day], key: null, to: cur.loc}])});
      }
    }
    return null;
  };

  return Array.from(locs).sort().map(loc => {
    /* the days a unit is actually standing here: the morning after it was
       left, for every night the plan leaves one */
    const nights = Array.from(leftOn.get(loc) || []).sort();
    const mornings = nights.map(i => (i + 1) % 7);
    const from = (mornings.length ? mornings : DAYS.map((_, i) => i))
      .map(i => ({day: i, r: walk(loc, i)}));
    const got = from.filter(x => x.r).map(x => x.r.days);
    const best = got.length ? Math.min.apply(null, got) : null;
    const pick = from.filter(x => x.r).sort((a, b) => a.r.days - b.r.days)[0];
    return {
      loc,
      /* the nights the plan leaves a unit here, spelt out */
      leftOn: nights.map(i => DAYS[i]),
      everLeft: nights.length > 0,
      days: best,
      worst: got.length ? Math.max.apply(null, got) : null,
      path: pick ? pick.r.path : null,
      startDay: pick ? DAYS[pick.day] : null,
      stuck: pick && pick.r.path.length > 0 && pick.r.path[0].key === null,
      never: got.length === 0,
    };
  }).sort((a, b) => (b.days == null ? 99 : b.days) - (a.days == null ? 99 : a.days) ||
                    (a.loc < b.loc ? -1 : 1));
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
              placeName, places, isShunt, groupOf,
              roll, hm, berthsOf, ATTENDABLE, startsAt, endsAt, legsOf,
              coupling, moCapable, splitsOf, dayName, validOn, runsOn,
              weekFrom, referenceMonday, mileage, deliveries, daysHome, analyse,
              balance, week,
              moBalance, moWeek};
})(typeof globalThis !== "undefined" ? globalThis : this);
