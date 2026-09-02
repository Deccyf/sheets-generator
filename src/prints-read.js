/* Reading the diagram prints out of whatever file they arrive in.

   The prints come round as a Word document - .docx from a current Word,
   .doc from an older one - and sometimes as a text or CSV save of the same
   thing. All four end up as the same list of paragraphs, tabs and all, and
   nothing downstream cares which one it started as.

   This lives on its own because two tools read the prints: the berthing
   sheets and the fleet analysis. They ask different questions of the
   diagrams, but they open the file the same way, and a fix to the reader -
   an older Word, a new export quirk - has to reach both.

   It also carries csvParse: a plain CSV splitter, no berthing knowledge
   in it, needed here for the CSV save of the prints and re-exported by
   SHEETS_CORE for everything else that asks. */
;(function(root){
"use strict";
  /* ========================= docx -> lines ========================= */
  function xmlUnescape(s){
    return s.replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"')
            .replace(/&apos;/g,"'")
            .replace(/&#x([0-9a-fA-F]+);/g,(m,h)=>String.fromCodePoint(parseInt(h,16)))
            .replace(/&#(\d+);/g,(m,d)=>String.fromCodePoint(parseInt(d,10)))
            .replace(/&amp;/g,"&");
  }
  /* The one paragraph pattern, walked here for the text and by the reissue
     splice for the character spans. A paragraph need not carry attributes:
     an earlier pattern required a space after "w:p", so every plain <w:p>
     in a Word document was invisible to it - the splice found no
     paragraphs, the reissue merge replaced nothing, and the "updated
     prints" the panel saved were byte-identical to the superseded original
     with no warning anywhere. */
  const PARA_SRC = "<w:p(?:\\s[^>]*)?\\/>|<w:p(?:\\s[^>]*)?>([\\s\\S]*?)<\\/w:p>";
  const paraRe = () => new RegExp(PARA_SRC, "g");
  /* A .docx is a zip, and a zip opens with the PK local-file signature. */
  function isDocxBytes(b){
    return !!b && b[0] === 0x50 && b[1] === 0x4B && b[2] === 0x03 && b[3] === 0x04;
  }
  /* [start, end) character spans of every paragraph in a document.xml, in
     document order - the units the reissue splice cuts and pastes by. */
  function docParaSpans(xml){
    const out = [], re = paraRe();
    let m;
    while ((m = re.exec(xml)) !== null) out.push([m.index, m.index + m[0].length]);
    return out;
  }
  /* paragraph text exactly as python-docx builds it: run text, <w:tab/> -> \t,
     <w:br/> and <w:cr/> -> \n */
  function docxParagraphs(documentXml){
    const paras = [];
    const re = paraRe();
    let m;
    while ((m = re.exec(documentXml)) !== null){
      const inner = m[1];
      if (inner === undefined){ paras.push(""); continue; }
      const body = inner.replace(/<w:pPr>[\s\S]*?<\/w:pPr>/g, "");
      let text = "";
      const tok = /<w:tab\/>|<w:tab\s*\/>|<w:br(?:\s[^>]*)?\/?>|<w:cr\/>|<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:t(?:\s[^>]*)?\/>/g;
      let t;
      while ((t = tok.exec(body)) !== null){
        const raw = t[0];
        if (raw.startsWith("<w:tab")) text += "\t";
        else if (raw.startsWith("<w:br") || raw.startsWith("<w:cr")) text += "\n";
        else if (t[1] !== undefined) text += xmlUnescape(t[1]);
      }
      paras.push(text);
    }
    return paras;
  }
  function readDocx(bytes, unzip){
    let files;
    try { files = unzip(bytes); }
    catch (e){
      throw new Error("That file is damaged or isn't a Word document. " +
                      "Try re-saving the prints from Word as .docx.");
    }
    const key = Object.keys(files).find(k => k === "word/document.xml");
    if (!key) throw new Error("That doesn't look like a Word file — no document body inside.");
    const xml = new TextDecoder("utf-8").decode(files[key]);
    return docxParagraphs(xml);
  }

  /* ---- legacy .doc (Word 97-2003) ------------------------------------------
     A .doc is an OLE compound file: a little filesystem holding a
     "WordDocument" stream and a table stream. The text is not one run - the
     table stream holds a piece table saying where each run of characters lives
     and whether it is 1-byte or 2-byte encoded. This walks both.            */
  /* The compound-file header, [MS-CFB] 2.2 - every field little-endian. */
  const HDR_SECTOR_SHIFT  = 0x1E;   // log2 of the sector size (512 or 4096)
  const HDR_MINI_SHIFT    = 0x20;   // log2 of the mini-sector size (64)
  const HDR_DIR_START     = 0x30;   // first sector of the directory chain
  const HDR_MINI_CUTOFF   = 0x38;   // a stream smaller than this lives in the mini stream
  const HDR_MINIFAT_START = 0x3C;   // first sector of the mini-FAT chain
  const HDR_DIFAT_START   = 0x44;   // first sector of the DIFAT chain (beyond the header's 109)
  const HDR_DIFAT_COUNT   = 0x48;   // how many DIFAT sectors that chain holds
  const HDR_DIFAT         = 0x4C;   // the first 109 FAT sector numbers, in the header itself
  const HDR_DIFAT_N       = 109;
  const SECTOR_SENTINEL   = 0xFFFFFFFA; // numbers from here up mark end-of-chain / free / FAT, not sectors
  /* A directory entry is 128 bytes: a UTF-16 name, its byte length at 64
     (terminator included), the entry type at 66, first sector at 116, size
     at 120. */
  const DIR_ENTRY = 128, DIR_NAME_LEN = 64, DIR_TYPE = 66, DIR_START = 116, DIR_SIZE = 120;
  const TYPE_STREAM = 2, TYPE_ROOT = 5;
  function readCfb(bytes){
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const u16 = function(o){ return dv.getUint16(o, true); };
    const u32 = function(o){ return dv.getUint32(o, true); };
    const ssz = 1 << u16(HDR_SECTOR_SHIFT), msz = 1 << u16(HDR_MINI_SHIFT);
    const dirStart = u32(HDR_DIR_START), cutoff = u32(HDR_MINI_CUTOFF);
    const miniStart = u32(HDR_MINIFAT_START), difatStart = u32(HDR_DIFAT_START);
    const nDifat = u32(HDR_DIFAT_COUNT);
    // sector 0 starts one sector in: the header takes the first
    const sector = function(n){
      const off = (n + 1) * ssz;
      return bytes.subarray(off, off + ssz);
    };
    const fatSectors = [];
    for (let i = 0; i < HDR_DIFAT_N; i++){
      const v = u32(HDR_DIFAT + 4 * i);
      if (v < SECTOR_SENTINEL) fatSectors.push(v);
    }
    let nxt = difatStart, guard = 0;
    while (nxt < SECTOR_SENTINEL && guard < nDifat + 8){
      const blk = sector(nxt);
      const bv = new DataView(blk.buffer, blk.byteOffset, blk.byteLength);
      // the last slot of a DIFAT sector points at the next one
      for (let i = 0; i < ssz / 4 - 1; i++){
        const v = bv.getUint32(4 * i, true);
        if (v < SECTOR_SENTINEL) fatSectors.push(v);
      }
      nxt = bv.getUint32(ssz - 4, true); guard++;
    }
    const fat = [];
    for (const s of fatSectors){
      const blk = sector(s);
      const bv = new DataView(blk.buffer, blk.byteOffset, blk.byteLength);
      for (let i = 0; i < ssz / 4; i++) fat.push(bv.getUint32(4 * i, true));
    }
    const chain = function(start){
      const out = []; let cur = start;
      while (cur < SECTOR_SENTINEL && out.length < (1 << 22)){
        out.push(cur);
        cur = cur < fat.length ? fat[cur] : 0xFFFFFFFE;
      }
      return out;
    };
    const miniFat = [];
    for (const s of chain(miniStart)){
      const blk = sector(s);
      const bv = new DataView(blk.buffer, blk.byteOffset, blk.byteLength);
      for (let i = 0; i < ssz / 4; i++) miniFat.push(bv.getUint32(4 * i, true));
    }
    const miniChain = function(start){
      const out = []; let cur = start;
      while (cur < SECTOR_SENTINEL && out.length < (1 << 20)){
        out.push(cur);
        cur = cur < miniFat.length ? miniFat[cur] : 0xFFFFFFFE;
      }
      return out;
    };
    const join = function(parts, size){
      const total = parts.reduce(function(a, p){ return a + p.length; }, 0);
      const out = new Uint8Array(total);
      let o = 0;
      for (const p of parts){ out.set(p, o); o += p.length; }
      return size === undefined ? out : out.subarray(0, size);
    };
    const entries = [];
    for (const s of chain(dirStart)){
      const blk = sector(s);
      for (let i = 0; i + DIR_ENTRY <= blk.length; i += DIR_ENTRY){
        const e = blk.subarray(i, i + DIR_ENTRY);
        const ev = new DataView(e.buffer, e.byteOffset, e.byteLength);
        const nlen = ev.getUint16(DIR_NAME_LEN, true);
        let name = "";
        for (let k = 0; k + 1 < Math.max(0, nlen - 2); k += 2)
          name += String.fromCharCode(ev.getUint16(k, true));
        entries.push({name: name, type: e[DIR_TYPE],
                      start: ev.getUint32(DIR_START, true),
                      size: ev.getUint32(DIR_SIZE, true)});
      }
    }
    const root = entries.find(function(e){ return e.type === TYPE_ROOT; });
    const miniStream = root
      ? join(chain(root.start).map(sector)) : new Uint8Array(0);
    const out = {};
    for (const e of entries){
      if (e.type !== TYPE_STREAM || !e.name) continue;
      out[e.name] = e.size < cutoff
        ? join(miniChain(e.start).map(function(n){
            return miniStream.subarray(n * msz, (n + 1) * msz); }), e.size)
        : join(chain(e.start).map(sector), e.size);
    }
    return out;
  }
  /* The File Information Block at the head of the WordDocument stream,
     [MS-DOC] 2.5. Only what the walk to the piece table needs. */
  const FIB_MAGIC       = 0xA5EC;  // wIdent: the first word of every Word binary file
  const FIB_FLAGS       = 0x0A;    // the flag word …
  const FIB_WHICH_TABLE = 0x0200;  // … whose fWhichTblStm bit says the table stream is 1Table
  const FIB_CSW         = 0x20;    // count of 16-bit words in the FibRgW that follows it
  const FIB_RGW         = 0x22;    // where the FibRgW starts; cslw and the FibRgLw come after it
  const FCLCB_CLX       = 33;      // the Clx is the 33rd fc/lcb pair of the FibRgFcLcb
  const FCLCB_SIZE      = 8;       // an fc/lcb pair: two uint32s
  const CLX_PRC = 1, CLX_PCDT = 2; // Clx block tags: a property run (skipped), the piece table
  const PCD_SIZE        = 8;       // one piece descriptor
  const FC_COMPRESSED   = 0x40000000; // the piece is 8-bit text, at fc >> 1
  const FC_MASK         = 0x3FFFFFFF;
  /* One message for every way a .doc can defeat the reader. Which internal
     structure was missing is no use to the person at the drop zone; what
     they can do about it is. */
  const DOC_FAIL = "That .doc file couldn't be read. Open it in Word, save it " +
                   "as .docx, and drop the new file.";
  function readDoc(bytes){
    let streams;
    try { streams = readCfb(bytes); }
    catch (e){ throw new Error(DOC_FAIL); }
    const wd = streams["WordDocument"];
    if (!wd) throw new Error(DOC_FAIL);
    const wv = new DataView(wd.buffer, wd.byteOffset, wd.byteLength);
    if (wv.getUint16(0, true) !== FIB_MAGIC) throw new Error(DOC_FAIL);
    const which = (wv.getUint16(FIB_FLAGS, true) & FIB_WHICH_TABLE) ? "1Table" : "0Table";
    const tbl = streams[which] || streams["1Table"] || streams["0Table"];
    if (!tbl) throw new Error(DOC_FAIL);
    const tv = new DataView(tbl.buffer, tbl.byteOffset, tbl.byteLength);
    // walk the FIB to the Clx pointer rather than trusting a fixed offset:
    // FibRgW (csw words), cslw, FibRgLw (cslw longs), cbRgFcLcb, FibRgFcLcb
    const csw = wv.getUint16(FIB_CSW, true);
    const cslw = wv.getUint16(FIB_RGW + csw * 2, true);
    const rgFcLcb = FIB_RGW + csw * 2 + 2 + cslw * 4 + 2;
    const fcClx = wv.getUint32(rgFcLcb + FCLCB_CLX * FCLCB_SIZE, true);
    const lcbClx = wv.getUint32(rgFcLcb + FCLCB_CLX * FCLCB_SIZE + 4, true);
    let i = fcClx, pcdtAt = -1, pcdtLen = 0;
    const end = fcClx + lcbClx;
    while (i < end){
      if (tbl[i] === CLX_PRC) i += 3 + tv.getUint16(i + 1, true);
      else if (tbl[i] === CLX_PCDT){
        pcdtLen = tv.getUint32(i + 1, true); pcdtAt = i + 5; break;
      } else break;
    }
    if (pcdtAt < 0) throw new Error(DOC_FAIL);
    // n pieces: n+1 character positions, then n descriptors
    const n = Math.floor((pcdtLen - 4) / (4 + PCD_SIZE));
    const cps = [];
    for (let k = 0; k <= n; k++) cps.push(tv.getUint32(pcdtAt + 4 * k, true));
    const dec1 = new TextDecoder("windows-1252");
    const dec2 = new TextDecoder("utf-16le");
    let body = "";
    for (let k = 0; k < n; k++){
      const p = pcdtAt + 4 * (n + 1) + PCD_SIZE * k;
      const fc = tv.getUint32(p + 2, true);
      const compressed = (fc & FC_COMPRESSED) !== 0;
      const off = compressed ? (fc & FC_MASK) >>> 1 : (fc & FC_MASK);
      const chars = cps[k + 1] - cps[k];
      body += compressed ? dec1.decode(wd.subarray(off, off + chars))
                         : dec2.decode(wd.subarray(off, off + chars * 2));
    }
    return body.replace(/[\x07\x0b\x0c]/g, "\r").split("\r");
  }
  /* Prints as plain text - a .txt saved out of Word, or the document opened
     and copied. What the two Word readers above produce IS this: a list of
     paragraphs, tabs and all, and parseDiagrams reads nothing else. So the
     text is not a lesser input, it is the same input a step earlier. Checked
     on the real SUN 16/08 prints: 322 diagrams from the .docx, the same 322
     from its paragraphs joined with newlines and split again.

     The tabs are the whole structure - "Diagram:\tAZ\t601" - so this must
     never be run through any comma/tab tidying. */
  function looksLikePrints(text){
    return /(^|\n)\s*Diagram:\t/.test(text) || /\bDiagram:\t\w+\t\d+/.test(text);
  }
  /* The prints as a list of lines, from any of the four shapes they arrive
     in. The extension is only a hint; what matters is the first few bytes.
     Throws a message meant for the person at the drop zone. */
  function readPrints(bytes, unzip){
    const b = bytes;
    if (isDocxBytes(b)) return readDocx(bytes, unzip);
    if (b[0] === 0xD0 && b[1] === 0xCF && b[2] === 0x11 && b[3] === 0xE0 &&
        b[4] === 0xA1 && b[5] === 0xB1 && b[6] === 0x1A && b[7] === 0xE1)
      return readDoc(bytes);
    /* Notepad's "Unicode" saves: a byte-order mark and two bytes to the
       character. Read as UTF-8 that is one letter between NULs, which looked
       like nothing at all and was refused as "not the prints". */
    const utf16 = (b[0] === 0xFF && b[1] === 0xFE) ? "utf-16le"
                : (b[0] === 0xFE && b[1] === 0xFF) ? "utf-16be" : null;
    const dec = new TextDecoder(utf16 || "utf-8", {fatal:false});
    const head = dec.decode(bytes.subarray(0, 16)).trimStart();
    if (head.slice(0, 5) === "{\\rtf")
      throw new Error("That file is Rich Text, not Word. Open it in Word and save " +
                      "it as a Word Document.");
    const text = dec.decode(bytes).replace(/^\uFEFF/, "");
    if (looksLikePrints(text)) return text.replace(/\r\n?/g, "\n").split("\n");
    const csv = printsFromCsv(text);
    if (csv) return csv;
    throw new Error("That isn't the diagram prints. Drop the Word document, or " +
                    "save it as plain text or as a CSV — the diagram lines " +
                    "have to keep their columns.");
  }
  /* One CSV reader for the whole tool: rows of fields. Quoted fields,
     doubled quotes inside them, CRLF or LF, and a leading byte-order mark.
     Both weekday report exports and the CSV save of the prints go through it. */
  function csvParse(text) {
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
    const rows = [];
    let row = [], field = "", q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; }
          else q = false;
        } else field += c;
      } else if (c === '"') q = true;
      else if (c === ",") { row.push(field); field = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(field); field = "";
        if (row.length > 1 || row[0] !== "") rows.push(row);
        row = [];
      } else field += c;
    }
    row.push(field);
    if (row.length > 1 || row[0] !== "") rows.push(row);
    return rows;
  }

  /* The prints saved as a CSV. Word tables and spreadsheets both write the
     prints out with a comma between the cells instead of a tab, which the
     reader above cannot see: "Diagram:,AZ,601" is the same line as
     "Diagram:\tAZ\t601" and used to be refused as "not the diagram prints".
     So the cells are read back and re-joined with tabs, which is the shape
     everything downstream reads. Trailing empty cells go: a spreadsheet pads
     every row out to the widest one, and a run of tabs at the end of a line
     is not what the .docx produces.

     Only a file that turns out to BE the prints is taken - a Diagram Summary
     export is a CSV too, and it has to keep being refused rather than
     half-read into an empty book. Returns the lines, or null. */
  function printsFromCsv(text){
    if (text.indexOf(",") < 0) return null;
    const rows = csvParse(text);
    if (!rows.length) return null;
    const lines = rows.map(function(r){
      let end = r.length;
      while (end > 0 && String(r[end - 1]).trim() === "") end--;
      return r.slice(0, end).join("\t");
    });
    return looksLikePrints(lines.join("\n")) ? lines : null;
  }


root.SHEETS_PRINTS = {readPrints, docxParagraphs, docParaSpans, isDocxBytes,
                      looksLikePrints, printsFromCsv, csvParse};
})(typeof globalThis !== "undefined" ? globalThis : this);
