/* The seven questions, answered once and rendered twice.

   Everything the page shows and everything the workbook exports comes from
   here, so the spreadsheet cannot drift away from the screen.            */
;(function(root){
"use strict";
const F = FLEET;

const n0 = x => Math.round(x).toLocaleString("en-GB");
const one = x => (Math.round(x * 10) / 10).toLocaleString("en-GB");
const pct = (a, b) => b ? Math.round(a * 100 / b) + "%" : "—";
/* Rolled past midnight: 25:02 is two minutes past one the next morning,
   and saying so is the whole point - see roll() in fleet.js. */
const hm = F.hm;
/* The prints abbreviate; a sentence should not. */
const LONG = {Mon:"Monday", Tue:"Tuesday", Wed:"Wednesday", Thu:"Thursday",
              Fri:"Friday", Sat:"Saturday", Sun:"Sunday"};
const longDay = ms => LONG[F.dayName(ms)] || F.dayName(ms);

/* AM before noon, PM up to midnight, then the small hours of the next day.
   Kept as one definition because every section leans on it. */
function bucketLabel(t){
  return t == null ? "—" : t < 720 ? "AM" : t < 1440 ? "PM" : "after midnight";
}

function build(all, fleet, cfg){
  const a = F.analyse(all, fleet, cfg);
  const c = a.cfg;
  const secs = [];
  const startOf = d => F.startsAt(d), endOf = d => F.endsAt(d);

  /* ---- 1. home depot arrivals, AM and PM ---- */
  const arrRows = [];
  for (const k of ["AM", "PM", "NIGHT"])
    for (const x of a.home[k])
      arrRows.push([x.d.key, F.daysLabel(x.d.days), bucketLabel(x.t), hm(x.t),
                    x.loc, x.last ? "stays overnight" : "stands " + hm(x.mins).replace(":", "h"),
                    startOf(x.d).loc, hm(startOf(x.d).t)]);
  secs.push({
    id: "arrivals",
    tab: "Arrivals home",
    title: "Arrivals into " + c.home,
    lede: `On a ${longDay(a.monday)} the ${c.label} has ${a.day.length} diagrams. ` +
      `${a.home.AM.length} put a unit into ${c.home} in the morning, ` +
      `${a.home.PM.length} in the afternoon or evening, and ` +
      `${a.home.NIGHT.length} after midnight. ` +
      `${a.away.AM.length + a.away.PM.length + a.away.NIGHT.length} stands are nowhere ` +
      `near a depot that can repair this fleet.`,
    stat: [["Into " + c.home + " — AM", a.home.AM.length],
           ["Into " + c.home + " — PM", a.home.PM.length],
           ["Into " + c.home + " — after midnight", a.home.NIGHT.length],
           ["Into any repair depot",
            a.repair.AM.length + a.repair.PM.length + a.repair.NIGHT.length],
           ["Away from any repair depot",
            a.away.AM.length + a.away.PM.length + a.away.NIGHT.length]],
    head: ["Diagram", "Days", "AM/PM", "Arrives", "Where", "Then", "Started at", "Started"],
    rows: arrRows,
  });

  /* ---- 2. the early evening arrivals, and where they came from ---- */
  const early = a.arrivals
    .filter(x => a.inHome(x.loc) && x.t != null && x.t >= 720 && x.t < 1200)
    .sort((p, q) => p.t - q.t);
  secs.push({
    id: "early",
    tab: "Home before 8pm",
    title: "Home before 20:00",
    lede: early.length
      ? `${early.length} diagram${early.length === 1 ? "" : "s"} bring a unit into the ` +
        `${c.home} area between noon and 20:00 — the window where a unit is back ` +
        `early enough to be worked on the same evening.`
      : `Nothing reaches the ${c.home} area between noon and 20:00. The fleet is ` +
        `out until the evening peak has finished.`,
    head: ["Diagram", "Days", "Arrives", "Where", "Started at", "Started", "Miles"],
    rows: early.map(x => [x.d.key, F.daysLabel(x.d.days), hm(x.t), x.loc,
                          startOf(x.d).loc, hm(startOf(x.d).t), x.d.totalMiles || 0]),
  });

  /* ---- 3. diagrams a restricted unit can take ---- */
  /* The fleet plan closing on itself is not the same as the RESTRICTED work
     closing on itself, and it is the second one an MO unit lives by. */
  const moWk = F.moWeek(all, fleet, a.monday);
  const worstNight = moWk.every(x => x.b.stranded > 0);
  const okRows = a.moOk.map(x => {
    const s = startOf(x.d), e = endOf(x.d);
    return [x.d.key, F.daysLabel(x.d.days), x.c.legs, x.c.partners.join(" "),
            s.loc, hm(s.t), e.loc, hm(e.t), x.d.totalMiles || 0];
  }).sort((p, q) => p[4] < q[4] ? -1 : p[4] > q[4] ? 1 : 0);
  secs.push({
    id: "mo",
    tab: "Restricted units",
    title: "Diagrams a restricted unit can work",
    lede: `A restricted unit — the depot's <b>MO</b> — may not run on its own, so it ` +
      `can only take a diagram that is coupled for every leg. ` +
      `<b>${a.moOk.length} of ${a.work.length}</b> (${pct(a.moOk.length, a.work.length)}) ` +
      `qualify. The rest run alone at some point in the day. ` +
      (moWk[0].b.stranded
        ? `This work does <b>not</b> close on itself overnight: on a ` +
          `${longDay(a.monday)} night ${moWk[0].b.carries} of ${moWk[0].b.today} ` +
          `finish where another can be picked up and <b>${moWk[0].b.stranded} do ` +
          `not</b>, so a restricted unit on one of those has to be repositioned ` +
          `before it can work again. `
        : `The work closes on itself overnight, so a restricted unit can stay ` +
          `on it without being moved. `) +
      `<span class="aside">This is nothing to do with <b>MO</b> as a day code on the ` +
      `print, which means Mondays Only.</span>`,
    stat: [["Coupled every leg", a.moOk.length],
           ["Run alone at some point", a.work.length - a.moOk.length],
           ["Of the working diagrams", a.work.length],
           ["Carry over to the next day", moWk[0].b.carries],
           ["Stranded overnight", moWk[0].b.stranded]],
    head: ["Diagram", "Days", "Legs", "Runs with", "Starts at", "Starts",
           "Ends at", "Ends", "Miles"],
    rows: okRows,
    detail: [{
      tab: "MO night by night",
      title: "Can a restricted unit stay on this work overnight? — " +
        (worstNight
          ? "no, it is stranded on every join"
          : "yes, every night carries over"),
      head: ["Join", "MO diagrams today", "MO diagrams tomorrow",
             "Carry over in place", "Stranded", "Left standing at"],
      rows: moWk.map(x => [x.from + " \u2192 " + x.to, x.b.today, x.b.next,
        x.b.carries, x.b.stranded,
        x.b.at.slice(0, 6).map(y => y.loc + " +" + y.n).join(", ")]),
    }],
  });

  /* ---- 4. does the plan close on itself? ---- */
  const wk = F.week(all, fleet, a.monday);
  const clean = wk.filter(x => x.b.moved === 0).length;
  secs.push({
    id: "cycle",
    tab: "Week joins",
    title: "Does the week close on itself?",
    lede: `A unit can only take up a diagram that starts where its last one ` +
      `finished. Where the places diagrams END do not match the places the next ` +
      `day's diagrams START, somebody has to move a unit. ` +
      (clean === 7
        ? `Every join balances: the ${c.label} plan is self-contained all week.`
        : `${clean} of the 7 joins balance` +
          (wk.slice(0, 4).every(x => x.b.moved === 0)
            ? `, and the four weekday joins are among them — the plan runs itself ` +
              `Monday to Thursday and only breaks over the weekend.` : `.`)),
    head: ["Join", "Diagrams today", "Diagrams tomorrow", "Places that match",
           "Places", "Units to move"],
    rows: wk.map(x => [x.from + " → " + x.to, x.b.today, x.b.next,
                       x.b.matched, x.b.locations, x.b.moved]),
    detail: wk.filter(x => x.b.moved > 0).map(x => ({
      tab: "Move " + x.from + "-" + x.to,
      title: x.from + " → " + x.to + ": " + x.b.moved + " to move",
      head: ["Place", "Ends there", "Starts there", "Spare (+) / short (−)"],
      rows: x.b.rows.filter(r => r.diff !== 0)
        .map(r => [r.loc, r.ends, r.starts, r.diff > 0 ? "+" + r.diff : r.diff]),
    })),
  });

  /* ---- 5. mileage ---- */
  /* What a UNIT does, not what the fleet racks up between them: exams fall
     due on a unit's clock. Split by sub-fleet, because they are not worked
     alike - see mileage() in fleet.js for why miles per diagram is miles
     per unit. */
  const M = a.miles;
  const mRow = r => [r.sub, r.units, Math.round(r.dailyPerUnit),
                     Math.round(r.weeklyPerUnit), Math.round(r.annualPerUnit),
                     Math.round(r.annualTotal)];
  const spread = M.rows.length > 1
    ? M.rows.slice().sort((x, y) => y.annualPerUnit - x.annualPerUnit) : [];
  secs.push({
    id: "miles",
    tab: "Mileage",
    title: "Mileage per unit",
    lede: `A diagram is worked by one unit and its <em>Total miles</em> is the ` +
      `distance that unit covers — two units coupled are two diagrams, each ` +
      `carrying the whole distance — so miles per diagram is miles per unit. ` +
      `Each day's miles are divided by the diagrams in force that day and the ` +
      `daily averages added across a week, which is what one unit covers in a ` +
      `week. On these diagrams a ${c.label} unit averages ` +
      `<b>${n0(M.total.dailyPerUnit)} miles a day</b> and ` +
      `<b>${n0(M.total.annualPerUnit)} a year</b>.` +
      (spread.length > 1
        ? ` The sub-fleets are not worked alike: a <b>${spread[0].sub}</b> covers ` +
          `${n0(spread[0].annualPerUnit)} a year against ` +
          `${n0(spread[spread.length - 1].annualPerUnit)} for a ` +
          `<b>${spread[spread.length - 1].sub}</b>.` : "") +
      `<span class="aside">Units is what the <em>plan</em> needs on its busiest ` +
      `day. A diagram book carries no spare or exam float, so the fleet as owned ` +
      `is always larger — and the per-unit mileage correspondingly lower.</span>`,
    stat: [["Miles per unit per day", n0(M.total.dailyPerUnit)],
           ["Miles per unit per year", n0(M.total.annualPerUnit)],
           ["Units the plan needs", M.total.units],
           ["Whole fleet per year", n0(M.total.annualTotal)]],
    head: ["Sub-fleet", "Units", "Per unit / day", "Per unit / week",
           "Per unit / year", "Sub-fleet / year"],
    rows: M.rows.map(mRow).concat(M.rows.length > 1 ? [mRow(M.total)] : []),
    detail: [{
      tab: "Mileage by day",
      title: "Day by day, per sub-fleet",
      head: ["Sub-fleet", "Day", "Diagrams", "Standing all day", "Miles",
             "Miles per unit"],
      rows: M.rows.concat(M.rows.length > 1 ? [M.total] : []).reduce((out, r) => {
        for (const d of r.perDay)
          out.push([r.sub, d.day, d.diagrams, d.idle, Math.round(d.miles),
                    Math.round(d.perUnit)]);
        return out;
      }, []),
    }].concat(a.dupes.length ? [{
      tab: "Mileage duplicates",
      title: "Counted more than once on the reference week — check these",
      head: ["Duplicate"],
      rows: a.dupes.map(x => [x]),
    }] : []),
  });

  /* ---- 6. stands long enough to be attended ---- */
  const byLoc = new Map();
  for (const x of a.attend){
    if (!byLoc.has(x.b.loc)) byLoc.set(x.b.loc, []);
    byLoc.get(x.b.loc).push(x);
  }
  const standRows = Array.from(byLoc.entries())
    .map(([loc, xs]) => {
      const mins = xs.map(x => x.b.mins).filter(m => m != null).sort((p, q) => p - q);
      const am = xs.filter(x => x.b.from != null && x.b.from < 720).length;
      return [loc, xs.length, am, xs.length - am,
              mins.length ? hm(mins[Math.floor(mins.length / 2)]).replace(":", "h") : "all day",
              a.atRepair(loc) ? "repair depot" : a.inHome(loc) ? "home area" : "outstation",
              xs.slice(0, 8).map(x => x.d.key).join(" ")];
    })
    .sort((p, q) => q[1] - p[1]);
  const amStands = a.attend.filter(x => x.b.from != null && x.b.from < 720).length;
  secs.push({
    id: "stands",
    tab: "Attendable stands",
    title: "Where a unit stands long enough to be attended",
    lede: `Stands of ${F.ATTENDABLE / 60} hours or more that are not the overnight one, ` +
      `plus any diagram that stands still all day. These are what a mobile engineer or ` +
      `a toilet fitter can actually reach. ${a.attend.length} on a ` +
      `${F.dayName(a.monday)}, ${amStands} of them starting before noon.`,
    head: ["Place", "Stands", "Starting AM", "Starting PM", "Median stand",
           "Kind", "Diagrams"],
    rows: standRows,
  });

  /* ---- 7. where a restriction cannot be contained ---- */
  const contRows = a.containment.map(r => [
    r.loc, r.n, r.ok, r.n - r.ok,
    r.ok === 0 ? "NO — everything out of here runs alone at some point"
      : r.ok === r.n ? "yes, every diagram" : "some",
    r.okD.slice(0, 8).join(" "),
  ]);
  const none = a.containment.filter(r => r.ok === 0);
  secs.push({
    id: "contain",
    tab: "Cannot contain",
    title: "Where a restricted unit cannot be contained",
    lede: `A restricted unit standing at one of these has no diagram it can take: ` +
      `every diagram starting there leaves it on its own at some point, so the ` +
      `restriction cannot be contained from there and the unit has to be moved ` +
      `before it can work. ` +
      (none.length
        ? `<b>${none.length} of ${a.containment.length}</b> starting points are like ` +
          `this: ${none.map(r => r.loc).join(", ")}.`
        : `Every starting point has at least one diagram that stays coupled.`),
    head: ["Starts here", "Diagrams", "Stay coupled", "Run alone",
           "Can a restricted unit work from here?", "Which diagrams"],
    rows: contRows,
    extra: {
      tab: "Split locations",
      title: "Where diagrams actually come apart",
      head: ["Place", "Splits", "Diagrams", "Kind"],
      rows: a.splits.map(s => [s.loc, s.n, s.ds.size,
        a.atRepair(s.loc) ? "repair depot" : a.inHome(s.loc) ? "home area" : "outstation"]),
    },
  });

  return {fleet, cfg: c, a, secs, monday: a.monday};
}

/* The workbook: a tab per question, plus one row per diagram overall. */
function sheets(rep){
  /* Excel truncates a tab name at 31 characters, so each section carries a
     short one of its own rather than losing the end of its heading. */
  const out = rep.secs.map(s => ({name: s.tab, rows: [s.head].concat(s.rows)}));
  for (const s of rep.secs){
    if (s.extra) out.push({name: s.extra.tab,
                           rows: [s.extra.head].concat(s.extra.rows)});
    for (const d of s.detail || [])
      out.push({name: d.tab, rows: [d.head].concat(d.rows)});
  }
  const a = rep.a;
  out.push({
    name: "All diagrams",
    rows: [["Diagram", "Days", "Fleet", "From", "Until", "Starts at", "Starts",
            "Ends at", "Ends", "Legs", "Coupled every leg", "Splits", "Miles"]]
      .concat(a.day.map(d => {
        const c = F.coupling(d), s = F.startsAt(d), e = F.endsAt(d);
        return [d.key, F.daysLabel(d.days), d.fleet, d.from, d.until,
                s.loc, hm(s.t), e.loc, hm(e.t), c.legs,
                c.moCapable ? "yes" : "no", F.splitsOf(d).length, d.totalMiles || 0];
      })),
  });
  return out;
}

root.FLEET_REPORT = {build, sheets, bucketLabel};
})(typeof globalThis !== "undefined" ? globalThis : this);
