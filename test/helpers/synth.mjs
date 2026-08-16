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

/* ---- The same Genius reports, saved as CSV ----
   Every line repeats the report header and carries its data at the end; the
   summary is one line per working, the detail one line per leg with the
   arrival and departure at the leg's origin. Built from the PDF fixture so
   both readings of the same day must produce the same books. */

const GHEAD = '"GENIUS","DIAGRAM SUMMARY REPORT","Page:","Page -1 of 1",,' +
  '"Control:","SouthEastern Trains","Print Date:","August 2, 2026",' +
  '"Diagram Summary for:"," 03/08/26","DIAGRAM","UNITS","FLEET","OFF",' +
  '"START FUEL","POS","AT","FROM","TO","AT","WORKS","END FUEL","MILES",' +
  '"TOT. FUEL  MILES","NOTES","NOTES",';

export function geniusSummaryCsv() {
  return SUMMARY_LINES.slice(2).map(l => {
    const t = l.split(/\s{2,}/);
    const [diag, fleet, , pos, start, from, to, end] = t;
    return GHEAD + ['"' + diag + '"', "", '"' + fleet + '"', "0.00", pos,
      '"' + start + '"', '"' + from + '"', '"' + to + '"', '"' + end + '"',
      "-0.60", "100.00", "100.00", "", ""].join(",");
  }).join("\r\n");
}

const GDET = '"GENIUS","Diagram Detail Report","Page:","Page -1 of 1",,,,,' +
  '"Control:","SouthEastern Trains","Print Date:","August 2, 2026",' +
  '"Diagram Details for:"," 03/08/26",';

export function geniusDetailCsv() {
  const out = [];
  for (const d of fixtureDiagrams()) {
    const head = GDET + '"Diagram","' + d.code + '","On","' + d.date +
      '","Notes",,"Miles","Fuel Miles",';
    for (let i = 0; i + 1 < d.stops.length; i++) {
      const a = d.stops[i], b = d.stops[i + 1];
      out.push(head + ['"' + a.code + '"', '"' + a.name + '"',
        a.arr ? '"' + a.arr + '"' : "", a.dep ? '"' + a.dep + '"' : "", "",
        '"' + (a.hc || "") + '"', "1.00", "1.00",
        '"' + b.code + '"', '"' + b.name + '"',
        '"' + (b.arr || b.dep) + '"', '"Off Diagram"', '"  000"',
        '"Works"', '"  000"'].join(","));
    }
  }
  return out.join("\r\n");
}

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

/* Which unit leads. VC901/VC902 form one departure out of Victoria off the
   Grosvenor Shed, RG903/RG904 one out of Ramsgate off the depot, AF905/AF906
   one off the Ashford down sidings — and MT907/MT908 one metro departure off
   Slade Green depot. In the mainline book the lower Position leads; the
   metro book still puts the higher one first. */
export const REVERSED_ORDER_SUMMARY = [
  "Code,Cov,Type,Allocate Resource,Stock,Start Time,Position,First Train," +
  "Start Location,End Time,End Location,Distance,First Train Note," +
  "Start Stock,Last Train,Last Train Note,End Stock,Pre-assignment," +
  "Diagram Comments,Coverage Notes",
  "VC901,Covered,377/5,,0,10/08/2026 06:00,1,5N89,VICTGCS,10/08/2026 07:40,ASHFKY,56,,,,,,VC901,,",
  "VC902,Covered,377/5,,0,10/08/2026 06:00,2,5N89,VICTGCS,10/08/2026 07:40,ASHFKY,56,,,,,,VC902,,",
  "RG903,Covered,375/6,,0,10/08/2026 06:00,1,5A14,RAMSGTD,10/08/2026 07:30,ASHFKY,38,,,,,,RG903,,",
  "RG904,Covered,375/6,,0,10/08/2026 06:00,2,5A14,RAMSGTD,10/08/2026 07:30,ASHFKY,38,,,,,,RG904,,",
  "AF905,Covered,375/6,,0,10/08/2026 06:00,1,5A20,ASHFDNS,10/08/2026 07:20,DOVERP,30,,,,,,AF905,,",
  "AF906,Covered,375/6,,0,10/08/2026 06:00,2,5A20,ASHFDNS,10/08/2026 07:20,DOVERP,30,,,,,,AF906,,",
  "MT907,Covered,465/9,,0,10/08/2026 06:00,1,5C40,SLADEGD,10/08/2026 07:00,CANONST,18,,,,,,MT907,,",
  "MT908,Covered,465/9,,0,10/08/2026 06:00,2,5C40,SLADEGD,10/08/2026 07:00,CANONST,18,,,,,,MT908,,",
  // 013/014 off the Dover Priory sidings: the section rule says lowest
  // first, ORDER_FIX says the books have this formation the other way round
  "DP013,Covered,375/6,,0,10/08/2026 04:30,1,5W05,DOVERPS,10/08/2026 06:00,CANONST,30,,,,,,DP013,,",
  "DP014,Covered,375/6,,0,10/08/2026 04:30,2,5W05,DOVERPS,10/08/2026 06:00,CANONST,30,,,,,,DP014,,",
].join("\r\n");

const orderLeg = (d, miles, a, an, at, hc, b, bn, bt) =>
  d + ",10/08/2026,," + miles + "," + a + "," + an + "," + at + ",," + hc +
  ",0,," + b + "," + bn + "," + bt + ",,";

export const REVERSED_ORDER_DETAIL = [
  "Diagram Code,Diagram Date,Notes,Total Miles,Start Tiploc," +
  "Start Location Name,Start Time,Activity,Headcode,Cumulative Miles," +
  "Cumulative Fuel Miles,End Tiploc,End Location Name,End Time,Off Diagram,Works",
  ...["VC901", "VC902"].flatMap(d => [
    orderLeg(d, 56, "VICTGCS", "Victoria Grosvenor Shed", "06:00:00", "5N89", "VICTRIE", "Victoria", "06:10:00"),
    orderLeg(d, 56, "VICTRIE", "Victoria", "06:20:00", "2N89", "ASHFKY", "Ashford", "07:40:00"),
  ]),
  ...["RG903", "RG904"].flatMap(d => [
    orderLeg(d, 38, "RAMSGTD", "Ramsgate E.M.U.D", "06:00:00", "5A14", "RAMSGTE", "Ramsgate", "06:10:00"),
    orderLeg(d, 38, "RAMSGTE", "Ramsgate", "06:20:00", "2A14", "ASHFKY", "Ashford", "07:30:00"),
  ]),
  ...["AF905", "AF906"].flatMap(d => [
    orderLeg(d, 30, "ASHFDNS", "Ashford Down Sidings", "06:00:00", "5A20", "ASHFKY", "Ashford", "06:10:00"),
    orderLeg(d, 30, "ASHFKY", "Ashford", "06:20:00", "2A20", "DOVERP", "Dover Priory", "07:20:00"),
  ]),
  ...["MT907", "MT908"].flatMap(d => [
    orderLeg(d, 18, "SLADEGD", "Slade Green T&R.S.M.D", "06:00:00", "5C40", "SLADEGN", "Slade Green", "06:10:00"),
    orderLeg(d, 18, "SLADEGN", "Slade Green", "06:20:00", "2C40", "CANONST", "Cannon Street", "07:00:00"),
  ]),
  ...["DP013", "DP014"].flatMap(d => [
    orderLeg(d, 30, "DOVERPS", "Dover Priory Sidings", "04:30:00", "5W05", "DOVERP", "Dover Priory", "04:40:00"),
    orderLeg(d, 30, "DOVERP", "Dover Priory", "04:50:00", "2W05", "CANONST", "Cannon Street", "06:00:00"),
  ]),
].join("\r\n");

/* Two units that started the day in different formations and are both
   Position 2 when they couple: the reports cannot say which way round. */
export const TIED_POSITION_SUMMARY = [
  "Code,Cov,Type,Allocate Resource,Stock,Start Time,Position,First Train," +
  "Start Location,End Time,End Location,Distance,First Train Note," +
  "Start Stock,Last Train,Last Train Note,End Stock,Pre-assignment," +
  "Diagram Comments,Coverage Notes",
  "RM910,Covered,375/6,,0,10/08/2026 06:00,2,5A30,DOVERPS,10/08/2026 07:20,ASHFKY,30,,,,,,RM910,,",
  "RM911,Covered,375/6,,0,10/08/2026 06:00,2,5A30,DOVERPS,10/08/2026 07:20,ASHFKY,30,,,,,,RM911,,",
].join("\r\n");

export const TIED_POSITION_DETAIL = [
  "Diagram Code,Diagram Date,Notes,Total Miles,Start Tiploc," +
  "Start Location Name,Start Time,Activity,Headcode,Cumulative Miles," +
  "Cumulative Fuel Miles,End Tiploc,End Location Name,End Time,Off Diagram,Works",
  ...["RM910", "RM911"].flatMap(d => [
    orderLeg(d, 30, "DOVERPS", "Dover Priory Sidings", "06:00:00", "5A30", "DOVERP", "Dover Priory", "06:10:00"),
    orderLeg(d, 30, "DOVERP", "Dover Priory", "06:20:00", "2A30", "ASHFKY", "Ashford", "07:20:00"),
  ]),
].join("\r\n");

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

/* Where the PM berth lands when the unit is moved late in the evening.
   XS930 comes off the St Leonards shed at 22 40 and is shunted round to
   Hastings for the night: still a shed unit, PM XSE. AF931 does the same
   shape out of the Ashford east sidings but runs to the Folkestone Train
   Roads, another berthing area - it has gone home, PM FKE. SG932 finishes in
   the Grove Park depot, so the entry that takes it there is destined GPD;
   SG933 terminates at the station, destined GPK. */
export const LATE_MOVE_SUMMARY = [
  "Code,Cov,Type,Allocate Resource,Stock,Start Time,Position,First Train," +
  "Start Location,End Time,End Location,Distance,First Train Note," +
  "Start Stock,Last Train,Last Train Note,End Stock,Pre-assignment," +
  "Diagram Comments,Coverage Notes",
  "XS930,Covered,375/6,,0,10/08/2026 06:00,1,5X01,STLNWCS,10/08/2026 23:05,HASTING,60,,,,,,XS930,,",
  "AF931,Covered,375/6,,0,10/08/2026 06:00,1,5Y01,ASHFEBS,10/08/2026 23:10,FLKSETR,60,,,,,,AF931,,",
  "SG932,Covered,376/0,,0,10/08/2026 06:00,1,5S01,SLADEGD,10/08/2026 23:20,GRVPKDS,40,,,,,,SG932,,",
  "SG933,Covered,376/0,,0,10/08/2026 06:05,1,5S05,SLADEGD,10/08/2026 23:30,GRVPK,40,,,,,,SG933,,",
].join("\r\n");

export const LATE_MOVE_DETAIL = [
  "Diagram Code,Diagram Date,Notes,Total Miles,Start Tiploc," +
  "Start Location Name,Start Time,Activity,Headcode,Cumulative Miles," +
  "Cumulative Fuel Miles,End Tiploc,End Location Name,End Time,Off Diagram,Works",
  orderLeg("XS930", 60, "STLNWCS", "St. Leonards W.M. C.S.D", "06:00:00", "5X01", "HASTING", "Hastings", "06:20:00"),
  orderLeg("XS930", 60, "HASTING", "Hastings", "06:30:00", "2X01", "TONBDG", "Tonbridge", "07:30:00"),
  orderLeg("XS930", 60, "TONBDG", "Tonbridge", "17:00:00", "2X02", "HASTING", "Hastings", "18:00:00"),
  orderLeg("XS930", 60, "HASTING", "Hastings", "18:10:00", "5X03", "STLNWCS", "St. Leonards W.M. C.S.D", "18:30:00"),
  orderLeg("XS930", 60, "STLNWCS", "St. Leonards W.M. C.S.D", "22:40:00", "5X04", "HASTING", "Hastings", "23:05:00"),
  orderLeg("AF931", 60, "ASHFEBS", "Ashford East Bth Sdgs", "06:00:00", "5Y01", "ASHFKY", "Ashford", "06:10:00"),
  orderLeg("AF931", 60, "ASHFKY", "Ashford", "06:20:00", "2Y01", "DOVERP", "Dover Priory", "07:20:00"),
  orderLeg("AF931", 60, "DOVERP", "Dover Priory", "17:00:00", "2Y02", "ASHFKY", "Ashford", "18:00:00"),
  orderLeg("AF931", 60, "ASHFKY", "Ashford", "18:10:00", "5Y03", "ASHFEBS", "Ashford East Bth Sdgs", "18:20:00"),
  orderLeg("AF931", 60, "ASHFEBS", "Ashford East Bth Sdgs", "22:40:00", "5Y04", "FLKSETR", "Folkestone ETR", "23:10:00"),
  orderLeg("SG932", 40, "SLADEGD", "Slade Green T&R.S.M.D", "06:00:00", "5S01", "SLADEGN", "Slade Green", "06:05:00"),
  orderLeg("SG932", 40, "SLADEGN", "Slade Green", "06:10:00", "2S01", "CANONST", "Cannon Street", "07:00:00"),
  orderLeg("SG932", 40, "CANONST", "Cannon Street", "17:00:00", "2S02", "SLADEGN", "Slade Green", "17:50:00"),
  orderLeg("SG932", 40, "SLADEGN", "Slade Green", "18:00:00", "5S03", "SLADEGD", "Slade Green T&R.S.M.D", "18:10:00"),
  orderLeg("SG932", 40, "SLADEGD", "Slade Green T&R.S.M.D", "22:40:00", "5S04", "GRVPKDS", "Grove Park Down CHS", "23:20:00"),
  orderLeg("SG933", 40, "SLADEGD", "Slade Green T&R.S.M.D", "06:05:00", "5S05", "SLADEGN", "Slade Green", "06:10:00"),
  orderLeg("SG933", 40, "SLADEGN", "Slade Green", "06:15:00", "2S05", "CANONST", "Cannon Street", "07:05:00"),
  orderLeg("SG933", 40, "CANONST", "Cannon Street", "17:10:00", "2S06", "SLADEGN", "Slade Green", "18:05:00"),
  orderLeg("SG933", 40, "SLADEGN", "Slade Green", "18:15:00", "5S07", "SLADEGD", "Slade Green T&R.S.M.D", "18:25:00"),
  orderLeg("SG933", 40, "SLADEGD", "Slade Green T&R.S.M.D", "22:45:00", "5S08", "GRVPK", "Grove Park", "23:30:00"),
].join("\r\n");

/* Two Ashford departures, half an hour apart, differing only in the road they
   come off. The section lists highest Position first, but the Up Sidings face
   the other way and read the other way round - which is what the 12/08 book
   says for all three of its Up Sidings departures. */
export const ASHFORD_ROADS_SUMMARY = [
  "Code,Cov,Type,Allocate Resource,Stock,Start Time,Position,First Train," +
  "Start Location,End Time,End Location,Distance,First Train Note," +
  "Start Stock,Last Train,Last Train Note,End Stock,Pre-assignment," +
  "Diagram Comments,Coverage Notes",
  "AD951,Covered,375/6,,0,10/08/2026 06:00,1,5A60,ASHFDNS,10/08/2026 07:20,DOVERP,30,,,,,,AD951,,",
  "AD952,Covered,375/6,,0,10/08/2026 06:00,2,5A60,ASHFDNS,10/08/2026 07:20,DOVERP,30,,,,,,AD952,,",
  "AU953,Covered,375/6,,0,10/08/2026 06:30,1,5A62,ASHFUPS,10/08/2026 07:50,DOVERP,30,,,,,,AU953,,",
  "AU954,Covered,375/6,,0,10/08/2026 06:30,2,5A62,ASHFUPS,10/08/2026 07:50,DOVERP,30,,,,,,AU954,,",
].join("\r\n");

export const ASHFORD_ROADS_DETAIL = [
  "Diagram Code,Diagram Date,Notes,Total Miles,Start Tiploc," +
  "Start Location Name,Start Time,Activity,Headcode,Cumulative Miles," +
  "Cumulative Fuel Miles,End Tiploc,End Location Name,End Time,Off Diagram,Works",
  ...["AD951", "AD952"].flatMap(d => [
    orderLeg(d, 30, "ASHFDNS", "Ashford Down Sidings", "06:00:00", "5A60", "ASHFKY", "Ashford", "06:10:00"),
    orderLeg(d, 30, "ASHFKY", "Ashford", "06:20:00", "2A60", "DOVERP", "Dover Priory", "07:20:00"),
  ]),
  ...["AU953", "AU954"].flatMap(d => [
    orderLeg(d, 30, "ASHFUPS", "Ashford Up Sidings", "06:30:00", "5A62", "ASHFKY", "Ashford", "06:40:00"),
    orderLeg(d, 30, "ASHFKY", "Ashford", "06:50:00", "2A62", "DOVERP", "Dover Priory", "07:50:00"),
  ]),
].join("\r\n");

/* RM101 and RM102 leave Ashford twice: 102 leads off the Down Sidings at
   05 05, and 101 leads when they come back out at 15+43. The order list
   names the afternoon one with its time, so the morning departure keeps the
   section rule. */
export const TIMED_FIX_SUMMARY = [
  "Code,Cov,Type,Allocate Resource,Stock,Start Time,Position,First Train," +
  "Start Location,End Time,End Location,Distance,First Train Note," +
  "Start Stock,Last Train,Last Train Note,End Stock,Pre-assignment," +
  "Diagram Comments,Coverage Notes",
  "RM101,Covered,375/6,,0,10/08/2026 04:55,1,5A02,ASHFDNS,10/08/2026 16:50,DOVERP,90,,,,,,RM101,,",
  "RM102,Covered,375/6,,0,10/08/2026 04:55,2,5A02,ASHFDNS,10/08/2026 16:50,DOVERP,90,,,,,,RM102,,",
].join("\r\n");

export const TIMED_FIX_DETAIL = [
  "Diagram Code,Diagram Date,Notes,Total Miles,Start Tiploc," +
  "Start Location Name,Start Time,Activity,Headcode,Cumulative Miles," +
  "Cumulative Fuel Miles,End Tiploc,End Location Name,End Time,Off Diagram,Works",
  ...["RM101", "RM102"].flatMap(d => [
    orderLeg(d, 90, "ASHFDNS", "Ashford Down Sidings", "04:55:00", "5A02", "ASHFKY", "Ashford", "05:00:00"),
    orderLeg(d, 90, "ASHFKY", "Ashford", "05:05:00", "2A06", "DOVERP", "Dover Priory", "06:05:00"),
    orderLeg(d, 90, "DOVERP", "Dover Priory", "13:00:00", "2A40", "ASHFKY", "Ashford", "14:00:00"),
    orderLeg(d, 90, "ASHFKY", "Ashford", "14:10:00", "5A52", "ASHFDNS", "Ashford Down Sidings", "14:20:00"),
    orderLeg(d, 90, "ASHFDNS", "Ashford Down Sidings", "15:43:00", "5A54", "DOVERP", "Dover Priory", "16:50:00"),
  ]),
].join("\r\n");

/* Three Ashford departures that run as one train and part at different times
   of day. AA971/AA972 part at Maidstone East at 18 12 - still to come, but
   not this evening, so SPLITS. AA973/AA974 part at 20 55, which is what
   SPLITS PM means. AA975/AA976 never part at all. */
export const SPLITS_SUMMARY = [
  "Code,Cov,Type,Allocate Resource,Stock,Start Time,Position,First Train," +
  "Start Location,End Time,End Location,Distance,First Train Note," +
  "Start Stock,Last Train,Last Train Note,End Stock,Pre-assignment," +
  "Diagram Comments,Coverage Notes",
  ...[["AA971", "05:50", "19:20"], ["AA972", "05:50", "19:50"],
      ["AA973", "06:20", "22:00"], ["AA974", "06:20", "22:40"],
      ["AA975", "06:50", "18:10"], ["AA976", "06:50", "18:10"],
      ["AA977", "07:20", "21:40"], ["AA978", "07:20", "22:10"]].map(([d, s, e], i) =>
    d + ",Covered,375/6,,0,10/08/2026 " + s + "," + (i % 2 + 1) +
    ",5S71,ASHFDNS,10/08/2026 " + e + ",ASHFDNS,60,,,,,," + d + ",,"),
].join("\r\n");

export const SPLITS_DETAIL = [
  "Diagram Code,Diagram Date,Notes,Total Miles,Start Tiploc," +
  "Start Location Name,Start Time,Activity,Headcode,Cumulative Miles," +
  "Cumulative Fuel Miles,End Tiploc,End Location Name,End Time,Off Diagram,Works",
  ...[["AA971", "05:50", "05:55", "06:00", "2S71", "18:12", "19:20"],
      ["AA972", "05:50", "05:55", "06:00", "2S71", "18:40", "19:50"],
      ["AA973", "06:20", "06:25", "06:30", "2S77", "20:55", "22:00"],
      ["AA974", "06:20", "06:25", "06:30", "2S77", "21:30", "22:40"],
      ["AA975", "06:50", "06:55", "07:00", "2S83", "17:00", "18:10"],
      ["AA976", "06:50", "06:55", "07:00", "2S83", "17:00", "18:10"]].flatMap(
    ([d, out, arr, dep, hc, back, home]) => [
      orderLeg(d, 60, "ASHFDNS", "Ashford Down Sidings", out + ":00", "5S70", "ASHFKY", "Ashford", arr + ":00"),
      orderLeg(d, 60, "ASHFKY", "Ashford", dep + ":00", hc, "MSTONEE", "Maidstone East", "07:30:00"),
      orderLeg(d, 60, "MSTONEE", "Maidstone East", back + ":00", "5S99", "ASHFDNS", "Ashford Down Sidings", home + ":00"),
    ]),
  /* AA977/AA978 are the "PM" shape: out together, back on the SAME berth
     at midday, and only then - on the second half of the diagram - do they
     part. AA971's pair part at Maidstone East before they are put away at
     all, which is a plain SPLITS however late in the day it happens. */
  ...[["AA977", "16:30"], ["AA978", "17:10"]].flatMap(([d, back]) => [
    orderLeg(d, 60, "ASHFDNS", "Ashford Down Sidings", "07:20:00", "5S80", "ASHFKY", "Ashford", "07:25:00"),
    orderLeg(d, 60, "ASHFKY", "Ashford", "07:30:00", "2S85", "MSTONEE", "Maidstone East", "08:30:00"),
    orderLeg(d, 60, "MSTONEE", "Maidstone East", "08:40:00", "5S86", "ASHFDNS", "Ashford Down Sidings", "09:40:00"),
    orderLeg(d, 60, "ASHFDNS", "Ashford Down Sidings", "15:00:00", "5S87", "ASHFKY", "Ashford", "15:05:00"),
    orderLeg(d, 60, "ASHFKY", "Ashford", "15:10:00", "2S88", "MSTONEE", "Maidstone East", "16:10:00"),
    orderLeg(d, 60, "MSTONEE", "Maidstone East", back + ":00", "5S89", "ASHFDNS", "Ashford Down Sidings", "21:40:00"),
  ]),
].join("\r\n");

/* A 12-car Networker made up as 465 + 465 + 466
   + 466 rather than three 4-car 465s - standing on the Slade Green Up CHS,
   which will not hold twelve either way. */
export const APPENDIX_BREACH_SUMMARY = [
  "Code,Cov,Type,Allocate Resource,Stock,Start Time,Position,First Train," +
  "Start Location,End Time,End Location,Distance,First Train Note," +
  "Start Stock,Last Train,Last Train Note,End Stock,Pre-assignment," +
  "Diagram Comments,Coverage Notes",
  ...[["MX901", "465/9", 1], ["MX902", "465/9", 2],
      ["MX903", "466/0", 3], ["MX904", "466/0", 4]].map(([d, t, p]) =>
    d + ",Covered," + t + ",,0,10/08/2026 06:00," + p +
    ",5X01,SLADGUS,10/08/2026 07:00,CANONST,18,,,,,," + d + ",,"),
].join("\r\n");

export const APPENDIX_BREACH_DETAIL = [
  "Diagram Code,Diagram Date,Notes,Total Miles,Start Tiploc," +
  "Start Location Name,Start Time,Activity,Headcode,Cumulative Miles," +
  "Cumulative Fuel Miles,End Tiploc,End Location Name,End Time,Off Diagram,Works",
  ...["MX901", "MX902", "MX903", "MX904"].flatMap(d => [
    orderLeg(d, 18, "SLADGUS", "Slade Green Up C.H.S", "06:00:00", "5X01", "SLADEGN", "Slade Green", "06:10:00"),
    orderLeg(d, 18, "SLADEGN", "Slade Green", "06:20:00", "2X01", "CANONST", "Cannon Street", "07:00:00"),
  ]),
].join("\r\n");

/* "Stabled" is where a diagram starts, not all it does. GN621 stands in the
   Slade Green depot overnight and then works out of it in the small hours -
   a berthing the book has to carry. GN622 stands there all day and never
   moves: nothing to berth, but the depot still has a unit in that road, so
   it has to be named rather than dropped in silence. */
export const STABLED_PRINTS = printsLines([
  "Diagram:\tGN\t621\tSat",
  "Fleet:\t465/9",
  "From:\t01/08/2026",
  "\t\tS Gn Dep\t\t\t\tSTABLD\t\t",
  "\t\tS Gn Dep\t\t00:45\t5Z20\t\t\t",
  "\t\tLndon BrE\t01:09\t\t\t\t\t",
  "Diagram:\tGN\t622\tSat",
  "Fleet:\t465/9",
  "From:\t01/08/2026",
  "\t\tS Gn U Sd\t\t\t\tSTABLD\t\t",
]);
