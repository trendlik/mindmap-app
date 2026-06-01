/**
 * E2E tests for the map description feature (issue #77).
 *
 * Feature summary:
 *  - Each mind map has an optional `description` field.
 *  - A small (i) icon button appears next to the map name in the sidebar.
 *  - Clicking (i) opens an inline popover below the map row.
 *  - Inside the popover, clicking the text (or "Add a description…" placeholder)
 *    enables inline editing via a textarea.
 *  - Saving on blur persists the description.
 *  - Pressing Escape while not editing closes the popover.
 *  - Pressing Escape while editing cancels the edit (returns to view mode).
 */

import { test, expect, TEST_IDS } from './fixtures';

// ─── helpers ─────────────────────────────────────────────────────────────────

/** Returns the (i) info button for the map with the given name. */
function infoBtn(page: import('@playwright/test').Page, mapName: string) {
  const nameSpan = page.locator('aside nav').getByText(mapName, { exact: true });
  return nameSpan.locator('..').getByTitle('Map description');
}

/** Opens the description popover for the given map. */
async function openPopover(page: import('@playwright/test').Page, mapName: string) {
  await infoBtn(page, mapName).click();
}

/** Returns the description popover container (scoped to aside). */
function popover(page: import('@playwright/test').Page) {
  return page.locator('aside [class*="descriptionPopover"]');
}

/**
 * Blurs the textarea by pressing Tab. This triggers the onBlur handler (which
 * saves the description) without clicking outside the popover (which would close
 * it via the outside-click document listener).
 */
async function blurTextarea(page: import('@playwright/test').Page) {
  await page.keyboard.press('Tab');
}

// ─── tests ───────────────────────────────────────────────────────────────────

test('(i) button is visible next to map name', async ({ page }) => {
  const btn = infoBtn(page, TEST_IDS.mapName);
  // Hover the map row to ensure hover-reveal buttons are interactable
  await page.locator('aside nav').getByText(TEST_IDS.mapName, { exact: true }).hover();
  await expect(btn).toBeAttached();
});

test('clicking (i) opens the description popover', async ({ page }) => {
  await openPopover(page, TEST_IDS.mapName);
  await expect(popover(page)).toBeVisible();
});

test('popover shows "Add a description…" placeholder when description is empty', async ({ page }) => {
  await openPopover(page, TEST_IDS.mapName);
  await expect(popover(page)).toContainText('Add a description…');
});

test('clicking (i) again closes the popover', async ({ page }) => {
  await openPopover(page, TEST_IDS.mapName);
  await expect(popover(page)).toBeVisible();

  // Click (i) again to toggle closed
  await infoBtn(page, TEST_IDS.mapName).click();
  await expect(popover(page)).not.toBeVisible();
});

test('clicking outside the popover (when not editing) closes the popover', async ({ page }) => {
  await openPopover(page, TEST_IDS.mapName);
  await expect(popover(page)).toBeVisible();

  // Click the main canvas area (outside the sidebar popover) — this triggers
  // the outside-click document listener that closes the popover
  await page.locator('svg').first().click();
  await expect(popover(page)).not.toBeVisible();
});

// ─── happy path: add a description ───────────────────────────────────────────

test('happy path: click placeholder to enter edit mode, type description, blur saves it', async ({ page }) => {
  await openPopover(page, TEST_IDS.mapName);

  // Click the placeholder text to enter edit mode
  const placeholder = popover(page).locator('[class*="descriptionPlaceholder"]');
  await placeholder.click();

  // Textarea should appear
  const textarea = popover(page).locator('textarea');
  await expect(textarea).toBeVisible();
  await expect(textarea).toBeFocused();

  // Type a description
  await textarea.fill('My test description');

  // Blur by pressing Tab — this triggers onBlur (saves) without closing the popover
  await blurTextarea(page);

  // Popover should still be open and show the saved description text
  await expect(popover(page)).toBeVisible();
  await expect(popover(page)).toContainText('My test description');
});

// ─── persistence: description survives popover close/reopen ──────────────────

test('persistence: description is still shown after closing and reopening the popover', async ({ page }) => {
  await openPopover(page, TEST_IDS.mapName);

  // Enter edit mode and save a description
  const placeholder = popover(page).locator('[class*="descriptionText"]');
  await placeholder.click();
  const textarea = popover(page).locator('textarea');
  await textarea.fill('Persistent description');

  // Blur to save via Tab (keeps popover open)
  await blurTextarea(page);

  // Verify description is now shown in the popover
  await expect(popover(page)).toContainText('Persistent description');

  // Close the popover by clicking (i) again
  await infoBtn(page, TEST_IDS.mapName).click();
  await expect(popover(page)).not.toBeVisible();

  // Reopen the popover
  await openPopover(page, TEST_IDS.mapName);
  await expect(popover(page)).toBeVisible();

  // Description must still be shown
  await expect(popover(page)).toContainText('Persistent description');
});

// ─── clear: empty description shows placeholder again ────────────────────────

test('clear: editing description to empty string shows placeholder after reopen', async ({ page }) => {
  await openPopover(page, TEST_IDS.mapName);

  // First, add a description
  const descView = popover(page).locator('[class*="descriptionText"]');
  await descView.click();
  const textarea = popover(page).locator('textarea');
  await textarea.fill('Temporary description');

  // Save via Tab
  await blurTextarea(page);

  // Verify it was saved
  await expect(popover(page)).toContainText('Temporary description');

  // Now clear it — click the text to edit again
  await popover(page).locator('[class*="descriptionText"]').click();
  const textarea2 = popover(page).locator('textarea');
  await textarea2.fill('');

  // Save (empty) via Tab
  await blurTextarea(page);

  // Close the popover
  await infoBtn(page, TEST_IDS.mapName).click();
  await expect(popover(page)).not.toBeVisible();

  // Reopen and confirm placeholder is back
  await openPopover(page, TEST_IDS.mapName);
  await expect(popover(page)).toContainText('Add a description…');
  await expect(popover(page).locator('[class*="descriptionPlaceholder"]')).toBeVisible();
});

// ─── Escape while editing cancels the edit ────────────────────────────────────

test('pressing Escape while editing cancels the edit and returns to view mode', async ({ page }) => {
  // First save a description via happy path
  await openPopover(page, TEST_IDS.mapName);
  const descView = popover(page).locator('[class*="descriptionText"]');
  await descView.click();
  const textarea = popover(page).locator('textarea');
  await textarea.fill('Saved description');
  await blurTextarea(page);

  // Verify saved
  await expect(popover(page)).toContainText('Saved description');

  // Re-enter edit mode and type new text without saving
  await popover(page).locator('[class*="descriptionText"]').click();
  const textarea2 = popover(page).locator('textarea');
  await textarea2.fill('Unsaved changes');

  // Press Escape — should exit edit mode WITHOUT saving
  await textarea2.press('Escape');

  // Textarea should be gone, popover still open, original text shown
  await expect(popover(page).locator('textarea')).not.toBeVisible();
  await expect(popover(page)).toContainText('Saved description');
  await expect(popover(page)).not.toContainText('Unsaved changes');
});
