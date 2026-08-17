/* Shared normalisers for the golden tests. */
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { loadSandbox } from "./sandbox.mjs";

export const LEGACY = fileURLToPath(new URL("../fixtures/legacy.html", import.meta.url));
export const BUILT = fileURLToPath(new URL("../../Sheets Generator.html", import.meta.url));

let legacyCtx = null, builtCtx = null;
export function legacy() { return (legacyCtx ||= loadSandbox(LEGACY)); }
export function built() { return (builtCtx ||= loadSandbox(BUILT)); }

/* Deep-normalise engine output into host-realm structures (the sandboxes
   are separate vm realms, so brand-check rather than instanceof). Maps keep
   their order — section order is meaningful; Sets sort; object keys sort. */
const brand = v => Object.prototype.toString.call(v);
export function norm(v) {
  if (v === null || typeof v !== "object") return v;
  if (brand(v) === "[object Map]")
    return { "«map»": Array.from(v.entries(), ([k, x]) => [k, norm(x)]) };
  if (brand(v) === "[object Set]")
    return { "«set»": Array.from(v.values(), x => norm(x)).sort() };
  if (brand(v) === "[object Uint8Array]")
    return { "«u8»": Buffer.from(v).toString("base64") };
  if (Array.isArray(v)) return Array.from(v, x => norm(x));
  const o = {};
  for (const k of Object.keys(v).sort()) o[k] = norm(v[k]);
  return o;
}

/* Read a workbook back with the legacy bundle's ExcelJS and reduce it to
   the fields the house format cares about, skipping merge-slave cells.
   The bytes may come from either sandbox realm, so they are copied into the
   reader's realm first — JSZip type-sniffs with instanceof. */
/* opts.rowsRelative renumbers rows by their position among the rows that
   carry anything, so blank-row spacing drops out of the comparison and
   everything else - order, content, fonts, borders, merges - still counts.
   The weekday books now leave ONE blank row between sections where the
   frozen build left two (the real books leave one), and that is the only
   thing it is there to let through. */
export async function normalizeWorkbook(readerCtx, bytes, opts) {
  const ExcelJS = readerCtx.ExcelJS;
  const mk = vm.runInContext("(n) => new Uint8Array(n)", readerCtx.__ctx);
  const local = mk(bytes.length);
  local.set(bytes);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(local);
  const out = [];
  for (const ws of wb.worksheets) {
    const merges = Array.from((ws.model && ws.model.merges) || []).sort();
    const covered = new Set();
    for (const rng of merges) {
      const m = /^([A-Z]+)(\d+):([A-Z]+)(\d+)$/.exec(rng);
      if (!m) continue;
      const colN = s => { let n = 0; for (const ch of s) n = n * 26 + ch.charCodeAt(0) - 64; return n; };
      const c1 = colN(m[1]), r1 = +m[2], c2 = colN(m[3]), r2 = +m[4];
      for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++)
        if (!(r === r1 && c === c1)) covered.add(r + "," + c);
    }
    const cells = [], heights = [];
    ws.eachRow({ includeEmpty: true }, (row, r) => {
      if (row.height !== undefined) heights.push([r, row.height]);
      for (let c = 1; c <= 8; c++) {
        if (covered.has(r + "," + c)) continue;
        const cell = row.getCell(c);
        const v = cell.value === null || cell.value === undefined ? "" : String(cell.value);
        const f = cell.font || {};
        const b = cell.border || {};
        const side = s => (s && s.style) || null;
        const al = cell.alignment || {};
        const rec = {
          v,
          font: { name: f.name || null, size: f.size || null, bold: !!f.bold },
          align: { h: al.horizontal || null, v: al.vertical || null },
          border: { top: side(b.top), bottom: side(b.bottom),
                    left: side(b.left), right: side(b.right) },
        };
        // Skip cells that carry nothing at all — writers may or may not emit them.
        if (v === "" && !rec.border.top && !rec.border.bottom && !rec.border.left &&
            !rec.border.right && !f.name) continue;
        cells.push([r, c, rec]);
      }
    });
    let rowOf = r => r;
    if (opts && opts.rowsRelative) {
      const used = Array.from(new Set(cells.map(c => c[0]))).sort((a, b) => a - b);
      const idx = new Map(used.map((r, i) => [r, i + 1]));
      rowOf = r => idx.has(r) ? idx.get(r) : "blank";
    }
    out.push({
      name: ws.name,
      pageSetup: { paperSize: (ws.pageSetup || {}).paperSize || null,
                   orientation: (ws.pageSetup || {}).orientation || null },
      widths: Array.from({ length: 8 }, (_, i) =>
        Math.round(((ws.getColumn(i + 1).width) || 0) * 100) / 100),
      merges: merges.map(m => m.replace(/([A-Z]+)(\d+)/g,
        (_, col, r) => col + rowOf(+r))).sort(),
      heights: heights.sort((a, b) => a[0] - b[0])
        .map(([r, h]) => [rowOf(r), h]).filter(([r]) => r !== "blank"),
      cells: cells.sort((a, b) => (a[0] - b[0]) || (a[1] - b[1]))
        .map(([r, c, rec]) => [rowOf(r), c, rec]),
    });
  }
  return out;
}
