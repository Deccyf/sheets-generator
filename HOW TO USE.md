# How to use the Sheets Generator

A plain-English guide to building the unit berthing books, and to the other
tabs that work from the same paperwork. No training needed — if you can find
the reports, the page does the rest.

---

## Contents

- [What this is](#what-this-is)
- [The two-minute version](#the-two-minute-version)
- [Opening the page](#opening-the-page)
- [Getting the paperwork](#getting-the-paperwork)
- [Building the weekday books](#building-the-weekday-books)
- [Building the weekend books](#building-the-weekend-books)
- [Building a week from the base diagrams](#building-a-week-from-the-base-diagrams)
- [What comes back](#what-comes-back)
- [Reading a sheet](#reading-a-sheet)
- [The options](#the-options)
- [Looking a book over](#looking-a-book-over)
- [Saving, and starting again](#saving-and-starting-again)
- [Shortages and variations](#shortages-and-variations)
- [Berth requests](#berth-requests)
- [When something looks wrong](#when-something-looks-wrong)
- [Before the books go out](#before-the-books-go-out)
- [The Diagram Analyser](#the-diagram-analyser)

---

## What this is

`Sheets Generator.html` is one file that turns the planning paperwork into
the **unit berthing books** — the SHEETS — with every diagram number, AM and
PM column, flag and note filled in the way the hand-built books do them. It
has five tabs:

| Tab | What you give it | What you get |
|---|---|---|
| **Weekday · Mon – Fri** | The *Diagram Summary* and *Diagram Detail* for the date — from Genius as PDFs or CSVs, or Integrale's two CSVs | A book for each fleet for that day |
| **Weekend · Sat & Sun** | The weekend *diagram prints* Word document, plus any reissues | A book for each fleet for that day |
| **Base diagrams** | The base diagram prints for a timetable change — FX, FO, SO and SUN | A book for each fleet covering a whole week |
| **Shortages & variations** | The *Operating Report* and the *Diagram Detail* | The controller's list of what is short or the wrong length — not a book |
| **Berth requests** | The *Maintenance Plan* tab and the day's reports | A suggested berth request on each line of the plan — not a book, and experimental |

The last two are for the **Mainline and Metro fleets only**, not the High
Speed (Class 395) fleet.

`Sheets Generator (no berth requests).html` is the same page without the
experimental *Berth requests* tab, for anyone who does not need it.
`Diagram Analyser.html` is a separate tool for maintenance planning — see
the end of this guide.

A **book** is one of the Excel files. A **sheet** is a page inside it — the
Monday page of the Mainline book, say. The page uses those two words the
same way everywhere, and so does this guide.

**Nothing leaves your computer.** The page does all the work in the browser
on your own machine — no internet connection, no login, no upload, nothing
installed. You can use it on a train with no signal.

---

## The two-minute version

1. Double-click **Sheets Generator.html**.
2. Pick the tab at the top: **Weekday · Mon – Fri**, **Weekend · Sat &
   Sun**, or **Base diagrams** for a timetable change.
3. Drop the reports, or the prints, on the drop zone.
4. The books appear straight away with their sheets open on screen. Read
   each book's **Review** tab.
5. Click **Save book** on each, or **Save all books (.zip)** for the lot.

That is the whole job. The rest of this guide is detail for when you want it.

---

## Opening the page

Double-click the file. It opens in your browser like any web page.

* Use **Edge, Chrome or Firefox**. If it opens in something older the page
  says so — *"This browser is too old to build the books. Right-click the
  file, choose Open with, and pick Edge, Chrome or Firefox."* — so do that.
* Keep the file wherever suits you — desktop, network drive, memory stick.
  It works the same from any of them.
* There is nothing to install and nothing to sign into. Sent a newer copy?
  Just use that one; there is no update to run. The version is under the
  title at the top and again at the foot of the page — quote it if you
  report something.

From the top down, the page has:

* The **title**, with the fleets it builds books for drawn along it.
* **How to use this page** — a fold with the quick start, where to find the
  reports in Genius, how to get the CSVs out of Integrale (with
  screenshots), what comes back, and what to do if a build looks wrong.
* The **five tabs**. One shows at a time, and the page remembers which you
  used last.
* At the top of each tab, a few lines saying **what to drop** and **what
  you get**.
* The **drop zone** for that tab, with a *paste instead* link under it for
  machines that will not let you save the files.
* The black **status board**, which says what the page has just done and,
  once books are built, carries **Save all books (.zip)** and **Start over**.
* The **Options** row, once books are built.
* The **book cards** — one per book, each with its sheet open on it.

Drop a file on the wrong tab and it is sent to the right one — weekday
reports to Weekday, a day's prints to Weekend, base diagrams to Base
diagrams. The status board says so: *“WEEKEND PRINTS.docx” is weekend
diagram prints — sent to the Weekend panel.*

---

## Getting the paperwork

### From Genius

> **Check this one setting first**
>
> **File › Session Settings** › tick **"Show diagram sections on the diagram
> summary report"**. It is the one setting that decides what the reports
> contain. Without it the Summary carries only where each unit stood at the
> start of the day, so every formation made up later prints in its morning
> order — Grove Park in the afternoon worst of all — and it cannot be put
> right afterwards. The Review tab says if it happened; it cannot say the
> right answer.

1. Make sure a **Control Cycle** exists for the date — and for the Metro and
   High Speed fleets too, if you want those books. A missing Control Cycle is
   the usual reason a book comes up empty.
2. Run **Diagrams › Summary Report…** and save it as a **PDF** or a **CSV**.
3. Run **Diagrams › Detail Report…** and save that the same way.

Either format is read, and you can mix them — a PDF Summary with a CSV Detail
builds fine. Save both from Genius itself; a scan or a photo of a printout
cannot be read.

For the **High Speed PM arrivals** — last night's arrivals on the 395 sheet —
run the same two reports for the day before as well.

### From Integrale

**The Diagram Summary file**

1. Open the **Stock Diagrams** list and click **[GO→]** without selecting a
   filter.
2. Click **[Export To Excel]**.
3. Save it in a sensible folder under a sensible name, with **File Type** set
   to **.csv**, and click **[Save]**.

**The Diagram Detail file** (Integrale calls it *Diagrams*)

1. Open the **Stock Diagrams** list and click **[GO→]** again, still without
   a filter.
2. Click **Stock Diagram Detail Report** on the toolbar.
3. The dialog opens at the bottom of the screen — click **[…]** under
   **Output Path**.
4. Pick the same folder as the Summary, give it a sensible name, **File Type
   .csv** again, then **[Save]**.
5. Click **[OK]** — you may have to scroll down to see it. It takes a minute
   or so, then tells you it is done.

The same steps, with screenshots, are inside the page: open **How to use
this page** and look for *Getting the two CSVs out of Integrale*.

### Genius or Integrale?

Both build, but they are not equal. Genius gives a unit's position for each
working, so afternoon formations come out the right way round; Integrale
gives one position per diagram, so they print in their morning order. What
Integrale has over Genius is that it names the allocated units. So: **Genius
for the order, Integrale for the unit numbers.**

You cannot mix the two systems in one pair. The page says *"The Summary is
from Genius but the Detail is from Integrale — drop a matching pair: both
from Genius, or both from Integrale."* A Genius PDF with a Genius CSV is
fine.

### The weekend prints

Get the weekend **diagram prints** Word document — `.docx`, or an older
`.doc`. If reissued prints have come out, get those too: any file with
*reissue* or *re-issue* in its name is treated as a reissue.

The page reads the prints by what is inside the file, not what it is called,
so the prints saved out of Word as plain text (`.txt`) or as a `.csv` work
just as well.

For the **High Speed PM arrivals**, get the day before's *Diagram Summary*
and *Diagram Detail* from Genius as CSVs — Friday's for a Saturday,
Saturday's for a Sunday.

### The base diagrams

When the timetable changes, the base diagram prints come as one Word
document per day code — **FX** (Monday to Thursday), **FO** (Friday),
**SO** (Saturday) and **SUN** — or as one document holding them all. Get all
four. They are read the same way as the weekend prints, so `.docx`, `.doc`,
text and CSV saves all work. No Genius reports are needed.

### For the two list tabs

* **Shortages & variations** — the GENIUS *Operating Report* and the
  *Diagram Detail* for the same day, PDF or CSV. The *Diagram Summary* as
  well, if you have it.
* **Berth requests** — tonight's *Allocation Summary* and tomorrow's
  *Diagram Summary* and *Diagram Detail*, PDF or CSV; the *Maintenance Plan*
  tab out of the Mainline Stock Control Document or the Metro Stock Telex;
  and, if you want them, the End of Days, Restrictions and Performance
  Defects out of Equinox or EMS.

---

## Building the weekday books

1. Pick **Weekday · Mon – Fri** and **drop both reports** on the zone —
   together, or one and then the other. You can also click the zone to browse
   for them.
2. The page works out which report is which by reading it, so the order does
   not matter. Drop one and it tells you what it is still waiting for —
   *"Genius Summary loaded ✓ — now drop the Diagram Detail report."* — and
   the drop zone changes to match.
3. As soon as it has the pair, the books are built. The status board says
   *"Books built for MON 03/08 — look them over below, then save."* followed
   by how much there is to review.
4. **Look them over.** Every card shows its sheet, open, exactly as it will
   print. Read the **Review** tab on each.
5. **Save.** **Save book** on each card, or **Save all books (.zip)** on the
   status board.

**The High Speed PM arrivals.** The left-hand side of the 395 sheet is last
night's arrivals, and they come from the day before's reports. Drop the day
before's Summary and Detail as well — four files in all — and the sheet
fills them in. For a Monday, use Sunday's pair. Without them that side is
left empty.

**Several dates at once.** If the reports cover a whole week you get one
sheet per date inside each book, MON to FRI, and each day's PM arrivals come
from the day before it. A date that falls on a weekend is skipped with a
note — *"… falls on a weekend — use the weekend prints panel"*. Two dates on
the same weekday cannot both be built: the second is named on the Review tab
and left out, so build one week at a time.

**A book with nothing in it** says so instead of giving you an empty
workbook: *"No Metro diagrams in these reports — nothing to build. (A Metro
Control Cycle must exist in Genius for its diagrams to appear.)"*

### Pasting the reports instead

Some machines will not let you save the reports anywhere the browser can
reach. Click **Can't get the files onto this machine? Paste the reports
instead**, under the drop zone, and the boxes open.

1. Open the **Diagram Summary** CSV in Notepad or Excel.
2. Select all (**Ctrl+A**), copy (**Ctrl+C**), and paste into the **Diagram
   Summary** box.
3. Same again with the other report, into the **Diagram Detail** box.
4. For the High Speed PM arrivals, paste the day before's pair into the two
   boxes under them — the same as dropping four files. Leave them empty if
   you do not need them.
5. Click **Build the books from the pasted reports**.

From there it is exactly the same as dropping the files — same checks, same
books. Worth knowing:

* **CSVs only.** A PDF has no text to copy, so Genius PDFs have to be dropped
  as files.
* **One at a time is fine.** The Detail is far the bigger file, so drop it on
  the zone and paste the Summary, or the other way round — *"Built with the
  Diagram Detail already loaded."* Only a report that is nowhere at all is
  refused: *"Still needs the Diagram Detail — paste it into the other box, or
  drop the file on the panel above. Either way round works."*
* **A very big paste** — a whole week's Detail — is held ready to build
  rather than shown in the box, so the browser stays quick. The box says
  what it is holding — *"Diagram Detail pasted — 41,210 lines, 5.9 MB —
  held ready to build, not shown here to keep the page light."* Paste again
  to replace it, or type in the box to empty it.
* **Can't paste at all?** Drag the selected rows out of Excel or Notepad
  straight into the box, or drag the CSV file itself into the box — it is
  read in without being opened.
* **Excel is fine.** Cells copied out of Excel come across separated by tabs;
  the page converts them.
* **The boxes are not fussy about which is which.** Paste them the wrong way
  round and it builds anyway: *"Read the boxes the other way round — the
  Summary was in the Detail box."*
* **Copy from the very top.** A copy that starts part way down gets *"The
  Diagram Summary box holds a report, but the copy starts part way through a
  line — select from the very top of the file, first line and all, and copy
  again."*
* **Clear the boxes** empties them.

---

## Building the weekend books

1. Pick **Weekend · Sat & Sun** and **drop the prints** on the zone.
2. **Drop the reissues too**, if there are any — with the prints, or later
   once you have already built. Reissued diagrams replace their originals,
   new ones are added, and everything is rebuilt. The status board says
   *"Books built for SUN 16/08 — 111 entries. Look them over below, then
   save. Reissue applied: 3 diagrams replaced, 1 added."*
3. **For the High Speed PM arrivals**, drop the day before's Diagram Summary
   and Detail CSVs on the second, smaller zone — Friday's for a Saturday,
   Saturday's for a Sunday. Both at once or one at a time, before or after
   the prints. The line under it says what it has; until then it reads
   *"Nothing dropped here yet — without the day before’s Summary and Detail,
   the High Speed PM arrivals stay empty."*
4. **Look each book over** and save it, the same as the weekday books.
5. If a reissue was merged, **Save updated prints (.docx)** appears on the
   status board — the original prints with the reissued diagrams spliced in,
   so there is one clean copy to circulate. It is only produced when **both**
   the prints and the reissue are Word documents. Otherwise the Review tab
   says *"updated prints document not produced"* and why, and the books still
   use the merged prints.
6. **Start over** clears everything and lets you begin again.

A reissue dropped on its own will not build: *"That looks like a reissue on
its own — drop the full weekend prints with it (or first) so there is
something to update."* A reissue for another date is refused too: *"… that
reissue belongs to a different day."*

### Pasting the prints instead

Click **Can't get the prints onto this machine? Paste them instead**:

1. Open the prints in **Word**, press **Ctrl+A** then **Ctrl+C**.
2. Paste into the **Diagram prints** box.
3. If some diagrams were reissued, paste those into the **Reissued prints**
   box. Otherwise leave it empty.
4. For the High Speed PM arrivals, paste the day before's Summary and Detail
   into the two boxes under them. Either box takes either one.
5. Click **Build the books from the pasted prints**.

**Paste it as it comes.** The diagram lines are held together by tabs, so do
not tidy the text or run it through anything that strips them. If the tabs
are gone the page says so: *"That does not read as the diagram prints — no
“Diagram:” line with its columns intact. Copy the whole document out of Word,
and paste it as it comes."*

Dragging the selection, or the file itself, into the box works here too. A
paste cannot produce the updated prints document — there is no Word file to
splice the reissue into.

---

## Building a week from the base diagrams

When the timetable changes, the **Base diagrams** tab builds a whole week of
books from the base diagram prints, ready before the first day runs.

1. Pick **Base diagrams** and **drop all four day files at once** — FX, FO,
   SO and SUN — or the one file that has them all. Reissues are welcome, the
   same as on the weekend.
2. Each book comes back covering **one week**, with a sheet for each day
   type: **Monday**, **Tuesday to Thursday**, **Friday**, **Saturday** and
   **Sunday**, named the way the depot's own base template names its tabs.
   Monday has a sheet of its own because its arrivals are Sunday night's.
3. **Which week.** It builds the first full week of the timetable. For
   another, pick any date in it under **Week of** — the box appears once the
   books are built — and the whole week holding that date is built again.
4. **The High Speed PM arrivals** fill themselves in from the day before's
   base diagrams. No Genius reports are needed.
5. **Look the books over and save them**, the same as any other.

The 395 base sheets also carry a table of the AZ1 and AZ9 diagrams by where
they start and end the day, and note every AZ1 diagram *Modded unit only*.

Base diagrams dropped on the Weekend tab are sent here, and a day's weekend
prints dropped here are sent there — *“…” is base diagrams for a timetable —
sent to the Base diagrams tab.*

---

## What comes back

### Weekdays

| Card | File | What is in it |
|---|---|---|
| **Mainline** | `SHEETS_MON-03-08.xlsx` | The mainline book — 375s, 376s, 377s — every section from Ashford to West Marina, with Ramsgate cut out |
| **Ramsgate** | `RAM_SHEETS_….xlsx` | Ramsgate's own book, cut from the same day's work |
| **Metro** | `METRO_SHEETS_….xlsx` | The Metro book — 465s, 466s, 707s. **Not a berthing sheet** — see below |
| **High Speed** | `HS_SHEETS_….xlsx` | The High Speed book — 395s. **Not a berthing sheet** — see below |
| **Stock requirements** | `STOCK_REQUIREMENTS_….xlsx` | The Kent Coast form, only when that option is ticked |

### Weekends

**Mainline**, **Ramsgate**, **Metro** and **High Speed** — one book per
fleet for the day (`SHEETS_SAT_02_AUG.xlsx`, `RAM_SHEETS_SAT_02_AUG.xlsx`,
`METRO_SHEETS_SAT_02_AUG.xlsx`, `HS_SHEETS_SAT_02_AUG.xlsx`) — plus the
updated prints document when a reissue was merged.

### Base diagrams

The same four books, each covering the week, with a sheet per day type. The
file names say it is a base week and which one: `SHEETS_BASE_WC_14_SEP.xlsx`
and so on.

Mainline and Ramsgate are berthing sheets everywhere. Metro and High Speed
are the depot's own two documents everywhere — see below. File names carry
the date, so nothing gets mixed up in a folder.

### Two books are the depot's own documents

The Metro and High Speed books are not berthing sheets at all. They are the
documents the depot already keeps, filled in from whichever paperwork the
day was built from:

* The **Metro** book is a sheet per location rather than per day, landscape,
  sixteen columns, reading by Position — 1, 2, 3 straight down each
  formation. The reports fill ten columns; the timing point, comments, R/T
  and L/S are ruled and left empty for you to write in, along with the two
  unheaded spares a long comment runs into. **S** is the split column and is
  filled in: **Y** where the formation comes apart again later today, **N**
  where it stays as one, and empty against a single unit, which has nothing
  to split. Grove Park and Slade Green get an **AM** and a **PM** sheet each,
  split at ten in the morning, and their **ROAD** column says which road the
  working comes off — **DOWNS**, **UPS**, **SHED**, **C/END** or **L/END**.
  Everywhere else the ROAD column is left for you. On screen it has one
  **Sheet** tab with a **Location** picker.
* The **High Speed** book is your **Class 395 Allocations Sheet**, in its
  current template: a sheet per day, a block per depot (Ashford, Faversham,
  Margate, Ramsgate), last night's arrivals on the left and today's
  allocations on the right, each depot's block split into AM and PM by its
  coloured bar. On screen it has one **Allocations** tab with a **Day**
  picker.

Across the top and foot of the High Speed sheet:

* **Service trains** — **REQUIRED** is filled in for you, AM and PM
  separately, from the diagrams that run that day. Type the **OFFERED**
  figures in and any that fall short turn red.
* **Stopped units** — a table under Ashford's block. **TOTAL STOPPED**
  counts the units you put in it.
* **Priority sanding** — fifteen lines, each with a unit drop-down. The
  miles turn green up to 6,000, amber from 6,000 to 6,999 and red from 7,000.
* **The key** — at the foot, as on your own sheet.

The tool fills every column you would fill by hand except the units, which
are the stock controller's choice, and the next-day forming and CET: the
working each train ID really runs, N/M and M/O, which end of a 12 each unit
is at (FP and RP leaving, MAR and MIN at Ramsgate, L or C arriving), where
each line ends, WORKS, and the *not over high level* note on a working that
never goes by the North Kent. The **MG** mileage is coloured green under 400
miles, amber from 400 to 700, and red at 700 and over. A note typed after a
unit number — `395007 SANDING` — is accepted in the unit columns and in the
stopped units table.

Both depot documents are timed off the first time the unit moves, as your
own copies are. Neither has a **Unit order** tab — there is no formation
order on them to turn round — and each one's **Rules** tab describes that
document rather than a berthing sheet.

---

## Reading a sheet

Each section — ASHFORD, GILLINGHAM, SLADE GREEN and so on — is a ruled box
with the section name and the date at the top. Inside it, one **entry** per
departure and one row per unit.

<!-- docx: sheet-sample -->

| Column | What it says | Example |
|---|---|---|
| **A** | Time and where it is going | `06 45 CHX` |
| **B** | What the unit is — cars and class | `4 375` |
| **C** | The three-digit diagram number | `117` |
| **D** | **AM** — the unit's next berth during the day | `DFU` |
| **E** | **PM** — where it finishes the day | `SG` |
| **F** | Unit number, where the report names one — otherwise ruled and empty for you to write in | `375612` |
| **G** | Flag | `SPLITS` |
| **H** | Notes — sidings, attachments, end markers, headcodes | `EAST SIDINGS` |

**Times.** A plain space is a passenger working — `06 45`. A **+** means
empty stock — `05+32`. The usual house convention. Mainline and Ramsgate are
timed off the departure — the moment the unit leaves the area — except at
Grove Park and Slade Green, where it is the moment the unit first moves off
the berth.

**SPLITS** means the units on this departure part company during the day.
**SPLITS PM** means they only part in the evening — the AM and PM columns
tell you who ends up where.

**Notes** carry the house annotations: which siding a unit comes off
(`EAST SIDINGS`, `UP SIDINGS`, `JUB`…), `ATTACHMENT` when another unit joins
the departure, the end markers where the two ends of a train are named for
the way out (`FKE END` / `CBE END` at Dover Priory, and so on), and the
headcode in the sections that quote it.

**Which unit comes first** is taken from the diagram's **Position** in the
Summary, read from the end each section is read from; a few sections and
sidings run the other way, and known formations are pinned outright. Where
two units share a Position the reports genuinely cannot say which way round
they go, and the entry is named on the Review tab for you to check.

**The double lines** rule off the breaks in the day's work: the **first**
break of **three hours or more**, and any later one where the work picks up
**after 20:00**. A lull in the middle of the afternoon draws nothing, a page
that is busy right through gets none, and Grove Park is never ruled.

> **Left off on purpose**
>
> Empty moves into a berth with no passenger work afterwards are not listed
> — the same as the hand-built sheets. So is a unit that stands somewhere
> for the last time in the day and then runs empty to a depot without ever
> being shunted where it stood: that is a wait on the way home, and the line
> belongs to the depot it is going to. Every one of them is named on the
> Review tab, so nothing disappears quietly.

---

## The options

On the weekday tab an **Options** row sits under the status board once
books are built, with a **What each does** link beside it. Every option
rebuilds the books as you tick it — *"Books rebuilt with the mileage column
— save them again if needed."* — and all of them are remembered on the
computer you ticked them on.

**Headcodes on every line.** Only Gillingham, Victoria and Grove Park carry a
headcode as standard. Ticked, every line of the Mainline and Ramsgate books
gets one — empty moves and platform starters alike. Metro and High Speed
already carry theirs.

**Count long platform stands.** A unit that sits in a platform for an hour
or more has arguably berthed there. If the report shunts it on the spot it
always gets a line. If not, it is named on the Review tab under *Platform
stands* and left off — tick this to put those on the sheets too. Only places
the books print a page for are considered; a unit standing at St Pancras is
not a berthing question.

**Mileage column.** Adds MILES to the Mainline and Ramsgate books: the miles
a unit runs from that departure until it next berths *on the book*. A unit
that attaches to another diagram and stays out has no second row, so the row
it does have carries the rest of its day. It is blank on a build from PDFs,
which carry no mileage.

**Stock requirements form.** Going into a Monday, or the day after a bank
holiday, planning fills in the Kent Coast stock requirements form: how many
of each unit type must be standing at each location when the morning opens.
Ticked, the form appears on its own card — *"Stock requirements form added —
it is on its own card below."* — with every diagram counted at the location
it starts the day from. Hastings is folded into West Marina, as the form
itself prints it, and POSITION and SEAT LOSS are left for you. **Save form**
gives you `STOCK_REQUIREMENTS_….xlsx`, and it rides in the save-all zip too.

On the **Weekend** and **Base diagrams** tabs the row is **Headcodes on every
line**, with a box per book — **Mainline & Ramsgate**, **Metro** and **High
Speed**. Ticking a book puts a headcode on every line of it and rebuilds it.

---

## Looking a book over

Each card is a book: **Book 1 Mainline**, **Book 2 Ramsgate**, and so on,
with the classes it carries beside the name and their trains drawn at the
right — a card with no 377 diagrams draws no 377. Under the name it says how
much is in the book — *132 entries · 13 sections* — then a row of chips
summarising the Review tab: *Nothing to review*, or *9 to review · 2 left off
· 4 platform stands · 3 order checks*. Then the buttons — **Close preview**
and **Save book** — and the preview itself, open on its first tab.

The tabs are the days (**MON**, **TUE**…) for a berthing book, or **Sheet**
and **Allocations** for the two depot documents, then **Review**, **Unit
order** and **Rules**. Close a preview and it stays closed through a rebuild;
the page keeps your place.

### The Review tab

Every build produces a review list: everything the rules had to decide for
themselves, named openly rather than quietly guessed at. Each book shows
only its own items, grouped by kind:

* **Plan changed since the book was saved** — see below.
* **Left off the sheet** — empty moves into a berth with no passenger work
  afterwards are left off, the same as the hand-built sheets, and so is a
  wait on the way home to a depot. Each one is named with its diagram
  number.
* **Platform stands** — the long stands in a platform that were, or were
  not, counted as a berthing.
* **Reissue** — what a reissue replaced and added (weekends and base weeks).
* **Order to check** — formations the reports cannot settle: two units on
  one Position, a formation pinned somewhere but not here, an end marker with
  no rule to fit, and the Folkestone East Train Roads arrivals worked out
  from tonight's arrivals — always check those against the ACWN.
* **Locations and codes** — a place the section list does not know (it gets
  its own heading, in alphabetical order) or a name the page had to read as
  something else.
* **Notes** — everything else: a diagram in one report but not the other, a
  Summary exported without the Genius setting, a date left out.

A clean list is normal on a straightforward day. A long one is not a fault —
it is the page showing its working.

### The Unit order tab

Berthing books only. It lists every formation of two or more units the book
printed, in the order it printed them, and says what decided it — *the
position numbers in the report*, *the corrections list*, or *you, on this
computer*. Hold it against the real book. If one is the wrong way round,
press **Reverse**: the formation turns round and the books rebuild straight
away — *"Books rebuilt with your order correction — save them again if
needed."* **Undo** puts it back, and **Undo all my corrections** clears the
lot.

Corrections are kept on this computer only, and stay in force for every book
built here until you undo them. A second table on the tab, **Order
corrections made on this computer**, lists them in words — location, time,
the diagrams running together, the order they print. **Tell us what it
says**, and the correction is built into the tool for everybody.

### The Rules tab

Every rule the book was built with, written out in plain English from the
tables that ran: which movements get a line, which unit prints first, how
times and the double lines across the page work, end markers, routes,
headcodes, the words in the notes column, and what the tool will not decide
for you. Change an option and rebuild, and the tab changes with it. The same
rulebook, for circulating, is **BERTHING SHEET RULES.html** beside the tool.

### "The plan has changed since the book was saved"

When you save a book the page remembers what was in it — on this computer;
nothing leaves it. Build the same date again later and anything that no
longer matches is listed first on the Review tab: a working gone from the
plan, a new one, a formation or berth changed. The status board says so too
— *"The plan has changed since a book for this date was saved on this
computer — the changes are listed first on each Review tab."* An unchanged
re-export stays quiet. The last eight saved dates are kept.

---

## Saving, and starting again

* **Save book** on a card saves that one book: *"Saved SHEETS_MON-03-08.xlsx
  — look in this computer's Downloads folder."*
* **Save all books (.zip)** on the status board saves every book that was
  built, in one zip file — a folder squashed into a single file; double-click
  it and the books are inside. *"Saved SHEETS_BOOKS_MON-03-08.zip — 4 books
  in it, in this computer's Downloads folder."*
* **Save updated prints (.docx)** — weekends, after a reissue — saves the
  spliced prints.
* **Start over** clears the books, the loaded files and the paste boxes:
  *"Cleared — drop this day's two reports to start again."* Your options and
  order corrections are kept.

If you tick an option or press Reverse after saving, save again — the status
board reminds you.

---

## Shortages and variations

The controller's list of what is wrong with today's trains, ready to paste
into the Excel text box it goes in. It builds no book. **Mainline and Metro
only** — not the 395s.

1. Pick **Shortages & variations** and drop the **Operating Report** and the
   **Diagram Detail** for the same day, PDF or CSV.
2. Add the **Diagram Summary** if you have it. It is optional: with it, a
   3-car in a train of three or more units can be called *wrong end* or
   *intermediate*; without it, those are left on the Review list for you to
   check.
3. The list appears under the status board. **Copy the list** puts it on the
   clipboard; **Save as text** saves it; **Start over** clears it.

What it lists:

* **Shortages** — a *Not allocated* line on the Operating Report, inside the
  window the report's print time puts it in. A shortage that moves from one
  diagram to another is one item, followed through every service it touches.
* **Variations** — a unit of the wrong length, the wrong fleet family or the
  wrong class against what the diagram planned: `4.375 V 8.375`,
  `3 CAR WRONG END`, a 375/9 on a 375 diagram.
* **Everything each one affects** — the later services it goes on to, on
  the `FOLLOWING` lines.

The **Options** row changes the list on screen and what you copy or save:

* **Lettered, for the Excel text box** — each item gets its own letter, in
  time order, laid out for the text box it is pasted into, and no service
  is split across two lines.
* **Variations grouped by which way round** — all the 375/9s on 375 diagrams
  together, then all the 375s on 375/9 diagrams, instead of by where each
  unit ends up.
* **Arrival times on Ramsgate only** — shows `(ARR …)` only for workings that
  end at Ramsgate.

The place codes on this list are the **roads** — `AFDS`, `AFUS`, `DVPS`,
`GPUS` — not the berthing books' station codes, because a discrepancy is
worked off a road. *What this list is working from*, at the foot of the
tab, sets out every rule.

---

## Berth requests

<!-- docx: amber -->
> **Do not use this to build your Telex**
>
> This tab is experimental. Use it as a reference when deciding berth
> requests, and check everything against the reports before anything goes on
> the Telex. **Mainline and Metro only** — a Class 395 Disposition Statement
> pasted here is turned away with a note.

For every unit on the maintenance plan that needs one, it suggests a berth
request in the depot's own words.

1. **The reports.** Drop tonight's **Allocation Summary** and tomorrow's
   **Diagram Summary** and **Detail** on the zone. Already built the weekday
   books? Their reports are used, and you can skip this.
2. **The plan.** Copy the **Maintenance Plan** tab out of the Mainline Stock
   Control Document, or the Metro Stock Telex, and paste it into the
   **Maintenance plan** box.
3. **The defects.** Optional: paste the End of Days, Restrictions and
   Performance Defects out of **Equinox or EMS** into the **Defects** box,
   just as they come.
4. **Press Read the plan.** The plan comes back below in its own shape, with
   a suggestion in each Action column — in bold where it differs from what
   the plan had — and a **Why** column saying what the plan had, the
   reasons, and where the unit is today.

Two more boxes, and two ticks:

* **Out of service** — units to ignore. Their lines are marked and left out.
* **MSE attending** — units the mobile engineers are going out to. Their
  lines get *MSE ATTENDING — NO REQUEST*. The units the defects export flags
  MSE are listed under the box once the plan is read.
* **Keep trains together** — splits a formation only where nothing else
  gets the unit home.
* **The day hasn't run yet** — each unit is taken from where its first
  working starts, so the request is made before it goes out. It is ticked
  for you when the reports are for today or later.

**Workbook** says which plan was pasted — it is read from the paste, or pick
**Mainline plan** or **Metro Telex**. Then:

* **Copy the plan back** — paste it over the Maintenance Plan tab from A1;
  the Action column lands where it was.
* **Save as Excel** — the same sheet, with a **Why** sheet beside it.
* **Save as text**, and **Show nearest first** to list the lines due soonest
  at the top.

*How it works* and *What this table is working from, and the rules to come*,
on the tab, set out every rule it follows.

---

## When something looks wrong

| What you see | What it means |
|---|---|
| *"No Diagram Summary rows found — drop the Genius Diagram Summary report as well."* or *"No Diagram Detail itineraries found — …"* | One of the two reports is missing or is the wrong kind. Both are needed, for the same date. |
| *"The Summary is from Genius but the Detail is from Integrale — …"* | The pair must come from the same system. |
| *"The two reports are for different dates — …"* | The Summary and the Detail were run for different days. |
| *"… doesn't look like a Genius report — …"* or *"… couldn't be read as a PDF — …"* | The PDF's text could not be read. Save it again from Genius — not a scan or a photo. |
| *"That CSV doesn't look like the Integrale Diagram Summary export. It is missing the … column"* | An Integrale export run without a column the page needs. Add the named columns and export again. |
| *"This panel doesn't read spreadsheets. …"* | An Excel file was dropped. Export the reports as CSV or PDF instead. |
| A card says *"No … diagrams in these reports — nothing to build."* | No diagrams for that fleet are in the paperwork. Nothing wrong — but in Genius, check a Control Cycle exists for that fleet. |
| The High Speed sheet's arrivals side is empty | The day before's Summary and Detail were not dropped. Add them and the books are built again with the arrivals. |
| *"This Diagram Summary was exported without “Show diagram sections” ticked …"* on the Review tab | The Genius setting was off. The books are built, but afternoon formations may be the wrong way round and this export cannot say which. Re-export with it ticked, or put them right with Reverse. |
| Two units are the wrong way round | Look for the note above first. Otherwise, if the entry is under *Order to check*, the reports could not settle it; if it is not, the order came from the tables. Either way, press **Reverse** on the Unit order tab and tell us. |
| A location has its own heading | A unit berthed somewhere the section list has never heard of. It is under *Locations and codes* — check where it should live. |
| A train seems to be missing | Read *Left off the sheet* first. If it is not there, note the diagram number and report it. |
| *"That file is damaged or isn't a Word document. Try re-saving the prints from Word as .docx."* | Open the prints in Word, save as .docx, drop the new file. |
| *"That isn't the diagram prints. …"* | A text or CSV save whose columns were lost. Save it again, or paste it from Word. |
| *"That looks like a reissue on its own — …"* | Drop the full weekend prints with it, or first. |
| *"… that reissue belongs to a different day."* | The reissue's date does not match the prints. |
| *"Build failed: … Check the files and drop them again."* | Something in the files could not be read. Books from an earlier drop are cleared, so nothing is saved by mistake. |
| *"This browser blocks local storage, …"* | The page still builds, but corrections, options and the saved-book memory will not survive closing it. |
| Nothing happens when you drop a file | Click the zone and browse for the file instead — some setups block drag-and-drop. |

---

## Before the books go out

* **Read the Review tab.** Every time. It exists to be read.
* **Check the sheets against the ACWNs** — especially the Folkestone East
  Train Roads notes, which are worked out from last night's arrivals and
  flagged for exactly this reason.
* **Check the date on the sheet** matches the day you meant to build.
* Remember this is a **drafting tool**. It applies the house rules faithfully
  and tells you where it had to make a call — but the books are yours, and a
  human signs them off.

---

## The Diagram Analyser

`Diagram Analyser.html` is a separate tool, opened the same way. It reads
the same diagram prints, but instead of building berthing books it answers
the questions maintenance planning keeps asking. It has its own version
number, under its title and in its footer.

1. **The prints.** Drop the whole set together — the Mon–Thu book (FSX) and
   the Friday, Saturday and Sunday ones. Each covers days the others do not,
   and the answers are worked out across the whole week.
2. **The fleets.** Check the units owned under **Fleets & depots**. The
   prints cannot show a spare unit, and every miles-per-unit figure is
   divided by it. The home depot, where each fleet can be repaired, and —
   for the 377s, whose depot is off this network — the times a unit has to
   be at Victoria are set there too. All of it is remembered on the
   computer.
3. **The day.** Pick **Mon – Thu**, **Friday**, **Saturday** or **Sunday** on
   any fleet's card and every card follows. Mileage is always the whole week.
4. **What you get.** A card per fleet, a tab per question. **Save this
   fleet** puts its answers in a workbook; **Save every fleet** puts them
   all in one.

| Tab | What it answers |
|---|---|
| **Arrivals home** | Units whose diagram *ends* at the home depot — before noon, noon to midnight, and after midnight. One that calls in and goes out again is not counted. |
| **Home before 8pm** | Diagrams that end at home between noon and 20:00 — units a late shift can start on — and when each is needed again. |
| **Restricted units** | Diagrams coupled on every leg — the only ones a restricted unit can take — and, night by night, whether a unit on them can stay on that work. |
| **Days back to depot** | For every place a unit can be left, how many days the diagrams take to bring it home, and the way back. |
| **Mileage** | Miles per unit a day and a year, by sub-fleet, with the sum shown step by step. |
| **Attendable stands** | Every place a unit stands still for two hours or more during the day — long enough for a mobile engineer to get to it. |
| **Cannot contain** | Places a restricted unit cannot be worked from, because every diagram out of there leaves it running alone at some point. |
| **Together AM, apart PM** | Units that go out coupled, are put away together, and only come apart later. |
| **Place codes** | What each place code in the prints means — Ram is Ramsgate Platform, RamsNewSd is Ramsgate New Sidings. |
| **To Selhurst** | For the 377s only: the units at Victoria in time to be taken over, finished for the day or parked mid-diagram. |

Each tab opens on its answer in words, with a *How this is worked out* fold
under it for the detail. Place codes in the tables carry their full name
when you hover over them.

> **MO means two different things**
>
> On the prints, MO is a day code — Mondays only — and the analyser always
> writes day codes out in full (*Mon only*, *Mon–Thu*) so it can never be
> misread. In the depot, an MO unit is a restricted unit that cannot run on
> its own. Everywhere the analyser says *restricted unit*, that is what it
> means.

---

*Questions, or a rule that doesn't match how your patch does it? Say so — the
rules live in one place and can be corrected.*
