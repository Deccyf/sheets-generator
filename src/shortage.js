/* SHEETS_SHORTAGE — the shortage and variations list, off the GENIUS
   Operating Report and the Diagram Detail. Ported from the depot's
   "Shortage and Variations" prototype (v0.4), whose engine is kept as it
   was written: it was held against the real 18/09 reports before the port
   and reproduced them, so the logic is evidence and the port is plumbing.

   What changed on the way in. The prototype carried its own copy of the
   PDF text extractor and its own fflate; both are already in this build, so
   it reads what the rest of the tool reads and the Diagram Detail can now
   come in as the CSV export as well as the PDF. Everything else - the
   report-time windows, the leg/occurrence union that traces a variation
   through every diagram sharing a working, the Ramsgate ending rule, the
   master location groups - is the prototype's.

   This is NOT a berthing sheet and does not share their vocabulary. A
   berthing sheet names the station a unit is put away at; a controller's
   discrepancy note names the ROAD, because that is what a shortage is moved
   off. So AFDS/AFES/AFUS where the books say AFK/AFE/AFU, DVPS for the
   Priory sidings, GPUS, VICS, TONJS, FAVUS. The two tables are deliberately
   apart and neither is the other's master. */
"use strict";
const SHEETS_SHORTAGE = (() => {
const pdfText = txt => GENIUS.pdfText(txt);
const { csvParse } = SHEETS_CORE;

// ---------- basic helpers ----------
const TM = /^\d\d:\d\d$/;
const HC_FULL = /^\d[A-Z]\d\d[A-Z]{0,2}$/;
function clockMins(t) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(t||"").trim());
  return m ? (+m[1])*60 + (+m[2]) : null;
}
function hhmm(mins, plus) {
  mins = ((mins % 1440) + 1440) % 1440;
  const h = String(Math.floor(mins/60)).padStart(2,"0");
  const m = String(mins%60).padStart(2,"0");
  return plus ? `${h}+${m}` : `${h} ${m}`;
}
function coreHC(hc) { return hc ? hc.slice(0,4) : "????"; }
function isClass5(hc) { return /^5/.test(hc||""); }
function unique(a) { return [...new Set(a)]; }

const ABBR = {
  ASHFDNS:"AFDS", ASHFDYW:"AFDS", ASHFKY:"AFK", TONBDG:"TON", ORPNGTN:"ORP",
  SEVNOAKS:"SEV", SVNOAKS:"SEV", CHRX:"CHX", DOVERP:"DVP",
  RAMSDRW:"RE", RAMSGTD:"RE", RAMMKEX:"RE", RAMMIEX:"RE", RAMSGTE:"RAM", RAMSNEW:"RE",
  VICTRIE:"VIC", MSTONEE:"MDE", FAVRSHM:"FAV", MARGATE:"MAR", GLNGHMK:"GLM",
  TONBDMS:"TONDMS", ASHFEBS:"AFES", ASHFUPS:"AFUS", STLNWCS:"XSE",
  HASTPSD:"HGPS", HASTING:"HGS", FAVRUPS:"FAVUS", FAVRBRD:"FAVBRD",
  CNTBW:"CBW", DOVERPS:"DVPS", FLKSETR:"FKETR", MINSTER:"MSR",
  GRVPCSD:"GP", GRVPKUS:"GPUS", GRVPKDS:"GPD", CANONST:"CST", VICTGCS:"VICS",
  BRSR:"BSR", TONBPMY:"TONJS", GLNGDEP:"GI", RCHT:"RTR", STNGBRN:"SIT",
  STROOD:"SOO", SHRNSOS:"SSS", MSTONEW:"MDW"
};
const KNOWN_CODES = new Set(Object.keys(ABBR));
const MASTER_GROUPS = [
  ["AFDS","AFES","AFUS"], ["FAV","FAVBRD","FAVUS"], ["DVP","DVPS"],
  ["TON","TONJS","TONDMS"], ["RAM","RE"], ["HGS","HGPS"], ["VICS","VIC"]
];
function abbr(code, reviews) {
  if (ABBR[code]) return ABBR[code];
  if (reviews && code && !/^RAM\d+$/.test(code)) reviews.push(`Unknown location abbreviation: ${code}`);
  return "???";
}
function masterKey(code) {
  for (const g of MASTER_GROUPS) if (g.includes(code)) return g[0];
  return code;
}
function isIgnoredShuntCodes(a,b) {
  const ash = new Set(["ASHFDNS","ASHFUPS","ASHFEBS"]);
  const gp = new Set(["GRVPCSD","GRVPKUS","GRVPKDS","GRVPDCE"]);
  return (ash.has(a) && ash.has(b)) || (gp.has(a) && gp.has(b));
}
function isRamsgateArea(code) { return /^RAM/.test(code||""); }

function plannedFamily(diag, planned) {
  if (/^GT\d{3}$/.test(diag)) return "377";
  if (/^RM3\d\d$/.test(diag)) return "3";
  if (/^RM9\d\d$/.test(diag)) return "9";
  if (/^RM0\d\d$/.test(diag)) return "N";
  const m375 = /^375\/([36789])$/.exec(planned||"");
  if (m375) return m375[1]==="3"?"3":m375[1]==="9"?"9":"N";
  if (/^377\/\d$/.test(planned||"")) return "377";
  return null;
}
function plannedClass(diag, planned) { return /^GT\d{3}$/.test(diag) || /^377\//.test(planned||"") ? "377" : "375"; }
function plannedLength(diag, planned) { return plannedFamily(diag,planned)==="3" ? 3 : 4; }
function resourceInfo(resource) {
  const v=String(resource||"");
  let m=/^375([36789])\d\d$/.exec(v);
  if (m) { const d=m[1]; return { cls:"375", family:d==="3"?"3":d==="9"?"9":"N", length:d==="3"?3:4 }; }
  if (/^377\d{3}$/.test(v)) return { cls:"377", family:"377", length:4 };
  return null;
}

// ---------- Operating Report ----------
const ALLOC_RE = /^(?:375\/[36789]|377\/\d)$/;
const RES_RE = /^(?:375[36789]\d\d|377\d{3})$/;
/* The clock, the lengths and the fleets a row implies. Both readers below
   end here, so the two shapes of the same report cannot drift apart. */
function finishOpRow(row) {
  row.depMin=clockMins(row.dep); row.arrMin=clockMins(row.arr);
  row.arrExt=row.arrMin;
  while (row.arrExt < row.depMin) row.arrExt += 1440;
  row.expectedFamily=plannedFamily(row.diag,row.planned);
  row.expectedLength=plannedLength(row.diag,row.planned);
  row.actual=resourceInfo(row.resource);
  return row;
}
function parseOperating(txt) {
  const rows=[];
  const tm = /\bTime:\s*(\d\d:\d\d)/i.exec(txt);
  const reportTime = tm ? clockMins(tm[1]) : null;
  for (const raw of txt.split("\n")) {
    const l=raw.trim();
    if (!/^(?:RM|GT)\d{3}\b/.test(l)) continue;
    const t=l.split(/\s{2,}/).filter(Boolean);
    if (t.length < 10 || !/^(?:RM|GT)\d{3}$/.test(t[0]) || !TM.test(t[3]||"") || !TM.test(t[4]||"")) continue;
    const row={diag:t[0],date:t[1],from:t[2],dep:t[3],arr:t[4],to:t[5],trainid:t[6],depot:t[7],planned:t[8],allocated:null,resource:null,owning:null,discrepancy:""};
    let i=9;
    if (ALLOC_RE.test(t[i]||"")) row.allocated=t[i++];
    if (RES_RE.test(t[i]||"")) row.resource=t[i++];
    if (/^[A-Z]{2,3}$/.test(t[i]||"")) row.owning=t[i++];
    row.discrepancy=t.slice(i).join(" ");
    rows.push(finishOpRow(row));
  }
  return {reportTime, rows};
}
/* ---------- the Operating Report as the CSV export ----------
   The same report, saved rather than printed. Like the Diagram Detail's
   export it repeats the whole page header on every line and puts the
   thirteen data fields at the end, so the columns are found by their
   labels rather than counted from the left - and the print time sits in
   the cell after "Time:" rather than after a run of spaces.

   Everything the text reader has to infer from shape is a real cell here:
   a row with no unit allocated has an empty ALLOCATED and RESOURCE instead
   of two missing tokens, so nothing has to be guessed. */
const OP_COLS = ["diag","date","from","dep","arr","to","trainid","depot",
                 "planned","allocated","resource","owning","discrepancy"];
function parseOperatingCsv(text) {
  const rows=[]; let reportTime=null;
  for (const f of csvParse(text)) {
    const g = f.map(x => String(x == null ? "" : x).trim());
    if (reportTime === null) {
      const ti = g.lastIndexOf("Time:");
      if (ti >= 0 && TM.test(g[ti+1]||"")) reportTime = clockMins(g[ti+1]);
    }
    const di = g.lastIndexOf("DISCREPANCY");
    if (di < 0) continue;
    const d = g.slice(di + 1);
    if (d.length < OP_COLS.length) continue;
    const row = {};
    OP_COLS.forEach((k, i) => { row[k] = d[i]; });
    if (!/^(?:RM|GT)\d{3}$/.test(row.diag) || !TM.test(row.dep) || !TM.test(row.arr))
      continue;
    if (!ALLOC_RE.test(row.allocated)) row.allocated = null;
    if (!RES_RE.test(row.resource)) row.resource = null;
    if (!/^[A-Z]{2,3}$/.test(row.owning)) row.owning = null;
    rows.push(finishOpRow(row));
  }
  return {reportTime, rows};
}
/* Either shape of it, the same way the Diagram Detail is taken either way.
   The saved one is tried first when there are commas to make it possible,
   and only counts if it actually found rows - the printed one has commas in
   its date line too. */
function operatingFrom(text) {
  if (String(text||"").indexOf(",") >= 0) {
    const csv = parseOperatingCsv(text);
    if (csv.rows.length) return csv;
  }
  return parseOperating(text);
}
function rowQualifiesUnallocated(row, reportTime) {
  if (!/Not allocated/i.test(row.discrepancy||"")) return false;
  if (isIgnoredShuntCodes(row.from,row.to)) return false;
  const d=row.depMin;
  if (reportTime==null) return false;
  if (reportTime >= 1 && reportTime < 8*60) return d < 9*60;
  if (reportTime >= 8*60 && reportTime < 18*60) return d >= 12*60 && d <= 18*60;
  return false;
}
function rowsByDiag(opRows) {
  const m=new Map();
  for (const r of opRows) { if(!m.has(r.diag))m.set(r.diag,[]);m.get(r.diag).push(r); }
  return m;
}
function selectedAllocatedRows(opRows) {
  const by=rowsByDiag(opRows), out=new Map();
  for (const [d,rs] of by) {
    const alloc=rs.filter(r=>r.resource);
    if (!alloc.length) continue;
    alloc.sort((a,b)=>a.arrExt-b.arrExt || a.depMin-b.depMin);
    out.set(d,alloc[alloc.length-1]);
  }
  return out;
}
function diagramFinishMinute(diag, detail) {
  const rows=detail.get(diag)||[];
  let max=null;
  for(const r of rows){
    for(const v of [r.arr,r.dep]) if(v!=null) max=max==null?v:Math.max(max,v);
  }
  return max;
}
function omitFinishedBy1600(diag, reportTime, detail) {
  if(reportTime==null || reportTime<8*60 || reportTime>=16*60) return false;
  const end=diagramFinishMinute(diag,detail);
  return end!=null && end<=16*60;
}

// ---------- Diagram Detail ----------
function parseDetail(txt) {
  const byDiag=new Map();
  let cur=null, curDiag=null, prev=-1;
  for (const raw of txt.split("\n")) {
    const l=raw.trim();
    const dm=/Diagram\s+([A-Z]{2}\s?\d\s?\d\s?\d)\s+On\s+(\d\d\/\d\d\/\d{2,4})/.exec(l)
          || /^([A-Z]{2}\s?\d\s?\d\s?\d)\s+(\d\d\/\d\d\/\d{2,4})$/.exec(l);
    if (dm) { curDiag=dm[1].replace(/\s+/g,""); cur=[]; byDiag.set(curDiag,cur); prev=-1; continue; }
    if (!cur) continue;
    const t=l.split(/\s{2,}/).filter(Boolean);
    if (!/^[A-Z0-9]{3,8}$/.test(t[0]||"") || /^GENIUS/.test(t[0])) continue;
    const times=t.filter(v=>TM.test(v));
    const hc=t.find(v=>HC_FULL.test(v))||null;
    const act=t.find(v=>/^(ATTTT|ATTACH|DETACH|DETTT|#)$/i.test(v))||null;
    if (!times.length) continue;
    const nameEnd=t.indexOf(times[0]);
    const name=t.slice(1,nameEnd).join(" ");
    let arr=null,dep=null;
    if (times.length>=2){arr=clockMins(times[0]);dep=clockMins(times[1]);}
    else if(cur.length===0)dep=clockMins(times[0]);
    else arr=clockMins(times[0]);
    for (const k of ["arr","dep"]) {
      let v=k==="arr"?arr:dep; if(v==null)continue;
      while(v<prev-60)v+=1440;
      prev=Math.max(prev,v);
      if(k==="arr")arr=v;else dep=v;
    }
    cur.push({diag:curDiag,code:t[0],name,arr,dep,hcFull:hc,hc:hc?hc.slice(0,4):null,act});
  }
  return byDiag;
}

function buildLegs(byDiag) {
  const all=[], by=new Map();
  for (const [diag,rows] of byDiag) {
    const legs=[];
    for(let i=0;i<rows.length-1;i++){
      const a=rows[i], b=rows[i+1];
      if(!a.hcFull || a.dep==null || b.arr==null) continue;
      const leg={diag,hcFull:a.hcFull,hc:a.hc,from:a.code,to:b.code,dep:a.dep,arr:b.arr,rowIndex:i,nextIndex:i+1};
      leg.key=`${leg.hcFull}|${leg.from}|${leg.to}|${leg.dep}|${leg.arr}`;
      legs.push(leg); all.push(leg);
    }
    by.set(diag,legs);
  }
  return {all,by};
}

function buildOccurrences(byDiag, legsByDiag) {
  const occs=[], byDiagOcc=new Map(); let oid=0;
  for (const [diag,rows] of byDiag) {
    const legs=legsByDiag.get(diag)||[];
    let current=null, lastHc=null;
    for (const leg of legs) {
      if (!current || leg.hcFull!==lastHc) {
        current={id:oid++,diag,hcFull:leg.hcFull,hc:leg.hc,legs:[]}; occs.push(current);
        if(!byDiagOcc.has(diag))byDiagOcc.set(diag,[]); byDiagOcc.get(diag).push(current);
      }
      current.legs.push(leg); lastHc=leg.hcFull;
    }
  }
  // union occurrences with same headcode and any identical leg
  const parent=occs.map((_,i)=>i);
  const find=i=>parent[i]===i?i:(parent[i]=find(parent[i]));
  const union=(a,b)=>{a=find(a);b=find(b);if(a!==b)parent[b]=a;};
  const legOwner=new Map();
  for(const o of occs){
    for(const leg of o.legs){
      const k=leg.key;
      if(legOwner.has(k)) union(o.id, legOwner.get(k)); else legOwner.set(k,o.id);
    }
  }
  const comps=new Map();
  for(const o of occs){const r=find(o.id);if(!comps.has(r))comps.set(r,[]);comps.get(r).push(o);}
  const compInfo=new Map();
  for(const [r,os] of comps){
    const legs=os.flatMap(o=>o.legs);
    const earliest=legs.reduce((a,b)=>!a||b.dep<a.dep?b:a,null);
    const latest=legs.reduce((a,b)=>!a||b.arr>a.arr?b:a,null);
    compInfo.set(r,{root:r,occs:os,legs,origin:earliest?earliest.from:null,dest:latest?latest.to:null,dep:earliest?earliest.dep:null,arr:latest?latest.arr:null,hcFull:os[0]?.hcFull||null});
  }
  for(const o of occs)o.root=find(o.id);
  return {occs,byDiagOcc,compInfo};
}
function occurrenceForLeg(occStruct, leg) {
  const os=occStruct.byDiagOcc.get(leg.diag)||[];
  return os.find(o=>o.legs.includes(leg))||null;
}

function findDetailIndexForOp(rows, op, which) {
  const code=which==="start"?op.from:op.to;
  const raw=which==="start"?op.depMin:op.arrMin;
  const field=which==="start"?"dep":"arr";
  const candidates=[];
  for(let i=0;i<rows.length;i++){
    if(rows[i].code!==code || rows[i][field]==null)continue;
    if(rows[i][field]%1440===raw) candidates.push(i);
  }
  if(!candidates.length) return which==="start"?0:rows.length-1;
  if(which==="start") return candidates[0];
  return candidates[candidates.length-1];
}
function opRowCovers(r,t) {
  const a=r.depMin,b=r.arrExt;
  return (t>=a&&t<=b) || (t>=a+1440&&t<=b+1440);
}
function activeOpRow(diag,t,byOp) {
  const rs=(byOp.get(diag)||[]).filter(r=>opRowCovers(r,t));
  if(!rs.length)return null;
  const allocated=rs.filter(r=>r.resource);
  if(allocated.length) return allocated.sort((a,b)=>a.depMin-b.depMin).at(-1);
  return rs[0];
}

function formationForLeg(leg, legsAll, byOp, reportTime) {
  const participants=unique(legsAll.filter(x=>x.key===leg.key).map(x=>x.diag));
  let expected=0,actual=0;
  for(const d of participants){
    const rs=byOp.get(d)||[];
    const sample=rs[0];
    expected+=plannedLength(d,sample?.planned);
    const active=activeOpRow(d,leg.dep,byOp);
    if(active?.resource){actual+=resourceInfo(active.resource)?.length||plannedLength(d,active.planned);continue;}
    if(active && /Not allocated/i.test(active.discrepancy||"") && rowQualifiesUnallocated(active,reportTime)){
      actual+=0; continue;
    }
    // Outside the report-time alert window, a Not Allocated line is deliberately ignored.
    actual+=plannedLength(d,active?.planned||sample?.planned);
  }
  return {expected,actual,participants};
}

function serviceText(hcFull, dep, from, to, reviews, noteStart=null, noteEnd=null) {
  const plus=isClass5(hcFull);
  let s=`${coreHC(hcFull)} ${hhmm(dep,plus)} ${abbr(from,reviews)} - ${abbr(to,reviews)}`;
  if(noteStart && noteEnd) s+=` (FROM ${abbr(noteStart,reviews)} AS FAR AS ${abbr(noteEnd,reviews)})`;
  else if(noteStart) s+=` (FROM ${abbr(noteStart,reviews)})`;
  else if(noteEnd) s+=` (AS FAR AS ${abbr(noteEnd,reviews)})`;
  return s;
}

function segmentDescriptor(seg, occStruct, reviews) {
  const first=seg.legs[0], last=seg.legs[seg.legs.length-1];
  const occ=occurrenceForLeg(occStruct,first);
  const comp=occ?occStruct.compInfo.get(occ.root):null;
  const origin=comp?.origin||first.from, dest=comp?.dest||last.to, dep=comp?.dep??first.dep;
  const noteStart=first.from!==origin?first.from:null;
  const noteEnd=last.to!==dest?last.to:null;
  return { text:serviceText(first.hcFull,dep,origin,dest,reviews,noteStart,noteEnd), dep:first.dep, hc:first.hcFull, origin,dest };
}

function formationDetails(diag, startIndex, endIndex, detail, legsStruct, occStruct, byOp, reportTime, reviews) {
  const legs=(legsStruct.by.get(diag)||[]).filter(l=>l.rowIndex>=startIndex && l.nextIndex<=endIndex);
  const raw=[];
  for(const leg of legs){
    const f=formationForLeg(leg,legsStruct.all,byOp,reportTime);
    const status=f.actual===0?"CANCELLED":`${f.actual} V ${f.expected}`;
    if(f.actual===f.expected) continue;
    // Always ignore the local depot shunts the rules say are not useful on the sheet.
    if(isIgnoredShuntCodes(leg.from,leg.to)) continue;
    const prev=raw[raw.length-1];
    if(prev && prev.status===status && prev.hcFull===leg.hcFull && prev.legs.at(-1).to===leg.from){
      prev.legs.push(leg);
    } else raw.push({status,hcFull:leg.hcFull,legs:[leg]});
  }
  // Convert to service descriptors, then de-dupe exact repeats.
  const groups=new Map();
  for(const seg of raw){
    const d=segmentDescriptor(seg,occStruct,reviews);
    // ignore an entire Ashford / Grove Park depot shunt even if the component grew oddly
    if(isIgnoredShuntCodes(d.origin,d.dest)) continue;
    if(!groups.has(seg.status))groups.set(seg.status,[]);
    if(!groups.get(seg.status).some(x=>x.text===d.text)) groups.get(seg.status).push(d);
  }
  const statuses=[...groups.keys()].sort((a,b)=>{
    if(a==="CANCELLED")return -1;if(b==="CANCELLED")return 1;
    const aa=parseInt(a,10)||999, bb=parseInt(b,10)||999; return aa-bb;
  });
  return statuses.map(status=>({status, services:groups.get(status).sort((a,b)=>a.dep-b.dep)}));
}

function endingDescriptor(diag, op, detail, legsStruct, occStruct, reviews) {
  const rows=detail.get(diag)||[];
  if(!rows.length)return null;
  const endIndex=findDetailIndexForOp(rows,op,"end");
  const relevantRows=rows.slice(0,endIndex+1);
  // Ramsgate priority: if the last visit to RAMSGTE is followed only by Ramsgate-area locations,
  // use the service arriving at RAMSGTE rather than its depot movement.
  let ramIdx=-1;
  for(let i=0;i<relevantRows.length;i++)if(relevantRows[i].code==="RAMSGTE")ramIdx=i;
  if(ramIdx>=0 && relevantRows.slice(ramIdx+1).every(r=>isRamsgateArea(r.code))){
    const legs=(legsStruct.by.get(diag)||[]).filter(l=>l.nextIndex<=ramIdx && l.to==="RAMSGTE");
    const leg=legs.at(-1);
    if(leg){
      const occ=occurrenceForLeg(occStruct,leg), comp=occ?occStruct.compInfo.get(occ.root):null;
      const origin=comp?.origin||leg.from, dep=comp?.dep??leg.dep;
      return {hcFull:leg.hcFull,dep,from:origin,to:"RAMSGTE",arr:leg.arr,endAbbr:"RAM",
              text:serviceText(leg.hcFull,dep,origin,"RAMSGTE",reviews)};
    }
  }
  const legs=(legsStruct.by.get(diag)||[]).filter(l=>l.nextIndex<=endIndex);
  for(let i=legs.length-1;i>=0;i--){
    const leg=legs[i];
    const occ=occurrenceForLeg(occStruct,leg), comp=occ?occStruct.compInfo.get(occ.root):null;
    const origin=comp?.origin||leg.from, dest=comp?.dest||leg.to, dep=comp?.dep??leg.dep, arr=comp?.arr??leg.arr;
    if(isIgnoredShuntCodes(origin,dest)) continue;
    return {hcFull:leg.hcFull,dep,from:origin,to:dest,arr,endAbbr:abbr(dest,reviews),
            text:serviceText(leg.hcFull,dep,origin,dest,reviews)};
  }
  return null;
}
function headingWithEnd(label, diagText, end) {
  if(!end)return `${label} (${diagText})`;
  return `${label} (${diagText}) ENDS ${end.text} (ARR ${hhmm(end.arr,isClass5(end.hcFull))})`;
}

/* ---------- the lettered layout ----------
   How the depot writes the list out by hand, and what it refers to on the
   telephone: every shortage, swap or length variation takes a letter of
   its own, in the order they happen, and the whole run of fleet variations
   shares the last letter - so "B" names one train and "D" names the fleet
   list. A case's own follow-on notes sit under its letter, a blank line
   apart, aligned with the heading rather than stepped in again.

   Past Z it carries into AA, AB - no day has ever needed it, but a list
   that silently started again at A would be worse than a long letter. */
function letterFor(n) {
  let s="";
  do { s=String.fromCharCode(65+(n%26))+s; n=Math.floor(n/26)-1; } while (n>=0);
  return s;
}
function letterList(blocks) {
  return blocks.map((lines,i)=>{
    const out=[];
    lines.forEach((ln,j)=>{
      const body=String(ln).replace(/^\s+/,"");
      if(j===0){ out.push(letterFor(i)+")\t"+body); return; }
      // a case's notes are set off by a blank line; a run of list lines is not
      const note=/^(FOLLOWING|THEN|ON ARR|\d+ CAR T\/F)/.test(body);
      if(note && out[out.length-1]!=="") out.push("");
      out.push(body?"\t"+body:"");
    });
    return out.join("\n");
  }).join("\n\n");
}

function formatFollowing(groups) {
  const lines=[];
  for(const g of groups){
    const prefix=g.status==="CANCELLED"?"FOLLOWING CANCELLED":`FOLLOWING ${g.status}`;
    lines.push(`    ${prefix}: ${g.services.map(s=>s.text).join(", ")}`);
  }
  return lines;
}

function buildDiscrepancies(op, detail, posAt) {
  const reviews=[];
  const byOp=rowsByDiag(op.rows);
  const selected=selectedAllocatedRows(op.rows);
  const legsStruct=buildLegs(detail);
  const occStruct=buildOccurrences(detail,legsStruct.by);
  const topCases=[];
  const excluded=new Set();

  /* An empty list means one of two quite different things, and the depot
     should not have to guess which: nothing was wrong that day, or nothing
     was READ. Said first, because it explains everything under it. */
  if(!op.rows.length)reviews.push("No rows could be read from the Operating Report — " +
    "the list below is empty because of that, not because the day was clean. " +
    "Check the right report was dropped, and that it is the .pdf print or the .csv export.");
  if(op.reportTime==null)reviews.push("Could not read the Operating Report print time; Not Allocated rules were not applied.");
  else if(op.reportTime>=18*60 || op.reportTime<1)reviews.push("No Not Allocated selection rule has yet been supplied for reports produced at/after 18:00 (or exactly 00:00).");

  const isFinished=d=>omitFinishedBy1600(d,op.reportTime,detail);

  // 1) qualifying Not Allocated rows -> shortage cases, one case per operating row/diagram.
  for(const r of op.rows){
    if(isFinished(r.diag) || !rowQualifiesUnallocated(r,op.reportTime))continue;
    excluded.add(r.diag);
    const rows=detail.get(r.diag)||[];
    if(!rows.length){reviews.push(`${r.diag}: no Diagram Detail itinerary found for shortage.`);continue;}
    const startIndex=findDetailIndexForOp(rows,r,"start"), endIndex=findDetailIndexForOp(rows,r,"end");
    const end=endingDescriptor(r.diag,r,detail,legsStruct,occStruct,reviews);
    const cls=plannedClass(r.diag,r.planned);
    const label=`${r.expectedLength}.${cls} SHORTAGE`;
    const groups=formationDetails(r.diag,startIndex,endIndex,detail,legsStruct,occStruct,byOp,op.reportTime,reviews);
    topCases.push({sort:r.depMin, lines:[headingWithEnd(label,r.diag,end),...formatFollowing(groups)]});
  }

  // Work out each diagram's effective ending working and the allocation that actually covers that working.
  // This is important at Ramsgate, where the display ending can be the passenger arrival before a depot move.
  const effective=new Map();
  for(const [diag,r] of selected){
    if(isFinished(diag)) continue;
    const end=endingDescriptor(diag,r,detail,legsStruct,occStruct,reviews);
    let er=r;
    if(end){
      const active=activeOpRow(diag,end.dep,byOp);
      if(active?.resource) er=active;
    }
    effective.set(diag,{selected:r,row:er,end});
  }

  /* 2) A 3-car that is IN the formation but not on the diagram that planned
     it. The cars are all there and the train is the right length - they are
     in the wrong order - so this is not a length variation and must not read
     as one. It is the swap the depot calls 3 CAR WRONG END.

     Read off the WORKING, not off the diagram's last allocation. RM901 is
     why: it carries the 3-car 375303 on the 05 22 to Dover and a 4-car from
     15:49, and the effective row is the later one, so the pair with RM301 -
     planned 3-car, carrying a 4-car, on that same 2R02 - was invisible and
     both came out as 4.375 V 3.375 / 3.375 V 4.375 against the depot. */
  const everyAlloc=[];
  for(const r of op.rows){
    if(isFinished(r.diag) || excluded.has(r.diag) || !r.actual)continue;
    if(r.actual.cls!=="375" || plannedClass(r.diag,r.planned)!=="375")continue;
    if(r.actual.length!==r.expectedLength) everyAlloc.push(r);
  }
  /* Everything coupled to this working: the diagrams whose own itinerary has
     a leg leaving at that minute under that headcode. */
  const formationOn=row=>{
    const out=new Set();
    for(const l of legsStruct.all)
      if(l.hcFull===row.trainid && (((l.dep%1440)+1440)%1440)===row.depMin) out.add(l.diag);
    return out;
  };
  const usedLen=new Set();
  const familyOverride=new Map();
  for(const a of everyAlloc){
    if(a.expectedLength!==3 || a.actual.length!==4 || usedLen.has(a.diag))continue;
    const b=everyAlloc.find(x=>x.diag!==a.diag && !usedLen.has(x.diag) &&
      x.trainid===a.trainid && x.depMin===a.depMin &&
      x.expectedLength===4 && x.actual?.length===3);
    if(!b)continue;
    /* Which of the two labels it takes turns on where the 3-CAR landed - it
       is on b, the diagram that planned a 4-car. On an end it is 3 CAR WRONG
       END; in the middle of the formation it is 3 CAR INTER VICE END.

       Two units and both are ends, so the answer is forced and no Summary is
       needed. Three or more and it is the POS column that settles it; with no
       Summary dropped in, that is named for review rather than guessed. */
    const formation=formationOn(a);
    const size=formation.size;
    let label="3 CAR WRONG END";
    if(size>2){
      const at=[...formation].map(d=>({diag:d,pos:posAt?posAt(d,a.depMin):null}));
      const known=at.filter(x=>x.pos!==null);
      const mine=at.find(x=>x.diag===b.diag);
      if(known.length!==at.length || !mine || mine.pos===null){
        reviews.push(`${a.diag}/${b.diag}: a 3-car is in the ${a.trainid} but ` +
          `not on the diagram that planned it, in a formation of ${size}. ` +
          `Whether it is on an end or intermediate is the Diagram Summary's ` +
          `POS column - drop that report in as well and this reads as one of ` +
          `the two; without it the pair is left below as a length difference.`);
        continue;
      }
      const lo=Math.min(...known.map(x=>x.pos)), hi=Math.max(...known.map(x=>x.pos));
      if(mine.pos!==lo && mine.pos!==hi) label="3 CAR INTER VICE END";
    }
    usedLen.add(a.diag);usedLen.add(b.diag);excluded.add(a.diag);
    familyOverride.set(b.diag,a.actual.family);
    /* Where the swap ends is the last working that unit is on, not the first
       one it was found on - a pair picked up on the empty move out of the
       sidings would otherwise read as ending in the platform five minutes
       later, which tells a controller nothing. */
    const sameUnit=(byOp.get(a.diag)||[]).filter(r=>r.resource===a.resource);
    const last=sameUnit.length
      ? sameUnit.slice().sort((x,y)=>x.arrExt-y.arrExt).at(-1) : a;
    const end=endingDescriptor(a.diag,last,detail,legsStruct,occStruct,reviews);
    topCases.push({sort:a.depMin,lines:[headingWithEnd(label,`${a.diag}/${b.diag}`,end)]});
  }
  /* What is left is a real length difference: the formation is short or long,
     not merely out of order. Judged on the diagram's effective allocation, as
     the rest of the list is. */
  const lengthCandidates=[];
  for(const [diag,e] of effective){
    const r=e.row;
    if(excluded.has(diag) || usedLen.has(diag) || !r.actual ||
       r.actual.cls!=="375" || plannedClass(diag,r.planned)!=="375")continue;
    if(r.actual.length!==r.expectedLength) lengthCandidates.push({diag,row:r,end:e.end});
  }
  for(const c of lengthCandidates){
    if(usedLen.has(c.diag)||excluded.has(c.diag))continue;
    excluded.add(c.diag);
    const rows=detail.get(c.diag)||[];
    const startIndex=findDetailIndexForOp(rows,c.row,"start"),endIndex=findDetailIndexForOp(rows,c.row,"end");
    const end=c.end||endingDescriptor(c.diag,c.row,detail,legsStruct,occStruct,reviews);
    const label=`${c.row.actual.length}.375 V ${c.row.expectedLength}.375`;
    const groups=formationDetails(c.diag,startIndex,endIndex,detail,legsStruct,occStruct,byOp,op.reportTime,reviews);
    topCases.push({sort:c.row.depMin,lines:[headingWithEnd(label,c.diag,end),...formatFollowing(groups)]});
  }

  // 3) Cross-fleet substitutions: 377 on RM diagrams or 375 on GT diagrams.
  // Group diagrams that START the same operating-report working together.
  const cross=[];
  for(const [diag,e] of effective){
    if(excluded.has(diag)) continue;
    const r=e.row, info=r.actual;
    if(!info) continue;
    const expectedCls=plannedClass(diag,r.planned);
    if(info.cls===expectedCls) continue;
    if(!((info.cls==="375"&&expectedCls==="377")||(info.cls==="377"&&expectedCls==="375"))) continue;
    cross.push({diag,row:r,end:e.end,actualCls:info.cls,expectedCls,actualLen:info.length,expectedLen:r.expectedLength});
  }
  const crossGroups=new Map();
  for(const c of cross){
    const k=[c.row.trainid,c.row.from,c.row.dep,c.actualCls,c.expectedCls].join("|");
    if(!crossGroups.has(k)) crossGroups.set(k,[]);
    crossGroups.get(k).push(c);
  }
  for(const cs of crossGroups.values()){
    cs.sort((a,b)=>a.diag.localeCompare(b.diag));
    for(const c of cs) excluded.add(c.diag);
    const actualLen=cs.reduce((n,c)=>n+c.actualLen,0);
    const expectedLen=cs.reduce((n,c)=>n+c.expectedLen,0);
    const actualCls=cs[0].actualCls, expectedCls=cs[0].expectedCls;
    const label=`${actualLen}.${actualCls} V ${expectedLen}.${expectedCls}`;
    const diagText=cs.map(c=>c.diag).join("/");
    const end=cs.map(c=>c.end).filter(Boolean).sort((a,b)=>b.arr-a.arr)[0]||null;
    topCases.push({sort:Math.min(...cs.map(c=>c.row.depMin)),lines:[headingWithEnd(label,diagText,end)]});
  }

  // 4) ordinary 375 / 375-9 fleet-family mismatches on the effective ending working.
  let fleet=[];
  for(const [diag,e] of effective){
    if(excluded.has(diag))continue;
    const r=e.row;
    if(!r.actual || r.actual.cls!=="375" || plannedClass(diag,r.planned)!=="375")continue;
    let actualFamily=familyOverride.get(diag)||r.actual.family;
    if(r.expectedLength!==r.actual.length && !familyOverride.has(diag))continue;
    if(r.expectedFamily===actualFamily)continue;
    if(r.expectedFamily==="3"||actualFamily==="3")continue;
    fleet.push({diag,row:r,expected:r.expectedFamily,actual:actualFamily,end:e.end});
  }

  // Reciprocal normal-375 / 375/9 swaps on the same displayed ending working cancel out.
  const cancelled=new Set();
  for(let i=0;i<fleet.length;i++){
    if(cancelled.has(i))continue;
    for(let j=i+1;j<fleet.length;j++){
      if(cancelled.has(j))continue;
      const a=fleet[i],b=fleet[j];
      const sig=x=>x.end ? [coreHC(x.end.hcFull),x.end.dep,x.end.from,x.end.to,x.end.arr].join("|") : [coreHC(x.row.trainid),x.row.depMin,x.row.from,x.row.to,x.row.arrExt].join("|");
      if(sig(a)!==sig(b))continue;
      if(a.expected===b.actual && b.expected===a.actual){cancelled.add(i);cancelled.add(j);break;}
    }
  }
  fleet=fleet.filter((_,i)=>!cancelled.has(i));

  const normal=[];
  for(const f of fleet){
    const end=f.end||endingDescriptor(f.diag,f.row,detail,legsStruct,occStruct,reviews);
    if(!end){reviews.push(`${f.diag}: could not determine ending working.`);continue;}
    let label;
    if(f.actual==="9"&&f.expected==="N")label="375/9 V 375";
    else if(f.actual==="N"&&f.expected==="9")label="375 V 375/9";
    else {reviews.push(`${f.diag}: unhandled fleet family ${f.actual} V ${f.expected}.`);continue;}
    normal.push({diag:f.diag,end,label,line:headingWithEnd(label,f.diag,end)});
  }

  // Group master locations together, but print no headings; just a blank line between groups.
  const groups=new Map();
  for(const n of normal){const k=masterKey(n.end.endAbbr);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(n);}
  const normalBlocks=[];
  for(const k of [...groups.keys()].sort((a,b)=>a.localeCompare(b))){
    const xs=groups.get(k).sort((a,b)=>a.end.arr-b.end.arr || a.diag.localeCompare(b.diag));
    normalBlocks.push(xs.map(x=>x.line).join("\n"));
  }

  topCases.sort((a,b)=>a.sort-b.sort);
  const topText=topCases.map(c=>c.lines.join("\n")).join("\n\n");
  const normalText=normalBlocks.join("\n\n");
  const text=[topText,normalText].filter(Boolean).join("\n\n");
  /* The same list in the depot's own hand: a letter per case, and the whole
     run of fleet variations under the last one. Built from the same blocks,
     so there is one list in two layouts and not two lists. */
  const blocks=topCases.map(c=>c.lines);
  if(normalBlocks.length)blocks.push(normalBlocks.join("\n\n").split("\n"));
  return {text,lettered:letterList(blocks),
          reviews:unique(reviews),counts:{top:topCases.length,fleet:normal.length,total:topCases.length+normal.length}};
}

/* ---------- the Diagram Detail as the CSV export ----------
   Same rows as parseDetail above builds out of the PDF: one per CALL, with
   the headcode of the leg that LEAVES it, and the clock rolled forward past
   midnight the same way. The export repeats the whole report header on
   every line and puts the data at the end, so the columns are found by
   their labels rather than counted from the left. */
function parseDetailCsv(text) {
  const legs = new Map();
  for (const f of csvParse(text)) {
    const di = f.lastIndexOf("Diagram"), mi = f.lastIndexOf("Fuel Miles");
    if (di < 0 || mi < 0) continue;
    const diag = String(f[di + 1] || "").trim();
    if (!/^[A-Z]{2}\d{3}$/.test(diag)) continue;
    const d = f.slice(mi + 1).map(x => String(x || "").trim());
    if (!legs.has(diag)) legs.set(diag, []);
    legs.get(diag).push({ code: d[0], name: d[1], arr: d[2], dep: d[3],
                          act: d[4], hc: d[5], endCode: d[8], endName: d[9],
                          endTime: d[10] });
  }
  const byDiag = new Map();
  for (const [diag, rows] of legs) {
    const out = [];
    let prev = -1;
    const roll = v => {
      if (v === null) return null;
      while (v < prev - 60) v += 1440;
      prev = Math.max(prev, v);
      return v;
    };
    for (const r of rows) {
      const arr = roll(clockMins(r.arr)), dep = roll(clockMins(r.dep));
      const hcFull = HC_FULL.test(r.hc) ? r.hc : null;
      out.push({ diag, code: r.code, name: r.name, arr, dep, hcFull,
                 hc: hcFull ? hcFull.slice(0, 4) : null,
                 act: /^(ATTTT|ATTACH|DETACH|DETTT|#)$/i.test(r.act) ? r.act : null });
    }
    // the last call is the end of the last leg, and nothing departs from it
    const last = rows[rows.length - 1];
    if (last) out.push({ diag, code: last.endCode, name: last.endName,
                         arr: roll(clockMins(last.endTime)), dep: null,
                         hcFull: null, hc: null, act: null });
    byDiag.set(diag, out);
  }
  return byDiag;
}
/* Either shape of the same report. The CSV carries its column labels on
   every line; the PDF text does not. */
function looksLikeCsv(text) {
  return /"?Fuel Miles"?/.test(text) && text.indexOf(",") >= 0 &&
         /Diagram Detail/i.test(text);
}
function detailFrom(text) {
  return looksLikeCsv(text) ? parseDetailCsv(text) : parseDetail(text);
}

/* ---------- where a diagram stands in its formation ----------
   The POSITION is the one thing neither the Operating Report nor the Diagram
   Detail carries, and it is the difference between a 3-car on the wrong END
   and one standing INTERMEDIATE. It is not on the Allocation Summary either -
   that is a row per unit: which diagram it starts on, which it finishes on,
   where, when and how far. It is on the DIAGRAM SUMMARY, in the POS column,
   which is the report the weekday books are already built from. So this road
   takes it as an optional third report and reads it with the weekday
   pipeline's own parser rather than a second one that would drift.

   Returns a lookup diagram -> position at a given minute, or null when no
   Summary was given. */
function positionsFrom(text) {
  if (!text) return null;
  const isCsv = text.indexOf(",") >= 0 && /"?NOTES"?/.test(text);
  let rows;
  try {
    rows = isCsv ? GENIUS.parseSummaryCsvG(text) : GENIUS.parseSummary(text, []);
  } catch (e) { return null; }
  if (!rows || !rows.length) return null;
  const byDiag = new Map();
  for (const r of rows) {
    if (!byDiag.has(r.diag)) byDiag.set(r.diag, []);
    byDiag.get(r.diag).push(r);
  }
  for (const list of byDiag.values()) list.sort((a, b) => a.start - b.start);
  /* The Summary gives one row per STINT, so a diagram's position is the one
     in force at that moment: the stint covering the time, or failing that
     the last one to have started by then. */
  return function posAt(diag, t) {
    const list = byDiag.get(diag);
    if (!list || !list.length) return null;
    for (const r of list) {
      const end = r.end !== null && r.end < r.start ? r.end + 1440 : r.end;
      if (r.start <= t && (end === null || t <= end)) return r.pos;
    }
    let best = null;
    for (const r of list) if (r.start <= t) best = r;
    return (best || list[0]).pos;
  };
}
/* The date a report is FOR, off the line that says so - the same line in
   the print and in the export, so one reading serves both. The Operating
   Report names a span ("19/09/26 to 20/09/26"); the first date is its day.
   The Diagram Detail also stamps every diagram with the day it is "On",
   which is there whether or not the header line survived the export. */
const DATE_RE = "(\\d\\d/\\d\\d/\\d\\d)";
function afterLabel(text, label) {
  const m = new RegExp(label + "[^\\n]*?" + DATE_RE).exec(String(text||""));
  return m ? m[1] : null;
}
function opDateOf(text){ return afterLabel(text, "Operating Report for:"); }
function detDateOf(text){
  const m = afterLabel(text, "Diagram Details? for:");
  if (m) return m;
  const on = new RegExp("\\bOn\\b\\W{0,3}" + DATE_RE).exec(String(text||""));
  return on ? on[1] : null;
}
/* One build: the Operating Report's text and the Diagram Detail's, however
   each arrived. Returns the list, the review lines and the counts. */
function run(opText, detailText, summaryText) {
  const op = operatingFrom(opText);
  const detail = detailFrom(detailText);
  const posAt = positionsFrom(summaryText);
  const out = buildDiscrepancies(op, detail, posAt);
  /* Two reports from different days read perfectly well and answer nothing:
     every working is matched against a plan that was not in force. Said, not
     refused - the depot knows what it dropped. */
  const opDate = opDateOf(opText), detDate = detDateOf(detailText);
  const reviews = (opDate && detDate && opDate !== detDate)
    ? [`The Operating Report is for ${opDate} and the Diagram Detail for ` +
       `${detDate}. The list below matches each working against the other ` +
       `day's plan, so it cannot be trusted — drop the pair for one date.`]
      .concat(out.reviews)
    : out.reviews;
  return { ...out, reviews, positions: !!posAt,
           reportTime: op.reportTime, rows: op.rows.length,
           diagrams: new Set(op.rows.map(r => r.diag)).size,
           detailDiagrams: detail.size };
}
/* What the report is, so a file dropped on the wrong road says so rather
   than building an empty list. */
function sniff(text) {
  if (/OPERATING REPORT/i.test(text)) return "op";
  if (/Diagram Detail/i.test(text)) return "det";
  if (/DIAGRAM SUMMARY REPORT|Diagram Summary for:/i.test(text)) return "sum";
  return null;
}

return { run, sniff, letterList, parseOperating, parseOperatingCsv, operatingFrom,
         parseDetail, parseDetailCsv, detailFrom, buildDiscrepancies,
         pdfText, ABBR, MASTER_GROUPS };
})();
if (typeof module !== "undefined" && module.exports) module.exports = SHEETS_SHORTAGE;
if (typeof globalThis !== "undefined") globalThis.SHEETS_SHORTAGE = SHEETS_SHORTAGE;
