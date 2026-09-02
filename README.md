# Sheets Generator

Two single-file, offline browser tools for a Southeastern depot:

- **`Sheets Generator.html`** — builds the unit **berthing books** (the
  SHEETS) from the planning paperwork: on weekdays the Genius *Diagram
  Summary* and *Diagram Detail* reports (PDF or CSV) or the Integrale CSV
  exports; on weekends the diagram prints Word document. Out come the
  Mainline, Ramsgate, Metro and High Speed books as Excel workbooks, previewed
  on screen exactly as they print, with a Review tab of everything the rules
  had to decide for themselves — and, on request, the Kent Coast stock
  requirements form.
- **`Diagram Analyser.html`** — reads the same diagram prints and answers
  maintenance planning's questions: arrivals home, what stands still long
  enough to be worked on, what can carry a restricted unit, mileage per
  unit, how long a unit takes to get back to its depot.

Nothing leaves the machine: no server, no upload, no network access. Both
files are committed, built, and handed round as they are.

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
| `Sheets Generator.html`, `Diagram Analyser.html` | **The built deliverables** — committed so they can be downloaded and used directly. Regenerate with `node build.mjs`; never edit by hand. CI fails if either is stale. |
| `HOW TO USE.md` → `HOW TO USE.docx` | The user guide; the Word file is generated from the Markdown by `tools/make-guide-docx.mjs` on every build (needs the `docx` package from `npm ci`). |
| `BERTHING SHEET RULES.html` | The rulebook for circulating, generated on every build by `tools/make-rules-doc.mjs` from the built file's own tables — nothing on it is typed out separately. |
| `HISTORY.md` | Release history and the reasoning behind past changes. |
| `src/page.html`, `src/styles.css` | The page shell (both panels, the how-to fold, the ES5 capability probe, the `{{CSS}}` / `{{SCRIPTS}}` / `{{VERSION}}` / `{{RELEASED}}` placeholders) and all styling. The analyser reuses `styles.css` for its base look and adds `src/fleet/fleet.css`. |
| `src/data.js` — `SHEETS_DATA` | Every reference table for every engine: berths, destination codes, section orders, fleet profiles, the station table, end-marker rules, the place names. Corrections belong here. |
| `src/rules.js` — `SHEETS_RULES` | Local unit-order corrections (key grammar, merge, storage round-trip) and `explain()` / `explainHtml()`, which turn a build's rules into plain English for the Rules tab and the printed handout. |
| `src/prints-read.js` — `SHEETS_PRINTS` | Opening a set of diagram prints whatever they arrive as: `.docx`, legacy `.doc` (OLE compound file and Word piece table, by hand), plain text, UTF-16 text, or a CSV save. Also owns `csvParse`. Both tools read the prints through this one module. |
| `src/core.js` — `SHEETS_CORE` | Shared helpers: name normalisation, destination codes, time formatting, the berth AM/PM rule. |
| `src/rulebook.js` — `SHEETS_RULEBOOK` | The day-shape constants (`DAY_ROLL`, `PM_BREAK`, `RUN_ROUND`, `AM_CUTOFF`) and the stop-collapsing walk both engines share. |
| `src/xlsx.js` — `SHEETS_XLSX` | The one xlsx writer (hand-built SpreadsheetML, multi-sheet, zipped with fflate), the weekday book layout, the print planner, and the one preview renderer. |
| `src/stockreq.js` — `SHEETS_STOCKREQ` | The Kent Coast stock requirements form: the depot's blank workbook, its styleSheet carried verbatim, filled from the day's plan. |
| `src/metro.js` — `SHEETS_METRO` | The Metro book in the depot's own format: a worksheet per location, landscape, fourteen columns. |
| `src/hs-skin.js`, `src/hs.js` — `SHEETS_HS_SKIN`, `SHEETS_HS` | The Class 395 Allocations Sheet: the depot's own style records (generated from their workbook by `tools/make-hs-skin.py`, not in the repo) and the sheet built with them. |
| `src/engine.js` — `SheetsEngine` | The weekend pipeline: diagram parsing, generation, reissue merge, the updated-prints splice, the report. |
| `src/genius.js` — `GENIUS` | The weekday pipeline: PDF text extraction, Summary/Detail parsing for the Genius PDF and CSV exports and the Integrale CSVs, and the house rulebook applied to whichever arrives. |
| `src/ui.js` | The page: the mode switch, the two panels (one panel controller, one message table `MSG`), the cards, the sprites, the Rules and Unit order tabs, this computer's memory. |
| `src/fleet/*` | The analyser: `prints.js` (the prints parsed for the fleet's sake), `fleet.js` (the analysis), `report.js` (the seven questions, rendered once for the screen and once for the workbook), `xlsx.js` (a small plain-grid writer), `ui.js`, `page.html`, `fleet.css`. |
| `src/vendor/fflate.js` | fflate (MIT), the only third-party code: zip/unzip for docx and xlsx, inflate for PDF streams. |
| `build.mjs` | Assembles `src/` into both files, stamps the versions, then runs the two document generators. |
| `test/` | The suite (see below). `test/helpers/` loads a built file into a Node `vm` sandbox and makes the synthetic fixtures; `test/fixtures/legacy.html` is the frozen pre-2.0 build the weekday books are compared against. |
| `tools/` | `browser.mjs` (finds Chromium for Playwright), the three smokes, screenshot scripts, `order-check.mjs` (the unit-order mark-up sheet), and the two document generators. |

## Building, testing, releasing

```
npm ci             # once: the docx package for the Word guide, nothing else
node build.mjs     # src/ -> "Sheets Generator.html" and "Diagram Analyser.html",
                   # then BERTHING SHEET RULES.html and HOW TO USE.docx
npm test           # build, then node --test "test/**/*.test.mjs"
node tools/smoke.mjs        # Chromium: weekday PDFs, weekend prints, pasting, the stock form
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
| `fleet.test.mjs` | The analyser, against stated behaviour — it has no legacy build. |
| `build.test.mjs` | Both artifacts: self-contained, under the size ceiling, version-stamped, no placeholder left, dead symbols gone. |

Every fixture is invented (`test/helpers/synth.mjs` writes fabricated
Genius PDFs, CSVs and prints documents). **No real planning data is ever
committed** — `.gitignore` refuses every format it arrives in.

**CI** (`.github/workflows/ci.yml`) builds both files, fails if either
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
2. **Parsing diagrams** (`parseDiagrams`). `Diagram:\t<CODE>\t<NUM>\t…`
   headers, `Fleet:` and `From:`, and the tab-indented itinerary rows. `#`
   flags a berthing; `STABLD` marks the road a diagram starts in.
3. **Reissue merge** (`mergeDocs`). Files named *reissue* are overlaid on the
   base document diagram by diagram, same-date check enforced; replaced and
   added diagrams go on the Review tab. `buildUpdatedDocx` splices the
   reissued diagrams' paragraphs into the base `document.xml` and re-zips it
   — only when both the base and the reissue are Word documents; otherwise
   the Review tab says so and no document is offered.
4. **Generation** (`generate`, once per fleet profile) — the same stops,
   boundaries and stints as the weekday path, to the weekday rulebook,
   plus berths *learned* from `#` markers and auto-sections for places the
   section list does not know.
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
- **Timing.** A berthing book times an entry off the last departure from
  the section — the moment the unit leaves the area; the Metro and 395
  documents (`firstDepAll`) off the first move. The stint walk stops at the
  stint's end boundary; running past it was the source of the phantom rows
  fixed in 3.0.0.
- **Which unit prints first.** Each section reads from one end
  (`posAsc`, with `roadPosAsc` for a road that faces the other way); a
  formation that turned round in the platform prints the other way up; the
  hand-marked corrections (`ORDER_FIX`) override the position numbers where
  the depot has said so. What the reports cannot say — which way a train is
  physically facing — is measured in [HISTORY.md](HISTORY.md) and is why
  the corrections list exists.
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
look like somebody else's document — the 395 sheet, the stock form — ships
that document's own styleSheet verbatim and names exact style records per
cell, with the same records as CSS for the preview. The print planner
(`printPlan`) sets A4 portrait, a scale that fits the columns across and the
longest section down, and manual breaks so no location straddles a page; a
layout may instead carry its own margins and a fixed scale. Number cells are
written only for finite numbers. There is one preview renderer, and it draws
the same cell layout the writer saves — what you look at is what you get,
page breaks included.

## The two documents that are not berthing sheets

The weekday **Metro** book is the depot's own Metro document: a worksheet
per location (per location *and* day when a pair covers more than one
date), landscape, fourteen columns, read by Position, eight columns filled
and six left ruled for hand entry. The weekday **High Speed** book is the
Class 395 Allocations Sheet: a worksheet per day, a block per depot, last
night's arrivals (one row per unit; arrival time and train ID left for the
depot, since the reports do not carry them) beside today's allocations, in
the sheet's own style records, drop-downs and mileage colouring. Neither has
a formation order to correct, so neither has a Unit order tab, and each
one's Rules tab describes the document it is.

## The stock requirements form

An option on the weekday panel: the Kent Coast form — thirteen locations
down the side, the five mainline unit types across — with every diagram
counted once at the location it starts the day from (the stock collector in
`genius.js`, keyed by the book's own fleet labels). The blank workbook's
styleSheet ships verbatim and every cell names the blank's own style record,
so file and preview are the depot's form cell for cell, quirks included.
The counts ride out of the build in a field of their own (`res.stock`), so
nothing the golden suite compares changes shape.

## The interface

`src/ui.js` is one file with three parts. **`MSG`** holds every sentence the
page can say. **`makePanel`** owns what the two panels share — the status
board, the paste box, the drop zone, the cards container, and one build queue
whose every job is caught, so a fault cannot leave the queue rejected. The
**weekday** and **weekend** closures add what differs: which reports they
take, and a registry of the books that come back (`BOOKS`), each a small
descriptor of what to write, what to preview and which review items are its
own. Files dropped on the wrong panel are forwarded. Previews open by default;
a rebuild restores what was open, on which tab, at which scroll, and puts
focus back where it was.

This computer's storage (guarded, optional) holds three things under
versioned keys: `sheetsRules.v1` (order corrections made with Reverse),
`sheetsPrinted.v1` (a fingerprint of every saved book, so a later export of
the same date can say what moved), and `sheetsOpts.v1` (the option boxes and
the mode). A corrupt or blocked store is reported on the board, once.

## The diagram analyser

`Diagram Analyser.html` reads the same prints through `src/prints-read.js`
and asks different questions of them: arrivals home by fleet and time of
day, arrivals home before 20:00, restricted-unit (MO) diagrams that never
detach, how many days a diagram takes to bring a unit back to a repair
depot from each place it can be left, mileage per unit by sub-fleet, where
the morning arrivals berth, and the locations a split diagram cannot be
contained at. Depots and repair points are the depot's own arrangements and
are set on the page, remembered on the computer. It has its own version
number and its own test file; the two meanings of **MO** (a restricted unit
that must run coupled; *Mondays only* on the prints) are written down at the
top of `src/fleet/fleet.js`.

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
