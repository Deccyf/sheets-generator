/* The berth-request road, stage one: the facts. A plan pasted from the
   Telex workbook, read against the weekday reports the books were built
   from - where each unit is, where it ends tonight, whether it calls where
   the plan wants it - and nothing decided. */
import test from "node:test";
import assert from "node:assert/strict";
import { built, norm } from "./helpers/compare.mjs";
import { geniusSummaryCsv, geniusSummaryCsvWithUnits, geniusDetailCsv }
  from "./helpers/synth.mjs";

const N = built();
const B = () => N.SHEETS_BERTH;
/* Monday 03/08/26, four units placed: 375601 on GT101 (Ashford to Dover,
   via Ashford twice), 375602 on GT102 (ends in the Ashford East sidings),
   375603+375604 as one formation on GT103 (Dover to Dover). Everyone else
   the plan names is not in traffic. */
const UNITS = { GT101: "375601.", GT102: "375602.", GT103: "375603, 375604." };
const weekday = async () => N.GENIUS.build([geniusSummaryCsvWithUnits(UNITS), geniusDetailCsv()]);
const PLAN = [
  "Exams", "Unit Nr \tExam\t\tWhere\tAction",
  "375601\tA\tTUE AM 04/08\tAFK\tAFK HOLD",           // tomorrow, calls at Ashford
  "375602\tB\tMON PM 03/08\tAFK\tENDS AFK",           // today, ends where wanted
  "375604\tC\tSAT AM 08/08\tRE\tENDS DVP",            // later, formation's second unit
  "375699\tA\tTUE AM 04/08\tRE\tSTOPPED RE",          // not in traffic
  "375698\tXS50\tASAP\tSG\tO/O/S GP",                 // out of service
  "", "Scheduled Maint", "Unit Nr \tWhere\tWhen\tFor\tAction",
  "375603\tRE\tAFTER 1250 MILES\tOIL CHANGE\tSTOPPED RE",
  "", "Defects", "Unit Nr \tDays\tPriority\tTarget Date\tAction ",
  "375601\t3\t2. Restriction MO\t04/08/2026 00:00:00\tRE HOLD",
  "375602\t1\t5. Performance Defect\t10/08/2026 15:56:00\tENDS XSE",
].join("\n");

test("the plan is read section by section, each with its own columns", () => {
  const p = B().parsePlan(PLAN);
  assert.equal(p.rows.length, 8);
  const by = Object.fromEntries(p.rows.map(r => [r.section + ":" + r.unit + ":" + r.line, r]));
  const exam = p.rows[0];
  assert.deepEqual(norm([exam.section, exam.unit, exam.what, exam.when, exam.where, exam.action]),
    ["EXAMS", "375601", "A", "TUE AM 04/08", "AFK", "AFK HOLD"]);
  const maint = p.rows.find(r => r.section === "SCHEDULED MAINT");
  assert.deepEqual(norm([maint.where, maint.when, maint.what]), ["RE", "AFTER 1250 MILES", "OIL CHANGE"]);
  const def = p.rows.find(r => r.section === "DEFECTS");
  assert.deepEqual(norm([def.days, def.what, def.when, def.where, def.isDefect, def.category]),
    [3, "2. Restriction MO", "04/08/2026 00:00:00", "RE", true, "MO"],
    "a 375's defect is wanted back at Ramsgate, and the priority is boiled down");
  // a defect's home is a matter of class
  const homes = B().parsePlan(["Defects", "Unit Nr \tDays\tPriority\tTarget Date\tAction ",
    "376017\t17\t2. Restriction MO\t24/09/2026 00:00:00\tENDS SG",
    "375302\t1\t4. EOD Safety Defect\t\tENDS GI",
    "377514\t5\t5. Performance Defect AMAT\t21/09/2026 00:00:00\tAFK HOLD FOR MON",
    "375908\t4\t3. Restriction NM MSE\t21/09/2026 05:28:00\tRE HOLD"].join("\n")).rows;
  assert.deepEqual(norm(homes.map(r => r.where)), ["SG/GI", "RE/AFK", "AFK", "RE"],
    "376 to Slade Green or Gillingham, 375/3 to Ramsgate or Ashford, 377 handed over at Ashford");
  assert.deepEqual(norm(homes.map(r => r.category)), ["MO", "EOD", "PERF", "NM"]);
  assert.deepEqual(norm(homes.map(r => [r.amat, r.mse])), [[false, false], [false, false], [true, false], [false, true]],
    "AMAT and MSE are read wherever they are written on the line");
  assert.deepEqual(norm(p.rows.find(r => r.unit === "375698").places), ["SG"]);
});

test("every way the plan writes a date is read, and a mileage trigger is not a date", () => {
  const w = B().whenOf, today = new Date(Date.UTC(2026, 7, 3));
  assert.equal(w("SAT AM 19/09", today).date.toISOString().slice(0, 10), "2026-09-19");
  assert.equal(w("SAT AM 19/09", today).half, "AM");
  assert.equal(w("EOD SUN 20/09", today).half, "EOD");
  assert.equal(w("20 00 THU 24/09", today).time, 20 * 60);
  assert.equal(w("AFTER AM PEAK MON 21/09", today).half, "AFTER AM PEAK");
  assert.equal(w("30/09/2026 00:00:00", today).date.toISOString().slice(0, 10), "2026-09-30");
  assert.equal(w("30/09/2026 00:00:00", today).time, null, "midnight is 'that day', not a time");
  assert.equal(w("21/09/2026 22:31:00", today).time, 22 * 60 + 31);
  assert.equal(w("ASAP", today).asap, true);
  assert.equal(w("AFTER 1,250 MILES", today).miles, 1250);
  assert.equal(w("AFTER 1250 MILES", today).date, null);
});

test("each line says where its unit is today, where it ends, and whether it calls where it is wanted", async () => {
  const res = await weekday();
  const out = B().run(PLAN, res, { ignore: "375698" });
  assert.equal(out.date, "03/08/26");
  assert.equal(out.units, 6); assert.equal(out.inTraffic, 4); assert.equal(out.ignored, 1);
  const row = (unit, section) => out.rows.find(r => r.unit === unit && r.section === section);
  // 375601 on GT101: Ashford sidings, Ashford twice, Charing Cross, Dover
  const a = row("375601", "EXAMS");
  assert.deepEqual(norm(a.diags), ["GT101"]);
  assert.equal(a.ends.place, "DVP");
  assert.equal(a.ends.time, 23 * 60 + 50);
  assert.equal(a.endsAtTarget, false);
  assert.ok(a.calls.some(c => c.place === "AFK" && c.arr === 5 * 60 + 35 && c.dep === 5 * 60 + 45 && c.hc === "2A01"),
    "the Ashford call, when it gets there and what it leaves on: " + JSON.stringify(a.calls));
  assert.ok(!a.calls.some(c => c.code === "ASHFDNS" && c.arr == null),
    "where it started the day is not a call");
  assert.ok(a.calls.some(c => c.code === "ASHFEBS" && c.stay === 200),
    "and a stand in the East sidings is a stand: " + JSON.stringify(a.calls));
  assert.equal(a.tier, 1, "due tomorrow is nearest");
  assert.equal(a.ahead, 1);
  // 375602 on GT102 ends in the Ashford East sidings, which IS Ashford
  const b = row("375602", "EXAMS");
  assert.equal(b.ends.place, "AFK"); assert.equal(b.endsAtTarget, true);
  assert.equal(b.ahead, 0, "today");
  // 375604 is the second unit of GT103's formation and is still found
  const c = row("375604", "EXAMS");
  assert.deepEqual(norm(c.diags), ["GT103"]); assert.equal(c.ends.place, "DVP");
  assert.equal(c.tier, 2, "Saturday is this week");
  // the mileage trigger and the far defect
  assert.equal(row("375603", "SCHEDULED MAINT").tier, 2);
  assert.equal(row("375602", "DEFECTS").tier, 3, "a week out is later");
  // not in traffic, and out of service
  assert.equal(row("375699", "EXAMS").inTraffic, false);
  assert.equal(row("375698", "EXAMS").ignored, true);
  // nearest first, and the plan's order inside a tier
  // four exam lines and the defect due tomorrow, then Saturday's exam and
  // the mileage trigger, then the defect a week out
  assert.deepEqual(norm(out.rows.map(r => r.tier)), [1, 1, 1, 1, 1, 2, 2, 3]);
});

test("the table reads as the plan does, with the plan's own action beside the facts", async () => {
  const res = await weekday();
  const text = B().render(B().run(PLAN, res, { ignore: "375698" }));
  const line = u => text.split("\n").find(l => l.startsWith(u));
  /* the arrival at each Ashford call, marked empty where it came in empty,
     the stand in the East sidings said as one, and what it leaves on */
  assert.match(line("375601"), /TUE 04\/08 AM \(tomorrow\)\s+AFK HOLD\s+on GT101 · ENDS DVP 23\+50 · calls AFK 05\+35 off 2A01, AFK 10 30 off 5A03, AFK 10\+40 \(stands 3\.3 h\) off 5A05, AFK 14\+05 off 2A06$/,
    line("375601"));
  assert.match(line("375602"), /MON 03\/08 PM \(today\)\s+ENDS AFK\s+on GT102 · ENDS AFK 22\+40 · ends where it is wanted$/);
  assert.match(line("375699"), /STOPPED RE\s+not in traffic today$/);
  assert.match(line("375698"), /ASAP\s+O\/O\/S GP\s+O\/O\/S — ignored$/);
  assert.match(text.split("\n").filter(l => l.startsWith("375601")).pop(), /RE HOLD\s+on GT101 · ENDS DVP 23\+50 · does not call at RE today  \[MO\]$/,
    "the defect line carries its category");
  assert.match(line("375603"), /after 1250 mi/);
  assert.match(text, /== NEXT: today, tomorrow, ASAP and overdue ==[\s\S]*== THIS WEEK[\s\S]*== LATER/);
});

test("a Summary printed before allocation is named as the reason nothing is placed", async () => {
  const res = await N.GENIUS.build([geniusSummaryCsv(), geniusDetailCsv()]);
  const out = B().run(PLAN, res, {});
  assert.equal(out.inTraffic, 0);
  assert.match(out.reviews[0], /no units on it — it was printed before the day was allocated/);
});
