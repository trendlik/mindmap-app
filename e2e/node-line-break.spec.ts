/**
 * E2E tests for explicit line breaks in node text (issue #84).
 *
 * Feature summary:
 *  - The inline node editor is a <textarea> (overlaid on the SVG canvas).
 *  - Alt+Enter (Opt+Enter on Mac) inserts a newline at the caret while editing.
 *  - Plain Enter finishes editing (does NOT insert a newline).
 *  - A node label containing "\n" renders as one <tspan> line per text line.
 */

import { test, expect, waitForEditInput, CANVAS_EDIT_SELECTOR } from './fixtures';
import type { Page } from '@playwright/test';

// The <tspan> elements that hold the wrapped/broken label lines for the
// first (root) node.
function nodeTspans(page: Page) {
  return page.locator('[data-node-id]').first().locator('tspan');
}

test('Alt+Enter inserts a line break that renders as multiple tspan lines', async ({ page }) => {
  // Sanity: the root node starts as a single line of text.
  await expect(nodeTspans(page)).toHaveCount(1);

  await page.locator('[data-node-id]').first().dblclick();
  const ta = await waitForEditInput(page);

  // Start from a clean editor and seed the first line, then place the
  // caret at the end so Alt+Enter inserts a break after it.
  await ta.fill('First');
  await ta.press('End');
  // Alt+Enter inserts an explicit line break at the caret.
  await ta.press('Alt+Enter');
  // The handler updates state then restores the caret in a requestAnimationFrame.
  // Wait for the newline to land in the value before typing the next line,
  // otherwise typing can race the caret restoration.
  await expect(ta).toHaveValue('First\n');
  // Type the second line in a single insert so the editor's caret-restore
  // (a requestAnimationFrame after the Alt+Enter handler) cannot interleave
  // with per-character typing and scramble the caret position.
  await page.keyboard.insertText('Second');
  await expect(ta).toHaveValue('First\nSecond');
  // Plain Enter finishes editing.
  await ta.press('Enter');

  // Editor closed.
  await expect(page.locator(CANVAS_EDIT_SELECTOR)).toHaveCount(0);

  // The label now renders across two tspan lines.
  await expect(nodeTspans(page)).toHaveCount(2);
  await expect(nodeTspans(page).nth(0)).toHaveText('First');
  await expect(nodeTspans(page).nth(1)).toHaveText('Second');
});

test('plain Enter finishes editing without inserting a newline (stays single line)', async ({ page }) => {
  await page.locator('[data-node-id]').first().dblclick();
  const ta = await waitForEditInput(page);

  await ta.fill('OneLine');
  // Plain Enter should finish editing, not add a newline.
  await ta.press('Enter');

  await expect(page.locator(CANVAS_EDIT_SELECTOR)).toHaveCount(0);

  // Still a single rendered line.
  await expect(nodeTspans(page)).toHaveCount(1);
  await expect(nodeTspans(page).nth(0)).toHaveText('OneLine');
});
