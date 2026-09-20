# History

What changed, release by release, and why. The README describes the tool as
it is now; this file keeps the story of how it got there, so the README does
not have to.

## Diagram analyser 1.8.0 — 8 September 2026 — a diagram is not a day

**"Days back to depot" counted a day for every diagram.** A unit that took
one diagram into a place at ten in the morning and another out of it at two
in the afternoon was charged two days for what the plan does in one. It
counts DAYS now: a night standing about costs one, a second diagram the same
day costs nothing, and a diagram can only be taken if it leaves at least an
hour after the unit got in.

Two things that took a second attempt. The dominance test that stops the
walk going round in circles has to compare **both** the days and the time —
a route that took a day longer but gets in EARLIER is not beaten, because it
can catch a working the quicker one had already missed. Pruning on the time
alone lost routes; pruning on the days alone lost more. And the count is
days from being *left* to being *home*, so a single diagram is one day, not
nought.

On the MAY26 books this changes none of the answers — no route home there
benefits from a same-day second diagram — but the mechanism is right and
pinned, with the case that needs it and the case that cannot use it.

**And a note on RM302**, which prompted this. It really can get from
Faversham Back Road to Ramsgate in one diagram, arriving 10:23 — but that
printing is valid **11/09/2026 to 09/10/2026**, and the reference week the
prints resolve to is the week of 24 August. On that week the Friday RM302
goes to Gillingham and the Sunday one to Ashford, so three days is the right
answer *for that week*. Answering it for a later week needs the reference
week to be choosable, which it is not yet.

## Diagram analyser 1.7.0 — 8 September 2026 — a tab per book

**The four books are tabs of their own** — **Mon – Thu**, **Friday**,
**Saturday**, **Sunday** — above the questions on every fleet card. They are
different plans: a Saturday's arrivals have nothing to do with a Tuesday's,
and 1.6.0 put them in one table where they answered neither.

Picking a book moves **every** card, because somebody working through a
Saturday wants every fleet's Saturday, and cards left on different books read
as one answer and are four. The question stays where it was — the reader is
asking the same thing of a different day. The four partition the week
exactly: for the 375, 119 + 101 + 101 + 101 = the 422 the whole week holds.

**The mileage is deliberately not split**, and says so on itself. A unit's
clock does not care which book it was working, so that one table stays the
whole week whichever tab is picked — checked on all four in the browser
smoke, because it is the kind of thing that would drift silently.

Two things the split showed up: the ledes said "On a Monday" whatever book
was open, and the reference day for a book has to be a day inside it, or the
Saturday card counts a Monday.

## Diagram analyser 1.6.0 — 8 September 2026 — the whole week, and the sum shown

**The tables were one reference Monday.** Every one of them — arrivals home,
home before eight, attendable stands, restricted units, cannot-contain, the
place codes, the full diagram list — was built from the diagrams running on
one Monday. The Friday, Saturday and Sunday books were never on the page at
all: a unit that only comes home on a Saturday was missing from arrivals, a
stand long enough to work on that only happens on a Sunday was missing from
the attendable list. They are built from the whole week now, and each row
says which days it runs, which is what the Runs column has always shown.

**And a diagram number is not a day's work.** Folding the week together by
diagram number looked right and was not: in the MAY26 books **322 of the 324
numbers are printed several times over** — AZ601 has an FSX version, an FO
version, an SO version and a Sunday one, four different days under one
number — so keying on the number kept whichever was read first and lost the
other three. Keyed on the number *and its day code*, the 375 goes from 101
rows to 422, the Metro from 134 to 604. A code that covers several days is
still one row: an FSX diagram does the same thing on each of Monday to
Thursday.

**The sum is on the page.** A new working under the mileage section, six
numbered steps with this week's own figures in them, so the arithmetic can
be followed by hand or held against a sheet worked out another way:

| | | 375/6 |
|---|---|---|
| 1 | Miles the sub-fleet runs in the week | 193,305 |
| 2 | Units the depot owns *(a setting)* | 75 |
| 3 | Miles per unit in the week — 1 ÷ 2 | 2,577 |
| 4 | Running days in a year — 52 weeks less Christmas Day and Boxing Day | 362 |
| 5 | Weeks in a year — 4 ÷ 7 | 51.7143 |
| 6 | **Miles per unit a year — 3 × 5** | **133,288** |

with the per-diagrammed-unit figure beside it for comparison, and the check
that the plan cannot need more diagrams than the depot owns units.

## Diagram analyser 1.5.0 — 8 September 2026 — the maths, the rules, and a new page

The analyser carries its own version. This is the overhaul asked for on it.

**Mileage was divided by the diagram book, not the fleet.** A diagram book
has no spare and no exam float in it, so a plan needing 27 diagrams is
worked by the 30 units the depot owns, and every per-unit figure came out
too high by the float. The depot's own sizes now ship as the divisor, and
both figures are shown — per diagrammed unit is what a unit in traffic
does, per fleet unit is what a unit on the books accrues, and the second is
the one exams are planned off.

Two of the depot's rows do not map one-to-one onto the labels the prints
use. `375/6` is the 375/6/7/8 group. And `465/9` is every 465 diagram: the
depot owns 94 of the /0 and /1 and 25 of the /9, but the busiest day needs
97 diagrams labelled 465/9, and 25 units cannot work 97. That check — a
plan can never need more diagrams than the depot owns units — is now in the
tool, on the front of the card where it is read.

**Annualised on 362 running days**, not 365.25: 52 weeks less Christmas Day
and Boxing Day, which is how the depot's own sheets count the year. Worth
0.9% on every annual figure.

**Splits and attaches, to the berthing sheets' rules.** The analyser scanned
for DETACH rows and counted the place. It reads the formation column now, so
who parts from whom is the unit that drops out of it — RM007 parts from
RM006 at Victoria and again at Dover Priory while RM008 stays coupled
throughout. A pair that detaches and re-attaches but runs the same path to
the same berth never really parted and is left out.

**A section of its own for the AM/PM case**: units that leave the depot as
one, are put away together, and only come apart after that. 34 of the 298
partings in the MAY26 books are that kind.

**The whole week.** Partings are walked over all seven days rather than one
reference Monday — 17 on the Friday, 40 on the Saturday and 21 on the Sunday
were not on the page at all.

**A new page.** The same furniture as the berthing sheets, because they are
two halves of one thing: the navy masthead with the fleets actually dropped
drawn on the rail, the departure-board status strip, and a card per fleet
with its questions on tabs instead of nine sections down a page nobody
scrolls to the end of. Fleet sizes are editable beside the depots. The
place-codes key is the last tab — it is what a reader turns to when a code
on one of the others is unfamiliar. The unit drawings now live in
`src/sprites.js` and both builds include them, rather than a second copy
drifting from the first.

## 3.14.0 — 20 September 2026 — the plan back in the workbook's shape, the Metro Telex, and Excel

**The workbook's own shape.** The plan is read as it was pasted — the
section titles, the heading rows, the blank rows between groups — and
goes back the same way, five columns with the request in the Action
column, so *Copy the plan back* pastes over the Maintenance Plan tab
from A1. The Why column stays on the page and in the text file.

**Save as Excel.** The same plan as a workbook, written by the sheets'
own writer: a *Maintenance Plan* sheet in the tab's shape and column
widths, every cell text so a unit number and a time paste as typed, and
a *Why* sheet beside it.

**The Metro Telex.** The Metro Stock Telex pastes here too, and is read
by its own headings — *Unit Nr.*, *Exam*, *Slot*, *Location*, *Action* —
the depot from the section it is under (Slade Green, Gillingham) or its
Where column, a Networker or a 707 with neither being Slade Green's or
Gillingham's, and the Location column placing a unit no report has, on
the road it names (PLU, GPU, GPS, GPD, SGU, VICS, ORPS, DFD DOWNS, BGM).
Which workbook it is is read from the paste, or set with the *Workbook*
choice. Its requests are written the Telex's way, off the Metro sheet's
own lines: *BERTH 05+37 (3M08)*, *GPU - BERTH 05+03 (5F08)* where the
road is not the line's own Location, *HOLD FOR EXAM*, the London end,
country end or middle for a portion, *SG PM* for where a unit ends; one
working a line, two at most. The rules behind the Metro requests are
the Mainline ones for now, and read against the Sunday Telex they land
on the same working where the Telex names one off the unit's own road
and differ where the Telex names a working for its own reasons — the
next calibration.

## 3.13.0 — 20 September 2026 — four days, slow down, and the XS50s

**Four days.** A request is made for anything due within four days, not
three: the planner asks for a Thursday exam on the Sunday night.

**Slow down.** A line whose job says *SLOW DOWN* — an H2H with a slow
down on it — is asked for whatever the date, and its list is the diagrams
with the fewest miles first, off the Detail's own mileage column, the
miles said in the Why. That is what the planner was doing by hand with
*RE BERTH 06 02/06 20/06+20/07 02* twelve days out.

**The XS50s.** The XS50 campaign on a 376 is done at Slade Green or
Gillingham, so a line for either depot is answered at both. Which unit
takes which departure is the depot's: the campaign is mileage-based and
the miles are not on any report.

## 3.12.3 — 20 September 2026 — contained

**Contained.** A unit with a multiple-only restriction and days to run
does not have to get home: the planner contains it, on a multiple
diagram off its road, even one that ends back where it started — *05 55
VIC* out of Ashford, which comes back to Ashford at night. The road now
offers those after the departures that do get the unit home or nearer,
saying *contained — in multiple to AFK 22+00*. And multiple only means
the diagrams get there together, the same place at the same time: 5A08's
two portions come into Ramsgate at 21+16 and 01+41, so it is not offered
to a restricted unit, which the Telex bears out.

**Two 05 55s.** Where the sheet prints two departures at the same time
out of a place, the request tells them apart by where they go, off the
book's own destination column — *05 55 VIC*, *05 55 RAM* — whether or
not both are on the list.

## 3.12.2 — 20 September 2026 — THEN the next leg

Where a request takes a unit to a nearer depot on its way home, the next
leg is written after it, the way the plan writes one: *TON BERTH 06+00
THEN AFK BERTH 15+00/5R51* — the PM workings out of that depot that get
to the one wanted, and the standing fleet move. Only where every
departure listed tracks the unit back through the one depot; a list that
mixes a direct working with a nearer depot keeps the next leg in the Why
column, as before.

**Multiple only on every line.** A unit with a multiple-only restriction
on one line carried, on its other lines, a request worked out without
it — a diagram on its own, or a portion that runs on alone. Multiple
only on any line is now multiple only on all of them, in the lists and
in the swaps. That is what makes 375625's three lines read *RE BERTH
06 02/06+20/07 02*, as the Telex has them.

## 3.12.1 — 20 September 2026 — the roads as the depots work them

The planner's answers on the roads. Ramsgate is one road: the staff shunt
depot to station, so a departure off the platform is a depot unit's too,
as it was before 3.12.0. Ashford's Down Sidings and East Berthing are
connected, and so are Grove Park's roads: a unit's own road comes first
in the list and the other roads' departures follow it, marked as a shunt
across, rather than being held back until its own has nothing. The Up
Sidings at Slade Green and at Ashford stay strict. Tonbridge is not one
road but three — the Jubilee Sidings, the Down Main sidings and the
platform — and is worked like a depot's roads. And two departures
that print the same time are told apart by where they go — *05 55 VIC*
and *05 55 RAM* out of Ashford — the way the Telex writes them, off the
book's own destination column.

## 3.12.0 — 20 September 2026 — the road it lands on

**Off the road the unit landed on.** A unit in the Up Sidings at Slade
Green goes out on an Up Sidings diagram, one in Ashford's East Berthing on
one of the East's, one in the Grove Park Down Sidings on a Down Sidings
departure — the depot can divert it, but from where it stands. The road
now reads the finishing location off the Allocation Summary and lists
that road's departures; another road's are offered only where its own
has none, and marked as a shunt to check with the depot. Against the
Sunday Telex that is what turns the Grove Park list for the Down Sidings
376s from nine headcodes into 5N08/5N18/5N17, and the Ramsgate list into
the four the Telex has, the station-platform start set aside. An
outstation — Dover, Tonbridge, Faversham — is one road: its sidings feed
its platforms, so the 04 50 off the Dover platform is still the request
for a unit in the sidings. Ramsgate depot and station, and Ashford's Down
Sidings against its East Berthing, are the two the planner has been asked
about.

**One working, named once.** A diagram that starts at the place — 5N17
out of the Down Sidings at 05+48, back into the Up Sidings at 09+20 and
out again at 13+45 as 5F43 — was listed twice, by its start and by its
PM leg. It is named by its start alone.

**No more than the depot can use.** Where a road has more departures
than units standing on it, the best three are named and the rest kept in
the Why column: back nearest the time it is due where there is one; on
hand by 16 00, for the day shift, for ASAP, a mileage trigger or a
defect; otherwise into the depot over a stand, a call or a nearer depot,
earliest out first. A road with as many units as departures lists them
all, as the Telex does for the six 377s at Ashford.

**The metro fleets and the 395s.** Orpington and Dartford are places the
road knows, with their sidings and stations, so a Networker berthed there
is placed and asked for; a Networker or a 707 is Slade Green's or
Gillingham's for a defect; a 395 is Ashford's, and two of them make a
12-car. The High Speed diagrams are on a separate control cycle, so a
395 is placed by the Allocation Summary but its departures need the High
Speed Summary and Detail dropped as well, which has not been tried.

## 3.11.0 — 20 September 2026 — the requests as the Telex writes them

**Lists of departures, not a single working.** The planner's own Telex
writes, against a unit at West Marina wanted at Ramsgate, *XSE BERTH
06+13/06+23* — every morning departure out of the place that gets the
unit to the depot, the depot to choose — and the same list against every
unit standing there. Read against the Sunday night's Telex and the three
reports it was written from, the road now writes the same: the morning
departures out of where the unit is whose diagram ends at the depot
wanted or stands there, calls in the morning at its station or terminal
where the unit can be taken off, or ends or stands two hours or more at
a depot nearer — Grove Park for Ramsgate — from where it is sent on, the
line then saying what that depot has on. The six Ashford departures the
Telex lists for every 377 bound for Selhurst are the six the road lists,
and the four Ramsgate departures it lists for a unit at home for
Wednesday are the road's four, because a unit at its own depot not due
tomorrow goes out on a **peak diagram** — one that stands at Grove Park
or Victoria through the middle of the day — and is brought back the night
before; due tomorrow afternoon it is offered the departures back by then,
*RE BERTH RP 05 25*. Nothing is claimed: every unit at a place gets the
list, and a departure already on another unit's list is said to be. A
375/9 and a plain 375 count as one fleet in a list, as the Telex has them.
Multiple only needs two diagrams or more of the train to get there
together, which is what cuts the Ashford list down to the three the Telex
gives a restricted unit. The two-leg request is gone — the Telex writes
the one leg and asks for the next the night before — and *TON BERTH
06+00* carries *then AFK has 15+00, fleet move 5R51 22+31* as its note.

**The plan's own words kept.** A unit the plan has *STOPPED RE* or
*O/H FKE* keeps that, as the Telex does, and every line of a unit
carries the one request its first line got — a hold, a list or a swap —
the way the Telex writes one Action against all of them. On the Sunday
night a Monday hold is a plain *RE HOLD*, the *FOR MON* form being
Friday's and Saturday's.

**Two things the reports hid.** The Slade Green station and the Victoria
sidings were counted as a stand at the depot — the first because the
station shares the depot's codes, the second because Selhurst's list of
codes overwrote Victoria's — so a diagram out to the platform read as
back at the depot two minutes after it left. A stand at home within two
hours of leaving is now the shunt out to the platform, not a return.

**On the page.** The berth tab's drop zone names the Allocation Summary,
which is the report that says where each unit is tonight. The
*Always double-check* note in the footer is about the books, so it is
shown on the two book tabs only. And the *If a build looks wrong* list in
the how-to fold sets its entries in two columns on a wide screen instead
of leaving the right half of the panel empty.

## 3.10.0 — 20 September 2026 — named as the sheets print them, three days, and the Action column

**The depots work from the sheets.** A request now names a working the
way the berthing book prints it. The books are built from each day's
Diagram Summary and Detail dropped on the tab — the weekday tab's own
where they are built — and the request is the line the depot reads: by
headcode where the book carries one, by the time the train leaves the
platform where it does not. West Marina's 5H91 is *06+13* on the sheet,
off the platform, where the Detail's sidings departure said 06+01; that
is the difference a depot notices. Where no book could be built — a
weekend's pair, or a Detail on its own — the Detail names the request by
the same rule, and the review says which.

**Three days, then nearer.** A request was made for anything due within
six days, so on a Saturday night a 377 due at Selhurst on the Friday was
given the move over. The planner's own plans ask one to three days ahead
and write where the unit ends beyond that. So: due today or tomorrow, a
hold or a request; due within two days, brought home, in two legs where
one will not do; due in three, moved as near as it can be got — Ashford
for Ramsgate, Grove Park for Victoria — with the last leg left for the
day before, *XSE BERTH 06+13 TO GP*; later than that, where it ends. A
unit is wanted at Selhurst on the day or the day before, not sooner, so
the move over is asked for only when the line is due today or tomorrow;
further out the request gets it to Victoria and the move is a note.

**The Action column.** The suggestion is written into the plan's own
Action column — in bold where it differs from what the plan had — and a
*Why* column beside it carries what the plan had, the reasons, and where
the unit is today. Copied back, the Action column pastes straight over
the workbook's.

## 3.9.0 — 20 September 2026 — a second copy, three audits, and the page read through

**Two copies of the tool.** `Sheets Generator (no berth requests).html`
is the same build with the experimental *Berth requests* tab cut out —
its tab, its panel, its module and its lines in the how-to — for the
copy handed to people who should not meet a feature still being proved.
Same version stamp, so a fault reported against either names the same
code. The page's remembered tab is honoured only when this copy carries
it, since both copies share the browser's memory; before that, a tab
remembered from the full copy hid every panel of the other.

**Three audits, and what they found.** The berth-request road, the
engines and the page were each read through for faults, dead code and
waste, and the real reports were driven through every tab in Chromium
with the console watched. Fixed:

- A unit on two defect lines of one kind for one date came back with
  one of them missing — the export's rows were matched to the plan's by
  a key that could hold only one line. Both lines come back now.
- A weekend hold for a Selhurst unit lost its Monday when the move was
  named: *VIC HOLD FOR MON - 5Y41* keeps both.
- A request claimed on tomorrow's 5H91 used up today's 5H91 as well:
  claims name the day now, so today's train and tomorrow's are two.
- The printed Allocation Summary dropped every unit that finishes on the
  diagram it started on, because the reader insisted on a finish
  diagram that is blank in that case.
- A plan date with no year, read from a late-December report, is next
  year's, not eleven months overdue.
- A section title with words after it — *Exams — wk 39* — is still the
  Exams, not a section of its own read with the wrong columns.
- On the berth tab, a slow read could finish after a later drop and put
  stale reports back; every drop and chip goes through one queue now.
  A tick on *A day still to run* set by hand is no longer reset by the
  next drop. Reports that could not be read are no longer quietly
  replaced by the weekday books' pair. The drag-over highlight was
  missing on two of the four drop zones.
- The Integrale Summary reader took `8:34:00` — an export that has been
  through Excel — as 04 34; it reads it the tolerant way the two sibling
  readers already did.
- An order correction applied through a superset order was reported as
  having matched nothing.
- The High Speed sheet's *last night's arrivals* came from the previous
  day in the build, not the previous calendar day, so a Wednesday and a
  Friday built together made Wednesday the night before Friday.
- The Rules tab said the Metro AM/PM sheets split at 20 00; they split
  at 10 00, and now it says so.

Removed as dead: an unused code table and PDF wrapper in the shortages
road, three exports nothing called, and a comment describing a layout
that no longer existed. Regexes compiled per cell of the preview and per
paragraph of a Word document are compiled once. Measured on the real
reports, nothing was slow: the berth road answers 115 lines in about 70
ms, the weekday books build in half a second, so no engine was
restructured for speed. The largest functions — the weekday day builder
at 900 lines, the weekend generator at 400 — were left as they are, on
purpose: they are golden-tested against the frozen legacy build and
carving them up is a job for a release of its own, not a clean-up.

**The page read through as a user.** The four tabs now follow one shape:
what the tab needs, the drop zone, the status board, the options, the
output, the rules. The *before you export* note and the berth tab's
warning sit above the drop zone they govern, not below it. Every options
row is labelled *Options*, says that a tick rebuilds, and is hidden until
there is something to rebuild. The berth tab has a proper action row —
*Read the plan* and *Start over* — under its boxes, a summary line under
its drop zone in place of a drop-zone label that changed to a report
summary, and a view button that says what it will show next. Status
lines say what to do next, and a report that could not be read says what
to do about it. The how-to names all four tabs. The tab strip takes the
arrow keys; the chips say what removing them removes; the exam colours
on screen clear the contrast line the workbook's own do not; printing
either list prints the list and not the boxes.

## 3.8.3 — 20 September 2026 — two legs, the fleet moves as requests, and Selhurst

Two of the planner's own filled plans, a Tuesday's and a Thursday's,
set the form. They write *GP BERTH 5F42 - VIC BERTH 5Y50* and *VIC BERTH
5Y29 THEN 5N46/5Y94/5Y96* — a request in two legs; *SG BERTH 5L17
RETIMED TO 11+10* — the standing fleet move as the request; *VIC HOLD
FOR 5Y50*; and *ENDS GP AM* for a unit into Grove Park in the morning.

**Two legs.** Where nothing out of the place a unit is at gets to the
depot, a working out of there that gets to another depot is asked for,
and the second leg is what that depot has once the unit is there: the
working that stands there and goes on to the depot wanted (its PM
departures), the standing fleet move out of it, or failing those the
next morning's departure with the same Detail standing in. *TON BERTH
06+02 - GP BERTH 5U02/5F85/5F87*, *XSE BERTH 06+13 - GP BERTH …*. The
first leg is claimed like any request, so two units are not handed the
same train. On the Saturday reports this took a dozen lines from *ENDS*
to a request.

**The fleet moves are requests.** A unit at a depot with nothing on the
Detail out of it is given the standing fleet move that runs that day —
*SG BERTH 5L17/5L19/5L92*, *AFK BERTH 5R51*, *GP BERTH 5G70* — where
before the move was a note under *ENDS*. A move on the Detail's own
departures still comes first, so *GP BERTH 5F87* does not grow a *5R00*.

**Selhurst.** A line for SU never matched a working into Victoria,
because a Victoria code reads as VIC and the target read as SU: no 377 at
Ashford was ever given the way to Selhurst. Selhurst is reached at
Victoria and the fleet move takes it over, so the line is answered with
what gets the unit to Victoria and the move: *AFK BERTH 06+17 - VIC
BERTH 5Y41*, *VIC HOLD FOR 5Y41*.

**One request per unit.** A unit on an exam line and a defect line was
given a train on each — two trains it cannot both be on. It is asked for
once, on the line that comes first, and the other line says *asked for
on its other line* and names the request.

**ENDS GP AM.** A unit into a depot between 03+00 and midday that sits
there is written the way the plan writes it.

## 3.8.2 — 20 September 2026 — why a line gets no request, and the day in between

**A line with no request says why.** Run on a Saturday night with the
day's allocation and Monday's reports, the tab answered a third of the
plan with *ENDS XSE* or *ENDS HGS* and a note that said *no call at RE
today* — true of a unit that never ran, and no help. Each now says what
was looked at: *no request at HGS — none are made there*, with the train
out of Hastings that would have done named all the same; *Monday's 5H91
06+01 (RM059+RM060+RM920) already asked for by 375617, 375616 — nothing
else out of XSE gets to RE*, where seven units stood at West Marina and
the one train out of it to Ramsgate had two portions; or *nothing out of
TON on Monday's Detail gets to RE*. A unit on several lines is asked for
once, on the line that comes first, and its other lines point at that
request instead of reading as nothing. The day is named — *Monday's
5H91* — where the Detail is two days on, not *tomorrow's*.

**The day in between.** Saturday's allocation with Monday's Detail leaves
the Sunday blank, and the review now says so: every unit is taken to
stand where Saturday leaves it until Monday's departures, and one that
works on the Sunday will not be there. A unit the Sunday's own
allocation does place is placed by that, the latest word on it, and the
line says which day placed it. An Allocation Summary printed before its
day was allocated — eight units on it against 233 — is named as that
rather than taken as the day.

**Every road of the depot.** A unit in the Up Sidings at Slade Green was
offered only the departures out of the Up Sidings, and one on the
platform at Ramsgate only those off the platform. They are the depot's
to move: the request is *SG BERTH* or *RE BERTH*, off any of its roads.

## 3.8.1 — 20 September 2026 — the Allocation Summary, and the tab's introduction

**The Allocation Summary places the units.** A row per unit — the diagram
it starts on, where and when, the diagram it finishes on, where and when
— read as the CSV export or the print. Dropped with the Diagram Detail
and no Diagram Summary it places every unit, and the line says *placed by
the Allocation Summary*; dropped beside a Diagram Summary it fills in any
unit that Summary has no row for. A unit that starts on one diagram and
finishes on another is read as two segments, the second beginning on the
finishing diagram's first call after the first has ended, and a segment
the Detail has no calls for still ends where its row says. The reader
now takes a Detail on its own, for this. It is read for its own day:
today's allocation dropped with tomorrow's Summary and Detail makes
today the allocation's day and the departures tomorrow's (the day turn,
with the allocation in place of the evening Summary), and one for any
other day places nothing and is named in the review, not dropped
silently.

**The tab's introduction was a column of text down the left** with the
rest of the width empty and a paragraph that had grown into a wall,
unlike the other three tabs. It is laid out as they are now: a short
paragraph saying what the tab is for, the drop zone, and under it the
warning as a bar the full width of the page — the weekday tab's *before
you export* bar, in red. How it works, with the turns as a short list,
folds away under *How it works* the way the Shortages tab's *what this
list is working from* does; and the two ticks under the button stand
together.

## 3.8.0 — 20 September 2026 — a day still to run, and the weekend prints

**A day still to run.** Where the reports are for a day that has not run
— the Summary for today or a day to come with everything allocated, the
day after Christmas say — every unit is where its first working starts,
and any diagram starting there that gets to the depot is a request before
it goes out, in place of what it is on: *before it goes out: today's 2R21
05 27 from AFK*. A tick on the tab, set when the Summary's date is today
or later and there for the planner to untick for a day already run. A
swap on the day still comes first; the start of the day comes before
tomorrow's departures.

**The weekend diagram prints stand in for a Detail.** The Word prints the
weekend tab builds from can be dropped on the berth tab with the Summary:
each diagram's calls are read for the date the print is from, through the
weekend engine's own reader, and the print's short place names — *Ram
Depot*, *G Pk Dep*, *St L Shed*, *Ashfrd DS* — become the Genius codes
the road works in. A place with no code keeps the print's name on the
line. Each print has its chip like any other report.

## 3.7.2 — 20 September 2026 — a unit on no working, and a Summary allocated in part

**Where the plan says a unit stands.** A Summary printed before the 375s
were allocated — the 20/09 print, run at 20:55 on the 19th, had units on
38 of 167 workings, all of them metro — put every 375 and 377 on the plan
on no working it knew of, and the road said *not in traffic* and nothing
else. Two things now. The Review says which diagrams have no units yet,
by prefix, and that today's Summary printed after allocation is what says
where each unit ends. And a unit on no working takes its place from the
plan's own Action column — `STOPPED RE`, `O/H AFK`, `SP @ GP`, `ENDS
DVP`, `RE HOLD`, `GP BERTH 5N32/5F28` — and is answered from there: `AT
RE` where that is where it is wanted, and otherwise tomorrow's departures
out of that place, the line saying *not in traffic — at AFK per the
plan*. Nothing said, nothing known: `NOT IN TRAFFIC`, as before.

## 3.7.1 — 20 September 2026 — requests for the week, and the reports taken off again

**A line due this week gets a request too.** Only the near lines — today,
tomorrow, ASAP, overdue, the coming weekend and Monday — were given
requests; the rest of the week got *ENDS* and a unit ending where it was
wanted tonight for a Tuesday exam was told it ended where it was wanted,
which on a Saturday evening was true and useless: it works again before
Tuesday. A line due this week is now given a request — a swap today or a
departure from where it ends — after the near lines have had theirs, and
the line says when it is due. It is not held: *where it ends tonight, not
yet a hold*. A week and more out is still where it ends.

**The next day the Detail is for.** Tomorrow's Detail was taken only when
it was for the day after the Summary's, so a Friday Summary with a Monday
Detail read as no Detail at all. The first Detail date after the
Summary's is used, and the Review says how many days on it is.

**The reports dropped on the tab can be taken off again**, one at a time
or all at once, without losing the plan and defects already pasted — to
swap tomorrow's Detail for another day's, say, where before it was a
refresh and paste everything again. A PDF is read once, for its chip and
for the road alike.

## 3.7.0 — 19 September 2026 — the Summary PDF's units, the two turns, and the Excel text box

**The Summary PDF never gave up its units.** The berth-request road looks
a unit up on the Summary's UNITS column, and the PDF reader read every
column but that one — only the CSV reader did — so a Summary printed after
allocation as a PDF said every unit was *not in traffic today*, and the
Review then said the Summary had no units on it, which it had. The PDF
reader carries the UNITS cell now, "375609." or "395011, 395023.", the
same as the CSV.

**The two turns.** The tab takes the Summary printed after allocation with
the Diagram Detail for today, tomorrow or both, or the Summary alone. A
Summary on its own says where every unit ends tonight — it has a row per
working segment with the unit on it — and the Review says a swap cannot be
seen without a Detail. On the day turn, today's Summary with *tomorrow's*
Detail gives tomorrow morning's departures out of wherever each unit ends,
as its own diagrams and not today's taken as a proxy. On the night turn,
today's Summary with today's Detail: a unit whose allocation finishes
between 09+00 and 16+30 is on hand at a depot, and the departures it is
offered are those between 09+00 and 16+30 first. Tomorrow's diagrams come
with no units and no fleet, so the fleet is read off the diagram code and
the line says *not yet allocated*.

**Shortages: one shortage, however many diagrams it passes through.** The
missing portion of the 1H13 on RM023 is the same missing portion of the
1R32 on RM056, so it is one lettered item, `(RM023/RM056)`, the diagrams
in the order the shortage passes through them, ending on its final
affected working, every service under it in time order. The report-time
window still decides whether it is raised, on the same rows as before;
raised, the whole of its life is shown. Where the effect is the same on
every service the heading is the formation, `4.375 V 8.375 (RM023/RM056)`;
where it changes — some 4 V 8, some 8 V 12, a cancellation — it is
`4.375 SHORTAGE (…)` with a FOLLOWING line per effect. Fleet-mismatch
detection, the reciprocal cancellations, the endpoint, window and
destination-sorting rules are as they were.

**Shortages: laid out for the Excel text box.** The lettered list is
pasted into a text box 20.19 cm wide in Calibri 11 bold, and Excel is not
left to wrap it. The letter and bracket, then four spaces' worth, then the
text; a blank line before a FOLLOWING, which sits seven spaces in with the
first service straight after it; a service is one thing and never breaks
across two lines — one that will not fit goes whole onto the next line,
directly under the first service; in the fleet block the letter stands
against the first line only and every other line starts where that one's
text does. The lines are measured in the browser in the face they will be
read in, and estimated for Calibri Bold 11 where there is none; the copy
carries the breaks and indents as non-breaking spaces, and the preview
shows the list at the box's width. TUNWELL is TBW and PKWD is PDW, as
before.

## 3.6.1 — 19 September 2026 — one train, the three rules that were to come, and no notice at a depot

**A unit's day is its own segments.** The Diagram Summary has a row per
working segment of a diagram, each with the unit on it — RM912 is 375609
up to Grove Park in the morning and 375827 out of it in the evening, the
unit changing at the depot's AM/PM berth. Everything before this read the
whole diagram as one unit's day, so 375609 was said to end at Ramsgate at
19+54 when it ends at Grove Park at 09+54. A unit's stops are now the
Detail's cut to its own segments, one stand where a segment ends and the
next begins at the same place, and a unit on hand at a depot from the
morning is offered the working out of it that goes home — `GP BERTH
5J93/5F87` — displacing the unit the Summary has on that segment. A
diagram the unit was on in the morning, that another unit takes home, is
a way home too.

**One unit per diagram, and a working is one train.** 3.6.0 read the
Summary's UNITS column as a formation and counted a working's requests per
diagram, so `5F87`, run coupled by three diagrams, was given four — on a
12-car. A diagram carries one unit; a 12-car is three diagrams on one
working. The count is now per working, off the Detail: it carries a
request per diagram on it, never more than a 12-car of that unit's kind —
three 375s or 377s, two 376s, four 3-car 375/3s — and the line says `5F87
runs as 3 units (RM912+RM913+RM914) — request 2 of 3`. A restriction is
checked the same way: MO wants a train of two diagrams or more, NM a train
of one.

**Formations kept together.** A unit whose formation-mate — a unit on a
diagram coupled with its own on the working it arrives on — has already
been given a working goes with it, so a 12-car that arrives at Grove Park,
Ashford or West Marina as one train is not asked to go three ways for
three requests. Where a request does take one unit off the train it
arrived in, the line says so — *splits the 3-unit formation it arrives in
— 375702+375712 left* — so the depot is asked to split a train only where
there is need.

**A split after the swap point no longer refuses the swap.** 3.5.0 would
not put a unit onto a diagram that attached or detached after the swap
point. RM912 attaches RM913 at Grove Park at 16+25, which refused the very
AM/PM request the depot makes every day. An attach after the swap is
nothing to it — the unit is on the diagram and goes where it goes — and a
detach after it is answered by naming the portion; such a diagram ranks
after a clean one, and the line still says where it splits. And a unit
that goes into a depot on one road and out on another is one stand there,
in on the first working and out on the second.

**The portion.** Where the working named runs as a coupled train that
splits before the depot and only this diagram's portion goes there, the
request says which, off the Summary's POS: the lowest position leads and
is `FP`, the highest is `RP`, anything between `MP` — `GP BERTH 5J70/RP
5F87`. Position is the order the formation left its berth in, so a train
that has turned since is still the planner's check.

**Tomorrow's working from where it ends.** A unit that ends tonight at a
place with a berth and is wanted at a depot nothing today reaches is
given the working out of that place tomorrow that does, named the way
that place names workings and with the portion — `AFK BERTH RP 05 27`.
Tomorrow's diagrams are on no report read here, so it is taken as today's
Detail has it and the line says to check tomorrow's runs the same. It
comes after a swap today and before a depot swap with no place to make
it.

**A request is made where the unit is.** 3.5.0 named a working "for a
depot swap" even where the two were never at the same place, and the
line said *no shared terminal*. Nobody can action that: the depot has
the unit it has. A request is now a swap at a place both are — a
terminal changeover or a depot's AM/PM berth — or a departure from where
the unit ends tonight, and a working with no place to make the swap is
not named, however well it ends.

**The depot request names the departures only.** The depot has the
arrival on its own allocation summary, so `GP BERTH 5J93/5F87` — in on
the first, out on the second, which is how 3.5.0 read the plan's own
`GP BERTH 5N32/5F28` — is now `GP BERTH 5F87/5F85/5F91`: every PM
departure out of the depot that ends where the unit is wanted, for the
depot to choose from, and the line says which unit comes off each and
what it takes instead. The same for tomorrow's departures out of where a
unit ends: `AFK BERTH RP 05 27/06 12`.

**No changeover notice at a depot.** The request is all: the unit went
to Grove Park empty in the AM and sits there to the PM, so it ends GP in
the AM and there is nothing to change over. The notice is written for a
changeover at a terminal only.

**Swapping exams.** When the requests run out for an exam that is near,
the exams are swapped around: another unit on the plan whose exam is due
later and that does end at the depot tonight has its exam brought forward,
this one's put back. The same exam first, then the one due soonest after;
never a unit that other maintenance wants somewhere else now; each unit
once. Written out under the table as `EXAM SWAPS`, and both lines say so.

**A restriction is a formation.** `MO` is read as *multiple only* and
`NM` as *no multiple* — the export's own faults say so: every NM is a
coupler fault, every MO a cab, a traction module or a toilet the other
unit covers. A working offered to an MO unit runs as two units or more;
one offered to an NM unit runs as one and never attaches. Today's own
diagram is checked the same way and the line says *check* where it does
not fit. Which routes a unit may not take is still on no report.

**NM is no multiple on one end.** Not a bar on coupling, as 3.6.1 first
read it, but a coupler fault at one cab: the unit can run coupled, not on
that end, and which end couples is on no report. So an NM unit is offered
workings that couple and the line says *check which end couples* wherever
one does, today's own included. MO stays multiple only, and POS 1 stays
the leading portion, both confirmed by the depot.

**Keep trains together, and the places that cannot split.** A toggle on
the tab: ticked, at every outstation and depot alike, a request that
splits the train a unit arrived in comes only after every one that does
not. A formation whose units are all wanted at the same depot, on a train
with room for them, is not a split at all — they go together. And with or
without the toggle: no request is made at Folkestone East or Hastings,
there being nobody there; at Faversham a train can be requested but never
split down.

**MSE attending.** A box beside the defects: the units listed get
`MSE ATTENDING — NO REQUEST`, and the units the export flags MSE are named
under the box once the plan is read, so the question is answered by
listing them.

## 3.6.0 — 19 September 2026 — the defects export, and who goes first

**The defects export is pasted as it comes.** The End of Days, Restrictions
and Performance Defects out of Equinox or EMS go in a box of their own,
fifteen tab-separated columns under their heading row, and each row becomes
a Defects line of the plan. The *Repair Location* names the depot where it
does (`Ramsgate Train Care Depot`) and carries `AMAT`, `MSE`, `RED`, `CON`
and `GTR`, all shown on the line; the *Fault Description* is boiled down to
a couple of words — `NO CAB AIR CON`, `LOUD BANG AND SMOKE`, `DMOS ACM GDU
FEEDBACK FAILURE` — with the codes and prefixes the system puts in front
dropped. Where the plan's own Defects section has the same unit and
priority, the export's row is used and the planner's Action for it kept.
The export on its own, with no plan pasted, is a plan.

**The notice's first line says what the unit is**, in the depot's words: a
defect is `CONTAINING MO RESTRICTION - NO CAB AIR CON`, an exam or any
other work is `REQD RE EOD FOR A EXAM` — not "containing" an exam.

**Who goes first.** The lines are answered nearest first, and at the same
date a `RED` defect first, then one with a concession (`CON`), then in the
plan's own order — a concession never jumps a line due sooner. Where two
lines want the same working home, the one answered first gets it and the
other is given the next; nothing is offered twice. The plan still comes
back in its own order.

**A 12-car carries three requests, an 8-car two.** How many units a
working can take requests for is how many the sheets put on it — the
Summary's UNITS column — less any the plan wants at that depot itself, and
each request displaces one unit, so the formation is kept both ways. The
line names the unit displaced and which request of the three it is.
3.5.1 wanted the same number of units on both diagrams, which was the
wrong reading.

**The 375/9 variation, last.** Once the same fleets and sub-fleets are
exhausted — nothing of the unit's own fleet ends where it is wanted that
it could take — a 375/9 is offered a plain 375 diagram and a plain 375 a
375/9 one, and the line says `VARIATION` so. Never a 3-car, a 376 or a
377. Within a fleet the order is a working with a swap, then one for a
depot swap, then one whose diagram splits somewhere with no swap point —
and the variation only after all three, because "always exhaust the same
fleets" is the rule as given, splitting diagram and all.

**A Saturday's plan against a Saturday's reports.** The tab has its own
drop zone for the day's Diagram Summary and Detail, any day; they are read
and nothing is built from them, so a Saturday, which the weekday books
refuse, reads here. Left empty, the weekday books' own pair is used as
before. And a line due over the weekend or on Monday, seen from Friday or
the weekend, is near — held for Monday — though Monday is three days off a
Friday; before this it was answered as a line for later in the week.

**The tab says what it is for**, and what it is not: an experimental
reference to help decide berth requests, in a warning box — *do not use
this to build your Telex*.

## 3.5.1 — 19 September 2026 — fleets stay on their own diagrams

**A swap keeps each fleet on its own diagrams, both ways.** A 375/9 on a
375/9 diagram, a 3-car on a 3-car one, a 375/6, /7 or /8 on a plain 375
one, a 376 on a 376 diagram, a 377 on a GT diagram — and none of them
couples to another fleet. The diagram's fleet is the Summary's own FLEET
column; the unit's is its number. The same number of units go on the
service. 3.5.0 matched on class alone, which would have put a 375/6 onto
a 375/9 working that happened to fit the clock; a test now holds a 375/9
diagram alongside with exactly the same times and it is never offered.

## 3.5.0 — 19 September 2026 — a berth request names a working, and the changeover that gets it there

**"Ends elsewhere" was not a request.** A near line whose unit neither
ends nor calls where it is wanted used to be answered `ENDS GP`, which is
where it is, not what to do. It is answered now with a working that
**does** end at the depot tonight, found on the same reports the books
were built from, and the swap that gets the unit onto it.

**Named the way that depot names workings.** Gillingham, Victoria and
Grove Park by headcode; everywhere else by the time the working left —
off the platform if it went into the platform first, off the stop if it
ran empty from somewhere — which is the time the berthing book writes for
it, so `RE BERTH 20+52` and `GP BERTH 5J70` read as the books do.

**The swap is cross-referenced, as the depot put it**: the diagrams that
are at the same place around the same time and go on to end at the depot.
Two kinds:

- **At Ramsgate or a London terminal, a changeover.** The two arrivals
  within ninety minutes, and each unit on the platform ten minutes before
  the working it takes leaves — so nothing is delayed. Written out under
  the table in the depot's own notice form, ready to send:
  `375609 CONTAINING MO RESTRICTION - CHX PLEASE NOTE` /
  `2W30 10 28 DVP - CHX T/F 1H34 12 45 CHX - HGS` /
  `1H76 10 50 HGS - CHX T/F 2R34 12 34 CHX - RAM`.
- **At a depot both stand at during the day — the weekday AM berth.** A
  unit that has come out of Ramsgate to Grove Park for the morning and is
  wanted back at a maintenance depot is got there by swapping the
  afternoon working with one that ends there, and the request reads
  `GP BERTH 5J70/5F43`: in on the first, out on the second — the depot's
  own `GP BERTH 5N32/5F28`, which is what those two headcodes were.

Formations have to match, neither diagram may split or join after the
swap point (the other unit would be taken into it), and the unit displaced
must not be one the plan wants at that same depot — nothing lost back to
the depot. Where nothing is at the same place, the working is still named
for a depot swap and the line says so.

**Measured on the 18/09 reports.** Forty-six diagrams stand at Grove Park
between the peaks and five of them end at Ramsgate — so the afternoon swap
is a real thing on a weekday. London changeovers are rarer than the
notice form suggests: a London turnaround is ten minutes, and the rule
would not let the 20 18 into Charing Cross take the 19 34 out of it,
which is right. On the week-of-19/09 plan no near line had a shared stand
or terminal, so the requests name the working and say "no shared terminal
— depot swap".

**Still to come:** swapping exams that arrive earlier when the requests
run out, and route restrictions — the notice says MO or NM, but which
routes a restricted unit may not take is on no report read here.

## 3.4.0 — 19 September 2026 — berth requests: the plan back in its own hand, with suggestions

**The plan comes back as the plan.** The same sections in the same order,
the same columns, every row where it was, the exam rows in the
workbook's colours — A black, B green, C red, the M and T exams purple and
blue, XS50 blue — with two columns added on the right: **Suggested** and
**Today**. Copy puts it on the clipboard twice, as tab-separated text that
pastes back into the workbook column for column, and as the coloured
table. A button turns the same result into the nearest-first list and
back.

**It suggests now, in the depot's own words.** A plan pasted with the
Action column empty comes back with every empty cell filled, in bold; a
plan with the planner's actions in it keeps them untouched and puts the
suggestion beside them. The rules are the depot's, as given, and are
written out in the panel with the ones still to come kept apart:

- **Hold** — ends tonight where the plan wants it, with the work due
  today, tomorrow or ASAP: `RE HOLD`, `GI HOLD`, `SG HOLD` … A PM job is
  noted as one it could run the morning before. Seen from Friday or the
  weekend, a line due Saturday to Monday is held `FOR MON`, the depot's
  form. An arrival after midnight meets a target date and the note says
  so. An exam back at Ramsgate after 20 00 is noted and after 22 00
  flagged.
- **Changeover, or a berth** — calls where it is wanted but does not end
  there: at Ramsgate or a London terminal, `RE C/O AND HOLD`; at any other
  depot, `GP BERTH off 5N32`, naming the working it is on when it gets
  there, the time, and how long it stands.
- **Fleet moves** — nothing today reaches the place, but the unit ends at
  a depot with a standing empty path to it that runs the next day: the
  path is named, `5Y17 10+10 SG - RE (SuX)`. The set is Engineering
  Planning's own sheet, twenty-four paths, carried in the module.
- **Otherwise** `ENDS DVP`, which is what the plan writes for a line not
  yet near, and for a near one that it makes no call at the place today.
- **AMAT** needs no request unless the defect is a restriction; **MSE** is
  noted for the question of whether they are attending; an **EOD** defect
  with no date is due today, because that is what end of day means.

**Splitting diagrams are a fact on the line** — `on RM904 (splits at
AFK)` — and named on any suggestion that would take a unit off or onto a
working. Measured before it was written: 131 of the 296 diagrams on the
18/09 Detail attach or detach somewhere, and where they do it is the
stations — Ashford 79 times, Faversham 41, Victoria 36, Ramsgate 33,
Dover 11 — which is portion working, not depot shunting. So it is common,
and it is said with the places, because "splits" alone is nothing a
planner can check. The Detail readers keep the attach and detach word
beside the shunt flag to make it readable.

**Two corrections from the depot.** A 375/3's defect goes to Ramsgate or
Gillingham, not Ashford. A 377 bound for Selhurst has to be at Victoria
for the fleet move over, so Victoria is where its line asks for it.

**And two things measured rather than guessed.** A Victoria shuttle calls
at Victoria fourteen times, so the line shows the first three calls and
how many more. The whole week-of-19/09 plan, run against the 18/09 reports
with its Action column emptied, fills all 115 lines; where the planner's
own hand was there to compare it agrees where the day matches — `SG HOLD`
against a unit ending in the Slade Green up sidings for an ASAP XS50, `VIC
HOLD FOR MON` for the 377 stopped for Selhurst, `RE HOLD FOR MON` for the
three Ramsgate A-exams due Saturday morning.

## 3.3.0 — 19 September 2026 — berth requests, the facts first

**A fourth tab, marked experimental.** The planner pastes the maintenance
plan out of the Telex workbook — Exams, Campaigns, Scheduled Maint,
Requests, UAT, MLT/Lathe, Defects, each with its own columns — and for
every line of it the tab says where that unit is today, on which diagram,
where and when it ends tonight, and every call it makes at the place the
plan wants it. Read off the same Diagram Summary and Diagram Detail the
weekday books were just built from, so it asks the reports the books came
from and never a second copy. The planner's own Action column is shown
beside the facts and never written over.

**Nearest first.** Lines due today, tomorrow, `ASAP` or overdue; then the
rest of the week and the mileage triggers; then everything later. One
day's reports say where a unit is today and where it ends tonight, not
which diagram it takes tomorrow — that is the allocator's choice each
morning — so the further out a line is the less there is to say beyond
where the unit ends, which is what the plan itself writes (`ENDS DVP`).
Every way the plan writes a date is read: `SAT AM 19/09`, `EOD SUN 20/09`,
`20 00 THU 24/09`, `AFTER AM PEAK MON 21/09`, the Defects'
`30/09/2026 00:00:00`, and `AFTER 1250 MILES`, which is a trigger and not
a date.

**Held against the planner's own hand.** The plan for the week of 19/09,
84 units over 115 lines, read against the Friday 18/09 reports: 73 of the
84 are on a diagram that day, and the eleven that are not are exactly the
ones the plan has stopped at a depot. Where the planner had written where a
unit ends, the reports already agreed — `O/H SGUPS` against a unit ending
in the Slade Green up sidings, `O/H FKE` against three ending at Folkestone
East, `SP @ XSE` against two ending at St Leonards, `RE HOLD FOR MON`
against one ending at Ramsgate at 19+54.

**What was needed to make that work.** The Summary reader kept a unit's
last three digits, which is what the books print, and for a formation kept
the LAST unit's — so a plan line for the first unit of a pair found
nothing. Every row now also carries the whole numbers, all of them. And
the weekday build hands back what it read, the Summary rows and the Detail
itineraries, as `summary` and `detail`.

**What the facts say.** A call names the arrival, marked empty or not by
what it came in on, a stand of an hour or more as a stand, and what it
leaves on — the three things a berth request is written from:
`calls AFK 05+35 off 2A01, AFK 10+40 (stands 3.3 h) off 5A05`. Where a
unit started the day is not a call. A time past midnight is said so. A
defect's home is a matter of class and the line asks for the right one — a
376 for Slade Green or Gillingham, a 375 for Ramsgate, a 375/3 for either
Ramsgate or Ashford — and its kind is read down from the priority column,
`EOD`, `MO`, `NM` or `PERF`, and shown; `AMAT` and `MSE` are picked up
wherever they are written and shown too. A box takes the units that are
out of service, and their lines are marked and left alone.

**What it does not yet do is decide.** The depot gave the rules and they
are written into the tab's rulebook as given, marked as coming: `RE HOLD`
where a unit ends at Ramsgate with the work due next morning; exams back
by 20 00 where it can be done and never after 22 00; a defect's target date
met by an after-midnight arrival; changeovers at Ramsgate and the London
terminals in the depot's own notice form, never one that loses maintenance
back to the depot; the standing fleet moves between depots; swapping exams
that arrive earlier; AMAT needing no request unless restricted; MSE
attending needing none, and not attending needing the nearest reachable
place; nothing onto a splitting diagram. Shipping the facts first is the
point: they are what those rules will be applied to, and they are to be
proved against the planner's hand on real days before a suggestion is
ever made off them.

## 3.2.8 — 19 September 2026 — the small hours, and a swap that has to be undone

**Reported as the list not showing services after midnight.** It was not.
The Operating Report writes plain times of day, so the last working of a
diagram that finishes in the small hours carries the **smallest** numbers
on its own list. Read as minutes those sorted to the top of the morning,
so the working picked as a diagram's ending was the last one before
midnight and never the real one. On the Saturday 19/09 report that was
**ten diagrams of forty-one**:

| | Was shown ending | Really ends |
|---|---|---|
| RM020, RM021 | `1H82 22 30 HGS - CHX` | `5E28 01+27 TBW - TON` |
| RM027 | `1H88 23 44 HGS - TON` | `5H88 00+51 TON - TONDMS` |
| RM041 | `2U79 23 18 DVP - FAV` | `5U39 00+08 FAV - FAVUS` |
| RM045 | `1H30 23 45 CHX - HGS` | `5H30 01+35 HGS - HGPS` |
| RM048 | `1H28 23 15 CHX - HGS` | `5H28 00+54 HGS - XSE` |
| RM006 | `1U74 22 18 RAM - VIC` | `1U30 00 54 VIC - GLM` |

Every row now carries a **sorting clock that runs past midnight**, the way
the Diagram Detail's reader already rolls its own. The printed clock is
untouched, because the Not Allocated windows are asked about the time of
day and a working at ten past midnight is at ten past midnight whichever
day it belongs to.

**And a trap inside that, found by measuring rather than by reasoning.** A
diagram's rows are grouped by the **unit** that worked them, not in one
time order: RM919 on the 18/09 report lists 375710's midday-to-night block
first and 375712's morning block after it. Rolling the whole diagram as
one clock carried that morning into the next day and made the 10:30 its
latest working — it moved RM919 and RM921 from `5H16 22+03 HGS - XSE`,
which is right and is what the depot's own sheet says, to `1H74 10 30
HGS - CHX`, which is not. Each run of rows sharing a diagram **and a unit**
now keeps its own clock; within one unit's itinerary the time only goes
backwards when it really has passed midnight.

**Two locations that only ever appear on the small-hours workings** went
unnoticed for exactly as long as those were being missed, and printed as
`???`: `TUNWELL` (Tunbridge Wells, TBW) and `PKWD` (Paddock Wood, PDW).

**A reciprocal 375 / 375-9 swap on one working is listed now, both
halves.** It used to cancel out, on the reasoning that every car is there
and only the badges are crossed. The depot's own sheet carries both — RM035
and RM920 on the `5H04 19+17 HGS - XSE` — because the swap still has to be
undone, and a sheet that says nothing about it cannot be worked from. With
the fleet block gathered by which way round, the pair keeps a block of its
own between the two one-way lists rather than being filed one under each.

Against the 18/09 reports that is four lines back from the cancelling, one
diagram whose after-midnight ending is a mismatch where its pre-midnight
one was not, and three moved onto their real endings — and several of them
now match the depot's own sheet word for word where they did not before:
`RM002 ENDS 5S70 00+32 FAV - FAVU?S`, `RM032 ENDS 5H30 01+41 HGS - XSE`,
`RM042 ENDS 5R76 01+06 DVP - DVPS`.

## 3.2.7 — 19 September 2026 — two more ways to read the same list

**Variations gathered by which way round.** The fleet block is grouped on
where the unit ends up as standard — how you read it standing at one
depot, these are the ones coming to me, in the order they turn up. The
depot's own lists gather it the other way: every 375/9-on-a-375-diagram
together and every 375-on-a-375/9-diagram together, each in diagram order,
which is how you read it looking for a unit — the 9s that are out and the
9s that are missing, as two lists. A tick now switches between them.

**Arrival times on Ramsgate only.** `(ARR …)` is on every line as
standard. The depot keeps it where it answers something — a working INTO
Ramsgate, station or depot, where what matters is when the unit gets there
to be dealt with — and leaves it off the rest so the list reads shorter. A
tick does that, and nothing else on the line changes.

On the 19/09 pair, all three ticks on:

```
A)      4.375 V 3.375 (RM308) ENDS 5T73 23+01 SOO - GI

        FOLLOWING 4 V 3: 5T73 23+01 SOO - GI

B)      375/9 V 375 (RM001) ENDS 2R66 20 34 CHX - RAM (ARR 22 45)
        375/9 V 375 (RM006) ENDS 1U74 22 18 RAM - VIC
        375/9 V 375 (RM012) ENDS 1U10 19 42 VIC - RAM (ARR 22 06)
        375/9 V 375 (RM018) ENDS 5R69 22+29 AFK - AFDS
        …
        375 V 375/9 (RM903) ENDS 5W78 23+05 AFK - AFDS
        375 V 375/9 (RM910) ENDS 5H22 23+38 HGS - XSE
```

**Read once, build as often as you like.** The two reports are parsed by
`read` and laid out by `build`, and the page holds what `read` gave it —
so ticking a switch is a rebuild, not a re-read. On the real 19/09 pair
that is 172 ms against 31 ms, and the Diagram Detail's export is 4.5 MB.

A test strips each option back off and holds the result against the plain
one: no line is gained or lost by the grouping, and only the arrival goes
when the arrivals go.

**And one difference from the depot's list, left alone rather than
guessed at.** Their sheet carries RM035 and RM920 together on the
`5H04 19+17 HGS - XSE` — one 375/9 on a 375 diagram and one 375 on a
375/9, on the same working. This tool **cancels** a reciprocal pair like
that: every car is there and only the badges are crossed, so neither is a
variation. That rule came with the prototype and was held against the real
18/09 reports, so it stays until the depot says otherwise. The grouping
above already has a block for such a pair, unreachable for as long as the
cancelling holds, and a test pins both so they cannot drift apart quietly.

## 3.2.6 — 19 September 2026 — the depot's own lettered hand

**The Diagram Summary's export was checked and was already fine.** Asked
after the Operating Report's turned out not to read: the Summary comes in
either way, and on the real 18/09 export that is 261 rows over 151
diagrams with POS, start, end and fleet all matching the file cell for
cell. The synthetic Summary is now written in both shapes too, the saved
one built from the printed one, with a test holding the two lists against
each other — so if it ever stops being fine, something says so.

**Long formed is reported, and always was.** A length difference is named
whichever way it goes: `4.375 V 3.375` for a 4-car on a 3-car diagram as
readily as `3.375 V 4.375` the other way. Nothing filters the over-length
ones out, and the depot's own lists carry them, so nothing should. Written
into the rules panel where it can be read rather than inferred.

**A toggle for the lettered layout.** How the depot writes the list out by
hand and what it says on the telephone: every shortage, swap or length
variation takes a **letter of its own**, in the order they happen, and the
whole run of fleet variations shares the **last** letter. So "B" names one
train and "D" names the fleet list.

```
A)      3 CAR WRONG END (RM301/RM901) ENDS 2R02 05 22 AFK - DVP (ARR 05 51)

B)      3.375 V 4.375 (RM903) ENDS 2W14 06 36 RAM - CHX (ARR 08 54)

        FOLLOWING 3 V 4: 2W14 06 36 RAM - CHX

C)      3 CAR INTER VICE END (RM302/RM905) ENDS 2X01 07 10 RAM - CHX

D)      375 V 375/9 (RM905) ENDS 2X01 07 10 RAM - CHX (ARR 09 20)

        375 V 375/9 (RM901) ENDS 5F85 15+49 DVP - CST (ARR 16+15)
```

A case's own follow-on notes sit under its letter, a blank line apart and
aligned with the heading rather than stepped in again. Past Z the letters
carry into AA, AB — no day has needed it, but a list that silently started
again at A would be worse than a long letter.

It is **one list in two layouts, not two lists**: both are built from the
same blocks, a test strips the lettering off and holds the two against
each other line for line, and what is on screen is what **Copy** and
**Save** hand over, so the two can never disagree about what was sent.

## 3.2.5 — 19 September 2026 — the Operating Report, saved as well as printed

**Reported as the shortages list saying there was nothing wrong when there
plainly was.** The 19/09 reports went in as the two **.csv exports** and the
list came back empty. The status line was the tell — *0 diagrams on the
report, 197 in the detail* — but "0 shortage and length cases · 0 fleet
mismatches" reads exactly like a clean day, and that is what it looked like.

The Diagram Detail could already arrive either way; the Operating Report
could not. Its reader was written for the PDF print, where the columns are
runs of two spaces or more and every line starts with the diagram. The
export is the same shape the Detail's is: the whole page header repeated in
front of **every** row, the thirteen data fields at the end, and the print
time in the cell after `Time:` rather than after a run of spaces. Nothing
in it matched, so nothing was read.

It is read now, by its column labels rather than by counting from the left,
and both readers finish in one place so the two shapes cannot drift into
being different reports. The export is in some ways the better one: a row
with no unit allocated has an empty ALLOCATED and RESOURCE rather than two
missing tokens, so nothing has to be guessed from its shape.

On the pair that was reported — Saturday 19/09, printed 02:38 — that is
**41 diagrams read**, one length case and fifteen fleet mismatches where
there had been none:

```
4.375 V 3.375 (RM308) ENDS 5T73 23+01 SOO - GI (ARR 23+27)
    FOLLOWING 4 V 3: 5T73 23+01 SOO - GI
```

RM308 planned a 3-car and has a 4-car on it. Counted by hand off the export,
the day holds exactly one length difference and sixteen diagrams whose
effective unit is the wrong family — and the sixteenth is RM308, which is
reported above as the length case instead. The two agree row for row.

**Two things that would have said so out loud**, because an empty list is
the one answer that looks the same whether the day was clean or the report
was never read:

- **No rows read** now says so first, above everything else, and says to
  check the report and that either the print or the export will do.
- **Two reports from different days** are named. They read perfectly well
  together and answer nothing, because every working is matched against a
  plan that was not in force. Said, not refused — the depot knows what it
  dropped. The date comes off the line that names it, and failing that off
  the `On dd/mm/yy` every diagram in the Detail carries.

The synthetic report is now written in both shapes, the saved one built
**from** the printed one so they are the same report by construction, and a
test holds the two lists against each other. The browser smoke drives the
panel with the export as well as the print.

## 3.2.4 — 19 September 2026 — a sweep, and one review line that was not true

Asked to look through the rest of the tool for faults, so both roads were
run over real paper and every row checked back against the source it came
from. What that found is at the bottom. One thing needed fixing.

**A run-round that works nothing afterwards was said to be listed somewhere
it was not.** A unit that pops out of its section and comes straight back
without working anything has been run round, not sent out, so the row is
held for the service that follows and the review says
`— listed on its next departure instead`. The word "next" was a placeholder
put in whenever there was no time to name — which is exactly the case where
there is no following service at all and no row is ever written.

On the Saturday 19/09 prints **all five** run-round lines said that, and
not one of the five was listed anywhere:

| | Runs round | And then |
|---|---|---|
| SG462, SG463 | Victoria Grosvenor shed to Vic (E) at 23+59 | berths in the platform, day over |
| RM905, RM906 | Ramsgate depot to the wash road at 19+05 | back to the depot, day over |
| RM30 | Ramsgate depot via the New Sidings at 00+30 | stables there, day over |

None of them belongs on a berthing sheet — a sheet lists services STARTING
somewhere, and none of these starts one — so the books are right. The
review was sending somebody to look for a row nobody had written.

What became of a run-round is not known until the stint search has
finished, so it is said afterwards now rather than guessed at the moment it
is skipped. One that does work afterwards names **the time the row really
carries**, which is what makes it findable; one that does not says
`and works nothing afterwards, so it is not on a sheet`. No row moves.

### What else was checked

Both roads, over the Saturday 19/09 prints and the Friday 18/09 Genius
reports, re-read from scratch by code that shares nothing with the tool:

- **Every row against its source.** All 289 unit rows of the three Saturday
  books: the departure exists in the prints, the headcode matches, and the
  POS order matches the printed formation at that leg. All 254 rows of the
  weekday books against the Diagram Detail: same, with the 25 Victoria rows
  that show the ECS headcode off the sidings against a platform time coming
  out as the deliberate convention they are.
- **Coverage, the other way round.** Every stint that comes off a stand,
  checked for a row somewhere between leaving it and reaching the next one.
  Weekend: six, all three run-round pairs above. Weekday: two, RM003/004's
  23:59 off the Ashford down sidings, which the review already names as an
  empty move to a berth.
- **The AM and PM columns** against where the prints actually put the unit
  next and where they leave it at the end: no disagreement.
- **Structure**: no duplicate rows, no row without a destination, no row
  with neither time nor diagram, and the cars-and-fleet column right on
  every one (375/6 and 377/5 as 4, 375/3 as 3, 376/0 as 5, 465/9 as 4).
- **After midnight**: one section has a row past midnight (West Marina
  00+50) and it sorts last, as DAY_ROLL intends.

Two things were looked at and deliberately left alone. **Twelve depot roads
have an abbreviation that does not read as one** — `RM DRW`, `VictGroSh`,
`GrPkDCtEE`, `SldGrDEHs`, `TonbJubS` and the rest — so a stand there is a
berthing only when the prints mark it `#`. Teaching the reader the long
names it already holds was tried and measured: it adds two rows to the
Ashford allocations, both **six-minute** calls at the Down Washer Road,
which is a turnround and not a berthing. The shunt-spur guard would have to
be widened at the same time, and which roads belong in it is the depot's
call. The visible cost today is wording: 8¾ hours on the Ramsgate wash road
reads as a "station dwell". And the **Gravesend page** in the Metro book is
real — SG707/708 start their day there — it is only the section list that
has never heard of it.

## 3.2.3 — 19 September 2026 — dressed off the leg it is timed from

**Reported as SG417 and SG418 the wrong way round on Saturday's Grove Park
sheet.** The row reads `5H76 | 10+09 | TUNBRIDGE WELLS | 1 SG418 / 2 SG417`.
The prints, against that 10+09, read `417(1)\418(2)`.

Both halves of that row were right, and they had come off different legs. A
weekend row in a section the depot times off its FIRST move — the Metro and
High Speed documents everywhere (`firstDepAll`), mainline Grove Park and
Slade Green (`firstDep`) — carries the time and headcode of the first
departure and the destination of the service it forms. That split is
deliberate and long-standing: the 10+09 out of the shed is only going as far
as the country end extension, and a sheet that said so would be no use to
anybody. The FORMATION was travelling with the destination instead of with
the time.

Usually that makes no difference, because the two legs are the same train
the same way up. It matters when the unit turns round inside its own
section:

```
G Pk Dep              10+09  5H76   417(1)\418(2)   ← the row's time
GrPkDCtEE      10+14  10+21  5H76   418(1)\417(2)   ← the row's destination
TunWellTB      11+02  11+12  5H76   417(1)\418(2)
```

The pair runs into the Grove Park country end extension and comes back out
the other way up. The sheet was timed at 10+09 and dressed at 10+21, so
somebody standing at Grove Park at 10+09 wrote **both** numbers into the
wrong box — and the sheet is the record the rest of the day is built on.

POS is read off the leg the row is timed from now. On Saturday 19/09 that
moves ten entries, every one of them a turn in a shed, a headshunt or an
extension inside the section, and every one now agreeing with its own print
against the time on the sheet:

| Book | Row | Turns at | Was | Now |
|---|---|---|---|---|
| Mainline | 07+51 ORP | GrPkDCtEE 08+03 | 802, 801 | 801, 802 |
| Mainline | 08+17 ORP | GrPkDCtEE 08+29 | 804, 803 | 803, 804 |
| Mainline | 05+43 BNH | SldGrDEHs 05+52 | 812, 811 | 811, 812 |
| Metro GILLINGHAM | 5U89 21+35 | Gill 21+55 | 414, 413 | 413, 414 |
| Metro GROVE PARK AM | 5S13 06+52 | GrPkDCtEE 07+04 | 714, 713 | 713, 714 |
| Metro GROVE PARK AM | 5H74 09+39 | GrPkDCtEE 09+51 | 416, 415 | 415, 416 |
| Metro GROVE PARK PM | 5H76 10+09 | GrPkDCtEE 10+21 | 418, 417 | **417, 418** |
| Metro SLADE GREEN AM | 5C05 05+27 | SldGrDEHs 05+36 | 439, 438 | 438, 439 |
| Metro SLADE GREEN AM | 5C07 05+58 | SldGrDEHs 06+07 | 441, 440 | 440, 441 |
| Metro VICTORIA | 5L34 04+50 | Vic (E) 05.03 | 461, 460 | 460, 461 |

Ten entries of 289 rows; nothing else in the day moves, and the weekday
road does not move at all — it was measured both ways on the 18/09 reports
to be sure, because the two roads share their writers.

All ten come out ascending, which looked like a sort until each was held
against its own print. It is not one. On this Saturday every pair that turns
inside its section happens to leave the depot with the lower diagram leading;
what the rule reads is the print, at the time on the sheet, whichever way up
that is.

A first leg with no formation printed — a single unit, or a shed move the
prints leave blank — still falls back to the later leg, as before.

## 3.2.2 — 18 September 2026 — the two books are dressed the same

**Reported as the weekend book not being formatted for text and not matching
the weekday one to type into.** Half of that: the Text format was already on
both — the weekend book's column F reads `@` down its whole length, the same
as the weekday one. What differed was the **face**.

A weekend sheet's blank cells are brought into being by the ruling, and the
ruling only gave them a border: no font, no alignment. So a cell somebody
types a unit number into came out in the grid default — **Calibri 11, left** —
against the weekday book's **Arial 11 bold, centred**. Nothing was wrong with
either book on its own; side by side they looked like two different documents,
which is exactly how they are used.

The column dress is one table now, `V_LOOK` in `src/xlsx.js`, and both
layouts read it. The weekend layout's own cells already used those looks —
they were only ever missing from the ones it ruled — so this changes no cell
that has a value in it. Every column of a berthing sheet now wears the same
face and alignment in both books:

| | A | B | C | D | E | **F** | G | H |
|---|---|---|---|---|---|---|---|---|
| | Arial 11 b | Arial 11 b | Arial 11 b | Arial 10 | Arial 10 | **Arial 11 b** | Arial 10 b | Arial 10 |
| | centre | centre | centre | centre | centre | **centre** | centre | right |

A test holds the two books against each other cell for cell, so a column
added to one and not the other is caught rather than noticed.

The frozen-build comparison carries one more deliberate difference for it:
the old build left those blank cells undressed, so the look on an **empty**
cell is now expected to differ. A cell with a value in it still has to match
exactly.

## 3.2.1 — 18 September 2026 — Cannon Street's reading order, and a pin that had lost a unit

Two reported off the real Metro books, and both turn out to be the same
shape: house knowledge that was written down as a *pin* where it should have
been a rule, and so only half applied.

**SG702 printed ahead of SG701 at Cannon Street.** Cannon Street was not on
the Metro reading-order list, so it read highest Position first — except that
two of its three formations, 403/404 and 405/406, were pinned, and **both
pins are the order the Position column already gives**. A pin that agrees
with the reports is a pin standing in for a missing section rule, and here it
was hiding one: the only Cannon Street formation with no pin was the only one
printing the other way up. `CANNON STREET` is on the list now and all three
read 701/702, 403/404, 405/406.

The two pins stay, and not from timidity. Both formations are pinned at Slade
Green as well, and the review list says so whenever a pinned formation turns
up somewhere its pin does not reach — drop them and Cannon Street collects
that note every day for an order that is now right by rule. The table already
prefers a redundant entry to a standing false alarm; the bare `046,047,913`
key is there for the same reason.

**RM901 and RM301 printed 901 first at Grove Park, against the book.** The
trio 301/901/902 is pinned at Grove Park as `301, 902, 901` — 301 leads
there, and trails at Ashford — but 902 was working elsewhere, the three-unit
key stopped matching, and the pair fell back to Grove Park's
lowest-Position-first rule.

This is the failure the corrections table has warned about in its own
comments since the day 043/044/910 ran as 043/044, and until now it was only
**reported**. A pin that names every unit standing here and one or two more
is now **used**: somebody wrote down which of these leads, and the one that
did not run does not change that. Only a superset — a formation that has
*gained* a unit is not covered by an order that never named it, and a pin
that merely overlaps says nothing about the ones it left out.

Two entries in the whole 18/09 book take their order this way, both of them
this pair: Ashford reads 901, 301 as it always did, Grove Park now reads
301, 901. The review line says which formation the order was written for
instead of telling the reader to go and check.

**Still open: the rounder.** SG403/404 leave Cannon Street at 06 26 on the
2P11, run Greenwich, Woolwich, Slade Green, Eltham, Blackheath and back into
Cannon Street at 07 55. The row reads `06 26 CST`, which is true and reads
like a shunt. Seven rows in the day have a destination equal to their own
section, and a clean line separates them: the other six are `5B` empty moves
around Slade Green, which really are shunts. A **passenger** working that
starts and ends in the same section is a rounder. What such a row should say
instead is the depot's convention, not something to invent, so it is
unchanged pending an answer.

## 3.2.0 — 18 September 2026 — a third road: shortages and variations

**The depot's own *Shortage and Variations* prototype is now a tab.** It takes
the GENIUS **Operating Report** and the **Diagram Detail** and writes the
controller's list — what is short, what is the wrong length, what is the wrong
fleet, and every service each one goes on to affect. It builds no workbook;
the list is written text, copied into an email or saved.

**The engine came across as it was written.** It had been held against the
real 18/09 reports before the port and it reproduced them, so the logic is
evidence and the port was plumbing. What changed: it carried its own copy of
the PDF text extractor and its own fflate bundle, and both were already in
this build, so it now reads what the rest of the tool reads — and the Diagram
Detail can arrive as the **CSV export** as well as the PDF, which the
prototype could not do. Both roads land on the same list, and a test holds
them to it.

**What it found on 18/09.** 528 rows over 67 diagrams, and 31 to report: one
4-car on a 3-car diagram, one 3-car on a 4-car, and 29 fleet swaps. Two things
worth recording from that run. The report carried **no *Not allocated* lines
at all** — every row was a fleet mismatch — so the shortage half of the rules
is still unexercised on real paper and wants a print from a day something was
genuinely short. And it was printed at 20:25, outside every window the rules
have, which the Review list said rather than guessing.

**A 3-car in the wrong place is a swap, not a length difference.** The depot
read the first list and said so: where the cars are all there and only their
order is wrong, it is `3 CAR WRONG END`, never `4.375 V 3.375` against one
diagram and `3.375 V 4.375` against the other.

The prototype had that rule and it could not fire, for a reason worth
recording. It looked for the pair among each diagram’s **effective**
allocation - the last one it holds in the day - and RM901 carries the 3-car
375303 on the 05 22 to Dover but a 4-car from 15:49, so its morning unit was
never looked at and the swap with RM301 was invisible. The pair is read off
the **working** now, over every allocation a diagram holds, and 18/09 reads
`3 CAR WRONG END (RM301/RM901) ENDS 2R02 05 22 AFK - DVP` where it read two
length differences before. RM901’s afternoon unit is a separate mismatch and
still has its own line.

A 3-car with nothing swapped back is untouched: that train really is a car
short, so it keeps its length label and the `FOLLOWING` trace of what it
leaves short.

**And the middle of a formation: `3 CAR INTER VICE END`.** A 3-car standing
*intermediate* rather than on an end reads differently again, and telling the
two apart needs a diagram’s place in its formation. That is not on the
Operating Report, not on the Diagram Detail, and — checked — **not on the
Allocation Summary** either: that report is a row per unit (which diagram it
starts on, which it finishes on, where, when, how far) and has no position
column at all. It is the **Diagram Summary’s POS**, which is the report the
weekday books are already built from.

So the road takes the Diagram Summary as an optional third report and reads
it with the weekday pipeline’s own parser rather than a second one that would
drift. With two units both are ends and the answer is forced, so no Summary is
needed; with three or more the POS column settles it, and with no Summary
dropped in the pair is named on the Review list — saying which report would
answer it — rather than labelled on a guess.

On 18/09 it changes nothing, and that is the point: the only swap that day is
the two-unit RM301/RM901, so the list is identical with the Summary and
without it.

**The place codes stay apart on purpose.** This list names the **road** —
`AFDS`, `AFUS`, `DVPS`, `GPUS` — where the berthing books name the station.
That is not an inconsistency to be merged away: a berthing sheet says where a
unit is put away, a discrepancy is worked off a road. Of the codes the two
tables share, thirteen differ, and the test names six of them so a future
merge has to argue with something.

**And a thing the merge makes possible but does not yet do.** The berthing
books take a diagram's class from the Diagram Summary's *planned* fleet. On
18/09 the Operating Report contradicted that on **39 rows** — 21 printed
`4 375` that had a 375/9 on them, 18 of the 9xx printed `4 375-9` that had a
plain 375 or a 3-car. Whether a berthing book should show the plan or what is
actually out there is the depot's call, so nothing changed; but the tool can
now see the difference.

The size ceiling moves 700 KB → 760 KB for the road (~35 KB). It brought no
library with it.

## 3.1.4 — 18 September 2026 — RM013 leads to Dover Priory

**The 03+52 off Ashford printed 014 first; the depot says 013 leads.** It is
the 5R05 out of the Down Sidings, through the down yard and the platform and
away to Dover Priory. Ashford reads highest Position first and 013 is
Position 1, so unpinned it trailed. `ASHFORD|013,014` now corrects it, and
two rows of a 254-row book move — that entry's own.

**Why a pin and not the rule that was asked for.** The suggestion was that
anything running Ashford Down Sidings → Dover Priory via the platform should
be ordered from the platform. There are two such departures in the 18/09
book, and nothing in either report tells them apart: the 03+52 and the
**05 22**, both off the Down Sidings, both through the yard to the platform
and away to Dover, both splitting later, both with their Positions taken off
that same berth. Read as a rule it turns the 05 22 round as well, which puts
301 in front of 901 — against what the corrections table already records for
that formation at Ashford.

The one field that does differ is the one the report named: the 03+52 is
`5R05` in and `5R05` out, empty stock running *through* the platform, where
the 05 22 arrives as `5R02` and leaves as `2R02`, into service. That may well
be the rule. One example is not, so this is pinned at the width of the
evidence, and the fixture that guards it carries both departures side by side
so the next attempt starts from the pair rather than from one of them.

The 05 22 is not passed over in silence either: a correction is on record for
a formation close to it, so the review list already says to check that one
against the real book. If it should move too, that is the second example and
the rule can be written.

## 3.1.3 — 17 September 2026 — the UNIT column keeps a leading zero

**Column F is formatted Text now, all the way down.** It is the one column a
berthing sheet leaves empty — the allocated unit where the export names one,
and otherwise a ruled cell for the depot to write in. Under General, Excel
reads `012` as the number 12 and the zero is gone before anyone notices it
went. The cells carry the format and so does the column, because somebody
working down a sheet does not stop at the last section — the blank grid below
it takes it too.

Both berthing layouts name the same column, the weekday one in
`src/xlsx.js` and the weekend one in `src/engine.js`, and it is `UNIT_COL`
in one place rather than a 6 in two. The depot's own Metro and 395 documents
are untouched: their unit column is somewhere else, and a layout only gets
this by asking for it. Nothing either side of F moved, and the ruling on the
column survives — a cell's own style beats the column's.

One thing had to give for it. The golden comparison against the frozen
ExcelJS build reads a workbook back cell by cell and skips cells that carry
nothing; a column formatted for its whole length gives every cell below the
book a style, which ExcelJS resolves into the workbook's default Calibri, so
those empty cells started counting as real ones. "Carries nothing" now
includes wearing only that default face — every cell either writer really
puts down wears one of the books' Arial ones.

The size ceiling moved from 660 KB to 700 KB at the same time, and that one
is not a feature. Three releases of ordinary fixes ate the last of the old
headroom a few hundred bytes at a time; the ceiling is meant to sit above the
file with room in it, or the next one-line fix fails a test instead of being
a decision. The file is still roughly half what it was when ExcelJS was in
it, and that bundle has an assertion of its own.

## 3.1.2 — 17 September 2026 — one cutoff, not two

**The AM and PM columns split the day at a different time in a weekday book
than in a weekend one.** The weekend engine calls the moment `AM_CUTOFF` and
puts it at **14:00**; the weekday engine had its own bare `16 * 60` sitting
in the line that decides where a day that simply ends belongs. So a unit
finishing in the Ashford east berthing sidings at 15 50 read as a morning
berth on one sheet and an afternoon berth on the other, off the same move.

The figure is defined once, in `src/core.js`, and carried by
`src/rulebook.js` so both engines take every day-shape constant from one
place. Two lines a few rows apart in the same function were already reading
it; this one was the odd one out. It now reads it too, and the build carries
no `16 * 60` anywhere — which is itself a test, so a third cutoff cannot be
written in quietly.

**What it changes on a real day: nothing yet.** Every unit row in the 18/09
book — all 254 — is identical before and after, because no diagram that day
ends at a berth between half past six in the morning and four in the
afternoon; a weekday plan finishes its units in the small hours or in the
evening. So this is the inconsistency removed rather than a fault fixed, and
it is pinned by a pair of diagrams that end their day at 15 50 and at 13 30,
one either side of the line, with the early one as the control.

It came out of chasing a reported fault — **GT129 showing AFK in the AM
column** — and that one turned out to be no fault at all. **Closed: the
columns were right.** The depot confirmed the four rows as they stand:

| row | D | E |
|---|---|---|
| 06+07 GLM | VIC | AFK |
| 10+12 GPD | GPD | AFK |
| 11+44 VIC | VIC | AFK |
| 16 25 AFK | *(blank)* | AFK |

AFK is the PM column on every one of them, GT129 and GT130 read the same,
and moving the cutoff above changes none of them — GT129's day ends at
02:22, nowhere near any version of the line.

Two things recorded so they are not re-trodden. The marked-up books were
supplied and **were 18/09** — they are this tool's own output from before
3.1.1, with the Sevenoaks page still in them and RM022 still ahead of RM021.
An earlier note here reasoned from a `SPLITS PM` on the marked row that the
plan must have moved between two pulls of the report; that was wrong, and
the books disprove it. Three of GT129's four rows carry `SPLITS PM` and the
16 25 one carries `SPLITS`, all from the one build. And the general lesson:
a fault reported against a book is worth reproducing from the book itself
before reasoning about the reports behind it — the two workbooks settled in
one reading what the reports alone could not settle at all.

## 3.1.1 — 17 September 2026 — two the depot marked up

Both reported off a real book, both at Grove Park, both checked against the
**18/09** Diagram Summary and Diagram Detail.

**RM021/RM022 printed the wrong way round.** They come off the Grove Park
**Up C.H.S** on the 15+18 and printed 022 first. The next working off that
same road, SG811/SG812's 17+00, printed Position 1 first — and one road
cannot face two ways. The odd one out was a pin: `GROVE PARK|021,022`, taken
from the hand-written 12/08 book when the order corrections were first
gathered. The depot says that row is wrong, the same way it said the Ashford
117/128 one is. With the pin gone, both pairs read off the section's own
rule — Grove Park lists lowest Position first — and both agree with the
depot. Nothing else in the book moves: the pin named those two diagrams and
that section, and nothing else.

**RM043's AM column said Sevenoaks when the unit goes back to Grove Park.**
It runs out of the down sidings at 09+58 on a route-learning move, stands
**fourteen minutes** in the Sevenoaks siding, and is back in the same
sidings at 16+19. The siding is named like a siding, so the stand counted as
the unit being put away: the AM column read `SEV`, and the book opened a
whole SEVENOAKS page to carry that one line — the only Sevenoaks entry in
the day.

`SVNOCHS` joins the shunt spurs, which is the mechanism that already exists
for exactly this — Hastings Park, Bellingham, St Leonards CET, Gillingham Up
Sidings, and Sidcup Sidings on the weekend side. A spur splits a diagram
only after a berthing-length stay; a home berthing road still splits it
however short the sit, because the books list every re-departure off those.
The rule is the stay, not the place, so a unit that stands there *properly*
is berthed there, and that half is pinned too. The working's mileage follows
the same correction: the 09+58 now carries the 109 miles of the whole
out-and-back, not the 18 as far as Sevenoaks.

The third point reported alongside these two, **GT129's AFK column**, was no
fault: the row is right and the depot confirmed it. See 3.1.2 above, which
carries the four rows and what the marked-up books settled.

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
