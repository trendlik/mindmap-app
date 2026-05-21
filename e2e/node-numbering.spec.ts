import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';

const childBtn = (page: Page) =>
  page.getByRole('button', { name: 'child', exact: true });
const canvasEditInput = (page: Page) =>
  page.locator('input[style]');
const numberingToggle = (page: Page) =>
  page.getByTestId('numbering-toggle');
const numberingStylePrefix = (page: Page) =>
  page.getByTestId('numbering-style-prefix');
const numberingStyleBadge = (page: Page) =>
  page.getByTestId('numbering-style-badge');

async function addChildAndClose(page: Page) {
  await childBtn(page).click();
  await canvasEditInput(page).waitFor({ state: 'visible', timeout: 2000 });
  await page.keyboard.press('Escape');
}

test('numbering toggle button is visible in toolbar', async ({ page }) => {
  await expect(numberingToggle(page)).toBeVisible();
});

test('enabling numbering shows number on child node (prefix style)', async ({ page }) => {
  await addChildAndClose(page);
  await numberingToggle(page).click();
  // After enabling, style picker should appear
  await expect(numberingStylePrefix(page)).toBeVisible();
  await expect(numberingStyleBadge(page)).toBeVisible();
  // A number label should appear on the canvas
  await expect(page.locator('[data-number-label]')).toBeVisible();
});

test('disabling numbering removes number labels', async ({ page }) => {
  await addChildAndClose(page);
  await numberingToggle(page).click();
  await expect(page.locator('[data-number-label]')).toBeVisible();
  // Toggle off
  await numberingToggle(page).click();
  await expect(page.locator('[data-number-label]')).toHaveCount(0);
  // Style picker should be hidden
  await expect(numberingStylePrefix(page)).toHaveCount(0);
});

test('switching to badge style removes prefix labels and shows badge elements', async ({ page }) => {
  await addChildAndClose(page);
  await numberingToggle(page).click();
  await expect(numberingStylePrefix(page)).toBeVisible();
  await numberingStyleBadge(page).click();
  // Prefix labels should be gone
  await expect(page.locator('[data-number-label]')).toHaveCount(0);
  // Badge elements should now be present
  await expect(page.locator('[data-number-badge]')).toBeVisible();
  // The badge style button should now be active
  await expect(numberingStyleBadge(page)).toHaveClass(/active/);
});
