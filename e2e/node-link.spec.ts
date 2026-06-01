/**
 * E2E tests for node deep-links (issue #76).
 *
 * Feature summary:
 *  - A "copy link" toolbar button (visible when a node is selected) copies a
 *    URL of the form `<origin><pathname>#<mapId>/<nodeId>` to the clipboard.
 *  - Navigating to `#mapId/nodeId` opens that map and focuses (selects +
 *    scrolls to) the target node.
 *
 * Fixture notes:
 *  - Uses the standard single-map fixture from fixtures.ts (TEST_IDS).
 *  - The root node (TEST_IDS.rootNodeId) is the target for both tests.
 */

import { test, expect, TEST_IDS } from './fixtures';

// ─── 1. Copy link ─────────────────────────────────────────────────────────────

test('copy link button copies #mapId/nodeId URL to clipboard', async ({ page, context }) => {
  // Grant clipboard-write permission so navigator.clipboard.writeText works.
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);

  // Click the root node to select it.
  await page.locator('[data-node-id]').first().click();

  // The "copy link" button should now be visible.
  const copyBtn = page.getByTestId('copy-node-link');
  await expect(copyBtn).toBeVisible();

  // Click the button.
  await copyBtn.click();

  // Read clipboard content.
  const clipboardText = await page.evaluate(() => navigator.clipboard.readText());

  // Should end with #<mapId>/<nodeId>.
  expect(clipboardText).toMatch(new RegExp(`#${TEST_IDS.mapId}/${TEST_IDS.rootNodeId}$`));
});

test('copy link button shows "copied!" feedback and reverts', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);

  await page.locator('[data-node-id]').first().click();

  const copyBtn = page.getByTestId('copy-node-link');
  await copyBtn.click();

  // Immediately after click the button label should say "copied!".
  await expect(copyBtn).toContainText('copied!');

  // After 1500 ms the label should revert to "copy link".
  await page.waitForTimeout(1600);
  await expect(copyBtn).toContainText('copy link');
});

// ─── 2. Deep-link navigation ──────────────────────────────────────────────────

test('navigating to #mapId/nodeId focuses and selects the target node', async ({ page }) => {
  // Navigate directly to the deep-link URL.
  await page.goto(`/#${TEST_IDS.mapId}/${TEST_IDS.rootNodeId}`);

  // The canvas should render and show the node.
  const nodeEl = page.locator(`[data-node-id="${TEST_IDS.rootNodeId}"]`);
  await expect(nodeEl).toBeVisible();

  // The node should be selected: Canvas renders a highlight ring (amber or green
  // stroke rect) for the selected/focused node.
  await expect(
    page.locator(`svg rect[stroke="#F39C12"], svg rect[stroke="#1D9E75"]`)
  ).toBeVisible();
});

test('copy link button is not visible when no node is selected', async ({ page }) => {
  // No node selected on initial load — button should be absent.
  await expect(page.getByTestId('copy-node-link')).not.toBeVisible();
});
