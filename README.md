# Sheets Generator — unit berthing sheets from the planning paperwork

A single, self-contained HTML file (`Sheets Generator.html`) that turns fleet
planning paperwork into the daily **unit berthing books** ("SHEETS") for a
Southeastern-style fleet and depot operation, with every diagram number filled
in and the house drafting conventions applied automatically.

* **Weekday books (Mon–Fri)** are built from the *Diagram Summary* and
  *Diagram Detail* reports for the date — from **Genius** as PDFs or as CSV
  exports, or from **Integrale** as its two CSVs; every source produces the
  same books through the same rulebook.
* **Weekend sheets (Sat & Sun)** are built from the weekend **diagram prints**
  Word document (`.docx` or legacy `.doc`), with automatic merging of
  reissued prints.

Everything runs inside the one file, in the browser, on the local machine. No
report, print or sheet ever leaves the computer, and the page works without an
internet connection — the only library it needs (fflate, for zip and inflate)
is bundled into the file itself. The deliverable is about **300 KB** (a third
of it the how-to screenshots in the quick start); the source lives in `src/`
and is assembled by `node build.mjs`.

> **These are drafting tools.** Every build produces a review list naming
> anything the rules had to decide for themselves. Always read it, and always
> double-check the generated sheets against the ACWNs before anything goes
> out.

---

## Contents

- [Quick start](#quick-start)
- [The books it produces](#the-books-it-produces)
- [How to read a sheet](#how-to-read-a-sheet)
- [The review list](#the-review-list)
- [Troubleshooting](#troubleshooting)
- [How it works](#how-it-works)
  - [Repository layout](#repository-layout)
  - [Weekday pipeline (Genius PDFs)](#weekday-pipeline-genius-pdfs)
  - [Weekend pipeline (diagram prints)](#weekend-pipeline-diagram-prints)
  - [The house rulebook](#the-house-rulebook)
  - [The workbook writer and the preview](#the-workbook-writer-and-the-preview)
- [Reference data — where the knowledge lives](#reference-data--where-the-knowledge-lives)
- [Requirements and privacy](#requirements-and-privacy)
- [Building and testing](#building-and-testing)
- [The 2.0 overhaul](#the-20-overhaul)

---

## Quick start

Open `Sheets Generator.html` in a modern browser (Edge, Chrome or Firefox —
just double-click the file; no server, install or sign-in is needed). The page
has two drop panels, one per workflow.

### Weekday books — from the Genius reports or the Integrale exports

The weekday panel reads either planning system:

* **Genius**: make sure a **Control Cycle** exists for the date (and for the
  Metro / High Speed fleets if those books are wanted), then run
  **Diagrams → Summary Report…** and **Diagrams → Detail Report…**. Save each
  as a **PDF** or as a **CSV** — both are read, and a PDF summary pairs with a
  CSV detail if that is what you have. The CSV carries one line per *working*,
  so it keeps the Position changes the PDF also shows.
* **Integrale**: export the **Diagram Summary** and **Diagrams** CSVs for the
  date. Activity markers (ATTACH/DETACH/STABLD) are understood, stable-all-day
  placeholder diagrams are left out with a review note, and headcodes mangled
  by spreadsheet number formatting (`2.00E+05`) are recovered as `2E05`.

  The summary file: open the **Stock Diagrams** list, click **[GO→]** without
  selecting a filter, click **[Export To Excel]**, then save it in a sensible
  folder under a sensible name with **File Type** set to **.csv**.

  The detail file: open the **Stock Diagrams** list and click **[GO→]** again,
  still without a filter; click **Stock Diagram Detail Report** on the
  toolbar; when the dialog opens at the bottom of the screen click **[…]**
  under **Output Path**; pick the same folder, give it a sensible name,
  **File Type .csv** again, **[Save]**; then **[OK]** (you may have to scroll
  down to see it). It takes a minute or so and tells you when it is done.

  The same steps, with screenshots of the two toolbar buttons and the output
  dialog, are behind *Getting the two CSVs out of Integrale* in the page's own
  quick start.

3. Drop **both files** on the first panel (*Weekdays · Mon – Fri*), together
   or one after the other — the tool recognises which report is which from
   its contents and waits until it has a matching pair (two PDFs or two
   CSVs). You can also click the panel to browse for the files.
4. The books are built immediately: look them over in the on-screen preview
   (per-day tables for Mainline, Metro and High Speed, plus the Review tab),
   then save each book, or all of them at once as a single zip.

Four roads are always shown — **SHEETS**, **RAM SHEETS**, **METRO SHEETS** and
**HS SHEETS**. A road whose fleet has no diagrams in the reports says so
(*"nothing to berth"*) instead of offering an empty workbook to save; for
Metro and High Speed it also reminds you that Genius needs a Control Cycle
for that fleet. The *Save all* zip holds only the books that were built.

If the reports cover several weekday dates, one day tab is built per date
(MON…FRI) inside each workbook. Dates that fall on a weekend are skipped with
a note pointing at the weekend panel.

### Weekend sheets — from the diagram prints

1. Get the weekend **diagram prints** Word document (`.docx`, or legacy
   `.doc` — both are read).
2. Drop it on the second panel (*Weekend · Sat & Sun*). If **reissued
   prints** exist, drop them too — together with the original or in a later
   drop. Any file whose name contains *reissue*/*re-issue* is treated as a
   reissue; its diagrams **replace** the matching originals (and new diagrams
   are added) before anything is built.
3. Three workbooks are built — **Mainline**, **Metro** and **High Speed** —
   each with a *Look at it* preview and its own review list. A fleet with no
   diagrams in this weekend's prints says *"nothing to berth"*, the same way
   the weekday panel does.
4. When a reissue has been merged and the base prints are a `.docx`, an
   **updated prints document** (`…_UPDATED.docx`) is offered as well, with the
   reissued diagrams spliced into the original file.
5. **Start over** clears everything that has been loaded.

### Before anything goes out

Read the review list on every build. Anything the rules had to decide for
themselves is named there — locations that needed looking up, empty moves left
off, diagrams whose pages didn't read cleanly — rather than quietly guessed
at. Check the finished books against the reports, the prints and the ACWNs.

---

## The books it produces

| Book | File name | Contents |
|---|---|---|
| **SHEETS** | `SHEETS_<tag>.xlsx` | The mainline book (classes 375 / 375-9 / 376 / 377), every section from Ashford to West Marina. Ramsgate is cut out into its own book. |
| **RAM_SHEETS** | `RAM_SHEETS_<tag>.xlsx` | Ramsgate's own book, cut from the same day's workings. |
| **METRO_SHEETS** | `METRO_SHEETS_<tag>.xlsx` | The metro book (classes 465 / 466 / 707). |
| **HS_SHEETS** | `HS_SHEETS_<tag>.xlsx` | The High Speed book (class 395) — built whenever the reports contain High Speed diagrams. |
| **Weekend** | `SHEETS_<stamp>.xlsx`, `SHEETS_465_466_707_<stamp>.xlsx`, `SHEETS_395_<stamp>.xlsx` | One workbook per fleet for the weekend day, plus `<prints>_UPDATED.docx` when a reissue was merged. |

`<tag>` comes from the report dates (e.g. `MON-03-08`); the weekend `<stamp>`
comes from the prints' own date (e.g. `SAT_02_AUG`). Weekday workbooks carry
one worksheet per day (`MON`, `TUE`, …); each weekend workbook is a single
day's sheet.

**Section order.** The mainline book runs Ashford → Dover Priory → Faversham →
Folkestone East → Gillingham → Grove Park → Hastings → Orpington → Slade Green
→ Strood → Tonbridge → Victoria → West Marina; Metro and High Speed have their
own orders. A location the section list has never heard of gets its own
section, slotted in alphabetically, and a note on the review list.

---

## How to read a sheet

Each section is a ruled box headed by the section name and the date. Within
it, one **entry** per departure, one row per **unit**, listed the way the
hand-built books list them — which unit leads is per section, from the
Summary's `Position` field (see [the house rulebook](#the-house-rulebook)).
The columns are:

| Col | Content |
|---|---|
| A | Departure time and destination code — `06 45 CHX` for a passenger working, `05+32 VIC` for empty stock (the `+` is the ECS convention). Where a working runs through the station platform, the time is taken off the platform, not the siding — except in the Metro book, which is timed off the first time the unit moves (see the rulebook below). |
| B | Unit type, e.g. `4 375`, `2 466`, `6 395` (cars + class). |
| C | The unit's three-digit diagram number. |
| D | **AM** — where the unit goes next (its next berth) during the day. |
| E | **PM** — where the unit ends its day. |
| G | Flag — `SPLITS` when the units of this departure part company during the day, `SPLITS PM` when they only part in the evening (the D/E columns settle who goes where). Merged vertically across the entry's rows. |
| H | Notes — see below. |

**Notes column (H)** carries the house annotations:

* A per-book **toggle** above each drop zone (Mainline / Metro / High Speed)
  puts **every** entry's headcode in the notes column — ECS and platform
  starters alike, Victoria & Grove Park style. Off (the default) keeps the
  house rules below. Flipping a toggle after a build rebuilds the books in
  place.
* The **ECS headcode** in the sections that quote it (Gillingham, Victoria,
  Grove Park — plus Slade Green in the weekend Metro book). At Grove Park the
  road is appended (`SD` / `DN` / `UP`); at Victoria the headcode shown is the
  one off the sidings even though the time is from the platform.
* **Siding notes** such as `EAST SIDINGS`, `UP SIDINGS`, `UPS`, `DNM`, `JUB`,
  naming which road the unit starts from.
* **`ATTACHMENT`** when another unit joins this departure (a unit re-entering
  its berth just to attach is not listed as its own row — the note covers it).
* **End markers** at the places where the two ends of a train are named for
  the way out: Dover Priory (`FKE END` / `CBE END`), Folkestone East
  (`AFK END` / `DVP END`), Hastings (`TON END` / `ORE END`), West Marina
  (`HGS END`). Which end leads is decided from the destination and route; when
  no rule fits, the review list says so instead of guessing.
* At the unmanned Folkestone East Train Roads, each 12-car departure is noted
  with the arrival that forms it (`EX 21+38 ARR`) — worked out last-in-first-out
  from tonight's arrivals, and always flagged for a double-check against the
  ACWN.

**What is deliberately left off:** empty moves to a berth with no passenger
work afterwards are suppressed, the same as the hand-built sheets — and each
one is named on the review list so nothing disappears silently. Grove Park is
printed as two tables: the overnight-berthed block first, later re-departures
second.

---

## The review list

Every build shows a count of review items and a tab listing them. Typical
entries:

* a location that is not in the section list (given its own section — check
  whether it should live under an existing one);
* a suppressed empty move to a berth, named diagram by diagram;
* a Folkestone East `EX … ARR` note, which is inferred and must be checked;
* an end-marker decision that had no rule to lean on;
* weekend engine items: station dwells treated as layovers rather than
  berths, short stops treated as berths (the Maidstone West shape), run-rounds
  folded into the following departure, destinations or berths that had no code
  in the curated tables (the resolver's guess is shown so it can be checked
  and promoted into the tables), and the reissue-merge summary (which diagrams
  were replaced or added).

---

## Troubleshooting

| Symptom | Meaning |
|---|---|
| *"No Diagram Summary rows found"* / *"No Diagram Detail itineraries found"* | One of the two weekday PDFs is missing or is the wrong kind of report. Both must be dropped, printed for the same date. |
| *"…doesn't look like a Genius report"* | The PDF's text couldn't be matched to either report — make sure it was saved from Genius itself (the extractor reads machine-produced PDFs, not scans/photographs). |
| A location comes up under its own heading | A unit berthed somewhere the section list doesn't know. It gets its own section in alphabetical order and a review note — check it, and if it should live under an existing section, add it to the tables (see [Reference data](#reference-data--where-the-knowledge-lives)). |
| A train is missing | Check the review list first: empty moves to a berth are left off deliberately and each one is named there. If it isn't listed, trace the diagram number. |
| *"That file is damaged or isn't a Word document"* | Open the prints in Word and re-save as `.docx`, then drop the new file. |
| A road says *nothing to berth* | No diagrams for that fleet are in the reports or prints — nothing to build, nothing wrong. In Genius, check a Control Cycle exists for that fleet. |
| *"That looks like a reissue on its own"* | A reissue was dropped without the full weekly prints — drop the full prints with it (or first). |
| Reissue rejected for its date | The reissue is dated differently from the base prints — it belongs to a different day. |
| Page says the browser is too old / scripting is off | Open the file in a current Edge, Chrome or Firefox with JavaScript enabled. |

---

## How it works

The deliverable is one HTML file, but the source is a small set of modules in
`src/`, assembled by `node build.mjs`. Each module also guards
`module.exports`, so every engine runs under plain Node — that is how the
test suite drives them.

### Repository layout

| Path | What it is |
|---|---|
| `Sheets Generator.html` | **The built deliverable** — committed so it can be downloaded and used directly. Regenerate with `node build.mjs`; never edit by hand. |
| `HOW TO USE.md` | The guide for the people who run the sheets — no build steps, no code. This README is the technical account; that one is the working one. |
| `HOW TO USE.docx` | The same guide as a Word document, for circulating. Generated by `tools/make-guide-docx.mjs` (`npm i docx` first); edit the Markdown and the script together, never the `.docx` by hand. That script's header has the recipe for rendering it to check — it needs `libreoffice-writer`, not just `libreoffice-core`. |
| `src/page.html` | The page shell: markup for both panels, the quick start, the ES5 capability probe, and the `{{CSS}}`/`{{SCRIPTS}}` placeholders. Scripts sit at the *end* of `<body>` (see [the 2.0 overhaul](#the-20-overhaul)). |
| `src/styles.css` | All page styling, including the fleet-sprite styles. |
| `src/data.js` | **`SHEETS_DATA`** — every reference table for every engine in one module: berths, destination codes, section orders, fleet profiles, the station table, end-marker rules. Corrections belong here. |
| `src/core.js` | **`SHEETS_CORE`** — shared helpers: name normalisation, destination codes, time formatting, and the berth AM/PM rule (`amPm`). |
| `src/rulebook.js` | **`SHEETS_RULEBOOK`** — the day-shape constants (`DAY_ROLL`, `PM_BREAK`, `RUN_ROUND`) and the stop-collapsing walk both engines share. |
| `src/xlsx.js` | **`SHEETS_XLSX`** — the one xlsx writer (hand-built SpreadsheetML, multi-sheet, zipped with fflate) plus the weekday book layout and the one preview renderer used by both panels. |
| `src/engine.js` | **`SheetsEngine`** — the weekend pipeline, a JS port of `make_sheets.py`: `.docx`/`.doc` reading, diagram parsing, generation, reissue merge, report builder. |
| `src/genius.js` | **`GENIUS`** — the weekday pipeline: PDF text extraction, Summary/Detail parsing for the Genius PDF and CSV exports and the Integrale CSVs, and the house rulebook applied to whichever arrives. |
| `src/ui.js` | Page wiring for both panels, the fleet sprites, and the tabbed previews. |
| `src/vendor/fflate.js` | fflate (MIT), the only third-party code left: zip/unzip for docx and xlsx, zlib inflate for the PDF streams. |
| `build.mjs` | Assembles `src/` into the single file. |
| `test/` | The golden test suite (see [Building and testing](#building-and-testing)). `test/fixtures/legacy.html` is the frozen pre-overhaul build the suite compares against. |
| `tools/` | Development utilities: the Playwright smoke tests and screenshot scripts (all of which share `tools/browser.mjs` for finding Chromium), the order mark-up sheet, and the Word-guide generator. |

### Weekday pipeline (Genius PDFs)

1. **Drop handling** (`build(file)` in the last script block). Each dropped
   PDF is text-extracted and classified by content — `DIAGRAM SUMMARY REPORT`
   vs `Diagram Detail Report`. The tool holds whichever arrives first and
   builds as soon as it has one of each.
2. **PDF text extraction** (`GENIUS.pdfText`). No PDF library is used.
   The extractor scans the raw bytes for `stream … endstream` sections,
   inflates them with fflate, and interprets just enough of the PDF content
   stream — `Tm`/`Td`/`TD` text positioning, `Tf` font size, `Tj`/`TJ` text
   showing — to place each string at an (x, y) coordinate. Strings are then
   bucketed into lines by y (2-unit tolerance), sorted by x, and joined with
   double-space gaps where the geometry shows a column break. The result is a
   plain-text rendition of the report with its column structure intact.
3. **Report parsing.** `parseSummary` reads one row per diagram (diagram id
   such as `GT117`, fleet such as `375/6`, coupling **position**, start/end
   times and places) plus the report date. `parseDetail` reads each diagram's
   itinerary — location code and name, arrival, departure, headcode — rolling
   times forward across midnight as it goes, and groups them by date and
   diagram.
4. **Applying the rulebook** (`buildDate`, once per date per fleet profile —
   Mainline, Metro, High Speed). Consecutive rows at one location are
   collapsed into *stops* carrying the identities in and out (`hcIn`/`hcOut`).
   *Berth boundaries* split each diagram's day into *stints*: a boundary is
   the first/last stop, or a stabling location where the identity changes
   (minor shunt spurs also need a berthing-length stay of ≥65 min). Each
   stint whose origin lies in a known section becomes (part of) an **entry**
   in that section — see [the house rulebook](#the-house-rulebook) for the
   conventions applied on the way. Entries are keyed by section + departure
   time + headcode so units leaving together form one multi-row entry, sorted
   into the writer's shape.
5. **Writing.** The weekday UI writes the books with
   `SHEETS_XLSX.writeBooks`: SHEETS (Ramsgate split out), RAM_SHEETS
   (Ramsgate only), METRO_SHEETS, and HS_SHEETS when any High Speed diagrams
   exist. Each book gets its own road card with per-day previews rendered
   from the exact cell layout that is saved, plus the review list.

### Weekend pipeline (diagram prints)

1. **Reading the prints** (`readPrints`). The extension is only a hint; the
   first bytes decide. A ZIP signature means `.docx`: it is unzipped with
   fflate and `word/document.xml` is reduced to paragraph text exactly the way
   python-docx does it (run text, `<w:tab/>` → tab, `<w:br/>`/`<w:cr/>` →
   newline). A CFB signature means a legacy Word 97–2003 `.doc`: a small
   OLE Compound File reader walks the `WordDocument` stream and the table
   stream's piece table to recover the text, run by run.
2. **Parsing diagrams** (`parseDiagrams`). Lines are scanned for
   `Diagram:\t<CODE>\t<NUM>\t…` headers, `Fleet:` and `From:` (the date), and
   double-tab-indented itinerary rows (location, arr, dep, headcode, event
   marker, formation). The `#` event marker flags a berthing; `STABLD`
   diagrams are out of scope.
3. **Reissue merge** (`mergeDocs`). Files named *reissue* are overlaid on the
   single base document diagram-by-diagram (same-date check enforced), with
   replaced/added lists pushed onto the review list. `buildUpdatedDocx`
   additionally splices the reissued diagrams' paragraph ranges into the base
   `document.xml` and re-zips it, producing the `…_UPDATED.docx` download.
4. **Generation** (`generate`, once per fleet profile). The same
   stops/boundaries/stints shapes as the Genius path (this engine is where
   they originate), plus: berthing locations *learned* from `#` markers are
   added to the stabling set for the run; unknown berthing places (and
   overnight stands at unlisted platforms — "the Strood starter") earn
   auto-sections via the station resolver; formation cross-references from the
   prints' `fm` column resolve which unit is which in multi-unit departures.
5. **Writing.** The sheet is laid out once (`layoutBook`) and handed to the
   shared writer in `src/xlsx.js`; the HTML preview renders that same layout,
   so what you look at is what you save.
   Each book also gets a plain-text report (`buildReport`) summarising the
   review items; its lines feed the *Review list* tab.

### The house rulebook

Both pipelines encode the conventions of the hand-built books. The important
ones, all commented at the point of implementation:

* **Entry timing.** The entry is timed off the last genuine call inside the
  section — at Ashford, a sub-3-minute ECS drift through the platform is not
  a call; other sections anchor on their platform whenever run through.
  In *first-departure sections* (Grove Park, Slade Green) the entry is timed
  off the first movement of the stint instead.
* **The Metro first-move rule.** The Metro book — weekday and weekend alike —
  is timed off the first time the unit moves, in every section. A unit that
  runs empty out of the sidings at 05+52 for the 06 00 off the platform is
  listed at 05+52 with the empty move's headcode; a platform starter's first
  move *is* its platform departure, so those keep the platform time. The
  destination stays with the working leg out of the section, so that entry
  still reads `05+52 CST` rather than pointing at the platform next door.
  Grove Park and Slade Green keep their own long-standing destination
  wording. The Mainline and High Speed books are untouched by this rule.
* **Run-round suppression.** A hop out of the section and straight back
  (≤ 60 min) with nothing worked in between is a run-round, not a departure —
  the movement is listed on the following departure and noted for review.
* **AM / PM (D / E) columns.** Where the unit's next berth is, and where it
  is still sitting in the evening (a berth still occupied at 20:00 is the PM
  end point, even if the diagram technically ends elsewhere).
* **SPLITS / SPLITS PM.** The flag follows where the units of a departure
  part company, read off their whole day rather than off this stint: two
  diagrams worked as one train carry identical rows until they divide, so the
  first row that differs is the parting. `SPLITS PM` is for a morning
  departure whose units only part after 20:00; everything else that parts is
  `SPLITS`, an afternoon departure included — by then the parting is not
  "PM", it is now. `GT107`/`GT108` prove why the stint is the wrong window:
  they leave Ashford as one train at 06 40, berth together, go out together
  again, and part at Maidstone East at 18 12, and the book flags the 06 40.
* **ECS suppression.** An ECS departure ending at a berth in its own section
  with no passenger work after it is left off (except in sections where
  ECS-only entries belong, such as West Marina, Grove Park and Slade Green) —
  each suppression is named on the review list.
* **End markers and attachments** — as described in
  [How to read a sheet](#how-to-read-a-sheet).
* **Position changes during the day.** The Genius Summary carries one row per
  working, and a unit's `Position` moves with the formation — it can be first
  out of the sidings and second by the time it leaves the platform. On 12/08,
  64 of 303 diagrams change Position during the day (SG813 is Position 1 on
  the 05:48 off the Grove Park down CHS and Position 2 on the 15:12 off the up
  CHS, swapping with SG814). Each entry takes the Position from the row
  covering its own working. An **Integrale** export has one row per diagram
  and cannot express this, so on Integrale data every entry gets the one value
  the export gives.
* **Coupling order.** Which unit leads comes from the Summary's `Position`
  field, and the direction is **per section** (`posAsc` in the fleet
  profiles). In the mainline book these list the *lowest* Position first —
  Dover Priory, Faversham, Gillingham, Grove Park, Hastings, Ramsgate, Slade
  Green — and the rest list the highest first.

  There is no rule in the reports that predicts this. A unit's Position is
  fixed to its diagram for the whole day while the formation turns end for
  end as it works, so which end carries Position 1 depends on which way it is
  facing — and that lands as a property of the section. The same pair,
  `RM011`/`RM012`, reads lowest-first at Dover Priory and highest-first at
  Ashford and Victoria on the same day. The list is house knowledge, like the
  berth tables, and was taken from the 10/08 books section by section.

  A **road** can face the other way to the rest of its section, and then
  `roadPosAsc` names it and beats the section rule — but only when the whole
  formation came off that one road. Ashford is the case the 12/08 book
  proves: all ten coupled departures off its Down Sidings list the highest
  Position first, and all three off its Up Sidings list the lowest first.

  **Formations the reports cannot place** go in `ORDER_FIX`, keyed by section
  and diagram numbers, and their order is taken verbatim. Grove Park 05+19
  (`SG809`/`SG810`) and 05+48 (`SG813`/`SG814`) are identical in every field
  of both exports — same fleet, same siding, Positions 1 and 2, same route
  note, and both the first move of their diagram — and want opposite orders.
  Nothing in the paperwork says which way round a formation was left
  standing, so where the books disagree with the section, the entry is named
  here.

  The key has three forms, tried in that order: with a time
  (`"ASHFORD 15+43|101,102"`), with a section (`"ASHFORD|101,102"`), and with
  neither (`"046,047,913"`). A key with no section holds that formation
  **wherever it appears** — RM046/RM047/RM913 print 913 first in the Ramsgate
  book at 07 02 and again off Grove Park at 16+13, the same three units the
  same way round hours apart, so one line pins both and any later appearance
  besides. Use it only where the order really is the same everywhere:
  RM043/RM044 read one way at Grove Park and the other at West Marina, and
  would be wrong pinned.

  The timed form is looked up first. Use it only where the same
  formation reads one way earlier in the day and the other way later, since
  the plain key keeps working when the timetable moves a departure by a
  minute or two. `RM101`/`RM102` need it: they leave Ashford 102-first at
  05 05 and 101-first at 15+43.

  **When the timetable changes**, run the mark-up sheet —
  `node tools/order-check.mjs out.csv summary.csv diagrams.csv` — which lists
  every coupled departure in all three books both ways round. Tick A or B
  against the hand-written book; each row carries the exact `ORDER_FIX` line
  to paste for B, with the time included where the formation needs it. This
  is the only way a new working's order can be established, for the reasons
  under *What the reports cannot say* below.

  The Metro entries in that list come from a book this tool produced for
  10/08 and someone then put right by hand — six formations, each moved the
  same way everywhere it appears, which is what an orientation correction
  looks like. A marked-up copy of the tool's own output is the most useful
  thing to feed back.

  Diagram number breaks a tie, and mirrors with the rest of the ordering; it
  carries no meaning of its own. Two units on the **same** Position started
  the day in different formations, so the reports genuinely cannot say which
  way round they go — those entries are named on the review list rather than
  quietly guessed at.

  The **end markers** name the physical ends of the train and are written
  against the first and last row of an entry, so they stay in their rows when
  the unit order changes.

#### What the reports cannot say

The obvious idea — follow the unit round the network and work out which way it
is pointing — has been tried and measured against the real 12/08 books, on the
77 coupled entries where the tool and the books agree on which units are in the
formation. The figures below are each model's *best possible* fit: every group
scored as if the majority answer within it were always taken.

| What decides which end leads | Best possible fit |
|---|---|
| Direction of travel (London-bound or not) | 44/77 |
| Direction from the headcode's number parity | 44/77 |
| Turn-rounds counted through the journey | 46/77 |
| **The section** (what the tool does) | **64/77** |
| Section and direction together | 66/77 |
| **The road it comes off** | **67/77** |

Direction is barely better than a coin toss, and the two points that combining
it wins come from splitting sections into groups of one — fitting the sample,
not finding a rule. Ashford settles it: seventeen of its eighteen coupled
entries have made *no* turn-round at all, so every unit is in the identical
state, and the books still split six one way and eleven the other.

Carrying the answer forward from a formation's first appearance fares no
better. Of the 37 pairs the 12/08 books couple more than once, 19 keep their
order and 18 print both ways round, and predicting which from the reversals
between the two appearances lands on 19 of 40 — a coin toss again. Building a
map out of the reports (every consecutive pair of stops in every itinerary is
a link; 108 locations, 191 links) does not rescue it: a unit running out and
back does not physically turn round, the driver changes ends, so a reversal is
not the thing that flips the order.

What flips it is how the formation was left standing, and which shunt moves it
made on the depot — neither of which the Summary or the Detail records. That
is why the residue is a list of formations rather than a rule, and why the
mark-up sheet exists.

### The workbook writer and the preview

Both panels' books go through the same writer (`SHEETS_XLSX.writeWorkbook`):
a hand-built SpreadsheetML emitter with a `StyleBook` that registers fonts and
borders as they are needed, zipped with fflate. It writes the house grid —
A4 portrait, Arial, the ruled sheets' fixed column widths, a medium box around
each section, medium verticals after the diagram / D / remarks columns, a
thin rule under every entry, the flag column merged across each multi-unit
entry. The weekday layout adds a double rule at the section's biggest time gap
(≥ 2 h); the weekend layout rules the section off where it crosses midday and
20:00, matching how the sheet is read across a shift.

There is likewise one preview renderer, and it draws the *same cell layout*
the writer saves — so on both panels, what you look at is what you get.

### Sectional Appendix checks and notes

Two kinds of knowledge come out of the Kent / Sussex / Wessex Sectional
Appendix, and they are kept apart on purpose.

**Checks** fire on a single row and go on the Review tab with the day's other
findings — *"a 12-car Networker must be three 4-car 465s with no 466 in the
formation"*. Each is decidable from what the reports actually carry: the car
count, the class, the section, the berthing road, the destination code, and
whether the move is passenger or empty. Rules that turn on a platform number,
a signal or a siding road number are **deliberately absent and must not be
added** — the reports do not carry them, so such a rule would guess. Two bars
were dropped for exactly that reason: the Appendix lets Dartford Up No. 1 and
Plumstead No. 1 hold twelve cars, and without a road number the check would
flag lawful use of the one road that is permitted. A silent miss is the right
failure direction.

Every check was counted against the real 12/08 and 10/08 books before it went
in, and all seven are silent on both. One candidate — a length limit over the
Hastings line — was dropped because it fired on the same routine working on
both days; a rule that flags ordinary traffic teaches the reader to skip the
whole list, which costs more than the rule saves.

**Notes** are the standing per-book briefing on the *Watch for* tab: things
worth knowing while checking a book rather than tests. Eight for the mainline
book, nine for Metro, seven for High Speed, each quotable from the Appendix.

The Appendix itself is not in the repository — it is a licensed Network Rail
document. What is here is the extracted facts, with the source line recorded
against each so any note can be taken back to the page it came from.

## Reference data — where the knowledge lives

All of the tool's local knowledge lives in **one module — `src/data.js`
(`SHEETS_DATA`)** — so corrections are one-line edits in one place. A test
(`test/data.test.mjs`) checks the tables against the frozen legacy build and
cross-checks them against each other. What's in there:

| Table | What it holds |
|---|---|
| `BERTH_SHEETS` | Berthing location → [section, code, siding note, TLC] for every known berth, siding, shed and signal-stand. |
| `DEST_TLC` | Destination name → three-letter code for column A. |
| `NON_BERTH_VISIT`, `SIDING_CLASS_RE` | Which locations never count as berths; what a siding looks like by name. |
| `MAIN_ORDER` / `METRO_ORDER` / `HS_ORDER`, `HEADCODE_SECTIONS`, `SIDING_NOTES`, `END_STYLE`, `GP_ROAD`, `DAY_SHEET` | Section order per book, which sections quote headcodes, the siding notes, the end-marker styles, Grove Park road labels, the day-tab names. |
| `CODE2NAME`, `STABLE_CODES`, `MINOR_SPUR`, `NAME_CODE`, `FIX_CODE`, `PROFILES_G`, `END_MARKERS_GENIUS`, `GROUP_EXTRA` | Genius location codes → names, which codes are stabling, the shunt spurs needing a long stay, hand-learned code corrections, the fleet profiles, the end-lead rules, and section members that aren't berths (e.g. West Marina's shunt neck). |
| `DEST_CODE`, `BERTH_CODE`, `NOTE_FROM_BERTH`, `BASE_STABLING`, `TRANSIT`, `MANUAL_LOC`, `STATION_TABLE`, `END_MARKERS_PRINTS`, `MAINLINE`/`METRO`/`HIGHSPEED`, `PROFILES` | The weekend engine's curated code tables, siding notes, stabling set, transit-only places, manual locations, the full station-name → CRS resolver table (with Southeastern roster marks), the prints' end-marker rules, the section membership lists and the fleet profiles. |

The station resolver (`resolveStation`) is a last resort behind the curated
tables: prints abbreviate by dropping letters, so it matches abbreviations
by subsequence/prefix against the station table. Every resolver match is
written to the review list so it can be checked and, if right, promoted into
`DEST_CODE`/`BERTH_CODE`.

## Requirements and privacy

* Any current desktop browser (Edge, Chrome, Firefox). The page detects
  browsers that cannot run it and says so instead of failing silently; with
  scripting disabled a `<noscript>` notice explains what to do.
* Works fully **offline** — the file has no external references at all (even
  the screenshots are embedded data URIs) and makes no network requests.
  Files are read with `FileReader`, workbooks are handed back as `Blob`
  downloads. Nothing is uploaded anywhere.

## Building and testing

```
node build.mjs     # assemble src/ into "Sheets Generator.html"
npm test           # build, then run the golden test suite (no dependencies)
```

There are no npm dependencies at all — the tests run on Node's built-in
runner, and the pre-overhaul monolith frozen at `test/fixtures/legacy.html`
serves as both the oracle and the test-only xlsx reader (its bundled ExcelJS
is used to read workbooks back).

The suite is built around **golden equivalence**: both the frozen legacy
build and the freshly built file are loaded into separate Node `vm`
sandboxes, fed the same synthetic fixtures (a fabricated pair of Genius
report PDFs, generated prints `.docx` files, a reissue), and their outputs
compared deeply —

* `test/genius.test.mjs` — the weekday pipeline, from PDF text extraction to
  finished sections, must match the legacy output structure for structure;
* `test/engine.test.mjs` — the weekend pipeline: layouts, reports, the
  reissue merge, the updated prints document, and the error guard-rails;
* `test/xlsx.test.mjs` — workbooks from the new writer are read back with
  ExcelJS and must match the legacy ExcelJS-written books **cell for cell**:
  values, fonts, alignment, borders, merges, widths, heights, page setup;
* `test/data.test.mjs` — the consolidated tables equal the legacy tables;
* `test/build.test.mjs` — the artifact is lean, self-contained, and free
  of the removed dead code.

`tools/smoke.mjs` additionally drives the real page in the pre-installed
Chromium via Playwright — drops files on both panels through the actual file
inputs and checks the previews render. CI (`.github/workflows/ci.yml`) builds
the file, runs the suite, and uploads the artifact.

Development notes:

* Edit `src/`, run `node build.mjs`, refresh the browser. Never edit the
  built file directly.
* The code is a **faithful port of validated Python pipelines** (`make_sheets.py`
  for the weekend engine; the Genius pipeline applies the same rulebook) —
  many comments cite the hand-built sheets or "the manual" as the authority
  for a rule (e.g. the Ashford 14+41/15+43/16 27 rows, the Maidstone West
  turnround mistake, the 07 55 ATTACHMENT row). When changing a rule, keep
  that provenance in mind: the quirks are the spec.
* Vendored third-party code: **fflate** (MIT) only.

## The 2.0 overhaul

Version 2.0.0 restructured the tool without changing what it produces — the
golden suite pins the outputs to the pre-overhaul build. What changed:

* **~83% smaller.** ExcelJS (~948 KB, three quarters of the old file) and
  pako are gone; the weekday books now go through the same hand-built
  SpreadsheetML writer the weekend books always used, extended to multi-sheet
  workbooks. The deliverable went from ~1.24 MB to ~206 KB.
* **Dead code removed.** The retired ACWN-workbook pipeline (`tracer3` /
  `builder3`, the Friday variant, `docHealth`, the disabled weekday `.xlsx`
  path and its orphaned UI) is deleted — it survives in git history.
* **One source of truth.** All reference tables were consolidated into
  `src/data.js`; the two engines share the stop-collapsing walk and day-shape
  constants (`src/rulebook.js`), one xlsx writer and one preview renderer.
* **A real bug fixed.** The legacy file wired the weekend panel before its
  markup existed; in a fresh browser load that crashed and left the weekend
  drop zone dead. Scripts now sit at the end of `<body>` and the UI waits for
  the DOM.
* **Weekday previews now show the sheet itself** — the same ruled house grid
  that is saved — instead of a simplified table, and each book has its own
  road card and its own review list (mainline items on the mainline book,
  metro items on the metro book, and so on). Files dropped together are processed sequentially (no racing
  builds) and the tabs are keyboard-navigable.
* **A fleet lineup** — stylised class 375 / 465 / 395 sprites in the
  Southeastern manner — marks the books' fleets on screen. Decorative, inline
  SVG, still fully offline.
