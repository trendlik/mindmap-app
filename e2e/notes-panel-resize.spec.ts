/**
 * E2E tests for resizable notes panel (issue #67).
 *
 * Feature: A drag handle on the left edge of the notes panel lets the user
 * resize it. The chosen width is persisted in localStorage and restored on reload.
 */

import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';

async function selectRootNode(page: Page) {
  await page.locator('[data-node-id]').first().click();
}

async function openNotes(page: Page) {
  await page.getByRole('button', { name: 'notes', exact: true }).click();
}

const panel = (page: Page) => page.getByTestId('notes-panel');
const handle = (page: Page) => page.getByTestId('notes-resize-handle');

test('resize handle is visible when notes panel is open', async ({ page }) => {
  await selectRootNode(page);
  await openNotes(page);
  await expect(handle(page)).toBeVisible();
});

test('dragging resize handle left widens the panel', async ({ page }) => {
  await selectRootNode(page);
  await openNotes(page);

  const initialWidth = await panel(page).evaluate((el) => el.getBoundingClientRect().width);
  const handleBox = await handle(page).boundingBox();
  if (!handleBox) throw new Error('Resize handle not found');

  const startX = handleBox.x + handleBox.width / 2;
  const startY = handleBox.y + handleBox.height / 2;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX - 100, startY, { steps: 10 });
  await page.mouse.up();

  const finalWidth = await panel(page).evaluate((el) => el.getBoundingClientRect().width);
  expect(finalWidth).toBeGreaterThan(initialWidth + 50);
});

test('dragging resize handle right narrows the panel', async ({ page }) => {
  await selectRootNode(page);
  await openNotes(page);

  const initialWidth = await panel(page).evaluate((el) => el.getBoundingClientRect().width);
  const handleBox = await handle(page).boundingBox();
  if (!handleBox) throw new Error('Resize handle not found');

  const startX = handleBox.x + handleBox.width / 2;
  const startY = handleBox.y + handleBox.height / 2;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 60, startY, { steps: 10 });
  await page.mouse.up();

  const finalWidth = await panel(page).evaluate((el) => el.getBoundingClientRect().width);
  expect(finalWidth).toBeLessThan(initialWidth - 30);
});

test('panel width is clamped to minimum of 200px', async ({ page }) => {
  await selectRootNode(page);
  await openNotes(page);

  const handleBox = await handle(page).boundingBox();
  if (!handleBox) throw new Error('Resize handle not found');

  const startX = handleBox.x + handleBox.width / 2;
  const startY = handleBox.y + handleBox.height / 2;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 500, startY, { steps: 20 });
  await page.mouse.up();

  const finalWidth = await panel(page).evaluate((el) => el.getBoundingClientRect().width);
  expect(finalWidth).toBeGreaterThanOrEqual(200);
});

test('panel width is clamped to maximum of 600px', async ({ page }) => {
  await selectRootNode(page);
  await openNotes(page);

  const handleBox = await handle(page).boundingBox();
  if (!handleBox) throw new Error('Resize handle not found');

  const startX = handleBox.x + handleBox.width / 2;
  const startY = handleBox.y + handleBox.height / 2;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX - 1000, startY, { steps: 30 });
  await page.mouse.up();

  const finalWidth = await panel(page).evaluate((el) => el.getBoundingClientRect().width);
  expect(finalWidth).toBeLessThanOrEqual(600);
});

test('resized panel width persists after page reload', async ({ page }) => {
  await selectRootNode(page);
  await openNotes(page);

  const handleBox = await handle(page).boundingBox();
  if (!handleBox) throw new Error('Resize handle not found');

  const startX = handleBox.x + handleBox.width / 2;
  const startY = handleBox.y + handleBox.height / 2;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX - 80, startY, { steps: 10 });
  await page.mouse.up();

  const widthAfterResize = await panel(page).evaluate((el) => el.getBoundingClientRect().width);

  await page.reload();
  await page.getByText('maps', { exact: true }).waitFor();
  await selectRootNode(page);
  await openNotes(page);

  const widthAfterReload = await panel(page).evaluate((el) => el.getBoundingClientRect().width);
  expect(Math.abs(widthAfterReload - widthAfterResize)).toBeLessThanOrEqual(5);
});
