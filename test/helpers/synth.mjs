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
