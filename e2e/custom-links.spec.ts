/**
 * E2E tests for custom cross-links between nodes.
 *
 * Flow to create: select a node → click "link" toolbar button → click target node.
 * Flow to delete: click the link's hit target to select it → click "delete" → confirm.
 *
 * Custom link hit targets are <path stroke="transparent"> elements that sit
 * over the visible link path and handle mouse events.
 *
 * Fixture: two-node map — root + child — with a tree edge between them.
 * The delete test pre-seeds one custom link in the fixture state.
 */

import { test as sharedTest, expect, TEST_USER, makeNode, waitForPageReady } from './fixtures';
import type { Page } from '@playwright/test';

const IDS = {
  mapId: 'custom-links-map',
  rootId: 'custom-links-root',
  childId: 'custom-links-child',
};

function makeCustomLinksState(links: unknown[] = []) {
  return {
    maps: {
      [IDS.mapId]: {
        id: IDS.mapId,
        name: 'Custom Links Map',
        nodes: {
          [IDS.rootId]:  makeNode(IDS.rootId,  'Root',  500, 300),
          [IDS.childId]: makeNode(IDS.childId, 'Child', 690, 300, IDS.rootId, 1),
        },
        edges: [{ from: IDS.rootId, to: IDS.childId }],
        links,
        tx: 0,
        ty: 0,
        scale: 0.999,
      },
    },
    mapOrder: [IDS.mapId],
  };
}

// ─── fixture: empty links ─────────────────────────────────────────────────────

const emptyLinksTest = sharedTest.extend<{ page: Page }>({
  page: async ({ page }, use) => {
    const state = makeCustomLinksState([]);
    await page.addInitScript((params) => {
      window.__PLAYWRIGHT_TEST_USER__ = params.user;
      localStorage.setItem('mindmaps_v2', JSON.stringify(params.state));
    }, { user: TEST_USER, state });
    await waitForPageReady(page);
    await use(page);
  },
});

// ─── fixture: one pre-seeded custom link ──────────────────────────────────────

const seededLinkTest = sharedTest.extend<{ page: Page }>({
  page: async ({ page }, use) => {
    const state = makeCustomLinksState([
      { id: 'pre-link-1', from: IDS.rootId, to: IDS.childId, style: 'line', stroke: 'solid' },
    ]);
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
const linkBtn = (page: Page) => page.getByRole('button', { name: 'link', exact: true });
const deleteBtn = (page: Page) => page.getByRole('button', { name: 'delete', exact: true });

// ─── tests ────────────────────────────────────────────────────────────────────

emptyLinksTest('creates a custom link between two nodes', async ({ page }) => {
  // No custom link hit targets initially
  await expect(page.locator('path[stroke="transparent"]')).toHaveCount(0);

  // Select root and activate link mode
  await page.locator(node(IDS.rootId)).click();
  await linkBtn(page).click();

  // Click child to complete the link
  await page.locator(node(IDS.childId)).click();

  // A transparent hit-target path should now exist for the custom link
  await expect(page.locator('path[stroke="transparent"]')).toHaveCount(1);
});

seededLinkTest('deletes a custom link via the toolbar delete button', async ({ page }) => {
  // The pre-seeded link should be visible as a hit target
  await expect(page.locator('path[stroke="transparent"]')).toHaveCount(1);

  // Click the hit target to select the link
  await page.locator('path[stroke="transparent"]').click();

  // The toolbar shows link-editing controls when a link is selected
  await expect(page.getByTitle('Arrow at end')).toBeVisible();

  // Delete the selected link and confirm
  await deleteBtn(page).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();

  await expect(page.locator('path[stroke="transparent"]')).toHaveCount(0);
});
