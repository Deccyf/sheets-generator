/* The seven questions, answered once and rendered twice.

   Everything the page shows and everything the workbook exports comes from
   here, so the spreadsheet cannot drift away from the screen.            */
;(function(root){
"use strict";
const F = FLEET;
const gp = F.groupOf;

const n0 = x => Math.round(x).toLocaleString("en-GB");
const pct = (a, b) => b ? Math.round(a * 100 / b) + "%" : "—";
/* Times are rolled past midnight inside the tool so the order of a day
   stays right - see roll() in fleet.js - but 25:26 is not how anybody reads
   a clock. On the page it becomes the time it actually is, with the day it
   falls on, so the reader is never asked to do the arithmetic.

   Durations are a different thing and get a different shape: 5h40, never
   05:40, so a length can never be mistaken for a time of day. */
function at(v){
  if (v == null) return "—";
  const day = Math.floor(v / 1440);
  const t = ((v % 1440) + 1440) % 1440;
  const s = String(Math.floor(t / 60)).padStart(2, "0") + ":" +
            String(t % 60).padStart(2, "0");
  return day > 0 ? s + " (+" + day + ")" : s;
}
/* A list of diagrams that must stay one line high: the first few, then a
   count. A cell that wraps makes its whole row tall, and a table where four
   rows are three lines high reads as broken. */
const few = (list, n) => list.length > n
  ? list.slice(0, n).join(" ") + "  +" + (list.length - n) + " more"
  : list.join(" ");
const dur = m => m == null ? "—"
  : Math.floor(m / 60) + "h" + String(m % 60).padStart(2, "0");
/* Cut-offs and other plain times of day, which never roll. */
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

const DAY_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function build(all, fleet, cfg){
  const a = F.analyse(all, fleet, cfg);
  const c = a.cfg;
  const secs = [];
  /* Which book the answers are for, in words. Most sections are answered
     for the book picked on the card, so they name the book rather than one
     day of it - a Mon-Thu count is not a Monday's. */
  const multi = !!a.group && a.group.days.length > 1;
  const onBook = !a.group ? "Over the week" : multi ? "Monday to Thursday"
    : "On a " + longDay(a.refMs);
  const inBook = !a.group ? "over the week"
    : "in the " + (multi ? "Mon–Thu" : longDay(a.refMs)) + " book";
  const plural = (n, one, many) => n === 1 ? one : many;
  const startOf = d => F.startsAt(d), endOf = d => F.endsAt(d);

  /* ---- 1. home depot arrivals, AM and PM ---- */
  /* Only the end of a diagram counts. A unit that calls in and goes out
     again the same day has not arrived - see analyse(). */
  const arrRows = [];
  for (const k of ["AM", "PM", "NIGHT"])
    for (const x of a.home[k])
      arrRows.push([x.d.key, F.daysLabel(x.d.days), bucketLabel(x.t), at(x.t),
                    x.loc, gp(startOf(x.d).loc), at(startOf(x.d).t)]);
  secs.push({
    id: "arrivals",
    tab: "Arrivals home",
    title: "Arrivals into " + c.home,
    lede: (a.offNetwork
      ? `<b>${c.home} is not on this network.</b> No diagram in these prints ` +
        `calls there, so none can bring a unit home — the home counts below ` +
        `are nought because of where the depot is, not because of the plan. ` +
        (a.deliver && a.deliver.length
          ? `The <em>To ${c.home}</em> tab shows how units get there instead. `
          : "")
      : (a.home.AM.length === 0
          ? `${onBook}, <b>no unit is done for the day at ${c.home} before ` +
            `noon</b> — anything in during the morning goes back out for PM ` +
            `service. `
          : `${onBook}, <b>${a.home.AM.length}</b> ` +
            `${plural(a.home.AM.length, "unit is", "units are")} done for the ` +
            `day at ${c.home} before noon. `) +
        `<b>${a.home.PM.length}</b> ${plural(a.home.PM.length, "is", "are")} ` +
        `done there between noon and midnight, and ` +
        `<b>${a.home.NIGHT.length}</b> after midnight. ` +
        `<b>${a.away.AM.length + a.away.PM.length + a.away.NIGHT.length}</b> ` +
        `end the day away from any depot that can repair this fleet.`),
    how: `A unit counts only when its diagram <em>ends</em> at ${c.home}. One ` +
      `that comes in during the morning and goes back out for PM service ` +
      `isn't done for the day, so it isn't counted. Platform, sidings and ` +
      `depot all count as ${c.home} — hover over a place for the exact road. ` +
      `A long stand in the middle of a diagram is on the <em>Attendable ` +
      `stands</em> tab instead.`,
    stat: [["Done at home by noon", a.home.AM.length],
           ["Done at home, noon to midnight", a.home.PM.length],
           ["Done at home after midnight", a.home.NIGHT.length],
           ["Done at any repair depot",
            a.repair.AM.length + a.repair.PM.length + a.repair.NIGHT.length],
           ["Done away from any repair depot",
            a.away.AM.length + a.away.PM.length + a.away.NIGHT.length]],
    head: ["Diagram", "Runs", "Part of day", "Gets in", "Where exactly",
           "Started from", "Start time"],
    rows: arrRows,
  });

  /* ---- 2. finished at home before the evening ---- */
  const early = a.arrivals
    .filter(x => a.inHome(x.loc) && x.t != null && x.t >= 720 && x.t < 1200)
    .sort((p, q) => p.t - q.t);
  secs.push({
    id: "early",
    tab: "Home before 8pm",
    title: "Home before 20:00",
    lede: early.length
      ? `<b>${early.length}</b> ${plural(early.length, "diagram ends", "diagrams end")} ` +
        `at ${c.home} between noon and 20:00 ${inBook} — units a late shift ` +
        `can start on. The last column says when each is needed again.`
      : `No diagram ends at ${c.home} between noon and 20:00 ${inBook}.`,
    how: `Only a diagram that <em>ends</em> at ${c.home} counts. One that ` +
      `calls in and goes out again the same day is passing through, however ` +
      `long it stands. <em>Free until</em> is when the same diagram next ` +
      `starts — the depot can use the unit for something else in between, ` +
      `but the plan doesn't say so.`,
    head: ["Diagram", "Runs", "Gets in", "Where exactly", "Started from",
           "Start time", "Free until"],
    rows: early.map(x => {
      /* the evening window closes when this diagram next goes out */
      const runsTomorrow = F.runsOn(x.d, a.monday + 86400000);
      return [x.d.key, F.daysLabel(x.d.days), at(x.t), x.loc,
              gp(startOf(x.d).loc), at(startOf(x.d).t),
              runsTomorrow ? "next morning " + at(startOf(x.d).t)
                           : "its diagram doesn't run tomorrow"];
    }),
  });

  /* ---- 3. diagrams a restricted unit can take ---- */
  /* The fleet plan closing on itself is not the same as the RESTRICTED work
     closing on itself, and it is the second one an MO unit lives by. */
  const moWk = F.moWeek(all, fleet, a.monday);
  /* The night after the book's own day - a Saturday card asks about a
     Saturday night, not a Monday's. */
  const moNight = moWk.filter(x => x.from === F.dayName(a.refMs))[0] || moWk[0];
  const badNights = moWk.filter(x => x.b.stranded > 0).length;
  const okRows = a.moOk.map(x => {
    const s = startOf(x.d), e = endOf(x.d);
    return [x.d.key, F.daysLabel(x.d.days), x.c.legs, x.c.partners.join(" "),
            gp(s.loc), at(s.t), gp(e.loc), at(e.t), x.d.totalMiles || 0];
  }).sort((p, q) => p[4] < q[4] ? -1 : p[4] > q[4] ? 1 : 0);
  secs.push({
    id: "mo",
    tab: "Restricted units",
    title: "Diagrams a restricted unit can work",
    lede: `A restricted unit can't run on its own, so it can only take a ` +
      `diagram that is coupled on every leg. ` +
      (!a.work.length
        ? `There are no working diagrams ${inBook}.`
        : `<b>${a.moOk.length} of the ${a.work.length}</b> working diagrams ` +
          `${inBook} (${pct(a.moOk.length, a.work.length)}) are. ` +
          (!a.moOk.length ? ""
            : moNight.b.stranded
            ? `But on a ${LONG[moNight.from]} night <b>${moNight.b.stranded} ` +
              `of ${moNight.b.today}</b> end where no other such diagram starts ` +
              `the next day, so those units have to be moved before they can ` +
              `work again.`
            : `On a ${LONG[moNight.from]} night each one ends where another ` +
              `such diagram starts the next day, so a restricted unit can stay ` +
              `on this work without being moved.`)),
    how: `Each leg in the prints has a formation listing the units in the ` +
      `train. A leg with none is a unit running alone, so a diagram counts ` +
      `here only if every leg is coupled to another unit. The fold at the ` +
      `foot of this tab checks every night of the week.`,
    stat: [["Coupled every leg", a.moOk.length],
           ["Run alone at some point", a.work.length - a.moOk.length],
           ["Working diagrams", a.work.length],
           ["Can stay on, " + moNight.from + " night", moNight.b.carries],
           ["Must be moved, " + moNight.from + " night", moNight.b.stranded]],
    head: ["Diagram", "Runs", "Legs", "Coupled to", "Starts from", "Start time",
           "Ends at", "End time", "Miles"],
    rows: okRows,
    detail: [{
      tab: "MO night by night",
      title: "Night by night: can a restricted unit stay on this work? — " +
        (badNights === 0 ? "yes, every night"
          : badNights === moWk.length ? "no, some have to be moved every night"
          : "not always: some have to be moved on " + badNights + " of the " +
            moWk.length + " nights"),
      head: ["Night", "Suitable diagrams that day", "Suitable the next day",
             "Can stay on", "Must be moved", "Where they are left"],
      rows: moWk.map(x => [x.from + " \u2192 " + x.to, x.b.today, x.b.next,
        x.b.carries, x.b.stranded,
        x.b.at.slice(0, 6).map(y => gp(y.loc) + " +" + y.n).join(", ")]),
    }],
  });

  /* ---- 4. how long back to the depot? ---- */
  /* The question the depot actually asks: a unit is standing at West
     Marina - how many days before the diagrams put it back at Ramsgate?
     A unit can only take a diagram that STARTS where it is, and a diagram
     is a day, so this is a shortest walk over (place, day of week). */
  const wk = F.week(all, fleet, a.monday);
  const clean = wk.filter(x => x.b.moved === 0).length;
  const back = a.back;
  const reachable = back.filter(r => r.days != null);
  const worst = reachable.reduce((m, r) => Math.max(m, r.days), 0);
  const sameDay = back.filter(r => r.days === 1).length;
  const never = back.filter(r => r.never);
  /* A run of nights standing about reads as one step, not six. */
  const wayBack = path => {
    const out = [];
    for (let i = 0; i < path.length; i++){
      const p = path[i];
      if (p.key){ out.push(p.key + " (" + p.day + ")"); continue; }
      let j = i;
      while (j + 1 < path.length && !path[j + 1].key) j++;
      out.push("waits " + (j > i ? p.day + "–" + path[j].day : p.day));
      i = j;
    }
    return out.join(" → ");
  };
  const aim = a.offNetwork
    ? "the handover point at " + (a.deliver && a.deliver[0] ? a.deliver[0].label : "?")
    : c.home;
  secs.push({
    id: "back",
    tab: "Days back to depot",
    title: "How long back to " + (a.offNetwork ? aim : c.home) + "?",
    lede: `For every place a unit can be left: how many days the diagrams ` +
      `take to bring it back to <b>${aim}</b>. The longest is ` +
      `<b>${worst} ${plural(worst, "day", "days")}</b>, and <b>${sameDay}</b> ` +
      `of the ${back.length} places ${plural(sameDay, "is", "are")} home ` +
      `within a day. ` +
      (never.length
        ? `<b>${never.length}</b> ${plural(never.length, "has", "have")} no ` +
          `way back on the diagrams at all: ${never.map(r => r.loc).join(", ")}.`
        : ""),
    how: `A unit can only take a diagram that <em>starts</em> where it is ` +
      `standing, so this follows the plan itself home. It counts days, not ` +
      `diagrams: a night standing about costs a day, but a second diagram the ` +
      `same day costs nothing, as long as it leaves at least an hour after the ` +
      `unit got in. A unit is back only when a diagram <em>ends</em> at ` +
      `${aim} — one that calls in on its way past takes the unit with it. ` +
      `Each place is measured from the morning after each night the plan ` +
      `leaves a unit there (from every day, where it never does): <em>Days ` +
      `back</em> is the quickest of those, <em>Worst case</em> the slowest. ` +
      `The whole week, whichever book is picked.`,
    stat: [["Longest way back", worst + " " + plural(worst, "day", "days")],
           ["Home within a day", sameDay],
           ["Places the plan leaves a unit", back.filter(r => r.everLeft).length],
           ["No way back on the diagrams", never.length]],
    head: ["If a unit is left at", "Days back", "Worst case",
           "Nights the plan leaves one here", "First diagram", "The way back"],
    rows: back.map(r => [
      r.loc,
      r.never ? "never" : r.days,
      r.worst == null ? "—" : r.worst,
      r.everLeft ? r.leftOn.join(", ") : "the plan never leaves one here",
      r.never ? "none reaches " + aim
        : r.stuck ? "none starts here that day — it waits"
        : r.path && r.path[0] ? r.path[0].key : "already there",
      r.never ? "—"
        : !r.path || !r.path.length ? "already there" : wayBack(r.path),
    ]),
    detail: [{
      tab: "Week joins",
      title: "Night by night: does each day leave units where the next day's " +
        "diagrams start? — " +
        (clean === 7 ? "yes, every night" : clean + " of the 7 nights do"),
      head: ["Night", "Diagrams that day", "Diagrams the next day",
             "Places that match", "Places", "Units to move"],
      rows: wk.map(x => [x.from + " → " + x.to, x.b.today, x.b.next,
                         x.b.matched, x.b.locations, x.b.moved]),
    }].concat(wk.filter(x => x.b.moved > 0).map(x => ({
      tab: "Move " + x.from + "-" + x.to,
      title: x.from + " → " + x.to + " night: " + x.b.moved + " " +
        plural(x.b.moved, "unit", "units") + " to move",
      head: ["Place", "Ends there", "Starts there", "Spare (+) / short (−)"],
      rows: x.b.rows.filter(r => r.diff !== 0)
        .map(r => [r.loc, r.ends, r.starts, r.diff > 0 ? "+" + r.diff : r.diff]),
    }))),
  });

  /* ---- 5. mileage ---- */
  /* What a UNIT does, not what the fleet racks up between them: exams fall
     due on a unit's clock. Split by sub-fleet, because they are not worked
     alike - see mileage() in fleet.js for why miles per diagram is miles
     per unit. */
  const M = a.miles;
  /* The figure that leads is the one exams are planned off: what a unit ON
     THE BOOKS accrues, spares and all. Where no fleet size is set there is
     no such figure, and the per-diagram one stands in - said out loud, not
     quietly passed off as the same thing. */
  const per = r => r.annualPerOwned != null ? r.annualPerOwned : r.annualPerUnit;
  const perDay = r => r.annualPerOwned != null ? r.dailyPerOwned : r.dailyPerUnit;
  const dash = v => v == null ? "—" : Math.round(v);
  const mRow = r => [r.sub, r.owned == null ? "—" : r.owned, r.units,
                     dash(perDay(r)), dash(r.annualPerUnit), dash(r.annualPerOwned),
                     Math.round(r.annualTotal)];
  const spread = M.rows.length > 1
    ? M.rows.slice().sort((x, y) => per(y) - per(x)) : [];
  const sized = M.total.owned != null;
  secs.push({
    id: "miles",
    tab: "Mileage",
    title: "Mileage per unit",
    lede: `On these diagrams a ${c.label} unit runs ` +
      `<b>${n0(perDay(M.total))} miles a day</b> and ` +
      `<b>${n0(per(M.total))} a year</b> on average` +
      (sized
        ? `, across the <b>${M.total.owned}</b> units the depot owns.`
        : ` — but that is per unit <em>in traffic</em>, because no units owned ` +
          `is set. The real figure is lower: the spares and the ones on exam ` +
          `share the same work. Set it under Fleets &amp; depots.`) +
      (spread.length > 1
        ? ` The sub-fleets differ: a <b>${spread[0].sub}</b> runs ` +
          `${n0(per(spread[0]))} a year, a ` +
          `<b>${spread[spread.length - 1].sub}</b> ` +
          `${n0(per(spread[spread.length - 1]))}.` : "") +
      ` Always the whole week, whichever book is picked.`,
    how: `Exams fall due on each unit's own mileage, so this is what <em>one ` +
      `unit</em> runs, not the fleet's total. Each diagram is worked by one ` +
      `unit, and its <em>Total miles</em> is how far that unit goes — two ` +
      `units coupled are two diagrams, each with the whole distance. The ` +
      `week's miles are shared over the units the depot owns, not over the ` +
      `diagrams: the prints carry no spares and no exam float, so a plan ` +
      `needing 27 diagrams is worked by all 30 units, and dividing by 27 makes ` +
      `every figure too high. Both are shown — <em>per unit in traffic</em> is ` +
      `what a working unit does, <em>per unit owned</em> is the one to plan ` +
      `exams off. A year is <b>${a.runningDays} running days</b>: 52 weeks less ` +
      `Christmas Day and Boxing Day, as the depot's own sheets count it. This ` +
      `tab is always the whole week, Monday to Sunday, whichever book is ` +
      `picked: a unit's mileage doesn't care which book it was working.`,
    stat: [["Miles a day, per unit", n0(perDay(M.total))],
           ["Miles a year, per unit", n0(per(M.total))],
           [sized ? "Units owned" : "Units the plan needs",
            sized ? M.total.owned : M.total.units],
           ["Miles a year, whole fleet", n0(M.total.annualTotal)]],
    head: ["Sub-fleet", "Units owned", "Units the plan needs",
           "Miles a day, per unit", "A year, per unit in traffic",
           "A year, per unit owned", "A year, whole sub-fleet"],
    rows: M.rows.map(mRow).concat(M.rows.length > 1 ? [mRow(M.total)] : []),
    detail: [{
      tab: "How the mileage is worked out",
      title: "The sum, step by step — to check any figure above by hand",
      note: `The six steps, with this week's own numbers in them, so the sum ` +
        `can be checked by hand or against a sheet worked out another way. ` +
        `Step 2 is the only one not from the prints — it is the units owned, ` +
        `set under Fleets &amp; depots.`,
      head: ["Step", "What it is", "How it is got"]
        .concat(M.rows.map(r => r.sub))
        .concat(M.rows.length > 1 ? ["All " + c.label] : []),
      rows: (() => {
        const cols = M.rows.concat(M.rows.length > 1 ? [M.total] : []);
        const n2 = v => v == null ? "—" : Math.round(v).toLocaleString("en-GB");
        const line = (n, what, how, pick) =>
          [n, what, how].concat(cols.map(pick));
        return [
          line(1, "Miles the sub-fleet runs in the week",
               "Every diagram's Total miles, added over the seven days",
               r => n2(r.weeklyTotal)),
          line(2, "Units the depot owns",
               "A setting — the prints never show a spare unit",
               r => r.owned == null ? "— not set —" : r.owned),
          line(3, "Miles per unit in the week",
               "Step 1 ÷ step 2",
               r => n2(r.weeklyPerOwned)),
          line(4, "Running days in a year",
               "52 weeks (364) less Christmas Day and Boxing Day",
               () => a.runningDays),
          line(5, "Weeks in a year",
               "Step 4 ÷ 7",
               () => (a.runningDays / 7).toFixed(4)),
          line(6, "MILES PER UNIT A YEAR",
               "Step 3 × step 5",
               r => n2(r.annualPerOwned)),
          line("—", "…and per unit a day", "Step 6 ÷ step 4",
               r => n2(r.dailyPerOwned)),
          line("—", "For comparison: a year, per unit in traffic",
               "Step 1 ÷ the diagrams running each day, × step 5 — what a " +
               "unit in traffic does, with no spare or exam float in it",
               r => n2(r.annualPerUnit)),
          line("—", "Diagrams the plan needs on its busiest day",
               "Can't be more than step 2 — if it is, the units owned is set " +
               "too low or the prints give two sub-fleets the same label",
               r => r.units),
        ];
      })(),
    }, {
      tab: "Mileage by day",
      title: "Day by day, per sub-fleet",
      head: ["Sub-fleet", "Day", "Diagrams", "Standing all day", "Total miles",
             "Miles per unit"],
      rows: M.rows.concat(M.rows.length > 1 ? [M.total] : []).reduce((out, r) => {
        for (const d of r.perDay)
          out.push([r.sub, d.day, d.diagrams, d.idle, Math.round(d.miles),
                    Math.round(d.perUnit)]);
        return out;
      }, []),
    }].concat(a.dupes.length ? [{
      tab: "Mileage duplicates",
      title: "The same diagram counted twice on one day — check these",
      head: ["Duplicate"],
      rows: a.dupes.map(x => [x]),
    }] : []),
  });

  /* ---- 6. stands long enough to be attended ---- */
  const byLoc = new Map();
  for (const x of a.attend){
    const g = gp(x.b.loc);
    if (!byLoc.has(g)) byLoc.set(g, []);
    byLoc.get(g).push(x);
  }
  const standRows = Array.from(byLoc.entries())
    .map(([loc, xs]) => {
      const mins = xs.map(x => x.b.mins).filter(m => m != null).sort((p, q) => p - q);
      const am = xs.filter(x => x.b.from != null && x.b.from < 720).length;
      return [loc, xs.length, am, xs.length - am,
              mins.length ? dur(mins[Math.floor(mins.length / 2)]) : "all day",
              a.atRepair(xs[0].b.loc) ? "repair depot" : "outstation",
              few(xs.map(x => x.d.key), 3)];
    })
    .sort((p, q) => q[1] - p[1]);
  const amStands = a.attend.filter(x => x.b.from != null && x.b.from < 720).length;
  secs.push({
    id: "stands",
    tab: "Attendable stands",
    title: "Where a unit stands long enough to be attended",
    lede: `Places a unit stands still for ${F.ATTENDABLE / 60} hours or more ` +
      `during the day — long enough for a mobile engineer or a toilet fitter ` +
      `to get to it. <b>${a.attend.length}</b> such ` +
      `${plural(a.attend.length, "stand", "stands")} ${inBook}, ` +
      `<b>${amStands}</b> of them starting before noon.`,
    how: `Any stand of ${F.ATTENDABLE / 60} hours or more except the one a ` +
      `unit ends the day on, plus every diagram that stands still all day. ` +
      `Unlike the arrivals, a unit that calls in and goes out again counts ` +
      `here — it is sitting there either way. Signals, headshunts and ` +
      `turnbacks are left out: a unit draws up to one and goes on.`,
    head: ["Place", "Units standing", "Starting before noon",
           "Starting after noon", "Typical length", "Kind of place", "Diagrams"],
    rows: standRows,
  });

  /* ---- 6a. handing units over to a depot off this network ---- */
  /* Only when there IS one. A Ramsgate fleet comes home under its own
     power and this section would say nothing. */
  for (const v of a.deliver || []){
    const rows = [], stat = [];
    for (const w of v.windows){
      const g = v.by[w.name];
      stat.push([`Finishers, ${w.name} (by ${hm(w.by)})`, g.finisher.length]);
      stat.push([`Parked units, ${w.name}`, g.stand.length]);
      for (const kind of ["finisher", "stand"])
        for (const x of g[kind])
          rows.push([x.d.key, F.daysLabel(x.d.days), w.name, at(x.b.from),
            x.b.loc,
            kind === "finisher" ? "finished for the day" : "parked mid-diagram",
            kind === "finisher" ? "nothing — its work is done"
              : `the rest of ${x.d.key}, which works again at ${at(x.b.to)}`]);
    }
    const fin = v.windows.reduce((t, w) => t + v.by[w.name].finisher.length, 0);
    const std = v.windows.reduce((t, w) => t + v.by[w.name].stand.length, 0);
    secs.push({
      id: "deliver",
      tab: "To " + c.home,
      title: "Getting units to " + c.home,
      lede: `${c.home} is not on this network, so units get there by being ` +
        `handed over at <b>${v.label}</b>. ${onBook} there ` +
        `${plural(fin, "is", "are")} <b>${fin} ` +
        `${plural(fin, "finisher", "finishers")}</b> — work done, free to take — ` +
        `and <b>${std} parked ${plural(std, "unit", "units")}</b>, idle there ` +
        `but still wanted by their diagrams. ` +
        (v.missed.length
          ? `<b>${v.missed.length}</b> more finish at ${v.label} too late for ` +
            `either window, the earliest at ${at(v.missed[0].b.from)}.`
          : ""),
      how: `Windows are ` +
        v.windows.map(w => `${w.name} up to ${hm(w.by)}`).join(" and ") +
        `; change them under Fleets &amp; depots. A finisher ` +
        `costs nothing to take. A parked unit is idle but its diagram wants it ` +
        `back, and the last column says when.`,
      stat,
      head: ["Diagram", "Runs", "Window", "At " + v.label, "Where",
             "State of the unit", "What taking it costs"],
      rows,
      extra: v.missed.length ? {
        tab: "Too late for " + c.home,
        title: "Finish at " + v.label + " too late for either window",
        head: ["Diagram", "Runs", "Gets in", "Where", "How late"],
        rows: v.missed.map(x => [x.d.key, F.daysLabel(x.d.days), at(x.b.from),
          x.b.loc,
          dur(x.b.from - v.windows[v.windows.length - 1].by) + " past the cut-off"]),
      } : null,
    });
  }

  /* ---- 6b. what the codes mean ---- */
  /* The prints name places in nine characters, so Ashford arrives as five
     codes and Ramsgate as nine. Spelt out they stop looking like
     duplication. Signals, headshunts and turnbacks are kept apart from
     the rest: a unit draws up to one and goes on, and the berthing sheets
     leave them out of the books for exactly that reason. */
  /* ---- 7. where a restriction cannot be contained ---- */
  const contRows = a.containment.map(r => [
    r.loc, r.n, r.ok, r.n - r.ok,
    r.ok === 0 ? "NO — none coupled every leg"
      : r.ok === r.n ? "yes, every diagram" : "yes, " + r.ok + " of " + r.n,
    few(r.okD, 3),
  ]);
  const none = a.containment.filter(r => r.ok === 0);
  secs.push({
    id: "contain",
    tab: "Cannot contain",
    title: "Where a restricted unit cannot be contained",
    lede: (!a.containment.length
        ? `There are no working diagrams ${inBook}.`
        : none.length
        ? `<b>${none.length} of the ${a.containment.length}</b> places diagrams ` +
          `start from have nothing a restricted unit can work — every diagram ` +
          `out of there leaves it running alone at some point, so it has to be ` +
          `moved first: ${none.map(r => r.loc).join(", ")}.`
        : `Every place a diagram starts from has at least one that is coupled ` +
          `on every leg, so a restricted unit can be worked from anywhere.`),
    how: `Grouped by where a diagram <em>starts</em>, because that is where a ` +
      `unit has to be standing to take it up. <em>Coupled every leg</em> ` +
      `counts the diagrams from that place that never leave a unit running ` +
      `alone.`,
    head: ["A unit standing at", "Diagrams out of here", "Coupled every leg",
           "Run alone at some point", "Can a restricted unit work from here?",
           "Which diagrams"],
    rows: contRows,
    extra: {
      tab: "Split locations",
      title: "Where units come apart, place by place",
      head: ["Place", "Partings", "Of those, PM", "Diagrams", "Days",
             "Kind of place"],
      rows: a.splits.map(s => [s.loc, s.n, s.pm, s.ds.size,
        DAY_ORDER.filter(d => s.days.has(d)).join(" "),
        a.atRepair(s.loc) ? "repair depot" : "outstation"]),
    },
  });

  /* ---- 8. joining and coming apart, AM and PM ---- */
  const pmRows = a.pmSplits.map(x =>
    [x.day, x.d, x.lost.join(" + "), x.loc, at(x.t)]);
  const amRows = a.amSplits.map(x =>
    [x.day, x.d, x.lost.join(" + "), x.loc, at(x.t)]);
  const pmDays = new Set(a.pmSplits.map(x => x.day));
  secs.push({
    id: "apart",
    tab: "Together AM, apart PM",
    title: "Units that go out together and come apart later",
    lede: (pmRows.length
      ? `<b>${pmRows.length}</b> ${plural(pmRows.length, "parting", "partings")} ` +
        `${inBook} ${plural(pmRows.length, "is", "are")} the PM kind: the ` +
        `units go out as one, are put away together, and only come apart ` +
        `after that — so neither is free until the afternoon. They fall on ` +
        `${DAY_ORDER.filter(d => pmDays.has(d)).join(", ")}. The other ` +
        `<b>${amRows.length}</b> part on the working they leave on.`
      : amRows.length
      ? `Nothing ${inBook} goes out coupled, is put away together and comes ` +
        `apart later — every parting happens on the working the units leave on.`
      : `No units come apart ${inBook}.`),
    how: `The same rule the berthing sheets use, so the two tools can't ` +
      `disagree. Who parts from whom is read off the formation: the unit that ` +
      `drops out of it is the one that leaves, not everybody standing at that ` +
      `place. A pair that splits and joins again on the same path to the same ` +
      `berth never really parted, and is left out. "PM" means what it does on ` +
      `the berthing sheets: not a time of day, but the units being put away ` +
      `together <em>first</em> and parting after that. Every day of the book ` +
      `is checked, not just the first.`,
    stat: [["Partings in this book", a.partings.length],
           ["Together out, apart later (PM)", pmRows.length],
           ["Apart on the working they leave on", amRows.length],
           ["Places they happen", a.splits.length]],
    head: ["Day", "Diagram", "Parts from", "Where", "When"],
    rows: pmRows.length ? pmRows : amRows,
    extra: pmRows.length && amRows.length ? {
      tab: "Apart on the day",
      title: "Partings on the working the units leave on",
      head: ["Day", "Diagram", "Parts from", "Where", "When"],
      rows: amRows,
    } : null,
  });

  /* ---- last of all: what the codes mean ----
     A key belongs at the BACK of a document, not in the middle of it. It is
     the thing a reader turns to when a code on one of the tables above is
     unfamiliar, so it sits under them all. */
  const berths = a.places.filter(p => !p.shunt);
  const shunts = a.places.filter(p => p.shunt);
  const roads = berths.filter(p => p.kind === "road");
  const unnamed = a.places.filter(p => !p.named);
  secs.push({
    id: "places",
    tab: "Place codes",
    title: "What the place codes mean",
    lede: `The prints only have nine characters for a place, so one station ` +
      `can turn up under several codes. These are the <b>${berths.length}</b> ` +
      `places the ${c.label} berths or calls at` +
      (shunts.length
        ? `, with <b>${shunts.length}</b> signals and shunt points listed ` +
          `separately below — a unit draws up to one of those and goes on, so ` +
          `it is never stabled there`
        : "") + `. ` +
      (unnamed.length
        ? `<b>${unnamed.length}</b> ${plural(unnamed.length, "has", "have")} no ` +
          `name in the tool yet, so ${plural(unnamed.length, "it is", "they are")} ` +
          `shown as in the prints rather than guessed at — say what ` +
          `${plural(unnamed.length, "it is", "they are")} and the name can be added.`
        : `All of them are named.`),
    how: `Names come from the same table the berthing sheets use, so the two ` +
      `tools can't disagree. A code ending in a number is a signal — ` +
      `Dover621 is Dover signal YE 621. "Dep", "EMUD", "CSD" and "TRSMD" are ` +
      `the depot proper; "Sd", "Sdg" and "CHS" a siding; "Hs" and "ShNk" a ` +
      `headshunt or shunt neck; "TB", "TR" and "Lp" a turnback, train road or ` +
      `loop.`,
    stat: [["Places it berths or calls at", berths.length],
           ["Depot roads and sidings", roads.length],
           ["Signals and shunt points", shunts.length],
           ["Still without a name", unnamed.length]],
    head: ["Code", "What it is", "Shown in the tables as", "Kind of place",
           "Lines in the prints"],
    rows: berths.map(p => [p.code,
      p.named ? p.name : "— not named yet —", gp(p.code),
      p.kind === "road" ? "depot road or siding" : "station", p.n]),
    extra: shunts.length ? {
      tab: "Shunt points",
      title: "Signals and shunt points — passed through, never berthed",
      head: ["Code", "What it is", "Shown in the tables as", "Kind of place",
             "Lines in the prints"],
      rows: shunts.map(p => [p.code,
        p.named ? p.name : "— not named yet —", gp(p.code),
        p.kind === "signal" ? "signal" : "headshunt, turnback or loop", p.n]),
    } : null,
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
    rows: [["Diagram", "Runs", "Sub-fleet", "Valid from", "Valid until",
            "Starts from", "Start time", "Ends at", "End time", "Legs",
            "Coupled every leg", "Splits", "Miles"]]
      .concat(a.week.map(d => {
        const c = F.coupling(d), s = F.startsAt(d), e = F.endsAt(d);
        return [d.key, F.daysLabel(d.days), d.fleet, d.from, d.until,
                s.loc, at(s.t), e.loc, at(e.t), c.legs,
                c.moCapable ? "yes" : "no", F.splitsOf(d).length, d.totalMiles || 0];
      })),
  });
  return out;
}

root.FLEET_REPORT = {build, sheets, bucketLabel};
})(typeof globalThis !== "undefined" ? globalThis : this);
