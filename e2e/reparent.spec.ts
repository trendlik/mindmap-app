/**
 * E2E tests for node reparenting (toolbar "move" button).
 *
 * Flow: select a node → click "move" → click the new parent node.
 * Escape cancels reparent mode without modifying the tree.
 * The "move" button is disabled when the root node is selected.
 *
 * Fixture: three-node map — root, nodeA (child of root), nodeB (child of root).
 * After reparenting nodeA → nodeB, nodeB becomes nodeA's parent.
 */

import { test as sharedTest, expect, TEST_USER, makeNode, waitForPageReady } from './fixtures';
import type { Page } from '@playwright/test';

const IDS = {
  mapId: 'reparent-test-map',
  rootId: 'reparent-root',
  nodeAId: 'reparent-node-a',
  nodeBId: 'reparent-node-b',
};

const reparentTest = sharedTest.extend<{ page: Page }>({
  page: async ({ page }, use) => {
    const state = {
      maps: {
        [IDS.mapId]: {
          id: IDS.mapId,
          name: 'Reparent Test Map',
          nodes: {
            [IDS.rootId]:  makeNode(IDS.rootId,  'Root',   500, 300),
            [IDS.nodeAId]: makeNode(IDS.nodeAId, 'Node A', 690, 260, IDS.rootId, 1),
            [IDS.nodeBId]: makeNode(IDS.nodeBId, 'Node B', 690, 340, IDS.rootId, 1),
          },
          edges: [
            { from: IDS.rootId, to: IDS.nodeAId },
            { from: IDS.rootId, to: IDS.nodeBId },
          ],
          links: [],
          tx: 0,
          ty: 0,
          scale: 0.999,
        },
      },
      mapOrder: [IDS.mapId],
    };
    await page.addInitScript((params) => {
      window.__PLAYWRIGHT_TEST_USER__ = params.user;
      localStorage.setItem('mindmaps_v2', JSON.stringify(params.state));
    }, { user: TEST_USER, state });

    await waitForPageReady(page);
    await use(page);
  },
});

// ─── helpers ──────────────────────────────────────────────────────────────────

const node = (id: string) => `[data-node-id="${id}"]`;
const moveBtn = (page: Page) => page.getByRole('button', { name: 'move', exact: true });
const collapseBtn = (page: Page) => page.getByRole('button', { name: 'collapse', exact: true });

// ─── tests ────────────────────────────────────────────────────────────────────

reparentTest('reparents a node to a new parent via the move button', async ({ page }) => {
  // Before reparent: nodeB has no children, so collapse button is disabled when selected
  await page.locator(node(IDS.nodeBId)).click();
  await expect(collapseBtn(page)).toBeDisabled();

  // Select nodeA (child of root) and activate reparent mode
  await page.locator(node(IDS.nodeAId)).click();
  await moveBtn(page).click();

  // Click nodeB as the new parent — this completes the reparent
  await page.locator(node(IDS.nodeBId)).click();

  // Now nodeB has nodeA as a child, so collapse button must be enabled
  await page.locator(node(IDS.nodeBId)).click();
  await expect(collapseBtn(page)).toBeEnabled();
});

reparentTest('Escape cancels reparent mode without changing the tree', async ({ page }) => {
  // Activate reparent mode for nodeA
  await page.locator(node(IDS.nodeAId)).click();
  await moveBtn(page).click();

  // Cancel with Escape — nodeB should still have no children
  await page.keyboard.press('Escape');

  await page.locator(node(IDS.nodeBId)).click();
  await expect(collapseBtn(page)).toBeDisabled();
});

reparentTest('reparent button is disabled when root node is selected', async ({ page }) => {
  await page.locator(node(IDS.rootId)).click();
  await expect(moveBtn(page)).toBeDisabled();
});
