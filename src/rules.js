/* SHEETS_RULES — the pure part of local rule edits: the key grammar, the
   merge, and the export. No DOM, no storage, no build knowledge, so it can
   be reasoned about and tested on its own.

   An edit is one entry in an object keyed exactly as ORDER_FIX is keyed:
   an array pins the order, null switches a shipped pin off. That is the
   whole vocabulary - the tool ships a table, the operator overlays it, and
   the overlay exports as lines that can be pasted back into data.js so the
   correction stops being local. Editing anything richer than unit order is
   deliberately not offered: order is the table testers actually correct,
   and it is the one with a closed, checkable grammar. */
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

  /* Exactly the shape of an ORDER_FIX line in data.js, so the answer to a
     correction is to paste it in - the same convention the mark-up sheet
     generator already follows. */
  function dataJsLines(orderFix) {
    const out = [];
    for (const k of Object.keys(orderFix || {}).sort()) {
      const v = orderFix[k];
      if (v === null) out.push('    // remove from ORDER_FIX: "' + k + '"');
      else out.push('    "' + k + '": ["' + v.join('", "') + '"],');
    }
    return out;
  }

  function exportText(orderFix, tag) {
    const n = Object.keys(orderFix || {}).length;
    const lines = [
      "Unit order corrections" + (tag ? " from " + tag : ""),
      n + " edit" + (n === 1 ? "" : "s") + " made on the machine that built these books.",
      "",
      "Paste these into ORDER_FIX in src/data.js to make them permanent:",
      "",
    ].concat(dataJsLines(orderFix), [
      "",
      "The same edits as this page stores them:",
      "",
      serialize(orderFix, null),
    ]);
    return lines.join("\n");
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

    /* ---- 1. the page itself ---- */
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
        ["P.M.", "Where this unit stands for the night."],
        ["Unit", "The unit number where the report names one. Where it does " +
                 "not, the cell is left ruled and empty for the depot to " +
                 "write in — and you can type into it in Excel."],
        ["Flag", "Written once across the whole formation. SPLITS means these " +
                 "units come apart later in the day; SPLITS PM means that " +
                 "happens in the evening."],
        ["Notes", "Anything else about that one unit: the headcode, the " +
                  "siding it came off, ATTACHMENT, and which end of the " +
                  "train it is."],
      ] } },
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
        "A move that never leaves the Grove Park depot fence is not a line.",
        "A unit that stands somewhere for the last time in the day and then " +
        "runs empty to a depot was only berthed there if it was actually put " +
        "away — the report marks that with a shunt against the stand. " +
        "Without one it was waiting on the way home, and the line belongs to " +
        "the depot it is going to, not to the place it paused.",
        "A unit that hops out and is back within " + (env.runRound || 60) +
        " minutes has been run round, not berthed twice — one line, not two.",
      ] },
    ];
    if (has(env.ecsOnlyOk))
      off.push({ p: "Three places work differently because their empty moves " +
        "are the whole point of the location: " + list(env.ecsOnlyOk) +
        " keep their empty moves even inside their own area." });
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
    ord.push({ p: asc.length
      ? "Lowest number first at: " + list(asc) +
        ". Everywhere else in this book, highest number first."
      : "Every location in this book reads highest number first." });
    if (has(env.roadPosAsc))
      ord.push({ p: "Individual roads that face the opposite way to the rest " +
        "of their location: " + env.roadPosAsc.map(([road, up]) =>
          road + " reads " + (up ? "lowest" : "highest") + " number first")
          .join("; ") + "." });
    ord.push({ p: "Where a formation still comes out the wrong way round, we " +
      "hold the right answer in a list instead of guessing at it. Those are " +
      "corrections colleagues have given us and we have checked against the " +
      "real book, and they always beat the position numbers." });
    push("order", "Which unit prints first", ord);

    /* ---- 4. times ---- */
    const t = [
      { ul: [
        "The day runs from " + hhmm(env.dayRoll || 180) + " round to " +
        hhmm(env.dayRoll || 180) + " the next morning, so a departure at " +
        "01:30 belongs to the night before, not to the new day.",
        "The time printed is the departure time.",
        (env.firstDepAll
          ? "Every entry in this book is timed off the moment the unit first " +
            "moves, so a unit that comes out of the sidings empty before " +
            "picking up its platform working shows the sidings time. A unit " +
            "that starts in the platform shows its platform time, because " +
            "that IS its first move."
          : (has(env.firstDep)
             ? "At " + list(env.firstDep) + " the time is the moment the " +
               "unit first moves off the berth, not the platform departure a " +
               "minute or two later — that is how those books are written."
             : "The time is the booked departure.")),
        "The evening starts at " + hhmm(env.pmBreak || 1200) + " for anything " +
        "the sheet calls PM.",
      ] },
      { p: "Heavy double lines rule off the breaks in the day's work. Any " +
        "break of " + hours(env.breakGap || 180) + " or more with work still " +
        "to come after it gets one, so a page can carry two or three — Slade " +
        "Green is ruled under its 06+36 and again under its 18+04. A page " +
        "that is busy right through gets none, and Grove Park is never " +
        "ruled." },
    ];
    push("times", "Times, and the line across the page", t);

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
             "a train is taking, the sheet says so — “08 42 VIC Via " +
             "AFK” rather than just “08 42 VIC”." },
        { table: { head: ["Location", "To", "Headcodes starting", "Prints",
                          "Front of the train"], rows } },
        { p: "Where no rule covers it, no route is printed. The tool will " +
             "not guess a route from the destination alone." },
      ]);
    }

    /* ---- 7. headcodes ---- */
    const hcs = (env.headcodeSections || []).filter(inBook).sort();
    push("headcodes", "Headcodes", [
      { p: hcs.length
        ? "Printed as standard at " + list(hcs) + ", because those books " +
          "carry them. Anywhere else, tick “Show every headcode” " +
          "before you build and every line gets one in the notes column."
        : "No location in this book carries headcodes as standard. Tick " +
          "“Show every headcode” before you build to put one on " +
          "every line." },
      { p: "Two local habits. At Victoria the note carries the empty-stock " +
           "headcode off the sidings while the time stays the platform " +
           "departure — except where one empty in forms two services out " +
           "of the platform, when that headcode would name both rows and " +
           "identify neither, so each row shows its own departure. At " +
           "Grove Park the road is printed after the headcode." },
    ]);

    /* ---- 8. words on the sheet ---- */
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
        ["EX 22+15 ARR",
         "Folkestone East only. The Train Roads are unmanned and work " +
         "last in, first out, so the note says which of last night's " +
         "arrivals formed this unit. It is worked out from the reports — " +
         "check it against the ACWN."],
        ["TON END, ORE END, HGS END, AFK END, DVP END, FKE END, CBE END",
         "Which end of the station this unit stands at. See above."],
      ] } },
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
      { note: "If you find one that is still wrong, the Rules tab inside the " +
        "tool has a Reverse button against every coupled formation in the " +
        "build. Pressing it turns that formation round and rebuilds the " +
        "books straight away so you can see the result — but the change " +
        "only lives on the computer you pressed it on. Use “Export " +
        "rule edits” on the same card and send us the file, and it " +
        "gets built into the tool for everybody." },
    ]);

    /* ---- 10. what it will not do ---- */
    push("limits", "What the tool will not decide for you", [
      { ul: [
        "It does not know which way a train physically faces. Everything " +
        "about formation order comes from the position numbers and the " +
        "corrections list above.",
        "It does not read the Sectional Appendix, and it makes no claim " +
        "about gauge clearance, route availability or what may run where. " +
        "Those questions go to the Appendix and the Weekly Operating Notice.",
        "It does not invent a unit number. Where the report does not name " +
        "the allocated unit, the cell stays empty for the depot to fill in.",
        "Anything it was unsure about is written on the Review tab of that " +
        "book rather than guessed at on the sheet.",
      ] },
      { p: "The weekend sheets are built from the diagram prints rather than " +
           "the weekday reports, but they follow these same rules — the same " +
           "tables decide the order, the times, the breaks and the " +
           "headcodes. The one thing that does not carry over is the list of " +
           "corrected formations above: those name weekday diagram numbers, " +
           "and the weekend prints number their diagrams separately." },
      { note: "The sheets are built from the reports you feed in. If the " +
        "report is wrong, the sheet will be wrong in the same way — the " +
        "tool has no other source to check it against." },
    ]);

    return S;
  }

  /* The same sections as HTML. Both readers use this, so the tab and the
     handout cannot say different things. */
  function explainHtml(env) {
    const out = [];
    for (const sec of explain(env)) {
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
           parse, serialize, dataJsLines, exportText,
           explain, explainHtml, orderRow };
})();
if (typeof module !== "undefined" && module.exports) module.exports = SHEETS_RULES;
if (typeof globalThis !== "undefined") globalThis.SHEETS_RULES = SHEETS_RULES;
