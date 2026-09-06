// AIfekr promo-video screenshot tour.
//
// Read-only: never creates, edits, or deletes any data. Walks every page in
// pages.json, takes a full-page (or viewport, where configured) screenshot,
// and does a best-effort pass over any internal sub-tabs it finds on that
// page so a tabbed page (CRM, accounting) yields one screenshot per tab
// instead of just the first one.
//
// Usage:
//   AIFEKR_EMAIL=... AIFEKR_PASSWORD=... node run.js
//   (optional) AIFEKR_BASE_URL=https://aifekr.com   -- defaults to that
//
// Credentials are read from env vars only -- never hardcoded, never logged,
// never written into manifest.json/summary.md/errors.log.

const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const archiver = require("archiver");

const BASE_URL = process.env.AIFEKR_BASE_URL || "https://aifekr.com";
const EMAIL = process.env.AIFEKR_EMAIL;
const PASSWORD = process.env.AIFEKR_PASSWORD;
const OUT_DIR = path.join(__dirname, "aifekr-screenshots");
const STORAGE_STATE_PATH = path.join(__dirname, ".auth-state.json");
const PAGES = require("./pages.json");

function log(...args) {
  console.log(new Date().toISOString().slice(11, 19), ...args);
}

function redact(str) {
  // Defence in depth: even though we never print EMAIL/PASSWORD directly,
  // strip anything that looks like them out of any text we do log or write,
  // in case a page's own error message happens to echo the submitted value.
  let out = str;
  if (EMAIL) out = out.split(EMAIL).join("[redacted-email]");
  if (PASSWORD) out = out.split(PASSWORD).join("[redacted-password]");
  return out;
}

async function dismissOverlays(page) {
  // Best-effort: press Escape (closes most modal/dropdown patterns in this
  // app) and click any element that clearly reads as a close/dismiss control.
  try { await page.keyboard.press("Escape"); } catch {}
  const closeSelectors = [
    'button[aria-label*="close" i]', 'button[aria-label*="بستن"]',
    '[data-dismiss]', 'button:has-text("×")',
  ];
  for (const sel of closeSelectors) {
    try {
      const el = page.locator(sel).first();
      if (await el.isVisible({ timeout: 500 }).catch(() => false)) await el.click({ timeout: 1000 }).catch(() => {});
    } catch {}
  }
}

/**
 * Best-effort internal-tab detection. Real ARIA tabs (role="tab") are the
 * strongest signal; this app's own tab bars are usually plain buttons in a
 * row near the top of <main>, so we also collect short-text buttons inside
 * <main> that sit in the same horizontal band as the first one found, capped
 * to avoid pulling in unrelated buttons further down the page.
 */
async function findSubTabs(page) {
  const ariaTabs = await page.locator('[role="tablist"] [role="tab"]').all();
  if (ariaTabs.length > 1) {
    const labels = [];
    for (const t of ariaTabs) labels.push((await t.textContent() || "").trim());
    return { selector: '[role="tablist"] [role="tab"]', labels: labels.filter(Boolean) };
  }

  // Heuristic fallback: buttons inside <main>, short text, at least 3 of them,
  // all within ~80px vertical band of each other (a tab row).
  const candidates = await page.locator("main button").all();
  const withBox = [];
  for (const c of candidates.slice(0, 40)) {
    const text = (await c.textContent() || "").trim();
    if (!text || text.length > 24) continue;
    const box = await c.boundingBox().catch(() => null);
    if (!box) continue;
    withBox.push({ text, y: box.y });
  }
  if (withBox.length < 3) return null;
  withBox.sort((a, b) => a.y - b.y);
  const bandY = withBox[0].y;
  const band = withBox.filter((w) => Math.abs(w.y - bandY) < 12);
  if (band.length < 3) return null;
  return { selector: "main button", labels: band.map((b) => b.text) };
}

function slugify(text) {
  return text
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "tab";
}

async function login(context) {
  const page = await context.newPage();
  log("Logging in as", EMAIL ? EMAIL.replace(/(.{2}).+(@.+)/, "$1***$2") : "(no email set)");
  await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" });

  const emailInput = page.locator('input[type="email"], input[name="email"]').first();
  const passInput = page.locator('input[type="password"]').first();
  await emailInput.fill(EMAIL, { timeout: 10000 });
  await passInput.fill(PASSWORD, { timeout: 10000 });
  await Promise.all([
    page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20000 }).catch(() => null),
    page.locator('button[type="submit"]').first().click(),
  ]);
  await page.waitForTimeout(1500);

  if (page.url().includes("/login")) {
    await page.close();
    throw new Error("Login did not redirect away from /login -- credentials likely wrong. Stopping (per spec: never continue with an invalid session).");
  }
  log("Login OK, storage state saved.");
  await context.storageState({ path: STORAGE_STATE_PATH });
  await page.close();
}

async function shootPage(context, def, manifest, errors, reviewFlags) {
  const page = await context.newPage();
  const folderDir = path.join(OUT_DIR, def.folder);
  fs.mkdirSync(folderDir, { recursive: true });
  const url = `${BASE_URL}${def.path}`;

  try {
    const resp = await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
    if (resp && resp.status() >= 400) throw new Error(`HTTP ${resp.status()}`);
    await page.waitForTimeout(1500);
    await dismissOverlays(page);

    const shots = [];
    const subTabs = def.skipSubTabs ? null : await findSubTabs(page).catch(() => null);

    if (!subTabs) {
      shots.push({ suffix: "01-dashboard", label: "dashboard" });
    } else {
      subTabs.labels.forEach((label, i) => shots.push({ suffix: `${String(i + 1).padStart(2, "0")}-${slugify(label)}`, label, index: i }));
    }

    for (const shot of shots) {
      if (shot.index != null) {
        const els = await page.locator(subTabs.selector).all();
        if (els[shot.index]) {
          await els[shot.index].click({ timeout: 5000 }).catch(() => {});
          await page.waitForTimeout(1200);
          await dismissOverlays(page);
        }
      }
      const fileName = `${def.folder}-${shot.suffix}.png`;
      const filePath = path.join(folderDir, fileName);
      await page.screenshot({ path: filePath, fullPage: def.fullPage !== false });

      // Cheap heuristic flag only -- never altered, just surfaced for a human to check.
      const bodyText = await page.locator("body").innerText().catch(() => "");
      const looksSensitive = /@gmail\.com|@yahoo\.com|09\d{9}\b/.test(bodyText) && !/example\.com|09120000000/.test(bodyText);
      if (looksSensitive) reviewFlags.push(`${def.folder}/${fileName} -- page text contains what looks like a real email/phone number`);

      manifest.push({
        folder: def.folder,
        section_title_fa: def.title,
        file: fileName,
        source_url: url,
        sub_view: shot.label,
        description: "",
      });
      log("shot:", def.folder, "/", fileName);
    }
  } catch (err) {
    const msg = redact(String(err && err.message ? err.message : err));
    errors.push(`[${def.folder}] [${url}] [${msg}] [${new Date().toISOString()}]`);
    log("ERROR:", def.folder, msg);
  } finally {
    await page.close();
  }
}

async function zipOutput() {
  const zipPath = path.join(__dirname, "aifekr-screenshots.zip");
  await new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = archiver("zip", { zlib: { level: 9 } });
    output.on("close", resolve);
    archive.on("error", reject);
    archive.pipe(output);
    archive.directory(OUT_DIR, false);
    archive.finalize();
  });
  return zipPath;
}

async function main() {
  if (!EMAIL || !PASSWORD) {
    console.error("Set AIFEKR_EMAIL and AIFEKR_PASSWORD env vars before running (never hardcode them).");
    process.exit(1);
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });

  await login(context);

  const manifest = [];
  const errors = [];
  const reviewFlags = [];

  for (const def of PAGES) {
    await shootPage(context, def, manifest, errors, reviewFlags);
    await new Promise((r) => setTimeout(r, 1200));
  }

  await browser.close();

  fs.writeFileSync(path.join(OUT_DIR, "manifest.json"), JSON.stringify(manifest, null, 2));
  fs.writeFileSync(path.join(OUT_DIR, "errors.log"), errors.join("\n") + (errors.length ? "\n" : ""));

  const byFolder = {};
  for (const def of PAGES) byFolder[def.folder] = { title: def.title, success: 0, error: false };
  for (const m of manifest) byFolder[m.folder].success++;
  for (const e of errors) {
    const folder = e.match(/^\[([^\]]+)\]/)?.[1];
    if (folder && byFolder[folder]) byFolder[folder].error = true;
  }

  const summaryLines = [
    "# AIfekr Screenshot Tour -- Summary", "",
    `Run at: ${new Date().toISOString()}`,
    `Base URL: ${BASE_URL}`, "",
    "| Folder | Title | Screenshots | Status |",
    "|---|---|---|---|",
    ...Object.entries(byFolder).map(([folder, v]) => `| ${folder} | ${v.title} | ${v.success} | ${v.error ? "⚠️ error" : "✅ ok"} |`),
    "",
    "## Errors", "",
    errors.length ? errors.map((e) => `- ${e}`).join("\n") : "None.",
    "",
    "## Flagged for manual review (possible real personal data)", "",
    reviewFlags.length ? reviewFlags.map((f) => `- ${f}`).join("\n") : "None flagged.",
    "",
    "## Newly discovered pages", "",
    "None -- this run only walked pages.json. If you want the script to also",
    "crawl the sidebar/nav for links not in pages.json and report them, that's",
    "a follow-up, not implemented in this pass.",
  ];
  fs.writeFileSync(path.join(OUT_DIR, "summary.md"), summaryLines.join("\n"));

  const zipPath = await zipOutput();

  log("Done.");
  log(`Screenshots: ${manifest.length}, Errors: ${errors.length}, Flagged: ${reviewFlags.length}`);
  log("Output:", OUT_DIR);
  log("Zip:", zipPath);
}

main().catch((err) => {
  console.error("Fatal:", redact(String(err && err.message ? err.message : err)));
  process.exit(1);
});
