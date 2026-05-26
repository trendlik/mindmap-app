/**
 * E2E regression test for issue #73:
 * "The green dot on a node stays even though the note was deleted"
 *
 * The green dot (a small #1D9E75 circle) is rendered in Canvas.tsx only when
 * `n.notes` is truthy. Before the fix, clearing all text from the
 * contentEditable editor left residual HTML (`<br>` etc.), so `n.notes` was
 * never cleared and the dot persisted. After the fix, the value is normalised
 * to `''` when the editor's textContent is empty.
 */

import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';

// ─── helpers ──────────────────────────────────────────────────────────────────

/** Click the root node on the canvas to select it. */
async function selectRootNode(page: Page) {
  await page.locator('[data-node-id]').first().click();
}

/** Open the notes panel via the toolbar notes button. */
async function openNotes(page: Page) {
  await page.getByRole('button', { name: 'notes', exact: true }).click();
}

/** The contentEditable notes editor div. */
const editor = (page: Page) => page.locator('[contenteditable]');

/**
 * The green dot indicator rendered on a node when it has notes.
 * Selector matches the <circle r="3.5" fill="#1D9E75"> inside the node group.
 */
const greenDot = (page: Page) =>
  page.locator('[data-node-id] circle[fill="#1D9E75"][r="3.5"]');

// ─── tests ────────────────────────────────────────────────────────────────────

test('green dot appears when notes are added and disappears when notes are cleared', async ({ page }) => {
  await selectRootNode(page);
  await openNotes(page);

  // Initially there should be no green dot (node has no notes)
  await expect(greenDot(page)).toHaveCount(0);

  // Type some notes content
  const ed = editor(page);
  await ed.click();
  await ed.type('Hello notes');

  // Blur the editor by clicking the panel header (stays inside the panel so
  // the node stays selected and the panel stays open)
  await page.getByTestId('notes-panel').locator('[class*="header"]').click();

  // Green dot should now be visible
  await expect(greenDot(page)).toHaveCount(1);

  // Clear all content from the editor (select-all + delete)
  await ed.click();
  await page.keyboard.press('Meta+A');
  await page.keyboard.press('Backspace');

  // Blur the editor again by clicking the panel header
  await page.getByTestId('notes-panel').locator('[class*="header"]').click();

  // Green dot must disappear now that notes are empty
  await expect(greenDot(page)).toHaveCount(0);
});

test('green dot does not appear on a node with no notes', async ({ page }) => {
  await selectRootNode(page);
  await openNotes(page);

  // Panel is open but no text entered — dot must remain absent
  await expect(greenDot(page)).toHaveCount(0);
});

test('handleInput live-clear: dot disappears when all text is deleted without blurring', async ({ page }) => {
  await selectRootNode(page);
  await openNotes(page);

  // Type some notes content and blur to commit (makes dot appear)
  const ed = editor(page);
  await ed.click();
  await ed.type('Live clear test');
  await page.getByTestId('notes-panel').locator('[class*="header"]').click();
  await expect(greenDot(page)).toHaveCount(1);

  // Re-focus editor, select all text and delete — do NOT blur afterwards
  // handleInput fires on the deletion event and must clear the dot immediately
  await ed.click();
  await page.keyboard.press('Meta+A');
  await page.keyboard.press('Delete');

  // Green dot must disappear via handleInput alone, without any blur
  await expect(greenDot(page)).toHaveCount(0);
});

test('backspace-to-empty: dot disappears when the only character is backspaced away', async ({ page }) => {
  await selectRootNode(page);
  await openNotes(page);

  // Type a single character and blur to commit (makes dot appear)
  const ed = editor(page);
  await ed.click();
  await ed.type('X');
  await page.getByTestId('notes-panel').locator('[class*="header"]').click();
  await expect(greenDot(page)).toHaveCount(1);

  // Re-focus and backspace the single character away — no select-all, no blur
  await ed.click();
  await page.keyboard.press('End');
  await page.keyboard.press('Backspace');

  // handleInput must fire and clear the dot immediately
  await expect(greenDot(page)).toHaveCount(0);
});
