/**
 * E2E tests for Space key collapse/uncollapse shortcut (issue #61).
 *
 * Feature: when a node that has children is selected and the canvas is not
 * in edit mode, pressing Space toggles its collapsed state. Collapsed nodes
 * hide their descendants; a '···' indicator is shown below the node.
 * Pressing Space with no node selected does nothing.
 * Pressing Space on a leaf node (no children) does nothing.
 */

import { test as sharedTest, expect, TEST_USER, makeNode, waitForPageReady } from './fixtures';

const IDS = {
  mapId: 'collapse-test-map-id',
  parentId: 'collapse-parent-node',
  childId: 'collapse-child-node',
  leafId: 'collapse-leaf-node',
};

// ─── fixture: two-node map (parent with one child) ───────────────────────────

const collapseTest = sharedTest.extend<{ page: import('@playwright/test').Page }>({
  page: async ({ page }, use) => {
    const state = {
      maps: {
        [IDS.mapId]: {
          id: IDS.mapId,
          name: 'Collapse Test Map',
          nodes: {
            [IDS.parentId]: makeNode(IDS.parentId, 'Parent', 500, 300),
            [IDS.childId]:  makeNode(IDS.childId,  'Child',  690, 300, IDS.parentId, 1),
          },
          edges: [{ from: IDS.parentId, to: IDS.childId }],
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

// ─── fixture: single-node map (leaf with no children) ────────────────────────

const leafTest = sharedTest.extend<{ page: import('@playwright/test').Page }>({
  page: async ({ page }, use) => {
    const state = {
      maps: {
        [IDS.mapId]: {
          id: IDS.mapId,
          name: 'Leaf Test Map',
          nodes: {
            [IDS.leafId]: makeNode(IDS.leafId, 'Leaf', 500, 300),
          },
          edges: [],
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

// ─── helpers ─────────────────────────────────────────────────────────────────

const nodeG = (id: string) => `[data-node-id="${id}"]`;

// ─── tests ────────────────────────────────────────────────────────────────────

collapseTest('Space key collapses a node with children and then uncollapses it', async ({ page }) => {
  await expect(page.locator(nodeG(IDS.parentId))).toBeVisible();
  await expect(page.locator(nodeG(IDS.childId))).toBeVisible();

  await page.locator(nodeG(IDS.parentId)).click();

  await page.keyboard.press('Space');
  await expect(page.locator(nodeG(IDS.childId))).toHaveCount(0);

  await page.keyboard.press('Space');
  await expect(page.locator(nodeG(IDS.childId))).toBeVisible();
});

collapseTest('pressing Space with no node selected does nothing', async ({ page }) => {
  const svg = page.locator('svg').first();
  await svg.click({ position: { x: 10, y: 10 } });

  await expect(page.locator(nodeG(IDS.parentId))).toBeVisible();
  await expect(page.locator(nodeG(IDS.childId))).toBeVisible();

  await page.keyboard.press('Space');

  await expect(page.locator(nodeG(IDS.parentId))).toBeVisible();
  await expect(page.locator(nodeG(IDS.childId))).toBeVisible();
});

leafTest('Space on a leaf node does nothing', async ({ page }) => {
  await expect(page.locator(nodeG(IDS.leafId))).toBeVisible();

  await page.locator(nodeG(IDS.leafId)).click();

  await page.keyboard.press('Space');

  await expect(page.locator(nodeG(IDS.leafId))).toBeVisible();
  await expect(page.locator('[data-node-id]')).toHaveCount(1);
});
