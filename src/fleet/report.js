/* The seven questions, answered once and rendered twice.

   Everything the page shows and everything the workbook exports comes from
   here, so the spreadsheet cannot drift away from the screen.            */
;(function(root){
"use strict";
const F = FLEET;
const gp = F.groupOf;

const n0 = x => Math.round(x).toLocaleString("en-GB");
const one = x => (Math.round(x * 10) / 10).toLocaleString("en-GB");
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

function build(all, fleet, cfg){
  const a = F.analyse(all, fleet, cfg);
  const c = a.cfg;
  const secs = [];
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
      ? `<b>${c.home} is not on this network.</b> No diagram in these books ` +
        `calls there, so nothing below can bring a unit home — the counts are ` +
        `zero because of where the depot is, not because of the plan. See ` +
        `<em>Getting units to ${c.home}</em> for what the plan can say. `
      : (a.home.AM.length === 0
          ? `On a ${longDay(a.monday)}, <b>no unit is done for the day at ` +
            `${c.home} before noon</b> — anything in during the morning goes ` +
            `back out for PM service. `
          : `On a ${longDay(a.monday)}, <b>${a.home.AM.length}</b> unit` +
            `${a.home.AM.length === 1 ? " is" : "s are"} done for the day at ` +
            `${c.home} before noon — in, and not out again for PM service. `) +
        `<b>${a.home.PM.length}</b> are done there in the afternoon or ` +
        `evening and <b>${a.home.NIGHT.length}</b> after midnight. ` +
        `<b>${a.away.AM.length + a.away.PM.length + a.away.NIGHT.length}</b> ` +
        `end the day nowhere near a depot that can repair this fleet.`),
    how: `A unit counts only when its diagram <em>ends</em> at ${c.home} and ` +
      `it stays — one that comes in during the morning and goes back out for ` +
      `PM service is not done for the day and is not counted here. Platform, ` +
      `sidings and depot are all ${c.home}, with the exact road on the hover. ` +
      `A long mid-day call shows under <em>attendable stands</em> instead, ` +
      `which is where a window belongs.`,
    stat: [["Done for the day by noon", a.home.AM.length],
           ["Done in the PM", a.home.PM.length],
           ["Done after midnight", a.home.NIGHT.length],
           ["At any repair depot",
            a.repair.AM.length + a.repair.PM.length + a.repair.NIGHT.length],
           ["Away from any repair depot",
            a.away.AM.length + a.away.PM.length + a.away.NIGHT.length]],
    head: ["Diagram", "Runs", "Part of day", "Gets in", "Where exactly",
           "Out from", "Left at"],
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
      ? `<b>${early.length}</b> diagram${early.length === 1 ? "" : "s"} finish` +
        `${early.length === 1 ? "es" : ""} at ${c.home} between noon and ` +
        `20:00, so the unit is free for that evening.`
      : `Nothing finishes at ${c.home} between noon and 20:00.`,
    how: `Only a diagram that <em>ends</em> at ${c.home} counts — one that ` +
      `calls in and goes out again the same day is passing through, however ` +
      `long it stands, and is not in this section.`,
    head: ["Diagram", "Runs", "Gets in", "Where exactly", "Out from", "Left at"],
    rows: early.map(x => [x.d.key, F.daysLabel(x.d.days), at(x.t), x.loc,
                          gp(startOf(x.d).loc), at(startOf(x.d).t)]),
  });

  /* ---- 3. diagrams a restricted unit can take ---- */
  /* The fleet plan closing on itself is not the same as the RESTRICTED work
     closing on itself, and it is the second one an MO unit lives by. */
  const moWk = F.moWeek(all, fleet, a.monday);
  const worstNight = moWk.every(x => x.b.stranded > 0);
  const okRows = a.moOk.map(x => {
    const s = startOf(x.d), e = endOf(x.d);
    return [x.d.key, F.daysLabel(x.d.days), x.c.legs, x.c.partners.join(" "),
            gp(s.loc), at(s.t), gp(e.loc), at(e.t), x.d.totalMiles || 0];
  }).sort((p, q) => p[4] < q[4] ? -1 : p[4] > q[4] ? 1 : 0);
  secs.push({
    id: "mo",
    tab: "Restricted units",
    title: "Diagrams a restricted unit can work",
    lede: `A restricted unit cannot run on its own, so it can only take a ` +
      `diagram that stays coupled all day. ` +
      `<b>${a.moOk.length} of ${a.work.length}</b> ` +
      `(${pct(a.moOk.length, a.work.length)}) do. ` +
      (moWk[0].b.stranded
        ? `They do not carry over cleanly, though: on a ${longDay(a.monday)} ` +
          `night <b>${moWk[0].b.stranded} of ${moWk[0].b.today}</b> finish where ` +
          `no other suitable diagram starts, so those units have to be moved ` +
          `before they can work again.`
        : `They also carry over cleanly overnight, so a restricted unit can ` +
          `stay on this work without being moved.`),
    how: `Every leg of a diagram carries a formation showing the units in the ` +
      `train. A leg with none is a unit running alone, so a diagram counts here ` +
      `only if every one of its legs is formed with somebody else.`,
    stat: [["Coupled every leg", a.moOk.length],
           ["Run alone at some point", a.work.length - a.moOk.length],
           ["Of the working diagrams", a.work.length],
           ["Carry over to the next day", moWk[0].b.carries],
           ["Stranded overnight", moWk[0].b.stranded]],
    head: ["Diagram", "Runs", "Legs", "Coupled to", "Starts at", "Away at",
           "Ends at", "In at", "Miles"],
    rows: okRows,
    detail: [{
      tab: "MO night by night",
      title: "Can a restricted unit stay on this work overnight? — " +
        (worstNight
          ? "no, it is stranded on every join"
          : "yes, every night carries over"),
      head: ["Night", "Suitable diagrams today", "Suitable tomorrow",
             "Carry over in place", "Left stranded", "Stranded at"],
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
  const aim = a.offNetwork
    ? "the handover point at " + (a.deliver && a.deliver[0] ? a.deliver[0].label : "?")
    : c.home;
  secs.push({
    id: "back",
    tab: "Days back to depot",
    title: "How long back to " + (a.offNetwork ? aim : c.home) + "?",
    lede: `Leave a unit anywhere in the table below and this is how long the ` +
      `diagrams take to get it back to <b>${aim}</b>. The furthest is ` +
      `<b>${worst} day${worst === 1 ? "" : "s"}</b>, and <b>${sameDay}</b> of ` +
      `${back.length} places are a single diagram away. ` +
      (never.length
        ? `<b>${never.length}</b> can never get there on the diagrams at all: ` +
          `${never.map(r => r.loc).join(", ")}.`
        : ""),
    how: `A unit can only take a diagram that <em>starts</em> where it is ` +
      `standing, and a diagram is a day's work — so this is the shortest way ` +
      `home through the plan itself, counting a day for each diagram and a day ` +
      `for standing where nothing leaves. It counts as back only when a diagram ` +
      `<em>ends</em> at the depot; one that calls in on its way past takes the ` +
      `unit with it. Each place is measured from the morning after the plan ` +
      `really does leave a unit there — the only night a 375 is left at ` +
      `Tonbridge is a Saturday, so measuring from a Monday would answer a ` +
      `question that never comes up.`,
    stat: [["Worst case", worst + (worst === 1 ? " day" : " days")],
           ["One diagram away", sameDay],
           ["Places a unit is left", back.filter(r => r.everLeft).length],
           ["No way back on the diagrams", never.length]],
    head: ["If a unit is left at", "Days back", "Worst case",
           "Nights one is left here", "First diagram", "The way back"],
    rows: back.map(r => [
      r.loc,
      r.never ? "never" : r.days,
      r.worst == null ? "—" : r.worst,
      r.everLeft ? r.leftOn.join(", ") : "the plan never leaves one here",
      r.never ? "nothing reaches " + aim
        : r.stuck ? "nothing starts here that day — it waits"
        : r.path && r.path[0] ? r.path[0].key : "already there",
      !r.path || !r.path.length ? "already there"
        : r.path.map(p => p.key ? p.key + " (" + p.day + ")"
                                : "wait over " + p.day).join(" → "),
    ]),
    detail: [{
      tab: "Week joins",
      title: "Does each day's set hand over to the next? — " +
        (clean === 7 ? "every join balances"
                     : clean + " of the 7 joins balance"),
      head: ["Night", "Diagrams today", "Diagrams tomorrow",
             "Places that match", "Places", "Units to move"],
      rows: wk.map(x => [x.from + " → " + x.to, x.b.today, x.b.next,
                         x.b.matched, x.b.locations, x.b.moved]),
    }].concat(wk.filter(x => x.b.moved > 0).map(x => ({
      tab: "Move " + x.from + "-" + x.to,
      title: x.from + " → " + x.to + ": " + x.b.moved + " to move",
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
  const mRow = r => [r.sub, r.units, Math.round(r.dailyPerUnit),
                     Math.round(r.weeklyPerUnit), Math.round(r.annualPerUnit),
                     Math.round(r.annualTotal)];
  const spread = M.rows.length > 1
    ? M.rows.slice().sort((x, y) => y.annualPerUnit - x.annualPerUnit) : [];
  secs.push({
    id: "miles",
    tab: "Mileage",
    title: "Mileage per unit",
    lede: `On these diagrams a ${c.label} unit averages ` +
      `<b>${n0(M.total.dailyPerUnit)} miles a day</b> and ` +
      `<b>${n0(M.total.annualPerUnit)} a year</b>.` +
      (spread.length > 1
        ? ` The sub-fleets are not worked alike: a <b>${spread[0].sub}</b> covers ` +
          `${n0(spread[0].annualPerUnit)} a year against ` +
          `${n0(spread[spread.length - 1].annualPerUnit)} for a ` +
          `<b>${spread[spread.length - 1].sub}</b>.` : ""),
    how: `Exams fall due on a unit's clock, so this is what one unit covers, ` +
      `not what the fleet racks up between them. A diagram is worked by one ` +
      `unit and its <em>Total miles</em> is the distance that unit covers — two ` +
      `units coupled are two diagrams, each carrying the whole distance — so ` +
      `miles per diagram is miles per unit. Each day's miles are divided by the ` +
      `diagrams running that day, and the daily averages added across a week. ` +
      `<b>Units</b> is what the <em>plan</em> needs on its busiest day: a ` +
      `diagram book carries no spare or exam float, so the fleet as owned is ` +
      `larger and the real per-unit mileage lower.`,
    stat: [["Miles per unit per day", n0(M.total.dailyPerUnit)],
           ["Miles per unit per year", n0(M.total.annualPerUnit)],
           ["Units the plan needs", M.total.units],
           ["Whole fleet per year", n0(M.total.annualTotal)]],
    head: ["Sub-fleet", "Units the plan needs", "Miles per unit a day",
           "Per unit a week", "Per unit a year", "Whole sub-fleet a year"],
    rows: M.rows.map(mRow).concat(M.rows.length > 1 ? [mRow(M.total)] : []),
    detail: [{
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
      title: "Counted more than once on the reference week — check these",
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
    lede: `Where a unit sits still long enough for somebody to get to it and ` +
      `do something — what a mobile engineer or a toilet fitter can actually ` +
      `reach. <b>${a.attend.length}</b> on a ${longDay(a.monday)}, ` +
      `<b>${amStands}</b> of them starting before noon.`,
    how: `A stand of ${F.ATTENDABLE / 60} hours or more that is not the ` +
      `overnight one, plus any diagram that never moves all day. This is the ` +
      `one section where calling in DOES count — the unit is sitting there ` +
      `either way. Signals, headshunts and turnbacks are left out: a unit ` +
      `draws up to one and goes on.`,
    head: ["Place", "Units standing", "Starting before noon", "Starting after",
           "Typical stand", "Kind of place", "Diagrams"],
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
      lede: `${c.home} is off this network, so units get there by being handed ` +
        `over at <b>${v.label}</b>. On a ${longDay(a.monday)} there are ` +
        `<b>${fin} finisher${fin === 1 ? "" : "s"}</b> — work done, free to ` +
        `take — and <b>${std} parked unit${std === 1 ? "" : "s"}</b>, there and ` +
        `idle but still wanted by their diagrams. ` +
        (v.missed.length
          ? `<b>${v.missed.length}</b> more finish at ${v.label} too late for ` +
            `either window, the earliest at ${at(v.missed[0].b.from)}.`
          : ""),
      how: `Windows are ` +
        v.windows.map(w => `${w.name} up to ${hm(w.by)}`).join(" and ") +
        `; change them on the depot card at the top of the page. A finisher ` +
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
  const berths = a.places.filter(p => !p.shunt);
  const shunts = a.places.filter(p => p.shunt);
  const roads = berths.filter(p => p.kind === "road");
  const unnamed = a.places.filter(p => !p.named);
  secs.push({
    id: "places",
    tab: "Place codes",
    title: "What the place codes mean",
    lede: `The prints have nine characters for a place, so one station turns ` +
      `up as several codes. These are the <b>${berths.length}</b> the ` +
      `${c.label} berths or calls at` +
      (shunts.length
        ? `, with <b>${shunts.length}</b> signals and shunt points listed ` +
          `separately below — a unit draws up to one of those and goes on, so ` +
          `it is never stabled there`
        : "") + `. ` +
      (unnamed.length
        ? `<b>${unnamed.length}</b> still have no name in the tool: they show ` +
          `as the raw code, because a guess would read as fact. Say what they ` +
          `are and they will be spelt out.`
        : `All of them are named.`),
    how: `Names come from the same table the berthing sheets use, so the two ` +
      `tools can never disagree. A code ending in a number is a signal — ` +
      `Dover621 is Dover signal YE 621. "Dep", "EMUD", "CSD" and "TRSMD" are ` +
      `the depot proper; "Sd", "Sdg" and "CHS" a siding; "Hs" and "ShNk" a ` +
      `headshunt or shunt neck; "TB", "TR" and "Lp" a turnback, train road or ` +
      `loop.`,
    stat: [["Places it berths or calls at", berths.length],
           ["Depot roads and sidings", roads.length],
           ["Signals and shunt points", shunts.length],
           ["Still without a name", unnamed.length]],
    head: ["Code", "What it is", "Grouped under", "Kind of place",
           "Lines in the prints"],
    rows: berths.map(p => [p.code,
      p.named ? p.name : "— not named yet —", gp(p.code),
      p.kind === "road" ? "depot road or siding" : "station", p.n]),
    extra: shunts.length ? {
      tab: "Shunt points",
      title: "Signals and shunt points — passed through, never berthed",
      head: ["Code", "What it is", "Grouped under", "Kind of place",
             "Lines in the prints"],
      rows: shunts.map(p => [p.code,
        p.named ? p.name : "— not named yet —", gp(p.code),
        p.kind === "signal" ? "signal" : "headshunt, turnback or loop", p.n]),
    } : null,
  });

  /* ---- 7. where a restriction cannot be contained ---- */
  const contRows = a.containment.map(r => [
    r.loc, r.n, r.ok, r.n - r.ok,
    r.ok === 0 ? "NO — nothing stays coupled"
      : r.ok === r.n ? "yes, every diagram" : "yes, " + r.ok + " of " + r.n,
    few(r.okD, 3),
  ]);
  const none = a.containment.filter(r => r.ok === 0);
  secs.push({
    id: "contain",
    tab: "Cannot contain",
    title: "Where a restricted unit cannot be contained",
    lede: (none.length
        ? `A restricted unit left at one of these has nothing it can work — ` +
          `every diagram out of there leaves it on its own at some point, so it ` +
          `must be moved first. <b>${none.length} of ${a.containment.length}</b> ` +
          `places are like this: ${none.map(r => r.loc).join(", ")}.`
        : `Every place has at least one diagram that stays coupled, so a ` +
          `restricted unit can be worked from anywhere.`),
    how: `Grouped by where a diagram <em>starts</em>, because that is where a ` +
      `unit has to be standing to take it up. "Stay coupled" counts the ` +
      `diagrams from that place that never leave a unit running alone.`,
    head: ["A unit standing at", "Diagrams out of here", "Stay coupled",
           "Run alone at some point", "Can a restricted unit work from here?",
           "Which diagrams"],
    rows: contRows,
    extra: {
      tab: "Split locations",
      title: "Where diagrams actually come apart",
      head: ["Place", "Splits", "Diagrams", "Kind"],
      rows: a.splits.map(s => [s.loc, s.n, s.ds.size,
        a.atRepair(s.loc) ? "repair depot" : "outstation"]),
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
                s.loc, at(s.t), e.loc, at(e.t), c.legs,
                c.moCapable ? "yes" : "no", F.splitsOf(d).length, d.totalMiles || 0];
      })),
  });
  return out;
}

root.FLEET_REPORT = {build, sheets, bucketLabel};
})(typeof globalThis !== "undefined" ? globalThis : this);
