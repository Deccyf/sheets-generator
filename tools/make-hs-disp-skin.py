# Build src/hs-disp-skin.js: the Class 395 Disposition Statement's own
# dress, lifted verbatim from the operator's workbook and renumbered into a
# minimal styleSheet - the way tools/make-hs-skin.py lifts the Allocations
# Sheet. Layout and house text only: no unit numbers, diagrams, dates,
# counts or comments come with it, and the text is allow-listed at the end.
import re, json, sys, zipfile, colorsys

# The operator's workbook is NOT in the repository and never will be:
#
#     python3 tools/make-hs-disp-skin.py "Class 395 Disposition Sheet.xlsx"
#
DEFAULT = ("/root/.claude/uploads/a92fd59d-eda0-5a2d-858d-3481c8939b31/"
           "cd9e414a-Actual_Version_1_Class_395_Disposition_Sheet_20-09-2026.xlsx")
src = sys.argv[1] if len(sys.argv) > 1 else DEFAULT
try:
    Z = zipfile.ZipFile(src)
except (FileNotFoundError, IsADirectoryError):
    raise SystemExit("Cannot open %r.\nPass the operator's Class 395 Disposition "
                     "Sheet as the first argument - it is not in this repository." % src)

def unesc(t):
    for a, b in [("&lt;", "<"), ("&gt;", ">"), ("&quot;", '"'), ("&apos;", "'"), ("&amp;", "&")]:
        t = t.replace(a, b)
    return t
st = Z.read('xl/styles.xml').decode()
# the Disposition Sheet is the first tab; checked by name, not trusted by number
wb = Z.read('xl/workbook.xml').decode()
wb_rels = Z.read('xl/_rels/workbook.xml.rels').decode()
rid_target = dict(re.findall(r'Id="([^"]+)"[^>]*Target="([^"]+)"', wb_rels))
SHEET_PART = None
for m in re.finditer(r'<sheet name="([^"]+)"[^>]*r:id="([^"]+)"', wb):
    if m.group(1).strip().lower() == "disposition sheet":
        tgt = rid_target[m.group(2)]
        SHEET_PART = tgt.lstrip("/") if tgt.startswith("/") else "xl/" + tgt
assert SHEET_PART, "no tab called 'Disposition Sheet' in this workbook"
sheet = Z.read(SHEET_PART).decode()
ss = [unesc("".join(re.findall(r'<t[^>]*>(.*?)</t>', x, re.S)))
      for x in re.findall(r'<si>(.*?)</si>', Z.read('xl/sharedStrings.xml').decode(), re.S)]

numFmts = dict(re.findall(r'<numFmt numFmtId="(\d+)" formatCode="([^"]*)"/>', st))
fonts   = re.findall(r'<font>.*?</font>|<font/>', st, re.S)
fills   = re.findall(r'<fill>.*?</fill>|<fill/>', st, re.S)
borders = re.findall(r'<border(?: [^>]*)?>.*?</border>|<border/>', st, re.S)
xfs     = re.findall(r'<xf [^>]*/>|<xf [^>]*>.*?</xf>',
                     re.search(r'<cellXfs.*?</cellXfs>', st, re.S).group(0), re.S)
dxfs    = re.findall(r'<dxf>.*?</dxf>',
                     re.search(r'<dxfs[^>]*>.*?</dxfs>', st, re.S).group(0), re.S)

# an empty row is self-closing (<row r="1" .../>); matched as an open tag it
# would swallow the next row's cells into its own
rows = {r: inner or "" for r, inner in
        re.findall(r'<row [^>]*?r="(\d+)"[^>]*?(?:/>|>(.*?)</row>)', sheet, re.S)}
hts  = {int(m.group(1)): m.group(2) for m in
        re.finditer(r'<row r="(\d+)"[^>]*?ht="([\d.]+)"', sheet)}
COLS = "BCDEFGHIJKLMNOP"
def cells(r):
    out = {}
    for cm in re.finditer(r'<c r="([A-Z]+)\d+"([^>]*?)(?:/>|>(.*?)</c>)', rows.get(str(r), ""), re.S):
        col, attrs, inner = cm.group(1), cm.group(2), cm.group(3) or ""
        if col not in COLS: continue
        sid = re.search(r's="(\d+)"', attrs)
        v = re.search(r'<v>(.*?)</v>', inner)
        val = (ss[int(v.group(1))] if 't="s"' in attrs else v.group(1)) if v else ""
        out[col] = (int(sid.group(1)) if sid else 0, val.replace("\r\n", "\n"))
    return out

used = set()
# ---- the header block, rows 1-19: every cell's record, the house text kept,
# the day's own values cleared (they are written at run time) ----
VARIABLE = {(2, "B"), (3, "B"), (2, "M"), (6, "G"), (15, "G"),
            (3, "L"), (6, "L"), (10, "L"), (13, "L"), (16, "L")}
head = []
for r in range(1, 20):
    for col, (x, v) in cells(r).items():
        used.add(x)
        head.append([r, col, x, "" if (r, col) in VARIABLE else v])
# row 20: the column headings; the five day columns are dated at run time
header = []
for col, (x, v) in cells(20).items():
    used.add(x)
    header.append([col, x, "" if col in "HIJKL" else v])
HEAD_WANT = {"DIAGRAM", "DEP TIME", "MC", "UNIT STATUS"}
missing = HEAD_WANT - {v.strip() for _, _, v in header}
assert not missing, "row 20 is not the column headings - missing %s" % sorted(missing)

# ---- the body archetypes ----
# One record per column for a plain line (row 23: available, restriction
# noted, a day's work in blue), the variants a line can take, and the last
# line's own records with the medium rule beneath. Picked by column from
# the rows that show them, and every one has to be there.
def rec(r, col):
    x = cells(r).get(col)
    assert x, "row %d has no %s cell" % (r, col)
    used.add(x[0]); return x[0]
body = {c: rec(23, c) for c in COLS}
body["N"] = rec(45, "N")      # a plain time cell (row 23's is h:mm formatted)
body["E"] = rec(23, "E")      # a plain MC cell
last = {c: rec(49, c) for c in COLS}
variants = {
    "restriction": rec(23, "G"),      # bold red on yellow, with text
    "noRestriction": rec(22, "G"),    # bold red, blank
    "lowMileage": rec(41, "E"),       # white on green
    "dayBlue": rec(25, "I"),          # a day's planned work
    "dayRed": rec(29, "H"),           # a hold, an exam, damage
    "dayBlank": rec(22, "H"),
    "dayLBlue": rec(40, "L"),         # the last day column has no right rule
    "dayLRed": rec(29, "L"),
    "dayLBlank": rec(22, "L"),
    "unitHash": rec(38, "B"),         # a unit marked # (CCTV mod)
}
lastVariants = {
    "dayRed": rec(49, "I"), "dayBlank": rec(49, "H"), "dayLBlank": rec(49, "L"),
}
assert len(used) > 60, "only %d style records used; that is not the whole tab" % len(used)

# ---- the UNIT STATUS colours: their conditional formatting on column F ----
cf = re.search(r'<conditionalFormatting sqref="F21:F49">(.*?)</conditionalFormatting>', sheet, re.S)
assert cf, "no conditional formatting on the UNIT STATUS column"
status_rules = re.findall(r'<cfRule type="containsText" dxfId="(\d+)"[^>]*text="([^"]+)"', cf.group(1))
assert {t for _, t in status_rules} >= {"Available", "Stopped", "Spare", "Stabled"}, status_rules

# ---- renumber into a minimal styleSheet ----
order = sorted(used)
newid = {old: i + 1 for i, old in enumerate(order)}
f_used, l_used, b_used, n_used = [fonts[0]], [fills[0], fills[1]], [borders[0]], []
fmap, lmap, bmap = {0: 0}, {0: 0, 1: 1}, {0: 0}
out_xfs = ['<xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>']
for old in order:
    x = xfs[old]
    def sub(attr, arr, usedl, mp):
        m = re.search(attr + r'="(\d+)"', x)
        i = int(m.group(1)) if m else 0
        if i not in mp:
            mp[i] = len(usedl); usedl.append(arr[i])
        return mp[i]
    fi = sub("fontId", fonts, f_used, fmap)
    li = sub("fillId", fills, l_used, lmap)
    bi = sub("borderId", borders, b_used, bmap)
    nf = re.search(r'numFmtId="(\d+)"', x)
    nfi = nf.group(1) if nf else "0"
    if int(nfi) >= 164 and nfi in numFmts and nfi not in [a for a, _ in n_used]:
        n_used.append((nfi, numFmts[nfi]))
    y = re.sub(r'fontId="\d+"', 'fontId="%d"' % fi, x)
    y = re.sub(r'fillId="\d+"', 'fillId="%d"' % li, y)
    y = re.sub(r'borderId="\d+"', 'borderId="%d"' % bi, y)
    y = re.sub(r'\s?xfId="\d+"', '', y)
    out_xfs.append(y)

# ---- theme colours -> plain rgb (a generated book carries no theme) ----
theme_xml = Z.read('xl/theme/theme1.xml').decode()
clr = re.search(r'<a:clrScheme.*?</a:clrScheme>', theme_xml, re.S).group(0)
def theme_rgb(name):
    b = re.search(r'<a:%s>(.*?)</a:%s>' % (name, name), clr, re.S).group(1)
    v = re.search(r'(?:srgbClr val="([0-9A-Fa-f]{6})"|sysClr[^>]*lastClr="([0-9A-Fa-f]{6})")', b)
    return (v.group(1) or v.group(2)).upper()
THEME = [theme_rgb(n) for n in ["lt1", "dk1", "lt2", "dk2", "accent1", "accent2",
                                "accent3", "accent4", "accent5", "accent6", "hlink", "folHlink"]]
def tinted(hex6, tint):
    r, g, b = (int(hex6[i:i+2], 16) / 255 for i in (0, 2, 4))
    h, l, sa = colorsys.rgb_to_hls(r, g, b)
    l = l * (1 + tint) if tint < 0 else l * (1 - tint) + tint
    r, g, b = colorsys.hls_to_rgb(h, min(max(l, 0), 1), sa)
    return "FF%02X%02X%02X" % (round(r * 255), round(g * 255), round(b * 255))
def untheme(xml):
    def repl(m):
        rgb = tinted(THEME[int(m.group(2))], float(m.group(3) or 0))
        return "<" + m.group(1) + ' rgb="' + rgb + '"/>'
    return re.sub(r'<(fgColor|bgColor|color)\s+theme="(\d+)"(?:\s+tint="([-0-9.Ee]+)")?\s*/>', repl, xml)
f_used = [untheme(x) for x in f_used]
l_used = [untheme(x) for x in l_used]
b_used = [untheme(x) for x in b_used]
status_dxfs = [untheme(dxfs[int(d)]) for d, _ in status_rules]

styles = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
  '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
  + ('<numFmts count="%d">' % len(n_used) +
     "".join('<numFmt numFmtId="%s" formatCode="%s"/>' % nf for nf in n_used) + '</numFmts>' if n_used else "")
  + '<fonts count="%d">' % len(f_used) + "".join(f_used) + '</fonts>'
  + '<fills count="%d">' % len(l_used) + "".join(l_used) + '</fills>'
  + '<borders count="%d">' % len(b_used) + "".join(b_used) + '</borders>'
  + '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
  + '<cellXfs count="%d">' % len(out_xfs) + "".join(out_xfs) + '</cellXfs>'
  + '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>'
  + '<dxfs count="%d">' % len(status_dxfs) + "".join(status_dxfs) + '</dxfs>'
  + '</styleSheet>')

# ---- the same dress as CSS, one declaration per record, for the preview ----
BORDER_CSS = {"hair": "1px solid", "thin": "1px solid", "dotted": "1px dotted", "dashed": "1px dashed",
              "medium": "2px solid", "mediumDashed": "2px dashed", "thick": "3px solid", "double": "3px double"}
def rgb_of(frag, default=None):
    m = re.search(r'rgb="([0-9A-Fa-f]{8})"', frag or "")
    if m: return "#" + m.group(1)[2:].upper()
    m = re.search(r'rgb="([0-9A-Fa-f]{6})"', frag or "")
    if m: return "#" + m.group(1).upper()
    return default
def css_for(xf):
    out = []
    def idx(attr):
        m = re.search(attr + r'="(\d+)"', xf)
        return int(m.group(1)) if m else 0
    fo = f_used[idx("fontId")]
    if "<b/>" in fo: out.append("font-weight:700")
    if "<i/>" in fo: out.append("font-style:italic")
    m = re.search(r'<sz val="([\d.]+)"', fo)
    if m: out.append("font-size:%spt" % m.group(1))
    c = re.search(r'<color[^/]*/>', fo)
    col = rgb_of(c.group(0) if c else "", "#000000")
    if col != "#000000": out.append("color:" + col)
    fl = l_used[idx("fillId")]
    if 'patternType="solid"' in fl:
        fg = re.search(r'<fgColor[^/]*/>', fl)
        bg = rgb_of(fg.group(0) if fg else "", None)
        if bg: out.append("background:" + bg)
    bd = b_used[idx("borderId")]
    for side in ("left", "right", "top", "bottom"):
        m = re.search(r"<%s([^>]*)>(.*?)</%s>|<%s([^>]*)/>" % (side, side, side), bd, re.S)
        if not m: continue
        attrs = m.group(1) or m.group(3) or ""
        s = re.search(r'style="([^"]+)"', attrs)
        if not s: continue
        out.append("border-%s:%s %s" % (side, BORDER_CSS.get(s.group(1), "1px solid"), rgb_of(m.group(2) or "", "#000000")))
    al = re.search(r'<alignment([^/]*)/>', xf)
    if al:
        h = re.search(r'horizontal="([^"]+)"', al.group(1))
        if h: out.append("text-align:" + h.group(1))
        if 'wrapText="1"' in al.group(1): out.append("white-space:pre-wrap")
    return ";".join(out)
xf_css = [css_for(x) for x in out_xfs]
def dxf_css(d):
    out = []
    if "<b/>" in d: out.append("font-weight:700")
    c = re.search(r'<font>.*?(<color[^/]*/>)', d, re.S)
    col = rgb_of(c.group(1) if c else "", None)
    if col: out.append("color:" + col)
    bg = re.search(r'<bgColor[^/]*/>', d)
    bgc = rgb_of(bg.group(0) if bg else "", None)
    if bgc and 'patternType="solid"' in d: out.append("background:" + bgc)
    return ";".join(out)
status_css = {t: dxf_css(status_dxfs[i]) for i, (_, t) in enumerate(status_rules)}

# the column widths, A to P, in Excel's units, for the preview and the file
cols = []
for m in re.finditer(r'<col min="(\d+)" max="(\d+)" width="([\d.]+)"', sheet):
    for c in range(int(m.group(1)), min(int(m.group(2)), 16) + 1):
        cols.append((c, float(m.group(3))))
widths = [w for c, w in sorted(cols)][:16]
assert len(widths) == 16, widths

remap = lambda m: {c: newid[x] for c, x in m.items()}
skin = {
  "stylesXml": styles, "xfCss": xf_css,
  "statusCss": status_css, "statusOrder": [t for _, t in status_rules],
  "widths": widths,
  "head": [[r, c, newid[x], v] for r, c, x, v in head],
  "headHts": {str(r): hts[r] for r in range(1, 21) if r in hts},
  "headMerges": re.findall(r'<mergeCell ref="([^"]+)"/>', sheet),
  "header": [[c, newid[x], v] for c, x, v in header],
  "body": remap(body), "last": remap(last),
  "variants": remap(variants), "lastVariants": remap(lastVariants),
  "bodyHt": hts.get(21, "105.75"), "closeHt": hts.get(50, "36"),
}
for mg in skin["headMerges"]:
    assert int(re.search(r'(\d+)$', mg).group(1)) <= 19, "a merge below the header block: " + mg

js = ("/* SHEETS_HS_DISP_SKIN - the Class 395 Disposition Statement's own dress,\n"
      "   lifted from the operator's workbook by tools/make-hs-disp-skin.py and\n"
      "   renumbered into a minimal styleSheet. Layout and house text only: no\n"
      "   unit numbers, diagrams, dates or counts come with it. */\n"
      '"use strict";\n'
      "const SHEETS_HS_DISP_SKIN = " + json.dumps(skin, indent=1) + ";\n"
      'if (typeof module !== "undefined" && module.exports) module.exports = SHEETS_HS_DISP_SKIN;\n'
      'if (typeof globalThis !== "undefined") globalThis.SHEETS_HS_DISP_SKIN = SHEETS_HS_DISP_SKIN;\n')

# ---- every word this skin ships has to be house text ----
HOUSE_TEXT = {
    "CLASS 395 DISPOSITION STATEMENT AM", "Date Sent", "Time Sent",
    "SERVICE TRAINS REQUIRED AM / PM", "SERVICE TRAINS OFFERED AM / PM",
    "SERVICE SPARE TRAINS", "TOTAL STOPPED", "TOTAL STABLED",
    "UNIT\n#  \nCCTV Mod", "FTR DAYS\n@12:30", "DEPT\nLOCATION", "MC", "UNIT STATUS",
    "RESTRICTION /\nCOMMENT", "DIAGRAM", "DEP TIME", "END\nLOCATION", "ARRIVAL\nTIME",
}
shipped = {v for _, _, _, v in skin["head"] if v} | {v for _, _, v in skin["header"] if v}
stray = shipped - HOUSE_TEXT
assert not stray, "text in the skin that is not house text: %r" % sorted(stray)
for pat, what in [(r"\b395\d{3}\b", "a unit number"), (r"\bAZ6\d\d\b", "a diagram"),
                  (r"\b\d\d/\d\d/\d\d", "a date"), (r"\b4\d{4}\b", "a date serial")]:
    assert not re.search(pat, json.dumps(skin["head"]) + json.dumps(skin["header"])), what + " leaked into the skin"

out = sys.argv[2] if len(sys.argv) > 2 else "src/hs-disp-skin.js"
open(out, "w").write(js)
print("wrote", out, len(js), "bytes;", len(out_xfs), "style records,", len(skin["head"]), "header cells")
