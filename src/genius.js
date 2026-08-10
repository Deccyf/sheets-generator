/* GENIUS - build daily berthing sheets from the Genius Diagram Summary +
   Diagram Detail PDF reports, applying the weekend sheet builder's rulebook:
   stints between berth boundaries, section groups, run-round suppression,
   first-departure sections, D/E columns, ECS suppression, END markers, and
   the weekend engine's own station resolver for every code. */
const GENIUS = (() => {
  const { CODE2NAME, GROUP_EXTRA, STABLE_CODES, NAME_CODE, FIX_CODE,
          MINOR_SPUR, PROFILES_G } = SHEETS_DATA;
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
    for (const r of sumRows) summ.set(r.diag, r);
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
      const sr = summ.get(diag);
      if (!sr || !(sr.fleet in prof.fleets)) continue;
      if (!raw.length) { warn.push({ sec: null, msg: date + " " + diag + ": no detail itinerary" }); continue; }
      const stops = stopsOf(raw);
      const bnd = boundaries(stops);
      const stints = [];
      for (let i = 0; i < bnd.length - 1; i++) stints.push([bnd[i], bnd[i + 1]]);
      meta.set(diag, { stops, stints, sum: sr });
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
        if (prof.firstDep.has(sec)) {
          for (let k = a; k <= b; k++) if (stops[k].dep !== null) { exitIdx = k; break; }
        }
        const er = stops[exitIdx];
        const key = sec + "\u0000" + (er.dep % 1440) + "\u0000" + (er.hcOut || "");
        let e = entries.get(key);
        if (!e) {
          e = { sec, tmin: er.dep, hc: er.hcOut, hc0: stops[a].hcOut,
                destStop: legEnd(stops, exitIdx),
                route: legRoute(stops, exitIdx), units: [], origins: new Set() };
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
        const { stops, stints, sum } = m;
        const later = stints.slice(u.si + 1).map(([a]) => stops[a]);
        // finalBerth: still on a berth at 20 00 = the PM end point
        const lastStint = stints[stints.length - 1];
        const lb = stops[lastStint[0]], lastStop = stops[stops.length - 1];
        let fbLoc = lastStop, insteadOf = null;
        if (stints.length && core.norm(locName(lb)) !== core.norm(locName(lastStop)) &&
            lb.dep !== null && sortkey(lb.dep) >= PM_BREAK) {
          fbLoc = lb; insteadOf = lastStop;
        }
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
          if (insteadOf && u.si + 1 === stints.length - 1) D = "";
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
        blocks.push({ diag: u.diag, si: u.si, pos: sum.pos, D, E,
                      cls: prof.fleets[sum.fleet], paxAfter, path,
                      later: later.length > 0 });
      }
      if (e.sec === "FOLKESTONE EAST")
        blocks.sort((x, y) => (x.pos - y.pos) || (x.diag < y.diag ? -1 : 1));
      else
        blocks.sort((x, y) => (y.pos - x.pos) || (x.diag < y.diag ? -1 : 1));
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

  async function build(buffers) {
    const review = [];
    // per-book lists: the combined `review` keeps the legacy order, these
    // carry each fleet's own items (date-level notices go to every book)
    const reviews = { main: [], metro: [], hs: [] };
    const noteAll = m => {
      review.push(m);
      const tagged = { sec: null, msg: m };
      reviews.main.push(tagged); reviews.metro.push(tagged); reviews.hs.push(tagged);
    };
    let sumRows = [];
    const byDate = new Map();
    for (const buf of buffers) {
      const txt = pdfText(buf instanceof Uint8Array ? buf : new Uint8Array(buf));
      if (/DIAGRAM SUMMARY REPORT/i.test(txt)) sumRows = sumRows.concat(parseSummary(txt));
      if (/Diagram Detail Report/i.test(txt))
        for (const [d, m] of parseDetail(txt)) {
          if (!byDate.has(d)) byDate.set(d, new Map());
          for (const [k, v] of m) byDate.get(d).set(k, v);
        }
    }
    if (!sumRows.length) throw new Error("No Diagram Summary rows found - upload the Summary report PDF as well.");
    if (!byDate.size) throw new Error("No Diagram Detail itineraries found - upload the Detail report PDF as well.");
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

  return { build, pdfText, parseSummary, parseDetail, _stopsOf: stopsOf, _boundaries: boundaries };
})();
if (typeof module !== "undefined" && module.exports) module.exports = GENIUS;
if (typeof globalThis !== "undefined") globalThis.GENIUS = GENIUS;
