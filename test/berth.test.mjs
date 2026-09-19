/* The berth-request road: the maintenance plan pasted from the Telex
   workbook, read against the weekday reports the books were built from -
   where each unit is, where it ends tonight, whether it calls where the
   plan wants it, whether its diagram splits - and the depot's own rules
   applied to that, in the depot's own words, beside whatever the planner
   wrote. */
import test from "node:test";
import assert from "node:assert/strict";
import { built, norm } from "./helpers/compare.mjs";
import { geniusSummaryCsv, geniusSummaryCsvWithUnits, geniusDetailCsv, geniusPairCsv }
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

/* ---- the swaps ----
   A day shaped for them. 375701 comes out of Ramsgate to Grove Park for
   the morning and stands there with RM102, which goes home to Ramsgate in
   the afternoon. 375703 comes up to Charing Cross and has ninety minutes
   there alongside RM104, which goes back to Ramsgate. 375705 gets to
   Charing Cross ten minutes after RM104 has left. RM106 is RM104 with a
   detach after the terminal. */
const S = (code, arr, dep, hc, ev) => ({ code, arr, dep, hc, ev });
const SWAP_DAY = [
  /* straight out of the depot and up empty, so its only chance of Ramsgate
     is the afternoon swap - a call at the Ramsgate platform on the way out
     would be answered, rightly, with a changeover there */
  { code: "RM101", units: "375701.", stops: [S("RAMSGTD", "", "05:00", "5J70"),
      S("CHRX", "07:30", "07:40", "5J70"), S("GRVPCSD", "08:30", "13:45", "5F43"), S("CANONST", "14:20", "14:30", "2P43"),
      S("GRVPKUS", "22:00", "", "")] },
  { code: "RM102", units: "375702.", stops: [S("GRVPCSD", "", "06:00", "5J01"), S("CANONST", "06:40", "06:50", "2K01"),
      S("GRVPCSD", "09:00", "14:10", "5R00"), S("RAMSGTE", "16:00", "16:10", "5R00"), S("RAMSGTD", "16:20", "", "")] },
  { code: "RM103", units: "375703.", stops: [S("ASHFDNS", "", "05:00", "5A03"), S("ASHFKY", "05:10", "05:20", "2A03"),
      S("CHRX", "07:00", "09:30", "2A04"), S("HASTING", "11:00", "11:10", "5H03"), S("HASTPSD", "11:20", "", "")] },
  { code: "RM104", units: "375704.", stops: [S("RAMSGTD", "", "05:30", "5W04"), S("RAMSGTE", "05:50", "06:00", "2W04"),
      S("CHRX", "07:40", "09:10", "2R04"), S("RAMSGTE", "11:00", "11:10", "5R04"), S("RAMSGTD", "11:20", "", "")] },
  { code: "RM105", units: "375705.", stops: [S("ASHFDNS", "", "07:00", "5A05"), S("ASHFKY", "07:10", "07:20", "2A05"),
      S("CHRX", "09:20", "09:25", "2A06"), S("HASTING", "11:30", "11:40", "5H05"), S("HASTPSD", "11:50", "", "")] },
  { code: "RM106", units: "375706.", stops: [S("RAMSGTD", "", "05:35", "5W06"), S("RAMSGTE", "05:55", "06:05", "2W06"),
      S("CHRX", "07:45", "09:15", "2R06"), S("RAMSGTE", "11:05", "11:15", "5R06", "DETACH"), S("RAMSGTD", "11:25", "", "")] },
  /* RM907 is RM104 again but a 375/9 diagram with a 375/9 on it - the
     same times, so the only thing keeping 375703 off it is the fleet */
  { code: "RM907", fleet: "375/9", units: "375901.", stops: [S("RAMSGTD", "", "05:32", "5W08"), S("RAMSGTE", "05:52", "06:02", "2W08"),
      S("CHRX", "07:42", "09:12", "2R08"), S("RAMSGTE", "11:02", "11:12", "5R08"), S("RAMSGTD", "11:22", "", "")] },
];
const swapDay = async () => { const p = geniusPairCsv(SWAP_DAY); return N.GENIUS.build([p.summary, p.detail]); };
const planFor = lines => ["Exams", "Unit Nr \tExam\t\tWhere\tAction"].concat(lines).join("\n");

test("a working is named the way its depot names workings", async () => {
  const res = await swapDay();
  const det = res.detail.get("03/08/26");
  const fin = d => B().finalWorking(N.GENIUS._stopsOf(det.get(d)));
  // RM104 goes into the Ramsgate platform first and runs empty to the depot: the platform time
  assert.equal(B().requestName("RE", fin("RM104")), "11+10");
  assert.equal(fin("RM104").hc, "5R04");
  // RM101 ends at Grove Park, a headcode depot
  assert.equal(B().requestName("GP", fin("RM101")), "2P43");
  // RM103 runs empty from Hastings to the park sidings: the time off the stop
  assert.equal(B().requestName("XSE", fin("RM103")), "11+10");
});

test("a unit at Grove Park for the morning is got home by swapping the afternoon working", async () => {
  const res = await swapDay();
  const out = B().run(planFor(["375701\tA\tTUE AM 04/08\tRE\t"]), res, {});
  const r = out.rows[0];
  assert.equal(r.suggest.action, "GP BERTH 5R00", JSON.stringify(r.suggest));
  assert.match(r.suggest.notes.join("; "), /in on 5J70 08\+30, booked out 13\+45 on 5F43; out on 5R00: RM102, ends RE 16\+20, 375702 off it \(takes 5F43\)/);
  /* no changeover notice at a depot: the unit went to Grove Park empty and
     sits there to the PM, so it ends GP in the AM and the request is all */
  assert.equal(r.suggest.notice, null, "no notice for a depot swap: " + JSON.stringify(r.suggest));
  assert.equal(out.notices.length, 0);
  assert.ok(!/CHANGEOVERS & BALANCING/.test(B().toText(out)), "and no notice block under the table");
});

test("the notice block is written for a terminal changeover, numbered, in the depot's form", async () => {
  const res = await swapDay();
  const out = B().run(planFor(["375703\tA\tTUE AM 04/08\tRE\t"]), res, {});
  assert.equal(out.notices.length, 1);
  assert.match(B().toText(out), /CHANGEOVERS & BALANCING\n=+\n\n1\) 375703 REQD RE EOD FOR A EXAM - CHX PLEASE NOTE\n   2A03 05 20 AFK - CHX T\/F 2R04 09 10 CHX - RAM\n   2W04 06 00 RAM - CHX T\/F 2A04 09 30 CHX - HGS/);
});

test("a changeover at a London terminal, and the two ways it is refused", async () => {
  const res = await swapDay();
  // 375703 and RM104 are both at Charing Cross with time in hand
  const ok = B().run(planFor(["375703\tA\tTUE AM 04/08\tRE\t"]), res, {}).rows[0].suggest;
  assert.equal(ok.action, "RE BERTH 11+10 — T/F AT CHX", JSON.stringify(ok));
  assert.deepEqual(norm(ok.notice), [
    "375703 REQD RE EOD FOR A EXAM - CHX PLEASE NOTE",
    "2A03 05 20 AFK - CHX T/F 2R04 09 10 CHX - RAM",
    "2W04 06 00 RAM - CHX T/F 2A04 09 30 CHX - HGS",
  ]);
  // 375705 gets to Charing Cross after RM104's working has gone: taking it
  // would delay it, so no changeover - the working is still named
  const late = B().run(planFor(["375705\tA\tTUE AM 04/08\tRE\t"]), res, {}).rows[0].suggest;
  assert.match(late.action, /^RE BERTH 11\+10 \(no shared terminal — depot swap\)$/, JSON.stringify(late));
  assert.equal(late.notice, null);
  // and the unit displaced must not be one the plan wants at Ramsgate NOW
  const both = B().run(planFor(["375703\tA\tTUE AM 04/08\tRE\t", "375704\tB\tTUE AM 04/08\tRE\t"]), res, {});
  const s3 = both.rows[0].suggest;
  assert.ok(!/RM104|375704/.test(s3.notes.join(" ")), "RM104 is not offered while 375704 is wanted at Ramsgate: " + JSON.stringify(s3));
  assert.equal(both.rows[1].suggest.action, "RE HOLD", "375704 ends there and is held");
  // but a unit wanted there on Wednesday is not protected on Monday
  const later = B().run(planFor(["375703\tA\tTUE AM 04/08\tRE\t", "375704\tB\tWED AM 05/08\tRE\t"]), res, {});
  assert.equal(later.rows[0].suggest.action, "RE BERTH 11+10 — T/F AT CHX",
    "swapping 375704 off RM104 costs it nothing yet: " + JSON.stringify(later.rows[0].suggest));
});

test("fleets stay on their own diagrams, and the same number of units go on the service", async () => {
  const f = B().fits;
  assert.equal(f("375901", "375/9"), true);  assert.equal(f("375901", "375/6"), false);
  assert.equal(f("375301", "375/3"), true);  assert.equal(f("375301", "375/6"), false);
  assert.equal(f("375613", "375/6"), true);  assert.equal(f("375713", "375/8"), true, "6, 7 and 8 are one fleet");
  assert.equal(f("375826", "375/9"), false); assert.equal(f("376017", "376/0"), true);
  assert.equal(f("377514", "377/5"), true);  assert.equal(f("377514", "375/6"), false, "a 377 stays on GT diagrams");
  assert.equal(f("376017", "465/9"), false, "and nothing couples across fleets");
  const res = await swapDay();
  /* 375703 is a plain 375. RM907 fits the time window exactly as RM104
     does, and is not taken while its own fleet has a way home: with RM104
     wanted by its own unit, RM102's depot swap is that way, and RM907 is
     named only as the variation it would be. */
  const out = B().run(planFor(["375703\tA\tTUE AM 04/08\tRE\t", "375704\tB\tTUE AM 04/08\tRE\t"]), res, {});
  const s = out.rows[0].suggest;
  assert.equal(s.action, "RE BERTH 11+15 — T/F AT CHX", JSON.stringify(s));
  assert.ok(!/RM907|375901/.test(s.action), "no 375/9 diagram for a plain 375 while a 375 one ends there: " + JSON.stringify(s));
  assert.match(s.notes.join("; "), /RM907 11\+12 \(variation\)/, "the variation is named as one");
  /* and the other way: the 375/9 wants Ramsgate, RM104 fits the window,
     but a 375/9 does not go on a plain 375 diagram - only RM907 would, and
     it is its own */
  const nine = B().run(planFor(["375901\tA\tTUE AM 04/08\tRE\t"]), res, {}).rows[0].suggest;
  assert.equal(nine.action, "RE HOLD", "it ends at Ramsgate anyway");
});

test("the 375/9 variation is offered only once the same fleets are exhausted", async () => {
  const res = await swapDay();
  /* 375702, 375704 and 375706 are all wanted at Ramsgate, so RM102, RM104
     and RM106 are theirs. Nothing of 375703's own fleet is left, so the
     375/9 diagram is offered - as a variation, said so, with its notice. */
  const out = B().run(planFor(["375703\tA\tTUE AM 04/08\tRE\t", "375704\tB\tTUE AM 04/08\tRE\t",
                               "375702\tC\tTUE AM 04/08\tRE\t", "375706\tA\tTUE AM 04/08\tRE\t"]), res, {});
  const s = out.rows[0].suggest;
  /* with RM106 still free the same fleet is exhausted only where it can be
     swapped: RM106 splits and has no swap point, and is still named ahead
     of the variation, because the same fleets come first, always */
  const own = B().run(planFor(["375703\tA\tTUE AM 04/08\tRE\t", "375704\tB\tTUE AM 04/08\tRE\t", "375702\tC\tTUE AM 04/08\tRE\t"]), res, {}).rows[0].suggest;
  assert.equal(own.action, "RE BERTH 11+15 — T/F AT CHX", JSON.stringify(own));
  assert.match(own.notes.join("; "), /RM106 splits at RAM/);
  assert.match(own.notes.join("; "), /or RM907 11\+12 \(variation\)/);
  assert.equal(s.action, "RE BERTH 11+12 — T/F AT CHX", JSON.stringify(s));
  assert.match(s.notes.join("; "), /VARIATION — 375\/9 diagram, same fleets exhausted/);
  assert.equal(s.notice[1], "2A03 05 20 AFK - CHX T/F 2R08 09 12 CHX - RAM");
  // a 3-car, a 376 and a 377 never vary
  const f = B().fitsLoosely;
  assert.equal(f("375901", "375/6"), true);  assert.equal(f("375613", "375/9"), true);
  assert.equal(f("375301", "375/6"), false); assert.equal(f("376017", "375/6"), false);
  assert.equal(f("377514", "375/9"), false);
});

test("a diagram that detaches after the swap point is offered with its changeover, after a clean one, and the line says where", async () => {
  /* RM106 is RM104 with a detach at Ramsgate after Charing Cross. With
     RM104 free it comes second; with RM104 wanted by its own unit it is
     the way home, changeover and notice included, and the line says it
     splits at Ramsgate. */
  const res = await swapDay();
  const clean = B().run(planFor(["375703\tA\tTUE AM 04/08\tRE\t"]), res, {}).rows[0].suggest;
  assert.equal(clean.action, "RE BERTH 11+10 — T/F AT CHX", "RM104 first: " + JSON.stringify(clean));
  assert.match(clean.notes.join("; "), /or RM106 11\+15/);
  const out = B().run(planFor(["375703\tA\tTUE AM 04/08\tRE\t", "375704\tB\tTUE AM 04/08\tRE\t",
                               "375702\tC\tTUE AM 04/08\tRE\t", "375901\tA\tTUE AM 04/08\tRE\t"]), res, {});
  const s = out.rows[0].suggest;
  assert.equal(s.action, "RE BERTH 11+15 — T/F AT CHX", JSON.stringify(s));
  assert.deepEqual(norm(s.notice), [
    "375703 REQD RE EOD FOR A EXAM - CHX PLEASE NOTE",
    "2A03 05 20 AFK - CHX T/F 2R06 09 15 CHX - RAM",
    "2W06 06 05 RAM - CHX T/F 2A04 09 30 CHX - HGS",
  ]);
  assert.match(s.notes.join("; "), /RM106 splits at RAM/, "and the line says where");
});

test("two lines wanting the same working: the nearer, then RED, then CON, goes first and the other gets the next", async () => {
  const res = await swapDay();
  /* 375703 (RM103) and 375705 (RM105) both want Ramsgate; RM104 is the
     only changeover, RM102 the depot swap. Plan order has 375703 first, but
     375705 is due today and 375703 tomorrow, so 375705 is answered first. */
  const p = B().priorityOf;
  const lt = (a, b) => { const x = p(a), y = p(b); for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] < y[i]; return false; };
  const L = (o) => ({ tier: 1, ahead: 1, red: false, con: false, line: 5, ...o });
  assert.ok(lt(L({ ahead: 0, line: 9 }), L({ ahead: 1, con: true, line: 1 })), "a concession does not jump a line due sooner");
  assert.ok(lt(L({ red: true, line: 9 }), L({ con: true, line: 1 })), "RED before CON at the same date");
  assert.ok(lt(L({ con: true, line: 9 }), L({ line: 1 })), "CON before the plain line at the same date");
  assert.ok(lt(L({ line: 1 }), L({ line: 9 })), "then the plan's own order");
  const out = B().run(planFor(["375703\tA\tTUE AM 04/08\tRE\t", "375705\tB\tMON AM 03/08\tRE\t"]), res, {});
  const [s3, s5] = out.rows.map(r => r.suggest);
  assert.equal(s5.action, "RE BERTH 11+10 (no shared terminal — depot swap)", "375705, due today, gets RM104: " + JSON.stringify(s5));
  assert.equal(s3.action, "RE BERTH 11+15 — T/F AT CHX", "375703 is given the next, RM106, not RM104 twice: " + JSON.stringify(s3));
  assert.deepEqual(norm(out.tiered.map(r => r.unit)), ["375705", "375703"], "nearest first lists them in that order");
  assert.deepEqual(norm(out.rows.map(r => r.unit)), ["375703", "375705"], "the plan keeps its own order");
});

test("a 12-car is three diagrams on one working: it carries three requests, an 8-car two", async () => {
  /* RM102, RM108 and RM118 run 5R00 out of Grove Park coupled, one unit
     each: three requests go on it, one per diagram, and a fourth is
     refused. RM109 is a fourth unit that wants Ramsgate. */
  const twin = (code, unit, pos) => ({ code, units: unit + ".", pos, stops: [S("GRVPCSD", "", "06:00", "5J01"), S("CANONST", "06:40", "06:50", "2K01"),
      S("GRVPCSD", "09:00", "14:10", "5R00"), S("RAMSGTE", "16:00", "16:10", "5R00"), S("RAMSGTD", "16:20", "", "")] });
  const day = SWAP_DAY.concat([twin("RM108", "375708", 2), twin("RM118", "375718", 3),
    { code: "RM109", units: "375709.", stops: [S("ASHFDNS", "", "07:30", "5A09"), S("ASHFKY", "07:40", "07:50", "2A09"),
        S("CHRX", "09:50", "09:55", "2A10"), S("HASTING", "12:00", "12:10", "5H09"), S("HASTPSD", "12:20", "", "")] }]);
  const p = geniusPairCsv(day); const res = await N.GENIUS.build([p.summary, p.detail]);
  const out = B().run(planFor(["375701\tA\tTUE AM 04/08\tRE\t", "375703\tB\tTUE AM 04/08\tRE\t",
                               "375705\tC\tTUE AM 04/08\tRE\t", "375709\tA\tTUE AM 04/08\tRE\t", "375704\tA\tTUE AM 04/08\tRE\t",
                               "375706\tA\tTUE AM 04/08\tRE\t"]), res, {});
  const s = out.rows.map(r => r.suggest);
  assert.equal(s[0].action, "GP BERTH 5R00", JSON.stringify(s[0]));
  assert.match(s[0].notes.join("; "), /375702 off it \(takes 5F43\)/);
  assert.match(s[0].notes.join("; "), /5R00 runs as 3 units \(RM102\+RM108\+RM118\) — request 1 of 3/);
  assert.match(s[1].action, /^RE BERTH 14\+10/, JSON.stringify(s[1]));
  assert.match(s[1].notes.join("; "), /375708 off it.*request 2 of 3/);
  assert.match(s[2].notes.join("; "), /375718 off it.*request 3 of 3/);
  assert.ok(!/5R00|RM102|RM108|RM118/.test(s[3].action + s[3].notes.join(" ")), "no fourth request on a 12-car: " + JSON.stringify(s[3]));
  assert.equal(s[4].action, "RE HOLD", "375704 ends at Ramsgate anyway");
  // with 375708 wanted at Ramsgate itself, RM108 is not displaced and the train has two slots
  const two = B().run(planFor(["375701\tA\tTUE AM 04/08\tRE\t", "375703\tB\tTUE AM 04/08\tRE\t",
                               "375705\tC\tTUE AM 04/08\tRE\t", "375704\tA\tTUE AM 04/08\tRE\t", "375708\tA\tTUE AM 04/08\tRE\t",
                               "375706\tA\tTUE AM 04/08\tRE\t"]), res, {});
  const t = two.rows.map(r => r.suggest);
  assert.match(t[0].notes.join("; "), /375702 off it \(takes 5F43\)/);
  assert.match(t[1].notes.join("; "), /375718 off it/, "375708 is not displaced: " + JSON.stringify(t[1]));
  assert.ok(!/5R00/.test(t[2].action + t[2].notes.join(" ")), "no third slot: " + JSON.stringify(t[2]));
  assert.equal(t[4].action, "RE HOLD");
});

test("a formation is kept together where it can be, and a request that splits one says so", async () => {
  /* RM101 and RM111 run coupled - 375701+375711 - up to Grove Park for the
     morning; RM102 and RM108 run 5R00 home coupled. Both wanted at
     Ramsgate, both go on 5R00, the second with the first, and each line
     says they are together. */
  const like = (of, code, unit, pos) => ({ ...SWAP_DAY.find(d => d.code === of), code, units: unit + ".", pos });
  const day = SWAP_DAY.concat([like("RM101", "RM111", "375711", 2), like("RM102", "RM108", "375708", 2)]);
  const p = geniusPairCsv(day); const res = await N.GENIUS.build([p.summary, p.detail]);
  const both = B().run(planFor(["375701\tA\tTUE AM 04/08\tRE\t", "375711\tB\tTUE AM 04/08\tRE\t"]), res, {});
  const [a, b] = both.rows.map(r => r.suggest);
  assert.equal(a.action, "GP BERTH 5R00"); assert.equal(b.action, "GP BERTH 5R00");
  assert.match(a.notes.join("; "), /with its formation 375711/, JSON.stringify(a));
  assert.match(b.notes.join("; "), /request 2 of 2/);
  assert.match(b.notes.join("; "), /with its formation 375701/, JSON.stringify(b));
  // only one of them wanted: the request splits the pair, and the line says who is left
  const one = B().run(planFor(["375701\tA\tTUE AM 04/08\tRE\t"]), res, {}).rows[0].suggest;
  assert.match(one.notes.join("; "), /splits the 2-unit formation it arrives in — 375711 left/, JSON.stringify(one));
});

/* ---- the defects export ----
   Pasted as it comes out of the defects system: fifteen tab-separated
   columns under a heading row. The Repair Location carries the flags, the
   Fault Description the couple of words the notice needs. */
const DEFECTS = [
  "Date Occurred\tDays O/S\tAsset No\tCoach No\tCatalogue No.\tStock Description\tRepair Location\tDiagram End Location\tArrival Date\tSystem Code\tFault Description\tFacility Failure\tReport\tPriority\tTarget Due Date",
  "06/07/2026 15:48:00\t28\t375701\t67875\t\t\t+ AMAT\tRAMSGTD\t02/08/2026 19:54:00\tHA\tUMD1234 No Cab Air Con - Requires HVAC\tNo\tWR0000001\t3. Restriction NM\t04/08/2026 00:00:00",
  "01/08/2026 09:10:00\t2\t375703\t67877\t\t\t+ CON RED\tRAMSGTD\t02/08/2026 22:00:00\tTC\t1 x TCMS code: 800 - ACM - No 3 Phase or Battery Charging - RED\tNo\tWR0000002\t4. EOD Safety Defect\t",
  "30/07/2026 11:00:00\t4\t375704\t67878\t\t\tRamsgate Train Care Depot\tRAMSGTD\t02/08/2026 20:00:00\tPD\tMDC - MCM Down\tNo\tWR0000003\t5. Performance Defect\t10/08/2026 00:00:00",
  "31/07/2026 08:00:00\t3\t376017\t61017\t\t\t+ MSE\tSLADEGD\t02/08/2026 21:00:00\tDR\tMDC wiper not working\tNo\tWR0000004\t3. Restriction NM\t05/08/2026 00:00:00",
  "29/07/2026 08:00:00\t5\t375705\t67879\t\t\txGTR\tHASTPSD\t02/08/2026 21:00:00\tDR\tShunter reports Loud bang and Smoke (MCM Inductor)\tNo\tWR0000005\t5. Performance Defect\t12/08/2026 00:00:00",
].join("\n");

test("the defects export is read by its headings: the flags, the depot, the kind and a couple of words", () => {
  const d = B().parseDefects(DEFECTS);
  assert.equal(d.rows.length, 5);
  assert.deepEqual(norm(d.rows.map(r => [r.unit, r.category, r.summary])), [
    ["375701", "NM", "NO CAB AIR CON"],
    ["375703", "EOD", "NO 3 PHASE OR BATTERY"],
    ["375704", "PERF", "MCM DOWN"],
    ["376017", "NM", "WIPER NOT WORKING"],
    ["375705", "PERF", "LOUD BANG AND SMOKE"],
  ]);
  assert.deepEqual(norm(d.rows.map(r => [r.amat, r.mse, r.red, r.con, r.gtr, r.repairDepot])), [
    [true, false, false, false, false, null],
    [false, false, true, true, false, null],
    [false, false, false, false, false, "RE"],
    [false, true, false, false, false, null],
    [false, false, false, false, true, null],
  ], "AMAT, MSE, RED, CON and GTR off the Repair Location, and the depot where it names one");
  assert.equal(d.rows[0].days, 28);
  assert.equal(d.rows[0].target, "04/08/2026 00:00:00");
});

test("the couple of words: codes and prefixes dropped, the first thought kept, abbreviations not cut", () => {
  const s = B().faultSummary;
  assert.equal(s("1 x TCMS code: 62 - Cab Air Con. high pressure lockout"), "CAB AIR CON HIGH PRESSURE");
  assert.equal(s("4 x TCMS code: 5404 - DMOS ACM GDU feedback failure of IGBT 5"), "DMOS ACM GDU FEEDBACK FAILURE");
  assert.equal(s("GTR - PTOSL CET SENSORS DEFECTIVE (BOTH 50%/80%) - NIL STOCK"), "PTOSL CET SENSORS DEFECTIVE");
  assert.equal(s("Needs toilet pan solenoid. Toilet LOOU, sticker applied"), "NEEDS TOILET PAN SOLENOID");
  assert.equal(s("Drivers seat change required"), "DRIVERS SEAT CHANGE");
  assert.equal(s("MCM Down - Can be done MSE if in top shed at SG."), "MCM DOWN");
  assert.equal(s("CACU lights flashing, C-C not working.CACU Required"), "CACU LIGHTS FLASHING");
  assert.equal(s("MDC - Failed to Couple"), "FAILED TO COUPLE");
  assert.equal(s(""), "");
});

test("the export's rows become the plan's Defects lines, the planner's own Action kept, and the notice says the fault", async () => {
  const res = await swapDay();
  /* the plan's Defects section has 375701 with RE HOLD written against it;
     the export has the same defect, and knows the fault */
  const plan = ["Defects", "Unit Nr \tDays\tPriority\tTarget Date\tAction ",
                "375701\t28\t3. Restriction NM\t04/08/2026 00:00:00\tRE HOLD",
                "375799\t1\t5. Performance Defect\t20/08/2026 00:00:00\tENDS SG"].join("\n");
  const out = B().run(plan, res, { defects: DEFECTS });
  const defects = out.rows.filter(r => r.section === "DEFECTS");
  assert.equal(defects.length, 6, "five from the export, one the export did not carry");
  const r1 = defects.find(r => r.unit === "375701");
  assert.equal(r1.action, "RE HOLD", "the planner's Action is kept");
  assert.equal(r1.summary, "NO CAB AIR CON");
  assert.equal(r1.amat, true);
  assert.equal(r1.suggest.action, "GP BERTH 5R00", "AMAT with a restriction still needs its request: " + JSON.stringify(r1.suggest));
  assert.equal(r1.suggest.notice, null, "a depot swap has no notice");
  assert.match(B().toText(out), /375703 CONTAINING EOD DEFECT - NO 3 PHASE OR BATTERY - CHX PLEASE NOTE/);
  // an end-of-day defect with no target date is due today, and RED and CON are on its line
  const r3 = defects.find(r => r.unit === "375703");
  assert.equal(r3.tier, 1);
  assert.equal(r3.suggest.action, "RE BERTH 11+10 — T/F AT CHX", JSON.stringify(r3.suggest));
  assert.equal(r3.suggest.notice[0], "375703 CONTAINING EOD DEFECT - NO 3 PHASE OR BATTERY - CHX PLEASE NOTE");
  assert.match(B().render(out), /375703.*\[EOD · NO 3 PHASE OR BATTERY · RED · CON\]/);
  // the plan's own line the export did not carry is still there, as it was
  const r9 = defects.find(r => r.unit === "375799");
  assert.equal(r9.action, "ENDS SG");
  // a performance defect for a week on says where it ends
  assert.match(defects.find(r => r.unit === "375704").suggest.action, /^ENDS /);
  // the export on its own, with no plan text, is a plan
  const alone = B().run("", res, { defects: DEFECTS });
  assert.equal(alone.rows.length, 5);
  assert.deepEqual(norm(alone.order), ["DEFECTS"]);
});

test("a Saturday's reports are read for this road though no weekday books are built from them", async () => {
  const p = geniusPairCsv(SWAP_DAY);
  const sat = [p.summary.replace(/03\/08\/26/g, "08/08/26"), p.detail.replace(/03\/08\/26/g, "08/08/26")];
  await assert.rejects(N.GENIUS.build(sat), /weekend/, "the books refuse a Saturday");
  const rd = await N.GENIUS.read(sat);
  assert.deepEqual(norm(rd.dates), ["08/08/26"]);
  assert.equal(rd.summary.filter(r => r.units && r.units.length).length, 7);
  assert.ok(rd.detail.get("08/08/26").has("RM101"));
  const out = B().run(planFor(["375701\tA\tSUN AM 09/08\tRE\t", "375704\tB\tMON AM 10/08\tRE\t"]), rd, {});
  assert.equal(out.date, "08/08/26");
  assert.equal(out.rows[0].inTraffic, true);
  assert.equal(out.rows[0].suggest.action, "GP BERTH 5R00", JSON.stringify(out.rows[0].suggest));
  assert.equal(out.rows[1].suggest.action, "RE HOLD FOR MON", "Saturday for Monday");
});

/* ---- the three rules that were "to come" ---- */
test("MSE attending: a unit listed in the box gets no request, and the export's MSE units are named", async () => {
  const res = await swapDay();
  const off = B().run("", res, { defects: DEFECTS });
  assert.deepEqual(norm(off.mseUnits), ["376017"]);
  const r0 = off.rows.find(r => r.unit === "376017");
  assert.equal(r0.suggest.action, "NOT IN TRAFFIC");
  assert.match(r0.suggest.notes.join("; "), /MSE — no request if they are attending/);
  const on = B().run("", res, { defects: DEFECTS, mse: "376017" });
  assert.equal(on.rows.find(r => r.unit === "376017").suggest.action, "MSE ATTENDING — NO REQUEST");
  assert.equal(on.mseAttending, 1);
});

test("a restriction is a formation: MO wants a train of two diagrams or more, NM one that runs alone", async () => {
  /* RM102 and RM108 run 5J01 out and 5R00 home coupled; everything else
     runs as one unit all day */
  const like = (of, code, unit, pos) => ({ ...SWAP_DAY.find(d => d.code === of), code, units: unit + ".", pos });
  const day = SWAP_DAY.concat([like("RM102", "RM108", "375708", 2)]);
  const p = geniusPairCsv(day); const res = await N.GENIUS.build([p.summary, p.detail]);
  const D = (unit, pri) => ["Defects", "Unit Nr \tDays\tPriority\tTarget Date\tAction ", unit + "\t3\t" + pri + "\t04/08/2026 00:00:00\t"].join("\n");
  /* 375703 on RM103, one unit all day: multiple only cannot be right
     today, and the only train of two that goes home is 5R00 */
  const mo = B().run(D("375703", "2. Restriction MO"), res, {}).rows[0].suggest;
  assert.match(mo.notes.join("; "), /MO — multiple only, but runs as one unit on 5A03 05\+00 today: check/, JSON.stringify(mo));
  assert.match(mo.action, /^RE BERTH 14\+10/, JSON.stringify(mo));
  assert.ok(!/RM104/.test(mo.notes.join(" ")), "a working of one unit is not offered to a multiple-only unit: " + JSON.stringify(mo));
  // no multiple is fine on it, and RM104 - one unit, never attaches - is offered; RM106 attaches, 5R00 is a train of two
  const nm = B().run(D("375703", "3. Restriction NM"), res, {}).rows[0].suggest;
  assert.ok(!/NM —/.test(nm.notes.join("; ")), JSON.stringify(nm));
  assert.equal(nm.action, "RE BERTH 11+10 — T/F AT CHX");
  assert.ok(!/RM106|5R00/.test(nm.notes.join(" ")), "a working that attaches, or a train of two, is not offered to a no-multiple unit: " + JSON.stringify(nm));
  // 375702 on RM102 runs coupled with RM108, and a no-multiple unit is told so
  const two = B().run(D("375702", "3. Restriction NM"), res, {}).rows[0].suggest;
  assert.equal(two.action, "RE HOLD");
  assert.match(two.notes.join("; "), /NM — no multiple, but runs in multiple on 5J01 06\+00 today: check/, JSON.stringify(two));
  // and at Grove Park: the multiple-only unit takes 5R00, the no-multiple one is given RM104 for a depot swap
  assert.equal(B().run(D("375701", "2. Restriction MO"), res, {}).rows[0].suggest.action, "GP BERTH 5R00");
  assert.match(B().run(D("375701", "3. Restriction NM"), res, {}).rows[0].suggest.action, /^RE BERTH 11\+10/);
});

test("when the requests run out for an exam, the exams are swapped around with one that ends there tonight", async () => {
  const res = await swapDay();
  /* every way home to Ramsgate is wanted by its own unit today, so
     375703's A exam cannot get there; 375704 ends there tonight and its B
     exam is not due until Wednesday, so that exam is brought forward and
     375703's put back */
  const plan = ["Exams", "Unit Nr \tExam\t\tWhere\tAction",
    "375703\tA\tTUE AM 04/08\tRE\t", "375702\tA\tTUE AM 04/08\tRE\t", "375706\tA\tTUE AM 04/08\tRE\t",
    "375901\tA\tTUE AM 04/08\tRE\t", "375704\tB\tWED AM 05/08\tRE\t",
    "", "Defects", "Unit Nr \tDays\tPriority\tTarget Date\tAction ",
    "375704\t1\t4. EOD Safety Defect\t\t"].join("\n");
  const out = B().run(plan, res, {});
  const s = out.rows[0].suggest;
  assert.equal(s.action, "SWAP EXAM WITH 375704", JSON.stringify(s));
  assert.match(s.notes[0], /^375704's B exam WED 05\/08 AM \(\+2d\) brought forward — it ends RE 11\+20 tonight$/);
  assert.equal(out.swaps.length, 1);
  const o = out.rows.find(r => r.unit === "375704" && r.section === "EXAMS");
  assert.match(o.suggest.notes.join("; "), /exam brought forward for 375703 — see EXAM SWAPS/);
  assert.match(B().toText(out), /EXAM SWAPS\n=+\n\n1\) 375703 A EXAM TUE 04\/08 AM \(TOMORROW\) — SWAP WITH 375704 \(B EXAM WED 05\/08 AM \(\+2D\)\), ENDS RE 11\+20 TONIGHT/);
  assert.match(B().toHtml(out, false), /EXAM SWAPS/);
  /* but not with a unit that other maintenance wants somewhere else now:
     375704 wanted at Gillingham ASAP is left alone, and 375703 is told
     where it ends */
  const busy = B().run(plan + "\n\nScheduled Maint\nUnit Nr \tWhere\tWhen\tFor\tAction\n375704\tGI\tASAP\tWHEEL LATHE\t", res, {});
  assert.equal(busy.rows[0].suggest.action, "ENDS HGS", JSON.stringify(busy.rows[0].suggest));
  assert.equal(busy.swaps.length, 0);
});

test("the portion is named where the train splits before the depot: FP leads, RP is the rear", async () => {
  /* RM102 and RM108 leave Grove Park on 5R00 coupled; at Ramsgate RM108
     goes on to Margate and only RM102 goes into the depot. The request to
     Grove Park names the portion, off the Summary's position. */
  const toMargate = (code, unit, pos) => ({ code, units: unit + ".", pos, stops: [S("GRVPCSD", "", "06:00", "5J01"), S("CANONST", "06:40", "06:50", "2K01"),
      S("GRVPCSD", "09:00", "14:10", "5R00"), S("RAMSGTE", "16:00", "16:10", "2R08"), S("MARGATE", "16:30", "", "")] });
  const withPos = (code, pos) => SWAP_DAY.map(d => d.code === code ? { ...d, pos } : d);
  const front = geniusPairCsv(withPos("RM102", 1).concat([toMargate("RM108", "375708", 2)]));
  const fp = B().run(planFor(["375701\tA\tTUE AM 04/08\tRE\t"]), await N.GENIUS.build([front.summary, front.detail]), {}).rows[0].suggest;
  assert.equal(fp.action, "GP BERTH FP 5R00", JSON.stringify(fp));
  const rear = geniusPairCsv(withPos("RM102", 2).concat([toMargate("RM108", "375708", 1)]));
  const rp = B().run(planFor(["375701\tA\tTUE AM 04/08\tRE\t"]), await N.GENIUS.build([rear.summary, rear.detail]), {}).rows[0].suggest;
  assert.equal(rp.action, "GP BERTH RP 5R00", JSON.stringify(rp));
  // the whole train into the depot: no portion
  const whole = geniusPairCsv(withPos("RM102", 1).concat([{ ...SWAP_DAY.find(d => d.code === "RM102"), code: "RM108", units: "375708.", pos: 2 }]));
  const w = B().run(planFor(["375701\tA\tTUE AM 04/08\tRE\t"]), await N.GENIUS.build([whole.summary, whole.detail]), {}).rows[0].suggest;
  assert.equal(w.action, "GP BERTH 5R00", JSON.stringify(w));
});

test("a unit that ends where it is not wanted is given tomorrow's working out of there - AFK BERTH RP 05 27", async () => {
  /* 375720 ends tonight in the Ashford East sidings, wanted at Ramsgate,
     and every way home today is its own unit's. Tomorrow's 05 27 out of
     Ashford runs as two diagrams; at Ramsgate the rear portion, RM121,
     goes into the depot and the front, RM122, on to Margate. */
  const day = SWAP_DAY.concat([
    { code: "RM120", units: "375720.", stops: [S("ASHFDNS", "", "05:00", "5A20"), S("CHRX", "07:00", "09:00", "2A21"), S("ASHFEBS", "20:00", "", "")] },
    { code: "RM121", units: "375721.", pos: 2, stops: [S("ASHFDNS", "", "05:27", "2R21"), S("RAMSGTE", "06:30", "06:40", "5R21"), S("RAMSGTD", "06:45", "", "")] },
    { code: "RM122", units: "375722.", pos: 1, stops: [S("ASHFDNS", "", "05:27", "2R21"), S("RAMSGTE", "06:30", "06:35", "2R21"), S("MARGATE", "06:55", "", "")] },
  ]);
  const p = geniusPairCsv(day); const res = await N.GENIUS.build([p.summary, p.detail]);
  const plan = planFor(["375720\tA\tTUE AM 04/08\tRE\t", "375704\tB\tTUE AM 04/08\tRE\t", "375702\tC\tTUE AM 04/08\tRE\t",
                        "375706\tA\tTUE AM 04/08\tRE\t", "375901\tA\tTUE AM 04/08\tRE\t"]);
  const s = B().run(plan, res, {}).rows[0].suggest;
  assert.equal(s.action, "AFK BERTH RP 05 27", JSON.stringify(s));
  assert.match(s.notes.join("; "), /tomorrow's 2R21 05 27 from AFK, RP \(RM121\+RM122\) — today's RM121 ends RE 06\+45, 375721 off it; check tomorrow's diagram runs the same/);
  // with RM104 free today, the changeover at Charing Cross comes first
  const today = B().run(planFor(["375720\tA\tTUE AM 04/08\tRE\t"]), res, {}).rows[0].suggest;
  assert.equal(today.action, "RE BERTH 11+10 — T/F AT CHX", JSON.stringify(today));
});

/* ---- the Summary's rows are working segments, each with its unit ---- */
test("a unit that changes at Grove Park: each unit's day is its own segments, and the PM working out is the request", async () => {
  /* RM912 is 375609 up to Grove Park in the morning on 5J93 and 375827 out
     of it in the evening on 5F87 to Ramsgate; RM914 is 375827 up in the
     morning on 5J95 and 375826 out in the evening on 5F83 to Ashford. So
     375609 ends the day at Grove Park, 375827 at Ramsgate, 375826 at
     Ashford - and 375609, wanted at Ramsgate, takes 5F87 off 375827. */
  const day = [
    { code: "RM912", stops: [S("RAMSGTD", "", "06:13", "5J93"), S("GRVPCSD", "09:54", "16:25", "5F87"), S("RAMSGTE", "19:40", "19:45", "5F87"), S("RAMSGTD", "19:54", "", "")],
      rows: [{ units: "375609.", pos: 1, start: "06:13", from: "RAMSGTD", to: "GRVPCSD", end: "09:54" },
             { units: "375827.", pos: 2, start: "16:25", from: "GRVPCSD", to: "RAMSGTD", end: "19:54" }] },
    { code: "RM914", stops: [S("RAMSGTD", "", "06:20", "5J95"), S("GRVPCSD", "09:20", "17:25", "5F83"), S("ASHFDNS", "19:53", "", "")],
      rows: [{ units: "375827.", pos: 1, start: "06:20", from: "RAMSGTD", to: "GRVPCSD", end: "09:20" },
             { units: "375826.", pos: 1, start: "17:25", from: "GRVPCSD", to: "ASHFDNS", end: "19:53" }] },
  ];
  const p = geniusPairCsv(day); const res = await N.GENIUS.build([p.summary, p.detail]);
  const out = B().run(planFor(["375609\tA\tTUE AM 04/08\tRE\t", "375827\tB\tWED AM 05/08\tRE\t", "375826\tC\tTUE AM 04/08\tRE\t"]), res, {});
  const [a, b, c] = out.rows;
  assert.equal(a.ends.place, "GP", "375609 ends at Grove Park, not where RM912 ends: " + JSON.stringify(a.ends));
  assert.equal(a.ends.time, 9 * 60 + 54);
  assert.equal(b.ends.place, "RE"); assert.equal(b.ends.time, 19 * 60 + 54);
  assert.deepEqual(norm(b.diags), ["RM914", "RM912"], "375827 is on both diagrams, morning and evening");
  assert.equal(c.ends.place, "AFK");
  assert.equal(b.suggest.action, "ENDS RE", "375827 ends at Ramsgate on 5F87, and is not wanted there until Wednesday");
  // 375609, on hand at Grove Park from the morning, goes out on 5F87 in 375827's place
  assert.equal(a.suggest.action, "GP BERTH 5F87", JSON.stringify(a.suggest));
  assert.match(a.suggest.notes.join("; "), /in on 5J93 09\+54, stays; out on 5F87: RM912, ends RE 19\+54, 375827 off it \(stays at GP\)/);
  assert.equal(a.suggest.notice, null);
  // 375826 is at Grove Park for the day too and 5F87 has one slot: it cannot get home, so
  // its exam is swapped with 375827's, which ends at Ramsgate tonight and is not due until Wednesday
  assert.equal(c.suggest.action, "SWAP EXAM WITH 375827", JSON.stringify(c.suggest));
  assert.ok(!/5F87/.test(c.suggest.action + c.suggest.notes.join(" ")), "5F87 is not offered twice: " + JSON.stringify(c.suggest));
  // and the line says both diagrams, morning and evening
  assert.match(B().render(out), /375827.*on RM914\+RM912 · ENDS RE 19\+54/);
});

test("a depot request lists the PM departures out of it, for the depot to choose", async () => {
  /* the unit-change day again, with RM916 leaving Grove Park at 15:40 on
     5F85 for Ramsgate: 375609, on hand at Grove Park from the morning, is
     offered both departures and the depot picks */
  const day = [
    { code: "RM912", stops: [S("RAMSGTD", "", "06:13", "5J93"), S("GRVPCSD", "09:54", "16:25", "5F87"), S("RAMSGTE", "19:40", "19:45", "5F87"), S("RAMSGTD", "19:54", "", "")],
      rows: [{ units: "375609.", pos: 1, start: "06:13", from: "RAMSGTD", to: "GRVPCSD", end: "09:54" },
             { units: "375827.", pos: 2, start: "16:25", from: "GRVPCSD", to: "RAMSGTD", end: "19:54" }] },
    { code: "RM916", units: "375716.", stops: [S("GRVPCSD", "", "15:40", "5F85"), S("RAMSGTE", "18:50", "18:55", "5F85"), S("RAMSGTD", "19:05", "", "")] },
  ];
  const p = geniusPairCsv(day); const res = await N.GENIUS.build([p.summary, p.detail]);
  const s = B().run(planFor(["375609\tA\tTUE AM 04/08\tRE\t"]), res, {}).rows[0].suggest;
  assert.equal(s.action, "GP BERTH 5F85/5F87", JSON.stringify(s));
  assert.match(s.notes.join("; "), /out on 5F85: RM916, ends RE 19\+05, 375716 off it/);
  assert.match(s.notes.join("; "), /out on 5F87: RM912, ends RE 19\+54, 375827 off it/);
  assert.match(s.notes.join("; "), /the depot to choose/);
  assert.equal(s.notice, null);
});
