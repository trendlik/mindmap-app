import { test, expect, waitForEditInput } from './fixtures';
import type { Page } from '@playwright/test';

const childBtn = (page: Page) =>
  page.getByRole('button', { name: 'child', exact: true });
const siblingBtn = (page: Page) =>
  page.getByRole('button', { name: 'sibling', exact: true });
const undoBtn = (page: Page) =>
  page.getByRole('button', { name: 'undo', exact: true });
const redoBtn = (page: Page) =>
  page.getByRole('button', { name: 'redo', exact: true });
const fitBtn = (page: Page) =>
  page.getByRole('button', { name: 'fit', exact: true });

// waitForEditInput waits for the canvas edit input (the only <input> with an
// inline style) before pressing Escape — otherwise Escape fires too early, the
// input opens afterwards, and a subsequent button click triggers blur → a
// spurious updateNode() call pushes an extra undo entry.
async function addChildAndClose(page: Page) {
  await childBtn(page).click();
  await waitForEditInput(page);
  await page.keyboard.press('Escape');
}

async function addSiblingAndClose(page: Page) {
  await siblingBtn(page).click();
  await waitForEditInput(page);
  await page.keyboard.press('Escape');
}

test('canvas renders an SVG with the root node', async ({ page }) => {
  await expect(page.locator('[data-node-id]').first()).toBeVisible();
  await expect(page.locator('[data-node-id]')).toHaveCount(1);
});

test('toolbar is visible', async ({ page }) => {
  await expect(childBtn(page)).toBeVisible();
  await expect(undoBtn(page)).toBeVisible();
  await expect(fitBtn(page)).toBeVisible();
});

test('adds a child node via toolbar button', async ({ page }) => {
  await addChildAndClose(page);
  await expect(page.locator('[data-node-id]')).toHaveCount(2);
});

test('adds a sibling node after selecting a child', async ({ page }) => {
  await addChildAndClose(page);
  await expect(page.locator('[data-node-id]')).toHaveCount(2);

  await addSiblingAndClose(page);
  await expect(page.locator('[data-node-id]')).toHaveCount(3);
});

test('undo removes the last added node', async ({ page }) => {
  await addChildAndClose(page);
  await expect(page.locator('[data-node-id]')).toHaveCount(2);

  await undoBtn(page).click();
  await expect(page.locator('[data-node-id]')).toHaveCount(1);
});

test('redo re-adds the undone node', async ({ page }) => {
  await addChildAndClose(page);
  await expect(page.locator('[data-node-id]')).toHaveCount(2);

  await page.keyboard.press('Meta+z');
  await expect(page.locator('[data-node-id]')).toHaveCount(1);

  await page.keyboard.press('Meta+Shift+z');
  await expect(page.locator('[data-node-id]')).toHaveCount(2);
});

test('undo button is disabled on a fresh map', async ({ page }) => {
  await expect(undoBtn(page)).toBeDisabled();
});

test('redo button is disabled on a fresh map', async ({ page }) => {
  await expect(redoBtn(page)).toBeDisabled();
});

test('fit button is always enabled', async ({ page }) => {
  await expect(fitBtn(page)).toBeEnabled();
});

test('keyboard shortcut Cmd+Z triggers undo', async ({ page }) => {
  await addChildAndClose(page);
  await expect(page.locator('[data-node-id]')).toHaveCount(2);

  await page.keyboard.press('Meta+z');
  await expect(page.locator('[data-node-id]')).toHaveCount(1);
});
