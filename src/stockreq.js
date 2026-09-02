/* The Kent Coast stock requirements form, filled from the day's plan.

   The depot keeps this as a blank spreadsheet - thirteen locations down
   the side, the five mainline unit types across the top, POSITION and
   SEAT LOSS beside them - and fills it in by hand on a Sunday night or
   before a bank holiday: how many of each type must be standing at each
   place when the next morning opens.

   The plan already knows that number: it is the diagrams starting the
   day out of each location, counted per section by fleet type (see the
   stock collector in genius.js) - the same figure a person gets running a
   finger down a section's morning departures in the book, which is the
   check the depot makes. So this writes the depot's own form with the
   counts filled in and POSITION and SEAT LOSS left for the planner,
   whose judgement they are.

   Not a lookalike, the form itself: the styleSheet below is lifted
   verbatim from the depot's BLANK_STOCK_REQUIREMENTS workbook - the same
   route the 395 allocation sheet takes through writeWorkbook - and every
   cell names the exact style record the blank gives that cell, so the
   file and the preview carry the blank's own grey header band, red SEAT
   LOSS figures, medium-and-thin rules, column widths, 0.16" margins and
   83% print scale. */
const SHEETS_STOCKREQ = (() => {
const X = SHEETS_XLSX;

/* The form's columns, left to right, by the book's own fleet label. */
const TYPES = [["4 375-9", "375/9"], ["4 375", "375"], ["3 375", "375/3"],
               ["4 377", "377"], ["5 376", "5 376"]];

/* ---- the blank workbook's own dress ---- */
const STYLES_XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="3"><numFmt numFmtId="164" formatCode="General"/><numFmt numFmtId="165" formatCode="@"/><numFmt numFmtId="166" formatCode="0"/></numFmts><fonts count="10"><font><sz val="10"/><name val="Arial"/><family val="0"/></font><font><sz val="10"/><name val="Arial"/><family val="0"/></font><font><sz val="10"/><name val="Arial"/><family val="0"/></font><font><sz val="10"/><name val="Arial"/><family val="0"/></font><font><b val="true"/><sz val="14"/><name val="Arial"/><family val="2"/></font><font><sz val="10"/><name val="Arial"/><family val="2"/></font><font><sz val="11"/><name val="Arial"/><family val="2"/></font><font><sz val="16"/><color rgb="FFFF0000"/><name val="Arial"/><family val="2"/></font><font><b val="true"/><i val="true"/><sz val="14"/><name val="Arial"/><family val="2"/></font><font><sz val="14"/><name val="Arial"/><family val="2"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE3E3E3"/><bgColor rgb="FFCCFFCC"/></patternFill></fill></fills><borders count="24"><border diagonalUp="false" diagonalDown="false"><left/><right/><top/><bottom/><diagonal/></border><border diagonalUp="false" diagonalDown="false"><left style="medium"/><right/><top style="medium"/><bottom style="medium"/><diagonal/></border><border diagonalUp="false" diagonalDown="false"><left style="thin"/><right/><top style="medium"/><bottom style="medium"/><diagonal/></border><border diagonalUp="false" diagonalDown="false"><left style="thin"/><right style="medium"/><top style="medium"/><bottom style="medium"/><diagonal/></border><border diagonalUp="false" diagonalDown="false"><left/><right style="medium"/><top style="medium"/><bottom style="medium"/><diagonal/></border><border diagonalUp="false" diagonalDown="false"><left style="medium"/><right style="medium"/><top style="medium"/><bottom/><diagonal/></border><border diagonalUp="false" diagonalDown="false"><left style="thin"/><right/><top style="medium"/><bottom/><diagonal/></border><border diagonalUp="false" diagonalDown="false"><left style="thin"/><right style="medium"/><top style="medium"/><bottom/><diagonal/></border><border diagonalUp="false" diagonalDown="false"><left/><right/><top style="medium"/><bottom/><diagonal/></border><border diagonalUp="false" diagonalDown="false"><left style="medium"/><right style="medium"/><top/><bottom style="medium"/><diagonal/></border><border diagonalUp="false" diagonalDown="false"><left style="thin"/><right/><top/><bottom style="medium"/><diagonal/></border><border diagonalUp="false" diagonalDown="false"><left style="thin"/><right style="medium"/><top/><bottom style="medium"/><diagonal/></border><border diagonalUp="false" diagonalDown="false"><left/><right/><top/><bottom style="medium"/><diagonal/></border><border diagonalUp="false" diagonalDown="false"><left style="medium"/><right style="medium"/><top/><bottom/><diagonal/></border><border diagonalUp="false" diagonalDown="false"><left style="thin"/><right/><top/><bottom/><diagonal/></border><border diagonalUp="false" diagonalDown="false"><left style="thin"/><right style="medium"/><top/><bottom/><diagonal/></border><border diagonalUp="false" diagonalDown="false"><left/><right style="medium"/><top/><bottom/><diagonal/></border><border diagonalUp="false" diagonalDown="false"><left style="medium"/><right style="medium"/><top style="medium"/><bottom style="medium"/><diagonal/></border><border diagonalUp="false" diagonalDown="false"><left/><right style="medium"/><top style="medium"/><bottom/><diagonal/></border><border diagonalUp="false" diagonalDown="false"><left/><right style="medium"/><top/><bottom style="medium"/><diagonal/></border><border diagonalUp="false" diagonalDown="false"><left style="medium"/><right style="thin"/><top style="medium"/><bottom/><diagonal/></border><border diagonalUp="false" diagonalDown="false"><left style="medium"/><right style="thin"/><top/><bottom style="medium"/><diagonal/></border><border diagonalUp="false" diagonalDown="false"><left style="medium"/><right/><top style="medium"/><bottom/><diagonal/></border><border diagonalUp="false" diagonalDown="false"><left style="medium"/><right/><top/><bottom style="medium"/><diagonal/></border></borders><cellStyleXfs count="20"><xf numFmtId="164" fontId="0" fillId="0" borderId="0" applyFont="true" applyBorder="true" applyAlignment="true" applyProtection="true"><alignment horizontal="general" vertical="bottom" textRotation="0" wrapText="false" indent="0" shrinkToFit="false"/><protection locked="true" hidden="false"/></xf><xf numFmtId="0" fontId="1" fillId="0" borderId="0" applyFont="true" applyBorder="false" applyAlignment="false" applyProtection="false"></xf><xf numFmtId="0" fontId="1" fillId="0" borderId="0" applyFont="true" applyBorder="false" applyAlignment="false" applyProtection="false"></xf><xf numFmtId="0" fontId="2" fillId="0" borderId="0" applyFont="true" applyBorder="false" applyAlignment="false" applyProtection="false"></xf><xf numFmtId="0" fontId="2" fillId="0" borderId="0" applyFont="true" applyBorder="false" applyAlignment="false" applyProtection="false"></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="0" applyFont="true" applyBorder="false" applyAlignment="false" applyProtection="false"></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="0" applyFont="true" applyBorder="false" applyAlignment="false" applyProtection="false"></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="0" applyFont="true" applyBorder="false" applyAlignment="false" applyProtection="false"></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="0" applyFont="true" applyBorder="false" applyAlignment="false" applyProtection="false"></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="0" applyFont="true" applyBorder="false" applyAlignment="false" applyProtection="false"></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="0" applyFont="true" applyBorder="false" applyAlignment="false" applyProtection="false"></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="0" applyFont="true" applyBorder="false" applyAlignment="false" applyProtection="false"></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="0" applyFont="true" applyBorder="false" applyAlignment="false" applyProtection="false"></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="0" applyFont="true" applyBorder="false" applyAlignment="false" applyProtection="false"></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="0" applyFont="true" applyBorder="false" applyAlignment="false" applyProtection="false"></xf><xf numFmtId="43" fontId="1" fillId="0" borderId="0" applyFont="true" applyBorder="false" applyAlignment="false" applyProtection="false"></xf><xf numFmtId="41" fontId="1" fillId="0" borderId="0" applyFont="true" applyBorder="false" applyAlignment="false" applyProtection="false"></xf><xf numFmtId="44" fontId="1" fillId="0" borderId="0" applyFont="true" applyBorder="false" applyAlignment="false" applyProtection="false"></xf><xf numFmtId="42" fontId="1" fillId="0" borderId="0" applyFont="true" applyBorder="false" applyAlignment="false" applyProtection="false"></xf><xf numFmtId="9" fontId="1" fillId="0" borderId="0" applyFont="true" applyBorder="false" applyAlignment="false" applyProtection="false"></xf></cellStyleXfs><cellXfs count="43"><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyFont="false" applyBorder="false" applyAlignment="false" applyProtection="false"><alignment horizontal="general" vertical="bottom" textRotation="0" wrapText="false" indent="0" shrinkToFit="false"/><protection locked="true" hidden="false"/></xf><xf numFmtId="164" fontId="4" fillId="0" borderId="0" xfId="0" applyFont="true" applyBorder="false" applyAlignment="true" applyProtection="false"><alignment horizontal="center" vertical="bottom" textRotation="0" wrapText="false" indent="0" shrinkToFit="false"/><protection locked="true" hidden="false"/></xf><xf numFmtId="164" fontId="5" fillId="0" borderId="0" xfId="0" applyFont="true" applyBorder="false" applyAlignment="false" applyProtection="false"><alignment horizontal="general" vertical="bottom" textRotation="0" wrapText="false" indent="0" shrinkToFit="false"/><protection locked="true" hidden="false"/></xf><xf numFmtId="165" fontId="4" fillId="0" borderId="0" xfId="0" applyFont="true" applyBorder="true" applyAlignment="true" applyProtection="false"><alignment horizontal="center" vertical="bottom" textRotation="0" wrapText="false" indent="0" shrinkToFit="false"/><protection locked="true" hidden="false"/></xf><xf numFmtId="165" fontId="4" fillId="2" borderId="1" xfId="0" applyFont="true" applyBorder="true" applyAlignment="true" applyProtection="false"><alignment horizontal="center" vertical="bottom" textRotation="0" wrapText="false" indent="0" shrinkToFit="false"/><protection locked="true" hidden="false"/></xf><xf numFmtId="165" fontId="4" fillId="2" borderId="2" xfId="0" applyFont="true" applyBorder="true" applyAlignment="true" applyProtection="false"><alignment horizontal="center" vertical="bottom" textRotation="0" wrapText="false" indent="0" shrinkToFit="false"/><protection locked="true" hidden="false"/></xf><xf numFmtId="165" fontId="4" fillId="2" borderId="3" xfId="0" applyFont="true" applyBorder="true" applyAlignment="true" applyProtection="false"><alignment horizontal="center" vertical="bottom" textRotation="0" wrapText="false" indent="0" shrinkToFit="false"/><protection locked="true" hidden="false"/></xf><xf numFmtId="165" fontId="4" fillId="2" borderId="4" xfId="0" applyFont="true" applyBorder="true" applyAlignment="true" applyProtection="false"><alignment horizontal="center" vertical="bottom" textRotation="0" wrapText="false" indent="0" shrinkToFit="false"/><protection locked="true" hidden="false"/></xf><xf numFmtId="165" fontId="4" fillId="2" borderId="5" xfId="0" applyFont="true" applyBorder="true" applyAlignment="true" applyProtection="false"><alignment horizontal="center" vertical="bottom" textRotation="0" wrapText="false" indent="0" shrinkToFit="false"/><protection locked="true" hidden="false"/></xf><xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyFont="false" applyBorder="false" applyAlignment="false" applyProtection="false"><alignment horizontal="general" vertical="bottom" textRotation="0" wrapText="false" indent="0" shrinkToFit="false"/><protection locked="true" hidden="false"/></xf><xf numFmtId="165" fontId="4" fillId="0" borderId="5" xfId="0" applyFont="true" applyBorder="true" applyAlignment="true" applyProtection="false"><alignment horizontal="center" vertical="bottom" textRotation="0" wrapText="false" indent="0" shrinkToFit="false"/><protection locked="true" hidden="false"/></xf><xf numFmtId="166" fontId="4" fillId="0" borderId="6" xfId="0" applyFont="true" applyBorder="true" applyAlignment="true" applyProtection="false"><alignment horizontal="center" vertical="bottom" textRotation="0" wrapText="false" indent="0" shrinkToFit="false"/><protection locked="true" hidden="false"/></xf><xf numFmtId="166" fontId="4" fillId="0" borderId="7" xfId="0" applyFont="true" applyBorder="true" applyAlignment="true" applyProtection="false"><alignment horizontal="center" vertical="bottom" textRotation="0" wrapText="false" indent="0" shrinkToFit="false"/><protection locked="true" hidden="false"/></xf><xf numFmtId="166" fontId="4" fillId="0" borderId="8" xfId="0" applyFont="true" applyBorder="true" applyAlignment="true" applyProtection="false"><alignment horizontal="center" vertical="bottom" textRotation="0" wrapText="false" indent="0" shrinkToFit="false"/><protection locked="true" hidden="false"/></xf><xf numFmtId="165" fontId="6" fillId="0" borderId="5" xfId="0" applyFont="true" applyBorder="true" applyAlignment="false" applyProtection="false"><alignment horizontal="general" vertical="bottom" textRotation="0" wrapText="false" indent="0" shrinkToFit="false"/><protection locked="true" hidden="false"/></xf><xf numFmtId="164" fontId="7" fillId="0" borderId="4" xfId="0" applyFont="true" applyBorder="true" applyAlignment="true" applyProtection="false"><alignment horizontal="center" vertical="center" textRotation="0" wrapText="false" indent="0" shrinkToFit="false"/><protection locked="true" hidden="false"/></xf><xf numFmtId="165" fontId="4" fillId="0" borderId="9" xfId="0" applyFont="true" applyBorder="true" applyAlignment="true" applyProtection="false"><alignment horizontal="center" vertical="bottom" textRotation="0" wrapText="false" indent="0" shrinkToFit="false"/><protection locked="true" hidden="false"/></xf><xf numFmtId="166" fontId="4" fillId="0" borderId="10" xfId="0" applyFont="true" applyBorder="true" applyAlignment="true" applyProtection="false"><alignment horizontal="center" vertical="bottom" textRotation="0" wrapText="false" indent="0" shrinkToFit="false"/><protection locked="true" hidden="false"/></xf><xf numFmtId="166" fontId="4" fillId="0" borderId="11" xfId="0" applyFont="true" applyBorder="true" applyAlignment="true" applyProtection="false"><alignment horizontal="center" vertical="bottom" textRotation="0" wrapText="false" indent="0" shrinkToFit="false"/><protection locked="true" hidden="false"/></xf><xf numFmtId="166" fontId="4" fillId="0" borderId="12" xfId="0" applyFont="true" applyBorder="true" applyAlignment="true" applyProtection="false"><alignment horizontal="center" vertical="bottom" textRotation="0" wrapText="false" indent="0" shrinkToFit="false"/><protection locked="true" hidden="false"/></xf><xf numFmtId="165" fontId="6" fillId="0" borderId="9" xfId="0" applyFont="true" applyBorder="true" applyAlignment="false" applyProtection="false"><alignment horizontal="general" vertical="bottom" textRotation="0" wrapText="false" indent="0" shrinkToFit="false"/><protection locked="true" hidden="false"/></xf><xf numFmtId="165" fontId="4" fillId="0" borderId="13" xfId="0" applyFont="true" applyBorder="true" applyAlignment="true" applyProtection="false"><alignment horizontal="center" vertical="bottom" textRotation="0" wrapText="false" indent="0" shrinkToFit="false"/><protection locked="true" hidden="false"/></xf><xf numFmtId="166" fontId="4" fillId="0" borderId="14" xfId="0" applyFont="true" applyBorder="true" applyAlignment="true" applyProtection="false"><alignment horizontal="center" vertical="bottom" textRotation="0" wrapText="false" indent="0" shrinkToFit="false"/><protection locked="true" hidden="false"/></xf><xf numFmtId="166" fontId="4" fillId="0" borderId="15" xfId="0" applyFont="true" applyBorder="true" applyAlignment="true" applyProtection="false"><alignment horizontal="center" vertical="bottom" textRotation="0" wrapText="false" indent="0" shrinkToFit="false"/><protection locked="true" hidden="false"/></xf><xf numFmtId="166" fontId="4" fillId="0" borderId="16" xfId="0" applyFont="true" applyBorder="true" applyAlignment="true" applyProtection="false"><alignment horizontal="center" vertical="bottom" textRotation="0" wrapText="false" indent="0" shrinkToFit="false"/><protection locked="true" hidden="false"/></xf><xf numFmtId="165" fontId="6" fillId="0" borderId="13" xfId="0" applyFont="true" applyBorder="true" applyAlignment="false" applyProtection="false"><alignment horizontal="general" vertical="bottom" textRotation="0" wrapText="false" indent="0" shrinkToFit="false"/><protection locked="true" hidden="false"/></xf><xf numFmtId="166" fontId="7" fillId="0" borderId="17" xfId="0" applyFont="true" applyBorder="true" applyAlignment="true" applyProtection="false"><alignment horizontal="center" vertical="center" textRotation="0" wrapText="false" indent="0" shrinkToFit="false"/><protection locked="true" hidden="false"/></xf><xf numFmtId="166" fontId="4" fillId="0" borderId="18" xfId="0" applyFont="true" applyBorder="true" applyAlignment="true" applyProtection="false"><alignment horizontal="center" vertical="bottom" textRotation="0" wrapText="false" indent="0" shrinkToFit="false"/><protection locked="true" hidden="false"/></xf><xf numFmtId="166" fontId="4" fillId="0" borderId="19" xfId="0" applyFont="true" applyBorder="true" applyAlignment="true" applyProtection="false"><alignment horizontal="center" vertical="bottom" textRotation="0" wrapText="false" indent="0" shrinkToFit="false"/><protection locked="true" hidden="false"/></xf><xf numFmtId="165" fontId="8" fillId="0" borderId="9" xfId="0" applyFont="true" applyBorder="true" applyAlignment="true" applyProtection="false"><alignment horizontal="center" vertical="bottom" textRotation="0" wrapText="false" indent="0" shrinkToFit="false"/><protection locked="true" hidden="false"/></xf><xf numFmtId="166" fontId="7" fillId="0" borderId="5" xfId="0" applyFont="true" applyBorder="true" applyAlignment="true" applyProtection="false"><alignment horizontal="center" vertical="center" textRotation="0" wrapText="false" indent="0" shrinkToFit="false"/><protection locked="true" hidden="false"/></xf><xf numFmtId="166" fontId="7" fillId="0" borderId="9" xfId="0" applyFont="true" applyBorder="true" applyAlignment="true" applyProtection="false"><alignment horizontal="center" vertical="center" textRotation="0" wrapText="false" indent="0" shrinkToFit="false"/><protection locked="true" hidden="false"/></xf><xf numFmtId="166" fontId="4" fillId="0" borderId="20" xfId="0" applyFont="true" applyBorder="true" applyAlignment="true" applyProtection="false"><alignment horizontal="center" vertical="bottom" textRotation="0" wrapText="false" indent="0" shrinkToFit="false"/><protection locked="true" hidden="false"/></xf><xf numFmtId="166" fontId="4" fillId="0" borderId="21" xfId="0" applyFont="true" applyBorder="true" applyAlignment="true" applyProtection="false"><alignment horizontal="center" vertical="bottom" textRotation="0" wrapText="false" indent="0" shrinkToFit="false"/><protection locked="true" hidden="false"/></xf><xf numFmtId="165" fontId="4" fillId="0" borderId="22" xfId="0" applyFont="true" applyBorder="true" applyAlignment="true" applyProtection="false"><alignment horizontal="center" vertical="bottom" textRotation="0" wrapText="false" indent="0" shrinkToFit="false"/><protection locked="true" hidden="false"/></xf><xf numFmtId="164" fontId="7" fillId="0" borderId="17" xfId="0" applyFont="true" applyBorder="true" applyAlignment="true" applyProtection="false"><alignment horizontal="center" vertical="center" textRotation="0" wrapText="false" indent="0" shrinkToFit="false"/><protection locked="true" hidden="false"/></xf><xf numFmtId="165" fontId="4" fillId="0" borderId="23" xfId="0" applyFont="true" applyBorder="true" applyAlignment="true" applyProtection="false"><alignment horizontal="center" vertical="bottom" textRotation="0" wrapText="false" indent="0" shrinkToFit="false"/><protection locked="true" hidden="false"/></xf><xf numFmtId="166" fontId="4" fillId="0" borderId="0" xfId="0" applyFont="true" applyBorder="true" applyAlignment="true" applyProtection="false"><alignment horizontal="center" vertical="bottom" textRotation="0" wrapText="false" indent="0" shrinkToFit="false"/><protection locked="true" hidden="false"/></xf><xf numFmtId="165" fontId="6" fillId="2" borderId="17" xfId="0" applyFont="true" applyBorder="true" applyAlignment="true" applyProtection="false"><alignment horizontal="center" vertical="center" textRotation="0" wrapText="false" indent="0" shrinkToFit="false"/><protection locked="true" hidden="false"/></xf><xf numFmtId="166" fontId="7" fillId="2" borderId="17" xfId="0" applyFont="true" applyBorder="true" applyAlignment="true" applyProtection="false"><alignment horizontal="center" vertical="center" textRotation="0" wrapText="false" indent="0" shrinkToFit="false"/><protection locked="true" hidden="false"/></xf><xf numFmtId="165" fontId="4" fillId="0" borderId="0" xfId="0" applyFont="true" applyBorder="false" applyAlignment="true" applyProtection="false"><alignment horizontal="center" vertical="bottom" textRotation="0" wrapText="false" indent="0" shrinkToFit="false"/><protection locked="true" hidden="false"/></xf><xf numFmtId="165" fontId="9" fillId="0" borderId="0" xfId="0" applyFont="true" applyBorder="false" applyAlignment="false" applyProtection="false"><alignment horizontal="general" vertical="bottom" textRotation="0" wrapText="false" indent="0" shrinkToFit="false"/><protection locked="true" hidden="false"/></xf><xf numFmtId="165" fontId="5" fillId="0" borderId="0" xfId="0" applyFont="true" applyBorder="false" applyAlignment="false" applyProtection="false"><alignment horizontal="general" vertical="bottom" textRotation="0" wrapText="false" indent="0" shrinkToFit="false"/><protection locked="true" hidden="false"/></xf></cellXfs><cellStyles count="6"><cellStyle name="Normal" xfId="0" builtinId="0"/><cellStyle name="Comma" xfId="15" builtinId="3"/><cellStyle name="Comma [0]" xfId="16" builtinId="6"/><cellStyle name="Currency" xfId="17" builtinId="4"/><cellStyle name="Currency [0]" xfId="18" builtinId="7"/><cellStyle name="Percent" xfId="19" builtinId="5"/></cellStyles></styleSheet>';
/* its own columns: 21.1 characters for the names, five at 10.7,
   POSITION 29.4, SEAT LOSS 18.7 - which its 0.16" side margins fit */
const COLS_XML = '<cols>' +
  '<col min="1" max="1" style="1" width="21.13" customWidth="1"/>' +
  '<col min="2" max="6" style="2" width="10.71" customWidth="1"/>' +
  '<col min="7" max="7" width="29.41" customWidth="1"/>' +
  '<col min="8" max="8" width="18.7" customWidth="1"/></cols>';
const WIDTHS = [21.13, 10.71, 10.71, 10.71, 10.71, 10.71, 29.41, 18.7, 9.05];
const MARGINS = { l: 0.157638888888889, r: 0.157638888888889,
                  t: 0.770138888888889, b: 0.429861111111111,
                  hd: 0.270138888888889, ft: 0.118055555555556 };

/* The form's rows, top to bottom, each carrying the blank's style-record
   ids for its two rows (columns A..H, read out of the blank's own
   worksheet), its two row heights, and - see `loose` - whether the blank
   left the SEAT LOSS pair unmerged. The records differ block by block
   because the form is hand-made: the POSITION column is one open box
   from header to Total with top rules over only some blocks, Slade
   Green's SEAT LOSS wears an all-round box of its own, Grove Park's
   name row stands taller. Copying the map, quirks and all, is what
   reproduces the form. HASTINGS has no row: the form folds it into West
   Marina - "(Inc HASTINGS)" is printed on the form itself. */
const ROWS = [
  { sec: "ASHFORD",         name: ["ASHFORD"],
    xf: [[10,11,11,11,12,13,14,15], [16,17,17,17,18,19,20,15]], ht: [18, 18.75] },
  { sec: "DOVER PRIORY",    name: ["DOVER PRIORY"],
    xf: [[21,22,22,22,23,24,25,26], [21,22,22,22,23,24,25,26]], ht: [18, 18.75] },
  { sec: "FAVERSHAM",       name: ["FAVERSHAM"],
    xf: [[10,11,11,11,12,27,14,26], [16,17,17,17,18,28,20,26]], ht: [18, 18.75] },
  { sec: "FOLKESTONE EAST", name: ["FOLKESTONE", "EAST"],
    xf: [[21,22,22,22,23,24,25,26], [21,22,22,22,23,24,25,26]], ht: [18, 18.75] },
  { sec: "GILLINGHAM",      name: ["GILLINGHAM"],
    xf: [[10,11,11,11,12,27,14,26], [16,17,17,17,18,28,25,26]], ht: [18, 18.75] },
  { sec: "GROVE PARK",      name: ["GROVE PARK"],
    xf: [[21,11,11,11,12,27,14,26], [29,17,17,17,18,28,25,26]], ht: [20.25, 19.5] },
  { sec: "ORPINGTON",       name: ["ORPINGTON"],
    xf: [[10,11,11,11,12,27,14,30], [16,17,17,17,18,28,20,31]], ht: [18.75, 18.75],
    loose: true },
  { sec: "TONBRIDGE",       name: ["TONBRIDGE"],
    xf: [[10,11,11,11,12,27,14,26], [16,17,17,17,18,28,20,26]], ht: [18, 18.75] },
  { sec: "STROOD",          name: ["STROOD"],
    xf: [[10,11,11,11,12,27,14,30], [16,17,17,17,18,28,20,31]], ht: [18.75, 18.75],
    loose: true },
  { sec: "VICTORIA",        name: ["VICTORIA"],
    xf: [[21,22,22,22,23,24,25,31], [16,17,17,17,18,28,20,31]], ht: [18, 18.75] },
  { sec: "WEST MARINA",     name: ["WEST MARINA", "(Inc HASTINGS)"], also: ["HASTINGS"],
    xf: [[10,11,11,11,12,27,14,26], [21,22,22,22,23,24,25,26]], ht: [18, 18.75] },
  { sec: "RAMSGATE",        name: ["RAMSGATE"],
    xf: [[10,32,11,11,12,27,14,26], [16,33,17,17,18,28,20,26]], ht: [18, 18.75] },
  { sec: "SLADE GREEN",     name: ["SLADE GREEN"],
    xf: [[34,32,11,11,12,27,14,35], [36,33,17,17,18,28,25,35]], ht: [18, 18.75] },
];
/* An appended section wears the commonest of the blank's block dressings
   (Faversham's), so an extra row reads like a printed one. */
const EXTRA_XF = [[10,11,11,11,12,27,14,26], [16,17,17,17,18,28,20,26]];
const HEAD_XF  = [3, 4, 5, 5, 6, 7, 8, 7];
const TOTAL_XF = [3, 37, 37, 37, 37, 37, 38, 39];
const I_XF = 9;    // the blank styles a spare ninth column all the way down

/* The same records again as CSS, one per style record, derived from the
   very styleSheet the workbook ships - preview and file cannot drift.
   (The 395 sheet bakes its CSS into the skin; this styleSheet is small
   enough to read at load instead.) */
const XF_CSS = (() => {
  const section = tag =>
    ((STYLES_XML.match(new RegExp("<" + tag + "s[^>]*>([\\s\\S]*?)</" + tag + "s>")) ||
      [])[1] || "").split("</" + tag + ">").slice(0, -1);
  const fonts = section("font").map(f => {
    const sz = (/<sz val="([\d.]+)"/.exec(f) || [])[1] || "10";
    const col = (/<color rgb="FF(\w{6})"/.exec(f) || [])[1];
    return "font-size:" + sz + "pt;" +
      (f.indexOf("<b ") >= 0 || f.indexOf("<b/>") >= 0 ? "font-weight:700;" : "") +
      (f.indexOf("<i ") >= 0 || f.indexOf("<i/>") >= 0 ? "font-style:italic;" : "") +
      (col && col !== "000000" ? "color:#" + col + ";" : "");
  });
  const fills = section("fill").map(f => {
    const g = /patternType="solid"><fgColor rgb="FF(\w{6})"/.exec(f);
    return g ? "background:#" + g[1] + ";" : "";
  });
  const SIDE = { medium: "2px solid #000", thin: "1px solid #000" };
  const borders = section("border").map(b =>
    ["left", "right", "top", "bottom"].map(side => {
      const s = (new RegExp("<" + side + ' style="(\\w+)"').exec(b) || [])[1];
      return "border-" + side + ":" + (SIDE[s] || "0") + ";";
    }).join(""));
  const at = (x, k) => +((new RegExp(k + '="(\\d+)"').exec(x) || [0, 0])[1]);
  return ((STYLES_XML.match(/<cellXfs[^>]*>([\s\S]*?)<\/cellXfs>/) || [])[1] || "")
    .split("</xf>").slice(0, -1).map(x =>
      borders[at(x, "borderId")] + fonts[at(x, "fontId")] + fills[at(x, "fillId")] +
      "text-align:" + (x.indexOf('horizontal="center"') >= 0 ? "center" : "left") + ";");
})();

/* One day's form. stock: Map(section -> Map(fleet label -> count)). */
function layout(stock, dateLabel) {
  const cells = [], merges = [], rowHeights = new Map();
  const put = (r, c, xf, v, num) => cells.push({ r, c, xf, v, num: !!num });

  /* header row: the five types, POSITION, SEAT LOSS, on the grey band */
  put(1, 1, HEAD_XF[0], "");
  TYPES.forEach(([, head], i) => put(1, 2 + i, HEAD_XF[1 + i], head));
  put(1, 7, HEAD_XF[6], "POSITION");
  put(1, 8, HEAD_XF[7], "SEAT LOSS");
  put(1, 9, I_XF, "");
  rowHeights.set(1, 18.75);

  /* Sections the plan opened stock at that the form has no row for are
     appended as extra blocks rather than dropped: a unit standing at
     Dartford is still a unit somebody has to know about. */
  const named = new Set();
  for (const row of ROWS) { named.add(row.sec); (row.also || []).forEach(s => named.add(s)); }
  const extras = [...stock.keys()].filter(s => !named.has(s)).sort()
    .map(sec => ({ sec, name: [sec], xf: EXTRA_XF, ht: [18, 18.75] }));

  let r = 2;
  for (const row of ROWS.concat(extras)) {
    const counts = new Map(stock.get(row.sec) || []);
    for (const other of row.also || [])
      for (const [cls, n] of stock.get(other) || [])
        counts.set(cls, (counts.get(cls) || 0) + n);
    const [x1, x2] = row.xf;
    put(r, 1, x1[0], row.name[0]);
    put(r + 1, 1, x2[0], row.name[1] || "");
    TYPES.forEach(([cls], i) => {
      const n = counts.get(cls) || 0;
      put(r, 2 + i, x1[1 + i], n || "", n > 0);   // a zero prints as blank
      put(r + 1, 2 + i, x2[1 + i], "");
    });
    put(r, 7, x1[6], "");                  // POSITION: the planner's
    put(r + 1, 7, x2[6], "");
    put(r, 8, x1[7], 0, true);             // SEAT LOSS: theirs too
    put(r + 1, 8, x2[7], "");
    put(r, 9, I_XF, "");
    put(r + 1, 9, I_XF, "");
    /* Orpington's and Strood's pairs the blank never merged - their
       border records already draw one box - so neither does this. */
    if (!row.loose) merges.push("H" + r + ":H" + (r + 1));
    rowHeights.set(r, row.ht[0]);
    rowHeights.set(r + 1, row.ht[1]);
    r += 2;
  }

  /* the foot: SEAT LOSS totalled, exactly as the blank form does it */
  for (let c = 1; c <= 9; c++) {
    const xf = c === 9 ? I_XF : TOTAL_XF[c - 1];
    put(r, c, xf, c === 7 ? "Total" : "");
    put(r + 1, c, xf, "");
  }
  /* the formula the file carries; the 0 is what the preview shows for it */
  const total = cells.find(c => c.r === r && c.c === 8);
  total.f = "SUM(H2:H" + (r - 1) + ")";
  total.v = 0;
  merges.push("G" + r + ":G" + (r + 1));
  merges.push("H" + r + ":H" + (r + 1));
  rowHeights.set(r, 18);
  rowHeights.set(r + 1, 18.75);

  return { cells, merges, rowHeights, maxRow: r + 2, opts: {
    /* the blank's own styleSheet, columns, margins and 83% print scale -
       writeWorkbook's raw dressing, the 395 allocation sheet's route */
    stylesXml: STYLES_XML, colsXml: COLS_XML, widths: WIDTHS, lastCol: "I",
    margins: MARGINS, scale: 83, defaultRowHeight: 18, xfCss: XF_CSS,
    /* each two-row block holds together if extras run past the page */
    blockRows: ROWS.concat(extras).map((_, i) => 2 + i * 2),
    /* the blank's own printed heading, with the date filled in
       rather than left as blanks to write on */
    headerXml: '<headerFooter differentFirst="false" differentOddEven="false">' +
      '<oddHeader>&amp;C&amp;"Arial,Bold Italic"&amp;14&amp;U' +
      'KENT COAST STOCK REQUIREMENTS &#10;FOR  ' + X.esc(dateLabel || "") +
      '</oddHeader><oddFooter>&amp;C&amp;D</oddFooter></headerFooter>',
  } };
}

/* The on-card preview: the same layout the workbook writes, in the same
   records, under the printed page heading. */
function previewHtml(stock, dateLabel) {
  return '<div class="stockpage"><div class="stockhead">' +
    'KENT COAST STOCK REQUIREMENTS<br>FOR&nbsp; ' + X.esc(dateLabel || "") +
    '</div>' + X.previewHtml(layout(stock, dateLabel)) + '</div>';
}

/* The workbook: a tab per day that has any stock, named like the books'. */
function write(stockByDay, labels, zipFn) {
  const sheets = [];
  for (const dk of Object.keys(stockByDay)) {
    const stock = stockByDay[dk];
    if (!stock || !stock.size) continue;
    sheets.push({ name: X.DAY_SHEET[dk] || dk,
                  layout: layout(stock, labels[dk] || "") });
  }
  if (!sheets.length) return null;
  return X.writeWorkbook(sheets, zipFn);
}

/* How many units the form asks for in all - the card's one-line summary. */
function unitCount(stockByDay) {
  let n = 0;
  for (const dk of Object.keys(stockByDay))
    for (const g of (stockByDay[dk] || new Map()).values())
      for (const c of g.values()) n += c;
  return n;
}

return { layout, write, previewHtml, unitCount, XF_CSS };
})();
if (typeof module !== "undefined" && module.exports) module.exports = SHEETS_STOCKREQ;
if (typeof globalThis !== "undefined") globalThis.SHEETS_STOCKREQ = SHEETS_STOCKREQ;
