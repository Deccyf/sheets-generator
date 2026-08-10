/* Synthetic inputs for the golden tests.

   The PDF builder fabricates just enough of a PDF for GENIUS.pdfText: a
   Flate "stream…endstream" section whose content places each report line
   with a Tm + Tj pair. Column gaps are literal double spaces inside the
   string, which is what the report parsers split on.

   The docx builder zips a minimal word/document.xml whose paragraphs carry
   the prints' tab-separated rows. */

function escPdf(s) {
  return s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

export function makePdf(lines, fflate) {
  let content = "BT /F1 10 Tf\n";
  lines.forEach((line, i) => {
    const y = 800 - i * 12;
    content += `1 0 0 1 20 ${y} Tm (${escPdf(line)}) Tj\n`;
  });
  content += "ET\n";
  const deflated = fflate.zlibSync(new TextEncoder().encode(content));
  const head = new TextEncoder().encode(
    "%PDF-1.4\n1 0 obj\n<< /Filter /FlateDecode >>\nstream\n");
  const tail = new TextEncoder().encode("\nendstream\nendobj\n%%EOF\n");
  const out = new Uint8Array(head.length + deflated.length + tail.length);
  out.set(head, 0);
  out.set(deflated, head.length);
  out.set(tail, head.length + deflated.length);
  return out;
}

/* ---- Genius weekday reports (Monday 03/08/26) ---- */

export const SUMMARY_LINES = [
  "GENIUS  DIAGRAM SUMMARY REPORT",
  "Diagram Summary for: 03/08/26",
  // diag  fleet  days  pos  start  from  to  end
  "GT101  375/6  MF  1  05:30  ASHFDNS  DOVERPS  23:50",
  "GT102  375/6  MF  2  05:30  ASHFDNS  ASHFEBS  22:40",
  "GT103  375/9  MF  1  06:10  DOVERPS  DOVERPS  23:10",
  "GT104  377/5  MF  2  06:10  DOVERPS  FAVRUPS  21:10",
  "GT105  375/6  MF  1  20:00  FAVRUPS  FAVRBRD  20:20",
  "GT106  375/6  MF  1  21:00  RAMSGTE  RAMSNEW  21:10",
  "GN201  465/9  MF  1  05:50  SLADEGD  SLADEGD  23:20",
  "GN202  465/0  MF  1  06:20  BELVDRS  BELVDRS  17:00",
  "GH301  395/0  MF  1  06:40  RAMSGTD  RAMSGTD  22:30",
];

export const DETAIL_LINES = [
  "GENIUS  Diagram Detail Report",
  "Diagram GT 1 0 1 On 03/08/26",
  "ASHFDNS  Ashford Down Sidings  05:30  5A01",
  "ASHFKY  Ashford  05:35  05:45  2A01",
  "CHARX  Charing Cross  07:00  09:00  2A02",
  "ASHFKY  Ashford  10:30  10:35  5A03",
  "ASHFEBS  Ashford East Bth Sdgs  10:40  14:00  5A05",
  "ASHFKY  Ashford  14:05  14:07  2A06",
  "DOVERP  Dover Priory  15:30  15:40  5A07",
  "DOVERPS  Dover Priory Sidings  23:50",
  "Diagram GT 1 0 2 On 03/08/26",
  "ASHFDNS  Ashford Down Sidings  05:30  5A01",
  "ASHFKY  Ashford  05:35  05:45  2A01",
  "CHARX  Charing Cross  07:00  09:30  2A04",
  "ASHFKY  Ashford  11:00  11:05  5A09",
  "ASHFEBS  Ashford East Bth Sdgs  22:40",
  "Diagram GT 1 0 3 On 03/08/26",
  "DOVERPS  Dover Priory Sidings  06:00  5B01",
  "DOVERP  Dover Priory  06:05  06:10  1B01",
  "CHARX  Charing Cross  08:20  17:00  1B02",
  "DOVERP  Dover Priory  19:10  19:20  5B03",
  "DOVERPS  Dover Priory Sidings  23:10",
  "Diagram GT 1 0 4 On 03/08/26",
  "DOVERPS  Dover Priory Sidings  06:00  5B01",
  "DOVERP  Dover Priory  06:05  06:10  1B01",
  "CHARX  Charing Cross  08:20  17:30  1B04",
  "FAVRSHM  Faversham  19:40  19:55  5B05",
  "FAVRUPS  Faversham Up Sidings  21:10",
  "Diagram GT 1 0 5 On 03/08/26",
  "FAVRUPS  Faversham Up Sidings  20:00  5A50",
  "FAVRSHM  Faversham  20:05  20:10  5A51",
  "FAVRBRD  Faversham BK Road  20:20",
  "Diagram GT 1 0 6 On 03/08/26",
  "RAMSGTE  Ramsgate  21:00  5F50",
  "RAMSNEW  Ramsgate New Sidings  21:10",
  "Diagram GN 2 0 1 On 03/08/26",
  "SLADEGD  Slade Green T&R.S.M.D  05:50  5C01",
  "SLADEGN  Slade Green  05:55  06:00  2C01",
  "CANONST  Cannon Street  06:40  06:50  2C02",
  "SLADEGN  Slade Green  07:30  07:35  5C03",
  "SLADEGD  Slade Green T&R.S.M.D  07:40  16:20  5C05",
  "SLADEGN  Slade Green  16:25  16:30  2C06",
  "CANONST  Cannon Street  17:10  17:20  2C07",
  "SLADEGN  Slade Green  18:00  18:05  5C08",
  "SLADEGD  Slade Green T&R.S.M.D  23:20",
  "Diagram GN 2 0 2 On 03/08/26",
  "BELVDRS  Belvedere Sidings  06:20  5E01",
  "SLADEGN  Slade Green  06:40  06:45  2E01",
  "CANONST  Cannon Street  07:20  07:30  2E02",
  "SLADEGN  Slade Green  08:00  08:05  5E03",
  "BELVDRS  Belvedere Sidings  08:15  16:00  5E05",
  "SLADEGN  Slade Green  16:10  16:15  2E06",
  "BELVDRS  Belvedere Sidings  17:00",
  "Diagram GH 3 0 1 On 03/08/26",
  "RAMSGTD  Ramsgate E.M.U.D  06:40  5D01",
  "RAMSGTE  Ramsgate  06:45  06:55  1D01",
  "STPANCI  St. Pancras Int  08:10  09:00  1D02",
  "RAMSGTE  Ramsgate  10:20  10:25  5D03",
  "RAMSGTD  Ramsgate E.M.U.D  22:30",
];

/* ---- Weekend diagram prints (Saturday 01/08/2026) ---- */

function printsLines(rows) {
  return rows;
}

export const PRINTS_LINES = printsLines([
  "Diagram:\tGT\t501\tSat",
  "Fleet:\t375/6",
  "From:\t01/08/2026",
  "\t\tAshfrd DS\t\t05:30\t5A01\t\t\t",
  "\t\tAshford I\t05:35\t05:45\t2A01\t\t\t",
  "\t\tCX\t07:00\t09:00\t2A02\t\t\t",
  "\t\tAshford I\t10:30\t10:35\t5A03\t\t\t",
  "\t\tAshfd EBS\t10:40\t\t\t#\t\t",
  "\t\tAshfd EBS\t\t14:00\t5A05\t\t\t",
  "\t\tAshford I\t14:05\t14:07\t2A06\t\t\t",
  "\t\tDover P\t15:30\t15:40\t5A07\t\t\t",
  "\t\tDover PSd\t23:50\t\t\t#\t\t",
  "Diagram:\tGT\t502\tSat",
  "Fleet:\t377/5",
  "From:\t01/08/2026",
  "\t\tDover PSd\t\t06:00\t5B01\t\t\t",
  "\t\tDover P\t06:05\t06:10\t1B01\t\t\t",
  "\t\tCX\t08:20\t17:00\t1B02\t\t\t",
  "\t\tDover P\t19:10\t19:20\t5B03\t\t\t",
  "\t\tDover PSd\t23:10\t\t\t#\t\t",
  "Diagram:\tGN\t601\tSat",
  "Fleet:\t465/9",
  "From:\t01/08/2026",
  "\t\tS Gn Dep\t\t05:50\t5C01\t\t\t",
  "\t\tS Gn\t05:55\t06:00\t2C01\t\t\t",
  "\t\tC St\t06:40\t06:50\t2C02\t\t\t",
  "\t\tS Gn\t07:30\t07:35\t5C03\t\t\t",
  "\t\tS Gn Dep\t07:40\t\t\t#\t\t",
  "\t\tS Gn Dep\t\t16:20\t5C05\t\t\t",
  "\t\tS Gn\t16:25\t16:30\t2C06\t\t\t",
  "\t\tC St\t17:10\t17:20\t2C07\t\t\t",
  "\t\tS Gn\t18:00\t18:05\t5C08\t\t\t",
  "\t\tS Gn Dep\t23:20\t\t\t#\t\t",
]);

/* The reissue replaces GT502 with a later evening return. */
export const REISSUE_LINES = printsLines([
  "Diagram:\tGT\t502\tSat",
  "Fleet:\t377/5",
  "From:\t01/08/2026",
  "\t\tDover PSd\t\t06:00\t5B01\t\t\t",
  "\t\tDover P\t06:05\t06:10\t1B01\t\t\t",
  "\t\tCX\t08:20\t18:00\t1B06\t\t\t",
  "\t\tDover P\t20:10\t20:20\t5B07\t\t\t",
  "\t\tDover PSd\t23:40\t\t\t#\t\t",
]);

/* The same first-move pair as a weekend print: GN611 runs empty out of the
   Dartford up sidings into the platform, GN612 starts in the platform. */
export const METRO_MOVE_PRINTS = printsLines([
  "Diagram:\tGN\t611\tSat",
  "Fleet:\t465/9",
  "From:\t01/08/2026",
  "\t\tDart USd\t\t05:52\t5B05\t\t\t",
  "\t\tDart\t05:55\t06:00\t2B05\t\t\t",
  "\t\tC St\t06:48\t\t\t#\t\t",
  "Diagram:\tGN\t612\tSat",
  "Fleet:\t465/9",
  "From:\t01/08/2026",
  "\t\tDart\t\t06:20\t2B07\t\t\t",
  "\t\tC St\t07:10\t\t\t#\t\t",
]);

function xmlEsc(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function makeDocx(lines, fflate) {
  const paras = lines.map(line => {
    const runs = line.split("\t").map((part, i) =>
      (i ? "<w:r><w:tab/></w:r>" : "") +
      (part ? `<w:r><w:t xml:space="preserve">${xmlEsc(part)}</w:t></w:r>` : ""));
    return `<w:p><w:pPr></w:pPr>${runs.join("")}</w:p>`;
  }).join("");
  const doc =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">` +
    `<w:body>${paras}</w:body></w:document>`;
  const files = {
    "[Content_Types].xml": new TextEncoder().encode(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
      `<Default Extension="xml" ContentType="application/xml"/>` +
      `<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>` +
      `</Types>`),
    "word/document.xml": new TextEncoder().encode(doc),
  };
  return fflate.zipSync(files, { level: 6 });
}

/* ---- Integrale CSV exports encoding the SAME schedule as the PDF
   fixtures, so either format must build identical books. ---- */

const LONG_DATE = d => d.slice(0, 6) + "20" + d.slice(6);

function fixtureDiagrams() {
  const diags = [];
  let cur = null;
  for (const l of DETAIL_LINES.slice(1)) {
    const dm = /^Diagram ([A-Z]{2}) ?(\d) ?(\d) ?(\d) On (\d\d\/\d\d\/\d\d)$/.exec(l);
    if (dm) {
      cur = { code: dm[1] + dm[2] + dm[3] + dm[4], date: dm[5], stops: [] };
      diags.push(cur);
      continue;
    }
    const t = l.split(/\s{2,}/);
    const times = t.filter(v => /^\d\d:\d\d$/.test(v));
    const hc = t.find(v => /^\d[A-Z]\d\d$/.test(v)) || null;
    const name = t.slice(1, t.indexOf(times[0])).join(" ");
    let arr = null, dep = null;
    if (times.length >= 2) { arr = times[0]; dep = times[1]; }
    else if (!cur.stops.length) dep = times[0];
    else arr = times[0];
    cur.stops.push({ code: t[0], name, arr, dep, hc });
  }
  return diags;
}

export function integraleSummaryCsv() {
  const rows = ["Code,Cov,Type,Allocate Resource,Stock,Start Time,Position," +
    "First Train,Start Location,End Time,End Location,Distance," +
    "First Train Note,Start Stock,Last Train,Last Train Note,End Stock," +
    "Pre-assignment,Diagram Comments,Coverage Notes"];
  for (const l of SUMMARY_LINES.slice(2)) {
    const t = l.split(/\s{2,}/);
    const [diag, fleet, , pos, start, from, to, end] = t;
    // one quoted, comma-carrying note to exercise the CSV parser
    const note = diag === "GT101" ? '"Via   ASHFKY , TONBDG"' : "";
    rows.push([diag, "Covered", fleet, "", "000000000000",
      LONG_DATE("03/08/26") + " " + start, pos, "0X00", from,
      LONG_DATE("03/08/26") + " " + end, to, "0", note, "", "0X99", "", "",
      diag, "", ""].join(","));
  }
  return "\uFEFF" + rows.join("\r\n");
}

export function integraleDetailCsv() {
  const rows = ["Diagram Code,Diagram Date,Notes,Total Miles,Start Tiploc," +
    "Start Location Name,Start Time,Activity,Headcode,Cumulative Miles," +
    "Cumulative Fuel Miles,End Tiploc,End Location Name,End Time," +
    "Off Diagram,Works"];
  for (const d of fixtureDiagrams()) {
    for (let i = 0; i + 1 < d.stops.length; i++) {
      const a = d.stops[i], b = d.stops[i + 1];
      rows.push([d.code, LONG_DATE(d.date), "", "0", a.code, a.name,
        a.dep + ":00", "", a.hc || "", "0", "", b.code, b.name,
        b.arr + ":00", "", ""].join(","));
    }
  }
  return rows.join("\r\n");
}

/* A mini pair for the metro first-move rule: MM801 runs empty out of the
   Dartford up sidings and forms a Cannon Street service off the platform
   alongside, MM802 is a platform starter with nothing before it. */
export const METRO_MOVE_SUMMARY =
  "Code,Cov,Type,Allocate Resource,Stock,Start Time,Position,First Train," +
  "Start Location,End Time,End Location,Distance,First Train Note," +
  "Start Stock,Last Train,Last Train Note,End Stock,Pre-assignment," +
  "Diagram Comments,Coverage Notes\r\n" +
  "MM801,Covered,465/9,,0,10/08/2026 05:52,1,5B05,DARTFUS,10/08/2026 06:48,CANONST,17,,,,,,MM801,,\r\n" +
  "MM802,Covered,465/9,,0,10/08/2026 06:20,1,2B07,DARTFD,10/08/2026 07:10,CANONST,17,,,,,,MM802,,";

export const METRO_MOVE_DETAIL =
  "Diagram Code,Diagram Date,Notes,Total Miles,Start Tiploc," +
  "Start Location Name,Start Time,Activity,Headcode,Cumulative Miles," +
  "Cumulative Fuel Miles,End Tiploc,End Location Name,End Time,Off Diagram,Works\r\n" +
  "MM801,10/08/2026,,17,DARTFUS,Dartford Up Sidings,05:52:00,,5B05,0,,DARTFD,Dartford,05:55:00,,\r\n" +
  "MM801,10/08/2026,,17,DARTFD,Dartford,06:00:00,,2B05,3,,CANONST,Cannon Street,06:48:00,,\r\n" +
  "MM802,10/08/2026,,17,DARTFD,Dartford,06:20:00,,2B07,0,,CANONST,Cannon Street,07:10:00,,";

/* A separate mini pair exercising the Integrale quirks: an Excel-mangled
   headcode, a stable-all-day placeholder diagram, and an Uncovered one. */
export const INTEGRALE_QUIRKS_SUMMARY =
  "Code,Cov,Type,Allocate Resource,Stock,Start Time,Position,First Train," +
  "Start Location,End Time,End Location,Distance,First Train Note," +
  "Start Stock,Last Train,Last Train Note,End Stock,Pre-assignment," +
  "Diagram Comments,Coverage Notes\r\n" +
  "QQ901,Covered,375/6,,0,10/08/2026 06:00,1,2E05,ASHFDNS,10/08/2026 06:05,ASHFKY,1,,,,,,QQ901,,\r\n" +
  "QQ902,Covered,465/9,,0,11/08/2026 00:01,,,GRVPKUS,11/08/2026 23:59,GRVPKUS,0,,,,,,QQ902,,\r\n" +
  "QQ903,Uncovered,395/0,,0,10/08/2026 07:00,1,5D01,RAMSGTD,10/08/2026 07:05,RAMSGTE,2,,,,,,QQ903,,\r\n" +
  "QQ904,Covered,465/9,,0,10/08/2026 06:30,1,5G01,BELNGMS,10/08/2026 17:00,BELNGMS,9,,,,,,QQ904,,";

export const INTEGRALE_QUIRKS_DETAIL =
  "Diagram Code,Diagram Date,Notes,Total Miles,Start Tiploc," +
  "Start Location Name,Start Time,Activity,Headcode,Cumulative Miles," +
  "Cumulative Fuel Miles,End Tiploc,End Location Name,End Time,Off Diagram,Works\r\n" +
  "QQ901,10/08/2026,,1,ASHFDNS,Ashford Down Sidings,06:00:00,,2.00E+05,0,,ASHFKY,Ashford International,06:05:00,,\r\n" +
  "QQ902,11/08/2026,,0,GRVPKUS,Grove Park Up C.H.S.,00:01:00,STABLD,,0,,GRVPKUS,Grove Park Up C.H.S.,00:01:00,,\r\n" +
  "QQ903,10/08/2026,,2,RAMSGTD,Ramsgate E.M.U.D.,07:00:00,,5D01,0,,RAMSGTE,Ramsgate,07:05:00,,\r\n" +
  "QQ904,10/08/2026,,9,BELNGMS,Bellingham Siding,06:30:00,,5G01,0,,SLADEGN,Slade Green,06:50:00,,\r\n" +
  "QQ904,10/08/2026,,9,SLADEGN,Slade Green,06:55:00,,2G01,0,,PLMSTCS,Plumstead C.H.S.,07:10:00,,\r\n" +
  "QQ904,10/08/2026,,9,PLMSTCS,Plumstead C.H.S.,16:00:00,,5G05,0,,SLADEGN,Slade Green,16:10:00,,\r\n" +
  "QQ904,10/08/2026,,9,SLADEGN,Slade Green,16:15:00,,2G06,0,,BELNGMS,Bellingham Siding,17:00:00,,";
