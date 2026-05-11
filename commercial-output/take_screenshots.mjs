import { chromium } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_URL = 'http://localhost:5176';
const OUT = path.join(__dirname, 'screenshots');

import { mkdirSync } from 'fs';
mkdirSync(OUT, { recursive: true });

const VIEWPORT = { width: 390, height: 844 }; // iPhone 14 Pro

async function shot(page, name) {
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: false });
  console.log(`  saved ${name}.png`);
}

async function fillSetup(page) {
  await page.fill('input[placeholder*="Petronas"]', 'PETRONAS Carigali');
  await page.fill('input[placeholder*="Kerteh"]', 'Kerteh, Terengganu');
  await page.fill('input[placeholder*="5470"]', '5470');
  await page.fill('input[placeholder*="26.5"]', '26.5');
  await page.fill('input[placeholder*="10.0"]', '10.0');
  await page.fill('input[placeholder*="6"]', '6');
  // Pick roof type
  const roofSelect = page.locator('select').first();
  await roofSelect.selectOption({ index: 1 });
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: VIEWPORT });
  const page = await ctx.newPage();

  await page.goto(BASE_URL, { waitUntil: 'networkidle' });

  // ── 1. Home ──
  console.log('1. Home');
  await shot(page, '01_home');

  // ── 2. Inspection Setup ──
  console.log('2. Inspection Setup');
  await page.getByText('New Inspection').first().click();
  await page.waitForTimeout(400);
  await shot(page, '02_setup_empty');
  await fillSetup(page);
  await shot(page, '03_setup_filled');

  // ── 3. Inspection Scope ──
  console.log('3. Inspection Scope');
  await page.getByText('Continue').first().click();
  await page.waitForTimeout(500);
  await shot(page, '04_scope');

  // enable all tasks
  const toggles = page.locator('input[type="checkbox"], button[role="switch"]');
  const count = await toggles.count();
  for (let i = 0; i < count; i++) {
    const t = toggles.nth(i);
    const checked = await t.getAttribute('aria-checked') ?? await t.isChecked().catch(() => null);
    if (checked === false || checked === 'false') await t.click().catch(() => {});
  }
  await page.waitForTimeout(300);
  await shot(page, '04b_scope_all_tasks');

  // ── 4. Task Board ──
  console.log('4. Task Board');
  await page.getByText('Continue').first().click();
  await page.waitForTimeout(600);
  await shot(page, '05_taskboard');

  // ── 5. Shell UT ──
  console.log('5. Shell UT');
  // find the Shell UT card and click Start/Continue
  const shellBtn = page.locator('button', { hasText: /Start|Continue/ }).first();
  await shellBtn.click();
  await page.waitForTimeout(500);
  await shot(page, '06_shell_ut_empty');

  // fill in a reading
  const readingInputs = page.locator('input[type="number"], input[inputmode="decimal"], input[inputmode="numeric"]');
  const rCount = await readingInputs.count();
  for (let i = 0; i < Math.min(5, rCount); i++) {
    await readingInputs.nth(i).fill(String(10.5 - i * 0.2));
  }
  await page.waitForTimeout(400);
  await shot(page, '07_shell_ut_filled');

  // ── 6. Shell Inline Finding ──
  console.log('6. Shell Finding');
  const findingBtn = page.getByText('Add Finding Here').first();
  if (await findingBtn.isVisible()) {
    await findingBtn.click();
    await page.waitForTimeout(500);
    await shot(page, '08_shell_finding');
  }

  // ── 7. Go back to Task Board → Review ──
  console.log('7. Review');
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  // resume draft if available
  const resumeBtn = page.getByText('Resume Draft').first();
  if (await resumeBtn.isVisible().catch(() => false)) {
    await resumeBtn.click();
    await page.waitForTimeout(500);
  }
  // navigate to review card
  const reviewBtn = page.locator('button', { hasText: /Review/ }).first();
  if (await reviewBtn.isVisible().catch(() => false)) {
    await reviewBtn.click();
    await page.waitForTimeout(500);
    await shot(page, '09_review');
  }

  // ── 8. Export ──
  console.log('8. Export');
  const exportBtn = page.getByText('Continue to Export').first();
  if (await exportBtn.isVisible().catch(() => false)) {
    await exportBtn.click();
    await page.waitForTimeout(500);
    await shot(page, '10_export');
  }

  await browser.close();
  console.log('Done. Screenshots in:', OUT);
})();
