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
