/* The diagram analyser: day codes, berths, coupling, mileage and the
   week's joins. Every fixture here is invented — nothing in this repo may
   carry real planning data. */
import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { loadSandbox } from "./helpers/sandbox.mjs";
import { FLEET_LINES as lines } from "./helpers/synth.mjs";

const ANALYSER = fileURLToPath(new URL("../Diagram Analyser.html", import.meta.url));
const ctx = loadSandbox(ANALYSER);
const { FLEET: F, FLEET_PRINTS: FP, FLEET_REPORT: R, FLEET_XLSX: X,
        SHEETS_PRINTS: P } = ctx;

/* Arrays made inside the sandbox have that realm's Array.prototype, so a
   strict deep-equal fails on the prototype alone. Copy before comparing. */
const arr = x => Array.from(x);

const DS = FP.parsePrints(lines);
const byKey = k => DS.find(d => d.key === k);

test("a diagram that never moves is kept, and marked as standing still", () => {
  assert.equal(DS.length, 7);
  assert.equal(byKey("XX106").stabled, true);
  assert.equal(byKey("XX101").stabled, false);
});

test("the columns the berthing sheets throw away are kept", () => {
  const d = byKey("XX101");
  assert.equal(d.days, "FSX");
  assert.equal(d.fleet, "375/6");
  assert.equal(d.from, "01/06/2026");
  assert.equal(d.until, "31/12/2026");
  assert.equal(d.totalMiles, 180);
  assert.equal(d.rows[0].miles, 0.5);
  assert.equal(d.rows[0].form, "101(1)\\102(2)");
});

test("day codes: FSX is the weekday book, and Th is read before T", () => {
  assert.deepEqual(arr(F.daysOf("FSX")), ["Mon", "Tue", "Wed", "Thu"]);
  assert.deepEqual(arr(F.daysOf("MO")), ["Mon"]);
  assert.deepEqual(arr(F.daysOf("ThO")), ["Thu"]);
  assert.deepEqual(arr(F.daysOf("TO")), ["Tue"]);
  assert.deepEqual(arr(F.daysOf("MWThO")), ["Mon", "Wed", "Thu"]);
  assert.deepEqual(arr(F.daysOf("Su")), ["Sun"]);
  assert.deepEqual(arr(F.daysOf("FO")), ["Fri"]);
  assert.deepEqual(arr(F.daysOf("SO")), ["Sat"]);
});

test("MO as a day code is spelt out, never left to be read as a restriction", () => {
  assert.equal(F.daysLabel("MO"), "Mon only");
  assert.equal(F.daysLabel("FSX"), "Mon–Thu");
});

test("the clock rolls past midnight rather than wrapping to the morning", () => {
  const d = F.roll(byKey("XX102"));
  const end = F.endsAt(d);
  /* 00.20 after a 05.30 start is twenty past midnight the NEXT day. Wrapped,
     it would read as 00:20 and sort ahead of everything else in the day. */
  assert.equal(end.t, 24 * 60 + 20);
  assert.equal(F.hm(end.t), "24:20");
});

test("a berth is an arrival paired with the next departure, not one line", () => {
  const d = F.roll(byKey("XX101"));
  const bs = F.berthsOf(d);
  const stand = bs.find(b => b.loc === "Home Dep" && b.from === 10 * 60 + 30);
  assert.ok(stand, "the mid-day stand at the depot was not found");
  /* arrives 10.30 on one line, leaves 16.00 on the next: five and a half
     hours, which is the whole point of the section that uses it. */
  assert.equal(stand.mins, 330);
  assert.equal(bs[bs.length - 1].last, true);
});

test("a restricted unit can only take a diagram coupled on every leg", () => {
  assert.equal(F.moCapable(F.roll(byKey("XX101"))), true);
  /* 102 detaches and finishes alone; 103 is never coupled at all. */
  assert.equal(F.moCapable(F.roll(byKey("XX102"))), false);
  assert.equal(F.moCapable(F.roll(byKey("XX103"))), false);
  assert.deepEqual(arr(F.coupling(F.roll(byKey("XX101"))).partners), ["102"]);
});

test("splits are found where the diagram comes apart", () => {
  assert.deepEqual(arr(F.splitsOf(byKey("XX102")).map(s => s.loc)), ["Far Stn"]);
  assert.deepEqual(arr(F.splitsOf(byKey("XX101")).map(s => s.loc)), []);
});

test("a fleet is taken off the Fleet line, not off the diagram prefix", () => {
  /* Every diagram here is prefixed XX; only the Fleet line separates them,
     which is exactly the case with SG covering 376 and the Metro classes. */
  assert.equal(F.fleetOf(byKey("XX101")), "375");
  assert.equal(F.fleetOf(byKey("XX201")), "377");
});

const MONDAY = Date.UTC(2026, 7, 24);      // a Monday inside the validity

test("only the diagrams in force on the day are counted", () => {
  const a = F.analyse(DS, "375", { monday: MONDAY });
  /* Monday: the four FSX diagrams plus the Mondays-only one. Not Thursday's. */
  assert.deepEqual(arr(a.day.map(d => d.key)).sort(),
    ["XX101", "XX102", "XX103", "XX104", "XX106"]);
  assert.equal(a.still.length, 1);
  assert.equal(a.work.length, 4);
});

test("mileage is measured over a week, so a re-issue cannot count twice", () => {
  /* The same diagram printed for two validity periods - what an engineering
     period does to a book. Counting the printed diagrams would double it. */
  const reissued = DS.concat(FP.parsePrints([
    "Diagram:\tXX\t101\tFSX",
    "Fleet:\t375/6",
    "From:\t01/01/2026\tUntil:\t31/05/2026",
    "\t\tHome Dep\t\t05.30\t5A01\t\t0.5\t101(1)\\102(2)",
    "\t\tHome Dep\t23.40\t\t\t\t180.0\t",
    "Total miles:\t180.0",
  ]));
  const a = F.analyse(reissued, "375", { monday: MONDAY });
  assert.equal(a.dupes.length, 0, "the out-of-date printing was counted as well");
  /* Mon-Thu: 101+102+103 = 420 a day, plus 104's 70 on the Monday, plus
     105's 50 on the Thursday. */
  assert.equal(a.perDay.Mon.miles, 490);
  assert.equal(a.perDay.Tue.miles, 420);
  assert.equal(a.perDay.Thu.miles, 470);
  assert.equal(a.perDay.Sat.miles, 0);
  assert.equal(a.weekly, 490 + 420 + 420 + 470);
  assert.equal(Math.round(a.annual), Math.round(a.weekly * 365.25 / 7));
});

test("a place with no coupled diagram out of it cannot contain a restriction", () => {
  const a = F.analyse(DS, "375", { monday: MONDAY });
  const out = a.containment.find(r => r.loc === "Out Sdg");
  assert.ok(out, "Out Sdg was not seen as a starting point");
  assert.equal(out.ok, 0, "Out Sdg should have nothing coupled leaving it");
  const home = a.containment.find(r => r.loc === "Home Dep");
  assert.ok(home.ok > 0, "Home Dep has a coupled diagram and should say so");
});

test("the week's joins say where units have to be moved", () => {
  const wk = F.week(DS, "375", MONDAY);
  assert.equal(wk.length, 7);
  assert.deepEqual(arr(wk.map(x => x.from)), arr(F.DAYS));
  /* Mon -> Tue drops the Mondays-only diagram, so its finishing place is
     left with a unit nothing takes up. */
  const monTue = wk[0];
  assert.ok(monTue.b.moved > 0);
  /* Fri has no diagrams at all here, so nothing can start on Saturday. */
  assert.equal(wk[4].b.today, 0);
});

test("home, and everywhere the fleet can be repaired, are settings", () => {
  const base = F.analyse(DS, "375", { monday: MONDAY });
  assert.equal(base.cfg.home, "Ramsgate");
  const moved = F.analyse(DS, "375",
    { monday: MONDAY, "375": { home: "Ashford", repair: ["Ashford", "Ramsgate"] } });
  assert.equal(moved.cfg.home, "Ashford");
  assert.deepEqual(arr(moved.cfg.repair), ["Ashford", "Ramsgate"]);
});

test("the report answers all seven questions and the workbook matches it", () => {
  const rep = R.build(DS, "375", { monday: MONDAY });
  assert.deepEqual(arr(rep.secs.map(s => s.id)),
    ["arrivals", "early", "mo", "cycle", "miles", "stands", "contain"]);
  for (const s of rep.secs){
    assert.ok(s.tab && s.tab.length <= 31, s.id + " needs a short tab name");
    assert.ok(s.head.length, s.id + " has no headings");
    for (const r of s.rows)
      assert.equal(r.length, s.head.length, s.id + " row is the wrong width");
  }
  const sheets = R.sheets(rep);
  const names = sheets.map(s => s.name);
  assert.equal(new Set(names).size, names.length, "two tabs share a name");
  for (const n of names) assert.ok(n.length <= 31 && !/[\\\/\?\*\[\]:]/.test(n), n);
  /* Every question on screen is a tab, and the last one lists the lot. */
  assert.ok(names.includes("Restricted units"));
  assert.ok(names.includes("All diagrams"));
  assert.equal(sheets.find(s => s.name === "All diagrams").rows.length,
               rep.a.day.length + 1);
});

test("the workbook is a real zip Excel will open", () => {
  const rep = R.build(DS, "375", { monday: MONDAY });
  const bytes = X.writeWorkbook(R.sheets(rep), f => ctx.fflate.zipSync(f, { level: 6 }));
  assert.ok(bytes.length > 500);
  const files = ctx.fflate.unzipSync(bytes);
  for (const need of ["[Content_Types].xml", "_rels/.rels", "xl/workbook.xml",
                      "xl/styles.xml", "xl/worksheets/sheet1.xml"])
    assert.ok(files[need], "the workbook is missing " + need);
  const s1 = ctx.fflate.strFromU8(files["xl/worksheets/sheet1.xml"]);
  assert.ok(s1.indexOf('<c r="A1" s="1" t="inlineStr"><is><t xml:space="preserve">Diagram') !== -1,
    "the heading row is not written as a bold inline string");
  /* Numbers must be numbers, or Excel will not add them up. */
  assert.match(ctx.fflate.strFromU8(files["xl/worksheets/sheet5.xml"]), /<c r="B2"><v>/);
});

test("tab names are made safe and never collide", () => {
  const bytes = X.writeWorkbook([
    { name: "A/B?C*D[E]F", rows: [["x"]] },
    { name: "same name here", rows: [["x"]] },
    { name: "same name here", rows: [["x"]] },
  ], f => ctx.fflate.zipSync(f, { level: 0 }));
  const wb = ctx.fflate.strFromU8(ctx.fflate.unzipSync(bytes)["xl/workbook.xml"]);
  assert.match(wb, /name="A-B-C-D-E-F"/);
  assert.match(wb, /name="same name here"/);
  assert.match(wb, /name="same name here \(2\)"/);
});

test("both tools read the prints through the one reader", () => {
  /* The berthing sheets and the analyser must never drift apart on what
     counts as a printable file. */
  assert.equal(typeof P.readPrints, "function");
  assert.equal(P.looksLikePrints(lines.join("\n")), true);
  assert.equal(P.looksLikePrints("nothing like a diagram print"), false);
});
