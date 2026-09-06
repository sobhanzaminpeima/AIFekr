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

  // Heuristic fallback: this app uses several different tab patterns --
  // plain buttons in a HORIZONTAL row for route-based sub-pages (e.g.
  // Accounting's own nav bar), and plain buttons in a VERTICAL list for
  // client-state tabs (e.g. CRM's own left-hand Pipeline/Contacts/... list,
  // md:w-full stacked buttons rather than a top row). Collect both tags,
  // short text, at least 3 of them, then check for a same-Y band (row) OR a
  // same-X band (column) -- whichever exists.
  const candidates = await page.locator("main button, main a").all();
  const withBox = [];
  for (const c of candidates.slice(0, 60)) {
    const text = (await c.textContent() || "").trim();
    if (!text || text.length > 24) continue;
    const box = await c.boundingBox().catch(() => null);
    if (!box) continue;
    withBox.push({ text, x: box.x, y: box.y });
  }
  if (withBox.length < 3) return null;

  // Anchoring the band to whichever element happens to sort first (smallest
  // x or y) breaks the moment an unrelated outlier -- e.g. a search box at
  // x=16 -- sorts ahead of the real 15-item tab column sitting at x=234.
  // Instead, find whichever single element has the most OTHER elements
  // within 12px of it on that axis, and band around that one.
  function largestBand(items, axis) {
    let best = null;
    for (const anchor of items) {
      const band = items.filter((w) => Math.abs(w[axis] - anchor[axis]) < 12);
      if (!best || band.length > best.length) best = band;
    }
    return best || [];
  }

  // Prefer whichever axis actually clusters more items -- a page can have
  // both a 3-button header row (New/Export-style actions) AND a 15-item
  // sidebar tab column; the column is the more useful "real" tab list, so
  // pick by size, not by checking rows first.
  const rowBand = largestBand(withBox, "y");
  const colBand = largestBand(withBox, "x");
  const winner = colBand.length > rowBand.length ? colBand : rowBand;
  // Cap it: a long results list or table column sharing a left margin would
  // otherwise read as "20 tabs" and burn 20 screenshots on one page.
  if (winner.length >= 3) return { selector: "main button, main a", labels: winner.slice(0, 16).map((b) => b.text) };

  return null;
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

  // The login page defaults to a phone/OTP tab, with a separate email/password
  // tab -- and none of its buttons carry type="submit" (they're plain
  // <button onClick=...>, not a <form>), so neither can be found by type.
  // Click the email tab by its label (fa/en/de all have distinct strings),
  // then the submit button by its own label -- matched by any of the three
  // languages, since which one is default isn't guaranteed.
  const emailTab = page.getByRole("button", { name: /^(ایمیل|Email|E-Mail)$/ }).first();
  if (await emailTab.isVisible({ timeout: 5000 }).catch(() => false)) await emailTab.click();

  const emailInput = page.locator('input[type="email"]').first();
  const passInput = page.locator('input[type="password"]').first();
  await emailInput.fill(EMAIL, { timeout: 10000 });
  await passInput.fill(PASSWORD, { timeout: 10000 });

  const submitBtn = page.getByRole("button", { name: /^(ورود|Sign in|Anmelden)$/ }).first();
  await Promise.all([
    page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20000 }).catch(() => null),
    submitBtn.click({ timeout: 10000 }),
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
    // "networkidle" never fires on a page with an open websocket or
    // background polling (CRM, Social both timed out here) -- "load" plus a
    // fixed settle delay is more robust across a mixed app like this one.
    const resp = await page.goto(url, { waitUntil: "load", timeout: 30000 });
    if (resp && resp.status() >= 400) throw new Error(`HTTP ${resp.status()}`);
    // Some pages (CRM in particular) render their own internal tab list only
    // after a client-side module-access fetch resolves -- 2.5s wasn't enough
    // for that to land before the sub-tab scan ran, so every page silently
    // fell back to a single "dashboard" shot. 4s covers it without adding
    // much to a 19-page run.
    await page.waitForTimeout(4000);
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
        // Re-locate by exact label text on the CURRENT page rather than by
        // index into a fixed element list: a route-based tab (Accounting's
        // own nav) navigates to a whole new page, which invalidates any
        // earlier-captured element handles and can reorder/regenerate the
        // underlying elements entirely.
        const target = page.locator("main button, main a").filter({ hasText: shot.label }).first();
        if (await target.count()) {
          await Promise.all([
            page.waitForLoadState("load", { timeout: 15000 }).catch(() => {}),
            target.click({ timeout: 5000 }).catch(() => {}),
          ]);
          await page.waitForTimeout(1800);
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
