/* GENIUS - build daily berthing sheets from the Genius Diagram Summary +
   Diagram Detail PDF reports, applying the weekend sheet builder's rulebook:
   stints between berth boundaries, section groups, run-round suppression,
   first-departure sections, D/E columns, ECS suppression, END markers, and
   the weekend engine's own station resolver for every code. */
const GENIUS = (() => {
  const { CODE2NAME, GROUP_EXTRA, STABLE_CODES, NAME_CODE, FIX_CODE,
          MINOR_SPUR, BERTH_AREAS, PROFILES_G, ORDER_FIX } = SHEETS_DATA;
  const END_MARKERS = SHEETS_DATA.END_MARKERS_GENIUS;
  const { DAY_ROLL, PM_BREAK, RUN_ROUND, runsOf } = SHEETS_RULEBOOK;
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
  const sortkey = t => (t % 1440) < DAY_ROLL ? (t % 1440) + 1440 : (t % 1440);
  function parseSummary(txt) {
    const rows = [];
    let date = null;
    for (const raw of txt.split("\n")) {
      const l = raw.trim();
      const dm = /Diagram Summary for:\s*(\d\d\/\d\d\/\d\d)/.exec(l);
      if (dm) { date = dm[1]; continue; }
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
      const dm = /Diagram\s+([A-Z]{2}\s?\d\s?\d\s?\d)\s+On\s+(\d\d\/\d\d\/\d\d)/.exec(l)
              || /^([A-Z]{2}\s?\d\s?\d\s?\d)\s+(\d\d\/\d\d\/\d\d)$/.exec(l);
      if (dm) {
        const diag = dm[1].replace(/\s+/g, ""), date = dm[2];
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
      cur.push({ code: t[0], name, arr, dep, hc: hc ? hc.slice(0, 4) : null });
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
    const [d, mo, y] = date.split("/").map(Number);
    return DAY_OF[new Date(2000 + y, mo - 1, d).getDay()] || null;
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
      out.push({ code: grp[0].code, name: grp[0].name, arr, dep, hcIn: lastHc, hcOut });
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
  function boundaries(stops) {
    const b = new Set();
    for (let k = 0; k < stops.length; k++) {
      const s = stops[k];
      if (k === 0 || k === stops.length - 1) { b.add(k); continue; }
      if (!isStabling(s) || s.hcIn === s.hcOut) continue;
      if (MINOR_SPUR.has(s.code)) {
        const dwell = (s.arr !== null && s.dep !== null) ? s.dep - s.arr : null;
        if (dwell !== null && dwell < BERTH_STAY) continue;
      }
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
  function buildDate(date, sumRows, details, prof, warn) {
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
      const sr = srs && srs[0];
      if (!sr || !(sr.fleet in prof.fleets)) continue;
      if (!raw.length) { warn.push({ sec: null, msg: date + " " + diag + ": no detail itinerary" }); continue; }
      const stops = stopsOf(raw);
      const bnd = boundaries(stops);
      const stints = [];
      for (let i = 0; i < bnd.length - 1; i++) stints.push([bnd[i], bnd[i + 1]]);
      meta.set(diag, { stops, stints, sum: sr, sums: srs });
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
                destStop: legEnd(stops, destIdx),
                route: legRoute(stops, destIdx), units: [], origins: new Set() };
          entries.set(key, e);
        }
        e.units.push({ diag, si, exitIdx });
        e.origins.add(core.norm(locName(origin)));
      }
    }
    // per-unit derivations
    for (const e of entries.values()) {
      const blocks = [];
      for (const u of e.units) {
        const m = meta.get(u.diag);
        const { stops, stints, sum, sums } = m;
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
        const fbLoc = lateMove && sameArea(areaOf(lb), areaOf(lastStop))
          ? lb : lastStop;
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
          if (lateMove && u.si + 1 === stints.length - 1) D = "";
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
        blocks.push({ diag: u.diag, si: u.si, pos: posAt(sums, e.tmin), D, E,
                      cls: prof.fleets[sum.fleet], paxAfter, path,
                      later: later.length > 0 });
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
      // A formation the books say the reports get the wrong way round: the
      // order is taken verbatim (see ORDER_FIX). A formation that reads one
      // way in the morning and the other in the afternoon is named with its
      // time; one that holds all day is named without.
      {
        const diags = blocks.map(x => x.diag.slice(2)).sort().join(",");
        const fix = ORDER_FIX[e.sec + " " + fmtT(e.tmin, e.hc) + "|" + diags] ||
                    ORDER_FIX[e.sec + "|" + diags];
        if (fix) blocks.sort((x, y) =>
          fix.indexOf(x.diag.slice(2)) - fix.indexOf(y.diag.slice(2)));
      }
      // Two units on the same Position started the day in different
      // formations, so the reports cannot say which way round they go.
      if (blocks.length > 1 &&
          new Set(blocks.map(x => x.pos)).size !== blocks.length)
        warn.push({ sec: e.sec, msg: e.sec + " " + fmtT(e.tmin, e.hc) + " (" +
          blocks.map(x => x.diag).join("+") + "): two units share a Position -" +
          " the reports cannot say which way round they go, so check the order" });
      // a unit re-entering its berth to attach to another unit's first
      // departure is not listed again - the ATTACHMENT note covers it
      // (the manual's 07 55 row: GT117 listed, GT116 attaching from the
      // East Sidings shown as the note)
      if (blocks.length > 1 && blocks.some(x => x.si === 0) &&
          blocks.some(x => x.si > 0)) {
        e.blocks = blocks.filter(x => x.si === 0);
        e.attachment = true;
      } else e.blocks = blocks;
      let splits = false;
      if (blocks.length > 1) {
        const p0 = blocks[0].path;
        if (!blocks.every(x => x.path === p0)) splits = true;
      }
      e.splits = splits;
      e.attachment = e.attachment || e.origins.size > 1;
      if (!e.attachment) {
        const inUnits = new Set(e.units.map(u => u.diag));
        const ex = meta.get(e.units[0].diag).stops[e.units[0].exitIdx];
        outer:
        for (const [od, om] of meta) {
          if (inUnits.has(od)) continue;
          for (const s of om.stops)
            if (s.code === ex.code && s.dep === ex.dep) { e.attachment = true; break outer; }
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
        if (mk.fkeLeads.has(dest)) { lead = mk.fke; rear = mk.cbe; }
        else if (mk.cbeLeads.has(dest) || e.route.includes(mk.cbeVia)) {
          lead = mk.cbe; rear = mk.fke;
        } else warn.push({ sec: e.sec, msg: e.sec + " " + e.tmin + " to " + dest +
                         " - no rule for which end leads" });
        if (lead) { blocks[0].end = lead; blocks[blocks.length - 1].end = rear; }
      }
      e.dest = destCode(locName(e.destStop), warn, e.sec + " " + e.tmin);
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
      e.suppress = !prof.ecsOnlyOk.has(e.sec) && !!e.hc && e.hc[0] === "5" &&
                   !blocks.some(x => x.paxAfter) &&
                   (isStabling(dl) || secOf(dl, false) === e.sec);
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
      const pairs = new Set(e.blocks.map(x => x.D + "\u0000" + x.E));
      e.splits_pm = !e.splits && e.blocks.length > 1 && pairs.size > 1;
      if (e.suppress)
        warn.push({ sec: e.sec,
                  msg: "suppressed: " + e.sec + " " + fmtT(e.tmin, e.hc) + " (" +
                  e.blocks.map(x => x.diag).join("+") + ") - empty move to a berth" });
    }
    // writer-shaped sections
    const secs = new Map();
    const sorted = [...entries.values()].filter(e => !e.suppress)
      .sort((x, y) => x.sec === y.sec ? sortkey(x.tmin) - sortkey(y.tmin)
                                      : (x.sec < y.sec ? -1 : 1));
    for (const e of sorted) {
      const kind = e.hc && /^[12]/.test(e.hc) ? "pax" : "ecs";
      const entry = {
        section: e.sec, time: e.tmin, time_kind: kind, dest: e.dest, sub: null,
        days: new Set([dayKey(date)].filter(Boolean)),
        // Victoria's notes column shows the ECS headcode off the sidings,
        // while the time stays from the platform
        headcode: (e.sec === "VICTORIA" ? (e.hc0 || e.hc) : e.hc) || null,
        // first-stint departures are the overnight-berthed block: the
        // writer uses this to give Grove Park its two tables
        overnight: e.blocks.every(x => x.si === 0),
        extra_notes: [], review: [],
        units: e.blocks.map(x => ({ cls: x.cls, am: x.D, pm: x.E,
                                    diag: x.diag.slice(2), end: x.end })),
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
  function assemble(sumRows, byDate, extraNotes) {
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
    const secsByDay = {}, metroSecs = {}, hsSecs = {}, labels = {};
    const dates = [...new Set(sumRows.map(r => r.date))].filter(Boolean);
    for (const date of dates) {
      const dk = dayKey(date);
      if (!dk) { noteAll(date + ": falls on a weekend - use the weekend prints panel"); continue; }
      const det = byDate.get(date);
      if (!det) { noteAll(date + ": summary given but no detail report for this date"); continue; }
      const rows = sumRows.filter(r => r.date === date);
      const warnMain = [], warnMetro = [], warnHs = [];
      secsByDay[dk] = buildDate(date, rows, det, PROFILES_G[0], warnMain);
      metroSecs[dk] = buildDate(date, rows, det, PROFILES_G[1], warnMetro);
      hsSecs[dk] = buildDate(date, rows, det, PROFILES_G[2], warnHs);
      labels[dk] = DAY_NAME[dk] + " " + date.slice(0, 5);
      for (const [warn, bag] of [[warnMain, reviews.main],
                                 [warnMetro, reviews.metro],
                                 [warnHs, reviews.hs]]) {
        for (const w of warn) {
          review.push(w.msg);
          bag.push(w);
        }
      }
    }
    if (!Object.keys(secsByDay).length) throw new Error("No weekday dates found in the reports.");
    return { secsByDay, metroSecs, hsSecs, labels, review, reviews,
             tag: Object.values(labels).join("_").replace(/[ /]/g, "-") };
  }

  /* Genius input: the report PDFs (bytes), the CSV exports (strings), or one
     of each - they carry the same two reports and merge into the same pair. */
  async function build(inputs) {
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
    return assemble(sumRows, byDate);
  }


  // ---- Integrale CSV exports (Diagram Summary + Diagrams) ----
  // The successor planning system exports the same facts as the Genius
  // reports, but as CSVs: the summary one line per diagram, the diagrams
  // file one line per LEG (from-location/time -> to-location/time with the
  // headcode), plus activity marker rows (ATTACH/DETACH/STABLD). The
  // adapter translates both into the shapes assemble() already consumes,
  // so either source produces the same books through the same rulebook.
  function csvParse(text) {
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
    const rows = [];
    let row = [], field = "", q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; }
          else q = false;
        } else field += c;
      } else if (c === '"') q = true;
      else if (c === ",") { row.push(field); field = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(field); field = "";
        if (row.length > 1 || row[0] !== "") rows.push(row);
        row = [];
      } else field += c;
    }
    row.push(field);
    if (row.length > 1 || row[0] !== "") rows.push(row);
    return rows;
  }
  // Excel-mangled headcodes: "2.00E+05" was 2E05 before the spreadsheet
  // read it as a number. The mapping back is unambiguous.
  const HC_MANGLED = /^(\d)\.00E\+(\d{2})$/;
  function fixHc(h) {
    const m = HC_MANGLED.exec(h || "");
    return m ? m[1] + "E" + m[2] : (h || null);
  }
  const shortDate = d => {
    const m = /^(\d\d\/\d\d\/)\d\d(\d\d)$/.exec(d || "");
    return m ? m[1] + m[2] : d;
  };
  function headerIndex(rows, wanted) {
    const hdr = rows[0].map(x => x.trim());
    const idx = {};
    for (const w of wanted) {
      idx[w] = hdr.indexOf(w);
      if (idx[w] < 0) return null;
    }
    return idx;
  }
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
    if (!c) throw new Error("That CSV doesn't look like the Integrale Diagram Summary export.");
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
      });
    }
    return out;
  }
  function parseDetailCsv(text) {
    const rows = csvParse(text);
    const c = headerIndex(rows, ["Diagram Code", "Diagram Date", "Start Tiploc",
      "Start Location Name", "Start Time", "Activity", "Headcode",
      "End Tiploc", "End Location Name", "End Time"]);
    if (!c) throw new Error("That CSV doesn't look like the Integrale Diagrams export.");
    const diags = new Map();     // code -> {date, legs, stabledOnly}
    let mangled = 0;
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
        out.push({ code: leg.sT, name: leg.sN, arr: null,
                   dep: roll(mins(leg.sTime)), hc: leg.hc });
        out.push({ code: leg.eT, name: leg.eN, arr: roll(mins(leg.eTime)),
                   dep: null, hc: null });
      }
      if (!byDate.has(d.date)) byDate.set(d.date, new Map());
      byDate.get(d.date).set(code, out);
    }
    return { byDate, stabled, mangled };
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
      if (!TM.test(f[5] || "") || !TM.test(f[8] || "")) continue;
      const key = f[0] + "\u0000" + f[5];
      if (seen.has(key)) continue;          // the export repeats rows per page
      seen.add(key);
      out.push({ date: (r[di] || "").trim(), diag: f[0], fleet: f[2],
                 pos: parseInt(f[4], 10) || 1, start: mins(f[5]),
                 from: f[6], to: f[7], end: mins(f[8]) });
    }
    return out;
  }
  function parseDetailCsvG(text) {
    const byDate = new Map(), state = new Map();
    for (const r of csvParse(text)) {
      const gi = afterLabel(r, "Diagram"), oi = afterLabel(r, "On"),
            fi = afterLabel(r, "Fuel Miles");
      if (gi < 0 || oi < 0 || fi < 0) continue;
      const diag = (r[gi] || "").trim(), date = (r[oi] || "").trim();
      if (!/^[A-Z]{2}\d{3}$/.test(diag)) continue;
      const f = r.slice(fi).map(x => (x || "").trim());
      // from, name, arr, dep, activity, headcode, miles, fuel, to, name, arr
      const key = date + "\u0000" + diag;
      if (!state.has(key)) state.set(key, { out: [], prev: -1 });
      const st = state.get(key);
      const roll = v => {
        while (v < st.prev - 60) v += 1440;
        st.prev = Math.max(st.prev, v);
        return v;
      };
      const arr = TM.test(f[2]) ? roll(mins(f[2])) : null;
      const dep = TM.test(f[3]) ? roll(mins(f[3])) : null;
      if (arr === null && dep === null) continue;
      st.out.push({ code: f[0], name: f[1], arr, dep,
                    hc: f[5] ? f[5].slice(0, 4) : null });
      if (TM.test(f[10]))
        st.out.push({ code: f[8], name: f[9], arr: roll(mins(f[10])),
                      dep: null, hc: null });
      if (!byDate.has(date)) byDate.set(date, new Map());
      byDate.get(date).set(diag, st.out);
    }
    return byDate;
  }

  function buildIntegrale(texts) {
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
    if (det.mangled)
      notes.push(det.mangled + " headcode(s) recovered from spreadsheet " +
        "number formatting (e.g. 2.00E+05 read back as 2E05) - re-export " +
        "the CSV with text columns to avoid this");
    const uncovered = sumRows.filter(r => r.uncovered).length;
    if (uncovered)
      notes.push(uncovered + " of " + sumRows.length +
        " diagrams are marked Uncovered in the plan");
    return assemble(sumRows, det.byDate, notes);
  }

  return { build, buildIntegrale, sniffIntegrale, sniffGeniusCsv, pdfText,
           parseSummary, parseDetail, _stopsOf: stopsOf, _boundaries: boundaries };
})();
if (typeof module !== "undefined" && module.exports) module.exports = GENIUS;
if (typeof globalThis !== "undefined") globalThis.GENIUS = GENIUS;
