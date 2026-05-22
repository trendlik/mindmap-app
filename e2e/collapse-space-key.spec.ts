/**
 * E2E tests for Space key collapse/uncollapse shortcut (issue #61).
 *
 * Feature: when a node that has children is selected and the canvas is not
 * in edit mode, pressing Space toggles its collapsed state. Collapsed nodes
 * hide their descendants; a '···' indicator is shown below the node.
 * Pressing Space with no node selected does nothing.
 * Pressing Space on a leaf node (no children) does nothing.
 */

import { test as sharedTest, expect } from './fixtures';

const IDS = {
  mapId: 'collapse-test-map-id',
  parentId: 'collapse-parent-node',
  childId: 'collapse-child-node',
  leafId: 'collapse-leaf-node',
};

// ─── fixture: two-node map (parent with one child) ───────────────────────────

const collapseTest = sharedTest.extend<{ page: import('@playwright/test').Page }>({
  page: async ({ page }, use) => {
    await page.addInitScript((params) => {
      window.__PLAYWRIGHT_TEST_USER__ = {
        uid: 'playwright-test-uid',
        email: 'test@playwright.local',
        displayName: 'Test User',
      };

      const state = {
        maps: {
          [params.mapId]: {
            id: params.mapId,
            name: 'Collapse Test Map',
            nodes: {
              [params.parentId]: {
                id: params.parentId,
                label: 'Parent',
                x: 500,
                y: 300,
                parentId: null,
                depth: 0,
                w: 90,
                h: 36,
              },
              [params.childId]: {
                id: params.childId,
                label: 'Child',
                x: 690,
                y: 300,
                parentId: params.parentId,
                depth: 1,
                w: 90,
                h: 36,
              },
            },
            edges: [{ from: params.parentId, to: params.childId }],
            links: [],
            tx: 0,
            ty: 0,
            scale: 0.999,
          },
        },
        mapOrder: [params.mapId],
      };
      localStorage.setItem('mindmaps_v2', JSON.stringify(state));
    }, IDS);

    await page.goto('/');
    await page.getByText('maps').waitFor();
    await use(page);
  },
});

// ─── fixture: single-node map (leaf with no children) ────────────────────────

const leafTest = sharedTest.extend<{ page: import('@playwright/test').Page }>({
  page: async ({ page }, use) => {
    await page.addInitScript((params) => {
      window.__PLAYWRIGHT_TEST_USER__ = {
        uid: 'playwright-test-uid',
        email: 'test@playwright.local',
        displayName: 'Test User',
      };

      const state = {
        maps: {
          [params.mapId]: {
            id: params.mapId,
            name: 'Leaf Test Map',
            nodes: {
              [params.leafId]: {
                id: params.leafId,
                label: 'Leaf',
                x: 500,
                y: 300,
                parentId: null,
                depth: 0,
                w: 90,
                h: 36,
              },
            },
            edges: [],
            links: [],
            tx: 0,
            ty: 0,
            scale: 0.999,
          },
        },
        mapOrder: [params.mapId],
      };
      localStorage.setItem('mindmaps_v2', JSON.stringify(state));
    }, IDS);

    await page.goto('/');
    await page.getByText('maps').waitFor();
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
