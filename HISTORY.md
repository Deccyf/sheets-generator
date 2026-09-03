# History

What changed, release by release, and why. The README describes the tool as
it is now; this file keeps the story of how it got there, so the README does
not have to.

## 3.0.2 — 3 September 2026 — the Metro sheets against the December 2025 book

The depot's **December 2025** workbook replaced the May 2026 one as the
baseline the Metro sheets are held to, and it settled three things:

- **The sheet is sixteen columns, not fourteen.** Between COMMENTS and S sit
  two columns with no heading, which the depot uses when a comment overflows
  — its Slade Green sheet runs "MUST BE MO FREE / FOR TRAINING TRIP" across
  them. The tool omitted both, so everything from S rightwards sat two
  columns left of where the depot keeps it. All sixteen headings and widths
  now match the workbook's own ASHFORD sheet exactly.
- **Victoria's column is ROAD, not PLATFORM.** Only the London termini —
  Cannon Street and Charing Cross — head it PLATFORM.
- **The road names are the depot's own words.** Its Dartford sheet writes
  DOWNS, C/END and L/END, and its comments write SG UPS, so the ROAD column
  now says DOWNS, UPS, SHED, C/END and L/END rather than the DN / UP / SD the
  berthing books abbreviate to. The road *number* it writes there — "1 UP",
  "4 UP" — is beyond the reports, which name a berth and not which of its
  roads, so the up sidings are the unnumbered UPS.

The AM/PM boundary was re-checked against this book and holds: its AM sheets
end 07+10 and 07+23, its PM sheets open 13+12 and 13+15.

## 3.0.1 — 3 September 2026 — the Metro sheets' AM/PM split and ROAD column

Two things a colleague read off the Metro book, both checked against the
depot's own May 2026 workbook rather than guessed at:

- **The AM and PM sheets were split at eight in the evening.** Grove Park
  and Slade Green take an AM and a PM worksheet each, and the tool divided
  them at `PM_BREAK` (20:00) — so the AM sheet carried the whole afternoon
  and the PM peak with it, and the PM sheet held only what left after eight.
  The depot's workbook puts the boundary in the morning: its AM sheets end
  07+10 and 07+23, its PM sheets open 10+40 and 13+12. The split is now ten
  in the morning, which sits inside that gap. It is deliberately **not** the
  berthing books' `AM_CUTOFF` (14:00), which would put Grove Park's own
  13+12 back on the AM sheet.
- **No Dn / Up / Shed indicator at either depot.** The ROAD column — which
  is what that column is called at Grove Park and Slade Green, where a
  terminus has PLATFORM — was always left blank. The knowledge was already
  in the tool: `BERTH_SHEETS` has carried the road against every depot berth
  from the start and nothing ever read it, and the berthing books print it
  against the Grove Park headcodes. `DEPOT_ROAD` now names it for both
  depots and the ROAD column carries it. On a real day's reports it fills
  every one of the thirty Grove Park and Slade Green departures.

## 3.0.0 — 2 September 2026 — the overhaul

A complete pass over the Sheets Generator: interface, wording, correctness,
code health and tooling. What the books contain is unchanged except where a
bug had made it wrong.

**Interface.** One mode at a time — a Weekday / Weekend switch replaces two
panels stacked down one long page. One drop zone per mode. A black status
board carries the result of every build, with *Save all books* and *Start
over* beside it, and stays at the top of the window once the cards scroll
under it. The four options sit in one row with a *What each does* fold, and
are remembered on the computer. Every card opens with its sheet showing,
exactly as it will print; the Review tab is grouped by kind (plan changed
since the book was saved, left off the sheet, platform stands, reissue,
order to check, locations and codes, notes) and summarised as chips on the
card. The quick start, the Integrale steps, what comes back and the
troubleshooting notes fold away under *How to use this page*. Files dropped
on the wrong panel are sent to the right one. The fleet sprites, the buffer
stop and the apron palette stay; headings and card titles moved from
monospace to the page's own sans, three colour pairs that failed contrast
were fixed, a print stylesheet prints the open preview as a check copy, and
the page has a favicon and a proper title.

**Wording.** One vocabulary on both panels: a *book* is a file, a *sheet* is
a page in it, *Review* is the tab, *weekend prints*, *order correction*.
Every sentence the page can say lives in one table in `src/ui.js`. The same
fact stated in up to fourteen places is stated once. The user guide was
rewritten for the new page and brought up to date on five features it never
mentioned; the README was split into this file and a maintainer's README.

**Bugs fixed** — each reproduced against the built file before it was fixed,
each with a regression test:

- An updated-prints document offered after a reissue was the *unchanged*
  original whenever the reissue arrived as CSV or text rather than a Word
  file. It is no longer offered in that case, and the Review tab says why.
- A Genius Detail CSV re-saved by Excel (`9:10:00` for `09:10`) lost every
  leg's arrival stop, so AM/PM berths moved.
- A shunt between two berths inside one section printed a phantom line
  stamped with the next stint's departure time and headcode. This one dated
  from the legacy build and the golden test had pinned it.
- Weekend times with a dropped leading zero (`6:40`) were mis-read by up to
  fifty minutes while the printed cell looked right.
- A pair covering more than one date folded every day's Metro entries onto
  one sheet per location, dated day one.
- `NaN` was written into number cells (a PDF Summary row with a blank POS),
  which Excel repairs by dropping data.
- A diagram whose itinerary collapsed to one stop crashed the whole weekday
  build.
- Folkestone East "EX hh+mm ARR" paired the wrong arrival once one was past
  midnight.
- Grove Park's country-end extension and up headshunt and Slade Green's east
  headshunt printed as GRO / SLA in the AM/PM columns.
- A Summary and a Detail for different dates lost their own diagnosis behind
  "No weekday dates found".
- A fault inside an option toggle left the build queue rejected: the next
  drop failed with the stale error and did nothing.
- The weekend panel's *Saved…* confirmations were written to a hidden line.
- The 395 sheet's PM ARRIVALS rows carried the previous day's *departure*
  headcode and time, one row per stint.
- Three review items were malformed: raw minutes, an internal tuple, and an
  "order" item with no wording.
- The stock form's printed heading was emitted after the row breaks, which
  the worksheet schema forbids.
- Smaller: a `Diagram:` header without its day cell folded into the previous
  diagram; two reissues carrying one diagram counted it twice; a UTF-16 text
  save of the prints was refused; the platform-turn rule never fired on the
  Metro and 395 books; a corrupt or blocked storage blob was discarded
  silently; a corrected order that could not be stored was reported as kept.

**Code.** About 300 lines of dead code and duplication removed: unused
exports, unreachable engine fallbacks, the StyleBook's never-used
"allocation dress", never-read entry fields, four orphan CSS rules. The two
panels in `ui.js` share one panel controller and one build queue that cannot
wedge; the weekday books are a registry rather than a list of booleans; the
workbook is written when it is asked for rather than on every toggle; each
PDF is parsed once instead of twice. Comments were rebalanced towards
contracts and named constants and away from narration.

**Tooling.** CI has a timeout, a concurrency group, npm and browser caches,
and fails on a page console error. The build uses `replaceAll` for its
placeholders, refuses a module that would truncate the page, and fails under
CI when a generated document does not build. A `.gitattributes` pins line
endings. New direct tests for the local-corrections schema, the prints
readers, and every bug above.

## 2.7.x — August 2026 — the stock requirements form

- **2.7.0** — an optional Kent Coast stock requirements form on the weekday
  panel: the depot's own blank workbook, filled from the day's plan.
- **2.7.1** — the count rule simplified to what the depot actually checks:
  every diagram counted once, at the location it starts the day from.
- **2.7.2** — the form dressed in the blank workbook's own styleSheet, cell
  for cell, so the file and the preview are the depot's form rather than a
  lookalike.

## Earlier in the 2.x series — August 2026

### The weekend follows the weekday rulebook

The two pipelines used to keep separate copies of the same conventions, and
the copies had drifted. They are one rulebook now — the weekend books are
built by the weekend engine, but to the weekday rules.

| | Was | Now |
|---|---|---|
| **Fleet profiles** | A second hand-written `PROFILES` table. It had lost `465/0` from the metro fleet list, gained `SLADE GREEN` in the metro headcode sections, and left the High Speed book with none at all. | `PROFILES` is *derived from* `PROFILES_G`. There is one table, so it cannot drift again. |
| **Unit order** | Always lowest Position first, everywhere. | Unchanged — see below. This one was carried over and then taken back out. |
| **Double lines** | Wherever the section crossed midday and 20:00. | The weekday rule: the first break of `BREAK_GAP` (three hours) or more, plus any later one leading into work after `PM_BREAK`. Grove Park is never ruled. |
| **Headcodes** | Per-profile lists that had drifted. | `HEADCODE_SECTIONS`, the same set the weekday books use. |

Two weekday rules are deliberately not carried over. The **pinned unit
order** (`ORDER_FIX`), because those pins name weekday diagram numbers and
the weekend prints number theirs separately. And the **reading order** —
which end of a formation a section is written from: carrying it over
reordered 53 of the 71 multi-unit entries in the verified Sunday 16/08 book,
and the book is right. Those directions were scored against hand-marked
*weekday* books and belong to them. Weekend order is lowest Position first,
everywhere.

### Six ways the tool used to be quietly wrong

Each was reproduced against a real export before it was fixed.

| What used to happen | Now |
|---|---|
| A Genius **summary covering two dates** deduplicated on `(diagram, start)` with no date, so day two collapsed into day one — 139 rows and 14 review notes gone, silently. | The date is in the key. |
| **Excel re-saves a CSV** and drops the leading zero: `8:34:00` read as **04 34**; a blank cell gave `NaN` and killed the past-midnight rolling for the rest of the diagram. | A tolerant time reader; an unreadable cell is dropped and counted on the Review tab. (The Genius Detail CSV's arrival side was missed and fixed in 3.0.0.) |
| A **diagram in one report but not the other** vanished. | Both directions are named on the Review tab. |
| **Two dates on the same weekday** — the second silently overwrote the first. | The first is kept and the second is named. |
| A **control character in one cell** made the *whole workbook* unreadable. | `esc()` strips them first. |
| A **reissue merge replaced nothing**: the paragraph pattern required a space after `w:p`, so every attribute-less `<w:p>` was invisible and the "updated prints" were the superseded document. | The pattern accepts both forms; the test asserts the merge itself. |

### Other 2.x changes

- Genius CSV exports and the Integrale CSV exports read alongside the PDFs,
  through the same rulebook; both reports pasted in as text where a machine
  will not let the files be saved.
- The Metro book as the depot's own document (a worksheet per location,
  landscape) and the High Speed book as the Class 395 Allocations Sheet, in
  that sheet's own style records.
- The Rules tab and the Unit order tab, with Reverse / Undo kept on the
  computer, and `BERTHING SHEET RULES.html` generated from the same tables.
- The printed book's memory: a fingerprint of every saved book, so a later
  export of the same date says what moved.
- A second tool, the Diagram Analyser, reading the same prints for
  maintenance planning's questions, with its own version number.

## 2.0.0 — the first overhaul

Version 2.0.0 restructured the tool without changing what it produces — the
golden suite pins the outputs to the pre-overhaul build.

- **~83% smaller.** ExcelJS (~948 KB, three quarters of the old file) and
  pako went; the weekday books go through the same hand-built SpreadsheetML
  writer the weekend books always used, extended to multi-sheet workbooks.
- **Dead code removed.** The retired ACWN-workbook pipeline (`tracer3` /
  `builder3`, the Friday variant, `docHealth`, the disabled weekday `.xlsx`
  path and its orphaned UI) was deleted — it survives in git history.
- **One source of truth.** All reference tables consolidated into
  `src/data.js`; the two engines share the stop-collapsing walk and
  day-shape constants, one xlsx writer and one preview renderer.
- **A real bug fixed.** The legacy file wired the weekend panel before its
  markup existed, which crashed in a fresh load and left the weekend drop
  zone dead.
- **Weekday previews show the sheet itself** — the same ruled house grid
  that is saved — and each book has its own card and its own review list.
- **A fleet lineup** — stylised class 375 / 465 / 395 sprites in the
  Southeastern manner. Decorative, inline SVG, still fully offline.

Before 2.0 the tool was a single hand-maintained HTML monolith; the weekend
engine was a port of `make_sheets.py`. That monolith is frozen as
`test/fixtures/legacy.html` and still serves as the golden oracle for the
weekday books and the test-only workbook reader.
