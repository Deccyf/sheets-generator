/* Golden test: the new build's Genius pipeline must reproduce the frozen
   legacy build's output exactly, structure for structure. */
import test from "node:test";
import assert from "node:assert/strict";
import { legacy, built, norm } from "./helpers/compare.mjs";
import { makePdf, SUMMARY_LINES, DETAIL_LINES } from "./helpers/synth.mjs";

function pdfs(ctx) {
  return [makePdf(SUMMARY_LINES, ctx.fflate), makePdf(DETAIL_LINES, ctx.fflate)];
}

test("pdfText is unchanged", () => {
  const L = legacy(), N = built();
  for (const lines of [SUMMARY_LINES, DETAIL_LINES]) {
    const pdf = makePdf(lines, L.fflate);
    assert.equal(N.GENIUS.pdfText(pdf), L.GENIUS.pdfText(pdf));
  }
});

test("parseSummary / parseDetail are unchanged", () => {
  const L = legacy(), N = built();
  const sumTxt = L.GENIUS.pdfText(makePdf(SUMMARY_LINES, L.fflate));
  const detTxt = L.GENIUS.pdfText(makePdf(DETAIL_LINES, L.fflate));
  assert.deepEqual(norm(N.GENIUS.parseSummary(sumTxt)), norm(L.GENIUS.parseSummary(sumTxt)));
  assert.deepEqual(norm(N.GENIUS.parseDetail(detTxt)), norm(L.GENIUS.parseDetail(detTxt)));
});

test("stop collapsing and berth boundaries are unchanged", () => {
  const L = legacy(), N = built();
  const det = L.GENIUS.parseDetail(L.GENIUS.pdfText(makePdf(DETAIL_LINES, L.fflate)));
  for (const [, diags] of det) {
    for (const [diag, raw] of diags) {
      const sL = L.GENIUS._stopsOf(raw), sN = N.GENIUS._stopsOf(raw);
      assert.deepEqual(norm(sN), norm(sL), diag + " stops");
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
  assert.deepEqual(norm(resN.secsByDay), mirrorAscSections(norm(resL.secsByDay)),
    "mainline sections (lowest-Position-first sections mirrored, rest identical)");
  assert.deepEqual(norm(resN.metroSecs), norm(resL.metroSecs), "metro sections");
  assert.deepEqual(norm(resN.hsSecs), norm(resL.hsSecs), "high speed sections");
  assert.deepEqual(norm(resN.labels), norm(resL.labels), "labels");
  assert.deepEqual(norm(resN.review), norm(resL.review), "review list");
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
  // Together the per-book lists are exactly the combined list.
  assert.deepEqual(
    norm([...res.reviews.main, ...res.reviews.metro, ...res.reviews.hs]
      .map(x => x.msg).sort()),
    norm([...res.review].sort()),
    "partition covers the combined list");
});

test("warnings carry their section, and the Ramsgate cut works", async () => {
  const N = built();
  const res = await N.GENIUS.build(pdfs(N));
  const fav = res.reviews.main.find(x => /suppressed: FAVERSHAM/.test(x.msg));
  assert.equal(fav.sec, "FAVERSHAM", "suppression tagged with its section");
  const ramItem = res.reviews.main.find(x => /suppressed: RAMSGATE/.test(x.msg));
  assert.equal(ramItem.sec, "RAMSGATE", "Ramsgate suppression tagged");
  const bel = res.reviews.metro.find(x => /Belvedere/.test(x.msg));
  assert.equal(bel.sec, "BELVEDERE", "auto-section tagged with its section");
  // The Ramsgate card's filter: RAMSGATE items and general items only.
  const ram = res.reviews.main.filter(x => !x.sec || x.sec === "RAMSGATE");
  assert.ok(ram.some(x => /suppressed: RAMSGATE/.test(x.msg)),
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
  assert.deepEqual(norm(csvRes.secsByDay), norm(pdfRes.secsByDay), "mainline sections");
  assert.deepEqual(norm(csvRes.metroSecs), norm(pdfRes.metroSecs), "metro sections");
  assert.deepEqual(norm(csvRes.hsSecs), norm(pdfRes.hsSecs), "high speed sections");
  assert.deepEqual(norm(csvRes.labels), norm(pdfRes.labels), "labels");
  assert.equal(csvRes.tag, pdfRes.tag, "tag");
  assert.deepEqual(norm(csvRes.reviews), norm(pdfRes.reviews), "review lists");
});

test("the Genius CSV exports build the same books as the PDFs", async () => {
  const N = built();
  const { geniusSummaryCsv, geniusDetailCsv } = await import("./helpers/synth.mjs");
  const pdfRes = await N.GENIUS.build(pdfs(N));
  const csvRes = await N.GENIUS.build([geniusSummaryCsv(), geniusDetailCsv()]);
  assert.deepEqual(norm(csvRes.secsByDay), norm(pdfRes.secsByDay), "mainline sections");
  assert.deepEqual(norm(csvRes.metroSecs), norm(pdfRes.metroSecs), "metro sections");
  assert.deepEqual(norm(csvRes.hsSecs), norm(pdfRes.hsSecs), "high speed sections");
  assert.deepEqual(norm(csvRes.labels), norm(pdfRes.labels), "labels");
  assert.equal(csvRes.tag, pdfRes.tag, "tag");
  // and either report pairs with the other: a PDF summary with a CSV detail
  const mixed = await N.GENIUS.build(
    [makePdf(SUMMARY_LINES, N.fflate), geniusDetailCsv()]);
  assert.deepEqual(norm(mixed.secsByDay), norm(pdfRes.secsByDay), "mixed pair");
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
  assert.ok(res.reviews.main.some(x =>
    /two units share a Position/.test(x.msg) &&
    /RM910/.test(x.msg) && /RM911/.test(x.msg)),
    "the tie is flagged rather than quietly guessed at");
});

test("mixed-format pairs are refused by the sniffers", () => {
  const N = built();
  assert.equal(N.GENIUS.sniffIntegrale("Code,Cov,Type,x,x,x,Position,First Train,y"), "sum");
  assert.equal(N.GENIUS.sniffIntegrale("Diagram Code,Diagram Date,Notes,Start Tiploc"), "det");
  assert.equal(N.GENIUS.sniffIntegrale("some,other,csv"), null);
});

test("a late evening move only keeps the berth inside its own area", async () => {
  const N = built();
  const { LATE_MOVE_SUMMARY, LATE_MOVE_DETAIL } = await import("./helpers/synth.mjs");
  const res = N.GENIUS.buildIntegrale([LATE_MOVE_SUMMARY, LATE_MOVE_DETAIL]);
  const one = sec => {
    const list = res.secsByDay.M.get(sec);
    assert.ok(list && list.length, sec + " built");
    return list;
  };
  // shunted out of the shed to Hastings for the night: still a shed unit
  assert.equal(norm(one("WEST MARINA")[0].units[0].pm), "XSE",
    "St Leonards shed keeps its unit");
  // run off the east sidings to the Folkestone Train Roads: gone home
  assert.equal(norm(one("ASHFORD")[0].units[0].pm), "FKE",
    "Ashford east sidings hand theirs to Folkestone");
  // and the same shape across to Grove Park
  const sg = one("SLADE GREEN");
  assert.equal(norm(sg[0].units[0].pm), "GPD", "Slade Green hands its unit over");
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
  // they run as one train to Maidstone East and sit there together: the old
  // stint-end test saw no split at all
  assert.equal(norm(flagOf("971")), "SPLITS", "parting at 18 12");
  assert.equal(norm(flagOf("973")), "SPLITS PM", "parting at 20 55");
  assert.equal(norm(flagOf("975")), "", "never parting");
});

test("the Sectional Appendix checks flag a breach and stay quiet otherwise", async () => {
  const N = built();
  const S = await import("./helpers/synth.mjs");
  const bad = N.GENIUS.buildIntegrale(
    [S.APPENDIX_BREACH_SUMMARY, S.APPENDIX_BREACH_DETAIL]);
  const msgs = norm(bad.reviews.metro.map(x => x.msg));
  assert.ok(msgs.some(m => /12-car Networker must be three 4-car 465s/.test(m)),
    "the make-up is flagged: " + msgs.join(" | "));
  // …and an ordinary day trips none of them
  const ok = N.GENIUS.buildIntegrale(
    [S.REVERSED_ORDER_SUMMARY, S.REVERSED_ORDER_DETAIL]);
  const all = [].concat(ok.reviews.main, ok.reviews.metro, ok.reviews.hs)
    .map(x => x.msg);
  assert.ok(!all.some(m => /Networker|no route clearance|will not hold|lone 2-car/.test(m)),
    "nothing flagged on ordinary work: " + all.join(" | "));
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
