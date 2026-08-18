# Build src/hs-skin.js: the Class 395 Allocations Sheet's own dress, lifted
# verbatim from the operator's workbook and renumbered into a minimal
# styleSheet. Layout only - every unit number, headcode and comment is left
# behind, and the output is grepped for leaks before it is written.
import re, json, sys, zipfile

# the operator's workbook is NOT in the repository - point this at a copy
Z = zipfile.ZipFile(sys.argv[1] if len(sys.argv) > 1 else
    "/root/.claude/uploads/a92fd59d-eda0-5a2d-858d-3481c8939b31/"
    "2bda6967-Provisional_Version_1_Class_395_Allocations_Sheet_18082026.xlsx")

def unesc(t):
    # the sheet stores text XML-escaped; the writer escapes what it is given,
    # so the skin must hold the PLAIN text or "< 500 Miles" ships as "&lt;"
    for a, b in [("&lt;", "<"), ("&gt;", ">"), ("&quot;", '"'),
                 ("&apos;", "'"), ("&amp;", "&")]:
        t = t.replace(a, b)
    return t
st = Z.read('xl/styles.xml').decode()
sheet = Z.read('xl/worksheets/sheet131.xml').decode()   # Tue 18 08
ss = [unesc("".join(re.findall(r'<t[^>]*>(.*?)</t>', x, re.S)))
      for x in re.findall(r'<si>(.*?)</si>', Z.read('xl/sharedStrings.xml').decode(), re.S)]

numFmts = dict(re.findall(r'<numFmt numFmtId="(\d+)" formatCode="([^"]*)"/>', st))
fonts   = re.findall(r'<font>.*?</font>|<font/>', st, re.S)
fills   = re.findall(r'<fill>.*?</fill>|<fill/>', st, re.S)
# NOT <border[^>]*> - that also matches the <borders count="..."> section
# header, which then rides into border record 0 and nests an unclosed
# <borders> inside the emitted one. Excel refused the whole styles part.
borders = re.findall(r'<border(?: [^>]*)?>.*?</border>|<border/>', st, re.S)
xfs     = re.findall(r'<xf [^>]*/>|<xf [^>]*>.*?</xf>',
                     re.search(r'<cellXfs.*?</cellXfs>', st, re.S).group(0), re.S)
dxfs    = re.findall(r'<dxf>.*?</dxf>',
                     re.search(r'<dxfs[^>]*>.*?</dxfs>', st, re.S).group(0), re.S)

rows = dict(re.findall(r'<row [^>]*r="(\d+)"[^>]*>(.*?)</row>', sheet, re.S))
hts  = {int(m.group(1)): m.group(2) for m in
        re.finditer(r'<row r="(\d+)"[^>]*?ht="([\d.]+)"', sheet)}
def cells(r):
    out = {}
    for cm in re.finditer(r'<c r="([A-Z]+)\d+"([^>]*?)(?:/>|>(.*?)</c>)',
                          rows.get(str(r), ""), re.S):
        col, attrs, inner = cm.group(1), cm.group(2), cm.group(3) or ""
        sid = re.search(r's="(\d+)"', attrs)
        v = re.search(r'<v>(.*?)</v>', inner)
        val = (ss[int(v.group(1))] if 't="s"' in attrs else v.group(1)) if v else ""
        out[col] = (int(sid.group(1)) if sid else 0, val)
    return out

used = set()
def take(r, keep_values, clear=()):
    got = []
    for col, (x, v) in cells(r).items():
        if col > "T" and len(col) == 1 or len(col) > 1:  # nothing past T
            continue
        used.add(x)
        got.append([r, col, x, "" if (not keep_values or col in clear) else v])
    return got

# rows 1-6: the legend. Date/Time Sent values and the version are cleared -
# they belong to the day the sheet was sent, not to the template.
legend = []
for r in range(1, 7):
    legend += take(r, True, clear=("S", "T") if r in (3, 5) else ())
# rows 60-66: the notes footer. The RULED SHAPE is template; much of the
# text is operational (the COMMENTS box named three units and a date, which
# is what the leak check below caught). Keep only the standing house notes.
KEEP = {(60, "B"), (60, "H"), (61, "B"), (62, "B"), (63, "B"),
        (65, "B"), (65, "D"), (65, "E"), (65, "F")}
footer = []
for r in range(60, 67):
    got = take(r, True)
    for cell in got:
        if (cell[0], cell[1]) not in KEEP:
            cell[3] = ""
    footer += got
# archetypes
title  = {c: x for c, (x, v) in cells(7).items() if len(c) == 1 and c <= "T"}
header = [[c, x, v] for c, (x, v) in cells(8).items() if len(c) == 1 and c <= "T"]
data   = {c: x for c, (x, v) in cells(9).items() if len(c) == 1 and c <= "T"}
grey   = {c: x for c, (x, v) in cells(19).items() if "H" <= c <= "T" and len(c) == 1}
gaprow = {c: x for c, (x, v) in cells(27).items() if len(c) == 1 and c <= "T"}
for m in (title, data, grey, gaprow): used.update(m.values())
used.update(x for _, x, _ in header)

# renumber into a minimal styleSheet - around Excel's reserved slots.
# fill 0 must be patternType none and fill 1 gray125, and cellXfs 0 must be
# a plain default: Excel paints every UNTOUCHED cell of the grid with xf 0,
# so if the lowest used record lands there (a solid-white applyFill did),
# the whole background renders as the dotted haze the depot saw. Seed the
# output with the workbook's own slot-0 records and put the rest after.
order = sorted(used)
newid = {old: i + 1 for i, old in enumerate(order)}   # xf 0 = the plain default
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

# ---- theme colours -> plain rgb ----
# The workbook leans on its Office theme: the grey between the tables is
# <fgColor theme="0" tint="-0.15"/> ("white, darker 15%"), the amber mileage
# chip is accent6 lightened. A generated book carries no theme part, and
# Excel renders an unresolvable solid fill as a dotted haze - so every theme
# reference is resolved here, against THEIR theme's own palette, and the
# skin ships pure rgb. The tint is applied to HSL luminance, which is how
# Excel applies it (ECMA-376 18.3.1.15).
import colorsys
theme_xml = Z.read('xl/theme/theme1.xml').decode()
clr = re.search(r'<a:clrScheme.*?</a:clrScheme>', theme_xml, re.S).group(0)
def theme_rgb(name):
    b = re.search(r'<a:%s>(.*?)</a:%s>' % (name, name), clr, re.S).group(1)
    v = re.search(r'(?:srgbClr val="([0-9A-Fa-f]{6})"|sysClr[^>]*lastClr="([0-9A-Fa-f]{6})")', b)
    return (v.group(1) or v.group(2)).upper()
# the theme attribute's index order swaps dk1/lt1 and dk2/lt2
THEME = [theme_rgb(n) for n in ["lt1", "dk1", "lt2", "dk2", "accent1",
         "accent2", "accent3", "accent4", "accent5", "accent6",
         "hlink", "folHlink"]]
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
    return re.sub(r'<(fgColor|bgColor|color)\s+theme="(\d+)"(?:\s+tint="([-0-9.Ee]+)")?\s*/>',
                  repl, xml)
f_used = [untheme(x) for x in f_used]
l_used = [untheme(x) for x in l_used]
b_used = [untheme(x) for x in b_used]
dxfs = [untheme(x) for x in dxfs]

styles = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
  '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
  + ('<numFmts count="%d">' % len(n_used) +
     "".join('<numFmt numFmtId="%s" formatCode="%s"/>' % nf for nf in n_used) +
     '</numFmts>' if n_used else "")
  + '<fonts count="%d">' % len(f_used) + "".join(f_used) + '</fonts>'
  + '<fills count="%d">' % len(l_used) + "".join(l_used) + '</fills>'
  + '<borders count="%d">' % len(b_used) + "".join(b_used) + '</borders>'
  + '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
  + '<cellXfs count="%d">' % len(out_xfs) + "".join(out_xfs) + '</cellXfs>'
  + '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>'
  + '<dxfs count="2">' + dxfs[207] + dxfs[206] + '</dxfs>'   # 0 = under 500, 1 = over
  + '</styleSheet>')

# ---- the drop-downs ----
# Four list validations on the real tab: CET DUE, FP/RP, 6 OR 12 CAR, and
# the 395 fleet roster on both UNIT columns. The roster is contiguous
# (395001-395029), so it ships as first+count and is built at runtime -
# no unit numbers ride in the skin.
dvs = re.search(r'<dataValidations.*?</dataValidations>', sheet, re.S).group(0)
un = re.search(r'<formula1>"(395[\d,]+)"</formula1>', dvs)
roster = sorted(int(u) for u in un.group(1).split(","))
assert roster == list(range(roster[0], roster[-1] + 1)), "fleet roster has gaps"
dv = { "cet": "YES,N", "fprp": "FP,RP", "cars": "6,12",
       "unitFirst": roster[0], "unitCount": len(roster) }
for k, pat in [("cet", r'sqref="F[^"]*"[^>]*>\s*<formula1>"([^"]+)"'),
               ("fprp", r'sqref="M[^"]*"[^>]*>\s*<formula1>"([^"]+)"')]:
    m = re.search(r'<dataValidation type="list"[^>]*' + pat, dvs, re.S)
    if m: dv[k] = m.group(1)

# ---- the standing comments ----
# Their comments are threaded notes on the DIAGRAM cells, and across every
# daily tab they are overwhelmingly two pieces of standing route knowledge -
# "not over high level" (216 tabs-x-rows) and "Avoids North Kent" (123) -
# repeated against the same workings. Those are carried as a lookup keyed by
# headcode, like the tool's own ROUTE_BY_HC; one-off chatter is not.
import collections
STANDING = { "not over high level": "Not over high level",
             "avoids north kent": "Avoids North Kent",
             "avoids north kent am only": "Avoids North Kent AM ONLY",
             "not over high speed": "Not over high level" }
# a comments part is paired with its worksheet by the sheet's rels, NOT by
# number - sheet131's notes live in threadedComment35.xml
counts = collections.Counter()
for part in Z.namelist():
    m = re.match(r'xl/worksheets/_rels/(sheet\d+)\.xml\.rels$', part)
    if not m: continue
    tcr = re.search(r'Target="\.\./threadedComments/(threadedComment\d+\.xml)"',
                    Z.read(part).decode())
    if not tcr: continue
    sx = Z.read('xl/worksheets/%s.xml' % m.group(1)).decode()
    srows = dict(re.findall(r'<row [^>]*r="(\d+)"[^>]*>(.*?)</row>', sx, re.S))
    def sval(rr, col):
        c = re.search(r'<c r="%s%s"([^>]*)>(?:<v>(.*?)</v>)?' % (col, rr), srows.get(rr, ""))
        if not c or c.group(2) is None: return ""
        return ss[int(c.group(2))] if 't="s"' in c.group(1) else c.group(2)
    tcx = Z.read('xl/threadedComments/' + tcr.group(1)).decode()
    for cm in re.finditer(r'<threadedComment ref="[A-Z]+(\d+)"[^>]*>(.*?)</threadedComment>', tcx, re.S):
        t = re.search(r'<text>(.*?)</text>', cm.group(2), re.S)
        key = re.sub(r'\s+', ' ', (t.group(1) if t else "")).strip().lower()
        if key not in STANDING: continue
        hc = (sval(cm.group(1), "H") or "").split(" ")[0]
        if re.match(r'^[125][A-Z]\d\d$', hc):
            counts[(hc, STANDING[key])] += 1
# one note per family: where a working's note changed over the period
# ("Avoids North Kent" vs "... AM ONLY"), the most-sighted wording wins
hcNotes, best = {}, {}
for (hc, note), n in counts.items():
    if n < 5: continue
    k = (hc, "NK" if "North Kent" in note else "HL")
    if k not in best or n > best[k][1]: best[k] = (note, n)
for (hc, _), (note, n) in best.items():
    hcNotes.setdefault(hc, []).append(note)
for hc in hcNotes: hcNotes[hc].sort()

remap = lambda m: {c: newid[x] for c, x in m.items()}
skin = {
  "dv": dv, "hcNotes": hcNotes,
  "stylesXml": styles,
  "colsXml": re.search(r'<cols>.*?</cols>', sheet, re.S).group(0),
  "tabColor": "FFFFFF00",
  "legend": [[r, c, newid[x], v] for r, c, x, v in legend],
  "legendHts": {str(r): hts[r] for r in range(1, 7) if r in hts},
  "footer": [[r, c, newid[x], v] for r, c, x, v in footer],
  "footerMerges": ["B60:F60","H60:T60","B61:F61","H61:T66","B62:F62",
                    "B63:F64","B65:C66"],
  "title": remap(title), "header": [[c, newid[x], v] for c, x, v in header],
  "headerHt": hts.get(8, "24.75"),
  "data": remap(data), "greyRight": remap(grey), "gapRow": remap(gaprow),
}
js = ("/* SHEETS_HS_SKIN - the Class 395 Allocations Sheet's own dress, lifted\n"
      "   from the operator's workbook by tools/make-hs-skin.py and renumbered\n"
      "   into a minimal styleSheet. Layout and static house text only: no\n"
      "   unit numbers, headcodes, dates or comments come with it. */\n"
      '"use strict";\n'
      "const SHEETS_HS_SKIN = " + json.dumps(skin, indent=1) + ";\n"
      'if (typeof module !== "undefined" && module.exports) module.exports = SHEETS_HS_SKIN;\n'
      'if (typeof globalThis !== "undefined") globalThis.SHEETS_HS_SKIN = SHEETS_HS_SKIN;\n')

# leak check before anything is written
leaks = []
allowed = set(hcNotes) | { str(roster[0]) }
for pat, what in [(r'395\d{3}', "unit number"), (r'\b[125][A-Z]\d\d\b', "headcode"),
                  (r'DECLAN|DFINCH|JOHN', "name"), (r'(?<![\d.])46\d{3}(?![\d.])', "date serial")]:
    for m in re.finditer(pat, js):
        # the standing-notes lookup is keyed by headcode on purpose, and the
        # roster's first number is the fleet's, not a day's allocation
        if m.group(0) in allowed: continue
        leaks.append(what + ": " + m.group(0))
if leaks:
    raise SystemExit("LEAKS:\n" + "\n".join(sorted(set(leaks))))
# the styleSheet must be well-formed XML before it is allowed anywhere
# near a workbook - Excel drops the whole part over one bad tag
import xml.dom.minidom
xml.dom.minidom.parseString(styles)
assert 'theme="' not in styles, "unresolved theme colour left in the skin"
# the haze guard: Excel renders every untouched grid cell with fill 0 and
# xf 0, so those must be the conventional blanks, whatever the sheet uses
assert ('<fill><patternFill patternType="none"/></fill>'
        '<fill><patternFill patternType="gray125"/></fill>') in styles, \
    "fills 0/1 are not the reserved none/gray125 pair"
assert ('<cellXfs count="%d"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>'
        % len(out_xfs)) in styles, "cellXfs 0 is not a plain default"
open("/home/user/sheets-generator/src/hs-skin.js", "w").write(js)
print("wrote src/hs-skin.js", len(js), "bytes,", len(out_xfs), "styles,",
      len(f_used), "fonts,", len(l_used), "fills,", len(b_used), "borders")
