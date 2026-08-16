/* SheetsEngine — the weekend pipeline, a JS port of make_sheets.py.
   Same rules, same output. Runs in the browser and in node. Reference
   tables live in data.js; the xlsx writer and preview in xlsx.js. */
"use strict";
(function (root) {
const { DEST_CODE, BERTH_CODE, NOTE_FROM_BERTH, PLATFORM, BASE_STABLING,
        TRANSIT, STATIONS, MANUAL_LOC, routeRule } = SHEETS_DATA;
const END_MARKERS = SHEETS_DATA.END_MARKERS_PRINTS;
const PROFILES = SHEETS_DATA.PROFILES;
const { DAY_ROLL, PM_BREAK, RUN_ROUND, runsOf } = SHEETS_RULEBOOK;
const QUAL_RE = /(up\s*sd|dn\s*sd|down\s*sd|u\s*sd|d\s*sd|sdg|sidings?|sids?|sd|depot|dep|shed|yard|yd|bk\s*rd|rd|tr|turnback|tb|ebs|dms|jub\s*s|pk\s*s|us|ds)$/i;
function nrm(x){ return x.toLowerCase().replace(/[^a-z0-9]/g, ""); }
function stripQual(loc){
  var s = loc.trim(), prev = null;
  while (s !== prev){
    prev = s;
    s = s.replace(/\s*\d{2,}$/, "").replace(/\s*ek\s*\d+$/i, "");
    var s2 = s.replace(QUAL_RE, "").trim();
    if (s2 && s2.length >= 3) s = s2;
  }
  return s.trim();
}
function isSub(a, b){
  var i = 0;
  for (var j = 0; j < b.length && i < a.length; j++) if (b[j] === a[i]) i++;
  return i === a.length;
}
function pfx(a, b){
  var n = 0;
  while (n < Math.min(a.length, b.length) && a[n] === b[n]) n++;
  return n;
}
function cleanName(n){ return n.split(" - ")[0].trim(); }
/* The prints abbreviate by dropping letters, so the abbreviation is always a
   subsequence of the full name ("Gend" -> Gravesend, "Mgate" -> Margate). */
function resolveStation(loc){
  if (MANUAL_LOC[loc]) return {crs:MANUAL_LOC[loc][0], name:MANUAL_LOC[loc][1],
                               conf:"manual", alts:[]};
  // The curated tables already know this place; trust them over any guess.
  for (const tbl of [DEST_CODE, BERTH_CODE]){
    if (tbl[loc] !== undefined){
      const crs = tbl[loc];
      for (const s of STATIONS)
        if (s[1] === crs) return {crs:crs, name:cleanName(s[0]), conf:"table", alts:[]};
    }
  }
  var cands = [loc, stripQual(loc)];
  for (var ci = 0; ci < cands.length; ci++){
    var a = nrm(cands[ci]);
    if (!a) continue;
    var hits = STATIONS.filter(function(s){ return isSub(a, nrm(s[0])); });
    if (!hits.length) continue;
    hits.sort(function(x, y){
      return (y[2] - x[2]) || (pfx(a, nrm(y[0])) - pfx(a, nrm(x[0]))) ||
             (x[0].length - y[0].length);
    });
    var rostered = hits.filter(function(h){ return h[2]; });
    var conf = (nrm(hits[0][0]) === a || rostered.length === 1) ? "high" : "low";
    return {crs:hits[0][1], name:cleanName(hits[0][0]), conf:conf,
            alts:hits.slice(1, 4).map(function(h){ return cleanName(h[0]); })};
  }
  return {crs:null, name:null, conf:"none", alts:[]};
}
/* Curated table first, resolver second, blunt truncation only as a last
   resort - and that last resort always goes on the report. */
function codeFor(loc, table, warn, where){
  if (table[loc] !== undefined) return table[loc];
  var r = resolveStation(loc);
  if (r.crs){
    var extra = (r.conf === "manual" || r.conf === "high") ? ""
                : " (or " + r.alts.slice(0,2).join(", ") + "?)";
    warn.push(["resolved", loc + " read as " + r.name + " " + r.crs + extra, r.conf, where]);
    return r.crs;
  }
  warn.push(["nocode", loc, null, where]);
  return loc.slice(0,3).toUpperCase();
}

/* A location whose name carries a siding/depot word is treated as a berthing
   place even if it has never been seen before. Deliberately excludes
   turnbacks (TR/TB) and bare direction letters. */
const SIDING_WORD = /(^|[\s.])(sd|sdg|sids?|sidings?|dep|depot|shed|yard|yd|dms|ebs)$|(^|[\s.])(up|dn|down|u|d)\s*sd$/i;
function looksLikeStabling(loc){ return SIDING_WORD.test(loc.trim()); }
/* The unit's PM end point - the berth it is still sitting on in the evening.
   A unit still on a berth at 20 00 has ended its day there as far as the sheet
   is concerned, whatever a late working does with it afterwards: a unit berthed
   at Ramsgate until 22 42 and then run down to Gillingham in the small hours is
   a Ramsgate unit, and one shut in St Leonards shed and shunted out to Hastings
   is a shed unit. A unit that leaves its berth in the afternoon has not
   finished, so it is recorded wherever it really ends up. The entry that comes
   off the berth itself is the exception - see below. */
function finalBerth(stops, stints){
  const last = stops[stops.length - 1].loc;
  if (!stints.length) return {loc: last, insteadOf: null};
  const bs = stops[stints[stints.length - 1][0]];
  if (bs.loc !== last && bs.dep !== null && sortkey(bs.dep) >= PM_BREAK)
    return {loc: bs.loc, insteadOf: last};
  return {loc: last, insteadOf: null};
}
function legLocs(rows, exitIdx){
  const hc = rows[exitIdx].hc, out = [];
  for (let i = exitIdx; i < rows.length; i++){
    const x = rows[i];
    if (x.loc) out.push(x.loc);
    if (i > exitIdx && x.hc && x.hc !== hc && x.dep) break;
  }
  return out;
}
const SHORT_BERTH = 20;   // a stop shorter than this at an unmarked,
                          // un-siding-named place is reported, not trusted
const GAP_WARN = 60;
const ATT = ["ATTACH","ATTTT"], DET = ["DETACH","DETTT"];
/* ========================= docx -> lines ========================= */
function xmlUnescape(s){
  return s.replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"')
          .replace(/&apos;/g,"'")
          .replace(/&#x([0-9a-fA-F]+);/g,(m,h)=>String.fromCodePoint(parseInt(h,16)))
          .replace(/&#(\d+);/g,(m,d)=>String.fromCodePoint(parseInt(d,10)))
          .replace(/&amp;/g,"&");
}
/* paragraph text exactly as python-docx builds it: run text, <w:tab/> -> \t,
   <w:br/> and <w:cr/> -> \n */
function docxParagraphs(documentXml){
  const paras = [];
  const re = /<w:p(?:\s[^>]*)?\/>|<w:p(?:\s[^>]*)?>([\s\S]*?)<\/w:p>/g;
  let m;
  while ((m = re.exec(documentXml)) !== null){
    const inner = m[1];
    if (inner === undefined){ paras.push(""); continue; }
    const body = inner.replace(/<w:pPr>[\s\S]*?<\/w:pPr>/g, "");
    let text = "";
    const tok = /<w:tab\/>|<w:tab\s*\/>|<w:br(?:\s[^>]*)?\/?>|<w:cr\/>|<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:t(?:\s[^>]*)?\/>/g;
    let t;
    while ((t = tok.exec(body)) !== null){
      const raw = t[0];
      if (raw.startsWith("<w:tab")) text += "\t";
      else if (raw.startsWith("<w:br") || raw.startsWith("<w:cr")) text += "\n";
      else if (t[1] !== undefined) text += xmlUnescape(t[1]);
    }
    paras.push(text);
  }
  return paras;
}
function readDocx(bytes, unzip){
  let files;
  try { files = unzip(bytes); }
  catch (e){
    throw new Error("That file is damaged or isn't a Word document. " +
                    "Try re-saving the prints from Word as .docx.");
  }
  const key = Object.keys(files).find(k => k === "word/document.xml");
  if (!key) throw new Error("That doesn't look like a Word file — no document body inside.");
  const xml = new TextDecoder("utf-8").decode(files[key]);
  return docxParagraphs(xml);
}

/* ---- legacy .doc (Word 97-2003) ------------------------------------------
   A .doc is an OLE compound file: a little filesystem holding a
   "WordDocument" stream and a table stream. The text is not one run - the
   table stream holds a piece table saying where each run of characters lives
   and whether it is 1-byte or 2-byte encoded. This walks both.            */
function readCfb(bytes){
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const u16 = function(o){ return dv.getUint16(o, true); };
  const u32 = function(o){ return dv.getUint32(o, true); };
  const ssz = 1 << u16(0x1E), msz = 1 << u16(0x20);
  const dirStart = u32(0x30), cutoff = u32(0x38);
  const miniStart = u32(0x3C), difatStart = u32(0x44), nDifat = u32(0x48);
  const sector = function(n){
    const off = (n + 1) * ssz;
    return bytes.subarray(off, off + ssz);
  };
  const fatSectors = [];
  for (let i = 0; i < 109; i++){
    const v = u32(0x4C + 4 * i);
    if (v < 0xFFFFFFFA) fatSectors.push(v);
  }
  let nxt = difatStart, guard = 0;
  while (nxt < 0xFFFFFFFA && guard < nDifat + 8){
    const blk = sector(nxt);
    const bv = new DataView(blk.buffer, blk.byteOffset, blk.byteLength);
    for (let i = 0; i < ssz / 4 - 1; i++){
      const v = bv.getUint32(4 * i, true);
      if (v < 0xFFFFFFFA) fatSectors.push(v);
    }
    nxt = bv.getUint32(ssz - 4, true); guard++;
  }
  const fat = [];
  for (const s of fatSectors){
    const blk = sector(s);
    const bv = new DataView(blk.buffer, blk.byteOffset, blk.byteLength);
    for (let i = 0; i < ssz / 4; i++) fat.push(bv.getUint32(4 * i, true));
  }
  const chain = function(start){
    const out = []; let cur = start;
    while (cur < 0xFFFFFFFA && out.length < (1 << 22)){
      out.push(cur);
      cur = cur < fat.length ? fat[cur] : 0xFFFFFFFE;
    }
    return out;
  };
  const miniFat = [];
  for (const s of chain(miniStart)){
    const blk = sector(s);
    const bv = new DataView(blk.buffer, blk.byteOffset, blk.byteLength);
    for (let i = 0; i < ssz / 4; i++) miniFat.push(bv.getUint32(4 * i, true));
  }
  const miniChain = function(start){
    const out = []; let cur = start;
    while (cur < 0xFFFFFFFA && out.length < (1 << 20)){
      out.push(cur);
      cur = cur < miniFat.length ? miniFat[cur] : 0xFFFFFFFE;
    }
    return out;
  };
  const join = function(parts, size){
    const total = parts.reduce(function(a, p){ return a + p.length; }, 0);
    const out = new Uint8Array(total);
    let o = 0;
    for (const p of parts){ out.set(p, o); o += p.length; }
    return size === undefined ? out : out.subarray(0, size);
  };
  const entries = [];
  for (const s of chain(dirStart)){
    const blk = sector(s);
    for (let i = 0; i + 128 <= blk.length; i += 128){
      const e = blk.subarray(i, i + 128);
      const ev = new DataView(e.buffer, e.byteOffset, e.byteLength);
      const nlen = ev.getUint16(64, true);
      let name = "";
      for (let k = 0; k + 1 < Math.max(0, nlen - 2); k += 2)
        name += String.fromCharCode(ev.getUint16(k, true));
      entries.push({name: name, type: e[66],
                    start: ev.getUint32(116, true), size: ev.getUint32(120, true)});
    }
  }
  const root = entries.find(function(e){ return e.type === 5; });
  const miniStream = root
    ? join(chain(root.start).map(sector)) : new Uint8Array(0);
  const out = {};
  for (const e of entries){
    if (e.type !== 2 || !e.name) continue;
    out[e.name] = e.size < cutoff
      ? join(miniChain(e.start).map(function(n){
          return miniStream.subarray(n * msz, (n + 1) * msz); }), e.size)
      : join(chain(e.start).map(sector), e.size);
  }
  return out;
}
function readDoc(bytes){
  let streams;
  try { streams = readCfb(bytes); }
  catch (e){ throw new Error("That .doc file could not be read. Try opening it " +
                             "in Word and saving it again."); }
  const wd = streams["WordDocument"];
  if (!wd) throw new Error("That doesn't look like a Word file — no document body inside.");
  const wv = new DataView(wd.buffer, wd.byteOffset, wd.byteLength);
  if (wv.getUint16(0, true) !== 0xA5EC)
    throw new Error("Unrecognised Word document header.");
  const which = (wv.getUint16(0x0A, true) & 0x0200) ? "1Table" : "0Table";
  const tbl = streams[which] || streams["1Table"] || streams["0Table"];
  if (!tbl) throw new Error("That Word file is missing its table stream.");
  const tv = new DataView(tbl.buffer, tbl.byteOffset, tbl.byteLength);
  // walk the FIB to the Clx pointer rather than trusting a fixed offset
  const csw = wv.getUint16(0x20, true);
  const cslw = wv.getUint16(0x22 + csw * 2, true);
  const base = 0x22 + csw * 2 + 2 + cslw * 4 + 2;
  const fcClx = wv.getUint32(base + 33 * 8, true);
  const lcbClx = wv.getUint32(base + 33 * 8 + 4, true);
  let i = fcClx, pcdtAt = -1, pcdtLen = 0;
  const end = fcClx + lcbClx;
  while (i < end){
    if (tbl[i] === 1) i += 3 + tv.getUint16(i + 1, true);
    else if (tbl[i] === 2){
      pcdtLen = tv.getUint32(i + 1, true); pcdtAt = i + 5; break;
    } else break;
  }
  if (pcdtAt < 0) throw new Error("That Word file has no piece table.");
  const n = Math.floor((pcdtLen - 4) / 12);
  const cps = [];
  for (let k = 0; k <= n; k++) cps.push(tv.getUint32(pcdtAt + 4 * k, true));
  const dec1 = new TextDecoder("windows-1252");
  const dec2 = new TextDecoder("utf-16le");
  let body = "";
  for (let k = 0; k < n; k++){
    const p = pcdtAt + 4 * (n + 1) + 8 * k;
    const fc = tv.getUint32(p + 2, true);
    const compressed = (fc & 0x40000000) !== 0;
    const off = compressed ? (fc & 0x3FFFFFFF) >>> 1 : (fc & 0x3FFFFFFF);
    const chars = cps[k + 1] - cps[k];
    body += compressed ? dec1.decode(wd.subarray(off, off + chars))
                       : dec2.decode(wd.subarray(off, off + chars * 2));
  }
  return body.replace(/[\x07\x0b\x0c]/g, "\r").split("\r");
}
/* The extension is only a hint; what matters is the first few bytes. */
function readPrints(bytes, unzip){
  const b = bytes;
  if (b[0] === 0x50 && b[1] === 0x4B && b[2] === 0x03 && b[3] === 0x04)
    return readDocx(bytes, unzip);
  if (b[0] === 0xD0 && b[1] === 0xCF && b[2] === 0x11 && b[3] === 0xE0 &&
      b[4] === 0xA1 && b[5] === 0xB1 && b[6] === 0x1A && b[7] === 0xE1)
    return readDoc(bytes);
  const head = new TextDecoder("utf-8", {fatal:false})
                 .decode(bytes.subarray(0, 16)).trimStart();
  if (head.slice(0, 5) === "{\\rtf")
    throw new Error("That file is Rich Text, not Word. Open it in Word and save " +
                    "it as a Word Document.");
  throw new Error("That isn't a Word file. Save the prints from Word as .docx or .doc.");
}

function parseDiagrams(lines){
  const diags = new Map();   // "CODE|NUM" -> {code,num,rows,fleet,date}
  let cur = null;
  for (const ln of lines){
    if (ln.indexOf("Diagram:") !== -1){
      const m = /Diagram:\t(\w+)\t(\d+)\t(\w+)/.exec(ln);
      if (m){
        cur = m[1] + "|" + parseInt(m[2],10);
        diags.set(cur, {code:m[1], num:parseInt(m[2],10),
                        rows:[], fleet:null, date:null});
      }
      continue;
    }
    if (cur === null) continue;
    const d = diags.get(cur);
    if (ln.indexOf("Fleet:") !== -1){
      const m = /Fleet:\t([\d/]+)/.exec(ln);
      if (m) d.fleet = m[1];
    } else if (ln.indexOf("From:") !== -1){
      const m = /From:\t(\d{2}\/\d{2}\/\d{4})/.exec(ln);
      if (m) d.date = m[1];
    } else if (ln.startsWith("\t\t")){
      const g = ln.split("\t"); while (g.length < 9) g.push("");
      const pick = i => (g[i] || "").trim();
      const row = {loc:pick(2), arr:pick(3), dep:pick(4),
                   hc:pick(5), ev:pick(6), fm:pick(8)};
      if (row.loc || row.ev) d.rows.push(row);
    }
  }
  return diags;
}
const mins = t => t ? parseInt(t.slice(0,2),10)*60 + parseInt(t.slice(3,5),10) : null;
function fmtParse(fm){
  const out = new Map(); if (!fm) return out;
  const re = /(\d+)\((\d+)\)/g; let m;
  while ((m = re.exec(fm)) !== null) out.set(parseInt(m[1],10), parseInt(m[2],10));
  return out;
}
const dnum = n => String(n).padStart(3,"0");
const sortkey = t => t < DAY_ROLL ? t + 1440 : t;
const mod1440 = x => ((x % 1440) + 1440) % 1440;
function stopsOf(rows){
  const out = []; let lastHc = null;
  for (const [i, j1] of runsOf(rows, r => r.loc, r => r.loc === "")){
    const grp = [];
    for (let k = i; k <= j1; k++) grp.push([k, rows[k]]);
    const loc = rows[i].loc;
    let hcOut = null;
    for (let k = grp.length-1; k >= 0; k--) if (grp[k][1].hc){ hcOut = grp[k][1].hc; break; }
    let arr = null;
    for (const [,x] of grp) if (x.arr){ arr = mins(x.arr); break; }
    let dep = null, depIdx = null;
    for (let k = grp.length-1; k >= 0; k--) if (grp[k][1].dep){
      dep = mins(grp[k][1].dep); depIdx = grp[k][0]; break;
    }
    let hash = false;
    for (const [,x] of grp) if (x.ev === "#"){ hash = true; break; }
    out.push({loc, i0:i, i1:j1, arr, dep, dep_idx:depIdx,
              hc_in:lastHc, hc_out:hcOut, hash});
    if (hcOut) lastHc = hcOut;
  }
  return out;
}
function berthBoundaries(dlabel, stops, stabling, warn){
  const b = new Set();
  for (let k = 0; k < stops.length; k++){
    const s = stops[k];
    if (k === 0 || k === stops.length-1){ b.add(k); continue; }
    if (s.hash) b.add(k);
    else if ((stabling.has(s.loc) || looksLikeStabling(s.loc))
             && s.hc_in !== s.hc_out){
      b.add(k);
      // A short stop somewhere that is not marked '#' and is not named like a
      // siding is far more likely to be a turnround than a berthing - the
      // shape of the Maidstone West mistake.
      if (!s.hash && !looksLikeStabling(s.loc) && s.arr !== null && s.dep !== null
          && mod1440(s.dep - s.arr) < SHORT_BERTH)
        warn.push(["shortberth", dlabel + " sits at " + s.loc + " for only " +
                   mod1440(s.dep - s.arr) + " min before leaving on " +
                   (s.hc_out || "?") + " - treated as a berth, check it is not " +
                   "just a turnround", null, ""]);
    }
    else if (s.arr !== null && s.dep !== null && mod1440(s.dep - s.arr) >= GAP_WARN)
      warn.push(["dwell", s.loc, mod1440(s.dep - s.arr), dlabel]);
  }
  return Array.from(b).sort((x,y)=>x-y);
}
function legEnd(rows, exitIdx){
  const hc = rows[exitIdx].hc; let loc = rows[exitIdx].loc;
  for (let i = exitIdx+1; i < rows.length; i++){
    const x = rows[i];
    if (x.loc) loc = x.loc;
    if (x.hc && x.hc !== hc && x.dep) break;
  }
  return loc;
}
/* ========================= generation ============================ */
function generate(diags, prof, stabling, warn){
  const sections = {};
  for (const k of Object.keys(prof.sections)) sections[k] = prof.sections[k].slice();
  const loc2sec = {};
  for (const sec of Object.keys(sections)) for (const loc of sections[sec]) loc2sec[loc] = sec;
  /* A diagram that stands still all day has nothing to berth, so it is left
     off - but it is left off out loud, the way the weekday books do it,
     because the depot still has a unit sitting in that road and somebody
     otherwise has to write it on by hand.

     "Stabled" is where a diagram STARTS, not necessarily all it does: the
     prints mark the road the unit stands in overnight and then list the
     morning's work under it. Dropping anything carrying a STABLD row threw
     working diagrams away silently - on SUN 16/08, 465/9 diagrams 411 and
     412 off Gillingham depot at 00+55 as 5P87, and 376 diagram 821 off
     Slade Green depot at 00+45 as 5Z20. What counts is whether the diagram
     ever moves. */
  const mine = Array.from(diags.values())
    .filter(v => Object.prototype.hasOwnProperty.call(prof.fleets, v.fleet || ""))
    .sort((a,b) => a.code < b.code ? -1 : a.code > b.code ? 1 : a.num - b.num);
  const still = v => v.rows.every(r => !r.arr && !r.dep);
  const stood = mine.filter(still);
  const scope = mine.filter(v => !still(v));
  if (stood.length){
    const where = new Map();
    for (const v of stood){
      const loc = (v.rows[0] && v.rows[0].loc) || "?";
      where.set(loc, (where.get(loc) || 0) + 1);
    }
    warn.push(["stabled", stood.length + " diagram(s) stand all day and are " +
      "not berthed: " +
      Array.from(where).sort((a,b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
        .map(x => x[0] + " x" + x[1]).join(", "),
      null, stood.map(v => v.code + v.num).join(" ")]);
  }

  // A working unit can berth somewhere the section list has never heard of.
  // Give each such place its own section instead of dropping the movement.
  const auto = new Map(), autoOrder = [];
  for (const v of scope){
    const st = stopsOf(v.rows);
    const bb = berthBoundaries(v.code + v.num, st, stabling, []);
    for (let i = 0; i < bb.length - 1; i++){
      const o = st[bb[i]].loc;
      if (o && loc2sec[o] === undefined && (stabling.has(o) || looksLikeStabling(o)))
        auto.set(o, (auto.get(o) || 0) + 1);
    }
  }
  // Units that start or finish the day at an ordinary platform outside the
  // section list stand there overnight - that is a berth by construction
  // (the Strood starter), so the place earns a section like any other
  // berthing location. Mid-day turnrounds are untouched: only the first
  // and last stop of a diagram qualify here.
  for (const v of scope){
    const st = stopsOf(v.rows);
    for (const idx of [0, st.length - 1]){
      const o = st[idx].loc;
      if (o && loc2sec[o] === undefined && !(stabling.has(o) || looksLikeStabling(o)))
        auto.set(o, (auto.get(o) || 0) + 1);
    }
  }
  for (const o of Array.from(auto.keys()).sort()){
    const r = resolveStation(o);
    const secName = (r.name || o).toUpperCase();
    if (sections[secName] === undefined){ sections[secName] = []; autoOrder.push(secName); }
    sections[secName].push(o); loc2sec[o] = secName;
    warn.push(["autosec", auto.get(o) + " berthing(s) at " + o +
               ", which is not in the section list - listed under " + secName, null, ""]);
  }
  const entries = new Map();   // key -> entry (insertion ordered)
  const meta = new Map();      // diagram key -> {rows,stops,stints}
  for (const v of scope){
    const dk = v.code + "|" + v.num, dlabel = v.code + v.num;
    const rows = v.rows, stops = stopsOf(rows);
    const bnd = berthBoundaries(dlabel, stops, stabling, warn);
    const stints = []; for (let i = 0; i < bnd.length-1; i++) stints.push([bnd[i], bnd[i+1]]);
    meta.set(dk, {rows, stops, stints, num:v.num, code:v.code, fleet:v.fleet});
    for (let si = 0; si < stints.length; si++){
      const [a,b] = stints[si];
      const origin = stops[a].loc;
      const sec = loc2sec[origin];
      if (sec === undefined){
        if (stabling.has(origin)) warn.push(["unlisted", origin, null, dlabel]);
        continue;
      }
      const grp = new Set(sections[sec]);
      let leaveStop = null; const run = [];
      for (let k = a; k <= b; k++){
        const s = stops[k];
        if (grp.has(s.loc)) run.push(s);
        if (s.dep_idx === null) continue;
        const nxt = (k+1 <= b) ? stops[k+1] : null;
        if (nxt === null) break;
        if (!grp.has(nxt.loc) || k+1 === b){
          // A unit that pops out of the section and comes straight back
          // without working anything has been run round, not sent out. The
          // service that follows is the departure.
          let back = null;
          for (let j = k + 1; j <= b; j++)
            if (grp.has(stops[j].loc)){ back = j; break; }
          if (back !== null && s.dep !== null && stops[back].arr !== null
              && mod1440(stops[back].arr - s.dep) <= RUN_ROUND){
            let worked = false;
            for (let j = k; j < back; j++)
              if ("12".indexOf((stops[j].hc_out || "5")[0]) >= 0){ worked = true; break; }
            if (!worked){
              const backDep = stops[back].dep_idx !== null
                            ? rows[stops[back].dep_idx].dep : "next";
              warn.push(["runround", v.code + v.num + " runs round via " + nxt.loc +
                         " at " + rows[s.dep_idx].dep + " (" +
                         mod1440(stops[back].arr - s.dep) +
                         " min) - listed on its " + backDep + " departure instead",
                         null, ""]);
              continue;
            }
          }
          leaveStop = s; break;
        }
      }
      if (leaveStop === null) continue;
      // time it off the platform if the unit runs through the platform
      const plat = PLATFORM[sec];
      if (plat){
        const onPlat = run.find(function(s){
          return s.loc === plat && s.dep_idx !== null; });
        if (onPlat) leaveStop = onPlat;
      }
      let exitStop = leaveStop;
      if (prof.first_dep_all || prof.first_dep.has(sec)){
        for (let k = a; k <= b; k++)
          if (stops[k].dep_idx !== null){ exitStop = stops[k]; break; }
      }
      const fmRow = rows[leaveStop.dep_idx];
      const ei = exitStop.dep_idx, er = rows[ei];
      // The metro book is timed off the first move, but a unit that only
      // runs empty into the platform alongside still shows where the
      // service it forms is going. The two depot sections keep their own
      // long-standing wording.
      const di = (prof.first_dep_all && !prof.first_dep.has(sec))
                 ? leaveStop.dep_idx : ei;
      const key = sec + "\u0000" + mins(er.dep) + "\u0000" + er.hc;
      let e = entries.get(key);
      if (!e){
        e = {sec, key, tmin:mins(er.dep), time_raw:er.dep, hc:er.hc,
             dest_loc:legEnd(rows, di), units:[], origins:new Set(),
             exit_fm:new Map()};
        entries.set(key, e);
      }
      e.units.push({dk, si, ei});
      e.origins.add(origin);
      if (e.exit_fm.size === 0){
        const f1 = fmtParse(fmRow.fm);
        e.exit_fm = f1.size ? f1 : fmtParse(er.fm);
      }
    }
  }
  /* ---- per-unit derivations ---- */
  for (const e of entries.values()){
    const sec = e.sec, grp = new Set(sections[sec]);
    const blocks = [];
    for (const {dk, si, ei} of e.units){
      const {rows, stops, stints, num, code, fleet} = meta.get(dk);
      const later = stints.slice(si+1).map(([a,]) => stops[a].loc);
      // E answers "where does it end up after this entry". An entry that comes
      // off the last berth ends wherever the diagram ends; an earlier entry
      // ends at that berth, not at the platform the empty move leaves it on.
      const fb = finalBerth(stops, stints);
      const final = later.length ? fb.loc : stops[stops.length-1].loc;
      if (fb.insteadOf && later.length)
        warn.push(["complex", code + num + " runs empty from " + fb.loc + " to " +
                   fb.insteadOf + " at the end of the day - earlier entries show it " +
                   "finishing at " + fb.loc, null, ""]);
      const fcode = codeFor(final, BERTH_CODE, warn, code + num);
      let Dv, Ev;
      if (later.length === 0){
        const last = stops[stops.length-1];
        const t = last.arr !== null ? last.arr : last.dep;
        if (t !== null && sortkey(t) < 16*60){ Dv = fcode; Ev = ""; }
        else { Dv = ""; Ev = fcode; }
      } else {
        Dv = (loc2sec[later[0]] !== undefined)
             ? codeFor(later[0], BERTH_CODE, warn, code + num) : "";
        Ev = fcode;
        // If E has been collapsed back to the last berth and D points at that
        // same berthing, it is one berth, so print it once.
        if (fb.insteadOf && si + 1 === stints.length - 1) Dv = "";
      }
      const [a,b] = stints[si];
      const i0 = stops[a].i0, nxtI = stops[b].i1;
      let attBefore = false;
      for (let i = i0; i < ei; i++) if (ATT.includes(rows[i].ev)){ attBefore = true; break; }
      const devents = [];
      let locNow = rows[ei].loc;
      let fmNow = e.exit_fm.size ? new Set(e.exit_fm.keys()) : new Set([num]);
      for (let i = ei+1; i <= nxtI; i++){
        const r = rows[i];
        if (r.loc) locNow = r.loc;
        const f = fmtParse(r.fm);
        if (f.size) fmNow = new Set(f.keys());
        if (DET.includes(r.ev)) devents.push([locNow, new Set(fmNow)]);
      }
      let paxAfter = false;
      for (let i = ei+1; i < rows.length; i++){
        const r = rows[i];
        if (r.hc && (r.hc[0] === "1" || r.hc[0] === "2") && r.dep){ paxAfter = true; break; }
      }
      blocks.push({dk, num, si, pos: e.exit_fm.has(num) ? e.exit_fm.get(num) : 999,
                   D:Dv, E:Ev, att:attBefore, devents, bound_loc:stops[b].loc,
                   pax_after:paxAfter, later:later.length > 0,
                   cls:prof.fleets[fleet]});
    }
    /* Lowest Position first, everywhere - which is NOT the weekday rule, and
       is the one place the two books are meant to differ.

       The weekday books read each section against the direction of travel
       (pos_asc, with road_pos_asc for a road that faces the other way), and
       carrying that over here looked obviously right: which end a formation
       reads from is a fact about the place, not about the day. It is not.
       Checked against the verified Sunday 16/08 book it reordered 53 of the
       71 multi-unit entries - every one at Ashford, Slade Green, Victoria,
       Dartford, West Marina, Tonbridge, Orpington and Sidcup - and the book
       is right. The weekday directions were scored against hand-marked
       weekday books and belong to them.

       Two other traps for anyone who tries this again. The weekday
       road_pos_asc names one road, so on the weekend prints the override
       never fires at all and every section falls to the section default.
       And the prints abbreviate road names, so bridging to the weekday
       names through the siding-note tables looks tempting - but a note is a
       short label, not a name: Dartford up siding and Slade Green up C.H.S.
       are both written "UPS", so that bridge hands Dartford's formations
       Slade Green's order. Both pinned in test/data.test.mjs.

       (The pinned order is not carried over either, for a plainer reason:
       pins name weekday diagram numbers and the weekend prints number their
       diagrams separately, so a pin could only ever match by accident.) */
    blocks.sort((x,y) => x.pos - y.pos || x.num - y.num);
    if (blocks.length > 1 && blocks.every(x => x.pos === 999))
      warn.push(["order", sec + " " + e.time_raw, null, ""]);
    e.blocks = blocks;
    const blockNums = new Set(blocks.map(x => x.num));
    const boundsOk = blocks.every(x => grp.has(x.bound_loc));
    const trainMulti = e.exit_fm.size >= 2 || blocks.length >= 2;
    let splits = false;
    if (trainMulti){
      outer:
      for (const x of blocks) for (const [loc, nums] of x.devents){
        const stranger = Array.from(nums).some(n => !blockNums.has(n));
        if (!grp.has(loc) || !boundsOk || stranger){ splits = true; break outer; }
      }
      // Diagrams that attach and detach but then run the same path to the
      // same berth never really parted - that pair travels as one train all
      // day, so the flag would only mislead. Compare every block's full
      // stint (each stop with its times): identical for all of them means
      // no split to warn about.
      if (splits && blocks.length > 1){
        const path = function(x){
          const m = meta.get(x.dk);
          const [pa, pb] = m.stints[x.si];
          return m.stops.slice(pa, pb + 1)
            .map(function(s){ return s.loc + "@" + s.arr + "/" + s.dep; })
            .join(">");
        };
        const p0 = path(blocks[0]);
        if (blocks.every(function(x){ return path(x) === p0; })) splits = false;
      }
    }
    e.splits = splits;
    e.attachment = blocks.some(x => x.att);
    for (const x of blocks) x.end = "";
    e.dest = codeFor(e.dest_loc, DEST_CODE, warn, sec + " " + e.time_raw);
    const mk = END_MARKERS[sec];
    if (mk && blocks.length > 1){
      const firstUnit = e.units.find(function(u){ return u.dk === blocks[0].dk; });
      const route = new Set(legLocs(meta.get(blocks[0].dk).rows, firstUnit.ei));
      const dest = e.dest;
      let lead = null, rear = null;
      // A destination reached two ways settles it on the route first - the
      // headcode carries it, and the leg's stop list does not.
      const rr = routeRule(sec, dest, e.hc);
      if (rr && rr.lead){
        lead = mk[rr.lead]; rear = mk[rr.lead === "fke" ? "cbe" : "fke"];
      }
      else if (mk.fke_leads.has(dest)){ lead = mk.fke; rear = mk.cbe; }
      else if (mk.cbe_leads.has(dest) ||
               Array.from(mk.cbe_via).some(function(v){ return route.has(v); })){
        lead = mk.cbe; rear = mk.fke;
      } else {
        warn.push(["noend", sec + " " + e.time_raw + " runs to " + dest +
                   " - no rule for which end leads, so no end marker", null, ""]);
      }
      if (lead){ blocks[0].end = lead; blocks[blocks.length - 1].end = rear; }
    }
    e.note = "";
    for (const o of Array.from(e.origins).sort())
      if (NOTE_FROM_BERTH[o] !== undefined){ e.note = NOTE_FROM_BERTH[o]; break; }
    // two routes to one place: say which, on the destination cell
    { const rr = routeRule(sec, e.dest, e.hc); if (rr && rr.via) e.via = rr.via; }
    const dl = e.dest_loc;
    e.time = e.time_raw.replace(/\./g, " ");
    e.suppress = (!prof.ecs_only_ok.has(sec) && !!e.hc && e.hc[0] === "5"
                  && !blocks.some(x => x.pax_after)
                  && (grp.has(dl) || stabling.has(dl)));
  }
  /* ---- D cross-reference ---- */
  const live = new Set();
  for (const e of entries.values()) if (!e.suppress)
    for (const x of e.blocks) live.add(x.dk + "|" + x.si);
  for (const e of entries.values()){
    for (const x of e.blocks)
      if (x.D && x.later && !live.has(x.dk + "|" + (x.si+1))) x.D = "";
    const pairs = new Set(e.blocks.map(x => x.D + "\u0000" + x.E));
    e.splits_pm = (!e.splits && e.blocks.length > 1 && pairs.size > 1);
    if (e.suppress)
      warn.push(["suppress", e.sec + " " + e.time_raw + " (" +
                 e.blocks.map(x => dnum(x.num)).join("+") + ")", null, ""]);
  }
  const keys = Array.from(entries.keys());
  keys.sort((ka,kb) => {
    const a = entries.get(ka), b = entries.get(kb);
    if (a.sec !== b.sec) return a.sec < b.sec ? -1 : 1;
    return sortkey(a.tmin) - sortkey(b.tmin);
  });
  const out = {};
  for (const k of keys){
    const e = entries.get(k);
    if (e.suppress) continue;
    (out[e.sec] = out[e.sec] || []).push(e);
  }
  // A place the section list has never heard of still earns its spot in
  // the alphabet, not a tail-end afterthought at the bottom of the sheet.
  const order = Object.keys(prof.sections);
  for (const name of autoOrder.slice().sort()){
    let at = order.length;
    for (let i = 0; i < order.length; i++){
      if (name < order[i]){ at = i; break; }
    }
    order.splice(at, 0, name);
  }
  return {out: out, order: order};
}
const MONTHS = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
const DAYS = ["SUN","MON","TUE","WED","THU","FRI","SAT"];
function dateBits(dateStr){
  const p = dateStr.split("/").map(function(x){ return parseInt(x,10); });
  const dt = new Date(Date.UTC(p[2], p[1]-1, p[0]));
  const day = DAYS[dt.getUTCDay()];
  return {banner: day + " " + String(p[0]).padStart(2,"0") + "/" + String(p[1]).padStart(2,"0"),
          stamp: day + "_" + String(p[0]).padStart(2,"0") + "_" + MONTHS[p[1]-1]};
}
/* House grid: a medium box round each section, medium verticals after the
   diagram, D and remarks columns, thin verticals inside the unit block, and a
   thin rule under every entry. Taken from the ruled sheets. */
const COL_SIDES = [["medium",null],["thin",null],["thin","medium"],[null,null],
                   ["thin","medium"],[null,null],[null,null],[null,"medium"]];
/* Double lines follow the weekday rule: a break of BREAK_GAP or more in a
   location's work, with work still to come after it, is ruled off - and a
   page carries as many lines as it has breaks. It used to rule wherever the
   section crossed midday and 20 00, which drew a line through a location
   that was busy right across the middle of the day and none at all through
   one that stood idle from 08 00 to 19 00. */
const BREAK_GAP = SHEETS_XLSX.BREAK_GAP;
/* The sheet is laid out once. The xlsx writer and the on-screen preview both
   read that same layout, so what you look at is what you save. */
function layoutBook(sectionsOut, sectionOrder, headcodeSections, dateStr, allHc){
  const banner = dateBits(dateStr).banner;
  const cells = [], merges = [], rowHeights = new Map();
  const at = new Map();                       // "r,c" -> cell
  function put(r, c, v, look){
    const cell = {r:r, c:c, v:v, look:look, sides:[null,null,null,null]};
    cells.push(cell); at.set(r + "," + c, cell);
    return cell;
  }
  function ruleSection(firstRow, lastRow, entryEnds, doubleEnds){
    for (let r = firstRow; r <= lastRow; r++){
      const top = (r === firstRow) ? "medium" : null;
      const bottom = (r === lastRow) ? "medium"
                   : doubleEnds.has(r) ? "double"
                   : entryEnds.has(r) ? "thin" : null;
      for (let i = 0; i < COL_SIDES.length; i++){
        const key = r + "," + (i+1);
        let cell = at.get(key);
        if (!cell) cell = put(r, i+1, "", 0);
        cell.sides = [COL_SIDES[i][0], COL_SIDES[i][1], top, bottom];
      }
    }
  }
  let r = 1, first = true;
  for (const sec of sectionOrder){
    if (!sectionsOut[sec]) continue;
    merges.push("A" + r + ":G" + r);
    put(r, 1, sec, 1);
    if (first) put(r, 8, banner, 2);
    else { const c = put(r, 8, banner, 2); c.f = "H1"; }
    rowHeights.set(r, 18); first = false; r++;
    const bodyFirst = r, entryEnds = new Set(), doubleEnds = new Set();
    let prevTk = null, prevLast = null;
    for (const e of sectionsOut[sec]){
      const tk = sortkey(mins(e.time_raw));
      // Grove Park is never ruled - neither real weekday book rules it
      if (prevTk !== null && sec !== "GROVE PARK" && tk - prevTk >= BREAK_GAP)
        doubleEnds.add(prevLast);
      const lead = r;
      e.blocks.forEach(function(u, i){
        if (i === 0) put(r, 1, e.time + " " + e.dest, 3);
        put(r, 2, u.cls, 3);
        put(r, 3, dnum(u.num), 3);
        if (u.D) put(r, 4, u.D, 4);
        if (u.E) put(r, 5, u.E, 4);
        const parts = [];
        if (i === 0){
          if ((allHc || headcodeSections.has(sec)) && e.hc) parts.push(e.hc);
          /* The route goes in the notes, not against the time. Column A is
             "HH MM DDD" in every real book and never more - the longest
             value in any of them is nine characters - so "Via AFK" against
             the time widened the column for the whole page. */
          if (e.via) parts.push("Via " + e.via);
          if (e.attachment) parts.push("ATTACHMENT");
          if (e.note) parts.push(e.note);
        }
        if (u.end) parts.push(u.end);
        if (parts.length) put(r, 8, parts.join(" "), 5);
        rowHeights.set(r, 18); r++;
      });
      if (e.splits || e.splits_pm){
        put(lead, 7, e.splits_pm ? "SPLITS PM" : "SPLITS", 6);
        if (e.blocks.length > 1)
          merges.push("G" + lead + ":G" + (lead + e.blocks.length - 1));
      }
      entryEnds.add(r - 1);
      prevTk = tk; prevLast = r - 1;
    }
    if (r > bodyFirst) ruleSection(bodyFirst, r - 1, entryEnds, doubleEnds);
    rowHeights.set(r, 18); r++;
  }
  return {cells:cells, merges:merges, rowHeights:rowHeights, maxRow:r};
}
function buildBook(layout, zipFn){
  return SHEETS_XLSX.writeWorkbook([{name: "Sheet1", layout: layout}], zipFn);
}
const previewHtml = SHEETS_XLSX.previewHtml;
function buildReport(book, nEntries, nSecs, warn){
  const dwell = new Map(), unlisted = new Map();
  const dest = new Map(), berth = new Map(), other = [];
  for (const [kind,a,b,c] of warn){
    if (kind === "dwell"){ if (!dwell.has(a)) dwell.set(a,[]); dwell.get(a).push(b); }
    else if (kind === "unlisted") unlisted.set(a, (unlisted.get(a)||0) + 1);
    else if (kind === "destcode"){ if (!dest.has(a)) dest.set(a,new Set()); dest.get(a).add(c); }
    else if (kind === "berthcode"){ if (!berth.has(a)) berth.set(a,new Set()); berth.get(a).add(c); }
    else if (kind === "suppress") other.push("suppressed positioning shunt: " + a);
    else if (kind === "autosec") other.push("new section: " + a);
    else if (kind === "platberth") other.push("not listed: " + a);
    else if (kind === "shortberth") other.push("short stop: " + a);
    else if (kind === "complex") other.push("finish: " + a);
    else if (kind === "noend") other.push("end marker: " + a);
    else if (kind === "runround") other.push("run-round: " + a);
    else if (kind === "resolved") other.push("location read as: " + a);
    else if (kind === "merge") other.push(a);
    else if (kind === "stabled") other.push("standing all day: " + a +
                                            (c ? " (" + c + ")" : ""));
    else if (kind === "nocode") other.push("no code for '" + a + "' - used '" +
                                           a.slice(0,3).toUpperCase() + "'");
    else other.push(kind + ": " + a + " " + c);
  }
  const srt = m => Array.from(m.keys()).sort();
  let out = book + ": " + nEntries + " entries in " + nSecs + " sections\n\nReview items:\n";
  for (const loc of srt(dwell)){
    const ds = dwell.get(loc);
    out += "- " + loc + ": " + ds.length + " station dwell(s) of " +
           Math.min(...ds) + "-" + Math.max(...ds) + " min treated as layovers, not berths\n";
  }
  for (const loc of srt(unlisted))
    out += "- " + loc + ": " + unlisted.get(loc) +
           " berth departure(s) at a location with no section — not listed\n";
  for (const loc of srt(dest))
    out += "- destination '" + loc + "' has no code (used fallback) at: " +
           Array.from(dest.get(loc)).sort().join(", ") + "\n";
  for (const loc of srt(berth))
    out += "- berth '" + loc + "' has no code (used fallback): " +
           Array.from(berth.get(loc)).sort().join(", ") + "\n";
  for (const x of Array.from(new Set(other))) out += "- " + x + "\n";
  return out;
}
/* ========================= top level ============================= */
/* ============== reissue cross-reference / merge ================== */
function isDocxBytes(b){
  return b && b[0] === 0x50 && b[1] === 0x4B && b[2] === 0x03 && b[3] === 0x04;
}
function mergeDocs(inputs, unzipFn){
  const parsedDocs = inputs.map(function(f){
    const lines = readPrints(f.bytes, unzipFn);
    return {name: f.name, bytes: f.bytes, diags: parseDiagrams(lines)};
  });
  let bases = parsedDocs.filter(function(d){ return !/re-?issue/i.test(d.name); });
  let reissues = parsedDocs.filter(function(d){ return /re-?issue/i.test(d.name); });
  if (bases.length === 0 && parsedDocs.length === 1)
    throw new Error("That looks like a reissue on its own — drop the full weekly " +
                    "prints with it (or first) so there is something to update.");
  if (bases.length === 0){
    parsedDocs.sort(function(a, b){ return b.diags.size - a.diags.size; });
    bases = [parsedDocs[0]];
    reissues = parsedDocs.slice(1);
  }
  if (bases.length > 1)
    throw new Error("More than one full prints document was dropped — drop one " +
                    "weekly prints file plus its reissue documents.");
  const base = bases[0];
  function docDate(d){
    for (const v of d.diags.values()) if (v.date) return v.date;
    return null;
  }
  const baseDate = docDate(base);
  const merged = new Map(base.diags);
  const replaced = [], added = [];
  for (const r of reissues){
    const rDate = docDate(r);
    if (baseDate && rDate && rDate !== baseDate)
      throw new Error('"' + r.name + '" is dated ' + rDate + " but the prints are " +
                      "dated " + baseDate + " — that reissue belongs to a different day.");
    for (const [k, v] of r.diags){
      if (merged.has(k)) replaced.push(v.code + " " + v.num);
      else added.push(v.code + " " + v.num);
      merged.set(k, v);
    }
  }
  return {base: base, reissues: reissues, merged: merged,
          replaced: replaced, added: added};
}
function docParaSpans2(xml){
  const paras = [];
  /* A paragraph need not carry attributes. The old pattern required a space
     after "w:p", so every <w:p> in a plain Word document was invisible here:
     diagSpansX found no paragraphs, the reissue merge replaced nothing, and
     the "updated prints" the panel saved were byte-identical to the
     superseded original with no warning anywhere. */
  const re = /<w:p(?:\s[^>]*)?\/>|<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g;
  let m;
  while ((m = re.exec(xml)) !== null) paras.push([m.index, m.index + m[0].length]);
  return paras;
}
function paraTextX(s){
  const re = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g;
  let out = "", m;
  while ((m = re.exec(s)) !== null) out += m[1];
  return out;
}
function diagSpansX(xml){
  const paras = docParaSpans2(xml);
  const starts = [];
  for (let i = 0; i < paras.length; i++){
    const t = paraTextX(xml.slice(paras[i][0], paras[i][1])).trim();
    if (t.indexOf("Diagram:") === 0){
      const dm = /Diagram:\s*([A-Za-z0-9]+)/.exec(t);
      starts.push([i, dm ? dm[1] : t]);
    }
  }
  const diags = [];
  for (let j = 0; j < starts.length; j++){
    const end = j + 1 < starts.length ? starts[j + 1][0] - 1 : paras.length - 1;
    diags.push({key: starts[j][1], a: starts[j][0], b: end});
  }
  return {paras: paras, diags: diags};
}
function buildUpdatedDocx(base, reissues, unzipFn, zipFn){
  if (!isDocxBytes(base.bytes)) return null;
  const dec = new TextDecoder("utf-8");
  const enc = new TextEncoder();
  let files;
  try{ files = unzipFn(base.bytes); } catch (e){ return null; }
  if (!files["word/document.xml"]) return null;
  let xml = dec.decode(files["word/document.xml"]);
  for (const r of reissues){
    if (!isDocxBytes(r.bytes)) continue;
    let rf;
    try{ rf = unzipFn(r.bytes); } catch (e){ continue; }
    if (!rf["word/document.xml"]) continue;
    const rxml = dec.decode(rf["word/document.xml"]);
    const B = diagSpansX(xml), R = diagSpansX(rxml);
    const rmap = new Map();
    for (const d of R.diags)
      rmap.set(d.key, rxml.slice(R.paras[d.a][0], R.paras[d.b][1]));
    const consumed = new Set();
    const out = [];
    let pos = 0;
    for (const d of B.diags){
      const a = B.paras[d.a][0], b = B.paras[d.b][1];
      out.push(xml.slice(pos, a));
      if (rmap.has(d.key)){ out.push(rmap.get(d.key)); consumed.add(d.key); }
      else out.push(xml.slice(a, b));
      pos = b;
    }
    let extra = "";
    for (const [k, v] of rmap) if (!consumed.has(k)) extra += v;
    out.push(extra);
    out.push(xml.slice(pos));
    xml = out.join("");
  }
  files["word/document.xml"] = enc.encode(xml);
  let zipped;
  try{ zipped = zipFn(files); } catch (e){ return null; }
  const nm = base.name.replace(/\.docx$/i, "").replace(/\.doc$/i, "") + "_UPDATED.docx";
  return {name: nm, bytes: zipped};
}

function run(input, unzipFn, zipFn, opts){
  const allHeadcodes = (opts && opts.allHeadcodes) || {};
  const inputs = Array.isArray(input) ? input : [{name: "prints.docx", bytes: input}];
  const mg = mergeDocs(inputs, unzipFn);
  const diags = mg.merged;
  if (diags.size === 0)
    throw new Error("No diagrams found in that file. Check it's the weekly diagram prints.");
  let dateStr = null;
  for (const v of diags.values()) if (v.date){ dateStr = v.date; break; }
  if (!dateStr) throw new Error("No date found in the prints — can't name the sheets.");
  const {stamp, banner} = dateBits(dateStr);
  let updated = null;
  const mergeLines = [];
  if (mg.reissues.length){
    updated = buildUpdatedDocx(mg.base, mg.reissues, unzipFn, zipFn);
    mergeLines.push(["merge", "reissue merged: " + mg.replaced.length +
      " diagram(s) replaced" +
      (mg.added.length ? ", " + mg.added.length + " added" : "") +
      " from " + mg.reissues.map(function(r){ return r.name; }).join(", ")]);
    if (mg.replaced.length)
      mergeLines.push(["merge", "replaced by reissue: " + mg.replaced.join(", ")]);
    if (mg.added.length)
      mergeLines.push(["merge", "added by reissue: " + mg.added.join(", ")]);
    if (!updated)
      mergeLines.push(["merge", "updated prints document not produced (the base " +
                      "prints are not a .docx) — the books above still use the " +
                      "merged data"]);
  }
  const learned = new Set();
  for (const v of diags.values()){
    for (let i = 0; i < v.rows.length; i++)
      if (v.rows[i].ev === "#")
        learned.add(v.rows[i].loc || (i > 0 ? v.rows[i-1].loc : ""));
  }
  const stabling = new Set(BASE_STABLING);
  for (const x of learned) stabling.add(x);
  for (const x of TRANSIT) stabling.delete(x);
  stabling.delete("");
  const books = [];
  for (const prof of PROFILES){
    const warn = mergeLines.slice();
    const gen = generate(diags, prof, stabling, warn);
    const secs = gen.out;
    const n = Object.values(secs).reduce((a,v) => a + v.length, 0);
    if (n === 0){ books.push({label:prof.label, road:prof.road, skipped:true}); continue; }
    const tag = prof.tag ? "_" + prof.tag : "";
    const name = "SHEETS" + tag + "_" + stamp + ".xlsx";
    const layout = layoutBook(secs, gen.order, prof.headcode_sections, dateStr,
                              !!allHeadcodes[prof.road]);
    const xlsx = buildBook(layout, zipFn);
    const nSecs = Object.keys(secs).length;
    books.push({label:prof.label, road:prof.road, name, xlsx, layout,
                reportName: name.replace(/\.xlsx$/, ".report.txt"),
                report: buildReport(name, n, nSecs, warn),
                entries:n, sections:nSecs, reviews:warn.length,
                sectionCounts: Object.keys(secs).map(s => [s, secs[s].length])});
  }
  return {date: dateStr, banner, stamp, diagrams: diags.size, books,
          merge: mg.reissues.length
            ? {replaced: mg.replaced, added: mg.added,
               reissueNames: mg.reissues.map(function(r){ return r.name; })}
            : null,
          updated: updated};
}
root.SheetsEngine = {run, PROFILES, docxParagraphs, parseDiagrams, dateBits,
                    previewHtml, resolveStation, codeFor, looksLikeStabling,
                    DEST_CODE, BERTH_CODE};
})(typeof globalThis !== "undefined" ? globalThis : this);
