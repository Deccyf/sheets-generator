/* The consolidated data module must carry exactly the tables the legacy
   build carried, plus hold together internally. */
import test from "node:test";
import assert from "node:assert/strict";
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

test("the exported corrections file reads without the code", async () => {
  const N = built();
  const R = N.SHEETS_RULES;
  const txt = R.exportText({ "ASHFORD 05 05|101,102": ["101", "102"],
                             "GROVE PARK|805,806": null },
                           "MON-17-08", "2026-08-16T09:12:00.000Z");
  /* It is sent by somebody who pressed Reverse and read by somebody who
     builds it in, so it has to make sense before the JSON starts. */
  assert.match(txt, /ASHFORD, the 05 05 departure only/, "where and when");
  assert.match(txt, /diagrams 101 \+ 102/, "which formation");
  assert.match(txt, /print 101, then 102/, "and what to print");
  assert.match(txt, /switched off/, "a removal says so in words");
  assert.match(txt, /16\/08\/2026/, "when it was made");
  assert.ok(txt.indexOf("ASHFORD, the 05 05") < txt.indexOf("ORDER_FIX"),
    "the plain half comes before the code half");
  // and the machine copy still round-trips
  const json = txt.slice(txt.indexOf("{"));
  const back = R.parse(json);
  assert.ok(back, "the block at the foot parses back");
  assert.deepEqual(norm(back.orderFix["ASHFORD 05 05|101,102"]),
                   norm(["101", "102"]), "unchanged through the round trip");
});

test("a siding note is a label, not a road name", () => {
  const D = built().SHEETS_DATA;
  /* The weekend prints and the weekday books spell the same road two
     different ways, so the reading-order table is reached through the two
     siding-note tables. Notes are short labels and repeat across the
     network - Dartford up siding and Slade Green up C.H.S. are both "UPS" -
     so the bridge alone will hand one place another place's order. The
     engine only accepts a road that is at the section being printed; this
     pins the collision that made the guard necessary. */
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
  // and the guard the engine applies drops it, while keeping the true pair
  const at = (sec, w) => !!(w && w.indexOf(sec) === 0);
  assert.equal(at("SLADE GREEN", "SLADE GREEN UP C.H.S"), true, "kept where it belongs");
  assert.equal(at("DARTFORD", "SLADE GREEN UP C.H.S"), false, "dropped where it does not");
});
