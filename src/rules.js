/* SHEETS_RULES — the pure part of local rule edits: the key grammar, the
   merge, and the rules in words. No DOM, no storage, no build knowledge, so
   it can be reasoned about and tested on its own.

   An edit is one entry in an object keyed exactly as ORDER_FIX is keyed:
   an array pins the order, null switches a shipped pin off. That is the
   whole vocabulary - the tool ships a table and the operator overlays it.
   Editing anything richer than unit order is deliberately not offered:
   order is the table testers actually correct, and it is the one with a
   closed, checkable grammar.

   Corrections stay on the computer that made them until somebody says what
   they are and they go into ORDER_FIX. There is no export file: the Unit
   order tab lists every correction in words, which is what a colleague
   reads out, and it was one more thing to keep working for no one. */
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

  /* ------------------------------------------------------------------
     The rules in words.

     One source for both places the rules are read: the Rules tab in the
     tool and the printed handout tools/make-rules-doc.mjs produces. It
     takes a plain object - no tables of its own - so a caller in the
     browser and a caller in Node describe the same build and get the same
     wording, and neither can quietly fall behind the other.

     Written for somebody who has never seen the code: no key grammar, no
     field names, no "pin". Where a rule exists because the hand-written
     books do it that way, the sentence says so.
     ------------------------------------------------------------------ */
  const esc = s => String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const hhmm = m => String(Math.floor(m / 60)).padStart(2, "0") + ":" +
                    String(m % 60).padStart(2, "0");
  const list = a => {
    const x = (a || []).slice();
    if (!x.length) return "";
    if (x.length === 1) return x[0];
    return x.slice(0, -1).join(", ") + " and " + x[x.length - 1];
  };
  const hours = m => m % 60 === 0
    ? (m / 60) + (m === 60 ? " hour" : " hours")
    : m + " minutes";
  // ASHFORD -> Ashford, for the places a location reads as a word
  const titleCase = s => String(s).charAt(0).toUpperCase() +
                         String(s).slice(1).toLowerCase();

  /* One row of the order table, in words rather than in its key. */
  function orderRow(key, order) {
    const k = parseKey(key);
    if (!k) return null;
    return {
      where: k.sec || "Anywhere",
      when: k.time ? "the " + k.time + " departure only" : "any departure",
      formation: k.diags.join(" + "),
      prints: order.join(", then "),
    };
  }

  function explain(env) {
    env = env || {};
    const S = [];
    const has = a => a && a.length;
    const secs = env.sections || [];
    const inBook = n => !secs.length || secs.indexOf(n) >= 0;
    const push = (id, title, blocks) => S.push({ id, title, blocks });
    /* Two of the four books are not berthing sheets at all - the Metro
       sheet and the Class 395 Allocations Sheet are the depot's own
       documents - so everything below that is about a berthing sheet has to
       ask which kind of book it is writing for. */
    const notBerth = !!(env.metro || env.hs);

    /* ---- 1. the page itself ----
       Each of the three documents gets its own description rather than the
       berthing sheet's with caveats bolted on. */
    if (env.hs) {
      push("sheet", "What you are looking at", [
        /* The depots come from the writer's own list rather than being
           typed out here, so this page cannot name a different set of
           blocks from the one the sheet actually lays out. */
        { p: "This is the Class 395 Allocations Sheet, not a berthing " +
             "sheet. One worksheet per day, named the way the depot's own " +
             "workbook names them — Tue 18 08 — with a block down it for " +
             "each depot: " + (list((env.hsDepots || []).map(titleCase)) ||
             "Ashford, Faversham, Margate and Ramsgate") + ". A depot with " +
             "nothing to show that day is left off, the same as the " +
             "hand-kept workbook does." },
        { p: "Each block is two tables side by side. On the left, what came " +
             "in last night, read off the day before's own entries — so it " +
             "fills whenever the reports cover more than one day, and a " +
             "single day's reports say “no previous day loaded” in the " +
             "heading rather than leaving a blank you have to guess at. On " +
             "the right, today's allocations, in the order they leave." },
        { p: "Reading an allocation from left to right:" },
        { table: { head: ["Column", "What it holds"], rows: [
          ["TRAIN ID", "The headcode and where it goes."],
          ["DIAGRAM", "The day's work the unit is booked to, with its " +
           "code — AZ601."],
          ["N/M M/O", "Left ruled and empty, to write in."],
          ["MG", "The miles this WORKING runs, not the diagram's total for " +
           "the day. A diagram that comes out twice has a figure for each " +
           "time: on the real sheet AZ623 is 143 miles on its 09+54 row and " +
           "182 on its 16+26 one. It is written as a number, so the sheet's " +
           "own colouring works on it — green under 500 miles, red at 500 " +
           "and over, the same key that is printed at the top. A report " +
           "saved as a PDF carries no mileage and the column stays empty."],
          ["TIME", "When it leaves. A space in the time (08 42) means it " +
           "leaves in service; a plus (08+42) means it leaves empty."],
          ["FP/RP", "Left ruled and empty, to write in."],
          ["UNIT NO", "The unit where the report names one. Where it does " +
           "not, the cell is left ruled and empty to write in."],
          ["ENDS AM, ENDS PM", "Where the diagram stands next and where it " +
           "finishes, in the depot's own berth codes — ASH, RAM, FAV — not " +
           "the berthing books'."],
          ["TRAIN ID, ARRIVES, WORKS", "The third table on the right hand " +
           "side. Left ruled and empty, to write in."],
        ] } },
        { p: "And last night's arrivals, on the left: TRAIN ID and ARRIVAL " +
             "TIME are what the unit came in on, UNIT NUMBER where the " +
             "report names one, 6 OR 12 CAR off the formation it arrived " +
             "in, and CET DUE is left empty to write in." },
        { p: "The drop-downs are on the cells that had them: the fleet list " +
             "on both unit columns, 6 or 12, the CET mark, and FP/RP. Click " +
             "a cell and the arrow is there." },
        { note: "The DIAGRAM cells carry the standing route notes as " +
          "comments, the way the hand-kept workbook does — hover over one " +
          "to read it. “Not over high level” is worked out from the " +
          "diagram itself: a working that runs between Ebbsfleet and " +
          "Gravesend, either way round, goes over the high level, and one " +
          "that does not gets the note. It is per working, not per " +
          "diagram — a diagram can position out over the high level first " +
          "thing and spend the rest of the day off it, and the real sheet " +
          "marks those later workings. “Avoids North Kent” is not " +
          "something the reports can show, so it comes from a standing " +
          "list of the workings that carry it. A report saved as a PDF has " +
          "no route to read and falls back to that list for both." },
      ]);
    } else if (env.metro) {
      push("sheet", "What you are looking at", [
        { p: "This is the Metro sheet, not a berthing sheet. One worksheet " +
             "per location, landscape, listing every service that starts " +
             "there through the day in the order they leave. One line is " +
             "one unit, so a pair is two lines and a twelve-car is three." },
        { p: "Grove Park and Slade Green get an AM sheet and a PM sheet, " +
             "split at " + hhmm(env.pmBreak || 1200) + ", the way the " +
             "hand-kept workbook splits them." },
        { p: "Reading a line from left to right:" },
        { table: { head: ["Column", "What it holds"], rows: [
          ["TRAIN I.D.", "The headcode, written once against the top line of " +
           "the formation."],
          ["SIDINGS", "When it leaves. A space in the time (08 42) means it " +
           "leaves in service; a plus (08+42) means it leaves empty."],
          ["STATION, or SIGNAL at Grove Park and Slade Green",
           "Left ruled and empty — the timing point is not in the reports."],
          ["DESTINATION", "Where it goes, in full."],
          ["POS", "The unit's position in the formation, out of the plan. " +
           "This sheet reads by it: 1, 2, 3 straight down."],
          ["DIAG", "The day's work the unit is booked to, with its code."],
          ["FORMATION", "The unit number where the plan names one."],
          ["ROAD, or PLATFORM at a terminus",
           "Left ruled and empty, to write in."],
          ["COMMENTS", "Left ruled and empty, to write in."],
          ["S, R/T, L/S", "Left ruled and empty, to write in."],
          ["ENDS", "Where the diagram finishes, and which half of the day it " +
           "finishes in — GP PM, SG AM."],
          ["MILES", "What the diagram runs, out of the Diagram Detail export. " +
           "A report saved as a PDF carries no mileage and the cell stays " +
           "empty."],
        ] } },
        { p: "The sheet ends with the date it was built for, room for a name " +
             "and a signature, and where to send it back to." },
        { note: "Which unit prints first is NOT the berthing books' rule " +
          "here. Those list the units the way they stand on the ground; this " +
          "sheet reads by Position, lowest first, which is how the hand-kept " +
          "workbook numbers every formation on it." },
      ]);
    } else
    push("sheet", "What you are looking at", [
      { p: "One page per location. Each page is a list of every unit that " +
           "stands there through the day and then leaves again, in the order " +
           "they leave. One line is one unit, so a pair standing together is " +
           "two lines and a twelve-car is three." },
      inBook("GROVE PARK") ? { p: env.gpSplit
        ? "Grove Park is the one exception to a page per location: it gets " +
          "two tables in this book, the overnight block first and the rest " +
          "of the day after it, the way the mainline book has always been " +
          "written."
        : "Grove Park gets a single table in this book. Only the mainline " +
          "book splits it in two." } : null,
      { p: "Reading a line from left to right:" },
      { table: { head: ["Column", "What it holds"], rows: [
        ["Time and destination",
         "When it leaves and where it goes. A space in the time (08 42) " +
         "means it leaves in service; a plus (08+42) means it leaves empty."],
        ["Formation",
         "How many coaches, then which class: 4 375 is a four-car Class " +
         "375, 2 466 is a two-car 466. A sub-class is written with a dash " +
         "because a slash will not sit in the cell, so 4 375-9 is a " +
         "four-car 375/9." +
         (env.fleets && Object.keys(env.fleets).length
           ? " On this book: " + list(Object.keys(env.fleets)
               .map(k => env.fleets[k])
               .filter((v, i, a) => a.indexOf(v) === i)
               .map(v => v.replace(/\//g, "-"))) + "."
           : "")],
        ["Diagram", "The day's work the unit is booked to."],
        ["A.M.", "Where this unit goes to stand next during the day."],
        ["P.M.", "Where this unit is standing at the end of its day's work. " +
                 "A diagram that goes out a third time has two of those, and " +
                 "the column means a different one on each line: the lines " +
                 "before its last journey read the berth it is sitting on, " +
                 "and the line for that journey reads where it finishes."],
        ["Unit", "The unit number where the report names one. Where it does " +
                 "not, the cell is left ruled and empty for the depot to " +
                 "write in — and you can type into it in Excel."],
        ["Flag", "Written once across the whole formation. SPLITS means these " +
                 "units come apart later in the day; SPLITS PM means they are " +
                 "put away together first and part on the second half of the " +
                 "diagram."],
        ["Notes", "Anything else about that one unit: the headcode, the " +
                  "siding it came off, ATTACHMENT, and which end of the " +
                  "train it is."],
      ] } },
      { p: "The workbook comes out set up to print: A4 portrait, sized so " +
           "all eight columns land on one page across, and broken so that no " +
           "location is cut in half between two pages. Print it as it comes." },
    ]);

    /* ---- 2. which movements get printed ---- */
    const off = [
      { p: "A line is a unit leaving somewhere it has been standing. Read " +
           "that literally and most of the rest follows:" },
      { ul: [
        "Every departure off a berthing road is a line, even if the unit " +
        "only arrived there an hour before. The hand-written books list " +
        "those re-departures, so this does too.",
        "An empty move that just repositions a unit onto another road in " +
        "the same place is a shunt, not a berthing, and is left off.",
        "An empty move that takes a unit to a different location IS " +
        "printed, because that location's page needs to know it is coming.",
        "A run out to a carriage washer and straight back to the road it " +
        "came from is not a berthing.",
        inBook("GROVE PARK")
          ? "A move that never leaves the Grove Park depot fence is not a line."
          : null,
        "A unit standing in a platform for an hour or more has arguably " +
        "berthed there. It gets a line where the report shunts it on the " +
        "spot; otherwise it is named on the Review tab and left off, and " +
        "“Count long platform stands” puts those on the sheets too.",
        "A unit that stands somewhere for the last time in the day and then " +
        "runs empty to a depot was only berthed there if it was actually put " +
        "away — the report marks that with a shunt against the stand. " +
        "Without one it was waiting on the way home, and the line belongs to " +
        "the depot it is going to, not to the place it paused.",
        "A unit that hops out and is back within " + (env.runRound || 60) +
        " minutes has been run round, not berthed twice — one line, not two.",
      ] },
    ];
    /* Only the ones this book has. The Ramsgate book is one page and was
       explaining Grove Park, Slade Green and West Marina on it. */
    const ecsOk = (env.ecsOnlyOk || []).filter(inBook);
    if (has(ecsOk))
      off.push({ p: (ecsOk.length > 1 ? "Some places work" : "One place works") +
        " differently because their empty moves are the whole point of the " +
        "location: " + list(ecsOk) + " keep their empty moves even inside " +
        "their own area." });
    off.push({ note: "Nothing is dropped quietly. Every movement the tool " +
      "left off is named on the Review tab of the book it would have been in, " +
      "with the reason. If you think something should be on the sheet, look " +
      "there first — it will tell you why it is not." });
    push("printed", "Which movements get a line", off);

    /* ---- 3. the order units print in ---- */
    const ord = [
      { p: "When units are coupled, they are listed in the order they stand " +
           "on the ground — front unit first, facing the way the train is " +
           "about to leave. Get that backwards and a driver walks to the " +
           "wrong end, so it is the part of the sheet worth checking." },
      { p: "The reports do not say which way round a train is. What they do " +
           "give is a position number for each unit in the formation, and " +
           "that number is steady from day to day. So for each location we " +
           "worked out — by holding the tool's sheet against the real " +
           "hand-written book — whether its formations come out right read " +
           "lowest number first or highest number first, and the tool " +
           "follows that." },
    ];
    const asc = (env.posAsc || []).filter(inBook).slice().sort();
    // "everywhere else" is nothing at all in a one-page book like Ramsgate's
    ord.push({ p: !asc.length
      ? "Every location in this book reads highest number first."
      : (secs.length && asc.length === secs.length
         ? "Every location in this book reads lowest number first."
         : "Lowest number first at: " + list(asc) +
           ". Everywhere else in this book, highest number first.") });
    // a road is named for its location, so it belongs to whichever book has it
    const roads = (env.roadPosAsc || [])
      .filter(([road]) => !secs.length || secs.some(s => road.startsWith(s)));
    if (has(roads))
      ord.push({ p: "Individual roads that face the opposite way to the rest " +
        "of their location: " + roads.map(([road, up]) =>
          road + " reads " + (up ? "lowest" : "highest") + " number first")
          .join("; ") + "." });
    /* Position is the order it left the BERTH in. Where it backs into the
       platform and pulls out the same end, that order is stale by the time
       it leaves, and the sheet wants the order it leaves in. */
    const turns = (env.platformTurn || []).filter(inBook).slice().sort();
    if (has(turns))
      ord.push({ p: "At " + list(turns) + " a formation that backs into the " +
        "platform and leaves the way it came in is standing the other way " +
        "round by the time it goes, so it is printed the other way up. The " +
        "position numbers give the order it left the sidings in; the sheet " +
        "wants the order it leaves the platform in. One that runs straight " +
        "through the platform, in one end and out the other, keeps the " +
        "order the numbers give. Anything calling at the platform off a " +
        "road we have not been told the direction of is left alone and put " +
        "on the review list." });
    ord.push({ p: "Where a formation still comes out the wrong way round, we " +
      "hold the right answer in a list instead of guessing at it. Those are " +
      "corrections colleagues have given us and we have checked against the " +
      "real book, and they always beat the position numbers." });
    /* The weekday directions were worked out against hand-marked weekday
       books. Carrying them onto the weekend books put 53 of 71 formations
       the wrong way round against the marked Sunday 16/08 book, so they
       stayed with the books they came from - and a colleague reading this
       page has to be told, or they will check a Sunday sheet against the
       wrong rule. */
    ord.push({ p: "None of this applies to a Saturday or Sunday sheet. Those " +
      "are built from the weekend diagram prints, and they read lowest " +
      "number first everywhere, at every location. The which-way-round list " +
      "above was worked out against the marked-up weekday books and belongs " +
      "to them: checked against the marked Sunday book it put most " +
      "formations the wrong way round." });
    push("order", "Which unit prints first", ord);

    /* ---- 4. times ---- */
    const t = [
      { ul: [
        "The day runs from " + hhmm(env.dayRoll || 180) + " round to " +
        hhmm(env.dayRoll || 180) + " the next morning, so a departure at " +
        "01:30 belongs to the night before, not to the new day.",
        /* One line, three ways round - two of them used to print alongside a
           flat "the time printed is the departure time", which said the same
           thing twice on any book with no first-departure section (the High
           Speed one, every time). The named sections are filtered to the
           ones this book actually has, the way every other list here is:
           the Ramsgate book was naming Grove Park and Slade Green. */
        (env.firstDepAll
          ? "Every entry in this book is timed off the moment the unit first " +
            "moves, so a unit that comes out of the sidings empty before " +
            "picking up its platform working shows the sidings time. A unit " +
            "that starts in the platform shows its platform time, because " +
            "that IS its first move."
          : (has((env.firstDep || []).filter(inBook))
             ? "The time printed is the booked departure — except at " +
               list((env.firstDep || []).filter(inBook)) + ", where it is the " +
               "moment the unit first moves off the berth, not the platform " +
               "departure a minute or two later. That is how those books are " +
               "written."
             : "The time printed is the booked departure.")),
        "The evening starts at " + hhmm(env.pmBreak || 1200) + " for anything " +
        "the sheet calls PM.",
      ] },
      /* The two examples are the real books' own, and each is only worth
         printing in a book that has that page - the Ramsgate book is one
         page and was explaining Slade Green and Tonbridge on it. Neither
         the Metro sheet nor the allocations sheet is ruled at all. */
      notBerth ? null :
      { p: "Heavy double lines rule off the breaks in the day's work: the " +
        "first break of " + hours(env.breakGap || 180) + " or more, and any " +
        "later one where the work picks up after " + hhmm(env.pmBreak || 1200) +
        ". So a page can carry two" +
        (inBook("SLADE GREEN")
          ? " — Slade Green is ruled under its 06+36 and again under its" +
            " 18+04 —" : ",") +
        " but a lull in the middle of the afternoon draws nothing" +
        (inBook("TONBRIDGE")
          ? ": Tonbridge stands from 11+32 to 14+40 and is left unruled." : ".") +
        " A page that is busy right through gets none" +
        (inBook("GROVE PARK") ? ", and Grove Park is never ruled." : ".") },
    ];
    push("times", notBerth ? "Times" : "Times, and the line across the page", t);

    /* ---- 5. end markers ---- */
    const es = env.endStyle || {};
    const esKeys = Object.keys(es).filter(inBook).sort();
    if (esKeys.length) {
      const rows = esKeys.map(k => {
        const [a, b] = es[k];
        return [k, b ? a + " / " + b : a,
                b ? "Two or more units only" : "Any formation, single or not"];
      });
      push("ends", "Which end of the train", [
        { p: "A few locations say on the sheet which end of the formation a " +
             "unit is standing on." },
        { table: { head: ["Location", "Markers", "When it prints"], rows } },
        { p: "The difference matters. Where a location names one end only, " +
             "the marker is saying which way the unit leaves — that is just " +
             "as true of a single unit as of three, and the hand-written " +
             "book marks those singles. Where a location names both ends, " +
             "the marker is telling you which of the two units leads, so it " +
             "means nothing on its own and a single unit gets none." },
      ]);
    }

    /* ---- 6. routes ---- */
    const rb = env.routeByHc || {};
    const rbKeys = Object.keys(rb).filter(inBook).sort();
    if (rbKeys.length) {
      const rows = [];
      /* the rule is held as a pattern; on the page it has to read as the
         headcode a colleague would see on the board */
      const hcText = re => {
        const s = String(re).replace(/^\/|\/[a-z]*$/g, "").replace(/^\^/, "");
        return /^[0-9A-Z]+$/.test(s) ? s + " headcodes" : s;
      };
      for (const k of rbKeys) for (const r of rb[k])
        rows.push([k, r.dest, hcText(r.hc), "Via " + r.via,
                   r.lead ? "The " + r.lead.toUpperCase() + " end leads"
                          : "not stated"]);
      push("routes", "Where a train can go more than one way", [
        { p: "Some destinations are reached by two different routes, and on " +
             "a Sunday a whole location can send everything to the same " +
             "place by both of them. Where the headcode tells us which route " +
             "a train is taking, the sheet says so, in the notes on the " +
             "right — “Via AFK” alongside the end marker. The time column " +
             "stays as it always reads, “08 42 VIC”." },
        { table: { head: ["Location", "To", "Headcodes starting", "Prints",
                          "Front of the train"], rows } },
        { p: "Where no rule covers it, no route is printed. The tool will " +
             "not guess a route from the destination alone." },
      ]);
    }

    /* ---- 7. headcodes ---- */
    const hcs = (env.headcodeSections || []).filter(inBook).sort();
    push("headcodes", "Headcodes", notBerth ? [
      { p: "Every line of this sheet carries its headcode, in the " +
           (env.hs ? "TRAIN ID column" : "TRAIN I.D. column, written once " +
            "against the top line of the formation") + ". The " +
           "“Show every headcode” tick box is for the berthing books and " +
           "makes no difference here." },
    ] : [
      { p: hcs.length
        ? "Printed as standard at " + list(hcs) + ", because those books " +
          "carry them. Anywhere else, tick “Show every headcode” " +
          "before you build and every line gets one in the notes column."
        : "No location in this book carries headcodes as standard. Tick " +
          "“Show every headcode” before you build to put one on " +
          "every line." },
      // both habits belong to one page each, so only their own book says so
      (inBook("VICTORIA") || inBook("GROVE PARK")) ? { p: "Local habits. " +
        (inBook("VICTORIA")
          ? "At Victoria the note carries the empty-stock headcode off the " +
            "sidings while the time stays the platform departure — except " +
            "where one empty in forms two services out of the platform, when " +
            "that headcode would name both rows and identify neither, so each " +
            "row shows its own departure. " : "") +
        (inBook("GROVE PARK")
          ? "At Grove Park the road is printed after the headcode." : "")
        } : null,
    ]);

    /* ---- 8. words on the sheet ----
       The end markers are read back off the same table section 5 draws, so a
       book cannot be told to look for a marker no page in it prints. */
    const marks = [];
    for (const k of esKeys) for (const m of es[k]) if (m && marks.indexOf(m) < 0) marks.push(m);
    push("words", "The words you will see in the notes", [
      { table: { head: ["Note", "What it means"], rows: [
        ["ATTACHMENT", "Another unit joins this train and the two run on as " +
         "one, under one headcode. They need not leave the berth together - " +
         "the other unit can run empty into the platform and become part of " +
         "the working there. It does not mean some other train happens to " +
         "leave the same place in the same minute, and a unit that joins " +
         "further down the line is that place's note, not this one's."],
        ["SPLITS", "These units come apart again later today."],
        ["SPLITS PM", "They are put away together first, and only come " +
         "apart later on — on the second half of the diagram, after the " +
         "depot. It is about where in the day's work the parting falls, " +
         "not what time it happens."],
        ["UP SIDINGS, EAST SIDINGS, UPS, DNM, JUB",
         "Short names for the road the unit came off, printed where the " +
         "location has more than one."],
      ].concat(inBook("FOLKESTONE EAST") ? [["EX 22+15 ARR",
         "Folkestone East only. The Train Roads are unmanned and work " +
         "last in, first out, so the note says which of last night's " +
         "arrivals formed this unit. It is worked out from the reports — " +
         "check it against the ACWN."]] : [],
        marks.length ? [[marks.join(", "),
         "Which end of the station this unit stands at. See above."]] : []) } },
    ]);

    /* ---- 9. the corrections list ---- */
    const ofx = env.orderFix || {};
    const rows = [];
    for (const k of Object.keys(ofx).sort()) {
      const r = orderRow(k, ofx[k]);
      if (!r) continue;
      if (r.where !== "Anywhere" && !inBook(r.where)) continue;
      rows.push([r.where, r.when, r.formation, r.prints]);
    }
    push("corrections", "Formations we have been told the right way round", [
      { p: "These are the formations where the position numbers do not give " +
           "the order the real book uses, so somebody has told us the answer " +
           "and it is held here. Read a row as: at this location, on this " +
           "departure, the formation made up of these diagrams prints in " +
           "this order." },
      rows.length
        ? { table: { head: ["Location", "When", "Diagrams running together",
                            "Prints in this order"], rows } }
        : { p: "Nothing in this book needs correcting." },
      { note: "If you find one that is still wrong, the Unit order tab " +
        "inside the tool has a Reverse button against every coupled " +
        "formation in the build. Pressing it turns that formation round and " +
        "rebuilds the books straight away so you can see the result — but " +
        "the change only lives on the computer you pressed it on. That tab " +
        "lists everything you have turned round, in words; tell us what it " +
        "says and it gets built into the tool for everybody." },
    ]);

    /* ---- 10. what it will not do ---- */
    push("limits", "What the tool will not decide for you", [
      { ul: [
        "It does not know which way a train physically faces. Everything " +
        "about formation order comes from the position numbers" +
        (notBerth ? "." : " and the corrections list above."),
        "It does not read the Sectional Appendix, and it makes no claim " +
        "about gauge clearance, route availability or what may run where. " +
        "Those questions go to the Appendix and the Weekly Operating Notice.",
        "It does not invent a unit number. Where the report does not name " +
        "the allocated unit, the cell stays empty for the depot to fill in.",
        "Anything it was unsure about is written on the Review tab of that " +
        "book rather than guessed at on the sheet.",
      ] },
      { p: "The weekend sheets are built from the diagram prints rather " +
           "than the weekday reports, and they follow these same rules for " +
           "the times, the breaks, the headcodes and which movements get a " +
           "line. Two things do not carry over. Which unit prints first: a " +
           "weekend sheet reads lowest position number first everywhere, " +
           "not by the which-way-round list. And the corrected formations " +
           "above, which name weekday diagram numbers — the weekend prints " +
           "number their diagrams separately." },
      { note: "The sheets are built from the reports you feed in. If the " +
        "report is wrong, the sheet will be wrong in the same way — the " +
        "tool has no other source to check it against." },
    ]);

    return S;
  }

  /* The same sections as HTML. Both readers use this, so the tab and the
     handout cannot say different things. */
  /* `pick` selects which sections to render: {only:[ids]} or {skip:[ids]}.
     The tool splits them across two tabs - the order corrections sit with
     the Reverse buttons that write them, and everything else is reference -
     while the printed handout takes the lot. Same call either way. */
  /* Which sections belong on which document, in one place. Both readers ask
     for it: the tool's own Rules tab and the printed handout. They used to
     each keep their own list, and the handout's was simply never written -
     so it described the Metro sheet and the allocations sheet as berthing
     sheets for as long as they had existed.

     kind: "metro" or "hs" for the depot's own documents, anything else for a
     berthing book. withCorrections is for the handout, which prints the
     corrections inline; the tool leaves them to the Unit order tab, next to
     the buttons that write them. */
  const BERTH_ONLY = ["order", "ends", "routes", "words"];
  function pickFor(kind, withCorrections) {
    const notBerth = kind === "metro" || kind === "hs";
    // an order the sheet does not use cannot have corrections either
    const skip = notBerth ? BERTH_ONLY.concat("corrections")
                          : (withCorrections ? [] : ["corrections"]);
    return { skip };
  }

  function explainHtml(env, pick) {
    const only = pick && pick.only, skip = (pick && pick.skip) || [];
    const out = [];
    for (const sec of explain(env)) {
      if (only && only.indexOf(sec.id) < 0) continue;
      if (skip.indexOf(sec.id) >= 0) continue;
      out.push('<section class="rule-sec" id="r-' + esc(sec.id) + '">');
      out.push("<h3>" + esc(sec.title) + "</h3>");
      for (const b of sec.blocks) {
        if (!b) continue;
        if (b.p) out.push("<p>" + esc(b.p) + "</p>");
        else if (b.note) out.push('<p class="rule-note">' + esc(b.note) + "</p>");
        else if (b.ul) out.push("<ul>" +
          b.ul.filter(Boolean).map(x => "<li>" + esc(x) + "</li>").join("") +
          "</ul>");
        else if (b.table) {
          out.push('<table class="rules-t"><thead><tr>' +
            b.table.head.map(x => "<th>" + esc(x) + "</th>").join("") +
            "</tr></thead><tbody>");
          for (const r of b.table.rows)
            out.push("<tr>" + r.map(x => "<td>" + esc(x) + "</td>").join("") +
                     "</tr>");
          out.push("</tbody></table>");
        }
      }
      out.push("</section>");
    }
    return out.join("");
  }

  return { VERSION, parseKey, validEdit, mergeOrderFix, keyForms, chooseKey,
           parse, serialize,
           explain, explainHtml, pickFor, orderRow };
})();
if (typeof module !== "undefined" && module.exports) module.exports = SHEETS_RULES;
if (typeof globalThis !== "undefined") globalThis.SHEETS_RULES = SHEETS_RULES;
