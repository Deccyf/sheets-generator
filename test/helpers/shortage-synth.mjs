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
