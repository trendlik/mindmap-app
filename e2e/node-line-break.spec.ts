/**
 * E2E tests for explicit line breaks in node text (issue #84).
 *
 * Feature summary:
 *  - The inline node editor is a <textarea> (overlaid on the SVG canvas).
 *  - Alt+Enter (Opt+Enter on Mac) inserts a newline at the caret while editing.
 *  - Plain Enter finishes editing (does NOT insert a newline).
 *  - A node label containing "\n" renders as one <tspan> line per text line.
 *
 * Editing the canvas textarea reliably requires care: startEdit focuses and
 * selects the field via a deferred setTimeout, so tests wait for the field to be
 * focused before typing, and type with pressSequentially (real per-character key
 * events) so React's controlled onChange stays in sync — fill()'s one-shot value
 * set can race the deferred select() and desync React's input value tracker.
 */

import { test, expect, waitForEditInput, CANVAS_EDIT_SELECTOR } from './fixtures';
import type { Locator, Page } from '@playwright/test';

// The <tspan> elements that hold the wrapped/broken label lines for the
// first (root) node.
function nodeTspans(page: Page) {
  return page.locator('[data-node-id]').first().locator('tspan');
}

// Open the root node for editing and return a focused, empty textarea.
async function editRootNode(page: Page): Promise<Locator> {
  await page.locator('[data-node-id]').first().dblclick();
  const ta = await waitForEditInput(page);
  // Wait for startEdit's deferred focus()/select() to have run before typing.
  await expect(ta).toBeFocused();
  await ta.press('ControlOrMeta+a');
  return ta;
}

test('Alt+Enter inserts a line break that renders as multiple tspan lines', async ({ page }) => {
  // Sanity: the root node starts as a single line of text.
  await expect(nodeTspans(page)).toHaveCount(1);

  const ta = await editRootNode(page);
  await ta.pressSequentially('First');
  await expect(ta).toHaveValue('First');

  // Alt+Enter inserts an explicit line break at the caret.
  await ta.press('Alt+Enter');
  await expect(ta).toHaveValue('First\n');

  // The caret is restored just after the newline, so typing continues on line 2.
  await ta.pressSequentially('Second');
  await expect(ta).toHaveValue('First\nSecond');

  // Plain Enter finishes editing.
  await ta.press('Enter');
  await expect(page.locator(CANVAS_EDIT_SELECTOR)).toHaveCount(0);

  // The label now renders across two tspan lines.
  await expect(nodeTspans(page)).toHaveCount(2);
  await expect(nodeTspans(page).nth(0)).toHaveText('First');
  await expect(nodeTspans(page).nth(1)).toHaveText('Second');
});

test('plain Enter finishes editing without inserting a newline (stays single line)', async ({ page }) => {
  const ta = await editRootNode(page);
  await ta.pressSequentially('OneLine');
  await expect(ta).toHaveValue('OneLine');

  // Plain Enter should finish editing, not add a newline.
  await ta.press('Enter');
  await expect(page.locator(CANVAS_EDIT_SELECTOR)).toHaveCount(0);

  // Still a single rendered line.
  await expect(nodeTspans(page)).toHaveCount(1);
  await expect(nodeTspans(page).nth(0)).toHaveText('OneLine');
});
