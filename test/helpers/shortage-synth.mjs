/* Synthetic reports for the shortages and variations road.

   A day of three diagrams, shaped like the real 18/09 pair:

     RM301  a 3-car diagram (375/3) carrying a 4-car - a LENGTH case
     RM901  a 375/9 diagram carrying the 3-car RM301 was planned to have,
            on the same working - so the cars are all there and only their
            order is wrong: the depot calls that 3 CAR WRONG END. It picks
            up a 4-car in the afternoon, which is the trap
     RM002  a plain 375 diagram carrying a 375/9 - a FLEET mismatch, on its
            own, so it lands in the lower section
     RM903  a 375/9 diagram carrying a 3-car with nothing swapped the other
            way, so the train really is a car short: that IS a length
            difference and has to keep reading as one
     RM302  a 3-car diagram carrying a 4-car, in a formation of THREE with
     RM905  which planned a 4-car and got the 3-car - and Position 2 of 3,
     RM906  so the 3-car is standing in the middle. That is INTER VICE END
            rather than WRONG END, and the POS column is the only place it
            can be read: RM906 has no mismatch of its own and so no
            Operating Report line at all, but it is still in the formation

   The Operating Report is written as the PDF's text comes out: columns
   split on runs of two spaces or more. The Diagram Detail is given twice,
   once in that shape and once as the CSV export, because the road reads
   either and the two have to land on the same list. */

export const OPERATING_LINES = [
  "Page:  Page 1 of 1",
  "GENIUS  Control  :SouthEastern Trains  OPERATING REPORT",
  "Print Date:September 18, 2026",
  "Controller:NA  Signon:DFINCH  Name:Declan Finch  Time:  05:30",
  "Operating Report for:Depot RM, Owning Ctrl NE, 18/09/26 to 19/09/26. ",
  "DIAGRAM  DATE  FROM  DEP.  ARR.  TO  TRAINID  DEPOT  PLANNED  ALLOCATED  RESOURCE  OWNING   DISCREPANCY",
  "CTRL",
  "RM301  18/09/26  ASHFDNS  04:45  05:10  ASHFKY  5R02BA  RM  375/3  375/7  375713  NE  Fleet mismatch.",
  "RM301  18/09/26  ASHFKY  05:22  05:51  DOVERP  2R02BA  RM  375/3  375/7  375713  NE  Fleet mismatch.",
  "RM901  18/09/26  ASHFDNS  04:45  05:10  ASHFKY  5R02BA  RM  375/9  375/3  375303  NE  Fleet mismatch.",
  "RM901  18/09/26  ASHFKY  05:22  05:51  DOVERP  2R02BA  RM  375/9  375/3  375303  NE  Fleet mismatch.",
  // and a different unit on it from the afternoon, which is the trap: the
  // diagram’s LAST allocation is a 4-car, so a check that looks only there
  // never sees the 3-car it had on the morning working with RM301
  "RM901  18/09/26  DOVERP  15:49  16:15  CANONST  5F85BA  RM  375/9  375/8  375801  NE  Fleet mismatch.",
  "RM002  18/09/26  ASHFDNS  05:23  05:46  ASHFKY  5R06BA  RM  375/6  375/9  375913  NE  Fleet mismatch.",
  "RM002  18/09/26  ASHFKY  05:55  07:08  RAMSGTE  2R06BA  RM  375/6  375/9  375913  NE  Fleet mismatch.",
  "RM903  18/09/26  RAMSGTD  06:05  06:25  RAMSGTE  5W14BA  RM  375/9  375/3  375309  NE  Fleet mismatch.",
  "RM903  18/09/26  RAMSGTE  06:36  08:54  CHRX  2W14BA  RM  375/9  375/3  375309  NE  Fleet mismatch.",
  "RM302  18/09/26  RAMSGTE  07:10  09:20  CHRX  2X01BA  RM  375/3  375/7  375714  NE  Fleet mismatch.",
  "RM905  18/09/26  RAMSGTE  07:10  09:20  CHRX  2X01BA  RM  375/9  375/3  375310  NE  Fleet mismatch.",
  /* A reciprocal pair: RM004 planned a plain 375 and has the 375/9 that
     RM904 was planned, and they are on the SAME working. One of each way
     round, swapped with each other, so the pair belongs to neither of the
     two one-way lists. */
  "RM004  18/09/26  TONBDG  08:10  09:30  CHRX  2T10BA  RM  375/6  375/9  375919  NE  Fleet mismatch.",
  "RM904  18/09/26  TONBDG  08:10  09:30  CHRX  2T10BA  RM  375/9  375/8  375819  NE  Fleet mismatch.",
];

/* Each diagram's own itinerary: one line per CALL, with the headcode of the
   working that leaves it. */
export const SHORTAGE_DETAIL_LINES = [
  "GENIUS  Diagram Detail Report",
  "Diagram RM 3 0 1 On 18/09/26",
  "ASHFDNS  Ashford Dn Sdgs  04:45  5R02BA",
  "ASHFKY  Ashford Kent  05:10  05:22  2R02BA",
  "DOVERP  Dover Priory  05:51",
  "Diagram RM 9 0 1 On 18/09/26",
  "ASHFDNS  Ashford Dn Sdgs  04:45  5R02BA",
  "ASHFKY  Ashford Kent  05:10  05:22  2R02BA",
  "DOVERP  Dover Priory  05:51  15:49  5F85BA",
  "CANONST  London Cannon St  16:15",
  "Diagram RM 0 0 2 On 18/09/26",
  "ASHFDNS  Ashford Dn Sdgs  05:23  5R06BA",
  "ASHFKY  Ashford Kent  05:46  05:55  2R06BA",
  "RAMSGTE  Ramsgate  07:08",
  "Diagram RM 9 0 3 On 18/09/26",
  "RAMSGTD  Ramsgate EMU Dep  06:05  5W14BA",
  "RAMSGTE  Ramsgate  06:25  06:36  2W14BA",
  "CHRX  London Charing X  08:54",
  ...["RM302", "RM905", "RM906"].flatMap(d => [
    "Diagram " + d.slice(0,2) + " " + d.slice(2).split("").join(" ") + " On 18/09/26",
    "RAMSGTD  Ramsgate EMU Dep  06:40  5X01BA",
    "RAMSGTE  Ramsgate  07:00  07:10  2X01BA",
    "CHRX  London Charing X  09:20",
  ]),
  ...["RM004", "RM904"].flatMap(d => [
    "Diagram " + d.slice(0,2) + " " + d.slice(2).split("").join(" ") + " On 18/09/26",
    "TONBDG  Tonbridge  08:10  2T10BA",
    "CHRX  London Charing X  09:30",
  ]),
];

/* The Diagram Summary, which carries the one column neither of the other two
   reports has: POS, a diagram’s place in its formation. Optional - without
   it a formation of three cannot be placed - so it is here to prove the case
   that needs it. */
export const SHORTAGE_SUMMARY_LINES = [
  "GENIUS  DIAGRAM SUMMARY REPORT",
  "Diagram Summary for: 18/09/26",
  // diagram  fleet  start fuel  POS  start  from  to  end
  "RM302  375/3  0.00  1  06:40  RAMSGTD  CHRX  09:20",
  "RM905  375/9  0.00  2  06:40  RAMSGTD  CHRX  09:20",
  "RM906  375/9  0.00  3  06:40  RAMSGTD  CHRX  09:20",
  "RM301  375/3  0.00  1  04:45  ASHFDNS  DOVERP  05:51",
  "RM901  375/9  0.00  2  04:45  ASHFDNS  DOVERP  05:51",
];

/* The same itineraries as the CSV export writes them: one line per LEG,
   with the whole report header repeated in front of every one. */
const HEAD = '"GENIUS","Diagram Detail Report","Page:","Page -1 of 1",,,,,' +
  '"Control:","SouthEastern Trains","Print Date:","September 18, 2026",' +
  '"Controller:","NA","Signon:","DFINCH","Name:","DECLAN FINCH","Time:",' +
  '"05:30","Diagram Details for:"," 18/09/26","Diagram",';
const TAIL = '"Off Diagram","  000","Works","  000"';
const leg = (diag, code, name, arr, dep, hc, endCode, endName, endTime) =>
  HEAD + '"' + diag + '","On","18/09/26","Notes",,"Miles","Fuel Miles",' +
  '"' + code + '","' + name + '","' + arr + '","' + dep + '",,"' + hc + '",' +
  '0.50,0.50,"' + endCode + '","' + endName + '","' + endTime + '",' + TAIL;

export const SHORTAGE_DETAIL_CSV = [
  ...["RM301", "RM901"].flatMap(d => [
    leg(d, "ASHFDNS", "Ashford Dn Sdgs", "", "04:45", "5R02BA", "ASHFKY", "Ashford Kent", "05:10"),
    leg(d, "ASHFKY", "Ashford Kent", "05:10", "05:22", "2R02BA", "DOVERP", "Dover Priory", "05:51"),
  ]),
  leg("RM901", "DOVERP", "Dover Priory", "05:51", "15:49", "5F85BA", "CANONST", "London Cannon St", "16:15"),
  leg("RM002", "ASHFDNS", "Ashford Dn Sdgs", "", "05:23", "5R06BA", "ASHFKY", "Ashford Kent", "05:46"),
  leg("RM002", "ASHFKY", "Ashford Kent", "05:46", "05:55", "2R06BA", "RAMSGTE", "Ramsgate", "07:08"),
  leg("RM903", "RAMSGTD", "Ramsgate EMU Dep", "", "06:05", "5W14BA", "RAMSGTE", "Ramsgate", "06:25"),
  leg("RM903", "RAMSGTE", "Ramsgate", "06:25", "06:36", "2W14BA", "CHRX", "London Charing X", "08:54"),
  ...["RM302", "RM905", "RM906"].flatMap(d => [
    leg(d, "RAMSGTD", "Ramsgate EMU Dep", "", "06:40", "5X01BA", "RAMSGTE", "Ramsgate", "07:00"),
    leg(d, "RAMSGTE", "Ramsgate", "07:00", "07:10", "2X01BA", "CHRX", "London Charing X", "09:20"),
  ]),
  ...["RM004", "RM904"].flatMap(d => [
    leg(d, "TONBDG", "Tonbridge", "", "08:10", "2T10BA", "CHRX", "London Charing X", "09:30"),
  ]),
].join("\r\n");

/* The same Operating Report as the CSV export writes it: the whole page
   header in front of every row, the thirteen data fields at the end, and
   the print time in the cell after "Time:" rather than after a run of
   spaces. Built FROM the lines above, so the two shapes cannot drift into
   being different reports. */
const OP_HEAD = '"Page:","Page -1 of 1","GENIUS","Control:",' +
  '"SouthEastern Trains","OPERATING REPORT","Print Date:",' +
  '"September 18, 2026","Controller:","NA","Signon:","DFINCH","Name:",' +
  '"Declan Finch","Time:",05:30,"Operating Report for:",' +
  '"Depot RM, Owning Ctrl NE, 18/09/26 to 19/09/26. ","DIAGRAM","DATE",' +
  '"FROM","DEP.","ARR.","TO","TRAINID","DEPOT","PLANNED","ALLOCATED",' +
  '"RESOURCE","OWNING CTRL","DISCREPANCY",';
export const SHORTAGE_OPERATING_CSV = OPERATING_LINES
  .filter(l => /^(?:RM|GT)\d{3}\s/.test(l))
  .map(l => OP_HEAD + l.split(/\s{2,}/).filter(Boolean).slice(0, 13)
    .map(x => '"' + x + '"').join(","))
  .join("\r\n");

/* The Diagram Summary as the CSV export writes it — the one report of the
   three that is optional, and the only place POS is written down. Built
   FROM the printed lines above, same as the Operating Report's export. */
const SUM_HEAD = '"GENIUS","DIAGRAM SUMMARY REPORT","Page:","Page -1 of 1",,' +
  '"Control:","SouthEastern Trains","Print Date:","September 18, 2026",' +
  '"Controller:","NA","Signon:","DFINCH","Name:","DECLAN FINCH","Time:",' +
  '"05:30","Diagram Summary for:"," 18/09/26","DIAGRAM","UNITS","FLEET",' +
  '"OFF","START FUEL","POS","AT","FROM","TO","AT","WORKS","END FUEL",' +
  '"MILES","TOT. FUEL  MILES","NOTES","NOTES",';
export const SHORTAGE_SUMMARY_CSV = SHORTAGE_SUMMARY_LINES
  .filter(l => /^RM\d{3}\s/.test(l))
  .map(l => {
    // diagram  fleet  start fuel  POS  start  from  to  end
    const [diag, fleet, fuel, pos, start, from, to, end] = l.split(/\s{2,}/);
    return SUM_HEAD + ['"' + diag + '"', "", '"' + fleet + '"', fuel, pos,
      '"' + start + '"', '"' + from + '"', '"' + to + '"', '"' + end + '"',
      "0.00", "0.00", "0.00", "", ""].join(",");
  }).join("\r\n");

/* ---- the small hours ----
   Two shapes the clock puts in the way.

   RM007 runs past midnight: its last working leaves Dover at 00:20 and its
   times are written as plain times of day, so read as minutes they are the
   SMALLEST on its list and sort to the top of the morning.

   RM008 does not. It has two units on it, and the report groups a
   diagram's rows by the unit that worked them rather than in one time
   order - 375931's midday-to-night block first, 375932's morning block
   after it. Nothing here has crossed midnight and nothing must be carried
   into the next day. */
export const MIDNIGHT_OPERATING_LINES = [
  "Page:  Page 1 of 1",
  "GENIUS  Control  :SouthEastern Trains  OPERATING REPORT",
  "Controller:NA  Signon:DFINCH  Name:Declan Finch  Time:  05:30",
  "Operating Report for:Depot RM, Owning Ctrl NE, 18/09/26 to 19/09/26. ",
  "DIAGRAM  DATE  FROM  DEP.  ARR.  TO  TRAINID  DEPOT  PLANNED  ALLOCATED  RESOURCE  OWNING   DISCREPANCY",
  "RM007  18/09/26  ASHFDNS  22:10  22:30  ASHFKY  5R90BA  RM  375/6  375/9  375930  NE  Fleet mismatch.",
  "RM007  18/09/26  ASHFKY  22:40  23:50  DOVERP  2R90BA  RM  375/6  375/9  375930  NE  Fleet mismatch.",
  "RM007  18/09/26  DOVERP  00:20  00:45  DOVERPS  5R94BA  RM  375/6  375/9  375930  NE  Fleet mismatch.",
  "RM008  18/09/26  CHRX  12:15  13:47  HASTING  1H32BA  RM  375/6  375/9  375931  NE  Fleet mismatch.",
  "RM008  18/09/26  HASTING  22:03  22:30  STLNWCS  5H16BD  RM  375/6  375/9  375931  NE  Fleet mismatch.",
  "RM008  18/09/26  STLNWCS  05:27  06:07  HASTING  5H58BA  RM  375/6  375/9  375932  NE  Fleet mismatch.",
  "RM008  18/09/26  HASTING  10:30  12:03  CHRX  1H74BA  RM  375/6  375/9  375932  NE  Fleet mismatch.",
];
export const MIDNIGHT_DETAIL_LINES = [
  "GENIUS  Diagram Detail Report",
  "Diagram RM 0 0 7 On 18/09/26",
  "ASHFDNS  Ashford Dn Sdgs  22:10  5R90BA",
  "ASHFKY  Ashford Kent  22:30  22:40  2R90BA",
  "DOVERP  Dover Priory  23:50  00:20  5R94BA",
  "DOVERPS  Dover Priory Sdgs  00:45",
  "Diagram RM 0 0 8 On 18/09/26",
  "STLNWCS  St Leonards WM  05:27  5H58BA",
  "HASTING  Hastings  06:07  10:30  1H74BA",
  "CHRX  London Charing X  12:03  12:15  1H32BA",
  "HASTING  Hastings  13:47  22:03  5H16BD",
  "STLNWCS  St Leonards WM  22:30",
];
