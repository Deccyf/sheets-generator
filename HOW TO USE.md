# How to use the Sheets Generator

A plain-English guide to building the unit berthing books.
No training needed — if you can find the reports, the page does the rest.

---

## Contents

- [What this is](#what-this-is)
- [The two-minute version](#the-two-minute-version)
- [Opening the page](#opening-the-page)
- [Getting the paperwork](#getting-the-paperwork)
- [Building the weekday books](#building-the-weekday-books)
- [Building the weekend books](#building-the-weekend-books)
- [What comes back](#what-comes-back)
- [The options](#the-options)
- [Looking a book over](#looking-a-book-over)
- [Saving, and starting again](#saving-and-starting-again)
- [When something looks wrong](#when-something-looks-wrong)
- [Before the books go out](#before-the-books-go-out)
- [The Diagram Analyser](#the-diagram-analyser)

---

## What this is

`Sheets Generator.html` is one file that turns the planning paperwork into
the **unit berthing books** — the SHEETS — with every diagram number, AM and
PM column, flag and note filled in the way the hand-built books do them.

You give it:

* **Monday to Friday** — the *Diagram Summary* and *Diagram Detail* reports
  for the date: from Genius as PDFs or CSVs, or from Integrale as its two
  CSVs.
* **Saturday and Sunday** — the weekend *diagram prints* Word document, plus
  any reissues.

You get finished Excel workbooks, ready to check and send out.

A **book** is one of those files. A **sheet** is a page inside it — the
Monday page of the Mainline book, say. The page uses those two words the
same way everywhere, and so does this guide.

**Nothing leaves your computer.** The page does all the work in the browser
on your own machine — no internet connection, no login, no upload, nothing
installed. You can use it on a train with no signal.

---

## The two-minute version

1. Double-click **`Sheets Generator.html`**.
2. Pick **Weekday · Mon – Fri** or **Weekend · Sat & Sun** at the top.
3. Drop the two weekday reports, or the weekend prints, on the drop zone.
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
  Just use that one; there is no update to run. The version is in the top
  right corner and again at the foot of the page — quote it if you report
  something.

From the top down, the page has:

* **How to use this page** — a fold with the quick start, where to find the
  reports in Genius, how to get the CSVs out of Integrale (with
  screenshots), what comes back, and what to do if a build looks wrong.
* The **mode switch** — **Weekday · Mon – Fri** and **Weekend · Sat & Sun**.
  One panel shows at a time, and the page remembers which you used last.
* The **drop zone** for that mode, with a *paste instead* link under it for
  machines that will not let you save the files.
* The black **status board**, which says what the page has just done and,
  once books are built, carries **Save all books (.zip)** and **Start over**.
* The **Options** row (weekday) or the **Headcodes on every line** boxes
  (weekend).
* The **book cards** — one per book, each with its sheet open on it.

Drop a file on the wrong panel and it is sent to the right one for you:
*"“WEEKEND PRINTS.docx” is weekend diagram prints — sent to the Weekend
panel."*

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
just as well. What it cannot read as prints is a Diagram Summary or Diagram
Detail export — those are weekday reports, and they are sent to the Weekday
panel.

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

**Several dates at once.** If the reports cover a whole week you get one
sheet per date inside each book, MON to FRI. A date that falls on a weekend
is skipped with a note — *"… falls on a weekend — use the weekend prints
panel"*. Two dates on the same weekday cannot both be built: the second is
named on the Review tab and left out, so build one week at a time.

**A book with nothing in it** says so instead of giving you an empty
workbook: *"No Metro diagrams in these reports — nothing to build. (A Metro
Control Cycle must exist in Genius for its diagrams to appear.)"*

### Pasting the reports instead

Some machines will not let you save the reports anywhere the browser can
reach. Click **Can't get the files onto this machine? Paste the reports
instead**, under the drop zone, and two boxes open.

1. Open the **Diagram Summary** CSV in Notepad or Excel.
2. Select all (**Ctrl+A**), copy (**Ctrl+C**), and paste into the **Diagram
   Summary** box.
3. Same again with the other report, into the **Diagram Detail** box.
4. Click **Build the books from the pasted reports**.

From there it is exactly the same as dropping the files — same checks, same
books. Worth knowing:

* **CSVs only.** A PDF has no text to copy, so Genius PDFs have to be dropped
  as files.
* **One at a time is fine.** The Detail is far the bigger file, so drop it on
  the zone and paste the Summary, or the other way round — *"Built with the
  Diagram Detail already loaded."* Only a report that is nowhere at all is
  refused: *"Still needs the Diagram Detail — paste it into the other box, or
  drop the file on the panel above. Either way round works."*
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
* **Clear both boxes** empties them.

---

## Building the weekend books

1. Pick **Weekend · Sat & Sun** and **drop the prints** on the zone.
2. **Drop the reissues too**, if there are any — with the prints, or later
   once you have already built. Reissued diagrams replace their originals,
   new ones are added, and everything is rebuilt. The status board says
   *"Books built for SUN 16/08 — 111 entries. Look them over below, then
   save. Reissue applied: 3 diagrams replaced, 1 added."*
3. **Look each book over** and save it, the same as the weekday books.
4. If a reissue was merged, **Save updated prints (.docx)** appears on the
   status board — the original prints with the reissued diagrams spliced in,
   so there is one clean copy to circulate. It is only produced when **both**
   the prints and the reissue are Word documents. Otherwise the Review tab
   says *"updated prints document not produced"* and why, and the books still
   use the merged prints.
5. **Start over** clears everything and lets you begin again.

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
4. Click **Build the books from the pasted prints**.

**Paste it as it comes.** The diagram lines are held together by tabs, so do
not tidy the text or run it through anything that strips them. If the tabs
are gone the page says so: *"That does not read as the diagram prints — no
“Diagram:” line with its columns intact. Copy the whole document out of Word,
and paste it as it comes."*

Dragging the selection, or the file itself, into the box works here too. A
paste cannot produce the updated prints document — there is no Word file to
splice the reissue into.

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
`SHEETS_465_466_707_SAT_02_AUG.xlsx`, `SHEETS_395_SAT_02_AUG.xlsx`) — plus
the updated prints document when a reissue was merged. All four weekend
books are berthing sheets.

File names carry the date, so nothing gets mixed up in a folder.

### Two weekday books are the depot's own documents

On weekdays the Metro and High Speed books are not berthing sheets at all.
They are the documents the depot already keeps, filled in from the reports:

* The **Metro** book is a sheet per location rather than per day, landscape,
  sixteen columns, reading by Position — 1, 2, 3 straight down each
  formation. The reports fill ten columns; the timing point, comments, R/T
  and L/S are ruled and left empty for you to write in, along with the two
  unheaded spares a long comment runs into. **S** is the split column and is
  filled in: **Y** where the formation comes apart again later today, **N**
  where it stays as one, and empty against a single unit, which has nothing
  to split. Grove Park and Slade Green
  get an **AM** and a **PM** sheet each, split at ten in the morning, and
  their **ROAD** column says which road the working comes off — **DOWNS**,
  **UPS**, **SHED**, **C/END** or **L/END**. Everywhere else the ROAD column
  is left for you. On screen it has one **Sheet** tab with a **Location**
  picker.
* The **High Speed** book is your **Class 395 Allocations Sheet**: a sheet
  per day, a block per depot (Ashford, Faversham, Margate, Ramsgate) with
  last night's arrivals on the left and today's allocations on the right,
  your berth codes (`ASH`, `RAM`, `FAV`), your drop-downs, the mileage
  column coloured green under 500 miles and red at 500 and over, and the
  route notes on the diagram cells. The arrivals side fills from the day
  before, so a Monday-to-Friday pair has it on every day but the Monday. On
  screen it has one **Allocations** tab with a **Day** picker.

Both are timed off the first time the unit moves, as your own copies are.
Neither has a **Unit order** tab — there is no formation order on them to
turn round — and each one's **Rules** tab describes that document rather
than a berthing sheet.

---

## The options

On the weekday panel an **Options** row sits under the status board once
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
a unit runs from that departure until it next berths *on the book*, the
figure the 395 sheet calls MG. A unit that attaches to another diagram and
stays out has no second row, so the row it does have carries the rest of its
day. It is blank on a build from PDFs, which carry no mileage.

**Stock requirements form.** Going into a Monday, or the day after a bank
holiday, planning fills in the Kent Coast stock requirements form: how many
of each unit type must be standing at each location when the morning opens.
Ticked, the form appears on its own card — *"Stock requirements form added —
it is on its own card below."* — with every diagram counted at the location
it starts the day from. Hastings is folded into West Marina, as the form
itself prints it, and POSITION and SEAT LOSS are left for you. **Save form**
gives you `STOCK_REQUIREMENTS_….xlsx`, and it rides in the save-all zip too.

On the weekend panel the row is **Headcodes on every line** with a box per
book — **Mainline & Ramsgate**, **Metro**, **High Speed** — because all four
weekend books are berthing sheets.

---

## Looking a book over

Each card is a road: **Road 1 Mainline**, **Road 2 Ramsgate**, and so on.
Under the name it says how much is in the book — *132 entries · 13
sections* — then a row of chips summarising the Review tab: *Nothing to
review*, or *9 to review · 4 left off · 3 order checks*. Then the buttons —
**Close preview** and **Save book** — and the preview itself, open on its
first tab.

The tabs are the days (**MON**, **TUE**…) for a berthing book, or **Sheet**
and **Allocations** for the two depot documents, then **Review**, **Unit
order** and **Rules**. Weekend cards have **Sheet** and **Review**. Close a
preview and it stays closed through a rebuild; the page keeps your place.

### The Review tab

Every build produces a review list: everything the rules had to decide for
themselves, named openly rather than quietly guessed at. Each book shows
only its own items, grouped by kind:

* **Plan changed since the book was saved** — see below.
* **Left off the sheet** — empty moves into a berth with no passenger work
  afterwards are left off, the same as the hand-built sheets, and so is a
  wait on the way home to a depot. Each one is named with its diagram
  number: *"Left off — ASHFORD 05+32 (116): …"*.
* **Platform stands** — the long stands in a platform that were, or were
  not, counted as a berthing.
* **Reissue** — what a reissue replaced and added (weekends).
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

`Diagram Analyser.html` is a separate tool: it reads the same diagram prints
but answers maintenance planning's questions — arrivals home, mileage per
unit, how long back to the depot — rather than building berthing books, and
it carries its own version number in its footer.

---

*Questions, or a rule that doesn't match how your patch does it? Say so — the
rules live in one place and can be corrected.*
