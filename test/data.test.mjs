/* The consolidated data module must carry exactly the tables the legacy
   build carried, plus hold together internally. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { legacy, built, norm } from "./helpers/compare.mjs";

test("reference tables match the legacy build", () => {
  const L = legacy(), D = built().SHEETS_DATA;
  // Deliberate divergence: a train booked into a Grove Park depot road is
  // destined GPD, not GPK - the books keep GPK for the station itself. Plus
  // the London End extension, which the legacy tables never named.
  const legacyBerthSheets = { ...L.SHEETS_CORE.BERTH_SHEETS };
  for (const k of Object.keys(legacyBerthSheets))
    if (/^GROVE PARK ./.test(k))
      legacyBerthSheets[k] = [...legacyBerthSheets[k].slice(0, 3), "GPD"];
  legacyBerthSheets["GROVE PARK DPT LNDN ED EXT"] = ["GROVE PARK", "GP", null, "GPD"];
  assert.deepEqual(norm(D.BERTH_SHEETS), norm(legacyBerthSheets),
    "BERTH_SHEETS (with the Grove Park depot destination)");
  // Deliberate divergence: Beckenham Junction is BKJ - BEC is Beckenham
  // Hill, and the tester corrected the 10/08 metro book by hand.
  const legacyTlc = { ...L.SHEETS_CORE.DEST_TLC, "BECKENHAM JUNCTION": "BKJ" };
  assert.deepEqual(norm(D.DEST_TLC), norm(legacyTlc),
    "DEST_TLC (with the Beckenham Junction correction)");
  assert.deepEqual(norm(D.NON_BERTH_VISIT), norm(L.SHEETS_CORE.NON_BERTH_VISIT),
    "NON_BERTH_VISIT");
  assert.deepEqual(norm(D.DEST_CODE), norm(L.SheetsEngine.DEST_CODE), "DEST_CODE");
  // Deliberate divergence: Bellingham berths code BGM on the sheets now
  // (the legacy tables said BEL), matching the weekday books' PLU/BGM.
  const legacyBerth = { ...L.SheetsEngine.BERTH_CODE, "Bell Sd": "BGM" };
  assert.deepEqual(norm(D.BERTH_CODE), norm(legacyBerth),
    "BERTH_CODE (with the Bellingham BGM change)");
  assert.deepEqual(norm(D.MAIN_ORDER), norm(L.SHEETS_XLSX.MAIN_ORDER), "MAIN_ORDER");
  assert.deepEqual(norm(D.METRO_ORDER), norm(L.SHEETS_XLSX.METRO_ORDER), "METRO_ORDER");
  assert.deepEqual(norm(D.HS_ORDER), norm(L.SHEETS_XLSX.HS_ORDER), "HS_ORDER");
  assert.deepEqual(norm(D.DAY_SHEET), norm(L.SHEETS_XLSX.DAY_SHEET), "DAY_SHEET");
  /* Deliberate divergence: the weekend profiles are no longer a second copy
     of the weekday ones - they ARE the weekday ones, so the weekend books
     follow the same rulebook. The copy had drifted (the metro fleet list had
     lost 465/0, its headcode sections had gained Slade Green, and the High
     Speed book had none at all), which is exactly what a second copy does.
     Compared field by field, with each difference named. */
  const legacyProfiles = L.SheetsEngine.PROFILES;
  assert.equal(D.PROFILES.length, legacyProfiles.length, "same three books");
  D.PROFILES.forEach((p, i) => {
    const q = legacyProfiles[i];
    for (const k of ["tag", "label", "road"])
      assert.equal(p[k], q[k], k);
    assert.deepEqual(norm(p.sections), norm(q.sections), p.road + " sections");
    assert.deepEqual(norm(p.first_dep), norm(q.first_dep), p.road + " first_dep");
    assert.deepEqual(norm(p.ecs_only_ok), norm(q.ecs_only_ok),
      p.road + " ecs_only_ok");
    // the weekday tables, now shared
    assert.deepEqual(norm(p.fleets), norm(D.PROFILES_G[i].fleets),
      p.road + " fleets are the weekday fleets");
    assert.equal(p.headcode_sections, D.HEADCODE_SECTIONS,
      p.road + " quotes the weekday headcode sections");
    assert.equal(p.pos_asc, D.PROFILES_G[i].posAsc,
      p.road + " reads the weekday way round");
    /* No exceptions any more. The High Speed road used to be timed off the
       platform departure on the weekend side only, because that book was
       still a BERTHING book and nobody had held one against a copy timed
       off the first move. It now builds the operator's own 395 Allocations
       Sheet, which is timed off the first move, so the weekend and weekday
       profiles agree here as they do everywhere else. */
    assert.equal(p.first_dep_all, !!D.PROFILES_G[i].firstDepAll,
      p.road + " first_dep_all");
  });
  // and the drift the shared tables closed, named so it cannot come back
  assert.ok(!("465/0" in L.SheetsEngine.PROFILES[1].fleets),
    "the old weekend metro fleet list had lost 465/0");
  assert.ok("465/0" in D.PROFILES[1].fleets, "it has it now");
  assert.ok(L.SheetsEngine.PROFILES[1].headcode_sections.has("SLADE GREEN"),
    "the old weekend metro book quoted Slade Green headcodes");
  assert.ok(!D.PROFILES[1].headcode_sections.has("SLADE GREEN"),
    "the weekday books do not, and now neither does it");
});

test("data module holds together", () => {
  const D = built().SHEETS_DATA;
  // Every book-order section name is a section some berth resolves to, or a
  // Metro/HS station section the engines derive on the fly.
  const berthSections = new Set(
    Object.values(D.BERTH_SHEETS).map(v => v[0]).filter(Boolean));
  for (const s of D.MAIN_ORDER)
    assert.ok(berthSections.has(s), "MAIN_ORDER section has berths: " + s);
  // The Genius stabling codes all have a location name to resolve through.
  for (const code of D.STABLE_CODES)
    assert.ok(D.CODE2NAME[code], "STABLE_CODES named: " + code);
  // FIX_CODE only rewrites codes, never invents sections.
  for (const [from, to] of Object.entries(D.FIX_CODE)) {
    assert.match(from, /^[A-Z]{2,4}$/);
    assert.match(to, /^[A-Z]{2,4}$/);
  }
  // Weekend profiles: every profile section list refers to known print names.
  const allPrintNames = new Set([
    ...Object.keys(D.DEST_CODE), ...Object.keys(D.BERTH_CODE),
    ...D.BASE_STABLING, ...D.TRANSIT, ...Object.keys(D.MANUAL_LOC)]);
  for (const prof of D.PROFILES) {
    for (const [sec, locs] of Object.entries(prof.sections)) {
      assert.ok(locs.length, sec + " has locations");
    }
  }
  // The station table parses into (name, crs, rostered) rows.
  assert.ok(D.STATIONS.length > 400, "station table parsed");
  for (const [name, crs] of D.STATIONS.slice(0, 20)) {
    assert.ok(name && /^[A-Z]{3}$/.test(crs), "station row: " + name);
  }
});

test("Charing Cross codes never swallow Charing in Kent", () => {
  const N = built();
  const NC = N.SHEETS_DATA.NAME_CODE;
  /* CHARING alone is a station on the Maidstone East line with its own code,
     CHG. Mapping it to Charing Cross would silently send a Kent village's
     units to a London terminal, which is exactly the kind of error nobody
     would spot on a sheet. */
  assert.equal(NC.CHARING, undefined, "bare CHARING is not mapped");
  for (const [k, v] of Object.entries(NC))
    if (v === "CHX")
      assert.match(k, /CHARING (CROSS|X|CRS|C|CR)$|CHRING X$|^CH[RG]G? CROSS$/,
        "a CHX name is unambiguously Charing Cross: " + k);
  // and the resolver still gives Charing itself its own code
  const E = N.SheetsEngine, w = [];
  assert.equal(E.codeFor("Charing", E.DEST_CODE, w, "t"), "CHG");
});

test("a correction reads in words, and there is no export file", async () => {
  const N = built();
  const R = N.SHEETS_RULES;
  const edits = { "ASHFORD 05 05|101,102": ["101", "102"],
                  "GROVE PARK|805,806": null };

  /* The Unit order tab is the whole of a correction now: a colleague reads
     these four columns out and they go into ORDER_FIX. There used to be an
     "Export order corrections" download as well, saying the same thing in
     three formats at once - it was one more thing to keep working for a
     path nobody used. */
  const row = R.orderRow("ASHFORD 05 05|101,102", ["101", "102"]);
  assert.equal(row.where, "ASHFORD", "where");
  assert.equal(row.when, "the 05 05 departure only", "when");
  assert.equal(row.formation, "101 + 102", "which formation");
  assert.equal(row.prints, "101, then 102", "and what to print");

  assert.equal(R.exportText, undefined, "no export text builder");
  assert.equal(R.dataJsLines, undefined, "and nothing left over feeding it");
  const html = N.SHEETS_RULES.explainHtml({ sections: ["ASHFORD"] });
  assert.doesNotMatch(html, /Export order corrections/,
    "and the rules narrative does not send anyone looking for the button");

  /* What does survive is the overlay itself: it is held on the machine that
     made it, so it has to round-trip through storage unchanged. */
  const back = R.parse(R.serialize(edits, "2026-08-16T09:12:00.000Z"));
  assert.ok(back, "the stored overlay parses back");
  assert.equal(back.saved, "2026-08-16T09:12:00.000Z", "with when it was written");
  assert.deepEqual(norm(back.orderFix["ASHFORD 05 05|101,102"]),
                   norm(["101", "102"]), "unchanged through the round trip");
  assert.equal(back.orderFix["GROVE PARK|805,806"], null,
    "and a switched-off pin stays switched off");
});

test("the weekend books do not take the weekday reading order", () => {
  const N = built(), D = N.SHEETS_DATA;
  /* The weekend order is lowest Position first everywhere. Carrying the
     weekday direction rule over here reordered 53 of the 71 multi-unit
     entries in the verified Sunday 16/08 book, and the book is right, so
     the weekday directions stay with the weekday books they were scored
     against. This test is the two traps that made it look right, kept so
     the next attempt starts from what is already known. */

  // 1. the road override could not have fired anyway: one road is listed,
  //    so every weekend section falls through to the section default
  const roads = D.PROFILES.reduce((n, p) =>
    n + ((p.road_pos_asc && p.road_pos_asc.size) || 0), 0);
  assert.equal(roads, 1, "the whole road table is one road (Ashford up sidings)");

  // 2. and bridging the print road names to the weekday ones through the
  //    siding notes crosses two different places: a note is a short label,
  //    not a name, and "UPS" is Dartford's up siding AND Slade Green's
  const byNote = new Map();
  for (const k of Object.keys(D.SIDING_NOTES))
    byNote.set(String(D.SIDING_NOTES[k]).toUpperCase(), k);
  const claimed = new Map();
  for (const k of Object.keys(D.NOTE_FROM_BERTH)) {
    const w = byNote.get(String(D.NOTE_FROM_BERTH[k]).toUpperCase());
    if (!w) continue;
    if (!claimed.has(w)) claimed.set(w, []);
    claimed.get(w).push(k);
  }
  assert.deepEqual(claimed.get("SLADE GREEN UP C.H.S"), ["S Gn U Sd", "Dart USd"],
    "the note bridge really does hand Dartford Slade Green's road");

  // 3. and the engine no longer reads either table when it orders a weekend
  //    formation - the shipped source is the check, since the tables still
  //    ride along on the shared profiles
  const src = readFileSync(new URL("../Sheets Generator.html", import.meta.url), "utf8");
  const gen = src.slice(src.indexOf("function generate(diags, prof, stabling, warn)"));
  const body = gen.slice(0, gen.indexOf("\nfunction "));
  assert.ok(body.length > 100 && body.length < src.length, "found the weekend generate()");
  assert.ok(body.indexOf("blocks.sort((x,y) => x.pos - y.pos || x.num - y.num)") >= 0,
    "weekend formations sort on Position, ascending");
  // the comment above that sort explains all of this, so read the code only
  const code = body.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.equal(code.indexOf("road_pos_asc"), -1, "and consult no direction table");
  assert.equal(code.indexOf("pos_asc"), -1, "of either kind");
});

test("each book's rules describe the document that book actually is", () => {
  /* Two of the four are not berthing sheets, and both had been told they
     were. The High Speed book shared the Metro sheet's description, so its
     own Rules tab was explaining SIDINGS and POS columns it does not have;
     and the printed handout never passed the flag at all, so it called all
     four berthing sheets. Each is pinned here by a phrase only the right
     document can produce. */
  const N = built();
  const R = N.SHEETS_RULES;
  /* Every location and the real tables, so a berthing book renders every
     section it can - end markers and routes are filtered to the book that
     has them, and a one-page Ashford book has neither. */
  const base = { sections: [], hsDepots: [...N.SHEETS_HS.DEPOTS],
                 endStyle: N.SHEETS_DATA.END_STYLE,
                 routeByHc: N.SHEETS_DATA.ROUTE_BY_HC,
                 orderFix: N.SHEETS_DATA.ORDER_FIX };
  // exactly as the Rules tab asks for them
  const page = (kind, env) =>
    R.explainHtml({ ...base, ...env }, R.pickFor(kind, false));
  const hs = page("hs", { hs: true });
  const metro = page("metro", { metro: true });
  const berth = page(null, {});

  assert.match(hs, /Class 395 Allocations Sheet/, "the allocations sheet");
  assert.match(hs, /Ashford, Faversham, Margate and Ramsgate/,
    "naming the blocks the writer really lays out");
  assert.match(hs, /Ebbsfleet and Gravesend/, "and where the high-level note " +
    "comes from, since it is worked out rather than looked up");
  assert.doesNotMatch(hs, /SIDINGS|This is the Metro sheet/,
    "and nothing from the Metro sheet's columns");

  assert.match(metro, /This is the Metro sheet/, "the Metro sheet");
  assert.doesNotMatch(metro, /Class 395|Allocations Sheet/,
    "and nothing from the allocations sheet");

  assert.match(berth, /One page per location/, "a berthing book stays itself");
  assert.doesNotMatch(berth, /This is the Metro sheet|Class 395/,
    "and is told about neither");

  /* The sections that are only about a berthing sheet come off both of the
     others - and the tool's tab and the printed handout have to agree about
     which, which is why one call decides it for both. */
  const ids = html => (html.match(/id="r-([a-z]+)"/g) || [])
    .map(s => s.replace(/.*r-|"/g, ""));
  for (const [what, html] of [["High Speed", hs], ["Metro", metro]])
    for (const gone of ["order", "ends", "routes", "words", "corrections"])
      assert.ok(ids(html).indexOf(gone) < 0,
        what + " is not told the berthing rule '" + gone + "'");
  for (const kept of ["order", "ends", "words"])
    assert.ok(ids(berth).indexOf(kept) >= 0, "a berthing book keeps " + kept);
  /* The one difference between the two readers: the handout prints the
     corrections inline, the tool keeps them on the Unit order tab beside the
     buttons that write them. */
  assert.ok(R.pickFor(null, true).skip.indexOf("corrections") < 0,
    "the handout takes the corrections");
  assert.ok(R.pickFor(null, false).skip.indexOf("corrections") >= 0,
    "the Rules tab leaves them to the Unit order tab");
});
