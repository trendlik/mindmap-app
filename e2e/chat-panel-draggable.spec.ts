/**
 * E2E tests for the floating, draggable AI Chat panel (issue #51).
 *
 * Feature summary:
 *  - The AI Chat panel is a non-blocking floating panel (no overlay).
 *  - Clicking on canvas nodes while the panel is open continues to work.
 *  - The panel can be dragged to a new position via its header.
 *  - Pressing Escape closes the panel.
 *
 * The `page` fixture from fixtures.ts already navigates to '/' and waits
 * for 'maps' to appear, so we do not repeat those calls here.
 */

import { test, expect } from './fixtures';

/** Open the AI Chat panel via the Toolbar button. */
async function openChat(page: import('@playwright/test').Page) {
  await page.getByTitle('AI Chat').click();
  await expect(page.getByRole('dialog', { name: 'AI Chat' })).toBeVisible();
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test('AI chat panel is a non-blocking floating panel', async ({ page }) => {
  // The delete toolbar button is disabled when no node is selected
  const deleteBtn = page.getByText('delete', { exact: true });
  await expect(deleteBtn).toBeDisabled();

  await openChat(page);

  const dialog = page.getByRole('dialog', { name: 'AI Chat' });
  await expect(dialog).toBeVisible();

  // Click on a canvas node — should succeed because there is no blocking overlay
  const node = page.locator('g[data-node-id]').first();
  await node.click();

  // Node was selected: the delete button is now enabled
  await expect(deleteBtn).toBeEnabled();
  // Panel must still be visible after interacting with the canvas
  await expect(dialog).toBeVisible();
});

test('AI chat panel can be dragged to a new position', async ({ page }) => {
  await openChat(page);

  const dialog = page.getByRole('dialog', { name: 'AI Chat' });
  const header = dialog.locator('[class*="header"]').first();

  // Record initial position
  const boxBefore = await dialog.boundingBox();
  if (!boxBefore) throw new Error('Dialog bounding box not found before drag');

  // Drag the header 200px left and 150px up
  const startX = boxBefore.x + boxBefore.width / 2;
  const startY = boxBefore.y + (await header.boundingBox())!.height / 2;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX - 200, startY - 150, { steps: 10 });
  await page.mouse.up();

  // Record new position
  const boxAfter = await dialog.boundingBox();
  if (!boxAfter) throw new Error('Dialog bounding box not found after drag');

  // Assert the panel moved substantially in both dimensions
  // (dragged 200px left and 150px up; allow tolerance for viewport clamping)
  expect(Math.abs(boxAfter.x - boxBefore.x)).toBeGreaterThanOrEqual(100);
  expect(Math.abs(boxAfter.y - boxBefore.y)).toBeGreaterThanOrEqual(80);
});

test('Escape key closes the AI chat panel', async ({ page }) => {
  await openChat(page);

  const dialog = page.getByRole('dialog', { name: 'AI Chat' });
  await expect(dialog).toBeVisible();

  await page.keyboard.press('Escape');

  await expect(dialog).not.toBeVisible();
});
