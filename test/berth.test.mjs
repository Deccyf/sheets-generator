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
  assert.equal(c.tier, 3, "Saturday is five days off — later than the three days a request is made for");
  assert.equal(row("375603", "SCHEDULED MAINT").tier, 2);
  assert.equal(row("375602", "DEFECTS").tier, 3, "a week out is later");
  // an end-of-day defect with no date is due today
  const eod = B().run("Defects\nUnit Nr \tDays\tPriority\tTarget Date\tAction \n375601\t1\t4. EOD Safety Defect\t\t", res, {});
  assert.equal(eod.rows[0].ahead, 0); assert.equal(eod.rows[0].tier, 1);
  assert.match(eod.rows[0].suggest.notes.join("; "), /no call at RE today/, "and is answered as today's");
  assert.equal(row("375699", "EXAMS").inTraffic, false);
  assert.equal(row("375698", "EXAMS").ignored, true);
  // nearest first in the tiered list; the plan's own order in rows
  assert.deepEqual(norm(out.tiered.map(r => r.tier)), [1, 1, 1, 1, 1, 2, 3, 3]);
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
  // the defect due tomorrow: no call at Ramsgate today, and it says so - and
  // the unit is asked for once, so the line carries its exam's request
  const d = sug("375601", "DEFECTS");
  assert.equal(d.action, "AFK BERTH off 2A01", JSON.stringify(d));
  assert.match(d.notes.join("; "), /no call at RE today; the same request as its other line/);
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
  // the standing fleet move out of Slade Green the next morning is the request
  assert.equal(move.action, "SG BERTH 5Y17/5U92", JSON.stringify(move));
  assert.match(move.notes.join("; "), /tomorrow's fleet move 5Y17 10\+10 SG - RE \(SuX\)/, "the standing path the next morning");
  const amat = s({ ...base, section: "DEFECTS", category: "PERF", amat: true });
  assert.equal(amat.action, "AMAT — NO REQUEST");
  const restricted = s({ ...base, section: "DEFECTS", category: "MO", amat: true, tier: 1, ahead: 1,
                         endsAtTarget: true, afterMidnight: true, ends: { place: "RE", time: 1440 + 37 } });
  assert.equal(restricted.action, "RE HOLD FOR MON", "restricted AND awaiting materials still needs one");
  assert.match(restricted.notes.join("; "), /after midnight — counts/);
});

test("the plan comes back in its own shape, the suggestion in the Action column and the reason beside it", async () => {
  const res = await weekday();
  const out = B().run(BLANK, res, { ignore: "375698" });
  const shape = B().shape(out);
  assert.deepEqual(norm(shape.map(s => s.title)), ["Exams", "Scheduled Maint", "Defects"]);
  assert.deepEqual(norm(shape[0].headers), ["Unit Nr", "Exam", "When", "Where", "Action", "Why"]);
  assert.deepEqual(norm(shape[2].headers), ["Unit Nr", "Days", "Priority", "Target Date", "Action", "Why"]);
  assert.deepEqual(norm(shape[0].rows.map(r => r.cls)), ["ex-a", "ex-b", "ex-c", "ex-a", "ex-x"],
    "A black, B green, C red, XS50 blue - the workbook's colours");
  assert.ok(shape[0].rows.every(r => r.filled), "an empty Action is filled");
  const text = B().toText(out);
  // 375601 is multiple only on its defect line, so its exam line carries the check too
  assert.match(text, /^Exams\nUnit Nr\tExam\tWhen\tWhere\tAction\tWhy\n375601\tA\tTUE AM 04\/08\tAFK\tAFK BERTH off 2A01\tMO — multiple only, but runs as one unit on 2A02 09 00 today: check · at AFK 05\+35, leaves on 2A01 · on GT101 · ENDS DVP 23\+50 · calls AFK 05\+35 off 2A01, AFK 10 30 off 5A03, AFK 10\+40 \(stands 3\.3 h\) off 5A05 \+1 more$/m,
    "tab-separated, the workbook's columns with the suggestion in Action and the reason beside it: " + text.split("\n").slice(0, 3).join(" | "));
  // a plan line that had its own action keeps it in the reason
  const kept = B().run(PLAN, res, { ignore: "375698" });
  const line = B().toText(kept).split("\n").find(l => /^375601\tA\t/.test(l));
  assert.match(line, /\tAFK BERTH off 2A01\tplan had: AFK HOLD · MO — multiple only, but runs as one unit on 2A02 09 00 today: check · at AFK 05\+35/, line);
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
  assert.match(late.action, /^ENDS HGS/, JSON.stringify(late));
  assert.match(late.notes.join("; "), /no call at RE today; no request at HGS — none are made there/);
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
  const p = B().priorityOf;
  const lt = (a, b) => { const x = p(a), y = p(b); for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] < y[i]; return false; };
  const L = (o) => ({ tier: 1, ahead: 1, red: false, con: false, line: 5, ...o });
  assert.ok(lt(L({ ahead: 0, line: 9 }), L({ ahead: 1, con: true, line: 1 })), "a concession does not jump a line due sooner");
  assert.ok(lt(L({ red: true, line: 9 }), L({ con: true, line: 1 })), "RED before CON at the same date");
  assert.ok(lt(L({ con: true, line: 9 }), L({ line: 1 })), "CON before the plain line at the same date");
  assert.ok(lt(L({ line: 1 }), L({ line: 9 })), "then the plan's own order");
  /* 375703 (RM103) and 375715 (RM115) are both at Charing Cross in
     RM104's window. Plan order has 375703 first, but 375715 is due today
     and 375703 tomorrow, so 375715 is answered first and gets RM104;
     375703 is given the next, RM106. */
  const day = SWAP_DAY.concat([{ code: "RM115", units: "375715.", stops: [S("ASHFDNS", "", "05:05", "5A15"), S("ASHFKY", "05:15", "05:25", "2A15"),
      S("CHRX", "07:05", "09:35", "2A16"), S("HASTING", "11:05", "11:15", "5H15"), S("HASTPSD", "11:25", "", "")] }]);
  const q = geniusPairCsv(day); const res = await N.GENIUS.build([q.summary, q.detail]);
  const out = B().run(planFor(["375703\tA\tTUE AM 04/08\tRE\t", "375715\tB\tMON AM 03/08\tRE\t"]), res, {});
  const [s3, s15] = out.rows.map(r => r.suggest);
  assert.equal(s15.action, "RE BERTH 11+10 — T/F AT CHX", "375715, due today, gets RM104: " + JSON.stringify(s15));
  assert.equal(s3.action, "RE BERTH 11+15 — T/F AT CHX", "375703 is given the next, RM106, not RM104 twice: " + JSON.stringify(s3));
  assert.deepEqual(norm(out.tiered.map(r => r.unit)), ["375715", "375703"], "nearest first lists them in that order");
  assert.deepEqual(norm(out.rows.map(r => r.unit)), ["375703", "375715"], "the plan keeps its own order");
});

test("a 12-car is three diagrams on one working: it carries three requests, an 8-car two", async () => {
  /* RM102, RM108 and RM118 run 5R00 out of Grove Park coupled, one unit
     each. Four units are on hand at Grove Park for the day - RM101, RM121,
     RM131, RM141 - and want Ramsgate: three get 5R00, one per diagram, and
     the fourth is given tomorrow's 5J01 out of Grove Park instead. */
  const twin = (code, unit, pos) => ({ code, units: unit + ".", pos, stops: [S("GRVPCSD", "", "06:00", "5J01"), S("CANONST", "06:40", "06:50", "2K01"),
      S("GRVPCSD", "09:00", "14:10", "5R00"), S("RAMSGTE", "16:00", "16:10", "5R00"), S("RAMSGTD", "16:20", "", "")] });
  const atGP = (code, unit, arr, dep) => ({ code, units: unit + ".", stops: [S("RAMSGTD", "", "05:00", "5J70"), S("CHRX", "07:30", "07:40", "5J70"),
      S("GRVPCSD", arr, dep, "5F43"), S("CANONST", "14:20", "14:30", "2P43"), S("GRVPKUS", "22:00", "", "")] });
  const day = SWAP_DAY.concat([twin("RM108", "375708", 2), twin("RM118", "375718", 3),
    atGP("RM121", "375721", "08:50", "13:50"), atGP("RM131", "375731", "09:10", "13:55"), atGP("RM141", "375741", "09:30", "14:00")]);
  const p = geniusPairCsv(day); const res = await N.GENIUS.build([p.summary, p.detail]);
  const out = B().run(planFor(["375701\tA\tTUE AM 04/08\tRE\t", "375721\tB\tTUE AM 04/08\tRE\t",
                               "375731\tC\tTUE AM 04/08\tRE\t", "375741\tA\tTUE AM 04/08\tRE\t"]), res, {});
  const s = out.rows.map(r => r.suggest);
  assert.equal(s[0].action, "GP BERTH 5R00", JSON.stringify(s[0]));
  assert.match(s[0].notes.join("; "), /375702 off it \(takes 5F43\)/);
  assert.match(s[0].notes.join("; "), /5R00 runs as 3 units \(RM102\+RM108\+RM118\) — request 1 of 3/);
  assert.equal(s[1].action, "GP BERTH 5R00", JSON.stringify(s[1]));
  assert.match(s[1].notes.join("; "), /375708 off it.*request 2 of 3/);
  assert.match(s[2].notes.join("; "), /375718 off it.*request 3 of 3/);
  /* the fourth is offered tomorrow's departure out of Grove Park - the
     morning start of the diagram, its PM leg off the stand back at Grove
     Park being the same working and not named twice */
  assert.equal(s[3].action, "GP BERTH 5J01", "tomorrow's departure: " + JSON.stringify(s[3]));
  assert.ok(!/5R00/.test(s[3].action), JSON.stringify(s[3]));
  // with 375708 wanted at Ramsgate itself, RM108 is not displaced and the train has two slots
  const two = B().run(planFor(["375701\tA\tTUE AM 04/08\tRE\t", "375721\tB\tTUE AM 04/08\tRE\t",
                               "375731\tC\tTUE AM 04/08\tRE\t", "375708\tA\tTUE AM 04/08\tRE\t"]), res, {});
  const t = two.rows.map(r => r.suggest);
  assert.match(t[0].notes.join("; "), /375702 off it/);
  assert.match(t[1].notes.join("; "), /375718 off it/, "375708 is not displaced: " + JSON.stringify(t[1]));
  assert.equal(t[2].action, "GP BERTH 5J01", "no third swap today; tomorrow's departure instead: " + JSON.stringify(t[2]));
  assert.ok(!/RM108 ends/.test(t[2].notes.join("; ")), "375708's diagram, wanted at Ramsgate itself, is not offered: " + JSON.stringify(t[2]));
  assert.equal(t[3].action, "RE HOLD");
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
  // a defect is asked for whenever it is due: a week on, at its own depot, it is the departures that bring it back
  assert.match(defects.find(r => r.unit === "375704").suggest.action, /^RE BERTH /);
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
  assert.match(mo.action, /^ENDS HGS/, JSON.stringify(mo));
  assert.ok(!/RM104/.test(mo.notes.join(" ")), "a working of one unit is not offered to a multiple-only unit: " + JSON.stringify(mo));
  // no multiple is on one end: RM104 is still first for 375703, and RM103 runs alone all day so nothing to check
  const nm = B().run(D("375703", "3. Restriction NM"), res, {}).rows[0].suggest;
  assert.ok(!/NM —/.test(nm.notes.join("; ")), "RM103 runs alone all day: " + JSON.stringify(nm));
  assert.equal(nm.action, "RE BERTH 11+10 — T/F AT CHX");
  // 375702 on RM102 runs coupled with RM108, and a no-multiple unit is told to check the end
  const two = B().run(D("375702", "3. Restriction NM"), res, {}).rows[0].suggest;
  assert.equal(two.action, "RE HOLD");
  assert.match(two.notes.join("; "), /NM — no multiple on one end: check which end couples on 5J01 06\+00 today/, JSON.stringify(two));
  // and at Grove Park: the multiple-only unit takes 5R00, and so does the no-multiple one, with the end to check
  assert.equal(B().run(D("375701", "2. Restriction MO"), res, {}).rows[0].suggest.action, "GP BERTH 5R00");
  const nmgp = B().run(D("375701", "3. Restriction NM"), res, {}).rows[0].suggest;
  assert.equal(nmgp.action, "GP BERTH 5R00", JSON.stringify(nmgp));
  assert.match(nmgp.notes.join("; "), /NM — check which end couples on 5R00/);
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
  assert.match(busy.rows[0].suggest.action, /^ENDS HGS/, JSON.stringify(busy.rows[0].suggest));
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
  assert.match(s.notes.join("; "), /tomorrow's 2R21 05 27 \(RM121\+RM122\): RM121 ends RE 06\+45, RM122 calls RE 06\+30, where it can be taken off; check tomorrow's diagram runs the same/);
  // with RM104 free today, the changeover at Charing Cross comes first
  const today = B().run(planFor(["375720\tA\tTUE AM 04/08\tRE\t"]), res, {}).rows[0].suggest;
  assert.equal(today.action, "RE BERTH 11+10 — T/F AT CHX", JSON.stringify(today));
});

/* ---- the Summary's rows are working segments, each with its unit ---- */
test("a unit that changes at Grove Park: each unit's day is its own segments, and the PM working out is the request", async () => {
  /* RM912 is 375609 up to Grove Park in the morning on 5J93 and 375827 out
     of it in the evening on 5F87 to Ramsgate; RM914 is 375827 up in the
     morning on 5J95 and 375826 out in the evening on 5F83 to Tonbridge. So
     375609 ends the day at Grove Park, 375827 at Ramsgate, 375826 at
     Tonbridge - and 375609, wanted at Ramsgate, takes 5F87 off 375827. */
  const day = [
    { code: "RM912", stops: [S("RAMSGTD", "", "06:13", "5J93"), S("GRVPCSD", "09:54", "16:25", "5F87"), S("RAMSGTE", "19:40", "19:45", "5F87"), S("RAMSGTD", "19:54", "", "")],
      rows: [{ units: "375609.", pos: 1, start: "06:13", from: "RAMSGTD", to: "GRVPCSD", end: "09:54" },
             { units: "375827.", pos: 2, start: "16:25", from: "GRVPCSD", to: "RAMSGTD", end: "19:54" }] },
    { code: "RM914", stops: [S("RAMSGTD", "", "06:20", "5J95"), S("GRVPCSD", "09:20", "17:25", "5F83"), S("TONBDMS", "19:53", "", "")],
      rows: [{ units: "375827.", pos: 1, start: "06:20", from: "RAMSGTD", to: "GRVPCSD", end: "09:20" },
             { units: "375826.", pos: 1, start: "17:25", from: "GRVPCSD", to: "TONBDMS", end: "19:53" }] },
  ];
  const p = geniusPairCsv(day); const res = await N.GENIUS.build([p.summary, p.detail]);
  const out = B().run(planFor(["375609\tA\tTUE AM 04/08\tRE\t", "375827\tB\tWED AM 05/08\tRE\t", "375826\tC\tTUE AM 04/08\tRE\t"]), res, {});
  const [a, b, c] = out.rows;
  assert.equal(a.ends.place, "GP", "375609 ends at Grove Park, not where RM912 ends: " + JSON.stringify(a.ends));
  assert.equal(a.ends.time, 9 * 60 + 54);
  assert.equal(b.ends.place, "RE"); assert.equal(b.ends.time, 19 * 60 + 54);
  assert.deepEqual(norm(b.diags), ["RM914", "RM912"], "375827 is on both diagrams, morning and evening");
  assert.equal(c.ends.place, "TON");
  /* 375827 ends at Ramsgate on 5F87 and is not wanted there until
     Wednesday: out again tomorrow on a peak diagram - its own, which
     stands at Grove Park through the day - the way the plan lists them */
  assert.equal(b.suggest.action, "RE BERTH 06+13", JSON.stringify(b.suggest));
  assert.match(b.suggest.notes.join("; "), /\(its own diagram\)/);
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

test("keep trains together: a request that splits the train comes only after every one that does not", async () => {
  /* RM113 runs coupled with RM103 up to Charing Cross and ends there, so
     375703 arrives at Charing Cross as a pair. The changeover onto RM104
     splits the pair; the depot swap onto RM102 does not. */
  const day = SWAP_DAY.map(d => d.code !== "RM103" ? d : { ...d, stops: [S("ASHFDNS", "", "05:00", "5A03"), S("ASHFKY", "05:10", "05:20", "2A03"),
      S("CHRX", "07:00", "09:30", "2A04"), S("GRVPCSD", "10:00", "14:00", "5G03"), S("HASTING", "15:30", "15:40", "5H03"), S("HASTPSD", "15:50", "", "")] })
    .concat([{ code: "RM113", units: "375713.", pos: 2, stops: [S("ASHFDNS", "", "05:00", "5A03"), S("ASHFKY", "05:10", "05:20", "2A03"), S("CHRX", "07:00", "", "")] }]);
  const p = geniusPairCsv(day); const res = await N.GENIUS.build([p.summary, p.detail]);
  const plan = planFor(["375703\tA\tTUE AM 04/08\tRE\t"]);
  const loose = B().run(plan, res, {}).rows[0].suggest;
  assert.equal(loose.action, "RE BERTH 11+10 — T/F AT CHX", JSON.stringify(loose));
  assert.match(loose.notes.join("; "), /splits the 2-unit formation it arrives in — 375713 left/);
  const kept = B().run(plan, res, { keep: true }).rows[0].suggest;
  assert.equal(kept.action, "GP BERTH 5R00", "the Grove Park swap after the pair has split: " + JSON.stringify(kept));
  assert.ok(!/splits the/.test(kept.notes.join("; ")), JSON.stringify(kept));
  // with nothing else, the splitting request is still made
  const only = B().run(planFor(["375703\tA\tTUE AM 04/08\tRE\t", "375702\tA\tTUE AM 04/08\tRE\t", "375901\tA\tTUE AM 04/08\tRE\t"]), res, { keep: true }).rows[0].suggest;
  assert.match(only.action, /T\/F AT CHX$/, JSON.stringify(only));
  assert.match(only.notes.join("; "), /splits the 2-unit formation/);
});

test("nobody at Folkestone East or Hastings, and Faversham can be asked but never split", async () => {
  const day = SWAP_DAY.concat([
    // 375740 ends alone at Folkestone East; tomorrow's 5F41 out of there goes to Ramsgate, but there is nobody to ask
    { code: "RM140", units: "375740.", stops: [S("ASHFDNS", "", "05:00", "5A40"), S("FLKSETR", "06:00", "", "")] },
    { code: "RM141", units: "375741.", stops: [S("FLKSETR", "", "05:20", "5F41"), S("RAMSGTE", "06:20", "06:25", "5F41"), S("RAMSGTD", "06:40", "", "")] },
    // 375730+375731 end at Faversham as a pair; tomorrow's 05 30 out of there is two diagrams to Ramsgate
    { code: "RM130", units: "375730.", pos: 1, stops: [S("ASHFDNS", "", "05:30", "5A30"), S("FAVRSHM", "06:30", "", "")] },
    { code: "RM131", units: "375731.", pos: 2, stops: [S("ASHFDNS", "", "05:30", "5A30"), S("FAVRSHM", "06:30", "", "")] },
    { code: "RM132", units: "375732.", pos: 1, stops: [S("FAVRSHM", "", "05:30", "5F32"), S("RAMSGTE", "06:10", "06:15", "5F32"), S("RAMSGTD", "06:30", "", "")] },
    { code: "RM133", units: "375733.", pos: 2, stops: [S("FAVRSHM", "", "05:30", "5F32"), S("RAMSGTE", "06:10", "06:15", "5F32"), S("RAMSGTD", "06:30", "", "")] },
  ]);
  const p = geniusPairCsv(day); const res = await N.GENIUS.build([p.summary, p.detail]);
  const block = ["375704\tA\tTUE AM 04/08\tRE\t", "375702\tA\tTUE AM 04/08\tRE\t", "375706\tA\tTUE AM 04/08\tRE\t", "375901\tA\tTUE AM 04/08\tRE\t"];
  const fke = B().run(planFor(["375740\tA\tTUE AM 04/08\tRE\t"].concat(block)), res, {}).rows[0].suggest;
  assert.match(fke.action, /^ENDS FKE/, "no request at Folkestone East: " + JSON.stringify(fke));
  // one of the pair wanted: a request at Faversham would split the pair, so none is made
  const one = B().run(planFor(["375730\tA\tTUE AM 04/08\tRE\t"].concat(block)), res, {}).rows[0].suggest;
  assert.match(one.action, /^ENDS FAV/, "Faversham cannot split the pair: " + JSON.stringify(one));
  // both wanted: the pair goes together on the 05 30, which is a request Faversham can take
  const both = B().run(planFor(["375730\tA\tTUE AM 04/08\tRE\t", "375731\tB\tTUE AM 04/08\tRE\t"].concat(block)), res, {});
  const [a, b] = both.rows.map(r => r.suggest);
  assert.equal(a.action, "FAV BERTH 05+30", JSON.stringify(a));
  assert.equal(b.action, "FAV BERTH 05+30", JSON.stringify(b));
  assert.match(a.notes.join("; "), /with its formation 375731/);
  assert.match(b.notes.join("; "), /with its formation 375730/);
});

test("every unit at a place is offered the same departures, and told whose list a departure is on already", async () => {
  /* 375750 and 375760 both end at West Marina tonight, alone, wanted at
     Ramsgate; tomorrow's 5H91 out of there is one diagram that stands at
     Ramsgate during the day. Both are given it - the plan writes the one
     list against each unit and the depot chooses - and the second is
     told the first has it too. */
  const day = SWAP_DAY.concat([
    { code: "RM150", units: "375750.", stops: [S("ASHFDNS", "", "05:00", "5A50"), S("STLNWMS", "06:30", "", "")] },
    { code: "RM160", units: "375760.", stops: [S("ASHFDNS", "", "05:10", "5A60"), S("STLNWMS", "06:40", "", "")] },
    { code: "RM159", units: "375759.", stops: [S("STLNWMS", "", "06:01", "5H91"), S("RAMSGTE", "07:30", "07:40", "5H91"), S("RAMSGTD", "07:50", "12:00", "2R59"), S("MARGATE", "12:30", "", "")] },
  ]);
  const p = geniusPairCsv(day); const res = await N.GENIUS.build([p.summary, p.detail]);
  const block = ["375704\tA\tTUE AM 04/08\tRE\t", "375702\tA\tTUE AM 04/08\tRE\t", "375706\tA\tTUE AM 04/08\tRE\t", "375901\tA\tTUE AM 04/08\tRE\t"];
  const out = B().run(planFor(["375750\tA\tTUE AM 04/08\tRE\t", "375760\tB\tTUE AM 04/08\tRE\t"].concat(block)), res, {});
  const [a, b] = out.rows.map(r => r.suggest);
  assert.equal(a.action, "XSE BERTH 06+01", JSON.stringify(a));
  assert.match(a.notes.join("; "), /tomorrow's 5H91 06\+01: RM159 stands RE 07\+50/);
  assert.equal(b.action, "XSE BERTH 06+01", JSON.stringify(b));
  assert.match(b.notes.join("; "), /06\+01 is on 375750's list too/);
  assert.ok(!/list too/.test(a.notes.join("; ")), "the first is told nothing");
});

/* ---- the two turns: a Summary with tomorrow's Detail, and a Summary alone ---- */
test("day turn: today's Summary with tomorrow's Diagram Detail gives tomorrow's departures as its own", async () => {
  /* Today's pair says 375701 ends at Grove Park. Tomorrow's Detail, dropped
     too, has RM150 out of Grove Park at 05:40 to Ramsgate - a diagram
     today's Detail does not have - and that, not a proxy, is the request. */
  const today = geniusPairCsv(SWAP_DAY);
  const tomorrow = geniusPairCsv([
    { code: "RM150", stops: [S("GRVPCSD", "", "05:40", "5J50"), S("RAMSGTE", "07:20", "07:25", "5J50"), S("RAMSGTD", "07:35", "", "")] },
    { code: "RM102", stops: [S("GRVPCSD", "", "06:00", "5J01"), S("CANONST", "06:40", "06:50", "2K01"), S("GRVPCSD", "09:00", "14:10", "5R00"), S("RAMSGTE", "16:00", "16:10", "5R00"), S("RAMSGTD", "16:20", "", "")] },
  ]).detail.replace(/03\/08\/26/g, "04/08/26");
  const rd = await N.GENIUS.read([today.summary, today.detail, tomorrow]);
  assert.deepEqual(norm([...rd.detail.keys()].sort()), ["03/08/26", "04/08/26"]);
  const out = B().run(planFor(["375701\tA\tTUE AM 04/08\tRE\t"]), rd, {});
  assert.ok(out.reviews.some(m => /departures are off the 04\/08\/26 Diagram Detail, tomorrow's/.test(m)), out.reviews.join(" | "));
  const s = out.rows[0].suggest;
  // today's swap still comes first where there is one: RM102's 5R00 out of Grove Park
  assert.equal(s.action, "GP BERTH 5R00", JSON.stringify(s));
  // with 375702 wanted at Ramsgate, RM102 is its own and tomorrow's RM150 is the request, with no proxy note
  const blocked = B().run(planFor(["375701\tA\tTUE AM 04/08\tRE\t", "375702\tA\tTUE AM 04/08\tRE\t", "375704\tA\tTUE AM 04/08\tRE\t"]), rd, {});
  const t = blocked.rows[0].suggest;
  // tomorrow's RM102 is not allocated yet, so 375702's want today does not protect it
  assert.equal(t.action, "GP BERTH 5J50/5J01", JSON.stringify(t));
  assert.match(t.notes.join("; "), /tomorrow's 5J50 05\+40: RM150 ends RE 07\+35; tomorrow's 5J01 06\+00: RM102 ends RE 16\+20/);
  assert.ok(!/check tomorrow's diagram/.test(t.notes.join("; ")), "no proxy note when tomorrow's Detail is there: " + JSON.stringify(t));
});

test("a Summary on its own says where every unit ends tonight, and what it cannot see", async () => {
  const p = geniusPairCsv(SWAP_DAY);
  const rd = await N.GENIUS.read([p.summary]);
  assert.equal(rd.summary.length, 7);
  assert.equal(rd.detail.size, 0);
  const out = B().run(planFor(["375701\tA\tTUE AM 04/08\tRE\t", "375704\tB\tTUE AM 04/08\tRE\t"]), rd, {});
  assert.equal(out.inTraffic, 2);
  assert.equal(out.rows[0].ends.place, "GP");
  assert.equal(out.rows[1].suggest.action, "RE HOLD", "375704 ends at Ramsgate, off the Summary alone");
  // nothing can be swapped without the Detail: the standing fleet move out of Grove Park is all there is
  assert.equal(out.rows[0].suggest.action, "GP BERTH 5R00", JSON.stringify(out.rows[0].suggest));
  assert.match(out.rows[0].suggest.notes.join("; "), /tomorrow's fleet move 5R00 11\+12 GP - RE \(M-F\)/);
  assert.ok(out.reviews.some(m => /No Diagram Detail for 03\/08\/26: where each unit ends tonight is read off the Summary alone/.test(m)), out.reviews.join(" | "));
  assert.ok(!out.reviews.some(m => /has no units on it/.test(m)), "the Summary has units, and is not told it has none");
});

test("a Summary printed as a PDF after allocation carries its units, so the plan's units are in traffic", async () => {
  const { makePdf, SUMMARY_LINES, DETAIL_LINES } = await import("./helpers/synth.mjs");
  const withUnits = SUMMARY_LINES.map(l => l.startsWith("GT101") ? l.replace("GT101  375/6", "GT101  375601.  375/6") : l);
  const res = await N.GENIUS.build([makePdf(withUnits, N.fflate), makePdf(DETAIL_LINES, N.fflate)]);
  const out = B().run(planFor(["375601\tA\tTUE AM 04/08\tAFK\t"]), res, {});
  assert.equal(out.rows[0].inTraffic, true, "375601 is found on GT101 off the PDF");
  assert.equal(out.rows[0].suggest.action, "AFK BERTH off 2A01");
  assert.ok(!out.reviews.some(m => /has no units on it/.test(m)), out.reviews.join(" | "));
});

test("a line due this week gets a request too, after the near lines, and no hold", async () => {
  /* 375703's exam is Thursday, three days off a Monday: this week, not
     near. It still gets the Charing Cross changeover, said to be due
     Thursday - after 375715, due today, has had RM104. And 375704, ending
     at Ramsgate tonight for a Thursday exam, is not held: it works again. */
  const day = SWAP_DAY.concat([{ code: "RM115", units: "375715.", stops: [S("ASHFDNS", "", "05:05", "5A15"), S("ASHFKY", "05:15", "05:25", "2A15"),
      S("CHRX", "07:05", "09:35", "2A16"), S("HASTING", "11:05", "11:15", "5H15"), S("HASTPSD", "11:25", "", "")] }]);
  const q = geniusPairCsv(day); const res = await N.GENIUS.build([q.summary, q.detail]);
  const out = B().run(planFor(["375703\tA\tTHU AM 06/08\tRE\t", "375715\tB\tMON AM 03/08\tRE\t", "375704\tB\tTHU AM 06/08\tRE\t"]), res, {});
  const [s3, s15, s4] = out.rows.map(r => r.suggest);
  assert.equal(out.rows[0].tier, 2);
  assert.equal(s15.action, "RE BERTH 11+10 — T/F AT CHX", "due today, first: " + JSON.stringify(s15));
  assert.equal(s3.action, "RE BERTH 11+15 — T/F AT CHX", "this week, next: " + JSON.stringify(s3));
  assert.match(s3.notes.join("; "), /^due THU 06\/08 AM \(\+3d\)/);
  /* at its own depot and not due tomorrow: the peak diagram that stands at
     Grove Park through the day, not the one back the same day */
  assert.equal(s4.action, "RE BERTH 05+00", "a peak diagram out of its own depot: " + JSON.stringify(s4));
  assert.match(s4.notes.join("; "), /^due THU 06\/08 AM \(\+3d\)/);
  assert.match(s4.notes.join("; "), /tomorrow's 5J70 05\+00: RM101 stands GP 08\+30 — GP to send it on/);
  assert.match(s4.notes.join("; "), /back here the same day: 06 00, 06 02, 06 05/);
  // a week and more out is still where it ends, and nothing more
  const far = B().run(planFor(["375703\tA\tMON AM 17/08\tRE\t"]), res, {}).rows[0].suggest;
  assert.match(far.action, /^ENDS HGS/, JSON.stringify(far));
});

test("a Detail for the next day it exists for is used, and the Review says how many days on", async () => {
  /* Monday's Summary with Thursday's Detail - the Friday-and-Monday shape,
     three days on: the departures are off it, and said to be */
  const today = geniusPairCsv(SWAP_DAY);
  const later = geniusPairCsv([{ code: "RM150", stops: [S("GRVPCSD", "", "05:40", "5J50"), S("RAMSGTE", "07:20", "07:25", "5J50"), S("RAMSGTD", "07:35", "", "")] }])
    .detail.replace(/03\/08\/26/g, "06/08/26");
  const rd = await N.GENIUS.read([today.summary, later]);
  const out = B().run(planFor(["375701\tA\tTUE AM 04/08\tRE\t"]), rd, {});
  assert.ok(out.reviews.some(m => /departures are off the 06\/08\/26 Detail, 3 days on/.test(m)), out.reviews.join(" | "));
  assert.equal(out.rows[0].suggest.action, "GP BERTH 5J50", JSON.stringify(out.rows[0].suggest));
});

/* ---- a unit on no working: where the plan says it stands ---- */
test("the plan's own Action says where a unit stands, and a unit on no working is asked for from there", async () => {
  const pf = B().placeFromAction;
  assert.equal(pf("STOPPED RE"), "RE"); assert.equal(pf("O/H AFK"), "AFK"); assert.equal(pf("SP @ GP"), "GP");
  assert.equal(pf("ENDS DVP"), "DVP"); assert.equal(pf("RE HOLD"), "RE"); assert.equal(pf("AFK HOLD FOR MON"), "AFK");
  assert.equal(pf("RE C/O AND HOLD"), "RE"); assert.equal(pf("GP BERTH 5N32/5F28"), "GP"); assert.equal(pf("O/O/S GP"), "GP");
  assert.equal(pf(""), null); assert.equal(pf("AMAT — NO REQUEST"), null);
  const res = await swapDay();
  /* 375799 is on no working. The plan has it O/H at Grove Park, so it is
     offered tomorrow's departures out of Grove Park that end at Ramsgate;
     375798 is STOPPED RE for an exam at RE, so it is there already; and
     375797, with nothing said, is simply not in traffic. */
  const out = B().run(planFor(["375799\tA\tTUE AM 04/08\tRE\tO/H GP", "375798\tB\tTUE AM 04/08\tRE\tSTOPPED RE", "375797\tA\tTUE AM 04/08\tRE\t"]), res, {});
  const [a, b, c] = out.rows;
  assert.equal(a.inTraffic, false); assert.equal(a.standing, "GP"); assert.equal(a.ends.place, "GP");
  assert.equal(a.suggest.action, "GP BERTH 5J01", JSON.stringify(a.suggest));
  assert.match(a.suggest.notes.join("; "), /^not in traffic — at GP per the plan \(O\/H GP\)/);
  assert.match(B().render(out), /375799.*not in traffic today — at GP per the plan/);
  // a stopped unit keeps the plan's own word for it
  assert.equal(b.suggest.action, "STOPPED RE", JSON.stringify(b.suggest));
  assert.equal(c.suggest.action, "NOT IN TRAFFIC");
  assert.equal(out.inTraffic, 0, "the count is what the reports say");
});

test("a Summary allocated in part says which diagrams have no units yet", async () => {
  // the SG rows carry units, the RM rows do not: printed before the 375s were allocated
  const day = SWAP_DAY.map(d => ({ ...d, units: "" })).concat([{ code: "SG401", units: "465044.", fleet: "465/9",
    stops: [S("SLADEGD", "", "05:00", "5N01"), S("CANONST", "06:00", "06:10", "2N01"), S("SLADEGD", "07:00", "", "")] }]);
  const p = geniusPairCsv(day); const rd = await N.GENIUS.read([p.summary, p.detail]);
  const out = B().run(planFor(["375701\tA\tTUE AM 04/08\tRE\t"]), rd, {});
  assert.equal(out.rows[0].suggest.action, "NOT IN TRAFFIC");
  assert.ok(out.reviews.some(m => /has units on 1 of 8 workings and none on the RM diagrams — those were not allocated when it was printed/.test(m)), out.reviews.join(" | "));
});

/* ---- a day still to run, and the weekend prints ---- */
test("a day still to run: a unit is where its first working starts, and is asked for from there before it goes out", async () => {
  /* RM121 starts at Ashford at 05 27 and ends at Ramsgate. 375703, on RM103
     out of Ashford, wanted at Ramsgate, with every swap home its own
     unit's: read as a day to run it is offered RM121's working before it
     goes out; read as a day gone it is not. */
  const day = SWAP_DAY.concat([{ code: "RM121", units: "375721.", stops: [S("ASHFDNS", "", "05:27", "2R21"), S("RAMSGTE", "06:30", "06:40", "5R21"), S("RAMSGTD", "06:45", "", "")] }]);
  const p = geniusPairCsv(day); const res = await N.GENIUS.build([p.summary, p.detail]);
  const plan = planFor(["375703\tA\tTUE AM 04/08\tRE\t", "375704\tB\tTUE AM 04/08\tRE\t", "375702\tC\tTUE AM 04/08\tRE\t",
                        "375706\tA\tTUE AM 04/08\tRE\t", "375901\tA\tTUE AM 04/08\tRE\t"]);
  const run = B().run(plan, res, { dayToRun: true });
  const s = run.rows[0].suggest;
  assert.equal(s.action, "AFK BERTH 05 27", JSON.stringify(s));
  assert.match(s.notes.join("; "), /today's 2R21 05 27: RM121 ends RE 06\+45/);
  assert.ok(!/check tomorrow/.test(s.notes.join("; ")));
  assert.ok(run.reviews.some(m => /Read as a day still to run/.test(m)), run.reviews.join(" | "));
  const gone = B().run(plan, res, {}).rows[0].suggest;
  assert.ok(!/05 27/.test(gone.action), "a day gone is not asked for at its start: " + JSON.stringify(gone));
  // a swap today still comes first: with RM104 free, the Charing Cross changeover
  const free = B().run(planFor(["375703\tA\tTUE AM 04/08\tRE\t"]), res, { dayToRun: true }).rows[0].suggest;
  assert.equal(free.action, "RE BERTH 11+10 — T/F AT CHX", JSON.stringify(free));
});

test("the weekend diagram prints read as that day's Detail, the print's places as Genius codes", async () => {
  const { PRINTS_LINES } = await import("./helpers/synth.mjs");
  const diags = N.SheetsEngine.parseDiagrams(PRINTS_LINES, []);
  const det = B().detailFromPrints(diags);
  assert.deepEqual(norm([...det.keys()]), ["01/08/26"]);
  const gt501 = det.get("01/08/26").get("GT501");
  assert.ok(gt501, "GT501 read: " + [...det.get("01/08/26").keys()].join(","));
  assert.deepEqual(norm(gt501.slice(0, 3).map(r => [r.code, r.arr, r.dep, r.hc])),
    [["ASHFDNS", null, 330, "5A01"], ["ASHFKY", 335, 345, "2A01"], ["CHRX", 420, 540, "2A02"]]);
  assert.equal(gt501[gt501.length - 1].code, "DOVERPS");
  assert.equal(gt501.find(r => r.name === "Ashfd EBS").code, "ASHFEBS");
  /* with a Summary for that Saturday putting 375601 on GT501, the road
     reads the prints as the Detail: 375601 ends in the Dover sidings and
     calls at Ashford on the way */
  const sum = geniusPairCsv([{ code: "GT501", units: "375601.", stops: [S("ASHFDNS", "", "05:30", "5A01"), S("DOVERPS", "23:50", "", "")] }])
    .summary.replace(/03\/08\/26/g, "01/08/26");
  const rd = await N.GENIUS.read([sum]);
  for (const [date, m] of det) rd.detail.set(date, m);
  const out = B().run(planFor(["375601\tA\tSUN AM 02/08\tAFK\t"]), rd, {});
  assert.equal(out.date, "01/08/26");
  assert.equal(out.rows[0].ends.place, "DVP");
  assert.equal(out.rows[0].suggest.action, "AFK BERTH off 2A01", JSON.stringify(out.rows[0].suggest));
});

/* ---- the Allocation Summary: a row per unit ---- */
const ALLOC_HEAD = '"GENIUS","ALLOCATION SUMMARY REPORT","Page:","Page -1 of 1","Control:","SouthEastern Trains","Print Date:","August 2, 2026","Controller:","NA","Signon:","X","Name:","Y","Time:",16:08,"Allocation Summary for:","Owning Ctrl NE,   All   03/08/26 00:00 04/08/26 23:59 Sorted By ResGrp","ResourceId.","Depot","STARTDIAG.","OFF orSTATUS","----------- START -----------  Date     Time   Location","------------- END -------------   Date     Time   Location","ACT. orSTATUS","FINALDIAG.","WORKSDIAGRAM","TRAIN ID","MILES","FUELMILES","MILES SINCE FUEL","MILES SINCE FUEL","OwningCTRL","OwningCTRL","MAINTENANCE","MAINTENANCE",';
const allocRow = (unit, sd, st, sloc, ed, et, eloc, fd) =>
  ALLOC_HEAD + '"' + unit + '","RM","' + sd + '","  000",' + st.replace(" ", "  ") + ',"' + sloc + '",' + et.replace(" ", "  ") + ',"' + eloc + '",,"' + (fd || sd) + '","  000",,"2P43BA",100.00,100.00,"9,999.00","9,999.00","NE",,"NE",,"' + unit + '",,"' + sloc + '"';
const ALLOC_CSV = [
  allocRow("375701", "RM101", "03/08/26 05:00", "RAMSGTD", "RM101", "03/08/26 22:00", "GRVPKUS"),
  allocRow("375702", "RM102", "03/08/26 06:00", "GRVPCSD", "RM102", "03/08/26 16:20", "RAMSGTD"),
  // 375705 starts on RM105 and finishes on RM104, into Ramsgate after midnight
  allocRow("375705", "RM105", "03/08/26 07:00", "ASHFDNS", "RM104", "04/08/26 00:20", "RAMSGTD", "RM104"),
].join("\r\n");

test("the Allocation Summary is read, a row per unit: where it starts and where it ends", () => {
  const a = B().parseAllocation(ALLOC_CSV);
  assert.deepEqual(norm([...a.keys()]), ["03/08/26"]);
  const day = a.get("03/08/26");
  assert.equal(day.size, 3);
  const r1 = day.get("375701");
  assert.deepEqual(norm([r1.startDiag, r1.startLoc, r1.start, r1.endDiag, r1.endLoc, r1.end]), ["RM101", "RAMSGTD", 300, "RM101", "GRVPKUS", 1320]);
  const r5 = day.get("375705");
  assert.deepEqual(norm([r5.startDiag, r5.endDiag, r5.end]), ["RM105", "RM104", 1440 + 20], "a finish after midnight is rolled on");
  // the print reads the same
  const printed = ["GENIUS  ALLOCATION SUMMARY REPORT", "Allocation Summary for: Owning Ctrl NE,   All   03/08/26 00:00 04/08/26 23:59",
    "375701  RM  RM101  000  03/08/26  05:00  RAMSGTD  03/08/26  22:00  GRVPKUS  RM101  000  2P43BA  100.00"].join("\n");
  const p = B().parseAllocation(printed).get("03/08/26").get("375701");
  assert.deepEqual(norm([p.startDiag, p.endLoc, p.end]), ["RM101", "GRVPKUS", 1320]);
});

test("with no Diagram Summary the Allocation Summary places every unit, and the requests follow", async () => {
  const p = geniusPairCsv(SWAP_DAY);
  const rd = await N.GENIUS.read([p.detail]);          // the Detail alone
  assert.equal(rd.summary.length, 0);
  rd.alloc = B().parseAllocation(ALLOC_CSV);
  const out = B().run(planFor(["375701\tA\tTUE AM 04/08\tRE\t", "375705\tB\tTUE AM 04/08\tRE\t", "375703\tA\tTUE AM 04/08\tRE\t"]), rd, {});
  assert.equal(out.date, "03/08/26");
  assert.ok(out.reviews.some(m => /Allocation Summary for 03\/08\/26 places 3 units — no Diagram Summary for 03\/08\/26, so it places every unit/.test(m)), out.reviews.join(" | "));
  assert.ok(!out.reviews.some(m => /has no units on it/.test(m)));
  const [a, b, c] = out.rows;
  assert.equal(a.inTraffic, true); assert.equal(a.ends.place, "GP");
  assert.equal(a.suggest.action, "GP BERTH 5R00", JSON.stringify(a.suggest));
  assert.match(a.suggest.notes.join("; "), /375702 off it/, "RM102's unit is known off the allocation too");
  assert.match(B().render(out), /375701.*placed by the Allocation Summary/);
  // 375705 finishes on RM104 into Ramsgate after midnight: held, and said to be after midnight
  assert.equal(b.ends.place, "RE"); assert.deepEqual(norm(b.diags), ["RM105", "RM104"]);
  assert.equal(b.suggest.action, "RE HOLD", JSON.stringify(b.suggest));
  assert.match(b.suggest.notes.join("; "), /after midnight/);
  assert.equal(c.suggest.action, "NOT IN TRAFFIC", "375703 is on no allocation");
});

test("with a Diagram Summary the Allocation Summary fills in the units it has no row for", async () => {
  const p = geniusPairCsv(SWAP_DAY.filter(d => d.code !== "RM101"));   // the Summary and Detail without RM101
  const rd = await N.GENIUS.read([p.summary, p.detail]);
  rd.detail.get("03/08/26").set("RM101", (await N.GENIUS.read([geniusPairCsv(SWAP_DAY).detail])).detail.get("03/08/26").get("RM101"));
  rd.alloc = B().parseAllocation(ALLOC_CSV);
  const out = B().run(planFor(["375701\tA\tTUE AM 04/08\tRE\t", "375703\tA\tTUE AM 04/08\tRE\t"]), rd, {});
  assert.ok(out.reviews.some(m => /used for any unit the Diagram Summary has no row for/.test(m)), out.reviews.join(" | "));
  assert.equal(out.rows[0].viaAlloc, true);
  assert.equal(out.rows[0].suggest.action, "GP BERTH 5R00", JSON.stringify(out.rows[0].suggest));
  assert.equal(out.rows[1].viaAlloc, false, "375703 is on the Summary");
});

test("today's Allocation Summary with tomorrow's Summary and Detail: today is the allocation's day, the departures tomorrow's", async () => {
  const p = geniusPairCsv(SWAP_DAY);
  const rd = await N.GENIUS.read([p.summary, p.detail]);          // both for 03/08
  // 375701 ends Sunday 02/08 at Grove Park; the plan wants it at Ramsgate on the Monday
  rd.alloc = B().parseAllocation(allocRow("375701", "RM101", "02/08/26 05:00", "RAMSGTD", "RM101", "02/08/26 22:00", "GRVPCSD"));
  const out = B().run(planFor(["375701\tA\tMON AM 03/08\tRE\t"]), rd, {});
  assert.equal(out.date, "02/08/26", "the allocation's day is today, the Summary's tomorrow");
  assert.ok(out.reviews.some(m => /Allocation Summary for 02\/08\/26 places 1 units — no Diagram Summary for 02\/08\/26/.test(m)), out.reviews.join(" | "));
  assert.ok(out.reviews.some(m => /departures are off the 03\/08\/26 Detail, tomorrow's/.test(m)), out.reviews.join(" | "));
  const r = out.rows[0];
  assert.equal(r.viaAlloc, true); assert.equal(r.ends.place, "GP");
  assert.match(r.suggest.action, /^GP BERTH 5(J01|R00)/, JSON.stringify(r.suggest));
});

test("a line with no request says why: nobody at that place, or nothing out of it gets there", async () => {
  const day = SWAP_DAY.concat([
    // a diagram out of Hastings sidings to Ramsgate, for a unit that ends at Hastings
    { code: "RM108", units: "375708.", stops: [S("HASTPSD", "", "06:00", "5H08"), S("RAMSGTE", "07:50", "08:00", "5H08"), S("RAMSGTD", "08:10", "", "")] },
  ]);
  const p = geniusPairCsv(day);
  const rd = await N.GENIUS.read([p.summary, p.detail]);          // Monday 03/08, tomorrow
  rd.alloc = B().parseAllocation([
    allocRow("375701", "RM101", "02/08/26 05:00", "RAMSGTD", "RM101", "02/08/26 22:00", "GRVPCSD"),
    allocRow("375706", "RM106", "02/08/26 05:00", "RAMSGTD", "RM106", "02/08/26 22:30", "GRVPCSD"),
    allocRow("375703", "RM103", "02/08/26 05:00", "RAMSGTD", "RM103", "02/08/26 21:00", "HASTPSD"),
    allocRow("375705", "RM105", "02/08/26 05:00", "RAMSGTD", "RM105", "02/08/26 21:30", "TONBDMS"),
  ].join("\r\n"));
  const out = B().run(planFor(["375701\tA\tMON AM 03/08\tRE\t", "375706\tB\tMON PM 03/08\tRE\t", "375703\tA\tMON AM 03/08\tRE\t", "375705\tA\tMON AM 03/08\tRE\t",
                               "375706\t\tEOD MON 03/08\tRE\t"]), rd, {});
  const [a, b, c, d, e] = out.rows.map(r => r.suggest);
  /* the one diagram out of Grove Park to Ramsgate - its morning start and
     its afternoon working - is listed against both units at Grove Park,
     and the second is told the first has it too */
  assert.equal(a.action, "GP BERTH 5J01", JSON.stringify(a));
  assert.equal(b.action, "GP BERTH 5J01", JSON.stringify(b));
  assert.match(b.notes.join("; "), /5J01 is on 375701's list too/);
  // nobody at Hastings: no request, and the train that would have done is still named
  assert.equal(c.action, "ENDS HGS", JSON.stringify(c));
  assert.match(c.notes.join("; "), /no request at HGS — none are made there; tomorrow's 5H08 06\+00 out of it gets to RE all the same/);
  // nothing out of Tonbridge gets there
  assert.equal(d.action, "ENDS TON", JSON.stringify(d));
  assert.match(d.notes.join("; "), /nothing out of TON on tomorrow's Detail gets to RE/);
  // 375706's second line carries its first line's request, and takes no train of its own
  assert.equal(e.action, "GP BERTH 5J01", JSON.stringify(e));
  assert.match(e.notes.join("; "), /the same request as its other line/);
  assert.ok(!/the same request as its other line/.test(b.notes.join("; ")), "the first line is not pointed at itself");
  // and with a request on one line, the other says so
  const two = B().run(planFor(["375701\tA\tMON AM 03/08\tRE\t", "375701\t\tEOD MON 03/08\tRE\t"]), rd, {});
  assert.equal(two.rows[0].suggest.action, "GP BERTH 5J01");
  assert.equal(two.rows[1].suggest.action, "GP BERTH 5J01", JSON.stringify(two.rows[1].suggest));
  assert.match(two.rows[1].suggest.notes.join("; "), /the same request as its other line/);
});

test("a day nothing is loaded for is named, and a unit the later day does place is placed by it", async () => {
  const p = geniusPairCsv(SWAP_DAY);
  const rd = await N.GENIUS.read([p.summary, p.detail]);          // Monday 03/08
  // Saturday's allocation, and Sunday's with one unit on it so far
  rd.alloc = B().parseAllocation([
    allocRow("375701", "RM101", "01/08/26 05:00", "RAMSGTD", "RM101", "01/08/26 22:00", "GRVPCSD"),
    allocRow("375706", "RM106", "01/08/26 05:00", "RAMSGTD", "RM106", "01/08/26 22:30", "GRVPCSD"),
    allocRow("375703", "RM103", "01/08/26 05:00", "RAMSGTD", "RM103", "01/08/26 21:00", "HASTPSD"),
    allocRow("375706", "RM106", "02/08/26 05:00", "GRVPCSD", "RM106", "02/08/26 23:30", "RAMSGTD"),
  ].join("\r\n"));
  const out = B().run(planFor(["375701\tA\tMON AM 03/08\tRE\t", "375706\tB\tMON AM 03/08\tRE\t"]), rd, {});
  assert.equal(out.date, "01/08/26");
  assert.ok(out.reviews.some(m => /Nothing is loaded for 02\/08\/26 \(the 02\/08\/26 Allocation Summary places 1 units, so it was printed before that day was allocated\): every other unit is taken to stand where 01\/08\/26 leaves it until the 03\/08\/26 departures/.test(m)), out.reviews.join(" | "));
  const [a, b] = out.rows;
  assert.equal(a.placedOn, null); assert.equal(a.ends.place, "GP");
  assert.equal(a.suggest.action, "GP BERTH 5J01", JSON.stringify(a.suggest));
  assert.match(a.suggest.notes.join("; "), /Monday's 5J01 06\+00: RM102 ends RE 16\+20/, "the day is named, two days on");
  // 375706 is on Sunday's allocation and ends at Ramsgate on it: held there
  assert.equal(b.placedOn, "02/08/26"); assert.equal(b.ends.place, "RE");
  assert.equal(b.suggest.action, "RE HOLD FOR MON", JSON.stringify(b.suggest));
  assert.match(B().render(out), /375706.*placed by the 02\/08\/26 Allocation Summary/);
});

test("a working to a depot that can send it on, then what that depot has on - TON BERTH 06+00 THEN AFK BERTH 15+00/5R51", async () => {
  const day = SWAP_DAY.concat([
    // out of Tonbridge sidings to Ashford in the morning, ending there
    { code: "RM201", units: "375741.", stops: [S("TONBDMS", "", "06:00", "5T01"), S("ASHFDNS", "07:00", "", "")] },
    // a diagram that stands at Ashford for the day and goes on to Ramsgate in the afternoon
    { code: "RM202", units: "375742.", stops: [S("RAMSGTD", "", "05:00", "5A02"), S("ASHFDNS", "06:30", "15:00", "5W02"), S("RAMSGTE", "15:50", "16:00", "5W02"), S("RAMSGTD", "16:10", "", "")] },
  ]);
  const p = geniusPairCsv(day);
  const rd = await N.GENIUS.read([p.summary, p.detail]);          // Monday 03/08, tomorrow
  rd.alloc = B().parseAllocation(allocRow("375705", "RM105", "02/08/26 05:00", "RAMSGTD", "RM105", "02/08/26 21:30", "TONBDMS"));
  const out = B().run(planFor(["375705\tA\tMON PM 03/08\tRE\t"]), rd, {});
  const s = out.rows[0].suggest;
  // the leg to Ashford, then what Ashford has on once it is there - its PM departure or the fleet move - the way the plan writes it
  assert.equal(s.action, "TON BERTH 06+00 THEN AFK BERTH 15+00/5R51", JSON.stringify(s));
  assert.match(s.notes.join("; "), /tomorrow's 5T01 06\+00: RM201 ends AFK 07\+00, nearer RE — AFK to send it on; then AFK has 15\+00, fleet move 5R51 22\+31 \(M-F\) to RE when it is due/);
  assert.equal(s.taken.diag, "RM201", "the leg is claimed like any request");
  assert.equal(s.reach, "AFK");
});

test("a line for Selhurst is answered at Victoria, with the move over - AFK BERTH 06+00 - VIC BERTH 5Y41, VIC HOLD FOR 5Y41", async () => {
  const day = SWAP_DAY.concat([
    { code: "GT140", fleet: "377/5", units: "377140.", stops: [S("ASHFDNS", "", "06:00", "5A40"), S("VICTGCS", "07:30", "", "")] },
  ]);
  const p = geniusPairCsv(day);
  const rd = await N.GENIUS.read([p.summary, p.detail]);
  rd.alloc = B().parseAllocation([
    allocRow("377141", "GT141", "02/08/26 05:00", "VICTGCS", "GT141", "02/08/26 21:00", "ASHFDNS"),
    allocRow("377142", "GT142", "02/08/26 05:00", "ASHFDNS", "GT142", "02/08/26 22:00", "VICTGCS"),
  ].join("\r\n"));
  const out = B().run(planFor(["377141\tM3\tMON AM 03/08\tSU\t", "377142\tM3\tMON AM 03/08\tSU\t"]), rd, {});
  const [a, b] = out.rows.map(r => r.suggest);
  assert.equal(a.action, "AFK BERTH 06+00 - VIC BERTH 5Y41", JSON.stringify(a));
  assert.match(a.notes.join("; "), /over to Selhurst on 5Y39\/5Y41 11\+02 or 5Y40\/5Y41 20\+18 \(SuX\)/);
  // a Monday exam seen from the Sunday night: a plain hold, since Monday is tomorrow, naming the move
  assert.equal(b.action, "VIC HOLD FOR 5Y41", "it ends at Victoria and is held for the move: " + JSON.stringify(b));
});

test("the standing fleet move is the request where the Detail has nothing - SG BERTH 5L17/5L19/5L92", async () => {
  const p = geniusPairCsv(SWAP_DAY); const res = await N.GENIUS.build([p.summary, p.detail]);   // Monday 03/08
  const out = B().run(planFor(["376040\tA\tTUE AM 04/08\tGI\tO/H SG"]), res, {});
  const s = out.rows[0].suggest;
  assert.equal(s.action, "SG BERTH 5L17/5L19/5L92", JSON.stringify(s));
  assert.match(s.notes.join("; "), /nothing out of SG on today's Detail gets to GI, or to a depot that could send it on; tomorrow's fleet move 5L17 10\+10 SG - GI \(M-F\)/);
  assert.match(s.notes.join("; "), /the depot to choose/);
});

test("an Allocation Summary for some other day places nothing, and is named", async () => {
  const p = geniusPairCsv(SWAP_DAY);
  const rd = await N.GENIUS.read([p.summary, p.detail]);
  rd.alloc = B().parseAllocation(allocRow("375701", "RM101", "20/07/26 05:00", "RAMSGTD", "RM101", "20/07/26 22:00", "GRVPCSD"));
  const out = B().run(planFor(["375701\tA\tTUE AM 04/08\tRE\t"]), rd, {});
  assert.equal(out.date, "03/08/26");
  assert.ok(out.reviews.some(m => /Allocation Summary dropped is for 20\/07\/26, not 03\/08\/26 — it places nothing today/.test(m)), out.reviews.join(" | "));
  assert.equal(out.rows[0].viaAlloc, false, "the Summary places it");
});

/* ---- the road a unit lands on, and how many departures a list carries ---- */
test("at a depot the request is off the road the unit landed on first; another road's follows, said to be a shunt", async () => {
  /* 375705 stands in the Grove Park Up Sidings. Tomorrow's 5J01 to
     Ramsgate leaves the Carriage Shed; 5J90 leaves the Up Sidings. The Up
     Sidings departure is the request, the Carriage Shed one a shunt. */
  const day = SWAP_DAY.concat([
    { code: "RM190", units: "375790.", stops: [S("GRVPKUS", "", "05:50", "5J90"), S("RAMSGTE", "07:30", "07:35", "5J90"), S("RAMSGTD", "07:45", "", "")] },
  ]);
  // 375705 is placed in the Up Sidings by the allocation, on no diagram tomorrow's Detail has
  const inUps = () => B().parseAllocation(allocRow("375705", "RM105", "02/08/26 05:00", "RAMSGTD", "RM105", "02/08/26 21:30", "GRVPKUS"));
  const p = geniusPairCsv(day); const rd = await N.GENIUS.read([p.summary, p.detail]); rd.alloc = inUps();
  const s = B().run(planFor(["375705\tA\tMON AM 03/08\tRE\t"]), rd, {}).rows[0].suggest;
  // its own road first, the other road's after it and said to be a shunt
  assert.equal(s.action, "GP BERTH 5J90/5J01", JSON.stringify(s));
  assert.match(s.notes.join("; "), /off the Up Sidings first; 5J01 leaves the Carriage Shed — a shunt across/);
  // with nothing off its own road, the other road is offered and said to be a shunt
  const q = geniusPairCsv(SWAP_DAY); const bare = await N.GENIUS.read([q.summary, q.detail]); bare.alloc = inUps();
  const t = B().run(planFor(["375705\tA\tMON AM 03/08\tRE\t"]), bare, {}).rows[0].suggest;
  assert.equal(t.action, "GP BERTH 5J01", JSON.stringify(t));
  assert.match(t.notes.join("; "), /nothing off the Up Sidings gets there — these leave the Carriage Shed, a shunt to check with the depot/);
});

test("an outstation is one road: a unit in the Dover sidings takes the platform departure without a shunt", async () => {
  const day = SWAP_DAY.concat([
    { code: "RM301", units: "375731.", stops: [S("DOVERP", "", "04:50", "1P06"), S("RAMSGTE", "06:10", "06:20", "5P06"), S("RAMSGTD", "06:30", "", "")] },
  ]);
  const p = geniusPairCsv(day);
  const rd = await N.GENIUS.read([p.summary, p.detail]);
  rd.alloc = B().parseAllocation(allocRow("375705", "RM105", "02/08/26 05:00", "RAMSGTD", "RM105", "02/08/26 21:30", "DOVERPS"));
  const s = B().run(planFor(["375705\tA\tMON PM 03/08\tRE\t"]), rd, {}).rows[0].suggest;
  assert.equal(s.action, "DVP BERTH 04 50", JSON.stringify(s));
  assert.ok(!/shunt/.test(s.notes.join("; ")), "no shunt at an outstation: " + JSON.stringify(s));
});

test("a diagram that starts at the place is named by its start, not by its PM leg off a stand back there", async () => {
  // RM102 leaves the Carriage Shed at 06:00 as 5J01 and again at 14:10 as 5R00 after standing there: one working
  const res = await swapDay();
  const s = B().run(planFor(["375799\tA\tTUE AM 04/08\tRE\tO/H GP"]), res, {}).rows[0].suggest;
  assert.equal(s.action, "GP BERTH 5J01", JSON.stringify(s));
  assert.ok(!/5R00/.test(s.action + s.notes.join(" ")), JSON.stringify(s));
});

test("more departures than units on the road: the best three, the rest noted", async () => {
  const extra = ["05:10", "05:20", "05:30", "05:40"].map((t, i) =>
    ({ code: "RM19" + i, units: "37579" + i + ".", stops: [S("GRVPCSD", "", t, "5J9" + i), S("RAMSGTE", "07:00", "07:05", "5J9" + i), S("RAMSGTD", "07:15", "", "")] }));
  const p = geniusPairCsv(SWAP_DAY.concat(extra)); const res = await N.GENIUS.build([p.summary, p.detail]);
  const s = B().run(planFor(["375799\tA\tTUE AM 04/08\tRE\tO/H GP"]), res, {}).rows[0].suggest;
  assert.equal(s.action.split("/").length, 3, "three named: " + JSON.stringify(s));
  assert.match(s.notes.join("; "), /also: /);
  // five units on the road: every departure is listed
  const five = B().run(planFor(["375799\tA\tTUE AM 04/08\tRE\tO/H GP", "375798\tA\tTUE AM 04/08\tRE\tO/H GP", "375797\tA\tTUE AM 04/08\tRE\tO/H GP",
                                "375796\tA\tTUE AM 04/08\tRE\tO/H GP", "375795\tA\tTUE AM 04/08\tRE\tO/H GP"]), res, {}).rows[0].suggest;
  assert.equal(five.action.split("/").length, 5, JSON.stringify(five));
});

test("the metro outstations and the other fleets: Orpington and Dartford are places, a 395 is two to a 12-car, a Networker is Slade Green's", () => {
  const pf = B().placeOf;
  assert.equal(pf("ORPNDSG"), "ORP"); assert.equal(pf("ORPNGTN"), "ORP"); assert.equal(pf("DARTFUS"), "DFD"); assert.equal(pf("SLADGEH"), "SG");
  assert.equal(B().maxUnits("395002"), 2); assert.equal(B().maxUnits("707001"), 2); assert.equal(B().maxUnits("465003"), 3); assert.equal(B().maxUnits("466001"), 6);
  assert.equal(B().defectHome("465003"), "SG/GI"); assert.equal(B().defectHome("707001"), "SG/GI"); assert.equal(B().defectHome("395002"), "AFK");
  assert.equal(B().roadName("SLADGUS"), "Up Sidings"); assert.equal(B().roadName("ASHFEBS"), "East Berthing"); assert.equal(B().roadName("XYZ"), "XYZ");
});

test("the Up Sidings at Slade Green are strict: an Up Sidings unit goes out on an Up Sidings diagram", async () => {
  /* 376001 lands in the Up Sidings, wanted at Gillingham. 5L12 out of the
     Up Sidings calls at Gillingham in the morning; 5L52 out of the Depot
     ends in Gillingham depot. Only the Up Sidings one is the request. */
  const day = SWAP_DAY.concat([
    { code: "SG901", fleet: "376/0", units: "376901.", stops: [S("SLADGUS", "", "05:21", "5L12"), S("DARTFD", "05:26", "05:34", "2D12"), S("GLNGHMK", "06:10", "06:12", "2D12"), S("RAMSGTE", "07:30", "", "")] },
    { code: "SG902", fleet: "376/0", units: "376902.", stops: [S("SLADEGD", "", "05:14", "5L52"), S("DARTFD", "05:20", "05:30", "2L52"), S("GLNGDEP", "06:30", "", "")] },
  ]);
  const p = geniusPairCsv(day);
  const rd = await N.GENIUS.read([p.summary, p.detail]);
  rd.alloc = B().parseAllocation(allocRow("376001", "SG905", "02/08/26 05:00", "SLADEGD", "SG905", "02/08/26 23:30", "SLADGUS"));
  const s = B().run(planFor(["376001\tA\tMON AM 03/08\tGI\t"]), rd, {}).rows[0].suggest;
  assert.equal(s.action, "SG BERTH 05+21", JSON.stringify(s));
  assert.match(s.notes.join("; "), /off the Up Sidings, where it lands; Depot: 05\+14 — a shunt across, to check with the depot/);
  // Tonbridge and Gillingham have roads of their own; Ramsgate is one road
  assert.equal(B().roadName("TONBPMY"), "Jubilee Sidings"); assert.equal(B().roadName("TONBDMS"), "Down Main sidings");
  assert.equal(B().roadName("GLNGMUS"), "Up Sidings"); assert.equal(B().placeOf("GLNGMUS"), "GI");
});

test("multiple only on any line of a unit keeps every line's request coupled: no single unit, no portion", async () => {
  /* 375705 stands in the Grove Park Up Sidings with an exam line and an
     MO defect line. Out of the Up Sidings tomorrow: 5J90, one diagram on
     its own, and 5J91, two diagrams coupled to Ramsgate. The exam line
     comes first, and its request - the one both lines carry - is 5J91. */
  const day = SWAP_DAY.concat([
    { code: "RM190", units: "375790.", stops: [S("GRVPKUS", "", "05:50", "5J90"), S("RAMSGTE", "07:30", "07:35", "5J90"), S("RAMSGTD", "07:45", "", "")] },
    { code: "RM191", units: "375791.", pos: 1, stops: [S("GRVPKUS", "", "06:10", "5J91"), S("RAMSGTE", "07:50", "07:55", "5J91"), S("RAMSGTD", "08:05", "", "")] },
    { code: "RM192", units: "375792.", pos: 2, stops: [S("GRVPKUS", "", "06:10", "5J91"), S("RAMSGTE", "07:50", "07:55", "5J91"), S("RAMSGTD", "08:05", "", "")] },
  ]);
  const p = geniusPairCsv(day); const rd = await N.GENIUS.read([p.summary, p.detail]);
  rd.alloc = B().parseAllocation(allocRow("375705", "RM105", "02/08/26 05:00", "RAMSGTD", "RM105", "02/08/26 21:30", "GRVPKUS"));
  const plan = ["Exams", "Unit Nr \tExam\t\tWhere\tAction", "375705\tA\tMON AM 03/08\tRE\t",
                "Defects", "Unit Nr \tDays\tPriority\tTarget Date\tAction ", "375705\t3\t2. Restriction MO\t03/08/2026 00:00:00\t"].join("\n");
  const out = B().run(plan, rd, {});
  const [exam, defect] = out.rows.map(r => r.suggest);
  assert.equal(exam.action, "GP BERTH 5J91", "the exam line keeps it coupled: " + JSON.stringify(exam));
  assert.equal(defect.action, "GP BERTH 5J91", JSON.stringify(defect));
  assert.ok(!/5J90/.test(exam.action + defect.action), "never the diagram on its own");
  // without the MO line the single diagram is offered too, first off its own road
  const free = B().run(planFor(["375705\tA\tMON AM 03/08\tRE\t"]), rd, {}).rows[0].suggest;
  assert.match(free.action, /5J90/, JSON.stringify(free));
});

test("multiple only with days to run is contained: a multiple diagram off its road, even one back to where it is", async () => {
  /* 375705 stands in the Ashford Down Sidings with an MO defect and two
     days to run. Out of the Down Sidings: 5A20, one diagram on its own;
     2A10, two diagrams coupled all day and back to Ashford at night; and
     5A08, two diagrams to Ramsgate that come in at 21+16 and 01+41. The
     contained working is offered, the split one is not. */
  const day = SWAP_DAY.concat([
    { code: "RM220", units: "375720.", stops: [S("ASHFDNS", "", "05:00", "5A20"), S("VICTRIE", "06:20", "06:40", "2A21"), S("ASHFDNS", "08:10", "", "")] },
    { code: "RM004", units: "375704.", pos: 1, stops: [S("ASHFDNS", "", "05:55", "2A10"), S("VICTRIE", "07:20", "07:40", "2A11"), S("ASHFDNS", "22:00", "", "")] },
    { code: "RM905", units: "375905.", pos: 2, stops: [S("ASHFDNS", "", "05:55", "2A10"), S("VICTRIE", "07:20", "07:40", "2A11"), S("ASHFDNS", "22:00", "", "")] },
    { code: "RM002", units: "375702.", pos: 1, stops: [S("ASHFDNS", "", "05:27", "5A08"), S("RAMSGTE", "06:30", "06:40", "2R08"), S("RAMSGTD", "01:41", "", "")] },
    { code: "RM904", units: "375904.", pos: 2, stops: [S("ASHFDNS", "", "05:27", "5A08"), S("RAMSGTE", "06:30", "06:40", "2R08"), S("RAMSGTD", "21:16", "", "")] },
  ]);
  const p = geniusPairCsv(day); const rd = await N.GENIUS.read([p.summary, p.detail]);
  rd.alloc = B().parseAllocation(allocRow("375705", "RM105", "02/08/26 05:00", "RAMSGTD", "RM105", "02/08/26 21:30", "ASHFDNS"));
  const plan = ["Defects", "Unit Nr \tDays\tPriority\tTarget Date\tAction ", "375705\t2\t2. Restriction MO\t05/08/2026 00:00:00\t"].join("\n");
  const s = B().run(plan, rd, {}).rows[0].suggest;
  assert.equal(s.action, "AFK BERTH 05 55", "contained on 2A10: " + JSON.stringify(s));
  assert.match(s.notes.join("; "), /RM004 contained — in multiple to AFK 22\+00/);
  assert.ok(!/05 27|05 00/.test(s.action + s.notes.join(" ")), "not the split train, not the single unit: " + JSON.stringify(s));
  // due today, it is not contained: nothing off Ashford keeps it coupled to Ramsgate
  const due = ["Defects", "Unit Nr \tDays\tPriority\tTarget Date\tAction ", "375705\t0\t2. Restriction MO\t02/08/2026 00:00:00\t"].join("\n");
  const t = B().run(due, rd, {}).rows[0].suggest;
  assert.ok(!/05 55/.test(t.action), "not contained when due: " + JSON.stringify(t));
});

test("a unit the plan places by its own request is put on the road that working leaves from", async () => {
  // "GP BERTH 5J90": 5J90 leaves the Up Sidings, so the unit is an Up Sidings unit and 5J90 leads its list
  const day = SWAP_DAY.concat([
    { code: "RM190", units: "375790.", stops: [S("GRVPKUS", "", "05:50", "5J90"), S("RAMSGTE", "07:30", "07:35", "5J90"), S("RAMSGTD", "07:45", "", "")] },
  ]);
  const p = geniusPairCsv(day); const res = await N.GENIUS.build([p.summary, p.detail]);
  const out = B().run(planFor(["375799\tA\tTUE AM 04/08\tRE\tGP BERTH 5J90"]), res, {});
  assert.equal(out.rows[0].standingRoad, "GRVPKUS");
  assert.equal(out.rows[0].suggest.action, "GP BERTH 5J90/5J01", JSON.stringify(out.rows[0].suggest));
  assert.match(out.rows[0].suggest.notes.join("; "), /off the Up Sidings first; 5J01 leaves the Carriage Shed — a shunt across/);
});

test("a slow-down job is asked for whatever the date, the fewest miles first; an XS50 on a 376 is Slade Green's or Gillingham's", async () => {
  const res = await swapDay();
  // 375704 ends at Ramsgate; its H2H has a slow down on it and is eleven days out
  const plan = ["Scheduled Maint", "Unit Nr \tWhere\tWhen\tFor\tAction", "375704\tRE\tEOD FRI 14/08\tH2H (SLOW DOWN)\t"].join("\n");
  const s = B().run(plan, res, {}).rows[0];
  assert.equal(s.slowDown, true);
  assert.match(s.suggest.action, /^RE BERTH /, "a request eleven days out: " + JSON.stringify(s.suggest));
  assert.match(s.suggest.notes.join("; "), /slow down — the low-mileage diagrams first/);
  assert.match(s.suggest.notes.join("; "), /miles: /);
  // the same job without the slow down is where it ends
  const plain = ["Scheduled Maint", "Unit Nr \tWhere\tWhen\tFor\tAction", "375704\tRE\tEOD FRI 14/08\tH2H\t"].join("\n");
  assert.match(B().run(plain, res, {}).rows[0].suggest.action, /^ENDS RE/);
  // an XS50 on a 376 at Grove Park, written for Slade Green, is answered at Gillingham too
  const day = SWAP_DAY.concat([
    { code: "SG901", fleet: "376/0", units: "376901.", stops: [S("GRVPKDS", "", "05:10", "5N01"), S("GLNGHMK", "06:10", "06:12", "2N01"), S("GLNGDEP", "06:30", "", "")] },
  ]);
  const q = geniusPairCsv(day); const rd = await N.GENIUS.read([q.summary, q.detail]);
  rd.alloc = B().parseAllocation(allocRow("376001", "SG905", "02/08/26 05:00", "SLADEGD", "SG905", "02/08/26 23:30", "GRVPKDS"));
  const x = B().run(planFor(["376001\tXS50\tASAP\tSG\t"]), rd, {}).rows[0].suggest;
  assert.equal(x.action, "GP BERTH 5N01", JSON.stringify(x));
  assert.match(x.notes.join("; "), /XS50 — Slade Green or Gillingham does it/);
});

/* ---- the plan as pasted, and the plan back in the same shape ---- */
test("the plan goes back in the workbook's own shape: titles, heading rows, blank rows, five columns", async () => {
  const res = await weekday();
  const text = ["Exams", "Unit Nr \tExam\t\tWhere\tAction", "375601\tA\tTUE AM 04/08\tAFK\t", "375602\tB\tMON PM 03/08\tAFK\t", "",
                "375604\tC\tSAT AM 08/08\tRE\t", "", "Scheduled Maint", "Unit Nr \tWhere\tWhen\tFor\tAction", "375603\tRE\tAFTER 1250 MILES\tOIL CHANGE\t"].join("\n");
  const out = B().run(text, res, {});
  assert.equal(out.kind, "mainline");
  assert.deepEqual(norm(out.groups.map(g => g.title)), ["Exams", "Scheduled Maint"]);
  assert.equal(out.rows[2].gapBefore, true, "the blank row before 375604 is kept");
  const back = B().toText(out, { workbook: true }).split("\n");
  assert.equal(back[0], "Exams");
  assert.equal(back[1], "Unit Nr\tExam\tWhen\tWhere\tAction", "the heading row, its blank cell filled");
  assert.equal(back[2].split("\t").length, 5, "five columns, no Why: " + back[2]);
  assert.match(back[2], /^375601\tA\tTUE AM 04\/08\tAFK\tAFK BERTH off 2A01$/);
  assert.equal(back[4], "", "the blank row between the groups");
  assert.match(back[5], /^375604\t/);
  assert.equal(back[6], ""); assert.equal(back[7], "Scheduled Maint");
  assert.ok(!/CHANGEOVERS|Why/.test(back.join("\n")), "no notices, no Why");
  // the reading copy still carries the Why
  assert.equal(B().toText(out).split("\n")[1].split("\t").length, 6);
  const html = B().toHtml(out, true, { workbook: true });
  assert.ok(!/<th[^>]*>Why<\/th>/.test(html) && /<tr[^>]*>(<td[^>]*>[^<]*<\/td>){5}<\/tr>/.test(html), "five cells a row");
});

test("the plan as a workbook: a Maintenance Plan sheet in the tab's shape and a Why sheet beside it", async () => {
  const res = await weekday();
  const out = B().run(BLANK, res, { ignore: "375698" });
  const bytes = B().toXlsx(out, f => N.fflate.zipSync(f, { level: 0 }));
  const files = N.fflate.unzipSync(bytes);
  const dec = new TextDecoder();
  const wb = dec.decode(files["xl/workbook.xml"]);
  assert.match(wb, /<sheet name="Maintenance Plan" sheetId="1"/);
  assert.match(wb, /<sheet name="Why" sheetId="2"/);
  const s1 = dec.decode(files["xl/worksheets/sheet1.xml"]);
  assert.match(s1, /<c r="A1" [^>]*t="inlineStr"><is><t[^>]*>Exams<\/t>/);
  assert.match(s1, /<c r="E3" [^>]*t="inlineStr"><is><t[^>]*>AFK BERTH off 2A01<\/t>/);
  assert.ok(!/<c r="F/.test(s1), "five columns on the plan sheet");
  assert.match(dec.decode(files["xl/worksheets/sheet2.xml"]), /<c r="F3" /, "the Why is the sixth column of its own sheet");
});

test("the Metro Telex is read by its headings: the depot from the title, the unit's location from its column, its own request form", async () => {
  const text = ["Stock Maintenance Controllers Daily Control Sheet", "", "Slade Green", "Unit Nr.\tExam\tSlot\tLocation\tAction",
                "465049 (+1977)\tXC00\tSUN AM 20/09\tSG\tHOLD FOR EXAM", "465154\tXA05\tMON PM 21/09\tPLU\t", "",
                "Traction Units - Please update when MO's are added", "Unit Nr.\tPriority\tWhen\tEnd Location\tAction",
                "465181\tTRACTION DEFECT\tTBA\tCST\t", "", "XS75 OR XS30", "Unit Nr.\tMileage\tWhere\tAction", "465024\t174\tGPD PM\t"].join("\n");
  const plan = B().parsePlan(text);
  assert.equal(plan.kind, "metro");
  assert.deepEqual(norm(plan.groups.map(g => g.section)), ["EXAMS", "DEFECTS", "DEFECTS"]);
  const [a, b, c, d] = plan.rows;
  assert.equal(a.unit, "465049"); assert.equal(a.raw[0], "465049 (+1977)", "the unit cell is kept as written");
  assert.equal(a.where, "SG", "the depot is the section's"); assert.equal(a.at, "SG");
  assert.equal(b.at, "PLU"); assert.equal(B().metroAt("PLU"), "PLMSTCS"); assert.equal(B().metroAt("VIC PM"), "VICTRIE"); assert.equal(B().metroAt("VICS PM"), "VICTGCS"); assert.equal(B().metroAt("DFD DOWNS"), "DARTFDS");
  assert.equal(c.where, "SG/GI", "a traction defect is Slade Green's or Gillingham's"); assert.equal(c.at, "CST"); assert.equal(c.isDefect, true);
  assert.equal(d.section, "DEFECTS"); assert.equal(d.what, "174");
  // the same plan read as the Mainline one when told to
  assert.equal(B().parsePlan(text, "mainline").kind, "mainline");
  // the Metro form of a request
  const form = B().metroForm;
  const r = { at: "GPU", section: "EXAMS" };
  assert.equal(form({ action: "GP BERTH 5F08/RP 5F04", list: [{ name: "5F08", hc: "5F08", dep: 5 * 60 + 3, road: "GRVPKUS" }, { name: "RP 5F04", hc: "5F04", dep: 4 * 60 + 50, road: "GRVPKUS" }] }, r),
               "BERTH 05+03 (5F08)/C/END 04+50 (5F04)", "off its own road, no prefix; a portion is the country end");
  assert.equal(form({ action: "GP BERTH 5F08", list: [{ name: "5F08", hc: "5F08", dep: 5 * 60 + 3, road: "GRVPKUS" }] }, { at: "", section: "REQUESTS" }),
               "GPU - BERTH 05+03 (5F08)", "the road named where the line has no Location");
  assert.equal(form({ action: "VIC BERTH 3M08", list: [{ name: "3M08", hc: "3M08", dep: 5 * 60 + 37, road: "VICTRIE" }] }, { at: "VIC PM", section: "EXAMS" }), "BERTH 05+37 (3M08)", "an empty move, and Victoria's sidings are the line's own VIC");
  assert.equal(form({ action: "SG HOLD" }, { at: "SG", section: "EXAMS" }), "HOLD FOR EXAM");
  assert.equal(form({ action: "SG HOLD" }, { at: "SG", section: "REQUESTS" }), "SG - HOLD");
  assert.equal(form({ action: "STOPPED SG" }, r), "STOPPED SG");
  assert.equal(form({ action: "TON BERTH 06+00 THEN AFK BERTH 15+00", list: [{ name: "06+00", hc: "5T01", dep: 360, road: "TONBDMS" }], then: { via: "AFK", entries: [{ name: "15+00", hc: "5W02", dep: 900, road: "ASHFDNS" }] } }, { at: "", section: "EXAMS" }),
               "TON DM - BERTH 06+00 (5T01) THEN AFK - BERTH 15+00 (5W02)", "a THEN leg in the same form, off the Down Main sidings");
});
