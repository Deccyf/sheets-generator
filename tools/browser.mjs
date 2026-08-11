/* Shared Playwright setup for the smoke tests and screenshot scripts.
   The browser and its Node package live outside the repo in this sandbox,
   so both paths are looked up here rather than repeated in every script -
   and both can be pointed elsewhere with an environment variable. */
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const PW_HOME = process.env.PLAYWRIGHT_NODE_MODULES ||
  "/opt/node22/lib/node_modules/playwright/";

/* PLAYWRIGHT_BROWSERS_PATH holds one versioned chromium-NNNN directory;
   find it rather than pinning the build number. */
function chromiumPath() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH || "/opt/pw-browsers";
  const dirs = existsSync(root)
    ? readdirSync(root).filter(d => d.startsWith("chromium-")).sort()
    : [];
  for (const d of dirs.reverse()) {
    const exe = join(root, d, "chrome-linux", "chrome");
    if (existsSync(exe)) return exe;
  }
  const flat = join(root, "chromium");
  if (existsSync(flat)) return flat;
  throw new Error("no chromium under " + root + " - set CHROMIUM_PATH");
}

/* The built file, as a file:// URL the browser will accept (its name has a
   space in it). */
export const BUILT = fileURLToPath(new URL("../Sheets Generator.html", import.meta.url));
export const BUILT_URL = "file://" + BUILT.replace(/ /g, "%20");

export function launch(opts) {
  const { chromium } = createRequire(PW_HOME)("playwright");
  return chromium.launch({ executablePath: chromiumPath(), ...opts });
}

/* The common case: a browser with one page already on the built file. */
export async function openPage(viewport) {
  const browser = await launch();
  const page = await browser.newPage(viewport ? { viewport } : undefined);
  await page.goto(BUILT_URL);
  return { browser, page };
}
