/* The High Speed side of the berth-request road: the Class 395 Disposition
   Statement pasted from its workbook, read against the day's AZ diagrams,
   and given back with the four planning columns filled - in the sheet's
   own dress, on the page, on the clipboard and as a workbook. */
import test from "node:test";
import assert from "node:assert/strict";
import { built, norm } from "./helpers/compare.mjs";
import { hsSummaryCsv, hsDetailCsv, dispositionPaste, HS_UNITS } from "./helpers/hs-synth.mjs";

const N = built();
const B = () => N.SHEETS_BERTH;
const H = () => N.SHEETS_BERTH_HS;
const reports = async (units) => N.GENIUS.read([hsSummaryCsv(units), hsDetailCsv()]);
const run = async (opts, units) => B().run(dispositionPaste(opts), await reports(units), {});

test("a disposition statement is told from a maintenance plan by its own heading row", async () => {
  assert.equal(H().isDisposition(dispositionPaste()), true);
  assert.equal(H().isDisposition("Exams\nUnit Nr \tExam\tWhen\tWhere\tAction\n375601\tA\tTUE AM 04/08\tAFK\t"), false);
  const out = await run();
  assert.equal(out.kind, "hs", "and the road reads it without being told which workbook it is");
});

test("the sheet is read line by line: the unit, where it is, what it is fit for and what the depot wants today", async () => {
  const p = H().parse(dispositionPaste());
  assert.equal(p.units.length, HS_UNITS.length);
  assert.equal(p.state, "Actual");
  assert.equal(p.version, "Version 1");
  assert.deepEqual(norm(p.dayCols.map(c => c.label)), ["Mon 03/08", "Tue 04/08", "Wed 05/08", "Thur 06/08", "Fri 07/08"]);
  const u = p.units[1];
  assert.equal(u.unit, "395002");
  assert.equal(u.depot, "Ashford");
  assert.equal(u.status, "Available");
  assert.match(u.restr, /Not on Ebbsfleet High Level/);
  // Excel copies a two-line cell quoted; the line break has to survive it
  assert.match(u.days[0], /^Not over Ebbsfleet High\n Level$/);
});

test("the day's AZ diagrams are read off the Detail: where each starts and ends, its miles, the high level and its depot stands", async () => {
  const out = await run();
  assert.deepEqual(norm(out.diagrams.map(d => d.diag).sort()), ["AZ601", "AZ602", "AZ603"]);
  const by = Object.fromEntries(out.diagrams.map(d => [d.diag, d]));
  assert.equal(by.AZ601.home, "Ashford");
  assert.equal(by.AZ603.home, "Ramsgate");
  assert.equal(by.AZ601.hl, false);
  assert.equal(by.AZ602.hl, true, "an Ebbsfleet-Gravesend leg is over the high level");
  assert.deepEqual(norm(by.AZ602.stands.map(s => s.word)), ["Ashford"], "and it stands back at its own depot through the afternoon");
});

test("a unit goes out from the depot the sheet puts it at, and a restriction keeps it off the diagram it cannot take", async () => {
  const out = await run();
  const by = Object.fromEntries(out.rows.map(r => [r.unit, r]));
  assert.equal(by["395004"].suggest.diag, "AZ603", "a Ramsgate unit takes the Ramsgate diagram");
  assert.equal(by["395002"].suggest.diag, "AZ601",
    "395002 is not to go over the Ebbsfleet high level, so it does not get AZ602: " + by["395002"].why.join(" · "));
  assert.match(by["395002"].why.join(" · "), /not over the high level/);
  // and every unit is at the depot the sheet names
  for (const r of out.rows) if (r.diag && !r.diag.unknown)
    assert.equal(r.diag.home, r.depotWord, r.unit + " is at " + r.depotWord + " but " + r.diag.diag + " starts at " + r.diag.home);
});

test("a unit wanted back in the early afternoon gets the diagram that stands at its depot then", async () => {
  const out = await run();
  const r = out.rows.find(x => x.unit === "395003");
  assert.equal(r.suggest.diag, "AZ602", r.why.join(" · "));
  assert.match(r.why.join(" · "), /back at Ashford 13\+16 \(stands to 16\+40\)/);
});

test("a unit the depot wants stabled is left alone while there is another unit for the work", async () => {
  const out = await run();
  const r = out.rows.find(x => x.unit === "395005");
  assert.equal(r.suggest.diag, "");
  assert.equal(r.status, "Stabled");
  assert.match(r.why.join(" · "), /stabled, as asked/);
});

test("the head of the sheet counts the day itself", async () => {
  const out = await run();
  assert.deepEqual(norm(out.counts), { required: 3, offered: 3, spare: 0, stopped: 1, stabled: 1 },
    "the trains required and offered, the spares, the stopped and the stabled");
});

test("a diagram the sheet already names is kept, and is not given to a second unit", async () => {
  const out = await run({ filled: true });
  const by = Object.fromEntries(out.rows.map(r => [r.unit, r]));
  assert.equal(by["395002"].suggest.diag, "AZ601");
  assert.match(by["395002"].why.join(" · "), /the sheet has it on AZ601/);
  // the same sheet with two units claiming one diagram
  const units = HS_UNITS.map(u => u.unit === "395004" ? { ...u, plan: ["AZ601\n5R09", "07+10", "Ashford", "23+54"] } : u);
  const twice = B().run(dispositionPaste({ filled: true, units }), await reports(), {});
  const t = Object.fromEntries(twice.rows.map(r => [r.unit, r]));
  assert.equal(t["395002"].suggest.diag, "AZ601");
  assert.notEqual(t["395004"].suggest.diag, "AZ601", "the second claim is turned down: " + t["395004"].why.join(" · "));
  assert.match(t["395004"].why.join(" · "), /AZ601 is already 395002's/);
});

test("a Summary printed after allocation names the unit on each diagram, and the sheet takes it", async () => {
  const out = await run({}, { AZ603: "395005." });
  const r = out.rows.find(x => x.unit === "395005");
  assert.equal(r.suggest.diag, "AZ603", r.why.join(" · "));
  assert.match(r.why.join(" · "), /the reports have it on AZ603 today/);
});

test("the sheet comes back in its own shape: sixteen columns from A, the header block above the units", async () => {
  const out = await run();
  const text = B().toText(out, { workbook: true });
  const recs = text.split("\n");
  // a quoted cell carries its own line breaks, so records are not lines
  assert.match(text, /\tActual\t/);
  assert.match(text, /CLASS 395 DISPOSITION STATEMENT AM/);
  assert.match(text, /SERVICE TRAINS REQUIRED AM \/ PM/);
  assert.match(text, /395002\t/);
  assert.ok(recs.length > 20, "the header block and a line per unit");
  /* The suggestion goes in the DIAGRAM, DEP TIME, END LOCATION and ARRIVAL
     TIME columns, and the DIAGRAM cell carries its headcode on a second
     line - quoted, the way Excel copies one, so the text is read back as
     records rather than lines to see it. */
  const rec = H().records(text).find(r => r[1] === "395004");
  assert.ok(rec, "a record per unit");
  assert.equal(rec.length, 16, "sixteen columns, A to P");
  assert.equal(rec[12], "AZ603\n5L15", "the diagram and its headcode");
  assert.equal(rec[13], "06+27");
  assert.equal(rec[14], "Ramsgate");
  assert.equal(rec[15], "22+42");
});

test("the sheet is drawn in the workbook's own dress, and the Why sits beside it on the page", async () => {
  const out = await run();
  const html = B().toHtml(out, false);
  assert.match(html, /<table class="brtable brplan brhs"/);
  // the header block's boxes are merged as the tab merges them
  assert.match(html, /colspan="5" rowspan="16"/, "the comments box spans B3:F18");
  // the tab's own fonts and rules, cell by cell
  assert.match(html, /font-size:16pt/);
  assert.match(html, /border-left:2px solid #000000/);
  // UNIT STATUS carries the colour the tab's rules paint it
  assert.match(html, /color:#00B050[^"]*">Available</, "Available is green, as the sheet's rule paints it");
  assert.match(html, /color:#FF0000[^"]*">Stopped</, "and Stopped is red");
  assert.match(html, /<td[^>]*>Why<\/td>/, "the Why column is on the page");
  const plain = B().toHtml(out, true, { workbook: true });
  assert.ok(!/>Why</.test(plain), "and not on the copy that goes back to the workbook");
});

test("the workbook carries the sheet's style records, its merges and its status colours", async () => {
  const out = await run();
  const files = {};
  const bytes = B().toXlsx(out, f => { Object.assign(files, f); return new Uint8Array([1]); });
  assert.ok(bytes);
  const names = Object.keys(files);
  assert.ok(names.includes("xl/worksheets/sheet1.xml"), names.join(" "));
  const dec = new TextDecoder();
  const wb = dec.decode(files["xl/workbook.xml"]);
  assert.match(wb, /name="Disposition Sheet"/);
  assert.match(wb, /name="Why"/);
  const s1 = dec.decode(files["xl/worksheets/sheet1.xml"]);
  assert.match(s1, /<mergeCell ref="B3:F18"\/>/);
  assert.match(s1, /<conditionalFormatting sqref="F21:F25">/, "the UNIT STATUS rules, over the unit rows only");
  assert.match(s1, /AZ603/);
  // the date box is a real date, so the tab's own format draws it
  assert.match(s1, /<c r="M2"[^>]*><v>46237<\/v><\/c>/, "Monday 03/08/2026 as a date serial");
  assert.match(s1, /<c r="L3"[^>]*><v>3<\/v><\/c>/, "and the counts are numbers");
  const st = dec.decode(files["xl/styles.xml"]);
  assert.match(st, /<dxfs count="4">/, "the four status rules travel with it");
  assert.ok(/<cellXfs count="(\d\d+)"/.exec(st)[1] > 50, "and the tab's own style records");
});

test("the day's diagrams can be read as a list, depot by depot, with the unit on each", async () => {
  const out = await run();
  const txt = B().render(out);
  assert.match(txt, /== THE 03\/08\/26 DIAGRAMS, AS THEY LEAVE ==/);
  assert.match(txt, /ASHFORD/);
  assert.match(txt, /AZ603.*395004/);
  assert.match(txt, /NOT OUT/);
  assert.match(txt, /395001/);
});
