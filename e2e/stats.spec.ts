/**
 * E2E tests for the usage stats panel (issue #20).
 *
 * Feature summary:
 *  - Clicking the avatar button in the sidebar footer opens a "Usage stats" dialog.
 *  - The dialog shows "Total active time" and a feature table with Feature / Count /
 *    Last used columns.
 *  - Pressing Escape closes the dialog.
 *  - Clicking the backdrop (outside the panel) closes the dialog.
 *  - Clicking the explicit close button (×) closes the dialog.
 *  - After performing a tracked action (e.g. clicking toolbar "child" button or
 *    creating a map), the stats panel shows a non-zero count for that feature.
 *
 * Fixture notes:
 *  - The standard single-map fixture from fixtures.ts is used for most tests.
 *  - The page-ready wait in the base fixture uses getByText('maps') — that is fine
 *    for a single map ("1 map") but must use { exact: true } when seeding multiple
 *    maps to avoid a strict-mode violation.
 *  - The test user has displayName "Test User" so no photoURL is present; the avatar
 *    renders as an <avatarPlaceholder> span inside a button with title "View usage stats".
 */

import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';

// ─── helpers ─────────────────────────────────────────────────────────────────

/** The avatar button in the sidebar footer that opens the stats panel. */
const avatarBtn = (page: Page) =>
  page.getByTitle('View usage stats');

/** The stats dialog itself (role=dialog). */
const statsDialog = (page: Page) =>
  page.getByRole('dialog', { name: 'Usage stats' });

/** The backdrop element that wraps the panel (clicking it closes the panel). */
const statsBackdrop = (page: Page) =>
  page.locator('[class*="backdrop"]');

/** Add a child node via the toolbar and wait for the inline-edit input to appear,
 *  then dismiss it so the node count increments cleanly. */
const canvasEditInput = (page: Page) => page.locator('input[style]');

async function addChildAndClose(page: Page) {
  await page.getByRole('button', { name: 'child', exact: true }).click();
  await canvasEditInput(page).waitFor({ state: 'visible', timeout: 2000 });
  await page.keyboard.press('Escape');
}

// ─── 1. Avatar button opens the stats panel ───────────────────────────────────

test('clicking the avatar opens the usage stats panel', async ({ page }) => {
  await avatarBtn(page).click();
  await expect(statsDialog(page)).toBeVisible();
});

// ─── 2. Stats panel content ───────────────────────────────────────────────────

test('stats panel shows "Total active time" label', async ({ page }) => {
  await avatarBtn(page).click();
  await expect(statsDialog(page).getByText('Total active time:', { exact: false })).toBeVisible();
});

test('stats panel shows a feature table with Feature, Count, Last used columns', async ({ page }) => {
  await avatarBtn(page).click();
  const dialog = statsDialog(page);
  await expect(dialog.getByRole('columnheader', { name: 'Feature' })).toBeVisible();
  await expect(dialog.getByRole('columnheader', { name: 'Count' })).toBeVisible();
  await expect(dialog.getByRole('columnheader', { name: 'Last used' })).toBeVisible();
});

test('stats panel lists known feature rows', async ({ page }) => {
  await avatarBtn(page).click();
  const dialog = statsDialog(page);
  // A representative sample of the feature labels defined in StatsPanel.tsx
  await expect(dialog.getByRole('cell', { name: 'Add child' })).toBeVisible();
  await expect(dialog.getByRole('cell', { name: 'Create map' })).toBeVisible();
  await expect(dialog.getByRole('cell', { name: 'Fit view' })).toBeVisible();
});

// ─── 3. Closing the panel ─────────────────────────────────────────────────────

test('pressing Escape closes the stats panel', async ({ page }) => {
  await avatarBtn(page).click();
  await expect(statsDialog(page)).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(statsDialog(page)).not.toBeAttached();
});

test('clicking outside the panel (backdrop) closes it', async ({ page }) => {
  await avatarBtn(page).click();
  await expect(statsDialog(page)).toBeVisible();

  // Click on the backdrop at the top-left corner, well away from the panel
  await statsBackdrop(page).click({ position: { x: 5, y: 5 } });
  await expect(statsDialog(page)).not.toBeAttached();
});

test('clicking the × close button closes the stats panel', async ({ page }) => {
  await avatarBtn(page).click();
  await expect(statsDialog(page)).toBeVisible();

  await statsDialog(page).getByRole('button', { name: 'Close' }).click();
  await expect(statsDialog(page)).not.toBeAttached();
});

test('panel does not close when clicking inside it', async ({ page }) => {
  await avatarBtn(page).click();
  await expect(statsDialog(page)).toBeVisible();

  // Click somewhere in the middle of the dialog content area
  await statsDialog(page).click({ position: { x: 10, y: 10 } });
  await expect(statsDialog(page)).toBeVisible();
});

// ─── 4. Counts update after tracked actions ───────────────────────────────────

test('after clicking toolbar "child" button, stats panel shows count ≥ 1 for Add child', async ({ page }) => {
  // Perform the tracked action BEFORE opening the panel so getStats() reflects it
  await addChildAndClose(page);

  await avatarBtn(page).click();
  const dialog = statsDialog(page);

  // Find the row for "Add child" and assert its Count cell is not 0
  const addChildRow = dialog.getByRole('row', { name: /Add child/ });
  // The Count cell is the second <td> in the row
  const countCell = addChildRow.getByRole('cell').nth(1);
  const countText = await countCell.textContent();
  expect(Number(countText)).toBeGreaterThanOrEqual(1);
});

test('after creating a map, stats panel shows count ≥ 1 for Create map', async ({ page }) => {
  // Create a new map via the sidebar + button
  page.on('dialog', (dialog) => dialog.accept('Stats Test Map'));
  await page.getByTitle('New map').click();
  // Wait for the new map to appear
  await expect(page.locator('aside').getByText('2 maps')).toBeVisible();

  await avatarBtn(page).click();
  const dialog = statsDialog(page);

  const createMapRow = dialog.getByRole('row', { name: /Create map/ });
  const countCell = createMapRow.getByRole('cell').nth(1);
  const countText = await countCell.textContent();
  expect(Number(countText)).toBeGreaterThanOrEqual(1);
});

test('after clicking toolbar "child", Add child row shows "just now" as Last used', async ({ page }) => {
  await addChildAndClose(page);

  await avatarBtn(page).click();
  const dialog = statsDialog(page);

  const addChildRow = dialog.getByRole('row', { name: /Add child/ });
  const lastUsedCell = addChildRow.getByRole('cell').nth(2);
  await expect(lastUsedCell).toHaveText('just now');
});

test('features with zero usage show "never" as Last used', async ({ page }) => {
  await avatarBtn(page).click();
  const dialog = statsDialog(page);

  // Export JSON has not been used — its Last used cell should say "never"
  const exportJsonRow = dialog.getByRole('row', { name: /Export JSON/ });
  const lastUsedCell = exportJsonRow.getByRole('cell').nth(2);
  await expect(lastUsedCell).toHaveText('never');
});

// ─── 5. Stats panel is not visible by default ─────────────────────────────────

test('stats panel is not shown on initial page load', async ({ page }) => {
  await expect(statsDialog(page)).not.toBeAttached();
});

// ─── 6. Panel can be opened and closed multiple times ─────────────────────────

test('stats panel can be opened and closed multiple times', async ({ page }) => {
  for (let i = 0; i < 3; i++) {
    await avatarBtn(page).click();
    await expect(statsDialog(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(statsDialog(page)).not.toBeAttached();
  }
});

// ─── 7. "Since" date display (issue #68) ─────────────────────────────────────

test('stats panel shows a "Since" line below Total active time', async ({ page }) => {
  await avatarBtn(page).click();
  const dialog = statsDialog(page);
  // The element has class "since" and starts with the word "Since"
  const sinceEl = dialog.locator('[class*="since"]');
  await expect(sinceEl).toBeVisible();
  await expect(sinceEl).toContainText('Since');
});

test('"Since" line shows a plausible year (202x or later)', async ({ page }) => {
  await avatarBtn(page).click();
  const dialog = statsDialog(page);
  const sinceText = await dialog.locator('[class*="since"]').textContent();
  expect(sinceText).toBeTruthy();
  // Must contain a 4-digit year starting with 202 or higher
  expect(sinceText).toMatch(/20\d{2}/);
});

test('after Reset, "Since" date updates to today', async ({ page }) => {
  await avatarBtn(page).click();
  const dialog = statsDialog(page);

  // Capture the year before reset (should already be current year)
  const currentYear = new Date().getFullYear().toString();

  // Click Reset
  await dialog.getByRole('button', { name: 'Reset' }).click();

  // Re-open the panel (Reset closes or resets state; panel stays open based on implementation)
  // The panel stays open — just re-read the since element
  const sinceEl = dialog.locator('[class*="since"]');
  await expect(sinceEl).toBeVisible();
  await expect(sinceEl).toContainText(currentYear);
});
