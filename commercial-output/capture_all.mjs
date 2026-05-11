/**
 * Captures screenshots + animated GIFs of Tank Inspection Copilot for the BD deck.
 * All output goes into commercial-output/screenshots/ and commercial-output/videos/
 */
import { chromium } from '@playwright/test';
import { mkdirSync, readdirSync } from 'fs';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_URL = 'http://localhost:5176';
const SHOTS = path.join(__dirname, 'screenshots');
const VIDS  = path.join(__dirname, 'videos');
mkdirSync(SHOTS, { recursive: true });
mkdirSync(VIDS,  { recursive: true });

const VIEWPORT = { width: 390, height: 844 };
const pause = (ms) => new Promise(r => setTimeout(r, ms));

async function shot(page, name, label) {
  await pause(700);
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
  console.log(`  ✓ ${name}.png  [${label}]`);
}

// Jump straight to Task Board with pre-filled sample data
async function loadSampleDraft(page) {
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await pause(400);
  // Both home rows say "Open" — Resume Draft is the second one
  await page.locator('button.laiq-action-row').filter({ hasText: 'Resume Draft' }).click();
  await pause(800);
}

// Click a task card on the Task Board by its label (exact strong text)
async function clickTask(page, label) {
  await page.locator('.laiq-action-row strong').filter({ hasText: label }).first().click();
  await pause(700);
}

// ══════════════════════════════════════════════════════════════════════
//  SCREENSHOTS
// ══════════════════════════════════════════════════════════════════════
async function takeScreenshots() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: VIEWPORT });
  const page = await ctx.newPage();

  // 1 — Home
  console.log('[1] Home');
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await shot(page, '01_home', 'Home');

  // 2 — Inspection Setup (blank)
  console.log('[2] Setup');
  await page.getByRole('button', { name: 'New Inspection' }).first().click();
  await pause(400);
  await shot(page, '02_setup_blank', 'Setup blank');

  // fill setup form
  await page.getByRole('textbox', { name: /Client/i }).fill('PETRONAS Carigali');
  await page.getByRole('textbox', { name: /Location/i }).fill('Kerteh, Terengganu');
  await page.getByRole('textbox', { name: /Tank Number/i }).fill('T-5470');
  await page.getByRole('textbox', { name: /Diameter/i }).fill('26.5');
  await page.getByRole('textbox', { name: /Height/i }).fill('10.0');
  await page.getByRole('textbox', { name: /Shell Courses/i }).fill('6');
  await page.locator('select').first().selectOption('fixed_cone');
  await pause(300);
  await shot(page, '03_setup_filled', 'Setup filled');

  // 3 — Inspection Scope
  console.log('[3] Scope');
  await page.getByRole('button', { name: 'Continue' }).first().click();
  await pause(600);
  await shot(page, '04_scope', 'Scope');

  // 4 — Task Board (sample draft)
  console.log('[4] Task Board');
  await loadSampleDraft(page);
  await shot(page, '05_taskboard', 'Task Board');

  // 5 — Shell UT entry (empty)
  console.log('[5] Shell UT');
  await clickTask(page, 'Shell UT');
  await shot(page, '06_shellut_entry', 'Shell UT entry');

  // fill readings
  const readingLabels = ['R1', 'R2', 'R3', 'R4', 'R5'];
  const readingVals   = ['10.8', '10.6', '10.7', '10.5', '10.9'];
  for (let i = 0; i < 5; i++) {
    const inp = page.getByRole('textbox', { name: readingLabels[i] }).first();
    if (await inp.isVisible().catch(() => false)) {
      await inp.fill(readingVals[i]);
    }
  }
  await pause(400);
  await shot(page, '07_shellut_readings', 'Shell UT with readings');

  // 6 — Shell Inline Finding
  console.log('[6] Shell Finding');
  const findingBtn = page.getByText('Add Finding Here').first();
  if (await findingBtn.isVisible().catch(() => false)) {
    await findingBtn.click();
    await pause(700);
    await shot(page, '08_shell_finding', 'Shell Inline Finding');
  }

  // 7 — Shell Layout Setup + Precise Location Map
  console.log('[7] Shell Precise Location');
  await loadSampleDraft(page);
  await clickTask(page, 'Shell UT');
  const findingBtn2 = page.getByText('Add Finding Here').first();
  if (await findingBtn2.isVisible().catch(() => false)) {
    await findingBtn2.click();
    await pause(600);

    // Finding requires photo + type + severity before "Add Precise Location" saves
    await page.getByRole('button', { name: 'Take Photo' }).first().click();
    await pause(300);
    // Select finding type from ChoiceList (buttons)
    await page.locator('.laiq-choice-item').filter({ hasText: /Localized Corrosion/i }).first().click();
    await pause(200);
    // Select severity (SegmentedControl buttons)
    await page.locator('.laiq-segmented-control button, .laiq-segment').filter({ hasText: /^Medium$/ }).first().click().catch(async () => {
      await page.getByRole('button', { name: 'Medium' }).first().click();
    });
    await pause(200);

    // "Add Precise Location" is in the footer — since shellLayoutConfigured=false it goes to shellLayout screen
    const preciseBtn = page.getByRole('button', { name: /Add Precise Location/i }).first();
    if (await preciseBtn.isVisible().catch(() => false)) {
      await preciseBtn.click();
      await pause(800);
      await shot(page, '09_shell_layout_setup', 'Shell Layout Setup');

      // Layout inputs: plate width and seam azimuth (inputmode="decimal")
      // fill() clears existing value before typing
      const plateInput = page.locator('input[inputmode="decimal"]').first();
      const seamInput  = page.locator('input[inputmode="decimal"]').nth(1);
      if (await plateInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await plateInput.fill('1850');
      }
      if (await seamInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await seamInput.fill('0');
      }
      await pause(300);
      const saveLayoutBtn = page.getByRole('button', { name: /Continue to Shell Map/i }).first();
      if (await saveLayoutBtn.isVisible().catch(() => false)) {
        await saveLayoutBtn.click();
        await pause(1000);
        await shot(page, '10_shell_precise_map', 'Shell Precise Location Map');
        // tap a few cells on the SVG shell map to show selection
        const svgs = page.locator('svg');
        const svgCount = await svgs.count();
        // pick the largest SVG (the shell canvas)
        let shellSvg = null;
        let maxArea = 0;
        for (let i = 0; i < svgCount; i++) {
          const box = await svgs.nth(i).boundingBox().catch(() => null);
          if (box && box.width * box.height > maxArea) { maxArea = box.width * box.height; shellSvg = svgs.nth(i); }
        }
        if (shellSvg) {
          const box = await shellSvg.boundingBox();
          if (box) {
            for (const [col, row] of [[0.15,0.1],[0.3,0.2],[0.5,0.35],[0.65,0.5]]) {
              await page.mouse.click(box.x + box.width * col, box.y + box.height * row);
              await pause(300);
            }
            await shot(page, '10b_shell_map_marked', 'Shell Map with selections');
          }
        }
      }
    }
  }

  // 8 — Roof UT
  console.log('[8] Roof UT');
  await loadSampleDraft(page);
  await clickTask(page, 'Roof UT');
  await shot(page, '11_roof_ut', 'Roof UT');

  // 9 — Review
  console.log('[9] Review');
  await loadSampleDraft(page);
  await clickTask(page, 'Review');
  await pause(600);
  await shot(page, '12_review', 'Review');

  // 10 — Export
  console.log('[10] Export');
  const expBtn = page.getByRole('button', { name: /Continue to Export/i }).first();
  if (await expBtn.isVisible().catch(() => false)) {
    await expBtn.click();
    await pause(600);
    await shot(page, '13_export', 'Export');
  }

  await browser.close();
  console.log('\n✅ Screenshots done →', SHOTS);
}

// ══════════════════════════════════════════════════════════════════════
//  GIF helper
// ══════════════════════════════════════════════════════════════════════
async function recordGif(name, fps, recordFn) {
  console.log(`\n[GIF] ${name}…`);
  const videoDir = path.join(VIDS, `${name}_raw`);
  mkdirSync(videoDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: VIEWPORT,
    recordVideo: { dir: videoDir, size: { width: 390, height: 844 } },
  });
  const page = await ctx.newPage();

  await recordFn(page);
  await pause(500);

  const videoPath = await page.video()?.path();
  await ctx.close();
  await browser.close();

  if (videoPath) {
    const gifOut = path.join(SHOTS, `${name}.gif`);
    execSync(
      `ffmpeg -y -i "${videoPath}" -vf "fps=${fps},scale=390:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse" "${gifOut}"`,
      { stdio: 'pipe' }
    );
    console.log(`  ✓ ${name}.gif`);
  } else {
    console.log(`  ⚠ No video — skipping ${name}.gif`);
  }
}

// GIF 1: Shell map interaction — tap cells to show defect pin
async function gifShellMap(page) {
  await loadSampleDraft(page);
  await clickTask(page, 'Shell UT');

  const findingBtn = page.getByText('Add Finding Here').first();
  if (!await findingBtn.isVisible().catch(() => false)) return;
  await findingBtn.click();
  await pause(600);

  // Fill required fields so saveFinding(true) passes validation
  await page.getByRole('button', { name: 'Take Photo' }).first().click().catch(() => {});
  await pause(200);
  await page.locator('.laiq-choice-item').filter({ hasText: /Localized Corrosion/i }).first().click().catch(() => {});
  await pause(200);
  await page.locator('.laiq-segment').filter({ hasText: /^Medium$/ }).first().click().catch(() => {});
  await pause(200);

  const preciseBtn = page.getByRole('button', { name: /Add Precise Location/i }).first();
  if (!await preciseBtn.isVisible().catch(() => false)) return;
  await preciseBtn.click();
  await pause(700);

  // fill layout fields — shellLayoutConfigured=false so shellLayout screen appears
  const lPlate = page.locator('input[inputmode="decimal"]').first();
  const lSeam  = page.locator('input[inputmode="decimal"]').nth(1);
  if (await lPlate.isVisible({ timeout: 3000 }).catch(() => false)) await lPlate.fill('1850');
  if (await lSeam.isVisible({ timeout: 3000 }).catch(() => false)) await lSeam.fill('0');
  await pause(400);

  const saveBtn = page.getByRole('button', { name: /Continue to Shell Map/i }).first();
  if (await saveBtn.isVisible().catch(() => false)) {
    await saveBtn.click();
    await pause(800);
  }

  // tap cells on the precise location map
  const svg = page.locator('svg').first();
  if (await svg.isVisible().catch(() => false)) {
    const box = await svg.boundingBox();
    if (box) {
      const cells = [
        [0.15, 0.1], [0.3, 0.1], [0.45, 0.25], [0.6, 0.25],
        [0.45, 0.45], [0.3, 0.6], [0.5, 0.6], [0.65, 0.45],
      ];
      for (const [cx, cy] of cells) {
        await page.mouse.click(box.x + box.width * cx, box.y + box.height * cy);
        await pause(350);
      }
    }
  }
  await pause(700);
}

// GIF 2: Task Board scroll — shows all 6 task cards
async function gifTaskBoard(page) {
  await loadSampleDraft(page);
  await pause(600);
  for (let y = 0; y <= 700; y += 30) {
    await page.evaluate(s => window.scrollTo(0, s), y);
    await pause(60);
  }
  await pause(400);
  for (let y = 700; y >= 0; y -= 30) {
    await page.evaluate(s => window.scrollTo(0, s), y);
    await pause(60);
  }
  await pause(500);
}

// GIF 3: Shell UT matrix fill — shows bearing × strake readings being entered
async function gifShellMatrix(page) {
  await loadSampleDraft(page);
  await clickTask(page, 'Shell UT');

  const readingLabels = ['R1', 'R2', 'R3', 'R4', 'R5'];
  const vals = ['10.8', '10.6', '10.7', '10.5', '10.9'];
  for (let i = 0; i < 5; i++) {
    const inp = page.getByRole('textbox', { name: readingLabels[i] }).first();
    if (await inp.isVisible().catch(() => false)) {
      await inp.click();
      await pause(200);
      await inp.fill(vals[i]);
      await pause(300);
    }
  }
  await pause(600);

  // save and go to next bearing
  const saveBtn = page.getByRole('button', { name: /Save Strake|Save/i }).first();
  if (await saveBtn.isVisible().catch(() => false)) {
    await saveBtn.click();
    await pause(600);
  }

  // fill second set of readings
  for (let i = 0; i < 5; i++) {
    const inp = page.getByRole('textbox', { name: readingLabels[i] }).first();
    if (await inp.isVisible().catch(() => false)) {
      await inp.click();
      await inp.fill(String(10.4 - i * 0.1));
      await pause(250);
    }
  }
  await pause(700);
}

// ══════════════════════════════════════════════════════════════════════
//  MAIN
// ══════════════════════════════════════════════════════════════════════
(async () => {
  console.log('=== Tank Inspection Copilot — BD Asset Capture ===\n');
  await takeScreenshots();
  await recordGif('shell_map_demo',   8, gifShellMap);
  await recordGif('taskboard_scroll', 10, gifTaskBoard);
  await recordGif('shellut_matrix',   8, gifShellMatrix);

  console.log('\n=== All assets ===');
  readdirSync(SHOTS).forEach(f => console.log(' ', f));
})();
