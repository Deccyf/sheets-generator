/* Loads every <script> block of a Sheets Generator HTML file into a fresh
   vm context, with a no-op DOM stub so the UI wiring blocks run harmlessly.
   Returns the context's globals (SHEETS_CORE, SHEETS_XLSX, GENIUS,
   SheetsEngine, ExcelJS, fflate, pako, …). Used both for the frozen legacy
   fixture (the oracle) and for the freshly built file (the candidate). */
import { readFileSync } from "node:fs";
import vm from "node:vm";

function domStub() {
  // An element stub that absorbs any property access or call.
  const el = () => new Proxy(function () {}, {
    get(t, p) {
      if (p === Symbol.toPrimitive || p === "toString") return () => "";
      if (p === "classList") return { add() {}, remove() {}, toggle() {} };
      if (p === "style") return new Proxy({}, { get: () => "", set: () => true });
      return el();
    },
    set() { return true; },
    apply() { return el(); },
  });
  return {
    querySelector: () => el(),
    querySelectorAll: () => [],
    getElementById: () => el(),
    createElement: () => el(),
    addEventListener() {},
    body: el(),
  };
}

export function extractScripts(html) {
  const out = [];
  const re = /<script>([\s\S]*?)<\/script>/g;
  let m;
  while ((m = re.exec(html)) !== null) out.push(m[1]);
  return out;
}

export function loadSandbox(htmlPath) {
  const html = readFileSync(htmlPath, "utf8");
  const scripts = extractScripts(html);
  const sandbox = {
    console, setTimeout, clearTimeout, setInterval, clearInterval,
    queueMicrotask, TextDecoder, TextEncoder, URL, URLSearchParams,
    Buffer, process,
    document: domStub(),
    navigator: { userAgent: "node" },
  };
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  sandbox.globalThis = sandbox;
  const ctx = vm.createContext(sandbox);
  for (const [i, src] of scripts.entries()) {
    try {
      vm.runInContext(src, ctx, { filename: `${htmlPath}#script${i}` });
    } catch (e) {
      throw new Error(`script block ${i} of ${htmlPath} failed: ${e.message}`);
    }
  }
  // Top-level consts (GENIUS, …) are global lexical bindings, not properties
  // of globalThis — collect them with one last evaluation in the same scope.
  const names = ["SHEETS_CORE", "SHEETS_XLSX", "SHEETS_DATA", "SHEETS_RULEBOOK",
                 "GENIUS", "SheetsEngine", "ExcelJS", "fflate", "pako"];
  const grab = "({" + names.map(n =>
    `${n}: typeof ${n} !== "undefined" ? ${n} : undefined`).join(",") + "})";
  const handles = vm.runInContext(grab, ctx);
  handles.__ctx = ctx;
  return handles;
}
