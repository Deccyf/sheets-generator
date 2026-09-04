# History

What changed, release by release, and why. The README describes the tool as
it is now; this file keeps the story of how it got there, so the README does
not have to.

## 3.1.0 — 4 September 2026 — the weekend builds the depot's own documents

**The weekend panel drew all three roads with one layout.** Mainline, Metro
and High Speed were the same 8-column berthing grid three times over,
differing only in which diagrams landed on it, while the weekday panel had
been writing the depot's own two documents properly for a long time. They
are the same documents now, drawn by the same code:

- **Metro** builds `METRO_SHEETS_<day>.xlsx` — the sixteen-column document,
  a worksheet per location, Grove Park and Slade Green split AM and PM, with
  POS, ROAD, S, ENDS and MILES filled in.
- **High Speed** builds `HS_SHEETS_<day>.xlsx` — the Class 395 Allocations
  Sheet, a block per depot with MG and the mileage colouring.

Mainline and Ramsgate stay berthing books, and the mainline side is
unchanged: held against the operator's own SUN 16/08 book it still matches
58 of its 60 entries with nothing missing and every section in order.

**The mileage was there all along.** Column 7 of the prints is a running
total — the same figure the weekday reports carry as Cumulative Miles, and
what MILES and MG are made of. The reader picked columns 2–6 and 8 and
stepped over it, so every weekend book came out with no mileage at all.

Everything else those documents want was already worked out: POS off the
formation column, ENDS off the diagram's last berth, S off the split the
books have flagged for a long time, and ROAD off the prints' own names for
the depot roads — `G Pk DnSd` is the down carriage holding sidings, which
the depot writes DOWNS. The prints do not allocate units, so FORMATION and
UNIT NO come out ruled and empty, exactly as a weekday build does when the
report has no allocation yet. And they list calls rather than passing
points, so no 395 working names Ebbsfleet or Gravesend and the high-level
note falls back to the standing headcode lookup, the same as a PDF-fed
weekday build.

The 395 sheet is now **timed off the first move**, as the weekday one is:
AZ601 is its 07+10 off the down sidings as 5R09, not the 07.47 out of the
platform as 2R09. That was the one place the weekend and weekday profiles
deliberately disagreed, and the reason was that the weekend book was still a
berthing book.

### A brief call at a shunt spur is a turnround, not a berthing

Reported as "Sunday now seems to be broken — lots of Sidcup". The Sunday
06/09/26 prints turn the Sidcup service back through Sidcup Sidings: off the
platform, two minutes in, nine to sixteen minutes standing, two minutes back
out to form the next working. The place is named like a siding, so every one
of those counted as putting the unit away — **twenty-seven Sidcup lines in
the Metro book and eight in the mainline one**, for stands nobody berths a
unit on.

The weekday side has always held its shunt spurs to a stay of berthing
length (`BERTH_STAY`, 65 minutes); the weekend side had no such rule. It
does now, off the same constant, and Sidcup Sidings joins the spur list
beside Gillingham Up Sidings, Hastings Park Sidings and Bellingham Siding.
A unit that stands there *properly* is still berthed there — the rule is the
stay, not the place — and every call that goes is named on the review list,
gathered by place. The verified SUN 16/08 book is untouched by it.

## 3.0.5 — 4 September 2026 — the plus in a weekend clock cell

**A regression from 3.0.0, reported as "the weekend sheets now show empties
at the bottom".** They did, and the cause was one character.

3.0.0 replaced the prints reader's clock parser. The old one read fixed
character positions, which got `6:40` wrong by fifty minutes; the new one is
a regex, `/^(\d{1,2})[:. ](\d{2})(?::\d{2})?$/`. Its separator class never
had the **plus** in it — and a plus is how the prints mark an empty move.
972 of the 5,418 clock cells in one Sunday's document are written that way,
and every one came back `null`.

A null time still *printed* correctly, because the sheet writes the raw cell
and only the sort key is parsed. So nothing looked broken: the empties just
sorted to one place at the foot of their section, in whatever order they had
been read, which reads like a deliberate grouping rather than a parse that
had failed.

It was not only the order. Anything worked out from the clock was working
from a hole. Against the operator's own **SUN 16/08** book, before and after:

| | before | after |
|---|---|---|
| sections in the operator's order | 6 of 11 | **11 of 11** |
| entries whose rows match exactly | 52 of 60 | **58 of 60** |
| entries not built at all | 1 | **0** |

The six that came right are Ashford's 301 (`RE`/`AFK` → blank/`RE`), three
Hastings departures and one Tonbridge one whose PM berth read `HGS` where
the book says `XSE`, and a 07 50 Hastings departure that was not on the
sheet at all. Three run-round notes now appear on the review list too — the
rule needs the times, so it had never fired on an empty move. The two
entries that still differ are a separate, older question about Ramsgate's
PM cell, untouched by this.

## 3.0.4 — 3 September 2026 — the Metro sheets' S column

**S is the split column, and the tool fills it in.** It was ruled and left
empty with R/T and L/S, but the answer was already worked out: the berthing
books have flagged a formation SPLITS or SPLITS PM since long before. It now
prints the depot's own two letters — **Y** where the units come apart again
later today, **N** where they stay as one — against every unit of the
formation, the way the December 2025 workbook writes it.

A **single unit is left empty**, not given an N. That is the workbook's own
practice: all 24 of its one-unit departures have the cell blank, while its
115 pairs and 19 threes are all answered one way or the other (6 and 2 of
them Y). A unit on its own has nothing to split, and an N there would be
answering a question nobody asked.

Both SPLITS and SPLITS PM print Y. The column asks whether the formation
splits, not when — the workbook has no third letter for a parting that comes
after the units are put away.

## 3.0.3 — 3 September 2026 — three things the sheets were getting wrong

- **A working nobody had allocated was given the diagram's other unit.** The
  unit was read off any row of the diagram that named one, so a diagram
  allocated in the morning and left for the planner in the evening printed
  the morning's unit against evening departures nobody had allocated. It is
  now read off the row covering the working being printed, and only that: no
  row, no unit, and the cell is left ruled and empty for the depot.
- **A unit that attaches and stays out lost the rest of its day's miles.**
  MG is per working, and a working's figure ran to the end of its own stint —
  but GT116 leaves Ashford at 05+31, is back on the sidings at 06 59 and goes
  out again at 07 46 attached to GT117, and *that* departure prints as
  GT117's row. So the 39 miles of the first stint were all the book ever
  showed of a 455-mile day. A working's miles now run to wherever the unit
  next berths **on the sheet**, and where nothing later of that diagram
  prints, to the end of its day — so a diagram's figures add up to the day it
  runs. Two stints that both print are unaffected: a unit stands still
  between them, so each row still shows its own working.
- **The 395 preview drew merged panels as open boxes.** A merged range is one
  cell on the page and the spreadsheet draws its box from the cells around
  the range's *edge* — the bottom rule off its bottom row, the right off its
  right-hand column. The preview took the anchor cell's own four sides, and
  an anchor does not own the far edges of its range, so the COMMENTS panel
  and the NOTE block came out with their lines simply missing. The saved
  workbook was always right; only the preview was wrong.

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
