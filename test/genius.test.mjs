/* Golden test: the new build's Genius pipeline must reproduce the frozen
   legacy build's output exactly, structure for structure. */
import test from "node:test";
import assert from "node:assert/strict";
import { legacy, built, norm } from "./helpers/compare.mjs";
import { makePdf, SUMMARY_LINES, DETAIL_LINES } from "./helpers/synth.mjs";

function pdfs(ctx) {
  return [makePdf(SUMMARY_LINES, ctx.fflate), makePdf(DETAIL_LINES, ctx.fflate)];
}

/* The Metro sheet prints columns the berthing books never had - the diagram's
   two-letter code, the Position, where the diagram ends and how far it runs -
   so every printed unit now carries them. Two golden tests compare whole
   builds and neither is about those fields: the frozen build has none of
   them, and MILES comes off the CSV export's own column, which the PDF
   report does not have at all. Dropped here, pinned in the Metro tests. */
const METRO_ONLY = ["code", "pos", "ends", "miles"];
function sansMetro(v) {
  if (v === null || typeof v !== "object") return v;
  if (Array.isArray(v)) return v.map(sansMetro);
  const o = {};
  for (const k of Object.keys(v)) if (METRO_ONLY.indexOf(k) < 0) o[k] = sansMetro(v[k]);
  return o;
}

test("pdfText is unchanged", () => {
  const L = legacy(), N = built();
  for (const lines of [SUMMARY_LINES, DETAIL_LINES]) {
    const pdf = makePdf(lines, L.fflate);
    assert.equal(N.GENIUS.pdfText(pdf), L.GENIUS.pdfText(pdf));
  }
});

/* The legacy build read the activity column and threw it away; this one
   keeps it, because a stand with a "#" on it is the unit being put away and
   a stand without one can be a pause on the way home. That is a field the
   frozen build cannot have, so the equivalence check is made on the fields
   it does have - and the new one is pinned by its own tests below. */
const dropAct = v => {
  if (v === null || typeof v !== "object") return v;
  if (Array.isArray(v)) return v.map(dropAct);
  // the value comes out of the sandbox, so instanceof cannot be used here
  if (Object.prototype.toString.call(v) === "[object Map]")
    return new Map([...v].map(([k, x]) => [k, dropAct(x)]));
  const o = {};
  for (const k of Object.keys(v)) if (k !== "act") o[k] = dropAct(v[k]);
  return o;
};

test("parseSummary / parseDetail are unchanged", () => {
  const L = legacy(), N = built();
  const sumTxt = L.GENIUS.pdfText(makePdf(SUMMARY_LINES, L.fflate));
  const detTxt = L.GENIUS.pdfText(makePdf(DETAIL_LINES, L.fflate));
  assert.deepEqual(norm(N.GENIUS.parseSummary(sumTxt)), norm(L.GENIUS.parseSummary(sumTxt)));
  assert.deepEqual(norm(dropAct(N.GENIUS.parseDetail(detTxt))),
                   norm(L.GENIUS.parseDetail(detTxt)));
});

test("stop collapsing and berth boundaries are unchanged", () => {
  const L = legacy(), N = built();
  const det = L.GENIUS.parseDetail(L.GENIUS.pdfText(makePdf(DETAIL_LINES, L.fflate)));
  for (const [, diags] of det) {
    for (const [diag, raw] of diags) {
      const sL = L.GENIUS._stopsOf(raw), sN = N.GENIUS._stopsOf(raw);
      assert.deepEqual(norm(dropAct(sN)), norm(sL), diag + " stops");
      assert.deepEqual(norm(N.GENIUS._boundaries(sN)), norm(L.GENIUS._boundaries(sL)), diag + " boundaries");
    }
  }
});

/* Sections listed lowest Position first (see PROFILES_G in src/data.js).
   Their entries are the legacy ones with the unit rows (and the publisher's
   slots) mirrored; every other section is untouched. The end markers name
   the physical ends of the train and are written against the first and last
   row of an entry, so they stay in their rows. */
const POS_ASC = new Set(["DOVER PRIORY", "FAVERSHAM", "FOLKESTONE EAST",
  "GILLINGHAM", "GROVE PARK", "HASTINGS", "RAMSGATE", "SLADE GREEN"]);

function mirrorEntry(e) {
  const o = {};
  for (const k of Object.keys(e)) {
    if (k === "slots") o[k] = e[k].slice().reverse();
    else if (k === "units") {
      const ends = e[k].map(u => u.end);
      o[k] = e[k].slice().reverse().map((u, i) => ({ ...u, end: ends[i] }));
    } else o[k] = e[k] && typeof e[k] === "object" && !Array.isArray(e[k])
      ? mirrorEntry(e[k]) : e[k];
  }
  return o;
}

function mirrorAscSections(days) {
  const out = {};
  for (const [day, secs] of Object.entries(days))
    out[day] = { "«map»": secs["«map»"].map(([sec, entries]) =>
      [sec, POS_ASC.has(sec) ? entries.map(mirrorEntry) : entries]) };
  return out;
}

test("GENIUS.build output is identical to the legacy build", async () => {
  const L = legacy(), N = built();
  const resL = await L.GENIUS.build(pdfs(L));
  const resN = await N.GENIUS.build(pdfs(N));
  assert.deepEqual(sansMetro(norm(resN.secsByDay)), mirrorAscSections(norm(resL.secsByDay)),
    "mainline sections (lowest-Position-first sections mirrored, rest identical)");
  assert.deepEqual(sansMetro(norm(resN.metroSecs)), norm(resL.metroSecs), "metro sections");
  /* Deliberate divergence: the High Speed book is timed off the first move
     now, the way the operator's own allocation sheet is (their 18/08 has
     AZ601 at 04+19 where the platform departure is 05+03), so its entry
     times have moved on from the frozen build. Everything else about the
     book still has to match, so the time is left out of the comparison - and
     the headcode with it, because an entry timed off the empty move out of
     the sidings quotes that move's headcode (5D01) where one timed off the
     platform quotes the working (1D01). The timing itself is pinned in
     hs.test.mjs. */
  const sansTime = v => {
    if (v === null || typeof v !== "object") return v;
    if (Array.isArray(v)) return v.map(sansTime);
    const o = {};
    for (const k of Object.keys(v))
      if (k !== "time" && k !== "time_kind" && k !== "headcode") o[k] = sansTime(v[k]);
    return o;
  };
  assert.deepEqual(sansTime(sansMetro(norm(resN.hsSecs))), sansTime(norm(resL.hsSecs)),
    "high speed sections, apart from the times");
  assert.deepEqual(norm(resN.labels), norm(resL.labels), "labels");
  /* The legacy build is frozen, so it cannot grow review items the new one
     learned to raise. Compare only the kinds both builds know about; the
     added kind has its own test below. */
  /* The review list has moved on from the frozen build in two ways: it
     raises a kind of note that build never had, and it says the rest in
     plainer words - "Left off —" rather than "suppressed:", diagram numbers
     as the sheet prints them, and no "Position" or "pinned". Compare the
     kinds both builds raise, in the shape this one uses. */
  const SINCE_LEGACY =
    /has a corrected order recorded at|as a berthing —|AM unit positions only/;
  const asNow = m => m
    .replace(/^suppressed: /, "Left off — ")
    .replace(/\) - /, "): ")
    .replace(/\b([A-Z]{2})(\d{3})/g, "$2");
  assert.deepEqual(norm(resN.review.filter(m => !SINCE_LEGACY.test(m))),
                   norm(resL.review.map(asNow)), "review list");
  assert.equal(resN.tag, resL.tag, "tag");
});

test("both reports are still required", async () => {
  const N = built();
  await assert.rejects(() => N.GENIUS.build([makePdf(SUMMARY_LINES, N.fflate)]),
    /Detail report/);
  await assert.rejects(() => N.GENIUS.build([makePdf(DETAIL_LINES, N.fflate)]),
    /Summary report/);
});

test("per-book review lists carry only their own fleet's items", async () => {
  const N = built();
  const res = await N.GENIUS.build(pdfs(N));
  assert.ok(res.reviews, "per-book lists returned");
  // The Faversham ECS suppression belongs to the mainline book alone…
  assert.ok(res.reviews.main.some(x => /FAVERSHAM/.test(x.msg)), "main has its item");
  assert.ok(!res.reviews.metro.some(x => /FAVERSHAM/.test(x.msg)), "metro clean of it");
  assert.ok(!res.reviews.hs.some(x => /FAVERSHAM/.test(x.msg)), "hs clean of it");
  // …and the unknown Belvedere Sidings berth to the metro book alone.
  assert.ok(res.reviews.metro.some(x => /Belvedere/.test(x.msg)), "metro has its item");
  assert.ok(!res.reviews.main.some(x => /Belvedere/.test(x.msg)), "main clean of it");
  /* Together the per-book lists cover the combined list. Not a partition:
     an item with no section belongs to every book and is deliberately on
     all three, so it is one line in the combined list and three in the
     concatenation. Compared as sets for that reason. */
  const uniq = a => norm([...new Set(a)].sort());
  assert.deepEqual(
    uniq([...res.reviews.main, ...res.reviews.metro, ...res.reviews.hs].map(x => x.msg)),
    uniq([...res.review]),
    "every item is on some book's list, and every book's item is on the combined one");
  const general = res.review.filter(m =>
    res.reviews.main.some(x => x.msg === m && !x.sec));
  for (const m of general)
    for (const bag of ["main", "metro", "hs"])
      assert.ok(res.reviews[bag].some(x => x.msg === m),
        "a general item is on the " + bag + " list too: " + m.slice(0, 40));
});

test("warnings carry their section, and the Ramsgate cut works", async () => {
  const N = built();
  const res = await N.GENIUS.build(pdfs(N));
  const fav = res.reviews.main.find(x => /Left off — FAVERSHAM/.test(x.msg));
  assert.equal(fav.sec, "FAVERSHAM", "suppression tagged with its section");
  const ramItem = res.reviews.main.find(x => /Left off — RAMSGATE/.test(x.msg));
  assert.equal(ramItem.sec, "RAMSGATE", "Ramsgate suppression tagged");
  const bel = res.reviews.metro.find(x => /Belvedere/.test(x.msg));
  assert.equal(bel.sec, "BELVEDERE", "auto-section tagged with its section");
  // The Ramsgate card's filter: RAMSGATE items and general items only.
  const ram = res.reviews.main.filter(x => !x.sec || x.sec === "RAMSGATE");
  assert.ok(ram.some(x => /Left off — RAMSGATE/.test(x.msg)),
    "Ramsgate card keeps its own item");
  assert.ok(!ram.some(x => /FAVERSHAM/.test(x.msg)),
    "Ramsgate card clean of other sections' items");
});

test("Integrale CSVs build the same books as the Genius PDFs", async () => {
  const N = built();
  const { integraleSummaryCsv, integraleDetailCsv } =
    await import("./helpers/synth.mjs");
  const pdfRes = await N.GENIUS.build(pdfs(N));
  const csvRes = N.GENIUS.buildIntegrale([integraleSummaryCsv(), integraleDetailCsv()]);
  // …apart from MILES, which is a column the CSV export has and the PDF has not
  assert.deepEqual(sansMetro(norm(csvRes.secsByDay)), sansMetro(norm(pdfRes.secsByDay)),
    "mainline sections");
  assert.deepEqual(sansMetro(norm(csvRes.metroSecs)), sansMetro(norm(pdfRes.metroSecs)),
    "metro sections");
  assert.deepEqual(sansMetro(norm(csvRes.hsSecs)), sansMetro(norm(pdfRes.hsSecs)),
    "high speed sections");
  assert.deepEqual(norm(csvRes.labels), norm(pdfRes.labels), "labels");
  assert.equal(csvRes.tag, pdfRes.tag, "tag");
  /* One documented difference in the lists. The Genius path warns when its
     Summary gives one line per diagram rather than one per working, because
     that is a broken export of a report that normally carries both and the
     fix is to run it again. Integrale has no other shape to offer - one row
     per diagram is what it exports - so the warning would be advice nobody
     can take. The books either source builds are identical, which is what
     the four assertions above check. */
  const OWN = /AM unit positions only/;
  const drop = r => Object.fromEntries(Object.entries(r)
    .map(([k, v]) => [k, v.filter(x => !OWN.test(x.msg))]));
  assert.deepEqual(norm(drop(csvRes.reviews)), norm(drop(pdfRes.reviews)),
    "review lists");
  assert.ok(pdfRes.review.some(m => OWN.test(m)),
    "and the fixture summary really is the one-per-diagram shape");
});

test("the Genius CSV exports build the same books as the PDFs", async () => {
  const N = built();
  const { geniusSummaryCsv, geniusDetailCsv } = await import("./helpers/synth.mjs");
  const pdfRes = await N.GENIUS.build(pdfs(N));
  const csvRes = await N.GENIUS.build([geniusSummaryCsv(), geniusDetailCsv()]);
  // …apart from MILES, which is a column the CSV export has and the PDF has not
  assert.deepEqual(sansMetro(norm(csvRes.secsByDay)), sansMetro(norm(pdfRes.secsByDay)),
    "mainline sections");
  assert.deepEqual(sansMetro(norm(csvRes.metroSecs)), sansMetro(norm(pdfRes.metroSecs)),
    "metro sections");
  assert.deepEqual(sansMetro(norm(csvRes.hsSecs)), sansMetro(norm(pdfRes.hsSecs)),
    "high speed sections");
  assert.deepEqual(norm(csvRes.labels), norm(pdfRes.labels), "labels");
  assert.equal(csvRes.tag, pdfRes.tag, "tag");
  // and either report pairs with the other: a PDF summary with a CSV detail
  const mixed = await N.GENIUS.build(
    [makePdf(SUMMARY_LINES, N.fflate), geniusDetailCsv()]);
  assert.deepEqual(sansMetro(norm(mixed.secsByDay)), sansMetro(norm(pdfRes.secsByDay)),
    "mixed pair");
});

test("a report that spells the year long builds the same day", async () => {
  const N = built();
  const { geniusSummaryCsv, geniusDetailCsv } = await import("./helpers/synth.mjs");
  /* Genius does not always agree with itself about the year. On the 17/08/26
     export the summary header reads "Diagram Summary for: 17/08/26" and
     every detail row reads "On 17/08/2026". The date is the string the two
     halves are joined on, so the day had a summary and a detail and neither
     could find the other: no date had both, and the build stopped dead with
     "No weekday dates found in the reports". A whole day's books refused
     over a year written twice as long. */
  const short = await N.GENIUS.build([geniusSummaryCsv(), geniusDetailCsv()]);
  const long = await N.GENIUS.build([geniusSummaryCsv(), geniusDetailCsv(true)]);
  assert.deepEqual(norm(long.labels), norm(short.labels), "same day, same label");
  assert.deepEqual(norm(long.secsByDay), norm(short.secsByDay), "same mainline book");
  assert.deepEqual(norm(long.metroSecs), norm(short.metroSecs), "same metro book");
  assert.deepEqual(norm(long.hsSecs), norm(short.hsSecs), "same high speed book");
  // and nothing is quietly reported as a date without its other half
  const orphan = long.review.filter(m => /no detail report for this date/.test(m));
  assert.equal(orphan.length, 0,
    "no half-matched date: " + Array.from(orphan).join(" | "));
});

test("a Saturday pair says where the weekend sheets come from", async () => {
  const N = built();
  const { geniusSummaryCsv, geniusDetailCsv } = await import("./helpers/synth.mjs");
  /* The reports do build for a weekend date - Genius will happily export
     one - but these are not what a Saturday or Sunday book is made from,
     and the weekday pipeline has nowhere to put them: a book has one column
     per weekday. It used to stop with a bare "No weekday dates found in the
     reports", which reads like the export is broken. */
  const sat = t => t.replace(/03\/08\/26/g, "15/08/26")   // a Saturday
                    .replace(/03\/08\/2026/g, "15/08/2026");
  await assert.rejects(
    () => N.GENIUS.build([sat(geniusSummaryCsv()), sat(geniusDetailCsv())]),
    /15\/08\/26 falls on a weekend[\s\S]*weekend panel/,
    "names the date and sends them to the prints panel");
  // and a weekday pair still builds, with the plain message left alone
  const ok = await N.GENIUS.build([geniusSummaryCsv(), geniusDetailCsv()]);
  assert.ok(Object.keys(ok.labels).length, "the weekday pair is untouched");
});

test("a diagram whose morning is cancelled still shows its afternoon unit", async () => {
  const N = built();

  /* The allocated unit is read off the working being printed, the same way
     round as the Position, not off the diagram's first summary row. A
     diagram whose morning is cancelled keeps that row with the allocation
     cell empty, and names the unit on the workings that survived - so
     reading row one only printed no unit at all for a diagram that has one
     allocated all afternoon. Reported on 811/812. */
  const SHEAD = '"GENIUS","DIAGRAM SUMMARY REPORT",' +
    '"Diagram Summary for:"," 03/08/26","NOTES","NOTES",';
  const srow = (diag, unit, fleet, pos, start, from, to, end) =>
    SHEAD + ['"' + diag + '"', '"' + unit + '"', '"' + fleet + '"', "0.00", pos,
      '"' + start + '"', '"' + from + '"', '"' + to + '"', '"' + end + '"',
      "0.00", "1.00", "1.00", "", ""].join(",");
  const DHEAD = d => '"GENIUS","Diagram Detail Report",' +
    '"Diagram Details for:"," 03/08/26",' +
    '"Diagram","' + d + '","On","03/08/26","Notes",,"Miles","Fuel Miles",';
  const dleg = (d, from, arr, dep, hc, to, toArr) =>
    DHEAD(d) + ['"' + from + '"', '"' + from + '"',
      arr ? '"' + arr + '"' : "", dep ? '"' + dep + '"' : "", "",
      '"' + hc + '"', "1.00", "1.00",
      '"' + to + '"', '"' + to + '"', '"' + toArr + '"'].join(",");

  const sum = [
    // the cancelled morning: the row is still there, the allocation is not
    srow("GT401", "", "375/3", 1, "05:00", "ASHFDNS", "RAMSGTD", "08:00"),
    srow("GT401", "375301", "375/3", 1, "14:00", "RAMSGTD", "ASHFDNS", "17:00"),
    srow("GT401", "375301", "375/3", 1, "20:40", "ASHFDNS", "RAMSGTD", "23:30"),
  ].join("\r\n");
  const det = [
    dleg("GT401", "ASHFDNS", "", "05:00", "5A01", "RAMSGTD", "08:00"),
    dleg("GT401", "RAMSGTD", "08:00", "14:00", "2A02", "ASHFDNS", "17:00"),
    dleg("GT401", "ASHFDNS", "17:00", "20:40", "2A03", "RAMSGTD", "23:30"),
  ].join("\r\n");

  const res = await N.GENIUS.build([sum, det]);
  const units = [];
  for (const day of Object.keys(res.labels))
    for (const m of [res.secsByDay[day], res.metroSecs[day], res.hsSecs[day]]) {
      if (!m) continue;
      for (const [sec, list] of m)
        for (const e of list)
          for (const u of e.units)
            if (u.diag === "401") units.push(sec + " " + e.time + " = " + (u.unit || "-"));
    }
  assert.ok(units.length, "the fixture printed something to look at");
  assert.ok(units.every(x => /= 301$/.test(x)),
    "every row carries the unit the surviving workings name: " + units.join(" | "));
});

test("the sniffers tell the three report formats apart", async () => {
  const N = built();
  const { geniusSummaryCsv, geniusDetailCsv, integraleSummaryCsv } =
    await import("./helpers/synth.mjs");
  assert.equal(N.GENIUS.sniffGeniusCsv(geniusSummaryCsv()), "sum");
  assert.equal(N.GENIUS.sniffGeniusCsv(geniusDetailCsv()), "det");
  assert.equal(N.GENIUS.sniffGeniusCsv(integraleSummaryCsv()), null);
  assert.equal(N.GENIUS.sniffIntegrale(geniusSummaryCsv()), null);
  assert.equal(N.GENIUS.sniffIntegrale(geniusDetailCsv()), null);
});

test("Integrale quirks: mangled headcodes, stable placeholders, uncovered note", async () => {
  const N = built();
  const { INTEGRALE_QUIRKS_SUMMARY, INTEGRALE_QUIRKS_DETAIL } =
    await import("./helpers/synth.mjs");
  const res = N.GENIUS.buildIntegrale([INTEGRALE_QUIRKS_SUMMARY, INTEGRALE_QUIRKS_DETAIL]);
  assert.ok(res.review.some(m => /1 stable-all-day.*QQ902/.test(m)),
    "stable placeholder dropped with a note");
  assert.ok(res.review.some(m => /1 headcode\(s\) recovered.*2E05/.test(m)),
    "mangled headcode noted");
  assert.ok(res.review.some(m => /1 of 3 diagrams are marked Uncovered/.test(m)),
    "uncovered count noted");
  const ash = res.secsByDay.M.get("ASHFORD");
  assert.ok(ash && ash.some(e => e.headcode === "2E05"),
    "recovered headcode reaches the entry");
  assert.ok(!("T" in res.labels), "the next-day placeholder builds no TUE tab");
  // Plumstead and Bellingham use their own codes on the sheets now
  const bell = res.metroSecs.M.get("BELLINGHAM SIDING");
  assert.ok(bell && bell.length, "Bellingham entry present");
  assert.equal(bell[0].units[0].am, "PLU", "Plumstead berths code PLU");
  assert.equal(bell[0].units[0].pm, "BGM", "Bellingham berths code BGM");
});

test("metro sheets are timed off the first move; the mainline is not", async () => {
  const N = built();
  const { METRO_MOVE_SUMMARY, METRO_MOVE_DETAIL } =
    await import("./helpers/synth.mjs");
  const res = N.GENIUS.buildIntegrale([METRO_MOVE_SUMMARY, METRO_MOVE_DETAIL]);
  const dart = res.metroSecs.M.get("DARTFORD");
  assert.ok(dart && dart.length === 2, "both Dartford entries listed");
  // MM801 leaves the up sidings empty at 05 52 and forms the 06 00 off the
  // platform: the sheet shows the berth move, still bound for Cannon Street.
  const [moved, starter] = dart;
  assert.equal(moved.time, 5 * 60 + 52, "timed off the first move");
  assert.equal(moved.time_kind, "ecs", "an empty move, so a + time");
  assert.equal(moved.headcode, "5B05", "the empty move's headcode");
  assert.equal(moved.dest, "CST", "destination stays with the working leg");
  // MM802 starts in the platform, so the platform time is the first move.
  assert.equal(starter.time, 6 * 60 + 20, "platform starter keeps its time");
  assert.equal(starter.time_kind, "pax");
  assert.equal(starter.headcode, "2B07");
  // The mainline book keeps the legacy rule: GT101 runs empty out of the
  // Ashford down sidings at 05 30 but is listed off the platform at 05 45.
  const pdfRes = await N.GENIUS.build(pdfs(N));
  const ash = pdfRes.secsByDay.M.get("ASHFORD");
  assert.ok(ash.some(e => e.time === 5 * 60 + 45 && e.headcode === "2A01"),
    "mainline listed off the platform call");
  assert.ok(!ash.some(e => e.time === 5 * 60 + 30),
    "mainline not moved back to the sidings departure");
});

test("which unit leads is per section, from the fleet profile", async () => {
  const N = built();
  const { REVERSED_ORDER_SUMMARY, REVERSED_ORDER_DETAIL } =
    await import("./helpers/synth.mjs");
  const res = N.GENIUS.buildIntegrale(
    [REVERSED_ORDER_SUMMARY, REVERSED_ORDER_DETAIL]);
  // Ramsgate lists Position 1 first; Ashford and Victoria list it last
  // (checked against the real book for 12/08).
  for (const [sec, want] of [["RAMSGATE", ["903", "904"]],
                             ["ASHFORD", ["906", "905"]],
                             ["VICTORIA", ["902", "901"]]]) {
    const list = res.secsByDay.M.get(sec);
    assert.ok(list && list.length === 1, "one " + sec + " departure");
    assert.deepEqual(norm(list[0].units.map(u => u.diag)), want, sec);
  }
  // The metro book has not been checked, so it lists highest Position first
  // throughout.
  const sg = res.metroSecs.M.get("SLADE GREEN");
  assert.ok(sg && sg.length === 1, "one Slade Green departure");
  assert.deepEqual(norm(sg[0].units.map(u => u.diag)), ["908", "907"],
    "metro unchanged");
  // …and a formation the books say is the other way round beats the section
  // rule (Dover Priory lists lowest first, but not this pair).
  const dp = res.secsByDay.M.get("DOVER PRIORY");
  assert.ok(dp && dp.length === 1, "one Dover Priory departure");
  assert.deepEqual(norm(dp[0].units.map(u => u.diag)), ["014", "013"],
    "ORDER_FIX beats the section rule");
});

test("units the reports cannot order are named on the review list", async () => {
  const N = built();
  const { TIED_POSITION_SUMMARY, TIED_POSITION_DETAIL } =
    await import("./helpers/synth.mjs");
  const res = N.GENIUS.buildIntegrale([TIED_POSITION_SUMMARY, TIED_POSITION_DETAIL]);
  /* The note names the units the way the SHEET names them - three digits,
     no fleet prefix - because it is read next to the sheet. */
  assert.ok(res.reviews.main.some(x =>
    /the same place in the formation/.test(x.msg) &&
    /\b910\b/.test(x.msg) && /\b911\b/.test(x.msg)),
    "the tie is flagged rather than quietly guessed at");
  assert.ok(!res.reviews.main.some(x => /\bPosition\b|\bpinned\b/.test(x.msg)),
    "and says it without the report's own field names");
});

test("mixed-format pairs are refused by the sniffers", () => {
  const N = built();
  assert.equal(N.GENIUS.sniffIntegrale("Code,Cov,Type,x,x,x,Position,First Train,y"), "sum");
  assert.equal(N.GENIUS.sniffIntegrale("Diagram Code,Diagram Date,Notes,Start Tiploc"), "det");
  assert.equal(N.GENIUS.sniffIntegrale("some,other,csv"), null);
});

test("a late evening move leaves the berth it stood on in the PM column", async () => {
  const N = built();
  const { LATE_MOVE_SUMMARY, LATE_MOVE_DETAIL } = await import("./helpers/synth.mjs");
  const res = N.GENIUS.buildIntegrale([LATE_MOVE_SUMMARY, LATE_MOVE_DETAIL]);
  const one = sec => {
    const list = res.secsByDay.M.get(sec);
    assert.ok(list && list.length, sec + " built");
    return list;
  };
  /* Wherever the unit is taken afterwards, the berth it spent the evening
     on is what these rows mean by PM - only the row for that last journey
     reads where the journey ends. */
  // shunted out of the shed to Hastings for the night: still a shed unit
  assert.equal(norm(one("WEST MARINA")[0].units[0].pm), "XSE",
    "St Leonards shed keeps its unit");
  // off the east sidings to the Folkestone Train Roads, but AFE until then
  assert.equal(norm(one("ASHFORD")[0].units[0].pm), "AFE",
    "Ashford east sidings keep theirs too");
  // and the same shape across to Grove Park
  const sg = one("SLADE GREEN");
  assert.equal(norm(sg[0].units[0].pm), "SG", "Slade Green keeps its unit");
  // a train booked into the depot is destined GPD, one into the station GPK
  const dests = norm(sg.map(e => e.dest));
  assert.ok(dests.includes("GPD"), "depot arrival destined GPD: " + dests);
  assert.ok(dests.includes("GPK"), "station arrival destined GPK: " + dests);
});

test("a road that faces the other way reads the other way round", async () => {
  const N = built();
  const { ASHFORD_ROADS_SUMMARY, ASHFORD_ROADS_DETAIL } =
    await import("./helpers/synth.mjs");
  const res = N.GENIUS.buildIntegrale([ASHFORD_ROADS_SUMMARY, ASHFORD_ROADS_DETAIL]);
  const list = res.secsByDay.M.get("ASHFORD");
  assert.ok(list && list.length === 2, "both Ashford departures built");
  const [down, up] = list;
  // the section rule: highest Position leads
  assert.deepEqual(norm(down.units.map(u => u.diag)), ["952", "951"], "off the Down Sidings");
  // …and the Up Sidings, which the profile names, the other way round
  assert.deepEqual(norm(up.units.map(u => u.diag)), ["953", "954"], "off the Up Sidings");
});

test("the order list can name one departure without moving the others", async () => {
  const N = built();
  const { TIMED_FIX_SUMMARY, TIMED_FIX_DETAIL } = await import("./helpers/synth.mjs");
  const res = N.GENIUS.buildIntegrale([TIMED_FIX_SUMMARY, TIMED_FIX_DETAIL]);
  const list = res.secsByDay.M.get("ASHFORD");
  assert.ok(list && list.length === 2, "both Ashford departures built");
  const at = t => list.find(e => N.SHEETS_CORE.fmtTime(e.time,
    e.time_kind === "pax" ? "pax" : "ecs") === t);
  assert.ok(at("05 05") && at("15+43"), "times: " +
    list.map(e => e.time + "/" + e.time_kind).join(" "));
  assert.deepEqual(norm(at("05 05").units.map(u => u.diag)), ["102", "101"],
    "the morning departure keeps the section rule");
  assert.deepEqual(norm(at("15+43").units.map(u => u.diag)), ["101", "102"],
    "the afternoon one is named in the order list");
});

test("SPLITS follows where the units part, over the whole day", async () => {
  const N = built();
  const { SPLITS_SUMMARY, SPLITS_DETAIL } = await import("./helpers/synth.mjs");
  const res = N.GENIUS.buildIntegrale([SPLITS_SUMMARY, SPLITS_DETAIL]);
  const list = res.secsByDay.M.get("ASHFORD");
  assert.ok(list && list.length >= 3, "the three departures were built");
  const flagOf = diag => {
    const e = list.find(x => x.units.some(u => u.diag === diag));
    return e ? e.flag : "(not built)";
  };
  /* SPLITS is read over the whole day, not from where this stint ends: 971
     and 972 run as one train to Maidstone East and sit there together, and
     the old stint-end test saw no split at all. */
  assert.equal(norm(flagOf("971")), "SPLITS", "parting at 18 12, before berthing");
  assert.equal(norm(flagOf("973")), "SPLITS", "parting at 20 55, also before berthing");
  assert.equal(norm(flagOf("975")), "", "never parting");
  /* "PM" is a place in the diagram, not a time of day: 977/978 go back on
     their own berth at 09 40 and part on the second half of the day. */
  assert.equal(norm(flagOf("977")), "SPLITS PM", "parts after it is put away");
});

test("an order fix with no section holds the formation everywhere", async () => {
  const N = built();
  const { REVERSED_ORDER_SUMMARY, REVERSED_ORDER_DETAIL } =
    await import("./helpers/synth.mjs");
  // RG903/RG904 leave Ramsgate for Ashford. Ramsgate lists lowest Position
  // first, so without a fix it reads 903 then 904 - the fixture's own test
  // above pins that. Here the point is the lookup order: a bare key is only
  // consulted after the section-qualified ones.
  const D = N.SHEETS_DATA;
  const bare = Object.keys(D.ORDER_FIX).filter(k => !k.includes("|"));
  assert.ok(bare.length, "there is at least one formation-wide key");
  for (const k of bare) {
    assert.match(k, /^\d{3}(,\d{3})+$/, "a bare key is just sorted diagrams: " + k);
    assert.deepEqual(norm(D.ORDER_FIX[k].slice().sort()), norm(k.split(",")),
      "the fix names exactly the diagrams in its key: " + k);
  }
  // and every section-qualified key still names diagrams that sort to its tail
  for (const k of Object.keys(D.ORDER_FIX)) {
    if (!k.includes("|")) continue;
    const tail = k.split("|")[1];
    assert.deepEqual(norm(D.ORDER_FIX[k].slice().sort()), norm(tail.split(",")),
      "key and value agree: " + k);
  }
  const res = N.GENIUS.buildIntegrale([REVERSED_ORDER_SUMMARY, REVERSED_ORDER_DETAIL]);
  assert.ok(res.secsByDay.M.get("RAMSGATE"), "the fixture still builds");
});

test("a pin that exists elsewhere but not here is named on the review list", async () => {
  const N = built();
  const S = await import("./helpers/synth.mjs");
  const res = await N.GENIUS.build(
    [S.makePdf(S.SUMMARY_LINES, N.fflate), S.makePdf(S.DETAIL_LINES, N.fflate)]);
  /* GT101/GT102 are pinned at ASHFORD 15+43 and nowhere else, so their other
     appearance has to say the pin did not reach it - that silent miss is the
     failure this note exists to catch. */
  const hit = res.review.find(m => /has a corrected order recorded at/.test(m));
  assert.ok(hit, "the unreached pin is named: " + res.review.join(" | "));
  assert.match(hit, /10[12]\+10[12]/, "it names the units: " + hit);
  assert.match(hit, /ASHFORD 15\+43/, "it says where the order IS recorded: " + hit);
  // a formation with no pin anywhere must stay quiet - this is not a
  // "your order is unvalidated" warning, which would fire on nearly every row
  const D = N.SHEETS_DATA;
  const pinned = new Set(Object.keys(D.ORDER_FIX)
    .filter(k => k.includes("|")).map(k => k.split("|")[1]));
  for (const m of res.review) {
    const mm = /\((.+?)\): this formation has a corrected order/.exec(m);
    if (!mm) continue;
    const diags = mm[1].split("+").sort().join(",");
    assert.ok(pinned.has(diags), "only formations that ARE pinned somewhere: " + m);
  }
});

/* ---- standing somewhere on the way to the depot is not a berthing ----
   SG810's real shape on 17/08: in service to Dartford, empty into the Down
   Siding at 22:53, then empty on to Slade Green depot at 23:30. Nothing is
   shunted at Dartford, so the unit was never put away there and the Dartford
   page has no line to carry. Give the same stand a "#" and it IS a berthing,
   which is the half of the rule that keeps it from eating real entries. */
const PAUSE_SUM = ['"GENIUS","DIAGRAM SUMMARY REPORT","Page:","Page -1 of 1",,',
  '"Control:","SouthEastern Trains","Print Date:","August 16, 2026",',
  '"Diagram Summary for:"," 17/08/26","DIAGRAM","UNITS","FLEET","OFF",',
  '"START FUEL","POS","AT","FROM","TO","AT","WORKS","END FUEL","MILES",',
  '"TOT. FUEL  MILES","NOTES","NOTES",',
  '"SG810","","375/6",0.00,1,"22:38","SLADEGN","SLADEGD","23:39",',
  '-0.60,100.00,100.00,,\r\n',
  /* a second diagram purely so the export demonstrably HAS an activity
     column - the rule is gated on that, and one diagram of its own could
     never tell a blank column from a missing one */
  '"GENIUS","DIAGRAM SUMMARY REPORT","Page:","Page -1 of 1",,',
  '"Control:","SouthEastern Trains","Print Date:","August 16, 2026",',
  '"Diagram Summary for:"," 17/08/26","DIAGRAM","UNITS","FLEET","OFF",',
  '"START FUEL","POS","AT","FROM","TO","AT","WORKS","END FUEL","MILES",',
  '"TOT. FUEL  MILES","NOTES","NOTES",',
  '"SG811","","375/6",0.00,1,"06:00","SLADEGD","SLADEGD","08:25",',
  '-0.60,100.00,100.00,,'].join("");

function pauseDetail(act) {
  const head = d => ['"GENIUS","Diagram Detail Report","Page:","Page -1 of 1",,,,,',
    '"Control:","SouthEastern Trains","Print Date:","August 16, 2026",',
    '"Diagram Details for:"," 17/08/26","Diagram","' + d + '","On","17/08/26",',
    '"Notes",,"Miles","Fuel Miles",'].join("");
  const leg = (d, c, n, arr, dep, a, hc, tc, tn, tarr) =>
    head(d) + ['"' + c + '"', '"' + n + '"', arr ? '"' + arr + '"' : "",
      dep ? '"' + dep + '"' : "", a ? '"' + a + '"' : "", '"' + hc + '"',
      "1.00", "1.00", '"' + tc + '"', '"' + tn + '"', '"' + tarr + '"',
      '"Off Diagram"', '"  000"', '"Works"', '"  000"'].join(",");
  return [
    leg("SG810", "SLADEGN", "Slade Green", "", "22:38", "", "2E73BA",
        "DARTFD", "Dartford", "22:45"),
    leg("SG810", "DARTFD", "Dartford", "22:45", "22:50", "", "5E73BA",
        "DARTFDS", "Dartford Dn Sdg", "22:53"),
    leg("SG810", "DARTFDS", "Dartford Dn Sdg", "22:53", "23:30", act, "5A73BA",
        "DARTFD", "Dartford", "23:33"),
    leg("SG810", "DARTFD", "Dartford", "23:33", "23:33", "", "5A73BA",
        "SLADEGD", "Slade Green DD", "23:39"),
    leg("SG811", "SLADEGD", "Slade Green DD", "", "06:00", "", "5X01BA",
        "SLADEGN", "Slade Green", "06:05"),
    leg("SG811", "SLADEGN", "Slade Green", "06:05", "06:10", "", "2X01BA",
        "CANONST", "London Cannon St", "07:00"),
    leg("SG811", "CANONST", "London Cannon St", "07:00", "07:30", "", "5X02BA",
        "SLADEGD", "Slade Green DD", "08:20"),
    leg("SG811", "SLADEGD", "Slade Green DD", "08:20", "08:25", "#", "",
        "SLADEGD", "Slade Green DD", "08:25"),
  ].join("\r\n");
}

const dartfordTimes = res => {
  const out = [];
  for (const bag of [res.secsByDay, res.metroSecs, res.hsSecs])
    for (const d of Object.keys(bag || {}))
      for (const [name, list] of (bag[d] || new Map()))
        if (name === "DARTFORD") for (const e of list) out.push(e.time);
  return out;
};

test("a stand with no shunt on the way to the depot is not printed", async () => {
  const N = built();
  const res = await N.GENIUS.build([PAUSE_SUM, pauseDetail("")]);
  assert.deepEqual(Array.from(dartfordTimes(res)), [],
    "Dartford gets no line for a unit that only paused there");
  const note = res.review.find(m => /DARTFORD/.test(m) && /Left off/.test(m));
  assert.ok(note, "and the Review tab says why: " + res.review.join(" | "));
  assert.match(note, /never shunted/);
});

test("the same stand WITH a shunt is a berthing and is printed", async () => {
  const N = built();
  const res = await N.GENIUS.build([PAUSE_SUM, pauseDetail("#")]);
  assert.deepEqual(Array.from(dartfordTimes(res)), [23 * 60 + 33],
    "a unit that was put away at Dartford keeps its line");
});

test("the exception needs the activity column to be there at all", async () => {
  const N = built();
  const S = await import("./helpers/synth.mjs");
  /* The PDF fixtures carry no "#" anywhere. If a missing column read as
     "nothing was ever shunted", the rule would strip real entries out of
     every PDF-fed book - so with no column it must change nothing. */
  const res = await N.GENIUS.build(
    [S.makePdf(S.SUMMARY_LINES, N.fflate), S.makePdf(S.DETAIL_LINES, N.fflate)]);
  const paused = res.review.filter(m => /never shunted/.test(m));
  assert.deepEqual(Array.from(paused), [],
    "no entry is dropped as a pause when the report has no activity column");
});

/* ---- a long stand in a platform ----
   GT120/GT121 arrive at London Victoria at 22 40 and leave at 23 40 for
   Meopham, and the book carries that line. A platform is not a siding, so
   this is not the general rule: it fires where the report shunts the unit
   on the spot ("#"), or where the operator asks for it. Everything else
   long enough is named on the review list and left off. */
const STAND_SUM = ['"GENIUS","DIAGRAM SUMMARY REPORT","Page:","Page -1 of 1",,',
  '"Control:","SouthEastern Trains","Print Date:","August 16, 2026",',
  '"Diagram Summary for:"," 17/08/26","DIAGRAM","UNITS","FLEET","OFF",',
  '"START FUEL","POS","AT","FROM","TO","AT","WORKS","END FUEL","MILES",',
  '"TOT. FUEL  MILES","NOTES","NOTES",',
  '"GT120","","375/6",0.00,1,"20:00","ASHFDNS","VICTGCS","23:59",',
  '-0.60,100.00,100.00,,'].join("");

function standDetail(act) {
  const head = ['"GENIUS","Diagram Detail Report","Page:","Page -1 of 1",,,,,',
    '"Control:","SouthEastern Trains","Print Date:","August 16, 2026",',
    '"Diagram Details for:"," 17/08/26","Diagram","GT120","On","17/08/26",',
    '"Notes",,"Miles","Fuel Miles",'].join("");
  const leg = (c, n, arr, dep, a, hc, tc, tn, tarr) =>
    head + ['"' + c + '"', '"' + n + '"', arr ? '"' + arr + '"' : "",
      dep ? '"' + dep + '"' : "", a ? '"' + a + '"' : "", '"' + hc + '"',
      "1.00", "1.00", '"' + tc + '"', '"' + tn + '"', '"' + tarr + '"',
      '"Off Diagram"', '"  000"', '"Works"', '"  000"'].join(",");
  return [
    /* Starts at Ashford, so Victoria gets a line ONLY if the stand there
       counts as a berthing - otherwise the rule under test is masked by the
       ordinary "timed off the last call in the section" behaviour. */
    leg("ASHFDNS", "Ashford Down Sidings", "", "20:00", "", "5F16BD",
        "VICTRIE", "London Victoria", "21:10"),
    // the stand: an hour in the platform, with or without the shunt marker
    leg("VICTRIE", "London Victoria", "21:10", "22:10", act, "1S72BA",
        "BCKNHMJ", "Beckenham Juncti", "22:23"),
    leg("BCKNHMJ", "Beckenham Juncti", "22:23", "22:23", "", "1S72BA",
        "MEOPHAM", "Meopham", "22:43"),
    leg("MEOPHAM", "Meopham", "22:43", "23:00", "", "5Y72UA",
        "VICTGCS", "Victoria Grosven", "23:59"),
  ].join("\r\n");
}

const victoriaTimes = res => {
  const out = [];
  for (const d of Object.keys(res.labels))
    for (const [name, list] of (res.secsByDay[d] || new Map()))
      if (name === "VICTORIA") for (const e of list) out.push(e.time);
  return out.sort((a, b) => a - b);
};

test("a platform stand the report shunts is a berthing", async () => {
  const N = built();
  const res = await N.GENIUS.build([STAND_SUM, standDetail("#")]);
  assert.ok(Array.from(victoriaTimes(res)).includes(22 * 60 + 10),
    "the 22 10 off the platform is on the sheet: " + victoriaTimes(res));
  const note = res.review.find(m => /Taken as a berthing/.test(m));
  assert.ok(note, "and the review says so: " + res.review.join(" | "));
  assert.match(note, /shunts it there/);
});

test("a platform stand with no shunt is named, not printed", async () => {
  const N = built();
  const res = await N.GENIUS.build([STAND_SUM, standDetail("")]);
  assert.ok(!Array.from(victoriaTimes(res)).includes(22 * 60 + 10),
    "no line for it: " + victoriaTimes(res));
  const note = res.review.find(m => /Not counted as a berthing/.test(m));
  assert.ok(note, "but it is named: " + res.review.join(" | "));
  assert.match(note, /60 minutes/);
  assert.match(note, /Count long platform stands/, "and says how to include it");
});

test("…and the option puts it on the sheet", async () => {
  const N = built();
  const res = await N.GENIUS.build([STAND_SUM, standDetail("")],
                                   { platformStands: true });
  assert.ok(Array.from(victoriaTimes(res)).includes(22 * 60 + 10),
    "with the option on it prints: " + victoriaTimes(res));
});

test("a short stand is a turnround, not a berthing", async () => {
  const N = built();
  /* Under RUN_ROUND the stand is a turnround and never reaches the rule -
     with or without a shunt marker, and whatever the option says. */
  const short = standDetail("#").replace('"21:10","22:10"', '"21:10","21:50"');
  for (const opts of [undefined, { platformStands: true }]) {
    const res = await N.GENIUS.build([STAND_SUM, short], opts);
    assert.ok(!Array.from(victoriaTimes(res)).includes(21 * 60 + 50),
      "40 minutes is a turnround: " + victoriaTimes(res));
    assert.deepEqual(Array.from(res.review.filter(m => /as a berthing/.test(m))),
      [], "and not worth a review line either");
  }
});

test("pasted text reads the same as the file it was copied from", async () => {
  const N = built();
  const { geniusSummaryCsv, geniusDetailCsv } = await import("./helpers/synth.mjs");
  const P = N.GENIUS.pastedCsv;
  const sum = geniusSummaryCsv(), det = geniusDetailCsv();

  // a real CSV goes through untouched but for the line endings and the edges
  assert.equal(P(sum), sum.replace(/\r\n?/g, "\n").replace(/^\n+/, "").replace(/\s+$/, ""),
    "a pasted CSV is left as it is");
  assert.equal(N.GENIUS.sniffGeniusCsv(P(sum)), "sum", "and still sniffs");
  assert.equal(P(""), "", "an empty box is empty");
  assert.equal(P("   \n\n "), "", "and so is a box of whitespace");
  assert.equal(P("﻿a,b"), "a,b", "a byte order mark is dropped");

  /* Copied out of Excel rather than Notepad, the same report arrives TAB
     separated - the reader sees one enormous field per line and refuses it.
     Excel is the likely route to the clipboard, so that is turned back into
     CSV. The catch is the report's own print date, "August 17, 2026": Excel
     does not quote it when the separator is a tab, so a paste that is
     plainly tab separated still carries a bare comma. The test is which
     there are more of. */
  const cells = csv => {
    const rows = []; let row = [], f = "", q = false;
    for (let i = 0; i < csv.length; i++) {
      const c = csv[i];
      if (q) { if (c === '"') { if (csv[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
      else if (c === '"') q = true;
      else if (c === ",") { row.push(f); f = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && csv[i + 1] === "\n") i++;
        row.push(f); f = ""; rows.push(row); row = [];
      } else f += c;
    }
    row.push(f); if (row.length > 1 || row[0] !== "") rows.push(row);
    return rows;
  };
  const excelClipboard = csv => cells(csv).map(r =>
    r.map(x => /[\t"\n]/.test(x) ? '"' + x.replace(/"/g, '""') + '"' : x).join("\t")
  ).join("\n");

  const tsvSum = excelClipboard(sum), tsvDet = excelClipboard(det);
  assert.ok(tsvSum.indexOf("\t") > 0, "the fixture really is tab separated now");
  assert.equal(N.GENIUS.sniffGeniusCsv(tsvSum), null, "and unreadable as it stands");
  assert.equal(N.GENIUS.sniffGeniusCsv(P(tsvSum)), "sum", "readable once converted");
  assert.equal(N.GENIUS.sniffGeniusCsv(P(tsvDet)), "det", "both halves of it");

  // the whole point: the books are the books, whichever way it was copied
  const fromFiles = await N.GENIUS.build([sum, det]);
  const fromPaste = await N.GENIUS.build([P(tsvSum), P(tsvDet)]);
  assert.deepEqual(norm(fromPaste.secsByDay), norm(fromFiles.secsByDay), "mainline");
  assert.deepEqual(norm(fromPaste.metroSecs), norm(fromFiles.metroSecs), "metro");
  assert.deepEqual(norm(fromPaste.hsSecs), norm(fromFiles.hsSecs), "high speed");
  assert.deepEqual(norm(fromPaste.labels), norm(fromFiles.labels), "labels");

  // a line with more commas than tabs is a CSV that happens to hold a tab
  const csvWithTab = 'a,b,"has\ttab",c\n1,2,3,4';
  assert.equal(P(csvWithTab), csvWithTab, "left alone");
});

test("a summary with the AM positions only says so", async () => {
  const N = built();
  const { geniusSummaryCsv, geniusDetailCsv } = await import("./helpers/synth.mjs");
  const sum = geniusSummaryCsv(), det = geniusDetailCsv();

  /* Which way round a formation reads comes from the Position, and the
     Position only means anything if the summary gives one per WORKING. The
     12/08 export did - 449 rows for 303 diagrams - and the 17/08 one gave
     322 rows for 322 diagrams, one apiece: the start-of-day Position and
     nothing else. Afternoon formations were then ordered on where their
     units stood that morning. Four of the six Grove Park PM formations that
     could be checked came out wrong, and nothing on the sheet said so. The
     order cannot be recovered - the Detail report carries no Position and no
     formation column - so the review list has to carry the warning.

     The check is the two reports against each other, not the row count: a
     short day would fail a count. The synthetic summary is itself the thin
     shape, one row per diagram, so it is the fixture for the bad case and
     the good one is made by giving a diagram its second working. */
  const said = r => r.review.filter(m => /AM unit positions only/.test(m));

  const thin = await N.GENIUS.build([sum, det]);
  assert.equal(said(thin).length, 1, "one row per diagram is called out");
  assert.match(said(thin)[0], /not the PM ones/, "in the terms a reader cares about");
  assert.match(said(thin)[0], /start of the day/, "says what is missing");
  assert.match(said(thin)[0], /working more than once/, "and how it knows");
  assert.match(said(thin)[0], /Reverse/, "and what to do about it");

  // the same day with any diagram listed per working instead of once
  const rows = sum.split("\r\n");
  const withWorking = rows.concat([rows[0].replace(/"(\d\d:\d\d)"/, '"23:59"')])
    .join("\r\n");
  const full = await N.GENIUS.build([withWorking, det]);
  assert.equal(said(full).length, 0,
    "a summary that lists a working twice says nothing: " + said(full).join(" | "));
});

test("a report with the right name and the wrong columns says which", async () => {
  const N = built();
  const { integraleSummaryCsv, integraleDetailCsv } =
    await import("./helpers/synth.mjs");
  /* The 16/08 Integrale Summary came out without Cov and Position - both
     things the exporter lets you pick - and the refusal only said it did not
     look like the Diagram Summary export, which sends somebody hunting for
     the wrong file when what they need is two tick boxes. */
  const drop = (csv, col) => {
    const rows = csv.replace(/^﻿/, "").split(/\r?\n/).filter(Boolean)
      .map(l => l.split(","));
    const i = rows[0].map(x => x.trim()).indexOf(col);
    assert.ok(i >= 0, "the fixture has a " + col + " column to drop");
    return rows.map(r => r.filter((_, j) => j !== i).join(",")).join("\r\n");
  };
  const det = integraleDetailCsv();
  assert.throws(
    () => N.GENIUS.buildIntegrale([drop(integraleSummaryCsv(), "Position"), det]),
    /missing the Position column - add it to the export/,
    "one missing column is named, in the singular");
  assert.throws(
    () => N.GENIUS.buildIntegrale(
      [drop(drop(integraleSummaryCsv(), "Position"), "Cov"), det]),
    /missing the Cov, Position columns - add them/,
    "two are named, in the plural");
  // and a complete export is still built without complaint
  const ok = N.GENIUS.buildIntegrale([integraleSummaryCsv(), det]);
  assert.ok(Object.keys(ok.labels).length, "the whole export still builds");
});

test("a diagram out a third time reads its last berth until the last journey", async () => {
  const N = built();

  /* A diagram with three berths has two PM ones, and the column means a
     different one on each row: every row before the last journey carries
     the berth the unit is sitting on, and the row for that journey itself
     carries where it finishes.

     375/3 diagram 301 on 12/08 works out of Grove Park, stands at Ramsgate
     from 20 34, then works 2U80 out again to Gillingham depot: the Ashford
     and Grove Park rows read RE, and only the entry leaving Ramsgate reads
     GI. 377 diagram 103/104 is the same shape with an empty final run -
     Ashford east sidings, then 5R96 to the Folkestone train roads - and the
     operator reads it the same way: AFE on the rows before, FKE on the run.

     Built through the CSV reader rather than the PDF one because these rows
     can be written out exactly, without disturbing the shared fixture the
     golden tests are pinned to. */
  const SHEAD = '"GENIUS","DIAGRAM SUMMARY REPORT",' +
    '"Diagram Summary for:"," 03/08/26","NOTES","NOTES",';
  const srow = (diag, fleet, pos, start, from, to, end) =>
    SHEAD + ['"' + diag + '"', "", '"' + fleet + '"', "0.00", pos,
      '"' + start + '"', '"' + from + '"', '"' + to + '"', '"' + end + '"',
      "0.00", "1.00", "1.00", "", ""].join(",");
  const DHEAD = d => '"GENIUS","Diagram Detail Report",' +
    '"Diagram Details for:"," 03/08/26",' +
    '"Diagram","' + d + '","On","03/08/26","Notes",,"Miles","Fuel Miles",';
  const dleg = (d, from, arr, dep, act, hc, to, toArr) =>
    DHEAD(d) + ['"' + from + '"', '"' + from + '"',
      arr ? '"' + arr + '"' : "", dep ? '"' + dep + '"' : "",
      act ? '"' + act + '"' : "", '"' + hc + '"', "1.00", "1.00",
      '"' + to + '"', '"' + to + '"', '"' + toArr + '"'].join(",");

  const sum = [
    srow("GT201", "375/3", 1, "05:00", "ASHFDNS", "RAMSGTD", "08:00"),
    srow("GT201", "375/3", 1, "20:40", "RAMSGTD", "GLNGDEP", "23:30"),
    srow("GT202", "377/5", 1, "05:00", "ASHFDNS", "ASHFEBS", "08:00"),
    srow("GT202", "377/5", 1, "20:40", "ASHFEBS", "FLKSETR", "23:30"),
  ].join("\r\n");
  const det = [
    dleg("GT201", "ASHFDNS", "", "05:00", "", "5A01", "RAMSGTD", "08:00"),
    dleg("GT201", "RAMSGTD", "08:00", "08:01", "#", "", "RAMSGTD", "08:01"),
    dleg("GT201", "RAMSGTD", "08:01", "20:40", "", "5U80", "RAMSGTE", "20:50"),
    dleg("GT201", "RAMSGTE", "20:50", "21:00", "", "2U80", "GLNGHMK", "23:00"),
    dleg("GT201", "GLNGHMK", "23:00", "23:10", "", "5U80", "GLNGDEP", "23:30"),
    dleg("GT202", "ASHFDNS", "", "05:00", "", "5A02", "ASHFEBS", "08:00"),
    dleg("GT202", "ASHFEBS", "08:00", "08:01", "#", "", "ASHFEBS", "08:01"),
    dleg("GT202", "ASHFEBS", "08:01", "20:40", "", "5R96", "ASHFKY", "20:50"),
    dleg("GT202", "ASHFKY", "20:50", "21:00", "", "5R96", "FLKSETR", "23:30"),
  ].join("\r\n");

  assert.equal(N.GENIUS.sniffGeniusCsv(sum), "sum", "the summary rows read");
  assert.equal(N.GENIUS.sniffGeniusCsv(det), "det", "and so do the legs");
  const res = await N.GENIUS.build([sum, det]);
  // every row that carries the diagram, in time order, as "SECTION=PM"
  const pmOf = diag => {
    const out = [];
    for (const day of Object.keys(res.labels))
      for (const m of [res.secsByDay[day], res.metroSecs[day], res.hsSecs[day]]) {
        if (!m) continue;
        for (const [sec, list] of m)
          for (const e of list)
            for (const u of e.units)
              if (u.diag === diag) out.push({ t: e.time, s: sec + "=" + (u.pm || "-") });
      }
    return out.sort((a, b) => a.t - b.t).map(x => x.s);
  };
  /* If the reader cannot place these the test proves nothing, so it says so
     rather than passing on an empty build. */
  assert.ok(pmOf("201").length && pmOf("202").length,
    "the fixture built something to look at");
  assert.deepEqual(pmOf("201"), ["ASHFORD=RE", "RAMSGATE=GI"],
    "the berth until the last journey, then where that journey finishes");
  assert.deepEqual(pmOf("202"), ["ASHFORD=AFE", "ASHFORD=FKE"],
    "an empty final run reads no differently");
});
