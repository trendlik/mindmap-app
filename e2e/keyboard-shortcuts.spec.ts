/**
 * E2E tests for the keyboard shortcuts modal (issue #27).
 *
 * Feature summary:
 *  - Pressing ? on the canvas opens a modal listing all shortcuts.
 *  - Clicking the ? toolbar button also opens the modal.
 *  - The modal is dismissed by Escape, the × button, or clicking the overlay.
 *  - The modal and the ? toolbar button are hidden on touch / no-hover devices.
 */

import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';

async function pressQuestionMark(page: Page) {
  await page.evaluate(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', {
      key: '?', code: 'Slash', bubbles: true, cancelable: true,
    }));
  });
}

const modal = (page: Page) => page.getByText('Keyboard Shortcuts');

test('? key opens the shortcuts modal', async ({ page }) => {
  await expect(modal(page)).not.toBeVisible();
  await pressQuestionMark(page);
  await expect(modal(page)).toBeVisible();
});

test('? toolbar button opens the shortcuts modal', async ({ page }) => {
  await expect(modal(page)).not.toBeVisible();
  await page.getByTitle('Keyboard shortcuts (?)').click();
  await expect(modal(page)).toBeVisible();
});

test('× button closes the shortcuts modal', async ({ page }) => {
  await pressQuestionMark(page);
  await expect(modal(page)).toBeVisible();
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(modal(page)).not.toBeVisible();
});

test('Escape closes the shortcuts modal', async ({ page }) => {
  await pressQuestionMark(page);
  await expect(modal(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(modal(page)).not.toBeVisible();
});

test('clicking the overlay closes the shortcuts modal', async ({ page }) => {
  await pressQuestionMark(page);
  await expect(modal(page)).toBeVisible();
  // Click in the overlay area outside the modal card
  await page.mouse.click(10, 10);
  await expect(modal(page)).not.toBeVisible();
});

test('modal lists key sections and shortcuts', async ({ page }) => {
  await pressQuestionMark(page);
  await expect(page.getByText('Node Actions')).toBeVisible();
  await expect(page.getByText('Navigation')).toBeVisible();
  await expect(page.getByText('Canvas')).toBeVisible();
  await expect(page.getByText('Add child node')).toBeVisible();
  await expect(page.getByText('Add sibling node')).toBeVisible();
  await expect(page.getByText('Undo', { exact: true }).last()).toBeVisible();
});
