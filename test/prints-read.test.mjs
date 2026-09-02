/* readPrints on its own: what it refuses, and what it hands back. The
   reader is shared by both tools, so a wrong answer here is wrong twice.
   Nothing here is real - the prints are the invented fixture.

   Deliberately NOT here: the legacy .doc reader and the exact wording of
   its messages, and how a UTF-16 text save is read. Those are asserted on
   behaviour only (throws / returns) and on the one word every Word message
   keeps - "Word". */
import test from "node:test";
import assert from "node:assert/strict";
import { built } from "./helpers/compare.mjs";
import { makeDocx, PRINTS_LINES } from "./helpers/synth.mjs";

const ctx = built();
const { SHEETS_PRINTS: P, fflate } = ctx;
// the same unzip both tools hand it
const read = bytes => P.readPrints(bytes, fflate.unzipSync);
const utf8 = s => new TextEncoder().encode(s);
// arrays made in the sandbox carry that realm's prototype - copy to compare
const arr = x => Array.from(x);

/* An error thrown inside the sandbox is that realm's Error, so instanceof
   is no use. A refusal is a thrown error with a message meant for a person:
   not a TypeError off an undefined, not a stack. */
const refused = (bytes, msg) => assert.throws(() => read(bytes), e =>
  typeof e.message === "string" && e.message.length > 20 &&
  !/TypeError|ReferenceError|RangeError|undefined/.test(e.message), msg);
const refusedAs = (bytes, re, msg) => assert.throws(() => read(bytes), re, msg);

test("a .docx comes back as its paragraphs, tabs and all", () => {
  assert.deepEqual(arr(read(makeDocx(PRINTS_LINES, fflate))), PRINTS_LINES);
});

test("a zip that is not a Word document is refused as one", () => {
  /* The same first bytes as a .docx - PK - with nothing inside that Word
     would write. A books .zip dropped on the wrong panel is exactly this. */
  const zip = fflate.zipSync({ "SHEETS_SAT.xlsx": utf8("not a workbook either") });
  assert.equal(zip[0], 0x50); assert.equal(zip[1], 0x4B);
  refusedAs(zip, /Word/, "named as not a Word document");
  refused(zip);
  /* And a file that starts like a zip and is not one at all. */
  const torn = new Uint8Array([0x50, 0x4B, 0x03, 0x04, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
  refusedAs(torn, /Word/, "a torn zip is named as not a Word document, not a stack trace");
  refused(torn);
});

test("Rich Text is named as such - Word will save one as .doc", () => {
  const rtf = "{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0 Calibri;}}\\f0 Diagram: AZ 601\\par}";
  refusedAs(utf8(rtf), /Rich Text/);
  // leading whitespace ahead of the header is still the header
  refusedAs(utf8("  \r\n" + rtf), /Rich Text/);
  refused(utf8(rtf));
});

test("plain text that is not the prints is refused, not half-read", () => {
  refused(utf8("Dear all,\nPlease find the prints attached.\nThanks"), "a covering note");
  refused(utf8("Diagram: AZ 601 Sat\nFleet: 375/6\n"),
    "the words without the tabs: the columns are the structure");
  /* A Genius Summary export is a CSV too, and it must keep being refused
     rather than come back as an empty set of prints. */
  refused(utf8('"GENIUS","DIAGRAM SUMMARY REPORT","Page:","Page -1 of 1"\r\n' +
               '"GT101","375/6","MF","1","05:30","ASHFDNS","DOVERPS","23:50"\r\n'),
    "a summary report saved as CSV");
  refused(new Uint8Array(0), "an empty file");
  refused(utf8(""), "an empty text");
});

test("the prints pasted or saved as text come back as their lines", () => {
  const text = PRINTS_LINES.join("\n");
  assert.equal(P.looksLikePrints(text), true);
  assert.deepEqual(arr(read(utf8(text))), PRINTS_LINES);
  // Notepad's line endings make no difference
  assert.deepEqual(arr(read(utf8(PRINTS_LINES.join("\r\n")))), PRINTS_LINES);
  /* Saved as CSV out of a table, the cells come back joined with tabs. A
     spreadsheet pads rows to the widest, so trailing empty cells go. */
  const csv = PRINTS_LINES.map(l => l.split("\t").map(c => '"' + c + '"').join(","))
                          .join("\r\n");
  assert.deepEqual(arr(read(utf8(csv))), PRINTS_LINES.map(l => l.replace(/\t+$/, "")));
});
