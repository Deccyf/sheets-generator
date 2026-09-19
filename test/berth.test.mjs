/* The berth-request road: the maintenance plan pasted from the Telex
   workbook, read against the weekday reports the books were built from -
   where each unit is, where it ends tonight, whether it calls where the
   plan wants it, whether its diagram splits - and the depot's own rules
   applied to that, in the depot's own words, beside whatever the planner
   wrote. */
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
/* The same plan with the Action column empty, which is how a planner asks
   for suggestions. */
const BLANK = PLAN.split("\n").map(l => /^\d{6}\t/.test(l) ? l.replace(/\t[^\t]*$/, "\t") : l).join("\n");

test("the plan is read section by section, each with its own columns", () => {
  const p = B().parsePlan(PLAN);
  assert.equal(p.rows.length, 8);
  assert.deepEqual(norm(p.order), ["EXAMS", "SCHEDULED MAINT", "DEFECTS"], "the sections, in the order pasted");
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
  assert.deepEqual(norm(homes.map(r => r.where)), ["SG/GI", "RE/GI", "VIC", "RE"],
    "376 to Slade Green or Gillingham, 375/3 to Ramsgate or Gillingham, 377 to Victoria for Selhurst");
  assert.deepEqual(norm(homes.map(r => r.category)), ["MO", "EOD", "PERF", "NM"]);
  assert.deepEqual(norm(homes.map(r => [r.amat, r.mse])), [[false, false], [false, false], [true, false], [false, true]],
    "AMAT and MSE are read wherever they are written on the line");
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
  assert.ok(!a.calls.some(c => c.code === "ASHFDNS" && c.arr == null), "where it started the day is not a call");
  assert.ok(a.calls.some(c => c.code === "ASHFEBS" && c.stay === 200), "and a stand in the East sidings is a stand");
  assert.equal(a.tier, 1, "due tomorrow is nearest"); assert.equal(a.ahead, 1);
  assert.equal(a.splits, false, "GT101 neither attaches nor detaches");
  // 375602 on GT102 ends in the Ashford East sidings, which IS Ashford
  const b = row("375602", "EXAMS");
  assert.equal(b.ends.place, "AFK"); assert.equal(b.endsAtTarget, true); assert.equal(b.ahead, 0, "today");
  // 375604 is the second unit of GT103's formation and is still found
  const c = row("375604", "EXAMS");
  assert.deepEqual(norm(c.diags), ["GT103"]); assert.equal(c.ends.place, "DVP");
  assert.equal(c.tier, 2, "Saturday is this week");
  assert.equal(row("375603", "SCHEDULED MAINT").tier, 2);
  assert.equal(row("375602", "DEFECTS").tier, 3, "a week out is later");
  // an end-of-day defect with no date is due today
  const eod = B().run("Defects\nUnit Nr \tDays\tPriority\tTarget Date\tAction \n375601\t1\t4. EOD Safety Defect\t\t", res, {});
  assert.equal(eod.rows[0].ahead, 0); assert.equal(eod.rows[0].tier, 1);
  assert.match(eod.rows[0].suggest.notes.join("; "), /no call at RE today/, "and is answered as today's");
  assert.equal(row("375699", "EXAMS").inTraffic, false);
  assert.equal(row("375698", "EXAMS").ignored, true);
  // nearest first in the tiered list; the plan's own order in rows
  assert.deepEqual(norm(out.tiered.map(r => r.tier)), [1, 1, 1, 1, 1, 2, 2, 3]);
  assert.deepEqual(norm(out.rows.map(r => r.unit)), ["375601", "375602", "375604", "375699", "375698", "375603", "375601", "375602"]);
});

test("the depot's rules give each line an action in the depot's own words", async () => {
  const res = await weekday();
  const out = B().run(BLANK, res, { ignore: "375698" });
  const sug = (unit, section) => out.rows.find(r => r.unit === unit && r.section === section).suggest;
  assert.equal(out.suggested, 8, "every empty Action filled");
  /* 375601 does not end at Ashford but calls there - at a depot, so a
     berth off the working it is on when it gets there, not a changeover */
  const a = sug("375601", "EXAMS");
  assert.equal(a.action, "AFK BERTH off 2A01", JSON.stringify(a));
  assert.match(a.notes.join("; "), /at AFK 05\+35, leaves on 2A01/);
  // 375602 ends at Ashford with the exam due today: hold it
  assert.equal(sug("375602", "EXAMS").action, "AFK HOLD");
  // 375604 is five days out: where it ends, and that is all
  assert.equal(sug("375604", "EXAMS").action, "ENDS DVP");
  // the defect due tomorrow: no call at Ramsgate today, and it says so
  const d = sug("375601", "DEFECTS");
  assert.equal(d.action, "ENDS DVP");
  assert.match(d.notes.join("; "), /no call at RE today/);
  // not in traffic, out of service
  assert.equal(sug("375699", "EXAMS").action, "NOT IN TRAFFIC");
  assert.equal(sug("375698", "EXAMS").action, "O/O/S");
  // the planner's own action is never touched
  const kept = B().run(PLAN, res, {});
  assert.equal(kept.suggested, 0, "nothing to fill");
  assert.equal(kept.rows[0].action, "AFK HOLD");
  assert.equal(kept.rows[0].suggest.action, "AFK BERTH off 2A01", "but the suggestion is still made, beside it");
});

test("a hold seen from the weekend is held for Monday, and a changeover is at Ramsgate or a London terminal", () => {
  const s = B().suggest;
  const base = { section: "EXAMS", places: ["RE"], inTraffic: true, ignored: false, amat: false, mse: false,
                 splits: false, when: { half: "AM", date: new Date(Date.UTC(2026, 8, 21)) },
                 today: new Date(Date.UTC(2026, 8, 19)), ahead: 2, tier: 2, calls: [] };
  const held = s({ ...base, tier: 1, ahead: 1, endsAtTarget: true, afterMidnight: false,
                   ends: { place: "RE", time: 19 * 60 + 54 } });
  assert.equal(held.action, "RE HOLD FOR MON", "Monday's exam, seen from Saturday");
  const late = s({ ...base, tier: 1, ahead: 0, when: { half: "AM", date: base.today }, endsAtTarget: true,
                   afterMidnight: false, ends: { place: "RE", time: 22 * 60 + 30 } });
  assert.equal(late.action, "RE HOLD FOR MON");
  assert.match(late.notes.join(), /back 22\+30 — after 22 00/, "Ramsgate's clock for exams");
  const co = s({ ...base, tier: 1, ahead: 1, endsAtTarget: false, afterMidnight: false, splits: true, splitsAt: ["AFK"],
                 ends: { place: "DVP", time: 23 * 60 },
                 calls: [{ code: "RAMSGTE", place: "RAM", arr: 14 * 60 + 22, dep: 14 * 60 + 40, stay: 18, hcIn: "2W40", hc: "2R41" }] });
  assert.equal(co.action, "RE C/O AND HOLD FOR MON", "a call at Ramsgate station is a changeover");
  assert.match(co.notes.join("; "), /at RAM 14 22, leaves on 2R41/);
  assert.match(co.notes.join("; "), /splits at AFK/, "and the one thing to know before taking it off its working");
  const move = s({ ...base, tier: 1, ahead: 1, endsAtTarget: false, afterMidnight: false,
                   ends: { place: "SG", time: 22 * 60 }, today: new Date(Date.UTC(2026, 8, 17)) });
  assert.equal(move.action, "ENDS SG");
  assert.match(move.notes.join("; "), /fleet move 5Y17 10\+10 SG - RE \(SuX\)/, "the standing path the next morning");
  const amat = s({ ...base, section: "DEFECTS", category: "PERF", amat: true });
  assert.equal(amat.action, "AMAT — NO REQUEST");
  const restricted = s({ ...base, section: "DEFECTS", category: "MO", amat: true, tier: 1, ahead: 1,
                         endsAtTarget: true, afterMidnight: true, ends: { place: "RE", time: 1440 + 37 } });
  assert.equal(restricted.action, "RE HOLD FOR MON", "restricted AND awaiting materials still needs one");
  assert.match(restricted.notes.join("; "), /after midnight — counts/);
});

test("the plan comes back in its own shape, with two columns added and the colours kept", async () => {
  const res = await weekday();
  const out = B().run(BLANK, res, { ignore: "375698" });
  const shape = B().shape(out);
  assert.deepEqual(norm(shape.map(s => s.title)), ["Exams", "Scheduled Maint", "Defects"]);
  assert.deepEqual(norm(shape[0].headers), ["Unit Nr", "Exam", "When", "Where", "Action", "Suggested", "Today"]);
  assert.deepEqual(norm(shape[2].headers), ["Unit Nr", "Days", "Priority", "Target Date", "Action", "Suggested", "Today"]);
  assert.deepEqual(norm(shape[0].rows.map(r => r.cls)), ["ex-a", "ex-b", "ex-c", "ex-a", "ex-x"],
    "A black, B green, C red, XS50 blue - the workbook's colours");
  assert.ok(shape[0].rows.every(r => r.filled), "an empty Action is filled");
  const text = B().toText(out);
  assert.match(text, /^Exams\nUnit Nr\tExam\tWhen\tWhere\tAction\tSuggested\tToday\n375601\tA\tTUE AM 04\/08\tAFK\t\tAFK BERTH off 2A01 \(at AFK 05\+35, leaves on 2A01\)\ton GT101 · ENDS DVP 23\+50 · calls AFK 05\+35 off 2A01, AFK 10 30 off 5A03, AFK 10\+40 \(stands 3\.3 h\) off 5A05 \+1 more$/m,
    "tab-separated, the workbook's columns then the two new ones: " + text.split("\n").slice(0, 3).join(" | "));
  const html = B().toHtml(out, true);
  assert.match(html, /<tr style="color:#00B050[^"]*"><td[^>]*>375602<\/td>/, "a B exam is green in the copied table");
  assert.match(html, /<caption[^>]*>Defects<\/caption>/);
  // the nearest-first list is still there for whoever wants the day in that order
  assert.match(B().render(out), /== NEXT: today, tomorrow, ASAP and overdue ==/);
});

test("a Summary printed before allocation is named as the reason nothing is placed", async () => {
  const res = await N.GENIUS.build([geniusSummaryCsv(), geniusDetailCsv()]);
  const out = B().run(PLAN, res, {});
  assert.equal(out.inTraffic, 0);
  assert.match(out.reviews[0], /no units on it — it was printed before the day was allocated/);
});
