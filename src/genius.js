/* GENIUS - build daily berthing sheets from the Genius Diagram Summary +
   Diagram Detail PDF reports, applying the weekend sheet builder's rulebook:
   stints between berth boundaries, section groups, run-round suppression,
   first-departure sections, D/E columns, ECS suppression, END markers, and
   the weekend engine's own station resolver for every code. */
const GENIUS = (() => {
  const { CODE2NAME, GROUP_EXTRA, STABLE_CODES, NAME_CODE, FIX_CODE,
          MINOR_SPUR, BERTH_AREAS, PROFILES_G, ORDER_FIX,
          routeRule } = SHEETS_DATA;
  const END_MARKERS = SHEETS_DATA.END_MARKERS_GENIUS;
  /* sorted diagram list -> the places an order was written down for it.
     Bare keys are left out on purpose: they fire everywhere, so they can
     never be the pin that quietly missed. */
  function orderFixKeys(table) {
    const m = new Map();
    for (const k of Object.keys(table)) {
      const i = k.indexOf("|");
      if (i < 0) continue;
      const diags = k.slice(i + 1);
      if (!m.has(diags)) m.set(diags, new Set());
      m.get(diags).add(k.slice(0, i));
    }
    return m;
  }
  const ORDER_FIX_KEYS = orderFixKeys(ORDER_FIX);
  /* The locations the books actually print a page for. */
  const PAGE_SECTIONS = new Set([...SHEETS_DATA.MAIN_ORDER,
    ...SHEETS_DATA.METRO_ORDER, ...SHEETS_DATA.HS_ORDER]);
  const { DAY_ROLL, AM_CUTOFF, PM_BREAK, RUN_ROUND, runsOf } = SHEETS_RULEBOOK;
  // ---- pdf text extraction (machine reports; Flate streams) ----
  function inflate(u8) { return fflate.unzlibSync(u8); }
  function latin(u8) {
    let s = "";
    for (let i = 0; i < u8.length; i += 32768)
      s += String.fromCharCode.apply(null, u8.subarray(i, i + 32768));
    return s;
  }
  function pdfText(u8) {
    const s = latin(u8);
    const out = [];
    const re = /stream\r?\n/g;
    let m;
    while ((m = re.exec(s)) !== null) {
      const start = m.index + m[0].length;
      const end = s.indexOf("endstream", start);
      if (end < 0) continue;
      let txt;
      try { txt = latin(inflate(u8.subarray(start, end))); }
      catch (e) { txt = s.slice(start, end); }
      if (!/T[jJ]/.test(txt)) continue;
      const lines = new Map();
      let y = 0, x = 0, fsz = 10;
      const ops = txt.match(
        /[-0-9.]+ [-0-9.]+ T[dD]|[-0-9.]+ [-0-9.]+ [-0-9.]+ [-0-9.]+ [-0-9.]+ [-0-9.]+ Tm|\/F\S+ ([-0-9.]+) Tf|\((?:[^()\\]|\\.)*\) *Tj|\[[^\]]*\] *TJ/g) || [];
      for (const op of ops) {
        if (op.endsWith("Tf")) { fsz = parseFloat(op.split(/\s+/)[1]) || fsz; }
        else if (op.endsWith("Tm")) { const p = op.split(/\s+/); x = +p[4]; y = +p[5]; }
        else if (/T[dD]$/.test(op)) { const p = op.split(/\s+/); x += +p[0]; y += +p[1]; }
        else {
          let t = "";
          if (op.endsWith("TJ")) {
            for (const mm of op.matchAll(/\((?:[^()\\]|\\.)*\)/g)) t += mm[0].slice(1, -1);
          } else t = op.replace(/\) *Tj$/, "").slice(1);
          t = t.replace(/\\([()\\])/g, "$1")
               .replace(/\\(\d{1,3})/g, (a, b) => String.fromCharCode(parseInt(b, 8)));
          const key = Math.round(y / 2) * 2;
          if (!lines.has(key)) lines.set(key, []);
          lines.get(key).push([x, t, x + t.length * fsz * 0.55]);
        }
      }
      const keys = [...lines.keys()].sort((a, b) => b - a);
      for (const k of keys) {
        const parts = lines.get(k).sort((a, b) => a[0] - b[0]);
        let line = "", endX = null;
        for (const [px, pt, pe] of parts) {
          if (endX !== null) line += (px - endX < 4) ? "" : "  ";
          line += pt; endX = pe;
        }
        out.push(line);
      }
    }
    return out.join("\n");
  }

  // ---- report parsing ----
  const HC = /^\d[A-Z]\d\d[A-Z]{0,2}$/, TM = /^\d\d:\d\d$/;
  const mins = t => parseInt(t.slice(0, 2), 10) * 60 + parseInt(t.slice(3), 10);
  /* A clock cell as the exports write it, or null if it is not one. Excel
     drops the leading zero when a CSV is opened and saved again ("8:34:00"
     for 08 34), and mins() reads that as 04 34 with nothing said. */
  const tmin = v => {
    const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(String(v == null ? "" : v).trim());
    if (!m) return null;
    const h = +m[1], mi = +m[2];
    return (h < 24 && mi < 60) ? h * 60 + mi : null;
  };
  const sortkey = t => (t % 1440) < DAY_ROLL ? (t % 1440) + 1440 : (t % 1440);
  function parseSummary(txt) {
    const rows = [];
    let date = null;
    for (const raw of txt.split("\n")) {
      const l = raw.trim();
      const dm = /Diagram Summary for:\s*(\d\d\/\d\d\/\d{2,4})/.exec(l);
      if (dm) { date = shortDate(dm[1]); continue; }
      const t = l.split(/\s{2,}/);
      if (!/^[A-Z]{2}\d{3}$/.test(t[0] || "")) continue;
      if (t.length < 8 || !TM.test(t[4]) || !TM.test(t[7])) continue;
      rows.push({ date, diag: t[0], fleet: t[1], pos: parseInt(t[3], 10),
                  start: mins(t[4]), from: t[5], to: t[6], end: mins(t[7]) });
    }
    return rows;
  }

  function parseDetail(txt) {
    const byDate = new Map();
    let cur = null, prev = -1;
    for (const raw of txt.split("\n")) {
      const l = raw.trim();
      // full header, or the degraded form where "Diagram"/"On" were lost
      const dm = /Diagram\s+([A-Z]{2}\s?\d\s?\d\s?\d)\s+On\s+(\d\d\/\d\d\/\d{2,4})/.exec(l)
              || /^([A-Z]{2}\s?\d\s?\d\s?\d)\s+(\d\d\/\d\d\/\d{2,4})$/.exec(l);
      if (dm) {
        const diag = dm[1].replace(/\s+/g, ""), date = shortDate(dm[2]);
        if (!byDate.has(date)) byDate.set(date, new Map());
        cur = []; byDate.get(date).set(diag, cur); prev = -1;
        continue;
      }
      if (!cur) continue;
      const t = l.split(/\s{2,}/);
      if (!/^[A-Z0-9]{3,8}$/.test(t[0] || "") || /^GENIUS/.test(t[0])) continue;
      const times = t.filter(v => TM.test(v));
      const hc = t.find(v => HC.test(v)) || null;
      if (!times.length) continue;
      const nameEnd = t.indexOf(times[0]);
      const name = t.slice(1, nameEnd).join(" ");
      let arr = null, dep = null;
      if (times.length >= 2) { arr = mins(times[0]); dep = mins(times[1]); }
      else if (cur.length === 0) dep = mins(times[0]);
      else arr = mins(times[0]);
      for (const k of ["arr", "dep"]) {
        let v = k === "arr" ? arr : dep;
        if (v === null) continue;
        while (v < prev - 60) v += 1440;
        prev = Math.max(prev, v);
        if (k === "arr") arr = v; else dep = v;
      }
      // the shunt marker survives the column split as a token of its own
      cur.push({ code: t[0], name, arr, dep, hc: hc ? hc.slice(0, 4) : null,
                 act: t.indexOf("#") > 0 ? "#" : null });
    }
    return byDate;
  }
  // ---- locations ----
  const locName = s => CODE2NAME[s.code] || s.name;
  const berthInfo = s => SHEETS_CORE.BERTH_SHEETS[SHEETS_CORE.norm(locName(s))] || null;
  // The section a location berths into, without asking the resolver - used
  // only to compare two locations, so an unknown name standing for itself is
  // as good an answer as any.
  const areaOf = s => {
    const bi = berthInfo(s);
    return (bi && bi[0]) || SHEETS_CORE.norm(locName(s));
  };
  const sameArea = (a, b) =>
    a === b || BERTH_AREAS.some(g => g.has(a) && g.has(b));
  const SE = () => (typeof SheetsEngine !== "undefined" ? SheetsEngine : null);
  // Sidings, depots and sheds only — see data.js STABLE_CODES.
  const isStabling = s => STABLE_CODES.has(s.code) ||
    (SE() ? SE().looksLikeStabling(locName(s))
          : /(sd|sdg|sids?|sidings?|dep|depot|shed|yard|yd|dms|ebs)\s*$/i.test(locName(s)));
  function viaResolver(name, table, warn, where) {
    const se = SE();
    if (!se) return name.slice(0, 3).toUpperCase();
    const local = [];
    const c = se.codeFor(name, table, local, where);
    for (const w of local)
      if (!(w[0] === "resolved" && (w[2] === "high" || w[2] === "manual")))
        warn.push({ sec: null,
                    msg: w.map(x => x == null ? "" : x).join(" ").trim() });
    return c;
  }
  function destCode(name, warn, where) {
    const nm0 = SHEETS_CORE.norm(name);
    if (NAME_CODE[nm0]) return NAME_CODE[nm0];
    const d = SHEETS_CORE.destTlc(name);
    if (d && !d.includes("?")) return FIX_CODE[d] || d;
    const c = viaResolver(name, SE() ? SE().DEST_CODE : {}, warn, where);
    return FIX_CODE[c] || c;
  }
  // corrections learned from the hand-built sheets: these beat whatever
  // the tables or the resolver come back with
  function bcode(name, warn, where) {
    const nm = SHEETS_CORE.norm(name);
    if (NAME_CODE[nm]) return NAME_CODE[nm];
    const r = SHEETS_CORE.amPm([[nm, 0, null, true, "settle"]], []);
    if (r[1]) return FIX_CODE[r[1]] || r[1];
    const c = viaResolver(name, SE() ? SE().BERTH_CODE : {}, warn, where);
    return FIX_CODE[c] || c;
  }
  const DAY_OF = { 1: "M", 2: "T", 3: "W", 4: "TH", 5: "F" };
  const DAY_NAME = { M: "MON", T: "TUE", W: "WED", TH: "THU", F: "FRI" };
  function dayKey(date) {
    const [d, mo, y] = String(date || "").split("/").map(Number);
    if (!d || !mo || !y) return null;
    return DAY_OF[new Date(y < 100 ? 2000 + y : y, mo - 1, d).getDay()] || null;
  }
  // ---- the weekend engine's shapes, over Genius itineraries ----
  function stopsOf(raw) {
    // collapse consecutive same-location rows; carry identities in and out
    const out = [];
    let lastHc = null;
    for (const [i, j1] of runsOf(raw, s => s.code, null)) {
      const grp = raw.slice(i, j1 + 1);
      let hcOut = null;
      for (let k = grp.length - 1; k >= 0; k--) if (grp[k].hc) { hcOut = grp[k].hc; break; }
      let arr = null;
      for (const x of grp) if (x.arr !== null) { arr = x.arr; break; }
      let dep = null;
      for (let k = grp.length - 1; k >= 0; k--) if (grp[k].dep !== null) { dep = grp[k].dep; break; }
      // ml: the running mileage on ARRIVAL here - a stint's own mileage is
      // the delta between its two ends' figures. Only set where the source
      // carries it (the CSV does, the PDF does not), so the collapsed stops
      // keep the exact shape the golden tests pin on the PDF path.
      let ml;
      for (const x of grp) if (x.ml !== undefined) { ml = x.ml; break; }
      const stop = { code: grp[0].code, name: grp[0].name, arr, dep,
                     hcIn: lastHc, hcOut,
                     act: grp.some(x => x.act === "#") ? "#" : null };
      if (ml !== undefined) stop.ml = ml;
      out.push(stop);
      if (hcOut) lastHc = hcOut;
    }
    return out;
  }
  // A home berthing siding splits the diagram whenever the identity
  // changes there - the books list every re-departure off those roads,
  // even after a 40-minute sit (the manual's 14+41 / 15+43 / 16 27
  // Ashford rows prove it). Only the SHUNT SPURS - places that host
  // brief working calls all day and are never listed as re-departures -
  // need a stay of berthing length before they split.
  const BERTH_STAY = 65;
  /* The roads inside the Grove Park depot fence. A move from one of these to
     another never leaves the depot, so it is a shunt the sheets do not carry -
     the units have not gone anywhere a reader needs telling about. GRVPK, the
     station, is deliberately absent: depot to platform is a real departure. */
  const GP_DEPOT = new Set(["GRVPCSD", "GRVPDCE", "GRVPDLE", "GRVPKDS",
                            "GRVPKUS", "GRVPUHS"]);
  /* A unit that stands in a PLATFORM long enough has been berthed there as
     far as the sheet is concerned - GT120/GT121 arrive at Victoria at 22 40
     and leave at 23 40 for Meopham, and the book carries that line. But a
     platform is not a siding, so this is not the general rule: it fires only
     where the report says the unit was actually shunted on the spot ("#"),
     or where the operator has asked for platform stands to be included.
     Everything else long enough to be one is named on the review list
     instead - between three and fourteen a day across the reports seen. */
  function platformStand(s, opts) {
    if (isStabling(s)) return null;               // already a berth
    if (s.arr === null || s.dep === null) return null;
    let dwell = s.dep - s.arr;
    if (dwell < 0) dwell += 1440;
    if (dwell < RUN_ROUND) return null;           // a turnround, not a stand
    return { dwell, shunted: s.act === "#" };
  }
  function boundaries(stops, opts) {
    opts = opts || {};
    const b = new Set();
    for (let k = 0; k < stops.length; k++) {
      const s = stops[k];
      if (k === 0 || k === stops.length - 1) { b.add(k); continue; }
      if (!isStabling(s)) {
        const st = platformStand(s, opts);
        if (st && (st.shunted || opts.platformStands) && s.hcIn !== s.hcOut) {
          b.add(k);
          if (opts.seen) opts.seen.push({ k, dwell: st.dwell, shunted: st.shunted,
                                          took: true });
        } else if (st && s.hcIn !== s.hcOut && opts.seen) {
          opts.seen.push({ k, dwell: st.dwell, shunted: false, took: false });
        }
        continue;
      }
      if (s.hcIn === s.hcOut) continue;
      const dwell = (s.arr !== null && s.dep !== null) ? s.dep - s.arr : null;
      if (MINOR_SPUR.has(s.code) && dwell !== null && dwell < BERTH_STAY) continue;
      /* A run through the washer and straight back where it came from is a
         trip, not a berthing: the unit leaves from the platform it arrived
         at, that departure is already on the sheet, and the hand book prints
         nothing for the wash itself. Deliberately not a general out-and-back
         rule - the sidings either side of it look identical in shape, and the
         books DO list every re-departure off those (the 14+41 / 15+43 / 16 27
         Ashford rows above). Only a washer road, only when it goes back
         whence it came, only inside the run-round window, only if nothing
         was worked while it was away. */
      if (/WASHER/.test(SHEETS_CORE.norm(locName(s))) &&
          k > 0 && k + 1 < stops.length &&
          stops[k - 1].code === stops[k + 1].code &&
          dwell !== null && dwell <= RUN_ROUND &&
          (s.hcIn || "5")[0] === "5" && (s.hcOut || "5")[0] === "5") continue;
      b.add(k);
    }
    return Array.from(b).sort((x, y) => x - y);
  }
  function legEnd(stops, ei) {
    const hc = stops[ei].hcOut;
    let at = stops[ei];
    for (let i = ei + 1; i < stops.length; i++) {
      const s = stops[i];
      at = s;
      if (s.hcOut && s.hcOut !== hc && s.dep !== null) break;
    }
    return at;
  }
  function legRoute(stops, ei) {
    const hc = stops[ei].hcOut, out = [];
    for (let i = ei; i < stops.length; i++) {
      const s = stops[i];
      out.push(SHEETS_CORE.norm(locName(s)));
      if (i > ei && s.hcOut && s.hcOut !== hc && s.dep !== null) break;
    }
    return out;
  }
  function buildDate(date, sumRows, details, prof, warn, fx) {
    const core = SHEETS_CORE;
    const meta = new Map(), summ = new Map();
    // The Genius summary carries one row per working, and a unit's Position
    // changes as the day goes on - it can be first out of the sidings and
    // second by the time it leaves the platform. Keep every row, in order.
    for (const r of sumRows) {
      if (!summ.has(r.diag)) summ.set(r.diag, []);
      summ.get(r.diag).push(r);
    }
    for (const rows of summ.values())
      rows.sort((x, y) => sortkey(x.start) - sortkey(y.start));
    // Position for a working that departs at t: the row covering it, else the
    // last one to have started. (An Integrale export has a single row per
    // diagram, so this always lands on it.)
    const posAt = (rows, t) => {
      const k = sortkey(t);
      for (const r of rows)
        if (sortkey(r.start) <= k && k <= sortkey(r.end)) return r.pos;
      let best = rows[0];
      for (const r of rows) if (sortkey(r.start) <= k) best = r;
      return best.pos;
    };
    /* The allocated unit, taken the same way round as the Position: off the
       working being printed, not off the diagram's first row.

       A diagram whose morning is cancelled keeps its summary row with the
       allocation blank, and the unit is named on the workings that survived
       - so reading row one only printed nothing at all for a diagram that
       has a unit allocated all afternoon. The fall-back is any row that
       names one, because a blank cell is the absence of an answer and
       another row's is better than none. */
    const unitAt = (rows, t) => {
      const k = sortkey(t);
      for (const r of rows)
        if (r.unit && sortkey(r.start) <= k && k <= sortkey(r.end)) return r.unit;
      for (const r of rows) if (r.unit) return r.unit;
      return "";
    };
    const autoSec = new Map();
    const secOf = (stop, endpoint) => {
      const bi = berthInfo(stop);
      if (bi) return bi[0] || core.norm(locName(stop));
      if (!isStabling(stop) && !endpoint) return null;
      const nm = core.norm(locName(stop));
      if (!autoSec.has(nm)) {
        const se = SE();
        const r = se ? se.resolveStation(locName(stop)) : null;
        const secName = ((r && r.name) || locName(stop)).toUpperCase();
        autoSec.set(nm, secName);
        warn.push({ sec: secName, msg: date + " " + locName(stop) +
                  " is not in the section list - listed under " + secName });
      }
      return autoSec.get(nm);
    };
    // scope + stints
    for (const [diag, raw] of details) {
      const srs = summ.get(diag);
      /* Which book the diagram belongs to comes from the first row that
         names a fleet this book knows, not from row one flat: a diagram
         whose morning is cancelled can leave a row behind with the fleet
         cell empty, and reading only that would drop the whole diagram -
         its whole afternoon with it - without a word.

         Belt and braces rather than a reported fault: 811/812 lost their
         unit numbers, not their rows, and no export held has a blank fleet
         cell on row one. */
      const sr = srs && (srs.find(r => r.fleet in prof.fleets) || srs[0]);
      if (!sr || !(sr.fleet in prof.fleets)) continue;
      if (!raw.length) { warn.push({ sec: null, msg: date + " " + diag + ": no detail itinerary" }); continue; }
      const stops = stopsOf(raw);
      /* Platform stands long enough to be a berthing: taken when the report
         shunted the unit there or the operator asked for them, and named on
         the review list either way so the decision is never silent. */
      const stood = [];
      const bnd = boundaries(stops, { platformStands: !!fx.platformStands,
                                      seen: stood });
      for (const st of stood) {
        const at = stops[st.k];
        /* Only where the book HAS a page. A unit standing at St Pancras,
           Swanley, Margate or Maidstone East is not a berthing question:
           nothing berths there as far as these sheets are concerned, and
           without this the list fills with places nobody would look up.
           Six a day across the reports seen, against thirty-seven. */
        const secHere = secOf(at, false);
        if (!secHere || !PAGE_SECTIONS.has(secHere)) continue;
        const hh = t => String(Math.floor(t / 60) % 24).padStart(2, "0") + " " +
                        String(t % 60).padStart(2, "0");
        warn.push({ sec: secHere,
          msg: (st.took ? "Taken as a berthing — " : "Not counted as a berthing — ") +
            core.norm(locName(at)) + " " + hh(at.dep) + " (" + diag.slice(2) +
            "): the unit stands in the platform for " +
            (st.dwell >= 120 ? Math.round(st.dwell / 60) + " hours"
                             : st.dwell + " minutes") +
            (st.shunted ? " and the report shunts it there, so it is berthed"
                        : ". Tick “Count long platform stands” to put it" +
                          " on the sheet") });
      }
      const stints = [];
      for (let i = 0; i < bnd.length - 1; i++) stints.push([bnd[i], bnd[i + 1]]);
      meta.set(diag, { stops, stints, sum: sr, sums: srs, miles: raw.miles });
    }
    /* Does this report carry the shunt column at all? A PDF that lost it, or
       an Integrale export that never had it, would otherwise read as "no
       stand anywhere was shunted" and take the exception below everywhere. */
    let anyShunt = false;
    for (const [, m] of meta)
      if (m.stops.some(s => s.act === "#")) { anyShunt = true; break; }
    /* The mirror of "no detail itinerary": a diagram this book owns that
       the detail report never mentions is dropped without a word. */
    for (const [diag, srs] of summ) {
      if (details.has(diag) || !(srs[0].fleet in prof.fleets)) continue;
      warn.push({ sec: null, msg: date + " " + diag + ": in the summary but" +
        " missing from the detail report - its rows are NOT in this book" });
    }
    const entries = new Map();
    for (const [diag, m] of meta) {
      const { stops, stints } = m;
      for (let si = 0; si < stints.length; si++) {
        const [a, b] = stints[si];
        const origin = stops[a];
        const sec = secOf(origin, si === 0);
        if (sec === null) continue;
        const extra = GROUP_EXTRA[sec];
        const inGrp = s =>
          !(sec === "FOLKESTONE EAST" && s.code === "FLKSTNE") &&
          (secOf(s, false) === sec || core.norm(locName(s)) === sec ||
           (extra && extra.has(s.code)));
        // walk to the last real call inside the section: the entry is
        // timed off the final in-group stop that is a genuine call (a
        // fleeting ECS pass of the station is not one). A hop out of the
        // section and straight back with nothing worked is a run-round.
        let leaveIdx = null, lastGood = null;
        for (let k = a; k <= b; k++) {
          const s = stops[k];
          if (k > a && !inGrp(s)) {
            let back = null;
            for (let j = k; j <= b; j++) if (inGrp(stops[j])) { back = j; break; }
            const dep0 = lastGood !== null ? stops[lastGood].dep : null;
            if (back !== null && dep0 !== null && stops[back].arr !== null &&
                stops[back].arr - dep0 >= 0 && stops[back].arr - dep0 <= RUN_ROUND) {
              let worked = false;
              for (let j = (lastGood !== null ? lastGood : a); j < back; j++)
                if ("12".indexOf((stops[j].hcOut || "5")[0]) >= 0) { worked = true; break; }
              if (!worked) { k = back - 1; continue; }
            }
            break;
          }
          if (s.dep !== null) {
            // Ashford's clean-call convention: a sub-3-minute ECS drift
            // through the platform is not a call. Other sections anchor on
            // their platform whenever run through, however briefly.
            const fleeting = sec === "ASHFORD" && si === 0 && k > a &&
                core.norm(locName(s)) === sec &&
                !(s.hcOut && /^[12]/.test(s.hcOut)) &&
                s.arr !== null && s.dep - s.arr < 3;
            if (!fleeting) lastGood = k;
          }
        }
        leaveIdx = lastGood;
        if (leaveIdx === null) continue;
        let exitIdx = leaveIdx;
        if (prof.firstDepAll || prof.firstDep.has(sec)) {
          for (let k = a; k <= b; k++) if (stops[k].dep !== null) { exitIdx = k; break; }
        }
        /* Drawing forward into a headshunt is not leaving: the unit stands
           there and goes when the road is set, which is the time the book
           writes (Grove Park 5S07 - out of the Up C.H.S at 05 14, away from
           the Up Headshunt at 05 25). */
        while (!prof.firstDepAll && exitIdx < leaveIdx) {
          const nx = stops[exitIdx + 1];
          if (!nx || !/HEADSHUNT|HSHNT/i.test(locName(nx))) break;
          if (nx.arr === null || nx.dep === null || nx.dep <= nx.arr) break;
          exitIdx++;
        }
        // The metro book is timed off the first move, but a unit that only
        // runs empty from its berth into the platform alongside still shows
        // where the service it forms is going - the destination and the
        // route stay with the working leg out of the section. The two depot
        // sections keep their own long-standing wording.
        const destIdx = prof.firstDepAll && !prof.firstDep.has(sec)
          ? leaveIdx : exitIdx;
        const er = stops[exitIdx];
        const key = sec + "\u0000" + (er.dep % 1440) + "\u0000" + (er.hcOut || "");
        let e = entries.get(key);
        if (!e) {
          e = { sec, tmin: er.dep, hc: er.hcOut, hc0: stops[a].hcOut,
                hcWork: stops[leaveIdx].hcOut,
                destStop: legEnd(stops, destIdx),
                route: legRoute(stops, destIdx), units: [], origins: new Set(),
                originCodes: new Set() };
          entries.set(key, e);
        }
        e.units.push({ diag, si, exitIdx, leaveIdx });
        e.origins.add(core.norm(locName(origin)));
        e.originCodes.add(origin.code);
      }
    }
    /* Where these units part company: the first point their itineraries stop
       being the same train. Two diagrams worked as one formation carry
       identical rows until they divide, so the first row that differs is the
       parting - and if one simply runs out first, that is where it left. */
    function partsAt(diags, from) {
      /* Each unit read from ITS OWN departure on this entry: units that
         reached the berth off different roads at different times are one
         train from the moment they leave it (Grove Park 16+50 - 910 came in
         at 08 55 off Ramsgate, 059 at 14 16 off St Leonards, and they run
         to Ashford as one). The arrival minute leaves the key for the same
         reason. */
      const seqs = diags.map((d, j) => {
        const st = (meta.get(d) || {}).stops;
        return st ? st.slice(from && from[j] != null ? from[j] : 0) : null;
      }).filter(Boolean);
      if (seqs.length !== diags.length || seqs.length < 2) return null;
      const key = s => s.code + "@" + s.dep + "/" + (s.hcOut || "");
      const n = Math.min(...seqs.map(s => s.length));
      for (let i = 0; i < n; i++)
        if (new Set(seqs.map(s => key(s[i]))).size !== 1) {
          const s = seqs[0][i];
          return s.dep !== null ? s.dep : s.arr;
        }
      if (new Set(seqs.map(s => s.length)).size === 1) return null;
      const short = seqs.reduce((a, b) => a.length <= b.length ? a : b);
      const last = short[short.length - 1];
      return last.arr !== null ? last.arr : last.dep;
    }
    // per-unit derivations
    for (const e of entries.values()) {
      const blocks = [];
      for (const u of e.units) {
        const m = meta.get(u.diag);
        const { stops, stints, sum, sums, miles } = m;
        const later = stints.slice(u.si + 1).map(([a]) => stops[a]);
        // finalBerth: still on a berth at 20 00 = the PM end point, as long
        // as the late working keeps the unit in the same berthing area (see
        // BERTH_AREAS). A run out of the area is the unit going home for the
        // night, and the sheets follow it there.
        const lastStint = stints[stints.length - 1];
        const lb = stops[lastStint[0]], lastStop = stops[stops.length - 1];
        const lateMove = !!stints.length &&
          core.norm(locName(lb)) !== core.norm(locName(lastStop)) &&
          lb.dep !== null && sortkey(lb.dep) >= PM_BREAK;
        /* A diagram that goes out a THIRD time has two PM berths, and the
           column means a different one on each row. 375/3 diagram 301 works
           out of Grove Park, stands at Ramsgate from 20 34, then goes out
           again to finish at Gillingham depot: the Ashford and Grove Park
           rows read RE, because Ramsgate is where the unit is until that
           last journey, and only the row for the journey itself reads GI.
           377 diagram 103/104 is the same shape - AM GP, PM AFE, then away
           to the Folkestone train roads - and the operator wants it read
           the same way, in service or empty. So: every row before the last
           journey carries the last BERTH; the last journey's own row falls
           through to lastStop below and carries where it finishes. */
        const fbLoc = lateMove ? lb : lastStop;
        const finalStop = later.length ? fbLoc : lastStop;
        const fc = bcode(locName(finalStop), warn, u.diag);
        let D = "", E = "";
        if (later.length === 0) {
          const t = lastStop.arr !== null ? lastStop.arr : lastStop.dep;
          if (t !== null && sortkey(t) < 16 * 60) { D = fc; E = ""; }
          else { D = ""; E = fc; }
        } else {
          D = secOf(later[0], false) !== null ? bcode(locName(later[0]), warn, u.diag) : "";
          E = fc;
          // The berth the unit sits on into the night is its PM one wherever
          // it ends up afterwards, so the AM column stays empty for it.
          if (lateMove && u.si + 1 === stints.length - 1 &&
              (prof.firstDepAll || lb.arr === null ||
               sortkey(lb.arr) >= AM_CUTOFF)) D = "";
        }
        let paxAfter = false;
        for (let i = u.exitIdx + 1; i < stops.length; i++) {
          const s = stops[i];
          if (s.hcOut && /^[12]/.test(s.hcOut) && s.dep !== null) { paxAfter = true; break; }
        }
        // where and when this unit's stint ENDS: units bound for the same
        // next berth at the same time never parted on this entry - their
        // later parting is SPLITS PM business, settled by D/E
        const bEnd = stops[stints[u.si][1]];
        const path = bEnd.code + "@" + (bEnd.arr !== null ? bEnd.arr : bEnd.dep);
        /* Was this unit actually shunted while it stood here? Genius marks a
           move on the spot with "#" in the activity column. A stand with one
           is the unit being put away; a stand without one can be a pause on
           the way to somewhere else. */
        const shunted = (() => {
          const [sa, sb] = stints[u.si];
          for (let k = sa; k <= sb; k++) if (stops[k].act === "#") return true;
          return false;
        })();
        /* Where the DIAGRAM ends, which is one answer for the whole day
           rather than one per row: the Metro sheet's ENDS column reads
           "GP PM" or "SG AM" - the berth, then which half of the day it
           finishes in. */
        const endT = lastStop.arr !== null ? lastStop.arr : lastStop.dep;
        const endCode = bcode(locName(lastStop), warn, u.diag);
        const dayEnd = endCode
          ? endCode + (endT !== null && sortkey(endT) < AM_CUTOFF ? " AM" : " PM")
          : "";
        /* The allocation sheet's MG is per WORKING, not per day: AZ623 is
           143 miles on its 09+54 row and 182 on its 16+26 one. The stint's
           span in running miles gives exactly that. */
        const [sa2, sb2] = stints[u.si];
        const mg = stops[sa2].ml !== undefined && stops[sb2].ml !== undefined
          ? Math.round(stops[sb2].ml - stops[sa2].ml) : undefined;
        /* Whether this WORKING runs over the high level: a leg between
           Ebbsfleet and Gravesend, either way round, is over it; a stint
           with no such leg is not. Per stint, not per diagram - their own
           tab bears that out on 18/08, where "not over high level" sits on
           AZ623's morning and evening rows while the diagram's positioning
           start does make the transit. */
        let hl = false;
        for (let k = sa2; k < sb2; k++) {
          const p = stops[k].code, q = stops[k + 1].code;
          if ((p === "EBSFLTI" && q === "GRVSEND") ||
              (p === "GRVSEND" && q === "EBSFLTI")) { hl = true; break; }
        }
        const blk = { diag: u.diag, si: u.si, exitIdx: u.exitIdx,
                      dayEnd, miles, mg, hl,
                      pos: posAt(sums, e.tmin), D, E,
                      cls: prof.fleets[sum.fleet], paxAfter, path, shunted,
                      later: later.length > 0 };
        // only when the export actually carries it, so an entry keeps the
        // exact shape the golden test pins when it does not
        const unit = unitAt(sums, e.tmin);
        if (unit) blk.unit = unit;
        blocks.push(blk);
      }
      // Which unit leads: the whole ordering mirrors with the book's posAsc
      // (see the fleet profiles), diagram number included - it is only a
      // fallback for units the Position field cannot separate. A road that
      // faces the other way to the rest of its section overrides it, so long
      // as the whole formation came off that one road.
      const road = e.origins.size === 1 ? [...e.origins][0] : null;
      const byRoad = road === null ? undefined
        : (prof.roadPosAsc || new Map()).get(road);
      if (byRoad === undefined ? prof.posAsc.has(e.sec) : byRoad)
        blocks.sort((x, y) => (x.pos - y.pos) || (x.diag > y.diag ? -1 : 1));
      else
        blocks.sort((x, y) => (y.pos - x.pos) || (x.diag < y.diag ? -1 : 1));
      // a unit re-entering its berth to attach to another unit's first
      // departure is not listed again - the ATTACHMENT note covers it
      // (the manual's 07 55 row: GT117 listed, GT116 attaching from the
      // East Sidings shown as the note). It comes BEFORE the order lookup:
      // the key has to name the units that print, or a pin written for a
      // pair stops matching the moment a third unit attaches.
      if (blocks.length > 1 && blocks.some(x => x.si === 0) &&
          blocks.some(x => x.si > 0)) {
        e.blocks = blocks.filter(x => x.si === 0);
        e.attachment = true;
      } else e.blocks = blocks;
      // A formation the books say the reports get the wrong way round: the
      // order is taken verbatim (see ORDER_FIX). A formation that reads one
      // way in the morning and the other in the afternoon is named with its
      // time; one that holds all day is named without.
      {
        const diags = e.blocks.map(x => x.diag.slice(2)).sort().join(",");
        const kTimed = e.sec + " " + fmtT(e.tmin, e.hc) + "|" + diags;
        const kSec = e.sec + "|" + diags;
        const fix = fx.table[kTimed] || fx.table[kSec] || fx.table[diags];
        const applied = fx.table[kTimed] ? kTimed
                      : (fx.table[kSec] ? kSec : (fx.table[diags] ? diags : null));
        if (fix) e.blocks.sort((x, y) =>
          fix.indexOf(x.diag.slice(2)) - fix.indexOf(y.diag.slice(2)));
        /* A pin that silently stops matching is the worst failure this table
           has: someone wrote down the order for these very units, the working
           moved by a minute or changed headcode, and the sheet quietly went
           back to guessing with nothing to show for it. If any key was ever
           recorded for this formation and none of them fired here, say so. */
        else if (e.blocks.length > 1 && fx.keys.has(diags))
          warn.push({ sec: e.sec, msg: e.sec + " " + fmtT(e.tmin, e.hc) + " (" +
            e.blocks.map(x => x.diag.slice(2)).join("+") + "): this formation " +
            "has a corrected order recorded at " +
            [...fx.keys.get(diags)].join(" and ") + ", but not here, so this " +
            "one is ordered off the reports. Check it — it may need the same " +
            "correction" });
        /* What the lookup consulted, recorded at the lookup itself so nothing
           downstream has to re-derive a key and risk deriving a different
           one. It goes AFTER the sort on purpose: the Unit order tab labels
           this column "printed in this order", so it has to be the order
           that printed - recorded before, it showed the reports' order and
           never moved when a correction was applied to it.
           buildDate runs once per fleet into this one list, so the record
           also has to say which book it belongs to, or the mainline tab
           offers to reverse metro formations. */
        if (e.blocks.length > 1)
          fx.coupled.push({ sec: e.sec, timeText: fmtT(e.tmin, e.hc),
                            bucket: prof.bucket,
                            lookupDiags: diags, keysTried: [kTimed, kSec, diags],
                            applied, units: e.blocks.map(x => x.diag.slice(2)) });
      }
      // Two units on the same Position started the day in different
      // formations, so the reports cannot say which way round they go.
      if (e.blocks.length > 1 &&
          new Set(e.blocks.map(x => x.pos)).size !== e.blocks.length)
        warn.push({ sec: e.sec, msg: e.sec + " " + fmtT(e.tmin, e.hc) + " (" +
          e.blocks.map(x => x.diag.slice(2)).join("+") + "): the reports give " +
          "these units the same place in the formation, so they cannot say " +
          "which way round they go — check the order against the real book" });
      // SPLITS is about the units parting company, and the books take that
      // from the whole day rather than from where this stint happens to end:
      // GT107/GT108 run as one train from Ashford at 06 40 to the same berth
      // and back out again, and part at Maidstone East at 18 12 - the book
      // flags the 06 40. "PM" says the parting is still to come this
      // evening, so an entry that is itself in the afternoon just says
      // SPLITS.
      /* "PM" is not a time of day, it is a place in the diagram: the units
         go into a depot after the berth they leave here, and the parting
         comes after that - the second half of the diagram. A formation that
         parts before it berths again parts on this working, and says plain
         SPLITS however late in the day that happens. */
      {
        const t = partsAt(e.blocks.map(x => x.diag),
                          e.blocks.map(x => x.exitIdx));
        const parting = t !== null && sortkey(t) > sortkey(e.tmin);
        let berthT = null;
        for (const u of e.units) {
          const m = meta.get(u.diag);
          const s = m.stops[m.stints[u.si][1]];
          const v = s.arr !== null ? s.arr : s.dep;
          // the first of them to be put away is when the formation is berthed
          if (v !== null && (berthT === null || sortkey(v) < sortkey(berthT)))
            berthT = v;
        }
        e.splits_pm = parting && berthT !== null &&
                      sortkey(t) > sortkey(berthT);
        e.splits = parting && !e.splits_pm;
      }
      e.attachment = e.attachment || e.origins.size > 1;
      if (!e.attachment) {
        const inUnits = new Set(e.units.map(u => u.diag));
        /* An attachment is another unit JOINING this train, and the join is
           a headcode: the two need not leave the berth on the same working
           - one can run empty off the siding into the platform and become
           part of 2FXX there - but from the moment they are one train they
           carry one headcode.

           So the comparison runs from the berth to the last call in this
           section, not just the berth. Where those are the same stop this is
           the old test; where they differ - the metro book's first-move
           timing, mostly - it lets the join happen at the platform, which is
           the case the note is for. It stops at the section boundary on
           purpose: a unit that attaches further down the line belongs to
           that place's sheet (Tonbridge 06+07 joins at Tunbridge Wells).

           Same place and same minute alone is not enough: two unrelated
           trains leave a junction in the same minute all morning. */
        const u0 = e.units[0], m0 = meta.get(u0.diag);
        const run = m0.stops.slice(u0.exitIdx, u0.leaveIdx + 1)
          /* A stop the unit only passes through carries no departure and no
             headcode, and two nulls match two nulls - which would make every
             diagram that so much as calls there an attachment. */
          .filter(s => s.dep !== null && s.hcOut);
        outer:
        for (const [od, om] of meta) {
          if (inUnits.has(od)) continue;
          for (const s of om.stops)
            for (const mine of run)
              if (s.code === mine.code && s.dep === mine.dep &&
                  s.hcOut === mine.hcOut) { e.attachment = true; break outer; }
        }
      }
      for (const x of blocks) x.end = "";
      const mk = END_MARKERS[e.sec];
      if (mk && e.blocks.length > 1 && e.sec === "FOLKESTONE EAST") {
        // the Train Roads point one way: the Ashford end always leads
        e.blocks[0].end = mk.fke;
        e.blocks[e.blocks.length - 1].end = mk.cbe;
      } else if (mk && blocks.length > 1) {
        const dest = destCode(locName(e.destStop), warn, e.sec);
        let lead = null, rear = null;
        // A destination reached two ways settles it on the route first: the
        // headcode says which, and the plain destination sets cannot.
        const rr = routeRule(e.sec, dest, e.hc);
        if (rr && rr.lead) {
          lead = mk[rr.lead]; rear = mk[rr.lead === "fke" ? "cbe" : "fke"];
        } else if (mk.fkeLeads.has(dest)) { lead = mk.fke; rear = mk.cbe; }
        else if (mk.cbeLeads.has(dest) || e.route.includes(mk.cbeVia)) {
          lead = mk.cbe; rear = mk.fke;
        } else warn.push({ sec: e.sec, msg: e.sec + " " + e.tmin + " to " + dest +
                         " - no rule for which end leads" });
        if (lead) { blocks[0].end = lead; blocks[blocks.length - 1].end = rear; }
      }
      e.dest = destCode(locName(e.destStop), warn, e.sec + " " + e.tmin);
      /* Two routes to one place: say which. Only set when a rule matches, so
         every other entry keeps the exact shape the golden test pins. */
      {
        const rr = routeRule(e.sec, e.dest, e.hc);
        if (rr && rr.via) e.via = rr.via;
      }
      // Grove Park's empty moves via New Cross code to where the ECS chain
      // ends, not New Cross itself (hand rule set)
      if (e.sec === "GROVE PARK" && e.dest === "NWX" && e.hc && e.hc[0] === "5") {
        const m0 = meta.get(e.units[0].diag);
        let i = m0.stops.indexOf(e.destStop);
        while (i >= 0 && i + 1 < m0.stops.length && m0.stops[i].dep !== null &&
               m0.stops[i].hcOut && m0.stops[i].hcOut[0] === "5") i++;
        if (i >= 0) e.dest = destCode(locName(m0.stops[i]), warn, e.sec);
      }
      const dl = e.destStop;
      /* An empty move onto a berth is a shunt not worth printing - but only
         while the unit stays in this section. A 5-headcode run from Ramsgate
         depot to the Ashford sidings is the unit leaving for the night, and
         the section it leaves has to show it going, so the berth has to be
         in this section's own area for the move to count as internal. */
      e.suppress = !prof.ecsOnlyOk.has(e.sec) && !!e.hc && e.hc[0] === "5" &&
                   !blocks.some(x => x.paxAfter) &&
                   (isStabling(dl) || secOf(dl, false) === e.sec) &&
                   sameArea(areaOf(dl), e.sec);
      /* …and the going-home pause. A unit that stands somewhere for the last
         time in the day and then runs empty to a depot has been berthed there
         only if it was actually put away: Genius marks that with "#" in the
         activity column. Without one the stand is a wait on the way home -
         SG810 sits in the Dartford Down Siding from 22:53 and runs on to
         Slade Green at 23:30, which is the Slade Green book's business and
         not a Dartford berthing at all. Only applies where the report
         carries the column, so a format that drops it changes nothing. */
      if (!e.suppress && anyShunt && !prof.ecsOnlyOk.has(e.sec) &&
          !!e.hc && e.hc[0] === "5" && !blocks.some(x => x.paxAfter) &&
          isStabling(dl) && blocks.every(x => !x.shunted)) {
        e.suppress = true;
        e.pause = true;
      }
      // …and a shunt that never leaves the Grove Park depot fence is not a
      // move the sheets carry at all, whatever headcode it runs under.
      if (!e.suppress && GP_DEPOT.has(dl.code) &&
          [...e.originCodes].every(c => GP_DEPOT.has(c))) {
        e.suppress = true;
        e.gpShunt = true;
      }
    }
    // Folkestone East Train Roads is unmanned: note on each 12-car which
    // service arrival forms it. The roads work last-in-first-out, so
    // tonight's latest 12-car arrival forms tomorrow's earliest departure.
    {
      const arrs = new Map();
      for (const [, m] of meta) {
        const last = m.stops[m.stops.length - 1];
        if (last.code === "FLKSETR" && last.arr !== null)
          arrs.set(last.arr % 1440, (arrs.get(last.arr % 1440) || 0) + 1);
      }
      const bigArr = [...arrs.entries()].filter(([, n]) => n >= 3)
        .map(([t]) => t).sort((x, y) => y - x);
      const fkeBig = [...entries.values()]
        .filter(e => e.sec === "FOLKESTONE EAST" && e.blocks.length >= 3)
        .sort((x, y) => sortkey(x.tmin) - sortkey(y.tmin));
      fkeBig.forEach((e, ix) => {
        if (ix >= bigArr.length) return;
        const t = bigArr[ix];
        const ex = "EX " + String(Math.floor(t / 60)).padStart(2, "0") + "+" +
                   String(t % 60).padStart(2, "0") + " ARR";
        for (let bi = 1; bi < e.blocks.length - 1; bi++)
          if (!e.blocks[bi].end) e.blocks[bi].end = ex;
        warn.push({ sec: "FOLKESTONE EAST",
                  msg: "FOLKESTONE EAST " + fmtT(e.tmin, e.hc) + ": " + ex +
                  " is taken from tonight's Train Roads arrivals - double" +
                  " check the ACWN and change it if the times differ" });
      });
    }
    // D cross-reference: only point at entries that exist
    const live = new Set();
    for (const e of entries.values()) if (!e.suppress)
      for (const x of e.blocks) live.add(x.diag + "|" + x.si);
    for (const e of entries.values()) {
      for (const x of e.blocks)
        if (x.D && x.later && !live.has(x.diag + "|" + (x.si + 1))) x.D = "";
      if (e.suppress)
        warn.push({ sec: e.sec,
                  msg: "Left off — " + e.sec + " " + fmtT(e.tmin, e.hc) + " (" +
                  e.blocks.map(x => x.diag.slice(2)).join("+") + "): " +
                  (e.gpShunt ? "shunt inside the Grove Park depot"
                   : e.pause ? "stood here on the way to the depot, never" +
                               " shunted, so it is not a berthing here"
                   : "empty move to a berth") });
    }
    // writer-shaped sections
    const secs = new Map();
    const sorted = [...entries.values()].filter(e => !e.suppress)
      .sort((x, y) => x.sec === y.sec ? sortkey(x.tmin) - sortkey(y.tmin)
                                      : (x.sec < y.sec ? -1 : 1));
    /* Victoria's note is the ECS headcode off the sidings, because that is
       what the shunter and the platform staff are watching for. But one
       empty in can form TWO services out of the platform, and then that
       headcode names both rows and identifies neither - so where a feed is
       shared, each row shows its own departure instead. */
    const sharedFeed = new Set();
    {
      const seen = new Map();
      for (const e of sorted) {
        if (e.sec !== "VICTORIA" || !e.hc0) continue;
        seen.set(e.hc0, (seen.get(e.hc0) || 0) + 1);
      }
      for (const [hc, n] of seen) if (n > 1) sharedFeed.add(hc);
    }
    for (const e of sorted) {
      const kind = e.hc && /^[12]/.test(e.hc) ? "pax" : "ecs";
      const entry = {
        section: e.sec, time: e.tmin, time_kind: kind, dest: e.dest, sub: null,
        days: new Set([dayKey(date)].filter(Boolean)),
        // Victoria's notes column shows the ECS headcode off the sidings,
        // while the time stays from the platform
        headcode: (e.sec === "VICTORIA"
          ? (prof.firstDepAll ? (e.hcWork || e.hc)
             : (e.hc0 && !sharedFeed.has(e.hc0) ? e.hc0 : e.hc))
          : e.hc) || null,
        // first-stint departures are the overnight-berthed block: the
        // writer uses this to give Grove Park its two tables
        overnight: e.blocks.every(x => x.si === 0),
        extra_notes: [], review: [],
        units: e.blocks.map(x => {
          const u = { cls: x.cls, am: x.D, pm: x.E,
                      diag: x.diag.slice(2), end: x.end,
                      /* the Metro sheet's own columns: it prints the diagram
                         with its two-letter code, the Position as a column of
                         its own, where the diagram ends and how far it runs.
                         The berthing books use none of them. */
                      code: x.diag.slice(0, 2), pos: x.pos,
                      ends: x.dayEnd || "", miles: x.miles };
          if (x.mg != null) u.mg = x.mg;
          if (x.hl != null) u.hl = x.hl;
          // only where the export named the allocated unit, so every other
          // entry keeps the exact shape the golden test pins
          if (x.unit) u.unit = x.unit;
          return u;
        }),
        attachment: e.attachment ? {} : null,
        flag: e.splits ? "SPLITS" : (e.splits_pm ? "SPLITS PM" : ""),
        pub: { sheet: [...e.origins][0] || e.sec, row: 0, pl: null,
               n_units: e.blocks.length,
               slots: e.blocks.map(x => ({ cls: x.cls.split(" ").slice(1).join(" ") })) },
      };
      if (!secs.has(e.sec)) secs.set(e.sec, []);
      secs.get(e.sec).push(entry);
    }
    return secs;
  }
  function fmtT(t, hc) {
    const m = ((t % 1440) + 1440) % 1440;
    const s = String(Math.floor(m / 60)).padStart(2, "0") +
              (hc && /^[12]/.test(hc) ? " " : "+") + String(m % 60).padStart(2, "0");
    return s;
  }

  /* Shared tail of both weekday paths: per-date, per-fleet rulebook runs
     over parsed summary rows + detail itineraries, whatever their source. */
  function assemble(sumRows, byDate, extraNotes, opts) {
    /* The table this build runs with: the shipped one unless the page has
       local edits overlaid. Computed once so every book sees the same rules
       and the pane can show exactly what was used. */
    const edits = (opts && opts.orderFix) || {};
    const hasEdits = Object.keys(edits).length > 0;
    const fixTable = hasEdits
      ? SHEETS_RULES.mergeOrderFix(ORDER_FIX, edits) : ORDER_FIX;
    const fx = { table: fixTable, keys: orderFixKeys(fixTable), coupled: [],
                 platformStands: !!(opts && opts.platformStands) };
    const review = [];
    // per-book lists: the combined `review` keeps the legacy order, these
    // carry each fleet's own items (date-level notices go to every book)
    const reviews = { main: [], metro: [], hs: [] };
    const noteAll = m => {
      review.push(m);
      const tagged = { sec: null, msg: m };
      reviews.main.push(tagged); reviews.metro.push(tagged); reviews.hs.push(tagged);
    };
    for (const m of (extraNotes || [])) noteAll(m);
    /* A local rule edit changes what the books say, so it has to be as loud
       as anything else on the list: the books were not built with the tool
       as issued, and a correction that only ever lives on one machine is a
       correction nobody else gets. */
    if (hasEdits) {
      const n = Object.keys(edits).length;
      noteAll(n + " local rule edit" + (n === 1 ? " is" : "s are") + " in force" +
        " - these books were built with " + (n === 1 ? "it" : "them") +
        ", not with the tool as issued. Export from the Rules tab and send" +
        " back so they can be baked in");
    }
    const secsByDay = {}, metroSecs = {}, hsSecs = {}, labels = {}, built = {};
    const dayDate = {};      // the full dd/mm/yy behind each label
    const dates = [...new Set(sumRows.map(r => r.date))].filter(Boolean);
    for (const date of dates) {
      const dk = dayKey(date);
      if (!dk) { noteAll(date + ": falls on a weekend - use the weekend prints panel"); continue; }
      const det = byDate.get(date);
      if (!det) { noteAll(date + ": summary given but no detail report for this date"); continue; }
      /* A book has one column per weekday, so a second date on the same day
         name has nowhere to go - it used to overwrite the first silently,
         warnings and all. */
      if (labels[dk]) {
        noteAll(date + " is NOT in these books - it falls on the same " +
          DAY_NAME[dk] + " column as " + built[dk] + ", which is what was" +
          " built; build one week at a time");
        continue;
      }
      built[dk] = date;
      const rows = sumRows.filter(r => r.date === date);
      /* A diagram in one report and not the other is left out silently, and
         a formation it belonged to prints one unit short. */
      const haveSum = new Set(rows.map(r => r.diag));
      for (const diag of det.keys())
        if (!haveSum.has(diag))
          noteAll(date + " " + diag + ": a detail itinerary with no summary" +
            " row - the diagram is left out, check the Summary export");
      const warnMain = [], warnMetro = [], warnHs = [];
      secsByDay[dk] = buildDate(date, rows, det, PROFILES_G[0], warnMain, fx);
      metroSecs[dk] = buildDate(date, rows, det, PROFILES_G[1], warnMetro, fx);
      hsSecs[dk] = buildDate(date, rows, det, PROFILES_G[2], warnHs, fx);
      labels[dk] = DAY_NAME[dk] + " " + date.slice(0, 5);
      dayDate[dk] = date;
      for (const [warn, bag] of [[warnMain, reviews.main],
                                 [warnMetro, reviews.metro],
                                 [warnHs, reviews.hs]]) {
        for (const w of warn) {
          review.push(w.msg);
          bag.push(w);
        }
      }
    }
    /* Saturday and Sunday reports land here rather than on the weekend
       panel often enough that the message has to say where to take them -
       the notes above name the date, but nothing is built, so only this is
       seen. */
    if (!Object.keys(secsByDay).length) {
      const wknd = dates.filter(d => d && !dayKey(d));
      throw new Error(wknd.length
        ? "No weekday dates found in the reports — " + wknd.join(", ") +
          (wknd.length === 1 ? " falls" : " fall") + " on a weekend. Saturday" +
          " and Sunday sheets are built from the diagram prints, on the" +
          " weekend panel below; these reports do not build them."
        : "No weekday dates found in the reports.");
    }
    /* Every edit that reached nothing is a pin quietly doing nothing - the
       same silent miss the table itself has, so say it here too. */
    for (const k of Object.keys(edits)) {
      if (fx.coupled.some(c => c.keysTried.indexOf(k) >= 0)) continue;
      noteAll("local rule edit " + k + " matched nothing in these reports" +
              " - the working may have moved; re-pin it or clear it");
    }
    return { secsByDay, metroSecs, hsSecs, labels, dates: dayDate, review, reviews,
             /* what this build actually ran with, for the Rules tab to
                render - never a second copy of the tables read separately */
             rules: { orderFix: fixTable, edits, coupled: fx.coupled,
                      shipped: ORDER_FIX },
             tag: Object.values(labels).join("_").replace(/[ /]/g, "-") };
  }

  /* Genius input: the report PDFs (bytes), the CSV exports (strings), or one
     of each - they carry the same two reports and merge into the same pair. */
  async function build(inputs, opts) {
    let sumRows = [];
    const byDate = new Map();
    const mergeDetail = m1 => {
      for (const [d, m] of m1) {
        if (!byDate.has(d)) byDate.set(d, new Map());
        for (const [k, v] of m) byDate.get(d).set(k, v);
      }
    };
    for (const inp of inputs) {
      if (typeof inp === "string") {
        const kind = sniffGeniusCsv(inp);
        if (kind === "sum") sumRows = sumRows.concat(parseSummaryCsvG(inp));
        else if (kind === "det") mergeDetail(parseDetailCsvG(inp));
        continue;
      }
      const txt = pdfText(inp instanceof Uint8Array ? inp : new Uint8Array(inp));
      if (/DIAGRAM SUMMARY REPORT/i.test(txt)) sumRows = sumRows.concat(parseSummary(txt));
      if (/Diagram Detail Report/i.test(txt)) mergeDetail(parseDetail(txt));
    }
    if (!sumRows.length) throw new Error("No Diagram Summary rows found - drop the Genius Diagram Summary report as well.");
    if (!byDate.size) throw new Error("No Diagram Detail itineraries found - drop the Genius Diagram Detail report as well.");
    return assemble(sumRows, byDate, startOfDayOnly(sumRows, byDate), opts);
  }

  /* Which way round a formation reads comes from the Position, and the
     Position only means anything if the summary gives one PER WORKING. The
     12/08 export did: 449 rows for 303 diagrams, 124 of them appearing more
     than once, so the 16 50 off Grove Park carried its own Positions. The
     17/08 export carried 322 rows for 322 diagrams - one apiece, the
     start-of-day Position and nothing else - and every afternoon formation
     was then ordered on where its units stood that morning.

     It is not a small effect and it is not visible on the sheet: of the six
     Grove Park PM formations that could be checked against 12/08, four came
     out wrong, including the 16 50 and the 16 41. The order cannot be
     recovered from anywhere else - the Detail report carries no Position and
     no formation column - so the only honest thing is to say so, in the one
     place somebody is going to read.

     The check is not "how many rows" - a short day would fail that. It is
     the two reports against each other: the Detail lists every working, so
     if it shows diagrams working several times over while the Summary gives
     each of them one line, the Summary is the start-of-day one.

     The cause is one tick box, found by the tester after this landed:
     File > Session Settings > "Show diagram sections on the diagram summary
     report". A diagram section IS a working, so with it off the report
     collapses each diagram to a single line and the Position goes with it.
     The message names the setting, because "run the export again" is not
     much use to somebody who does not know which of the options it was. */
  function startOfDayOnly(sumRows, byDate) {
    const seen = new Map();
    for (const r of sumRows)
      seen.set(r.diag + "\u0000" + r.date, (seen.get(r.diag + "\u0000" + r.date) || 0) + 1);
    for (const n of seen.values()) if (n > 1) return undefined;
    // how many diagrams the Detail shows doing more than one working
    let busy = 0;
    for (const [date, m] of byDate)
      for (const [diag, stops] of m) {
        if (!seen.has(diag + "\u0000" + date)) continue;
        const hcs = new Set();
        for (const st of stops) if (st.dep !== null && st.hc) hcs.add(st.hc);
        if (hcs.size > 1) busy++;
      }
    if (busy < 5 || busy * 3 < seen.size) return undefined;
    return ["This Diagram Summary carries the AM unit positions only, not " +
      "the PM ones: " + seen.size + " diagrams on " + sumRows.length +
      " lines, one apiece, while the Detail report shows " + busy +
      " of them working more than once. So the only position it gives is " +
      "where each unit stood at the start of the day, and every formation " +
      "made up during the day is printed in its morning order - the " +
      "afternoon Grove Park departures especially. In Genius, tick File > " +
      "Session Settings > \u201cShow diagram sections on the diagram " +
      "summary report\u201d and run the Summary again: that is the setting " +
      "that gives you the PM positions. Until then, put the affected " +
      "formations right with Reverse on the Unit order tab."];
  }


  // ---- Integrale CSV exports (Diagram Summary + Diagrams) ----
  // The successor planning system exports the same facts as the Genius
  // reports, but as CSVs: the summary one line per diagram, the diagrams
  // file one line per LEG (from-location/time -> to-location/time with the
  // headcode), plus activity marker rows (ATTACH/DETACH/STABLD). The
  // adapter translates both into the shapes assemble() already consumes,
  // so either source produces the same books through the same rulebook.
  const csvParse = SHEETS_CORE.csvParse;   // one reader, in core
  /* Text pasted into the page instead of a file dropped on it. The same
     report reaches the clipboard two ways and only one of them is a CSV:
     opened in Notepad it is the file, commas and all, but opened in Excel
     and copied as cells it arrives TAB separated, which the reader above
     sees as one enormous field per line and refuses as "not a report this
     reads". Excel is the likely route, so a tab-separated paste is turned
     back into CSV rather than rejected.

     The test is the first line only: more tabs on it than commas outside
     quotes. Not "no commas" - these reports carry a print date reading
     "August 17, 2026", and Excel does not quote it on the clipboard
     because a comma is not the tab it is separating on, so one bare comma
     turns up in a paste that is plainly tab separated. A real CSV of these
     reports has thirty-odd commas and no tabs; a copy out of Excel has
     thirty-odd tabs and that one comma. Nothing that already worked
     changes shape. */
  function pastedCsv(text) {
    let t = String(text == null ? "" : text);
    if (t.charCodeAt(0) === 0xFEFF) t = t.slice(1);
    t = t.replace(/\r\n?/g, "\n").replace(/^\n+/, "").replace(/\s+$/, "");
    if (!t) return "";
    const nl = t.indexOf("\n");
    const first = t.slice(0, nl < 0 ? t.length : nl);
    let tabs = 0, bare = 0, q = false;
    for (const c of first) {
      if (c === '"') q = !q;
      else if (c === "\t" && !q) tabs++;
      else if (c === "," && !q) bare++;
    }
    if (!tabs || tabs <= bare) return t;
    // tab separated: re-emit as CSV, quoting only what has to be quoted
    return t.split("\n").map(line => line.split("\t").map(f =>
      /[",\n]/.test(f) ? '"' + f.replace(/"/g, '""') + '"' : f).join(",")
    ).join("\r\n");
  }

  // Excel-mangled headcodes: "2.00E+05" was 2E05 before the spreadsheet
  // read it as a number. The mapping back is unambiguous.
  const HC_MANGLED = /^(\d)\.00E\+(\d{2})$/;
  function fixHc(h) {
    const m = HC_MANGLED.exec(h || "");
    return m ? m[1] + "E" + m[2] : (h || null);
  }
  /* One spelling of a date, whatever the report used. Genius writes the
     year both ways and does not always agree with itself: on the 17/08/26
     export the summary header says "Diagram Summary for: 17/08/26" while
     every detail row says "On 17/08/2026". Dates are the key the two halves
     are joined on, so two spellings meant no date had both halves and the
     build stopped with "No weekday dates found in the reports" - the whole
     day refused over a year written twice as long. Everything that reads a
     date goes through here. */
  const shortDate = d => {
    const m = /^(\d\d\/\d\d\/)\d\d(\d\d)$/.exec(d || "");
    return m ? m[1] + m[2] : d;
  };
  /* The allocated unit as the sheets write it: last three digits, the class
     dropped because column B already carries it - 375905 reads "905" beside
     "4 375-9". Exports pad ("000000395001"), so strip to digits first. A
     blank, a placeholder or anything that is not a unit number gives "",
     which leaves the column empty for the depot to fill in by hand. */
  function unitNo(raw) {
    const d = String(raw || "").replace(/\D/g, "").replace(/^0+/, "");
    return d.length >= 6 ? d.slice(-3) : "";
  }
  /* Returns the column numbers, or the names that are not there. An export
     can be the right report with the wrong columns picked - the 16/08
     Integrale Summary came out without Cov, Position and Last Train Note,
     which are all things the exporter lets you choose - and "that doesn't
     look like the Diagram Summary export" sends somebody hunting for the
     wrong file when what they need is three tick boxes. */
  function headerIndex(rows, wanted) {
    const hdr = rows[0].map(x => x.trim());
    const idx = {}, missing = [];
    for (const w of wanted) {
      idx[w] = hdr.indexOf(w);
      if (idx[w] < 0) missing.push(w);
    }
    return missing.length ? { missing } : idx;
  }
  const missingCols = c => c && c.missing
    ? " It is missing the " + c.missing.join(", ") + " column" +
      (c.missing.length === 1 ? "" : "s") +
      " - add " + (c.missing.length === 1 ? "it" : "them") +
      " to the export and run it again."
    : "";
  function sniffIntegrale(text) {
    const rows = csvParse(text.slice(0, 4000));
    if (!rows.length) return null;
    const hdr = rows[0].map(x => x.trim());
    if (hdr.includes("Code") && hdr.includes("Type") && hdr.includes("First Train"))
      return "sum";
    if (hdr.includes("Diagram Code") && hdr.includes("Start Tiploc"))
      return "det";
    return null;
  }
  function parseSummaryCsv(text) {
    const rows = csvParse(text);
    const c = headerIndex(rows, ["Code", "Cov", "Type", "Start Time",
      "Position", "Start Location", "End Time", "End Location"]);
    if (!c || c.missing) throw new Error(
      "That CSV doesn't look like the Integrale Diagram Summary export." + missingCols(c));
    /* Optional, because an older export may not carry it: the allocated unit.
       Not in the required list above - a missing column must not refuse the
       file, it just leaves the unit column blank for the depot to write in. */
    const stockAt = rows[0].map(x => x.trim()).indexOf("Start Stock");
    const out = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      const code = (r[c["Code"]] || "").trim();
      if (!/^[A-Z]{2}\d{3}$/.test(code)) continue;
      const st = (r[c["Start Time"]] || "").split(" ");
      const et = (r[c["End Time"]] || "").split(" ");
      out.push({
        date: shortDate(st[0]),
        diag: code,
        fleet: (r[c["Type"]] || "").trim(),
        pos: parseInt(r[c["Position"]], 10) || 1,
        start: st[1] ? mins(st[1]) : 0,
        from: (r[c["Start Location"]] || "").trim(),
        to: (r[c["End Location"]] || "").trim(),
        end: et[1] ? mins(et[1]) : 0,
        uncovered: (r[c["Cov"]] || "").trim().toUpperCase() === "UNCOVERED",
        unit: stockAt >= 0 ? unitNo(r[stockAt]) : "",
      });
    }
    return out;
  }
  function parseDetailCsv(text) {
    const rows = csvParse(text);
    const c = headerIndex(rows, ["Diagram Code", "Diagram Date", "Start Tiploc",
      "Start Location Name", "Start Time", "Activity", "Headcode",
      "End Tiploc", "End Location Name", "End Time"]);
    if (!c || c.missing) throw new Error(
      "That CSV doesn't look like the Integrale Diagrams export." + missingCols(c));
    const diags = new Map();     // code -> {date, legs, stabledOnly}
    let mangled = 0, badTime = 0;
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      const code = (r[c["Diagram Code"]] || "").trim();
      if (!code) continue;
      if (!diags.has(code))
        diags.set(code, { date: shortDate((r[c["Diagram Date"]] || "").trim()), legs: [] });
      const act = (r[c["Activity"]] || "").trim();
      if (act) continue;         // ATTACH/DETACH/STABLD markers, not movements
      const raw = (r[c["Headcode"]] || "").trim();
      const hc = fixHc(raw);
      if (raw && hc !== raw) mangled++;
      diags.get(code).legs.push({
        sT: (r[c["Start Tiploc"]] || "").trim(),
        sN: (r[c["Start Location Name"]] || "").trim(),
        sTime: r[c["Start Time"]] || "",
        eT: (r[c["End Tiploc"]] || "").trim(),
        eN: (r[c["End Location Name"]] || "").trim(),
        eTime: r[c["End Time"]] || "",
        hc: hc ? hc.slice(0, 4) : null,
      });
    }
    // legs -> the itinerary rows assemble()/buildDate expect, with the
    // same past-midnight rolling parseDetail applies
    const byDate = new Map();
    const stabled = [];
    for (const [code, d] of diags) {
      if (!d.legs.length) { stabled.push(code); continue; }
      let prev = -1;
      const roll = v => { while (v < prev - 60) v += 1440; prev = Math.max(prev, v); return v; };
      const out = [];
      for (const leg of d.legs) {
        /* An unreadable time is dropped rather than carried: Math.max with
           NaN is NaN, so one bad cell kills the past-midnight rolling for
           the rest of the diagram and prints a NaN+NaN row in the book. */
        const sv = tmin(leg.sTime), ev = tmin(leg.eTime);
        if (sv === null || ev === null) { badTime++; continue; }
        out.push({ code: leg.sT, name: leg.sN, arr: null,
                   dep: roll(sv), hc: leg.hc });
        out.push({ code: leg.eT, name: leg.eN, arr: roll(ev),
                   dep: null, hc: null });
      }
      if (!out.length) { stabled.push(code); continue; }
      if (!byDate.has(d.date)) byDate.set(d.date, new Map());
      byDate.get(d.date).set(code, out);
    }
    return { byDate, stabled, mangled, badTime };
  }
  // ---- Genius CSV exports (the same two reports, saved as CSV) ----
  // Every line repeats the whole report header and carries its data at the
  // end, so the columns are found by their label rather than by position.
  // The summary has one line per WORKING, which is where the changing
  // Position comes from; the detail has one line per leg, with the arrival
  // and departure at the leg's origin.
  function afterLabel(row, label) {
    for (let i = row.length - 1; i >= 0; i--)
      if ((row[i] || "").trim() === label) return i + 1;
    return -1;
  }
  function sniffGeniusCsv(text) {
    const rows = csvParse(text.slice(0, 4000));
    if (!rows.length) return null;
    const first = rows[0].map(x => (x || "").trim());
    if (first.indexOf("DIAGRAM SUMMARY REPORT") >= 0) return "sum";
    if (first.indexOf("Diagram Detail Report") >= 0) return "det";
    return null;
  }
  function parseSummaryCsvG(text) {
    const out = [], seen = new Set();
    for (const r of csvParse(text)) {
      const di = afterLabel(r, "Diagram Summary for:"), ni = afterLabel(r, "NOTES");
      if (di < 0 || ni < 0) continue;
      const f = r.slice(ni).map(x => (x || "").trim());
      // code, units, fleet, start fuel, POS, at, from, to, at, …
      if (!/^[A-Z]{2}\d{3}$/.test(f[0] || "")) continue;
      const st = tmin(f[5]), en = tmin(f[8]);
      if (st === null || en === null) continue;
      // the date belongs in the key: a two-day export repeats a diagram at
      // the same start time on both days, and day two was dropped
      const key = shortDate((r[di] || "").trim()) + "\u0000" + f[0] + "\u0000" + f[5];
      if (seen.has(key)) continue;          // the export repeats rows per page
      seen.add(key);
      // f[1] is the UNITS column - empty on every export seen so far, but it
      // is the allocated unit when the controller has filled it in
      out.push({ date: shortDate((r[di] || "").trim()), diag: f[0], fleet: f[2],
                 pos: parseInt(f[4], 10) || 1, start: st,
                 from: f[6], to: f[7], end: en, unit: unitNo(f[1]) });
    }
    return out;
  }
  function parseDetailCsvG(text) {
    const byDate = new Map(), state = new Map();
    for (const r of csvParse(text)) {
      const gi = afterLabel(r, "Diagram"), oi = afterLabel(r, "On"),
            fi = afterLabel(r, "Fuel Miles");
      if (gi < 0 || oi < 0 || fi < 0) continue;
      const diag = (r[gi] || "").trim(), date = shortDate((r[oi] || "").trim());
      if (!/^[A-Z]{2}\d{3}$/.test(diag)) continue;
      const f = r.slice(fi).map(x => (x || "").trim());
      // from, name, arr, dep, activity, headcode, miles, fuel, to, name, arr
      const key = date + "\u0000" + diag;
      if (!state.has(key)) state.set(key, { out: [], prev: -1, ml: 0 });
      const st = state.get(key);
      const roll = v => {
        while (v < st.prev - 60) v += 1440;
        st.prev = Math.max(st.prev, v);
        return v;
      };
      const av = tmin(f[2]), dv = tmin(f[3]);
      const arr = av === null ? null : roll(av);
      const dep = dv === null ? null : roll(dv);
      if (arr === null && dep === null) continue;
      /* The activity column is almost always blank; "#" is Genius marking a
         shunt on the spot. Kept because a stand with one is the unit being
         put away, and a stand without one can be a pause on the way home. */
      /* The export's Miles column is already RUNNING - 0.10, 6.72, 10.31
         down the diagram, with the leg's own mileage in the next column -
         so the day's total is the last figure, not the sum (summing gave
         SG712 5,445 miles for a day). Each row also keeps the running
         figure it had REACHED, because the 395 allocation sheet's MG
         column is per WORKING: the delta between a stint's two ends.
         The PDF report has no such column and leaves it all undefined,
         which the sheets print as blank. */
      st.out.push({ code: f[0], name: f[1], arr, dep,
                    hc: f[5] ? f[5].slice(0, 4) : null,
                    act: f[4] === "#" ? "#" : null, ml: st.ml });
      const ml = parseFloat(f[6]);
      if (!isNaN(ml)) {
        st.ml = ml;
        st.out.miles = Math.max(st.out.miles || 0, ml);
      }
      if (TM.test(f[10]))
        st.out.push({ code: f[8], name: f[9], arr: roll(mins(f[10])),
                      dep: null, hc: null, ml: st.ml });
      if (!byDate.has(date)) byDate.set(date, new Map());
      byDate.get(date).set(diag, st.out);
    }
    return byDate;
  }

  function buildIntegrale(texts, opts) {
    let sumRows = null, det = null;
    for (const t of texts) {
      const kind = sniffIntegrale(t);
      if (kind === "sum") sumRows = parseSummaryCsv(t);
      else if (kind === "det") det = parseDetailCsv(t);
    }
    if (!sumRows) throw new Error("No Integrale Diagram Summary rows found - drop the Diagram Summary CSV export as well.");
    if (!det) throw new Error("No Integrale diagram legs found - drop the Diagrams CSV export as well.");
    const notes = [];
    if (det.stabled.length) {
      const drop = new Set(det.stabled);
      sumRows = sumRows.filter(r => !drop.has(r.diag));
      notes.push(det.stabled.length + " stable-all-day diagram(s) with no " +
        "movements left out: " + det.stabled.join(", "));
    }
    if (det.badTime)
      notes.push(det.badTime + " leg(s) left out - the Start or End Time cell" +
        " was blank or unreadable; check the export");
    if (det.mangled)
      notes.push(det.mangled + " headcode(s) recovered from spreadsheet " +
        "number formatting (e.g. 2.00E+05 read back as 2E05) - re-export " +
        "the CSV with text columns to avoid this");
    const uncovered = sumRows.filter(r => r.uncovered).length;
    if (uncovered)
      notes.push(uncovered + " of " + sumRows.length +
        " diagrams are marked Uncovered in the plan");
    return assemble(sumRows, det.byDate, notes, opts);
  }

  return { build, buildIntegrale, sniffIntegrale, sniffGeniusCsv, pastedCsv,
           pdfText,
           parseSummary, parseDetail, _stopsOf: stopsOf, _boundaries: boundaries };
})();
if (typeof module !== "undefined" && module.exports) module.exports = GENIUS;
if (typeof globalThis !== "undefined") globalThis.GENIUS = GENIUS;
