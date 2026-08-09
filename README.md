# Sheets Generator — unit berthing sheets from the planning paperwork

A single, self-contained HTML file (`Sheets Generator.html`) that turns fleet
planning paperwork into the daily **unit berthing books** ("SHEETS") for a
Southeastern-style fleet and depot operation, with every diagram number filled
in and the house drafting conventions applied automatically.

* **Weekday books (Mon–Fri)** are built from two **Genius** reports saved as
  PDF — the *Diagram Summary* and the *Diagram Detail* for the same date(s).
* **Weekend sheets (Sat & Sun)** are built from the weekend **diagram prints**
  Word document (`.docx` or legacy `.doc`), with automatic merging of
  reissued prints.

Everything runs inside the one file, in the browser, on the local machine. No
report, print or sheet ever leaves the computer, and the page works without an
internet connection — every library it needs (ExcelJS, pako, fflate) is
bundled into the file itself.

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
  - [File layout](#file-layout)
  - [Weekday pipeline (Genius PDFs)](#weekday-pipeline-genius-pdfs)
  - [Weekend pipeline (diagram prints)](#weekend-pipeline-diagram-prints)
  - [The house rulebook](#the-house-rulebook)
  - [Workbook writers and the preview](#workbook-writers-and-the-preview)
  - [The legacy ACWN core](#the-legacy-acwn-core)
- [Reference data — where the knowledge lives](#reference-data--where-the-knowledge-lives)
- [Requirements and privacy](#requirements-and-privacy)
- [Development notes](#development-notes)

---

## Quick start

Open `Sheets Generator.html` in a modern browser (Edge, Chrome or Firefox —
just double-click the file; no server, install or sign-in is needed). The page
has two drop panels, one per workflow.

### Weekday books — from the Genius reports

1. **In Genius**, make sure a **Control Cycle** exists for the date — the
   Diagram Summary and Diagram Detail reports cannot be run without one. If
   the Metro and High Speed books are wanted too, Control Cycles must exist
   for those fleets as well.
2. Run **Diagrams → Summary Report…** and **Diagrams → Detail Report…** and
   save each as a **PDF** for the same date.
3. Drop **both PDFs** on the first panel (*Weekdays · Mon – Fri*), together or
   one after the other — the tool recognises which report is which from its
   contents and waits until it has the pair. You can also click the panel to
   browse for the files.
4. The books are built immediately: look them over in the on-screen preview
   (per-day tables for Mainline, Metro and High Speed, plus the Review tab),
   then save each book, or all of them at once.

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
   each with a *Look at it* preview and its own review list. A book marked
   *skipped* simply has no diagrams for that fleet in this weekend's prints.
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
hand-built books list them (rear unit first; Folkestone East the other way
round, because the Train Roads point one way). The columns are:

| Col | Content |
|---|---|
| A | Departure time and destination code — `06 45 CHX` for a passenger working, `05+32 VIC` for empty stock (the `+` is the ECS convention). Where a working runs through the station platform, the time is taken off the platform, not the siding. |
| B | Unit type, e.g. `4 375`, `2 466`, `6 395` (cars + class). |
| C | The unit's three-digit diagram number. |
| D | **AM** — where the unit goes next (its next berth) during the day. |
| E | **PM** — where the unit ends its day. |
| G | Flag — `SPLITS` when the units of this departure part company during the day, `SPLITS PM` when they only part in the evening (the D/E columns settle who goes where). Merged vertically across the entry's rows. |
| H | Notes — see below. |

**Notes column (H)** carries the house annotations:

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
| A weekend book says *skipped* | No diagrams for that fleet exist in this weekend's prints — nothing to build, nothing wrong. |
| *"That looks like a reissue on its own"* | A reissue was dropped without the full weekly prints — drop the full prints with it (or first). |
| Reissue rejected for its date | The reissue is dated differently from the base prints — it belongs to a different day. |
| Page says the browser is too old / scripting is off | Open the file in a current Edge, Chrome or Firefox with JavaScript enabled. |

---

## How it works

The whole application is one HTML file: markup and styling, three vendored
libraries, and roughly 4,000 lines of application JavaScript organised as
self-contained modules (each also guards `module.exports`, so the engines can
be exercised under Node).

### File layout

Script blocks in file order (line numbers are as of this writing and will
drift):

| Lines (approx.) | Block |
|---|---|
| 1–348 | CSS and page markup: header, quick-start, the weekday drop panel. |
| 349–361 | ES5 capability probe — shows the "browser too old" notice and hides the drop zone when `Promise`/`FileReader`/`Blob`/`TextDecoder`/`URL` are missing. |
| 362–406 | **ExcelJS** (bundled, 2023-10-19 build) — reads and writes `.xlsx` for the weekday books. |
| 407–2387 | **`SHEETS_CORE`** — the sheet-building rulebook and the legacy ACWN pipeline, a faithful JS port of a validated Python pipeline (`acwn_parser` + `tracer3` + `builder3`). Exports the reference tables (`BERTH_SHEETS`, `DEST_TLC`, …) and helpers used by everything else. |
| 2388–2815 | **`SHEETS_XLSX`** — ExcelJS glue: reads an ACWN workbook into a neutral grid, lays each day's sheet out as row descriptors, writes the weekday workbooks, and renders the same rows as the in-page HTML preview. |
| 2816–2819 | **pako** (inflate only) — decompresses the Flate streams inside the Genius PDFs. |
| 2820–3443 | **`GENIUS`** — the weekday pipeline: PDF text extraction, Summary/Detail parsing, and the application of the house rulebook to the Genius itineraries. |
| 3444–5020 | **`SheetsEngine`** — the weekend pipeline, a JS port of `make_sheets.py`: `.docx`/`.doc` reading, diagram parsing, generation, its own minimal `.xlsx` writer, the reissue merge, and the weekend panel's UI wiring. Bundles **fflate** (zip/unzip) at the top of the block. |
| 5021–5439 | Weekday panel UI wiring: classifies dropped PDFs, drives `GENIUS.build`, writes the books through `SHEETS_XLSX`, renders previews and save buttons. |
| 5440–5534 | Weekend panel markup, the "What comes back" book list, and the footer. |

### Weekday pipeline (Genius PDFs)

1. **Drop handling** (`build(file)` in the last script block). Each dropped
   PDF is text-extracted and classified by content — `DIAGRAM SUMMARY REPORT`
   vs `Diagram Detail Report`. The tool holds whichever arrives first and
   builds as soon as it has one of each.
2. **PDF text extraction** (`GENIUS.pdfText`). No PDF library is used.
   The extractor scans the raw bytes for `stream … endstream` sections,
   inflates them with pako, and interprets just enough of the PDF content
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
   exist. A combined on-screen preview shows every day and fleet plus the
   review list.

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
5. **Writing.** The weekend engine has its **own minimal xlsx writer** (a
   `StyleBook` that registers fonts/borders on demand, hand-built sheet XML,
   zipped with fflate) — the weekend path does not use ExcelJS at all. The
   sheet is laid out once (`layoutBook`) and both the writer and the HTML
   preview render that same layout, so what you look at is what you save.
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
* **Run-round suppression.** A hop out of the section and straight back
  (≤ 60 min) with nothing worked in between is a run-round, not a departure —
  the movement is listed on the following departure and noted for review.
* **AM / PM (D / E) columns.** Where the unit's next berth is, and where it
  is still sitting in the evening (a berth still occupied at 20:00 is the PM
  end point, even if the diagram technically ends elsewhere).
* **SPLITS / SPLITS PM.** Units on one departure that end their stints at
  different places split during the day (`SPLITS`); units whose stints end
  together but whose D/E pairs differ only part in the evening (`SPLITS PM`).
* **ECS suppression.** An ECS departure ending at a berth in its own section
  with no passenger work after it is left off (except in sections where
  ECS-only entries belong, such as West Marina, Grove Park and Slade Green) —
  each suppression is named on the review list.
* **End markers and attachments** — as described in
  [How to read a sheet](#how-to-read-a-sheet).
* **Coupling order.** Units are listed rear-first (by the Summary's position
  field); Folkestone East lists front-first because the Train Roads point one
  way.

### Workbook writers and the preview

The weekday writer (`SHEETS_XLSX.writeBooks`) builds one worksheet per day
(A4 portrait, Arial, fixed column widths taken from the ruled sheets), a
medium box around each section, medium verticals after the diagram, D and
remarks columns, a thin rule under every entry, the flag column merged across
each multi-unit entry, and a double rule at the section's biggest time gap
(≥ 2 h) — the weekend writer instead rules the section off where it crosses
midday and 20:00, matching how the sheet is read across a shift. Both writers
share their layout rows with an HTML preview renderer so the preview is
pixel-for-cell faithful to the saved file.

### The legacy ACWN core

`SHEETS_CORE` contains a complete, older pipeline that builds the same books
directly from an **ACWN workbook** (`.xlsx`, one sheet per location, columns
A–N, including the Friday single-day variant): grid → events
(departures/arrivals with unit slots, day codes like `MTWO`/`THX`,
cross-references) → a `Network` that traces each unit's day across sheets
(matching by train id, origin + time, reference bridges, and a last-resort
orphan matcher) → per-day sections. Its tracer marks anything uncertain with
audit flags (`brokenref`, `loop`, `inferred`, `remote_attach`, `deep`,
`stub`) that surface on the review list.

The UI path that fed this pipeline an ACWN `.xlsx` is currently disabled (the
weekday drop handler returns before it and only accepts the Genius PDFs), but
the module is still live: the Genius pipeline leans on its reference tables
and helpers (`BERTH_SHEETS`, `DEST_TLC`, `norm`, `destTlc`, `amPm`,
`fmtTime`), and `SHEETS_XLSX.workbookToGrid` remains the entry point if the
ACWN flow is ever re-enabled.

## Reference data — where the knowledge lives

All of the tool's local knowledge is in plain JavaScript tables, so
corrections are one-line edits:

| Table | Module | What it holds |
|---|---|---|
| `BERTH_SHEETS` | `SHEETS_CORE` | Berthing location → [section, code, siding note, TLC] for every known berth, siding, shed and signal-stand. |
| `DEST_TLC` | `SHEETS_CORE` | Destination name → three-letter code for column A. |
| `NON_BERTH_VISIT`, `SIDING_CLASS_RE` | `SHEETS_CORE` | Which locations never count as berths; what a siding looks like by name. |
| `MAIN_ORDER` / `METRO_ORDER` / `HS_ORDER`, `HEADCODE_SECTIONS`, `SIDING_NOTES`, `END_STYLE`, `GP_ROAD` | `SHEETS_XLSX` | Section order per book, which sections quote headcodes, the siding notes, the end-marker styles, Grove Park road labels. |
| `CODE2NAME`, `STABLE_CODES`, `MINOR_SPUR`, `NAME_CODE`, `FIX_CODE`, `PROFILES_G`, `END_MARKERS`, `GROUP_EXTRA` | `GENIUS` | Genius location codes → names, which codes are stabling, the shunt spurs needing a long stay, hand-learned code corrections, the fleet profiles, the end-lead rules, and section members that aren't berths (e.g. West Marina's shunt neck). |
| `DEST_CODE`, `BERTH_CODE`, `NOTE_FROM_BERTH`, `BASE_STABLING`, `TRANSIT`, `MANUAL_LOC`, `STATION_TABLE`, `MAINLINE`/`METRO`/`HIGHSPEED`, `PROFILES` | `SheetsEngine` | The weekend engine's curated code tables, siding notes, stabling set, transit-only places, manual locations, the full station-name → CRS resolver table (with Southeastern roster marks), the section membership lists and the fleet profiles. |

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

## Development notes

* **Everything is in `Sheets Generator.html`** — there is no build step.
  Edit the file, refresh the browser.
* The engines are UMD-style modules with `module.exports` guards:
  `SHEETS_CORE`, `SHEETS_XLSX`, `GENIUS` and `SheetsEngine` can be loaded
  under Node for testing (`SHEETS_XLSX` expects `exceljs` and the core as
  requires; `GENIUS.build` accepts raw PDF byte buffers; `SheetsEngine.run`
  takes `{name, bytes}` inputs plus unzip/zip functions such as fflate's).
* The code is a **faithful port of validated Python pipelines**
  (`acwn_parser` + `tracer3` + `builder3` for the core, `make_sheets.py` for
  the weekend engine) — many comments cite the hand-built sheets or "the
  manual" as the authority for a rule (e.g. the Ashford 14+41/15+43/16 27
  rows, the Maidstone West turnround mistake, the 07 55 ATTACHMENT row).
  When changing a rule, keep that provenance in mind: the quirks are the
  spec.
* Vendored third-party code: **ExcelJS** (MIT), **pako** inflate (MIT/zlib)
  and **fflate** (MIT), each embedded as a minified script block.
