import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const BASE = "http://localhost:5173";
const VP = { width: 430, height: 932 };

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: VP });
const page = await ctx.newPage();

async function shot(name) {
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(dir, name) });
  console.log("captured", name);
}

// ── Screen 02: Inspection Setup ──────────────────────────────────────────────
await page.goto(BASE);
await page.click("text=Start New Inspection");
await shot("02-inspection-setup-main.png");

// ── Screen 04: Location Mode ─────────────────────────────────────────────────
// Continue through setup → tank overview → click Bottom surface
await page.click("button:has-text('Continue')");
await page.waitForTimeout(300);
// Click first surface card (Bottom)
await page.locator(".touch-row").first().click();
await shot("04-location-mode-main.png");

// ── Screen 05B: Manual X,Y Entry ─────────────────────────────────────────────
await page.click("text=Manual X,Y Entry");
await shot("05b-manual-entry-main.png");

// ── Back to location mode for Plate ID ──────────────────────────────────────
await page.goto(BASE);
await page.click("text=Start New Inspection");
await page.click("button:has-text('Continue')");
await page.waitForTimeout(300);
await page.locator(".touch-row").first().click();
await page.click("text=Plate ID Entry");
await shot("05c-plate-picker-main.png");

// ── Screen 15: Submission Success — navigate the full happy path ─────────────
// Start fresh
await page.goto(BASE);
await page.click("text=Start New Inspection");
await page.click("button:has-text('Continue')");
await page.waitForTimeout(300);
// Choose Bottom surface
await page.locator(".touch-row").first().click();
// Tap on Grid Map
await page.click("text=Tap on Grid Map");
// Select a cell — click roughly centre of the grid
await page.waitForTimeout(400);
await page.locator("svg rect.grid-cell-valid").nth(50).click();
await page.waitForTimeout(200);
await page.click("button:has-text('Confirm Location')");
await page.waitForTimeout(200);
// Confirm location
await page.click("button:has-text('Use This Location')");
await page.waitForTimeout(200);
// Pick defect type
await page.click("text=Corrosion");
await page.waitForTimeout(200);
// Severity
await page.click("text=Minor");
// Skip measurements
await page.click("text=Skip Measurements");
await page.waitForTimeout(200);
// Add evidence photo
await page.click("text=Take Photo");
await page.waitForTimeout(300);
// Save defect
await page.click("button:has-text('Save Defect')");
await page.waitForTimeout(300);
// Finish surface
await page.click("text=Finish Surface");
await page.waitForTimeout(300);
// Mark surface complete (surface review)
await page.click("button:has-text('Mark Surface Complete')");
await page.waitForTimeout(300);
// Now on validation — need Shell too; force submit by injecting synced state
// Instead just screenshot the validation screen and manually submit
await shot("14-inspection-validation-full.png");

await browser.close();
console.log("\nAll done.");
