/* SHEETS_RULES on its own: the key grammar, the merge, and the shape of
   what goes into localStorage. Every key and diagram number here is
   invented. The happy path in words (orderRow, explainHtml) is covered in
   data.test.mjs; this is the edges - what is refused, and how. */
import test from "node:test";
import assert from "node:assert/strict";
import { built, norm } from "./helpers/compare.mjs";

const R = built().SHEETS_RULES;
/* Values that cross the vm boundary carry the sandbox's prototypes, so a
   strict deep-equal fails on the prototype alone - normalise both sides. */
const eq = (a, b, msg) => assert.deepEqual(norm(a), norm(b), msg);

test("the key grammar: everywhere, a section, or one timed departure", () => {
  eq(R.parseKey("101,102"), { sec: null, time: null, diags: ["101", "102"] });
  eq(R.parseKey("ASHFORD|101,102"),
     { sec: "ASHFORD", time: null, diags: ["101", "102"] });
  eq(R.parseKey("ASHFORD 05 05|101,102"),
     { sec: "ASHFORD", time: "05 05", diags: ["101", "102"] });
  // a + in the time is an empty-stock working, the sheet's own notation
  assert.equal(R.parseKey("GROVE PARK 05+32|805,806").time, "05+32");
  // what a section name may carry: capitals, digits, space . & ' -
  assert.ok(R.parseKey("ST. LEONARDS W&M|101,102,103"), "dot and ampersand");
  assert.ok(R.parseKey("DOVER-PRIORY'S 3|101,102"), "dash, apostrophe, digit");
  // three-figure diagram numbers, two or more, in sorted order
  assert.equal(R.parseKey("101"), null, "one diagram is not a formation");
  assert.equal(R.parseKey("102,101"), null, "the list is held sorted");
  assert.equal(R.parseKey("1,2"), null, "three figures each");
  assert.equal(R.parseKey("ashford|101,102"), null, "sections are upper case");
  assert.equal(R.parseKey("ASHFORD|"), null);
  assert.equal(R.parseKey(""), null);
  assert.equal(R.parseKey(undefined), null);
});

test("validEdit takes the grammar and refuses quotes and angle brackets", () => {
  assert.equal(R.validEdit("ASHFORD 05 05|101,102", ["102", "101"]), null);
  assert.equal(R.validEdit("101,102", null), null, "null switches a pin off");
  /* A key ends up inside the page and inside a JSON file, so nothing that
     could open a tag or close a string is a key. */
  for (const bad of ['ASHFORD "05 05"|101,102', '"101,102"', "<b>ASHFORD</b>|101,102",
                     "ASHFORD<|101,102", "ASHFORD>|101,102", "ASHFORD|101,<102>",
                     "ASHFORD 05 05|101,102;", " ASHFORD|101,102"])
    assert.match(R.validEdit(bad, ["101", "102"]) || "", /not a rule key/,
      "refused: " + JSON.stringify(bad));
  // and the order has to be exactly the key's diagrams
  assert.match(R.validEdit("101,102", ["101"]), /exactly/);
  assert.match(R.validEdit("101,102", ["101", "102", "103"]), /exactly/);
  assert.match(R.validEdit("101,102", ["101", "103"]), /exactly/);
  assert.match(R.validEdit("101,101", ["101", "101"]), /twice/);
  assert.match(R.validEdit("101,102", "101,102"), /list/, "a string is not an order");
  assert.match(R.validEdit("101,102", { 0: "101", 1: "102" }), /list/);
  assert.match(R.validEdit("101,102", undefined), /list/, "undefined is not null");
});

test("a key is chosen by how often the formation appears", () => {
  const forms = R.keyForms("ASHFORD", "05 05", ["102", "101"]);
  eq(forms, { timed: "ASHFORD 05 05|101,102", section: "ASHFORD|101,102",
              bare: "101,102" }, "the diagram tail is sorted whatever order it came in");
  assert.equal(R.chooseKey(forms, false, false), forms.section);
  assert.equal(R.chooseKey(forms, true, false), forms.timed,
    "seen twice in the day: the time goes on, or the pin turns both round");
  assert.equal(R.chooseKey(forms, false, true), forms.bare);
  assert.equal(R.chooseKey(forms, true, true), forms.bare, "everywhere beats both");
  for (const k of Object.values(forms)) assert.ok(R.parseKey(k), "parses back: " + k);
});

test("the merge overlays the shipped table, and null lifts a pin", () => {
  const base = { "A|101,102": ["101", "102"], "B|201,202": ["201", "202"] };
  const edits = { "A|101,102": ["102", "101"], "B|201,202": null,
                  "301,302": ["302", "301"] };
  eq(R.mergeOrderFix(base, edits),
     { "A|101,102": ["102", "101"], "301,302": ["302", "301"] });
  eq(base, { "A|101,102": ["101", "102"], "B|201,202": ["201", "202"] },
     "the shipped table is not written to");
  eq(R.mergeOrderFix(base, undefined), base, "no edits: the table as shipped");
  eq(R.mergeOrderFix(base, {}), base);
  eq(R.mergeOrderFix(undefined, edits),
     { "A|101,102": ["102", "101"], "301,302": ["302", "301"] },
     "a null against nothing shipped is simply nothing");
});

test("the stored form: versioned, keys sorted, and back again unchanged", () => {
  const edits = { "GROVE PARK|805,806": null, "ASHFORD 05 05|101,102": ["102", "101"] };
  const text = R.serialize(edits, "2026-08-16T09:12:00.000Z");
  const raw = JSON.parse(text);
  assert.deepEqual(Object.keys(raw), ["v", "saved", "orderFix"], "the schema");
  assert.equal(raw.v, R.VERSION);
  assert.equal(R.VERSION, 1, "bump this only with a migration in parse");
  assert.deepEqual(Object.keys(raw.orderFix),
    ["ASHFORD 05 05|101,102", "GROVE PARK|805,806"],
    "keys sorted, so saving the same edits twice is the same text");
  const back = R.parse(text);
  eq(back.orderFix, edits, "unchanged through the round trip");
  assert.equal(back.saved, "2026-08-16T09:12:00.000Z");
  // nothing yet saved
  const empty = R.parse(R.serialize({}));
  eq(empty.orderFix, {});
  assert.equal(empty.saved, null);
  eq(R.parse(R.serialize(undefined)).orderFix, {});
});

test("corrupt storage reads as nothing, and never throws", () => {
  /* ui.js hands parse whatever getItem gave it, or "" - and a browser
     profile can hold anything: half a write, another tool's key, a hand
     edit. All of it reads as "no overlay", not as an exception on load. */
  for (const junk of ["", "not json", "{", "[]", "42", "null", "true", '"str"',
                      "{}", '{"v":1}', '{"v":1,"orderFix":null}',
                      '{"v":1,"orderFix":"101,102"}', '{"v":1,"orderFix":7}'])
    assert.equal(R.parse(junk), null, "refused: " + JSON.stringify(junk));
  assert.equal(R.parse(undefined), null);
  assert.equal(R.parse(null), null);
});

test("a different schema version is refused rather than read", () => {
  for (const o of [{ v: 2, orderFix: {} }, { v: 0, orderFix: {} },
                   { orderFix: {} }, { v: "1", orderFix: {} }, { v: null, orderFix: {} }])
    assert.equal(R.parse(JSON.stringify(o)), null, JSON.stringify(o));
  assert.ok(R.parse(JSON.stringify({ v: R.VERSION, orderFix: {} })), "the current one reads");
});

test("one bad entry refuses the overlay, and the shipped table stands", () => {
  /* rules.js: "one bad entry voids the lot - a half-trusted overlay is worse
     than none". So a file with a key outside the grammar reads as no file
     at all - quietly, no throw - and the merge then runs on the shipped
     table alone. The tool carries on with what it shipped rather than with
     half of somebody's corrections. */
  const good = { "ASHFORD|101,102": ["102", "101"] };
  const texts = [
    { ...good, "<script>|101,102": ["101", "102"] },   // a key outside the grammar
    { ...good, 'DOVER "P"|101,102': ["101", "102"] },   // quotes in a key
    { ...good, "102,101": ["101", "102"] },             // an unsorted key
    { ...good, "201,202": ["201", "203"] },             // an order naming the wrong diagram
    { ...good, "201,202": "202,201" },                  // an order that is not a list
  ].map(o => JSON.stringify({ v: 1, orderFix: o }));
  const shipped = { "ASHFORD|101,102": ["101", "102"] };
  for (const t of texts) {
    let parsed = "unset";
    assert.doesNotThrow(() => { parsed = R.parse(t); }, t);
    assert.equal(parsed, null, "refused: " + t);
    eq(R.mergeOrderFix(shipped, parsed ? parsed.orderFix : {}), shipped,
       "and the shipped order is what the build uses");
  }
  // the same entry on its own is taken
  eq(R.parse(JSON.stringify({ v: 1, orderFix: good })).orderFix, good);
});
