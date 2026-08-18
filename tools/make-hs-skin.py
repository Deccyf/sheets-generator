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
borders = re.findall(r'<border[^>]*>.*?</border>|<border/>', st, re.S)
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

# renumber into a minimal styleSheet
order = sorted(used)
newid = {old: i for i, old in enumerate(order)}
f_used, l_used, b_used, n_used = [], [], [], []
fmap, lmap, bmap = {}, {}, {}
out_xfs = []
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

remap = lambda m: {c: newid[x] for c, x in m.items()}
skin = {
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
      "   from the operator's workbook by scratchpad/mkskin.py and renumbered\n"
      "   into a minimal styleSheet. Layout and static house text only: no\n"
      "   unit numbers, headcodes, dates or comments come with it. */\n"
      '"use strict";\n'
      "const SHEETS_HS_SKIN = " + json.dumps(skin, indent=1) + ";\n"
      'if (typeof module !== "undefined" && module.exports) module.exports = SHEETS_HS_SKIN;\n'
      'if (typeof globalThis !== "undefined") globalThis.SHEETS_HS_SKIN = SHEETS_HS_SKIN;\n')

# leak check before anything is written
leaks = []
for pat, what in [(r'395\d{3}', "unit number"), (r'\b[125][A-Z]\d\d\b', "headcode"),
                  (r'DECLAN|DFINCH|JOHN', "name"), (r'(?<![\d.])46\d{3}(?![\d.])', "date serial")]:
    for m in re.finditer(pat, js):
        leaks.append(what + ": " + m.group(0))
if leaks:
    raise SystemExit("LEAKS:\n" + "\n".join(sorted(set(leaks))))
open("/home/user/sheets-generator/src/hs-skin.js", "w").write(js)
print("wrote src/hs-skin.js", len(js), "bytes,", len(out_xfs), "styles,",
      len(f_used), "fonts,", len(l_used), "fills,", len(b_used), "borders")
