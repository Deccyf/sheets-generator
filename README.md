# Sheets Generator — unit berthing sheets from the planning paperwork

A single, self-contained HTML file (`Sheets Generator.html`) that turns fleet
planning paperwork into the daily **unit berthing books** ("SHEETS") for a
Southeastern-style fleet and depot operation, with every diagram number filled
in and the house drafting conventions applied automatically.

* **Weekday books (Mon–Fri)** are built from the *Diagram Summary* and
  *Diagram Detail* reports for the date — from **Genius** as PDFs or as CSV
  exports, or from **Integrale** as its two CSVs. Every source goes through
  the same rulebook, but they do not carry the same facts — see
  [Genius and Integrale are not interchangeable](#genius-and-integrale-are-not-interchangeable).
* **Weekend sheets (Sat & Sun)** are built from the weekend **diagram prints**
  Word document (`.docx` or legacy `.doc`, or the same text saved out or
  pasted in), with automatic merging of reissued prints.

Everything runs inside the one file, in the browser, on the local machine. No
report, print or sheet ever leaves the computer, and the page works without an
internet connection — the only library it needs (fflate, for zip and inflate)
is bundled into the file itself. The deliverable is a few hundred KB (a good
part of it the how-to screenshots in the quick start); the source lives in
`src/` and is assembled by `node build.mjs`, which prints the exact size and
also rebuilds the two generated documents.

> **These are drafting tools.** Every build produces a review list naming
> anything the rules had to decide for themselves. Always read it, and always
> double-check the generated sheets against the ACWNs before anything goes
> out.

---

## Contents

- [Quick start](#quick-start)
- [The books it produces](#the-books-it-produces)
  - [The Metro sheets](#the-metro-sheets)
- [How to read a sheet](#how-to-read-a-sheet)
- [The review list](#the-review-list)
- [Troubleshooting](#troubleshooting)
- [How it works](#how-it-works)
  - [Repository layout](#repository-layout)
  - [Weekday pipeline (Genius PDFs)](#weekday-pipeline-genius-pdfs)
  - [Weekend pipeline (diagram prints)](#weekend-pipeline-diagram-prints)
  - [The house rulebook](#the-house-rulebook)
  - [The weekend follows the weekday rulebook](#the-weekend-follows-the-weekday-rulebook)
  - [Genius and Integrale are not interchangeable](#genius-and-integrale-are-not-interchangeable)
  - [Failing loudly](#failing-loudly)
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
  CSV detail if that is what you have.

  > **Check one setting first.** `File › Session Settings` → tick **"Show
  > diagram sections on the diagram summary report"**.
  >
  > **Without it you get the AM unit positions only. Ticked, you get the PM
  > positions too.** A diagram section *is* a working: unticked, the Summary
  > collapses to one line per diagram carrying only where each unit stood at
  > the start of the day, so every formation made up later is printed in its
  > morning order — the Grove Park PM departures especially, where units are
  > re-formed all afternoon. Measured on 17/08: four of the fourteen checkable
  > formations came out wrong, all four Grove Park PM. The books still build
  > and the review list names the problem, but the order cannot be recovered
  > afterwards — the Detail report carries no Position and no formation
  > column. With the box ticked, against the real 12/08 book: 13 out of 13.
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

Then: drop **both files** on the first panel (*Weekdays · Mon – Fri*),
together or one after the other — the tool recognises which report is which
from its contents and waits until it has a matching pair. You can also click
the panel to browse for them.

**Or paste the data in.** Some machines will not let the reports be saved
anywhere the browser can reach. *"Can't get the files onto this machine? Paste
the data instead"*, under the drop zone, opens two boxes — one for the Diagram
Summary, one for the Diagram Detail — and builds from what is pasted into
them. CSV exports only on this panel: a PDF has no text in it to copy. Open
each CSV in Notepad or in Excel, select all, copy, paste. Copying
out of Excel puts it on the clipboard tab-separated rather than
comma-separated; that is recognised and converted, so either works. Which box
is which is read off the text, not off the box, so a pair pasted the wrong way
round still builds and says so. Everything after that is the drop path
exactly — same pairing checks, same build — so a pasted pair and a dropped
pair cannot produce different books.

**One box at a time is allowed**, and the panels mix. The Diagram Detail is
megabytes where the Summary is a couple of hundred kilobytes, so it is the one
a locked-down machine baulks at pasting: drop it on the zone as a file, paste
the Summary, and the build uses both — or the other way round. A box left
empty is filled from whatever has already arrived, and only a report that is
nowhere at all is refused, by name. A box that holds a report but does not
sniff as one — a copy that began part way through a line, which is easy to do
because a Genius export repeats its title on every line — now says exactly
that instead of "does not read as one of the reports".

**And two routes that never touch the clipboard**, because some machines block
Ctrl+V into a browser outright:

* **Drag the selection** out of Excel or Notepad straight into a box. This
  used to do nothing at all: `["dragover", "drop"].forEach(ev =>
  document.addEventListener(ev, e => e.preventDefault()))` — there to stop a
  stray file navigating the page away from itself — swallowed every drop on
  the page, a text drop into a textarea included. It now bows out for text
  going into a text box, and still preventDefaults a *file* dropped there,
  which would navigate away.
* **Drag the CSV file itself into a box** and it is read in. Saves opening the
  file at all.

Both are checked in `tools/smoke-gcsv.mjs`, the first by asserting the page
does *not* call `preventDefault` on a text drop.

Either way, the books are built immediately: look them over in the on-screen
preview (per-day tables for Mainline, Metro and High Speed, plus the Review,
Unit order and Rules tabs), then save each book, or all of them at once as a
single zip.

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
5. **Start over** clears everything that has been loaded, pasted text
   included.

**Or paste the prints in.** *"Can't get the prints onto this machine? Paste
them instead"*, under the weekend drop zone, opens two boxes: the prints in the
first, and a reissue in the second if there is one. Open the document in Word,
Ctrl+A, Ctrl+C, paste.

A `.docx` cannot be pasted, but its text can — and the text is what the parser
reads anyway. `readDocx` and `readDoc` exist only to get from a file to a list
of paragraphs, so a paste joins the pipeline one step in rather than being a
second, lesser reader. Checked against the real SUN 16/08 prints both ways:
322 diagrams, 111 entries, the same three books, every laid-out cell identical.

The catch is the **tabs**. `Diagram:\tAZ\t601` is the whole structure, so the
text is handed over exactly as pasted and never tidied — the opposite of the
weekday boxes, where an Excel copy *is* converted. Prints whose tabs have been
flattened are refused with a reason rather than half-read. The same goes for a
`.txt`: the weekend panel takes one, recognised by content rather than by its
extension. `readPrints` sniffs the first bytes — a zip is a `.docx`, an OLE
header is a `.doc`, anything else is decoded as text.

**And the prints saved as a `.csv`.** A spreadsheet writes a comma where the
`.docx` has a tab, so `Diagram:,AZ,601` is the same line as `Diagram:\tAZ\t601`
and used to be refused as "not the diagram prints". `printsFromCsv` reads the
cells back and re-joins them with tabs — dropping the trailing empty ones a
spreadsheet pads every row out with — and only accepts the result if it turns
out to *be* the prints, so a Diagram Summary export (also a CSV) keeps being
refused rather than half-read into an empty book. The paste box uses the same
test, so pasted and dropped cannot disagree about what the prints are. The one
CSV reader now lives in `SHEETS_CORE`, since both engines need it. `readPrints` sniffs the first bytes — a zip is a `.docx`, an OLE
header is a `.doc`, anything else is decoded as text and accepted if
`looksLikePrints` finds a tabbed `Diagram:` line. So the prints build whatever
the file is called, `.txt` and `.csv` alike.

**What the weekend panel cannot take is the Genius or Integrale CSV reports.**
The Diagram Summary and Diagram Detail exports feed the *weekday* pipeline,
which has one column per weekday and refuses a Saturday or Sunday date
outright. Dropped there, a weekend-dated pair now names the date and points at
the prints panel rather than stopping at a bare "No weekday dates found in the
reports", which read like a broken export. Weekend books come from the prints
and nothing else.

One thing a paste cannot do is produce the **updated prints document**. That
splices the reissued diagrams into the original `.docx`, and a paste has no
`.docx` to splice into. The books are still built from the merged data, and the
review list says the updated document was not produced and why.

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
| **METRO_SHEETS** | `METRO_SHEETS_<tag>.xlsx` | The metro book (classes 465 / 466 / 707) — **not a berthing sheet**: the depot's own document, one worksheet per location, landscape, fourteen columns. See [The Metro sheets](#the-metro-sheets). |
| **HS_SHEETS** | `HS_SHEETS_<tag>.xlsx` | The High Speed book (class 395) — built whenever the reports contain High Speed diagrams. **Not a berthing sheet** either: the depot's own Class 395 Allocations Sheet. See [The Metro and High Speed sheets](#the-metro-sheets). |
| **Weekend** | `SHEETS_<stamp>.xlsx`, `SHEETS_465_466_707_<stamp>.xlsx`, `SHEETS_395_<stamp>.xlsx` | One workbook per fleet for the weekend day, plus `<prints>_UPDATED.docx` when a reissue was merged. |

`<tag>` comes from the report dates (e.g. `MON-03-08`); the weekend `<stamp>`
comes from the prints' own date (e.g. `SAT_02_AUG`). Weekday workbooks carry
one worksheet per day (`MON`, `TUE`, …); each weekend workbook is a single
day's sheet.

### The Metro sheets

The Metro book is a different document from the berthing books, and the tool
builds it in the depot's own format, taken from their May 2026 workbook:

* **One worksheet per location**, not one per day, landscape A4, running down
  as many pages as the day needs (`fitToHeight="0"`). Grove Park and Slade
  Green get an AM and a PM sheet, split at `PM_BREAK`, the way the real
  workbook splits them.
* A title row — `SERVICES STARTING <WHERE> MONDAY TO FRIDAY` — with the date
  against it, then the header row, then one row per unit.
* **Fourteen columns**: `TRAIN I.D.`, `SIDINGS`, `STATION`/`SIGNAL`,
  `DESTINATION`, `POS`, `DIAG`, `FORMATION`, `ROAD`/`PLATFORM`, `COMMENTS`,
  `S`, `R/T`, `L/S`, `ENDS`, `MILES`. A terminus has PLATFORMs where a depot
  has ROADs; Grove Park and Slade Green call the timing point a SIGNAL.
* The reports fill eight of them. **Six are ruled and left empty** for the
  depot to write in — `STATION`/`SIGNAL`, `ROAD`, `COMMENTS`, `S`, `R/T`,
  `L/S` — which is how they are kept in the real workbook too (COMMENTS is
  filled on 13% of its rows, ROAD on 19%, R/T and L/S on 6%).
* **It reads by Position, lowest first** — not the berthing books' order,
  which lists the units the way they stand on the ground. Every formation in
  the real workbook numbers its POS column 1, 2, 3 straight down.
* `MILES` comes off the Detail export's own column, which carries the figure
  **already running** (0.10, 6.72, 10.31 down the diagram, with the leg's own
  mileage in the next column) — so the total is the last of them, not the sum.
  Summing them gave one Metro diagram 5,445 miles for a day's work. The PDF
  report has no such column and the cell stays blank.
* **Column widths are sized to what is in them**, never narrower than the real
  workbook's. Measured on a canvas against Excel's own width unit: in capitals
  the body's bold Arial 11 runs about 1.40 to the character, so `CANNON STREET`
  wants 18.2 where the workbook's DESTINATION column is 17.9 — that last third
  of a character is why it clipped. `TUNBRIDGE WELLS` wants 20.5. The real
  workbook wraps the long ones over two rows instead; the tool widens.
* The preview table carries an explicit width, because `table-layout: fixed`
  only takes effect on a table that has one — without it the browser laid the
  table out automatically and the sign-off line stretched TRAIN I.D. from
  eleven characters to the 32-character cap. The title and the sign-off block
  are kept out of the width fit for the same reason, and merged across their
  neighbours instead: Excel lets text out of an empty cell, a table does not.
* Every sheet ends with the block the real ones carry: a blank row, then
  `DATED dd.mm.yy` with `NAME` and `SIGNATURE` beside it, then
  *PLEASE E-MAIL SHEETS TO…*.
* The book's own tabs follow it: **one Sheet tab with a location picker** —
  fourteen locations on a tab strip wrapped into three rows and took the card
  over — and the card steps outside the page's own column, because fourteen
  columns will not sit in 700px. There is **no Unit order tab** (that turns a formation round on the
  sheet, and this one reads by Position — a button that changes nothing you
  can see is worse than no button), and the Rules tab describes *this* sheet
  rather than a berthing one, with the sections that are about a berthing
  sheet — which unit prints first, the corrections, end markers, routes, the
  notes column — left off. The weekday **Metro headcode tick box is gone**:
  every line of this sheet carries its headcode already.
* `ENDS` is the berth the diagram finishes on plus which half of the day it
  finishes in — `GP PM`, `SG AM`. The codes are the berthing books' own; the
  real workbook's vocabulary differs in places (it writes `GP` where the tool
  distinguishes `GPD` from `GPU`, and `PLUS` for `PLU`) and no mapping is
  claimed, because a May sheet against August reports cannot tell a different
  vocabulary from a diagram that now ends somewhere else.

### The High Speed sheet

The same again for the 395s, taken from the operator's own Class 395
Allocations Sheet for 18/08/2026:

* **One worksheet per day**, named the way their workbook names them —
  `Tue 18 08` — landscape.
* A **block per depot** down it (Ashford, Margate, Ramsgate), each two tables
  side by side: `<DEPOT> PM ARRIVALS <yesterday>` on the left, and
  `<DEPOT> UNIT ALLOCATIONS <today>` on the right.
* The arrivals table is filled from **the day before's own entries**, so it
  works whenever the reports cover more than one day — a Monday-to-Friday pair
  fills every day but the Monday, and a single day's reports say
  *"no previous day loaded"* in the heading rather than showing a quiet blank.
* `N/M M/O`, `FP/RP`, `CET DUE`, `ARRIVES`, the next working and the notes are
  ruled and left empty; the rest comes off the reports.
* **Timed off the first move**, because their sheet is: `AZ601` is `04+19` on
  it where the platform departure is `05+03`. That is `firstDepAll` on the
  weekday High Speed profile — and *only* the weekday one. The weekend High
  Speed book is still a berthing book and nobody has held one against a copy
  timed that way, so it keeps the platform departure.
* **Their berth vocabulary, not the berthing books'** — `ASH` for `AFK`, `RAM`
  for `RE`, `FAV` for `FKE`. `ASH` appears 2019 times in the real sheet's ENDS
  columns against `AFK`'s 6.

Against their 18/08 sheet, every departure time matches to the minute once the
timing moved (`04+19`, `04+33`, `04+53`, `05+08`, `05+24`, `05+38`, `05+56`,
`05+58`, `09+54`, `10+05`, `15+35`, `15+38`, `16+26`), and the `MG` column
agrees on `AZ601` (951), `AZ602` (828), `AZ603` (1012), `AZ607` (799) and
`AZ610` (906).

**They are set up to print.** Every sheet comes out A4 portrait with the house
margins, scaled so the eight columns land on **one page across** and so the
longest single section fits the page **down**, with a manual page break before
each section that would otherwise be cut in half. Without the scale Excel put
a break down the middle of the columns and every page printed twice, the notes
column stranded on a sheet of its own. Against the operator's own hand-set TUE
18/08 — A4 portrait at 88% with six manual breaks at rows 47, 76, 104, 149,
188 and 234 — the tool builds the same day at 87% and breaks at 47, 86, 104,
149, 188 and 234: seven pages either way, five of the six breaks in the same
place, and the sections land on the same row numbers (only Gillingham sits on
page 2 rather than page 3). A section too long for a page at 74% is left to
Excel, rather than shrinking the whole book past reading.

**One blank row between sections**, which is how the hand-built books space
them — Ashford to row 46, 47 blank, Dover Priory heading row 48. The frozen
build left two, which cost a row a section on paper and put the tool's sheet
15 rows longer than the same day's real book. The golden test compares rows by
position among the used ones for that reason; the spacing itself is pinned by
its own test.

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
| G | Flag — `SPLITS` when the units of this departure part company during the day, `SPLITS PM` when they are put away first and only part on the second half of the diagram (the D/E columns settle who goes where). Merged vertically across the entry's rows. |
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
* **`ATTACHMENT`** when another unit joins this train and the two run on
  under one headcode (a unit re-entering its berth just to attach is not
  listed as its own row — the note covers it). The join is the *headcode*,
  not the berth: the two need not leave together, so the comparison runs from
  the berth to the last call in this section — which is what lets a unit run
  empty off the siding into the platform and become part of `2FXX` there. It
  stops at the section boundary, because a unit that attaches further down
  the line belongs to that place's sheet (Tonbridge `06+07` joins at
  Tunbridge Wells). Same place and same minute alone is not enough: two
  unrelated trains leave a junction in the same minute all morning.
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
* a suppressed empty move to a berth, named diagram by diagram. Only moves
  that stay inside the section's own area are dropped — one that takes a unit
  to a berth in another section (a run from Ramsgate depot to the Ashford
  sidings, say) prints, because the section it leaves has to show it going;
* a formation whose unit order is pinned somewhere but not here, naming where
  the order *is* recorded. A pin that silently stops matching — the working
  moved a minute, or changed headcode — is the worst failure `ORDER_FIX` has,
  because the sheet reverts to ordering off the reports with nothing to show
  for it. Only formations pinned somewhere can raise this, which keeps it to a
  handful a day; warning on every unpinned order would fire on 144 of 168
  multi-unit rows and teach the reader to skip the list;
* a Folkestone East `EX … ARR` note, which is inferred and must be checked;
* an end-marker decision that had no rule to lean on;
* diagrams that stand all day and are therefore not berthed, counted by the
  road they stand in and named diagram by diagram. There is nothing to print
  for a unit that never moves, but the depot still has it in that road — on
  SUN 16/08 that is 157 diagrams across the three books, and the Faversham
  back road one had been written on by hand;
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
| *"This Diagram Summary carries the AM unit positions only"* | The Summary was exported with `File › Session Settings` → **"Show diagram sections on the diagram summary report"** unticked, so it carries only the start-of-day unit Position. The books build, but afternoon formations are in their morning order and it cannot be recovered — the Detail report has no Position column. Re-export with the box ticked. |
| *"It is missing the … column"* | An Integrale export run without a column the reader needs — the message names them. They are all column-picker options; add them and export again. |
| A location comes up under its own heading | A unit berthed somewhere the section list doesn't know. It gets its own section in alphabetical order and a review note — check it, and if it should live under an existing section, add it to the tables (see [Reference data](#reference-data--where-the-knowledge-lives)). |
| A train is missing | Check the review list first: empty moves to a berth are left off deliberately and each one is named there. If it isn't listed, trace the diagram number. |
| *"That file is damaged or isn't a Word document"* | Open the prints in Word and re-save as `.docx`, then drop the new file. |
| A road says *nothing to berth* | No diagrams for that fleet are in the reports or prints — nothing to build, nothing wrong. In Genius, check a Control Cycle exists for that fleet. |
| *"That looks like a reissue on its own"* | A reissue was dropped without the full weekly prints — drop the full prints with it (or first). |
| Reissue rejected for its date | The reissue is dated differently from the base prints — it belongs to a different day. |
| A day's books are missing after a drop | Two dates that fall on the same weekday cannot both be built — a book has one column per weekday. The review list names the one that was left out. Build one week at a time. |
| The build failed and the roads are empty | That is deliberate: books from an earlier drop are cleared rather than left one click from a zip named for the day that just failed. Drop a matching pair. |
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
| `HOW TO USE.docx` | The same guide as a Word document, for circulating. **`node build.mjs` rebuilds it** along with the rules page — it sat a day behind the tool for exactly as long as it took nobody to run it by hand. Needs `npm i docx`; without that the build says it skipped it and carries on. Edit the Markdown and `tools/make-guide-docx.mjs` together, never the `.docx`. That script's header has the recipe for rendering it to check — it needs `libreoffice-writer`, not just `libreoffice-core`. |
| `BERTHING SHEET RULES.html` | The rules the tool goes by, written for colleagues who will never open it. Rebuilt by `node build.mjs` via `tools/make-rules-doc.mjs`, from the built file's own tables — **nothing on it is typed out separately**, so it cannot drift from what the books do. One self-contained page; open it or print it to PDF. |
| `src/page.html` | The page shell: markup for both panels, the quick start, the ES5 capability probe, and the `{{CSS}}`/`{{SCRIPTS}}` placeholders. Scripts sit at the *end* of `<body>` (see [the 2.0 overhaul](#the-20-overhaul)). |
| `src/styles.css` | All page styling, including the fleet-sprite styles. |
| `src/data.js` | **`SHEETS_DATA`** — every reference table for every engine in one module: berths, destination codes, section orders, fleet profiles, the station table, end-marker rules. Corrections belong here. |
| `src/core.js` | **`SHEETS_CORE`** — shared helpers: name normalisation, destination codes, time formatting, and the berth AM/PM rule (`amPm`). |
| `src/rulebook.js` | **`SHEETS_RULEBOOK`** — the day-shape constants (`DAY_ROLL`, `PM_BREAK`, `RUN_ROUND`) and the stop-collapsing walk both engines share. |
| `src/rules.js` | **`SHEETS_RULES`** — the pure part of local unit-order corrections (key grammar, merge, storage round-trip) *and* `explain()`/`explainHtml()`, which turn a build's rules into plain English. `explainHtml(env, pick)` takes `{only:[ids]}` or `{skip:[ids]}`, which is how the tool splits the same call across two tabs — **Unit order** carries the corrections next to the Reverse buttons that write them, **Rules** carries everything else as read-only reference, and `BERTHING SHEET RULES.html` takes the lot. No DOM, no tables of its own: it takes a plain object describing the build. |
| `src/xlsx.js` | **`SHEETS_XLSX`** — the one xlsx writer (hand-built SpreadsheetML, multi-sheet, zipped with fflate) plus the weekday book layout and the one preview renderer used by both panels. Widths and page setup come from the layout, so one workbook can be portrait eight-column and another landscape fourteen. |
| `src/hs.js` | **`SHEETS_HS`** — the High Speed book as the depot's Class 395 Allocations Sheet: a worksheet per day, a block per depot, last night's arrivals beside today's allocations. |
| `src/metro.js` | **`SHEETS_METRO`** — the Metro book in the depot's own format: a worksheet per location, landscape, fourteen columns, read by Position. Not a berthing sheet — see [The Metro sheets](#the-metro-sheets). |
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
   marker, formation). The `#` event marker flags a berthing. `STABLD` marks
   the road a diagram *starts* in, which is not the same as all it does — the
   prints list the morning's work under that marker — so scope is decided on
   whether the diagram ever moves, and the ones that never do are named on the
   review list rather than dropped in silence.
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
  A unit that draws forward into a **headshunt** and stands there has not
  left: the time is when it goes from the headshunt, which is what the book
  writes (`GROVE PARK 5S07` — out of the Up C.H.S at 05 14, away from the Up
  Headshunt at **05 25**). Mainline books only; on the metro profile the
  first-move rule already owns the question.
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
  end point, even if the diagram technically ends elsewhere). A diagram that
  goes out a third time has two PM berths, and the column means a different
  one on each row: every row before the last journey carries the berth the
  unit sits on, and the row for that journey carries where it finishes.
* **SPLITS / SPLITS PM.** The flag follows where the units of a departure
  part company, read off their whole day rather than off this stint: two
  diagrams worked as one train carry identical rows until they divide, so the
  first row that differs is the parting. `GT107`/`GT108` prove why the stint
  is the wrong window: they leave Ashford as one train at 06 40, berth
  together, go out together again, and part at Maidstone East at 18 12, and
  the book flags the 06 40.
  **"PM" is a place in the diagram, not a time of day** — the units go into a
  depot after the berth they leave here, and the parting comes after that, on
  the second half of the diagram. A formation that parts before it is put
  away parts on this working and says plain `SPLITS`, however late in the day
  that is. Read from a clock instead (parting after 20:00, departure before
  14:00) the tool disagreed with the real books on ten flags; read from the
  berth it disagrees on seven.
* **ECS suppression.** An ECS departure ending at a berth in its own section
  with no passenger work after it is left off (except in sections where
  ECS-only entries belong, such as West Marina, Grove Park and Slade Green) —
  each suppression is named on the review list.
* **A long stand in a platform.** A unit standing in a platform for
  `RUN_ROUND` minutes or more has arguably berthed there — `GT120`/`GT121`
  arrive at London Victoria at 22 40 on 17/08 and leave at 23 40 for
  Meopham, and the book carries that line. A platform is not a siding, so
  `boundaries()` splits there only when the report **shunts the unit on the
  spot** (`#` in the activity column, which that Victoria row has), or when
  the operator ticks *Count long platform stands*. Everything else long
  enough is named on the review list either way, so the decision is never
  silent. Restricted to locations the books actually print a page for —
  without that filter the list fills with St Pancras, Swanley and Margate,
  where nothing berths as far as these sheets are concerned: **six a day
  across the reports seen, against thirty-seven.** Across GEN-WED/FRI +
  INT-MON the option off changes nothing (703 entries); on 17/08 it takes
  the mainline book from 132 entries to 138.
* **The going-home pause.** A last-of-the-day ECS run to a depot is left off
  even when the depot is in another section, if the unit was never actually
  shunted where it stood. Genius marks a shunt on the spot with `#` in the
  activity column, and `stopsOf` now carries that through as `act`. `SG810`
  on 17/08 is the case: in service to Dartford, empty into the Down Siding at
  22:53, empty on to Slade Green at 23:30, no `#` anywhere at Dartford — a
  wait on the way home, not a Dartford berthing, and it was the only thing
  putting a `DARTFORD` section in the mainline book. The rule is gated on the
  report carrying the column at all (`anyShunt`), so a PDF or an Integrale
  export that never had it is unaffected; across GEN-MON/WED/FRI × three
  books it removes that one entry and nothing else.
* **The Victoria headcode.** Victoria's note carries the ECS headcode off
  the sidings, because that is what the shunter and the platform staff watch
  for — **unless one empty in forms two services out of the platform**, in
  which case that headcode names both rows and identifies neither, so each
  row shows its own departure instead (`05 42` prints `2K06`, not the `5K06`
  it shares with `06 05`'s feed). 11 of the 13 Victoria notes on 12/08 now
  match the book; the two that do not (`05+50` wants `3N90` over feed
  `5N89`, `17+19` wants `5Y97` over `5Y96`) are both empty departures whose
  feed and working are consecutively numbered, and no rule is claimed for
  them yet. This is the mainline book. On the metro book, timed off the first move, that first
  headcode *is* the empty feed out of Grosvenor, so the note takes the
  working leg's headcode instead (`hcWork`): the operator crossed out all six
  of the other kind by hand (`5U04`→`2U04`, `5K92`→`3K92`, `5M83`→`3M84`,
  `5K28`→`2K28`, `5Y82`→`5Y83`, `5K40`→`2K40`).
* **The PM berth on a late transfer.** A unit whose last stint starts on one
  berth and ends elsewhere keeps the berth as its PM cell — wherever it is
  taken afterwards, and whether that last run is in service or empty. Only
  the row for the last journey itself reads where the journey ends.
  `GT301` (Grove Park, then Ramsgate from 20 34, then out again in service to
  Gillingham) and `GT103`/`GT104` (Grove Park, then Ashford east sidings from
  20 03, then empty to the Folkestone train roads) are the same shape and the
  operator reads them the same way: `RE`/`AFE` on the rows before, `GI`/`FKE`
  on the run. Earlier builds gated this on the berthing area, then on whether
  a passenger working followed; both gates are gone. Five cells in the real
  12/08 book disagree, and the operator has confirmed the book is wrong in
  them.
* **The allocated unit is read off the working, not off row one.** The
  Position already was — `posAt` picks the summary row covering the entry's
  time — but the unit came from `srs[0]` flat. A diagram whose morning is
  cancelled keeps that row with the allocation cell empty and names the unit
  on the workings that survived, so the Unit column came out blank for a
  diagram that has one allocated all afternoon (reported on `SG811`/`SG812`).
  `unitAt` mirrors `posAt`, falling back to any row that names a unit. Inert on
  every export held: 1431 printed rows, 0 changes to the Unit column.

  **This was the whole of the reported fault** — the rows were all there and
  only the Unit column was blank, confirmed by the operator. Which book a
  diagram belongs to also comes from the first row naming a known fleet now,
  found while looking for the above rather than reported: a blank fleet cell
  on row one would drop the whole diagram, its afternoon with it, without a
  word. No export held has one, so nothing has ever been seen to hit it.
* **The AM cell of an overnight berth.** A unit that leaves its overnight
  berth and is back on it before 14:00 gets that berth in its AM cell; the
  blanking rule is for units that only return at night.
* **Grove Park's two tables** are a *mainline* convention, passed in as
  `gpSplit`. The old guard compared the section-order array by identity, and
  `bookOrder` returns a fresh array every call, so it was always true and the
  metro book was splitting Grove Park too — a tester struck the second header
  out of the 10/08 metro book by hand.
* **`SPLITS` is read from each unit's own departure.** `partsAt` used to
  compare whole days from row 0, so units that reached the berth off
  different roads "parted" before the entry even began and no flag printed
  (`GROVE PARK 16+50`: 910 in at 08 55 off Ramsgate, 059 at 14 16 off St
  Leonards, one train to Ashford, divide at 19 04). Each itinerary is now
  sliced at its own `exitIdx`, and the arrival minute leaves the comparison
  key for the same reason.
* **The order key names the units that print.** The attaching-unit filter now
  runs *before* the `ORDER_FIX` lookup, so the key, the Rules-tab record and
  the shared-Position warning are all built from `e.blocks` — the printed
  formation — not from the pre-filter list. Before this, the Rules tab
  offered a Reverse button for `ASHFORD 07 55 — 116, 117` on a row that
  prints one unit, and a correction written there could never show up.
* **The double lines.** The *first* break of at least `BREAK_GAP` (three hours)
  is ruled off, and so is any later one where the work picks up after
  `PM_BREAK` (20:00) — so a page carries two where the day has two — the
  12/08 book rules Slade Green under 06+36 *and* under 18+04, which no
  single-line rule can draw. A lull in the middle of the afternoon draws
  nothing. Every double line in the operator's own TUE 18/08 book is one or
  the other (Ashford 08 28 and 16 00, Dover 07 45, Slade Green 06+31,
  Tonbridge 06 16, Victoria 06 55 and 17 40, West Marina 07+24 — 8 of 8, and
  the tool now draws exactly those), and the single break of three hours or
  more they leave unruled is Tonbridge's 11+32 → 14+40 (188 minutes), neither
  the first of the day nor the way into the night. Three earlier readings were each
  measured against the real books' border styles and each failed: the biggest
  gap (a long evening lull outbids the real break — Ashford 16 00 → 22+53),
  the gap containing midday (a section working through the middle of the day
  breaks earlier), and the biggest gap starting before midday (6 of 7, and
  structurally unable to draw Slade Green's second). At three hours every
  rule all three real books draw is still drawn — mainline 6/6, Ramsgate 1/1,
  metro 5/5 once its two are matched through the first-move timing (the
  tool's `07+24` is the book's `07 33`) — with 7 extra lines across the three
  books, against 9 at two hours and 13 at 90 minutes. **The shortest break
  the books themselves rule is Slade Green's 18+04, at 271 minutes**, so the
  threshold has that much headroom before it starts losing real rules. Grove
  Park is never ruled: neither real book rules it.
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

### The weekend follows the weekday rulebook

The two pipelines used to keep separate copies of the same conventions, and
the copies had drifted. They are one rulebook now — the weekend books are
built by the weekend engine, but to the weekday rules.

| | Was | Now |
|---|---|---|
| **Fleet profiles** | A second hand-written `PROFILES` table. It had lost `465/0` from the metro fleet list, gained `SLADE GREEN` in the metro headcode sections, and left the High Speed book with none at all. | `PROFILES` is *derived from* `PROFILES_G`. There is one table, so it cannot drift again. |
| **Unit order** | Always lowest Position first, everywhere. | Unchanged — see below. This one was carried over and then taken back out. |
| **Double lines** | Wherever the section crossed midday and 20:00 — which ruled a page that was busy right through the middle of the day, and left one that stood idle 08:00–19:00 unruled. | The weekday rule: the first break of `BREAK_GAP` (three hours) or more, plus any later one leading into work after `PM_BREAK`. Grove Park is never ruled. |
| **Headcodes** | Per-profile lists that had drifted. | `HEADCODE_SECTIONS`, the same set the weekday books use. |

**Two weekday rules are deliberately not carried over.**

The **pinned unit order** (`ORDER_FIX`), because those pins name weekday
diagram numbers and the weekend prints number their diagrams separately, so a
pin could only ever match by accident.

And the **reading order** — which end of a formation a section is written
from. Carrying it over looked obviously right: the weekday books read each
section against the direction of travel (`pos_asc`, with `road_pos_asc` for a
road that faces the other way), and which end that is ought to be a fact about
the place rather than the day. It is not. Checked against the verified Sunday
16/08 book it reordered **53 of the 71 multi-unit entries** — every one at
Ashford, Slade Green, Victoria, Dartford, West Marina, Tonbridge, Orpington and
Sidcup — and the book is right. Those directions were scored against
hand-marked *weekday* books and belong to them. Weekend order is lowest
Position first, everywhere.

Two things that made it look right, kept in `test/data.test.mjs` so the next
attempt starts from what is already known:

- The road override could never have fired anyway. `road_pos_asc` names one
  road in the whole table (Ashford up sidings), so every weekend section fell
  through to the section default.
- Bridging the print road names to the weekday ones through the siding notes
  crosses two different places. A note is a short label, not a name: `UPS` is
  Dartford's up siding *and* Slade Green's up C.H.S., so the bridge hands
  Dartford's formations Slade Green's order.

This moves weekend output, and the frozen legacy build cannot be the judge of
it any more. `test/engine.test.mjs` still compares against that build for
everything else, masking exactly the two fields above, and pins each on its
own — including the Slade Green headcode the old weekend book printed and no
weekday book ever has. The diagram column is compared in full: reading order
was the third masked field, and taking it back out restored that check. The weekday books are byte-identical
through all of it: 703 entries, 0 changed, the same real-book scores.

**What is and is not verified.** There is still no *hand-marked* weekend
sheet — nothing with a tester's corrections on it, the way every weekday rule
is scored. What there is, since 16/08, is a pair of tool-built weekend books
the tester has read and confirmed (`SHEETS_SAT_15_AUG`, `SHEETS_SUN_16_AUG`),
and the Sunday diagram prints they were built from. Sunday can therefore be
rebuilt from source and compared entry by entry, which is how the reading-order
carry-over above was caught and reversed. That check is only as good as its one
day and its one book, and it says nothing about the metro or High Speed
weekend books, which have never been confirmed by anyone.

`SPLITS` / `SPLITS PM` is left as it was — the weekend derives it from the D/E pair
rather than from a parting time, which already means "they part after this
berth", so it agrees with the weekday rule in shape if not in mechanism.

### Genius and Integrale are not interchangeable

Both build books through the same rulebook, and the test suite pins them to
identical output on the synthetic fixture. On real exports they differ, in
ways worth knowing before choosing a source:

| | Genius | Integrale |
|---|---|---|
| **Unit numbers** | The `UNITS` column has been empty in every export seen, so column F is left ruled and blank for the depot. | `Start Stock` carries the allocated unit. On 10/08 that filled **216 of 244** entries. |
| **Position** | One summary row per *working*, so a unit's position is read at the time of each departure. | One row per *diagram*, one position for the whole day — so an afternoon formation prints in its morning order. Measured against the real 12/08 book: the Genius order agrees **13/13**, the Integrale order **0/13**. |
| **The activity column** | Carries `#` (a shunt on the spot) as well as `ATTACH`/`DETACH` — 146 `#` rows on 12/08. | Carries `ATTACH`, `DETACH`, `ATTTT`, `DETTT`, `STABLD` and **no `#` at all**. |

The last one has a live consequence: the [going-home pause](#the-house-rulebook)
rule needs a `#` to tell "put away here" from "waiting on the way home". Its
`anyShunt` gate means it simply never fires on an Integrale build rather than
misfiring — so an Integrale day keeps a line a Genius day for the same date
would drop. Neither is wrong given what its export says; they are not the
same book.

**If both are available, Genius is the better source for order and Integrale
for unit numbers.** Nothing in the tool merges them, and nothing measures the
gap on a date where both exist — no such pair has been available.

### Failing loudly

Six ways the tool used to be quietly wrong. Each was reproduced against a real
export before it was fixed, and every one of them now says something rather
than producing a book that looks finished.

| What used to happen | Now |
|---|---|
| A Genius **summary covering two dates** deduplicated on `(diagram, start)` with no date, so day two collapsed into day one: `{WED 141, FRI 17}` — 139 rows and 14 review notes gone, silently. | The date is in the key: `{WED 141, FRI 139}`. |
| **Excel re-saves a CSV** and drops the leading zero: `8:34:00`. `mins()` read that as **04 34**. On an Integrale detail re-saved this way, 136 of 244 entries carried the wrong time with no warning. A blank cell gave `NaN`, which killed the past-midnight rolling for the rest of the diagram and printed a `NaN+NaN` row. | A tolerant `tmin()` in all three parsers: `8:34:00` reads correctly, an unreadable cell is dropped and counted — *"1 leg(s) left out — the Start or End Time cell was blank or unreadable"*. |
| A **diagram in one report but not the other** vanished. Drop `GT105`'s detail and three 8-cars print as 4-cars with nothing said. | Both directions are named: *"in the summary but missing from the detail report — its rows are NOT in this book"*, and the reverse. |
| **Two dates on the same weekday** — a book has one column per weekday, so the second silently overwrote the first *and* left its 20 warnings behind. | The first is kept and the second is named: *"19/08/26 is NOT in these books — it falls on the same WED column as 12/08/26"*. |
| A **control character in one cell** made the *whole workbook* unreadable — `disallowed character`, not one bad cell. Reachable through the station resolver's three-character fallback. | `esc()` strips them first; tab, newline and return are legal and are left alone. |
| A **reissue merge replaced nothing**. `docParaSpans2` required a space after `w:p`, so every attribute-less `<w:p>` in a plain Word document was invisible: the *"updated prints"* handed back were the superseded document, byte for byte. | The pattern accepts both forms. This is the one place the frozen legacy build is *wrong* rather than merely older, so `test/engine.test.mjs` asserts the merge itself and pins the legacy build's mistake explicitly. |

### The workbook writer and the preview

Both panels' books go through the same writer (`SHEETS_XLSX.writeWorkbook`):
a hand-built SpreadsheetML emitter with a `StyleBook` that registers fonts and
borders as they are needed, zipped with fflate. It writes the house grid —
A4 portrait, Arial, the ruled sheets' fixed column widths, a medium box around
each section, medium verticals after the diagram / D / remarks columns, a
thin rule under every entry, the flag column merged across each multi-unit
entry. The weekday layout adds a double rule under the last entry of the
morning: the line sits in the gap that contains midday, and only when that gap
is berthing-length (≥ 2 h) — a section worked steadily through midday draws no
line, and Grove Park's two-table layout is never ruled. It was "the biggest
gap" until a tester's Monday sheet showed those two readings coming apart: the
hand books' own borders put every line at the morning break, and a late ECS
row big enough to open a larger evening gap must not pull the line down to it.
The weekend layout rules the section off where it crosses midday and 20:00,
matching how the sheet is read across a shift.

There is likewise one preview renderer, and it draws the *same cell layout*
the writer saves — so on both panels, what you look at is what you get.

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
