# How to use the Sheets Generator

A plain-English guide to building the unit berthing books.
No training needed — if you can find the reports, the page does the rest.

---

## Contents

1. [What this is](#1-what-this-is)
2. [The two-minute version](#2-the-two-minute-version)
3. [Opening the page](#3-opening-the-page)
4. [Getting the paperwork](#4-getting-the-paperwork)
5. [Building the weekday books](#5-building-the-weekday-books-mon--fri)
6. [Building the weekend sheets](#6-building-the-weekend-sheets-sat--sun)
7. [What you get](#7-what-you-get)
8. [Reading a sheet](#8-reading-a-sheet)
9. [The review list — always read it](#9-the-review-list--always-read-it)
10. [The headcode switches](#10-the-headcode-switches)
10a. [Long platform stands](#10a-long-platform-stands)
11. [When something looks wrong](#11-when-something-looks-wrong)
12. [Before the books go out](#12-before-the-books-go-out)

---

## 1. What this is

`Sheets Generator.html` is one file that turns the planning paperwork into the
**unit berthing books** — the SHEETS — with every diagram number, AM/PM column,
flag and note filled in the way the hand-built books do them.

You give it:

* **Monday to Friday** — the *Diagram Summary* and *Diagram Detail* reports for
  the date: from Genius as PDFs or CSVs, or from Integrale as its two CSVs.
* **Saturday and Sunday** — the weekend *diagram prints* Word document, plus any
  reissues.

You get finished Excel workbooks, ready to check and send out.

**Nothing leaves your computer.** The page does all the work in the browser on
your own machine. No internet connection, no login, no upload, nothing
installed. You can use it on a train with no signal.

---

## 2. The two-minute version

1. Double-click **`Sheets Generator.html`**.
2. Drop the **two weekday reports** on the top panel (or the **weekend prints**
   on the bottom one). Can't get the files onto the machine? Either panel will
   take the paperwork pasted in instead — sections
   [5](#5-building-the-weekday-books-mon--fri) and
   [6](#6-building-the-weekend-sheets-sat--sun).
3. The books appear straight away. Click **Look at it** on each and read the
   **Review** tab.
4. Click **Save book** on each, or **Save all books (.zip)** for the lot.

That's the whole job. The rest of this guide is detail for when you want it.

---

## 3. Opening the page

Double-click the file. It opens in your browser like any web page.

* Use **Edge, Chrome or Firefox**. If it opens in something older and says the
  browser is too old, right-click the file → **Open with** → pick Edge.
* Keep the file wherever suits you — desktop, a network drive, a memory stick.
  It works the same from any of them.
* There is nothing to install and nothing to sign into. If you have been sent a
  newer copy of the file, just use that instead; there is no update to run.

The page has **two panels**, one above the other:

| Panel | Sign at the top | What it takes |
|---|---|---|
| Top | **Weekdays · Mon – Fri** | the two Diagram reports — Genius (.pdf or .csv) or Integrale (.csv) |
| Bottom | **Weekend · Sat & Sun** | the weekend diagram prints (.docx / .doc, or the same thing as .txt or .csv) |

Drop your files on the matching one. If you put weekend prints on the weekday
panel by mistake it will tell you, politely, and point you downstairs.

**The two Diagram reports never build a weekend.** Saturday and Sunday books
come from the prints and nothing else — the CSVs go on the top panel, and a
weekend-dated pair dropped there says so and points you down here.

---

## 4. Getting the paperwork

### From Genius (PDF or CSV)

> ### ⚠ Check this one setting first
>
> **File → Session Settings** → make sure **"Show diagram sections on the
> diagram summary report"** is **ticked**.
>
> **Without it you only get the AM unit positions. It needs to be ticked to
> get the PM positions as well.**
>
> A "diagram section" is a working. With that box unticked, the Diagram Summary
> gives you one line per diagram instead of one line per working — and the only
> unit position it carries is where each unit stood at the *start of the day*.
>
> The books still build. But every formation that comes together later in the
> day gets printed in its morning order, which is usually not the order the
> units are standing in. **Grove Park in the afternoon** is the worst of it,
> because units are re-formed there all day. On 17/08 it put four formations
> the wrong way round — the 15 12, the 16 41, the 16 50 and the 17 09.
>
> It can't be fixed afterwards. The Detail report has no Position column at
> all, so once the Summary has been exported without it, the order is simply
> gone. The review list will tell you it happened, but it can't tell you the
> right answer.
>
> With the box ticked it's right — against the real 12/08 book, 13 out of 13.

1. Make sure a **Control Cycle** exists for the date. If you want the Metro and
   High Speed books as well, Control Cycles must exist for those fleets too —
   this is the usual reason a book comes up empty.
2. Run **Diagrams → Summary Report…** and save it as a **PDF** or a **CSV**.
3. Run **Diagrams → Detail Report…** and save that the same way.

Either format is read, and you can mix them — a PDF summary with a CSV detail
builds fine. Save both from Genius itself; a scan or a photo of a printout
can't be read.

### From Integrale (CSVs)

**The Diagram Summary file**

1. Open the **Stock Diagrams** list and click **[GO→]** without selecting a
   filter.
2. Click **[Export To Excel]**.
3. Save it in a sensible folder under a sensible name, with **File Type** set to
   **.csv**, and click **[Save]**.

**The Diagram Detail file**

1. Open the **Stock Diagrams** list and click **[GO→]** again, still without a
   filter.
2. Click **Stock Diagram Detail Report** on the toolbar.
3. The dialog opens at the bottom of the screen — click **[…]** under **Output
   Path**.
4. Pick the same folder as the Summary, give it a sensible name, **File Type
   .csv** again, then **[Save]**.
5. Click **[OK]** — you may have to scroll down to see it. It takes a minute or
   so, then tells you it's done.

The same steps, with screenshots, are inside the page itself: look for
*Getting the two CSVs out of Integrale* in the quick start at the top.

> **Genius and Integrale both work, and both give the same books.** What you
> can't do is mix the two systems — a Genius Summary with an Integrale Detail
> won't build, and the page will say so. Mixing a Genius PDF with a Genius CSV
> is fine.

### The weekend prints

Get the weekend **diagram prints** Word document — `.docx`, or an older `.doc`.
If **reissued** prints have come out, get those too. Any file with *reissue* or
*re-issue* in its name is treated as a reissue.

The panel reads the prints by what is **inside** the file, not by what it is
called, so the prints saved out of Word work just as well — as plain text
(`.txt`) or as a **`.csv`**, where the commas are the columns. What it cannot
read is a Diagram Summary or Diagram Detail export: those are the weekday
reports and belong on the top panel.

---

## 5. Building the weekday books (Mon – Fri)

1. **Drop both reports** on the top panel — together, or one and then the other.
   You can also click the panel to browse for them.
2. The page works out which report is which by reading it, so the order doesn't
   matter. Drop one and it tells you what it's still waiting for — *"Genius
   Summary loaded ✓ — now drop the Diagram Detail report."* — and the drop zone
   itself changes to match.
3. As soon as it has the pair, the books are built. You'll see
   *"Books built — look them over below, then save."*
4. **Look them over.** Click **Look at it** on a book to see the finished sheet
   on screen, day by day, exactly as it will print. Tabs across the top are the
   days (MON, TUE…) plus **Review**.
5. **Save.** Either **Save book** on each one, or **Save all books (.zip)** at
   the bottom for everything in a single zip.

**Several dates at once.** If the reports cover a whole week, you get one tab
per date inside each workbook — MON to FRI. Dates that fall on a weekend are
skipped, with a note telling you to use the weekend panel.

**A book with nothing in it** says so — *"No Metro diagrams in these reports —
nothing to berth"* — instead of giving you an empty workbook. For Metro and High
Speed it reminds you to check the Control Cycle.

### If you can't get the files onto the machine

Some machines won't let you save the reports anywhere the browser can reach.
Under the drop zone there's a link — **"Can't get the files onto this machine?
Paste the data instead"** — which opens two boxes:

1. Open the **Diagram Summary** CSV. Notepad or Excel, either reads it.
2. **Select all** (Ctrl+A), **copy** (Ctrl+C).
3. Paste it into the **Diagram Summary** box.
4. Same again with the other report, into the **Diagram Detail** box.
5. Click **Build from the pasted data**.

From there it is exactly the same as dropping the files — same checks, same
books.

Worth knowing:

* **You don't have to paste both.** The Diagram Detail is far the bigger of the
  two — megabytes against a couple of hundred kilobytes — so it's the one a
  locked-down machine is most likely to baulk at. **Drop that one on the panel
  as a file and paste the Summary**, or the other way round: whichever report
  is already loaded gets used, and the page tells you it did. Only a report
  that is nowhere at all is refused, and it says which one by name.
* **If the machine won't let you paste at all.** Some block Ctrl+V into a
  browser, and right-click → Paste with it. Two ways round it, neither of
  which goes near the clipboard:
  * **Drag the selection.** Highlight the rows in Excel or Notepad and drag
    them straight into the box.
  * **Drag the file.** Drag the CSV itself out of the folder and into the box,
    and it is read in — you don't even have to open it.
* **CSV exports only on this panel.** A PDF has no text in it to copy, so the
  Genius PDFs still have to be dropped as files. (The weekend prints *can* be
  pasted — see [section 6](#6-building-the-weekend-sheets-sat--sun).)
* **Excel is fine.** Copying cells out of Excel puts them on the clipboard
  separated by tabs rather than commas. The page spots that and converts it,
  so you don't have to think about which program you opened the file in.
* **The boxes aren't fussy about which is which.** It reads each box to see
  what's in it. Paste them the wrong way round and it builds anyway, and tells
  you — *"Read the boxes the other way round"*.
* **Both boxes, both for the same date.** One on its own gets you *"Paste the
  Diagram Detail into its box as well"*.
* **Clear both** empties them.

---

## 6. Building the weekend sheets (Sat & Sun)

1. **Drop the prints** on the bottom panel.
2. **Drop the reissues too**, if there are any — with the prints, or in a later
   drop once you've already built. Reissued diagrams **replace** their originals
   and new ones are added, then everything is rebuilt. The status line tells you
   how many were replaced.
3. **Look each sheet over** and save it, the same as the weekday books.
4. If a reissue was merged and the prints were a `.docx`, you also get **Save
   updated prints (.docx)** — the original prints document with the reissued
   diagrams spliced in, so there is one clean copy to circulate.
5. **Start over** clears everything and lets you begin again.

A reissue dropped on its own won't build — the page needs the full prints with
it (or first), and says so. A reissue for a different date is refused too.

### If you can't get the prints onto the machine

Same idea as the weekday panel. Under the weekend drop zone there's **"Can't
get the prints onto this machine? Paste them instead"**:

1. Open the prints in **Word**.
2. **Ctrl+A**, then **Ctrl+C**.
3. Paste into the **Diagram prints** box.
4. If some diagrams have been reissued, paste those into the second box.
   Otherwise leave it empty.
5. Click **Build from the pasted prints**.

Worth knowing:

* **Paste it as it comes.** The diagram lines are held together by **tabs** —
  `Diagram:` then a tab, then the code. Don't tidy the text up or run it
  through anything that strips them. If the tabs are gone the page says so
  rather than building something half-read.
* **It's the same reader.** The Word file is only a wrapper; the text inside is
  what the page actually reads. Checked on a real Sunday's prints both ways —
  dropped as the `.docx` and pasted as text — and every line of every sheet
  came out the same.
* **A `.txt` works too**, if it's easier to save the prints out as plain text
  than to copy them. Drop it like any other file.
* **No updated prints document from a paste.** That one splices the reissued
  diagrams back into the original Word file, and a paste hasn't got one. The
  sheets are still built from the merged prints, and the review list says the
  updated document wasn't produced.
* **Start over** empties the boxes as well.

---

## 7. What you get

### Weekdays — four roads

| Road | File | What's in it |
|---|---|---|
| **SHEETS** | `SHEETS_MON-03-08.xlsx` | The mainline book — 375s, 376s, 377s — every section from Ashford to West Marina, with Ramsgate cut out |
| **RAM SHEETS** | `RAM_SHEETS_…xlsx` | Ramsgate's own book, cut from the same day's work |
| **METRO SHEETS** | `METRO_SHEETS_…xlsx` | The metro book — 465s, 466s, 707s. **Not a berthing sheet** — see below |
| **HS SHEETS** | `HS_SHEETS_…xlsx` | The High Speed book — 395s |

### Weekends — three books

### The Metro book is a different document

The Metro sheets are the depot's own format, not a berthing sheet, and the tool
builds them that way:

* **A tab per location** rather than a tab per day, **landscape**, running down
  as many pages as it needs. Grove Park and Slade Green get an **AM** tab and a
  **PM** tab.
* Fourteen columns: `TRAIN I.D.`, `SIDINGS`, `STATION` (or `SIGNAL`),
  `DESTINATION`, `POS`, `DIAG`, `FORMATION`, `ROAD` (or `PLATFORM` at a
  terminus), `COMMENTS`, `S`, `R/T`, `L/S`, `ENDS`, `MILES`.
* The reports fill eight of them. **Six are ruled and left empty** for you to
  write in — the timing point, the road, comments, S, R/T and L/S — the same
  ones that are hand-kept in your own workbook.
* It reads **by Position, lowest first** — 1, 2, 3 straight down each
  formation. That is not the berthing books' order and is not meant to be.
* `MILES` is the diagram's own total for the day, off the Detail export. A PDF
  report carries no mileage, so the column stays blank.
* `ENDS` is where the diagram finishes and in which half of the day — `GP PM`,
  `SG AM`.
* Each sheet ends with **DATED**, **NAME** and **SIGNATURE**, and the
  *"please e-mail sheets to…"* line, the same as your own.
* Columns widen to fit what's in them, so nothing clips.

One workbook per fleet for the day: **Mainline**, **Metro**, **High Speed**,
plus the updated prints document when a reissue has been merged.

The file names carry the date, so `SHEETS_MON-03-08.xlsx` and
`SHEETS_SAT_02_AUG.xlsx` never get mixed up in a folder.

---

## 8. Reading a sheet

Each section — ASHFORD, GILLINGHAM, SLADE GREEN and so on — is a ruled box with
the section name and the date at the top. Inside it, one **entry** per
departure, and one row per unit.

Which unit is listed first comes from the diagram's **Position** in the
Summary. Broadly the mainline book puts the lowest Position first and the metro
and High Speed books the highest — but that isn't a rule without exceptions. A
few sections and some individual sidings run the other way, and known formations
can be pinned outright. Those are all written down in the tables rather than
worked out on the fly, so they don't drift. Where two units share a Position —
they started the day in different formations — the reports genuinely can't say
which way round they go, and the entry is named on the review list for you to
check.

**If an order comes out wrong, say so.** A formation can be pinned for one
departure, for a whole section, or wherever it appears in the week, so the same
correction only has to be made once. Report the section, the time and the
diagram numbers.

| Column | What it says | Example |
|---|---|---|
| **A** | Time and where it's going | `06 45 CHX` |
| **B** | What the unit is — cars and class | `4 375` |
| **C** | The three-digit diagram number | `117` |
| **D** | **AM** — the unit's next berth during the day | `DFU` |
| **E** | **PM** — where it stands at the end of its work | `SG` |
| **G** | Flag — `SPLITS` or `SPLITS PM` | |
| **H** | Notes — sidings, attachments, end markers, headcodes | `EAST SIDINGS` |

**Times.** A plain space is a passenger working: `06 45`. A **`+`** means empty
stock: `05+32`. That's the usual house convention.

**Reading a row.** `06 45 CHX │ 4 375 │ 117 │ DFU │ SG` says: the 06:45 to
Charing Cross, a four-car 375 on diagram 117, which goes to Dartford Up Sidings
next and finishes the day at Slade Green.

A diagram that goes out a **third** time has two PM berths, and the column
means a different one on each row: the rows before its last journey read the
berth it is sitting on, and the row for that journey reads where it finishes.
Diagram 103 works out of Grove Park, stands at Ashford east sidings from 20 03,
then runs empty to the Folkestone train roads — so its Ashford 05 42 and Grove
Park 16+04 rows read `AFE`, and only its 22+53 row reads `FKE`.

**SPLITS** means the units on this departure part company during the day.
**SPLITS PM** means they only part in the evening — the AM and PM columns tell
you who ends up where.

**Notes** carry the house annotations: which siding a unit comes off
(`EAST SIDINGS`, `UP SIDINGS`, `JUB`…), `ATTACHMENT` when another unit joins the
departure, the end markers where the ends of a train are named for the way out
(`FKE END` / `CBE END` at Dover Priory, and so on), and the headcode in the
sections that quote it.

**A few things are left off on purpose.** Empty moves into a berth with no
passenger work afterwards aren't listed — the same as the hand-built sheets. So
is a unit that stands somewhere for the last time in the day and then runs
empty to a depot without ever being shunted where it stood: that is a wait on
the way home, and the line belongs to the depot it is going to. Any that are
left off are **named on the review list**, so nothing disappears quietly.

**Metro timings.** The Metro book is timed off the **first time the unit moves**.
A unit that runs empty out of the sidings at 05+52 to form the 06 00 off the
platform is listed at **05+52**, with the empty move's headcode, still showing
where the service it forms is going. A train that starts in the platform keeps
its platform time. The Mainline and High Speed books are timed off the platform
call as always.

**Double lines** rule off the breaks in the day's work: the **first** break of
**three hours or more**, and any later one where the work picks up **after
20:00**. So a page can carry two — Slade Green is ruled under its 06+36 and
again under its 18+04 — but a lull in the middle of the afternoon draws
nothing: Tonbridge stands from 11+32 to 14+40 and is left unruled. A page that
is busy right through gets none, and Grove Park is never ruled. The weekend
sheets follow the same rule.

**Printing.** The books come out ready to print — A4 portrait, scaled so all
eight columns land on one page across, with a page break before any section
that would otherwise be split in half. Open **Page Break Preview** in Excel if
you want to see where the pages fall before you send it to the printer.

---

## 9. The review list — always read it

Every build produces a **review list**: everything the rules had to decide for
themselves, named openly rather than quietly guessed at. It's the **Review** tab
on each book, and each book only shows its own fleet's items.

The status line tells you how many there are, and the line above the buttons on
each road says either *"Nothing flagged for review"* or *"3 review items — read
before the sheets go out"*.

Typical items:

* **A location the section list doesn't know.** It gets its own heading in
  alphabetical order and a note. Check it's in the right place — and say if it
  ought to live under an existing section, so the tables can be corrected.
* **Empty moves left off.** Each suppressed move is named with its diagram
  number, so you can confirm it should be off. Only moves that stay inside the
  section are dropped — an empty run that takes a unit to another depot for the
  night is printed, because the section it leaves has to show it going.
* **A unit order pinned somewhere but not here.** Where a formation's order has
  been written down for one departure and this one isn't covered, it says so and
  tells you where the order *is* recorded. Worth a look: it usually means either
  this one needs pinning too, or the working has moved and the existing pin no
  longer reaches it.
* **A diagram whose page didn't read cleanly**, or a date with no matching
  detail report.
* **An end marker with no rule to fit.** Rather than guess which end leads, the
  tool says so and leaves it for you.
* **The Folkestone East Train Roads arrivals**, worked out last-in-first-out
  from tonight's arrivals. Always double-check these against the ACWN.
A clean review list is normal on a straightforward day. A long one isn't a
fault — it's the tool showing its working.

---

## 10. The headcode switches

Once a panel has built something, a box marked **HEADCODES** appears with it,
holding three tick-boxes: **Mainline**, **Metro**, **High Speed**. It only
shows up alongside books, because ticking one rebuilds them.

* **Left off** (how they start) each book follows the house rules — headcodes
  appear only in the sections that have always quoted them: Gillingham, Victoria
  and Grove Park.
* **Ticked**, that book puts **every** headcode in the notes column — empty moves
  and platform starters alike.

They're per book, so you can have all the headcodes on the Metro sheets and the
usual rules on the Mainline.

**You can change your mind after building.** Tick or untick and the books are
rebuilt on the spot — you don't have to drop the files again. Just remember to
save them again afterwards; it'll remind you.

---

## 10a. Long platform stands

Under the **HEADCODES** box, once a panel has built something, there is a
second box: **Platform stands**.

A unit that sits in a platform for an hour or more has arguably berthed
there. The tool handles it in three ways:

* If the report **shunts the unit on the spot** while it stands, that is the
  planners saying it was put away — it gets a line, always. (London Victoria
  22 40 on Sunday 17/08 is one: the unit stands an hour and goes at 23 40 to
  Meopham.)
* If not, the stand is **named on the review list** and left off the sheet.
* Tick **Count long platform stands** to put those on the sheets too. The
  books rebuild on the spot; save them again afterwards.

Only places the books print a page for are considered — a unit standing at
St Pancras or Swanley is not a berthing question.

---

## 11. When something looks wrong

| What you see | What it means |
|---|---|
| *"No Diagram Summary rows found"* / *"No Detail itineraries found"* | One of the two reports is missing or is the wrong kind. Both are needed, for the same date. |
| *"The Summary is from Genius but the Detail is from Integrale"* | The pair have to come from the same system. Two PDFs, or two CSVs. |
| *"…doesn't look like a Genius report"* | The PDF's text couldn't be read — make sure it was saved from Genius, not scanned or photographed. |
| *"…doesn't look like an Integrale export"* | The CSV isn't one of the two Integrale exports. Check you exported the Stock Diagrams list and the Stock Diagram Detail Report. |
| A road says *"nothing to berth"* | No diagrams for that fleet are in the paperwork. Nothing wrong — but in Genius, check a Control Cycle exists for that fleet. |
| A location has its own heading | A unit berthed somewhere the section list has never heard of. It's on the review list; check where it should live. |
| A train seems to be missing | Read the review list first — empty moves into a berth are left off deliberately and each one is named. If it isn't there, note the diagram number and report it. |
| Two units are the wrong way round | Check the review list for *"AM unit positions only"* first — if it's there, the Summary was exported without **File → Session Settings → "Show diagram sections on the diagram summary report"**, and every afternoon formation is in its morning order. Re-export with it ticked. Otherwise: if the review list flagged that entry, the reports couldn't settle it; if it didn't, the order came from the tables and is wrong there — report the section, time and diagram numbers and it can be pinned. |
| *"This Diagram Summary carries the AM unit positions only"* | The Genius setting above wasn't ticked. The books are built, but the afternoon unit order can't be trusted and can't be recovered from what was exported. |
| *"That file is damaged or isn't a Word document"* | Open the prints in Word and re-save as `.docx`, then drop the new file. |
| *"That looks like a reissue on its own"* | Drop the full weekly prints with it, or first. |
| *"…belongs to a different day"* | The reissue's date doesn't match the prints it was dropped with. |
| The page says the browser is too old | Right-click the file → **Open with** → Edge, Chrome or Firefox. |
| Nothing happens when you drop a file | Click the panel instead and browse for the file — some setups block drag-and-drop. |

---

## 12. Before the books go out

* **Read the review list.** Every time. It exists to be read.
* **Check the sheets against the ACWNs** — especially the Folkestone East Train
  Roads notes, which are worked out from last night's arrivals and flagged for
  exactly this reason.
* **Check the date on the tab** matches the day you meant to build.
* Remember this is a **drafting tool**. It applies the house rules faithfully and
  tells you where it had to make a call — but the books are yours, and a human
  signs them off.

---

*Questions, or a rule that doesn't match how your patch does it? Say so — the
rules live in one place and can be corrected.*
