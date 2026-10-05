# Sheets Generator

Two single-file, offline browser tools for a Southeastern depot:

- **`Sheets Generator.html`** — builds the unit **berthing books** (the
  SHEETS) from the planning paperwork, on five tabs:
  - **Weekday** — the Genius *Diagram Summary* and *Diagram Detail* reports
    (PDF or CSV) or the Integrale CSV exports for a date;
  - **Weekend** — the diagram prints Word document, plus the day before's
    Summary and Detail for the High Speed sheet's PM arrivals;
  - **Base diagrams** — the base prints for a timetable change (FX, FO, SO
    and SUN, dropped together), built into a whole week of books.

  Out come the Mainline, Ramsgate, Metro and High Speed books as Excel
  workbooks, previewed on screen exactly as they print, with a Review tab of
  everything the rules had to decide for themselves — and, on request, the
  Kent Coast stock requirements form. The last two tabs read the reports and
  write no book, and both are for the Mainline and Metro fleets only:
  **Shortages & variations**, the controller's list of what is short or the
  wrong length, and **Berth requests**, which suggests the night's Telex
  requests against the day's diagrams.
- **`Sheets Generator (no berth requests).html`** — the same page with the
  experimental *Berth requests* tab left out: its tab, its panel and its
  module are cut at build time and nothing else differs, so the copy handed
  to people who should not meet a feature still being proved carries the
  same version stamp as the full one.
- **`Diagram Analyser.html`** — reads the same diagram prints and answers
  maintenance planning's questions, a card per fleet: arrivals home, what
  stands still long enough to be worked on, what can carry a restricted
  unit, where units come apart, mileage per unit, how long a unit takes to
  get back to its depot.

Nothing leaves the machine: no server, no upload, no network access. All
three files are committed, built, and handed round as they are.

**Using the tool:** read **[HOW TO USE.md](HOW%20TO%20USE.md)** (also
generated as `HOW TO USE.docx` for circulating). This README is the
maintainer's account. **[HISTORY.md](HISTORY.md)** has what changed and why,
release by release.

## Contents

- [Repository layout](#repository-layout)
- [Building, testing, releasing](#building-testing-releasing)
- [How the weekday pipeline works](#how-the-weekday-pipeline-works)
- [How the weekend pipeline works](#how-the-weekend-pipeline-works)
- [The house rulebook](#the-house-rulebook)
- [The workbook writer and the preview](#the-workbook-writer-and-the-preview)
- [The two documents that are not berthing sheets](#the-two-documents-that-are-not-berthing-sheets)
- [The stock requirements form](#the-stock-requirements-form)
- [Shortages and variations](#shortages-and-variations)
- [Berth requests](#berth-requests)
- [The interface](#the-interface)
- [The diagram analyser](#the-diagram-analyser)
- [Reference data — where the knowledge lives](#reference-data--where-the-knowledge-lives)
- [Genius and Integrale are not interchangeable](#genius-and-integrale-are-not-interchangeable)
- [Requirements and privacy](#requirements-and-privacy)

## Repository layout

Each module in `src/` is an IIFE that assigns one global (`SHEETS_DATA`,
`GENIUS`, …) and also guards `module.exports`, so every engine runs under
plain Node — which is how the tests drive them. `build.mjs` concatenates
them, in a fixed order, into the two HTML files.

| Path | What it is |
|---|---|
| `Sheets Generator.html`, `Sheets Generator (no berth requests).html`, `Diagram Analyser.html` | **The built deliverables** — committed so they can be downloaded and used directly. Regenerate with `node build.mjs`; never edit by hand. CI fails if any is stale. The second is the first with the experimental berth-request tab cut out at build time. |
| `HOW TO USE.md` → `HOW TO USE.docx` | The user guide; the Word file is generated from the Markdown by `tools/make-guide-docx.mjs` on every build (needs the `docx` package from `npm ci`). |
| `BERTHING SHEET RULES.html` | The rulebook for circulating, generated on every build by `tools/make-rules-doc.mjs` from the built file's own tables — nothing on it is typed out separately. |
| `HISTORY.md` | Release history and the reasoning behind past changes. |
| `src/page.html`, `src/styles.css` | The page shell (all five panels, each opening on its numbered steps; the how-to fold; the ES5 capability probe, the `{{CSS}}` / `{{SCRIPTS}}` / `{{VERSION}}` / `{{RELEASED}}` placeholders) and all styling. The analyser reuses `styles.css` for its base look and adds `src/fleet/fleet.css`. |
| `src/data.js` — `SHEETS_DATA` | Every reference table for every engine: berths, destination codes, section orders, fleet profiles, the station table, end-marker rules, the place names. Corrections belong here. |
| `src/rules.js` — `SHEETS_RULES` | Local unit-order corrections (key grammar, merge, storage round-trip) and `explain()` / `explainHtml()`, which turn a build's rules into plain English for the Rules tab and the printed handout. |
| `src/prints-read.js` — `SHEETS_PRINTS` | Opening a set of diagram prints whatever they arrive as: `.docx`, legacy `.doc` (OLE compound file and Word piece table, by hand), plain text, UTF-16 text, or a CSV save. Also owns `csvParse`. Both tools read the prints through this one module. |
| `src/core.js` — `SHEETS_CORE` | Shared helpers: name normalisation, destination codes, time formatting, the berth AM/PM rule. |
| `src/rulebook.js` — `SHEETS_RULEBOOK` | The day-shape constants (`DAY_ROLL`, `PM_BREAK`, `RUN_ROUND`, `AM_CUTOFF`) and the stop-collapsing walk both engines share. |
| `src/xlsx.js` — `SHEETS_XLSX` | The one xlsx writer (hand-built SpreadsheetML, multi-sheet, zipped with fflate), the weekday book layout, the print planner, and the one preview renderer. |
| `src/stockreq.js` — `SHEETS_STOCKREQ` | The Kent Coast stock requirements form: the depot's blank workbook, its styleSheet carried verbatim, filled from the day's plan. |
| `src/metro.js` — `SHEETS_METRO` | The Metro book in the depot's own format: a worksheet per location, landscape, fourteen columns. |
| `src/hs-skin.js`, `src/hs.js` — `SHEETS_HS_SKIN`, `SHEETS_HS` | The Class 395 Allocations Sheet: the depot's own style records (generated from their workbook by `tools/make-hs-skin.py`, not in the repo) and the sheet built with them. |
| `src/engine.js` — `SheetsEngine` | The weekend pipeline: diagram parsing, generation, reissue merge, the updated-prints splice, the report; and the base diagrams' week (`runWeek`), with several day files pooled into one timetable (`mergeDocs`), what kind of prints a file is (`printsKind`), and the classes each book carries. |
| `src/genius.js` — `GENIUS` | The weekday pipeline: PDF text extraction, Summary/Detail parsing for the Genius PDF and CSV exports and the Integrale CSVs, and the house rulebook applied to whichever arrives. |
| `src/shortage.js` — `SHEETS_SHORTAGE` | The shortages and variations list: the GENIUS Operating Report read, its legs stitched into workings so a variation can be traced through every diagram that shares one, a shortage tracked as one continuous deficit however many diagrams it passes through, and the controller’s written list out — lettered and laid out for the Excel text box it is pasted into, measured in Calibri 11 bold so no service breaks across a line. Not a berthing sheet, and it keeps its own place-code table on purpose - it names roads where the books name stations. |
| `src/berth.js` — `SHEETS_BERTH` | Berth requests: the maintenance plan pasted from the Telex workbook, read line by line against the weekday reports the books were built from — where each unit is today, where it ends tonight, whether it calls where the plan wants it, whether its diagram splits — and the depot's rules applied to that for a suggested action beside the planner's own: a hold, a changeover, or a berth request naming a working that ends where the unit is wanted and the swap that gets it there, with the notice written out. Reads the defects export (Equinox or EMS) pasted as it comes, and a day's reports dropped on the tab itself, a Saturday included. Carries the standing fleet moves, the road a unit lands on, and each control document's own dress (`PLAN_SKINS`). A Class 395 disposition statement is turned away while `HS_DISPOSITION` is off — the tab is for the Mainline and Metro fleets — and handed on to `berth-hs.js` when it is on. An experimental reference, and the tab says so. |
| `src/hs-disp-skin.js`, `src/berth-hs.js` — `SHEETS_HS_DISP_SKIN`, `SHEETS_BERTH_HS` | The High Speed side of the same road: the Class 395 **Disposition Statement**'s own style records (generated from the operator's workbook by `tools/make-hs-disp-skin.py`, not in the repo) and the road that reads that sheet, takes the day's AZ diagrams off the Detail, and fills the four planning columns. |
| `src/ui.js` | The page: the mode switch, the five panels (one panel controller shared by the three book-building panels, the weekend and base panels built from one definition, one message table `MSG`), the cards and the trains drawn on them, the Rules and Unit order tabs, this computer's memory. |
| `src/fleet/*` | The analyser: `prints.js` (the prints parsed for the fleet's sake), `fleet.js` (the analysis), `report.js` (the questions, worded once and rendered twice — for the screen and for the workbook), `xlsx.js` (a small plain-grid writer), `ui.js`, `page.html`, `fleet.css`. |
| `src/vendor/fflate.js` | fflate (MIT), the only third-party code: zip/unzip for docx and xlsx, inflate for PDF streams. |
| `build.mjs` | Assembles `src/` into the three files (and refuses to write the second if the berth-request tab did not cut out cleanly), packs the two workbook skins as deflated JSON that the page unpacks with the bundled fflate (`PACKED`; checked against the source before anything is written), stamps the versions, then runs the two document generators. |
| `test/` | The suite (see below). `test/helpers/` loads a built file into a Node `vm` sandbox and makes the synthetic fixtures; `test/fixtures/legacy.html` is the frozen pre-2.0 build the weekday books are compared against. |
| `tools/` | `browser.mjs` (finds Chromium for Playwright), the three smokes, screenshot scripts, `order-check.mjs` (the unit-order mark-up sheet), the two document generators, and the two skin lifters (`make-hs-skin.py`, `make-hs-disp-skin.py`) that turn an operator's workbook into a style-record-only dress. |

## Building, testing, releasing

```
npm ci             # once: the docx package for the Word guide, nothing else
node build.mjs     # src/ -> "Sheets Generator.html", the same without the berth-request
                   # tab as "Sheets Generator (no berth requests).html", and
                   # "Diagram Analyser.html"; then BERTHING SHEET RULES.html and HOW TO USE.docx
npm test           # build, then node --test "test/**/*.test.mjs"
node tools/smoke.mjs        # Chromium: weekday PDFs, weekend prints, pasting, the stock form,
                            # the shortages list and the berth-request tab
node tools/smoke-gcsv.mjs   # Chromium: the Genius CSV exports, dropped and pasted, the saved-book memory
node tools/smoke-fleet.mjs  # Chromium: the analyser
```

The unit tests run on Node's built-in runner with no dependencies, in about
two seconds. They load the built file into a `vm` sandbox with a stubbed DOM
(`test/helpers/sandbox.mjs`), so `ui.js` only has to *parse* to pass them —
the three smokes drive the real pages in the pre-installed Chromium through
the actual file inputs, and are part of CI for that reason.

| Test file | What it holds |
|---|---|
| `genius.test.mjs`, `data.test.mjs`, `xlsx.test.mjs` | Golden equivalence against the frozen legacy build: the weekday pipeline's sections, the reference tables, and the workbooks cell for cell (the legacy bundle's ExcelJS is the test-only reader). Deliberate divergences are carved out one by one with the reason beside them. |
| `engine.test.mjs`, `metro.test.mjs`, `hs.test.mjs`, `stockreq.test.mjs` | The weekend pipeline (with the legacy build as the oracle for what it does not deliberately change), and the three documents that are not berthing sheets, against stated behaviour. |
| `weekday-fixes.test.mjs`, `weekend-fixes.test.mjs` | One regression test per bug fixed in 3.0.0, each built from the input that reproduced it. |
| `rules.test.mjs`, `prints-read.test.mjs` | The local-corrections schema (round trip, corrupt input, wrong version) and the prints readers' error paths. |
| `shortage.test.mjs` | The shortages and variations road: the window a report's print time puts it in, the morning and afternoon lists and the day past midnight, the wrong-end and reciprocal-swap readings, the working trace, and the two place-code tables held apart. |
| `berth.test.mjs`, `berth-hs.test.mjs` | The berth-request road against stated behaviour: the plan read section by section, the depot's rules one at a time, the swap search, the road a unit lands on, the plan given back in each workbook's own shape and dress, and the Class 395 disposition sheet's own reading, rules and sheet. |
| `fleet.test.mjs` | The analyser, against stated behaviour — it has no legacy build. |
| `build.test.mjs` | The built files: self-contained, under the size ceiling, version-stamped, no placeholder left, dead symbols gone. |

Every fixture is invented (`test/helpers/synth.mjs` writes fabricated
Genius PDFs, CSVs and prints documents). **No real planning data is ever
committed** — `.gitignore` refuses every format it arrives in.

**CI** (`.github/workflows/ci.yml`) builds the three files, fails if any
committed build or generated document has drifted from `src/`, runs the
suite and all three smokes, and uploads the artifacts. It has a fifteen-minute
timeout, one run per branch at a time, and caches for npm and the browser.

**Releasing.** The version and release date are set by hand in
`package.json` — `version` / `released` for the Sheets Generator,
`analyser.version` / `analyser.released` for the analyser, which has its own
history — never from the clock, because CI rebuilds and fails on any diff.
Rebuild, run the suite and the smokes, commit the built files with the
source.

## How the weekday pipeline works

1. **What arrives.** Each dropped file is classified by content, never by
   name: a PDF's text is extracted once (`GENIUS.pdfText`) and searched for
   `DIAGRAM SUMMARY REPORT` / `Diagram Detail Report`; a CSV is sniffed as a
   Genius export or an Integrale export. The panel holds whichever half of
   the pair arrives first and builds as soon as it has both; the pasted
   route joins the same path after the sniff.
2. **PDF text extraction.** No PDF library. The extractor scans the raw
   bytes for `stream … endstream`, inflates them with fflate, and interprets
   just enough of the content stream (`Tm`/`Td`/`TD`, `Tf`, `Tj`/`TJ`) to
   place each string at an (x, y); strings are bucketed into lines by y,
   sorted by x, and joined with double-space gaps where the geometry shows a
   column break.
3. **Report parsing.** `parseSummary` reads one row per diagram (diagram,
   fleet, coupling **position**, start/end times and places) and the date;
   `parseDetail` reads each diagram's itinerary — location, arrival,
   departure, headcode, the `#` shunt marker — rolling times across midnight.
   The CSV readers produce the same shapes, with a tolerant time reader for
   what Excel does to a re-saved file.
4. **Applying the rulebook** (`buildDate`, once per date per fleet profile —
   Mainline, Metro, High Speed). Consecutive rows at one location collapse
   into *stops*; *berth boundaries* split each diagram's day into *stints*;
   each stint whose origin lies in a known section becomes an entry in that
   section, timed and marked by the rules below. Entries are keyed by
   section + departure time + headcode so units leaving together form one
   multi-row entry.
5. **Writing.** `SHEETS_XLSX.writeBooks` for the Mainline and Ramsgate
   books, `SHEETS_METRO` and `SHEETS_HS` for the two depot documents,
   `SHEETS_STOCKREQ` for the form. The workbook is written when it is asked
   for; the preview is rendered from the same cell layout.

## How the weekend pipeline works

1. **Reading the prints** (`SHEETS_PRINTS.readPrints`). The first bytes
   decide: a ZIP signature is a `.docx` (unzipped, `word/document.xml`
   reduced to paragraph text the way python-docx does it); a CFB signature is
   a Word 97–2003 `.doc` (a small OLE reader walks the `WordDocument` stream
   and the piece table); anything else is text — UTF-8, UTF-16 with a BOM,
   or a CSV save whose commas are the columns.
2. **Parsing diagrams** (`parseDiagrams`). `Diagram:\t<CODE>\t<NUM>\t<DAYS>`
   headers, `Fleet:` and `From:`/`Until:`, and the tab-indented itinerary
   rows. `#` flags a berthing; `STABLD` marks the road a diagram starts in.
   A number printed again (another day code or period) is kept, not
   written over.
   **Base diagrams.** A day's prints are dated that day, From and Until
   alike; the base diagrams for a timetable run over periods, on the days
   their codes name (`SHEETS_PRINTS.daysOf`, shared with the fleet
   analysis: FSX, FX, FO, SO, Su, SUN, MO, WThO… - an "excepted" code is
   the working week without those days, so FX is Monday to Thursday). They
   can come as one document or as one per day code, dropped together:
   `mergeDocs` pools them into one timetable, keeping a number printed
   again as `CODE|NUM#n` as one document would. From those `run` builds one date -
   `opts.forDate`, or the first day anything runs - out of the diagrams that
   run on it (`runningOn`: in period, on the day, the later-starting
   printing where two do), and the day before's, where the timetable covers
   it, gives the 395 sheet its PM arrivals. The **Base diagrams** tab builds a
   **week** from them (`runWeek`) - it is the weekend tab's panel set up a
   second time (`printsPanel`), and each sends the other's prints along
   (`SheetsEngine.printsKind`): every book - Mainline, Ramsgate, Metro,
   High Speed - with a sheet per day type, named the way the depot's own
   base template names its tabs ("DEC MONDAY", "DEC TUE-THU"). A day type
   is a run of days working the same diagrams after the same night, so
   Monday stands apart from Tuesday-Thursday (its arrivals are Sunday
   night's); each is built by `run` for its first day and the sheets are
   gathered by road. The week is the first full one the timetable runs, or
   the one holding the date in the **Base diagrams** picker. The 395 base sheets add
   a table of the AZ1 and AZ9 diagrams by where they start and end the day,
   and note every AZ1 diagram "Modded unit only" (`MODDED`, `SERIES` in
   `src/hs.js`).
3. **Reissue merge** (`mergeDocs`). Files named *reissue* are overlaid on the
   base document diagram by diagram, same-date check enforced; replaced and
   added diagrams go on the Review tab. `buildUpdatedDocx` splices the
   reissued diagrams' paragraphs into the base `document.xml` and re-zips it
   — only when both the base and the reissue are Word documents; otherwise
   the Review tab says so and no document is offered.
4. **Generation** (`generate`, once per fleet profile) — the same stops,
   boundaries and stints as the weekday path, to the weekday rulebook,
   plus berths *learned* from `#` markers and auto-sections for places the
   section list does not know. A print lists only where a diagram does
   something, so a rounder (out of Cannon Street and back) is two rows at
   one place; `runsBack` keeps a passenger working's return a stop of its
   own, or the first departure of the day is lost behind the second. The
   same rule is in `GENIUS` `stopsOf`, which the berth road uses on the
   prints read as a Detail, and in the analyser's `arrivedAt`.
5. **Writing.** `layoutBook` lays the sheet out once and hands it to the
   shared writer; the preview renders that same layout.

## The house rulebook

Both pipelines encode the conventions of the hand-built books. The full
rulebook, in plain English, is generated from the tables that ran — it is
the **Rules tab** of every book and `BERTHING SHEET RULES.html` — and is not
repeated here. The shape of it:

- **Which movements get a line.** An empty move onto a berth with no
  passenger work after it is not a line, and is named on the Review tab.
  A pause on the way home to a depot is not a berthing (the `anyShunt`
  gate: only when the report carries the `#` column at all, settled once
  per date over every fleet). Long platform stands are an option.
- **Berth requests (experimental).** The Berth requests tab reads the maintenance
  plan pasted from the Telex workbook against the weekday reports just
  built from, and gives the plan back in its own shape with two columns
  added: what the reports say about each unit today (diagram, where it
  ends, calls at the place wanted, whether the diagram splits) and a
  suggested action in the depot's own words, off the depot's own rules —
  hold, changeover, berth, fleet move, or where it ends. The planner's
  Action column is never written over (`src/berth.js`, 3.3.0–3.4.0).
- **Timing.** A berthing book times an entry off the last departure from
  the section — the moment the unit leaves the area; the Metro and 395
  documents (`firstDepAll`) off the first move. The stint walk stops at the
  stint's end boundary; running past it was the source of the phantom rows
  fixed in 3.0.0. Whichever leg times a weekend row also DRESSES it — the
  POS numbers come off that leg's formation, because a unit that turns
  round inside its own section is a different way up a few minutes later
  (3.2.3). The destination stays with the service the row forms.
- **Which unit prints first.** Each section reads from one end
  (`posAsc`, with `roadPosAsc` for a road that faces the other way); a
  formation that turned round in the platform prints the other way up; the
  hand-marked corrections (`ORDER_FIX`) override the position numbers where
  the depot has said so. What the reports cannot say — which way a train is
  physically facing — is measured in [HISTORY.md](HISTORY.md) and is why
  the corrections list exists.
- **The AM and PM columns.** Where the unit is put away next, and where it
  ends the day. A day that simply ends is one or the other by the clock, and
  the clock is `AM_CUTOFF` — `src/core.js` defines it, `src/rulebook.js`
  carries it, and both engines read that one figure. The weekday engine
  carried a second, unnamed cutoff of its own until 3.1.2, which put the
  same moment in different columns in a weekday book and a weekend one.
- **The lines across the page.** The first break of `BREAK_GAP` (three
  hours) or more in a location's work, and any later one leading into work
  after `PM_BREAK`. Grove Park is never ruled.
- **End markers, routes, headcodes, notes.** Which end leads is a rule per
  section and destination (`END_STYLE`, the end-marker tables); a
  destination reached two ways is settled by the headcode (`ROUTE_BY_HC`);
  only `HEADCODE_SECTIONS` quote headcodes as standard; the siding notes and
  `SPLITS` / `SPLITS PM` follow the tables in `src/data.js`.

## The workbook writer and the preview

Every book goes through `SHEETS_XLSX.writeWorkbook`, a hand-built
SpreadsheetML emitter zipped with fflate. Two dressings: the house books
register fonts and borders as they need them (`StyleBook`); a book built to
look like somebody else's document — the 395 allocations sheet, the stock
form, the 395 disposition statement, the two maintenance plan tabs — ships
that document's own styleSheet and names exact style records per cell, with
the same records as CSS for the preview, so the file, the clipboard and the
page all draw the one thing. Where the document is in the repository's hands
its records are lifted wholesale by a skin lifter in `tools/`, which strips
every unit number, diagram, date and comment and refuses to write a skin
carrying anything but the document's own house text; where the shape is
small enough to state outright — the two maintenance plan tabs — it is
written down as a skin in `src/berth.js` instead. The print planner
(`printPlan`) sets A4 portrait, a scale that fits the columns across and the
longest section down, and manual breaks so no location straddles a page; a
layout may instead carry its own margins and a fixed scale. Number cells are
written only for finite numbers, and a layout can name the columns it leaves
for somebody to fill in (`textCols`) — the berthing sheets' **UNIT** column,
F, which is formatted Text down its whole length so a unit number typed with
a leading zero keeps it. There is one preview renderer, and it draws
the same cell layout the writer saves — what you look at is what you get,
page breaks included.

## The two documents that are not berthing sheets

The weekday **Metro** book is the depot's own Metro document: a worksheet
per location (per location *and* day when a pair covers more than one
date), landscape, sixteen columns, read by Position, nine columns filled and
seven left ruled for hand entry — five headed, plus the two unheaded spares
the depot runs a long comment into. Headings and widths are the December
2025 workbook's own ASHFORD sheet. Grove Park and Slade Green take an AM and
a PM worksheet each, split at `AM_SHEET_END` — ten in the morning, read off
that workbook, where the AM sheets end 07+23 and the PM sheets open 13+12 —
and their ROAD column carries the road the working comes off in the depot's
own words (DOWNS, UPS, SHED, C/END, L/END), from `DEPOT_ROAD` in
`src/data.js`. The weekday **High Speed** book is the
Class 395 Allocations Sheet: a worksheet per day, a block per depot, last
night's arrivals beside today's allocations, in the sheet's own style
records, drop-downs, the October tab's top - the service-trains table with
REQUIRED filled in AM / PM from the day's diagrams that run (out before
midday / still running after it: `MIDDAY`, `dayEnd`) and OFFERED figures
that turn red under theirs, Done to Genius, the sent date, time and version -
a STOPPED UNITS table under Ashford's block (four lines of two halves,
`STOPPED`) that TOTAL STOPPED counts (a `COUNTA` formula), and its PRIORITY SANDING table
(seasonal: `opts.sanding === false` leaves it, its rules and its list off, an option on the tabs) (15 lines, `SANDING`: a unit off the fleet list, its miles green to 6,000,
amber to 6,999, red from 7,000: `SANDING_BANDS`), text in each depot's colour (and where a unit gets to
in that place's - a recoloured copy of the record, made by the writer's
`Recolour`), mileage colouring (High / Average / Low at 700 and
400 miles, keyed under the notes), each table boxed in bold with thin rules inside, each depot's
block split by its coloured AM/PM bar, WORKS
against the morning rows outside Ashford, and N/M, M/O and each return's
WORKS and later TRAIN ID on yellow. Neither has a formation order to
correct, so neither has a Unit order tab, and each one's Rules tab
describes the document it is.

The 395 sheet reads more of the day than a berthing book does, so
`GENIUS.build` hands it `hsDays` beside the books: each 395 diagram's stops
and Summary rows, keyed by date, a weekend's included (Monday's arrivals are
Sunday night's), and each unit carries its stint's stop range (`sa`, `sb`).
From those `src/hs.js` fills every column the depot fills by hand except
the units, which the stock controller chooses, the next-day forming and CET: the working a train ID actually runs to, N/M
and M/O per line, where each line ends and on what, a long platform stand
as a reference, the next working after a return, the "not over high level"
note on a line that never goes by the North Kent (Gravesend, Strood,
Rochester, Gillingham), and last night's arrivals
with their working, time, unit and 6 or 12. **Which end of a 12** each unit
is at — FP/RP, MAR/MIN leaving, L/C/MIN/MAR arriving — is not in any
report, so it is followed: the Summary's position 1 leads the first move,
and the order turns round wherever the train goes back out the side of a
station it came in by, from a table of which side of each station every
neighbour lies (`SIDES` in `src/hs.js`). A move through a place that table
does not know leaves the end blank. Against the depot's own sheets for 18,
19 and 20/09 it names every departure end (twelve pairs) and ten of eleven
arrival ends, the eleventh being left blank; the one fitted fact is the
Ashford Down Yard's layout, the only one of four that agrees with all ten.
At Faversham a unit that comes back and goes out again keeps one line - 49
of the depot's tabs have such a line, and none has a Faversham line under
the bar.

The **weekend** 395 sheet is the same sheet, filled the same way from the
prints. `src/engine.js` hands `SHEETS_HS.dayFromPrint` each 395 diagram's
stops as the print lists them, with the formation it writes against every
departure ("602(1)\603(2)", leading unit first), and each unit its stint's
stop range. The print's place names become the reports' codes (`PRINT_CODE`,
lined up stop by stop against the Saturday 19/09 Detail); the ends of a 12
are read off the printed order; and because a print lists only where a
diagram does something, the North Kent note is read off the places it does
list and each working's headcode (`viaNorthKent`, right on all 726 workings
of four days' Detail exports) and the neighbour a train really passes stands in for a far-off
print stop when an end is worked out. Last night's arrivals come from the
day before's Summary and Detail — Friday's for a Saturday, Saturday's for a
Sunday — which the weekend tab takes on a drop zone of its own (and two
paste boxes), before or after the prints, read by `GENIUS.hsDaysFrom`, which
does not turn a weekend pair away. The base diagrams need no reports: the
day before's base diagrams give the arrivals. Against the depot's Saturday 19/09 tab it
matches every train ID, FP/RP, ENDS PM and PM arrival (28 of 28).

## The stock requirements form

An option on the weekday panel: the Kent Coast form — thirteen locations
down the side, the five mainline unit types across — with every diagram
counted once at the location it starts the day from (the stock collector in
`genius.js`, keyed by the book's own fleet labels). The blank workbook's
styleSheet ships verbatim and every cell names the blank's own style record,
so file and preview are the depot's form cell for cell, quirks included.
The counts ride out of the build in a field of their own (`res.stock`), so
nothing the golden suite compares changes shape.

## Shortages and variations

One of the two roads that build no workbook, and for the Mainline and Metro
fleets only. It takes the GENIUS **Operating Report** and the **Diagram
Detail** and writes the controller's list: what is short, what is the wrong
length, what is the wrong fleet, and every service each one goes on to
affect. The Diagram Summary is optional: with it, a 3-car in a train of three
or more units can be called wrong end or intermediate; without it those go on
the Review list.

Ported from the depot's own *Shortage and Variations* prototype (v0.4). The
engine is kept as it was written — it was held against the real 18/09 reports
before the port and reproduced them line for line — and only the plumbing
changed: it carried its own copy of the PDF extractor and its own fflate, both
of which were already here, so it now reads what the rest of the tool reads,
and the Diagram Detail can arrive as the CSV export as well as the PDF.

- **The Operating Report** has to be pulled with *Unallocated legs* ticked
  (without it there are no *Not allocated* lines) and for depot RM
  (Mainline) or SG (Metro). `build` checks both off the report and says so
  on the Review list.
- **Shortages** come from a *Not allocated* line, inside the window the
  report's own print time puts it in: printed 01 00–08 00 is the morning list
  (departures before 09 00), 08 00–18 00 the afternoon list (12 00–18 00).
  The **Shortage list** option picks either whatever the print time; left to
  the print time, a report run after 18 00 says so on the Review list rather
  than guessing. Each row is timed by the Diagram Detail's day, which runs
  past midnight (`dayClock`), so a unit going to bed at 00 27 is tonight's
  and not this morning's. On the morning list a shortage stops where the unit
  is put away: past 09 00 it runs on only along its own diagram, and a stand
  of three hours ends it (`chainsOn`); the afternoon list follows a shortage
  for the whole of its life.
- **Variations** are a unit of the wrong length, family or class against the
  plan. A 3-car and a 4-car swapped between two diagrams on one working read
  as `3 CAR WRONG END`; reciprocal 375 / 375-9 swaps cancel; a 377 on an RM
  diagram is paired with its mate when the diagrams start together.
- **The trace** is the part no other road has: legs shared between diagrams
  are stitched into one working with a union-find, so a variation is followed
  through every service it touches and grouped by the length the train ends up
  — the `FOLLOWING` lines.

Its **place codes are the roads** — `AFDS`, `AFUS`, `DVPS`, `GPUS` — where the
berthing books name the station (`AFK`, `AFU`, `DVP`, `GPU`). A plain station
not in that table is named by its CRS code off `SHEETS_DATA.STATIONS`, by the
report's own name for it (`stationCrs`: the name must be a station's, or the
start of exactly one where Genius cut it short), so Deal is `DEA`; a siding or
signal named after a station never matches, and stays `???` with the Review
naming it. The reports can be pasted as well as dropped, into boxes read by
what is in them. That is a
difference of audience, not an inconsistency: a berthing sheet says where a
unit is put away, and a discrepancy is worked off a road. Neither table is the
other's master, and `test/shortage.test.mjs` guards them apart.

## Berth requests

The other road that builds no workbook, for the Mainline and Metro fleets
only, and the one still being proved — the tab says so, and
`Sheets Generator (no berth requests).html` is the same page without it.
It answers the question the planner spends the evening on: which working
gets each unit to where its exam, its defect or its scheduled maintenance
needs it to be. Paste the night's Telex tab, drop the day's reports (or
build the weekday books first, and theirs are used), and every empty Action
comes back filled, with the reason beside it. Three more boxes take the
units out of service (ignored), the defects export from Equinox or EMS as it
comes, and the units MSE is attending (left without a request). A tick says
the day has not run yet (ticked for you when the reports are for today or
later): a unit is then first offered today's workings from where it starts
the day, so the request is made before it goes out, and only then the ones
from where it ends tonight.

**Three control documents paste here**, and which it is is read from the
paste or set with the *Workbook* choice:

| | What it is | What comes back |
|---|---|---|
| **Mainline plan** | The *Maintenance Plan* tab of the Mainline Stock Control Document: Exams, Scheduled Maint, Defects and the rest, each with its own columns. | A berth request in the Action column, in the depot's own words: `AFK BERTH off 2A01`, `RE HOLD`, `ENDS DVP`. |
| **Metro Telex** | The same tab of the Metro Stock Telex: exam lists headed by depot, a *Location* column for the road a unit stands on. | The Telex's own phrasing: `GPU - BERTH 05+03 (5F08)`, `HOLD FOR EXAM`, the London end, country end or middle of a portion. |
| **High Speed disposition** — switched off | The *Class 395 Disposition Statement*: a row per unit, five day columns of what the depot wants, four planning columns on the right. | Turned away by name: berth requests are for the Mainline and Metro fleets only. The road below is kept and tested; `HS_DISPOSITION` in `src/berth.js` brings it back. |

**What the rules read.** Where each unit is tonight (the Allocation
Summary, or the Diagram Summary once the day is allocated), where its
diagram ends, every departure out of there tomorrow, what stands long
enough at another depot to be swapped, which road inside a depot a working
leaves from, and the standing fleet moves. The depot's own constraints are
in `src/berth.js` as one clause each — a unit landing in Slade Green Up
Sidings has to go on an Up Sidings diagram, Ramsgate is one road because
the staff shunt into the station, Tonbridge is the Jubilee, the down main
and the platform, a restriction that says *multiple only* cannot be offered
a single-unit working, a slow-down goes on the fewest miles, a defect with
days to run can be *contained* on a multiple diagram instead of sent home.
The 395s are a different job again and live in `src/berth-hs.js` (switched
off on the tab - see above - but kept and tested): a unit
goes out from the depot its *DEPT LOCATION* names, a restriction keeps it
off the Ebbsfleet high level or the North Kent, and *Early PM*, *Between
Peaks*, *PM*, *Low Mileage*, *Hold* and *Stable if possible* each pick
from that depot's diagrams.

**Nothing is claimed that the planner would not claim.** A departure is
listed for every unit that could take it, because that is the list the
planner writes; only a swap claims a diagram outright. A unit no report
places gets a **blank** Action, not a form of words, so the stock
controller writes their own over it.

**It goes back the way it came.** The plan keeps the shape it was pasted
in — the titles, the heading rows, the blank rows between groups — and each
workbook's tab is carried as a style record per cell, lifted from the real
document by the skin lifters in `tools/`. *Copy the plan back* puts that on
the clipboard to paste over the tab from A1; *Save as Excel* writes the
same sheet with a **Why** sheet beside it; on the page the Why sits in a
column of its own, held to one line so the rows keep the height the
workbook gives them.

**How far it is calibrated.** Against the 20/09 Telexes: the Mainline plan
agrees with the planner on a little under half its lines, and the rest are
choices they have said are theirs to make. The Metro side aims at Slade
Green and Gillingham, which is confirmed, but cannot see the restrictions
Metro plan around, which is most of what is left. The 395 sheet puts every
unit at the right depot and matches the planner's own diagram on ten of
twenty-four, and all five of the sheet's head counts. What is not settled
is written down in `HISTORY.md` release by release, and the rulebook fold
on the tab says which rule made each suggestion.

## The interface

`src/ui.js` is one file with three parts. **`MSG`** holds every sentence the
page can say. **`makePanel`** owns what the three book-building panels share —
the status board, the paste box, the drop zone, the cards container, and one
build queue whose every job is caught, so a fault cannot leave the queue
rejected. The **weekday** closure and **`printsPanel`** add what differs:
which reports they take, and a registry of the books that come back
(`BOOKS`), each a small descriptor of what to write, what to preview and
which review items are its own. `printsPanel` is set up twice, as the
**weekend** tab and as the **base diagrams** tab, and the two differ only in
what they build from the prints (a day, or a week). Files dropped on the
wrong panel are forwarded — weekday reports to the weekday tab, a day's
prints to the weekend tab, base diagrams to the base tab (`printsKind`).
Each book's card draws the trains it actually carries and names them
(`spritesFor`, `fleetText`), so a card with no 377 diagrams draws no 377.
Previews open by default; a rebuild restores what was open, on which tab, at
which scroll, and puts focus back where it was. A paste of a whole report is
held off the page (`holdPastes`) rather than put in the box, which a
six-megabyte Diagram Detail once took the browser down with. The
**shortages** and **berth-request** panels build no book, so they have
closures of their own: they take their own reports, keep their own paste
boxes, and write a list rather than a workbook.

This computer's storage (guarded, optional) holds three things under
versioned keys: `sheetsRules.v1` (order corrections made with Reverse),
`sheetsPrinted.v1` (a fingerprint of every saved book, so a later export of
the same date can say what moved), and `sheetsOpts.v1` (the option boxes and
the mode). A corrupt or blocked store is reported on the board, once.

## The diagram analyser

`Diagram Analyser.html` reads the same prints through `src/prints-read.js`
and asks different questions of them. Each fleet in the prints gets a card;
a row of book tabs (Mon–Thu, Friday, Saturday, Sunday — picking one moves
every card) sits over a tab per question:

| Tab | What it answers |
|---|---|
| Arrivals home | Units whose diagram *ends* at the home depot, before noon, noon to midnight and after; one that calls in and goes out again is not counted. |
| Home before 8pm | Diagrams that end at home between noon and 20:00, and when each is needed again. |
| Restricted units | Diagrams coupled on every leg — the only ones a restricted (MO) unit can take — and, night by night, whether a unit on them can stay on that work. |
| Days back to depot | For every place a unit can be left, how many days the diagrams take to bring it home, and the way back. Days, not diagrams (1.8.0). |
| Mileage | Miles per unit a day and a year by sub-fleet, divided by the units the depot owns, with the sum shown step by step. Always the whole week. |
| Attendable stands | Every stand of two hours or more during the day. |
| Cannot contain | Places a restricted unit cannot be worked from, and where units come apart. |
| Together AM, apart PM | Units that go out coupled, are put away together and part later. |
| Place codes | What each nine-character place code in the prints means. |
| To *home* | Only for a depot off this network (Selhurst): finishers and parked units at the handover point in time for the windows. |

Each tab opens on a headline in words, a *How this is worked out* fold, the
counts, and the table; *Save this fleet* writes the same answers as a
workbook (a sheet per table, plus one listing every diagram), *Save every
fleet* all of them in one. Units owned per sub-fleet, the home depot, where each fleet
can be repaired and the handover windows are the depot's own arrangements,
set under *Fleets & depots* on the page and remembered on the computer. It
has its own version number and its own test file; the two meanings of
**MO** (a restricted unit that must run coupled; *Mondays only* on the
prints) are written down at the top of `src/fleet/fleet.js`.

## Reference data — where the knowledge lives

All of the tool's local knowledge lives in `src/data.js` (`SHEETS_DATA`), so
corrections are one-line edits in one place, and `test/data.test.mjs` holds
the tables to the legacy build and to each other.

| Table | What it holds |
|---|---|
| `BERTH_SHEETS` | Berthing location → [section, code, siding note, TLC] for every known berth, siding, shed and signal-stand. |
| `DEST_TLC` | Destination name → three-letter code for column A. |
| `NON_BERTH_VISIT`, `SIDING_CLASS_RE` | Which locations never count as berths; what a siding looks like by name. |
| `MAIN_ORDER` / `METRO_ORDER` / `HS_ORDER`, `HEADCODE_SECTIONS`, `SIDING_NOTES`, `END_STYLE`, `GP_ROAD`, `DAY_SHEET` | Section order per book, which sections quote headcodes, the siding notes, the end-marker styles, Grove Park road labels, the day-tab names. |
| `CODE2NAME`, `STABLE_CODES`, `MINOR_SPUR`, `NAME_CODE`, `FIX_CODE`, `PROFILES_G`, `END_MARKERS_GENIUS`, `GROUP_EXTRA`, `ORDER_FIX`, `PLATFORM_TURN`, `ROUTE_BY_HC` | Genius location codes → names, which codes are stabling, the shunt spurs needing a long stay, hand-learned code corrections, the fleet profiles, the end-lead rules, section members that are not berths, the hand-marked unit orders, the platform-turn sections, the route-by-headcode rules. |
| `DEST_CODE`, `BERTH_CODE`, `NOTE_FROM_BERTH`, `BASE_STABLING`, `TRANSIT`, `MANUAL_LOC`, `STATION_TABLE`, `END_MARKERS_PRINTS`, `PROFILES` | The weekend engine's curated code tables, siding notes, stabling set, transit-only places, manual locations, the station-name → CRS resolver table, the prints' end-marker rules, and the fleet profiles (derived from `PROFILES_G`). |
| `PLACE_NAMES`, `NON_BERTH_PRINTS` | The prints' place abbreviations spelt out, and the shunt points that are not berths — used by the analyser. |

The station resolver (`resolveStation`) is a last resort behind the curated
tables: prints abbreviate by dropping letters, so it matches by subsequence
and prefix against the station table, and every low-confidence match is
named on the Review tab so it can be checked and, if right, promoted into
the tables.

## Genius and Integrale are not interchangeable

Both build books through the same rulebook, and the suite pins them to
identical output on the synthetic fixture. On real exports they differ:

| | Genius | Integrale |
|---|---|---|
| **Unit numbers** | The `UNITS` column has been empty in every export seen, so column F is left ruled and blank. | `Start Stock` carries the allocated unit — 216 of 244 entries filled on one real day. |
| **Position** | One summary row per *working*, so a unit's position is read at each departure. | One row per *diagram*, one position for the whole day — an afternoon formation prints in its morning order (Genius agreed with the real book 13/13, Integrale 0/13). |
| **The activity column** | Carries `#` (a shunt on the spot). | No `#` at all, so the going-home pause rule never fires. |

If both are available, Genius is the better source for order and Integrale
for unit numbers. Nothing merges them.

## Requirements and privacy

- Any current desktop browser (Edge, Chrome, Firefox). The page detects a
  browser that cannot run it and says so; with scripting disabled a
  `<noscript>` notice explains what to do.
- Fully offline: the files have no external references (even the guide's
  screenshots are embedded) and make no network requests. Files are read
  with `FileReader`; workbooks come back as `Blob` downloads. Nothing is
  uploaded anywhere.
- Vendored third-party code: fflate (MIT) only.
