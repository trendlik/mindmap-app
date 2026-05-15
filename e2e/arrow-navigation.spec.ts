/**
 * E2E tests for arrow-key spatial navigation between nodes (issue #2).
 *
 * The feature: when a node is selected (but NOT in edit mode), pressing an
 * arrow key selects the nearest visible node in that screen direction.
 * Nothing happens when no node is selected, when in edit mode, or when no
 * neighbour exists in that direction.
 *
 * Test setup notes:
 *  - Nodes are selected by clicking the SVG <g data-node-id="…"> element.
 *  - A selected node's <rect> gets stroke="#1D9E75"; we check that attribute.
 *  - The canvas edit input is an <input style="…"> (inline style distinguishes
 *    it from sidebar inputs which only use a CSS class).
 *  - We seed localStorage with deterministic multi-node maps so spatial
 *    positions are fully under test control.
 */

import { test as base, expect } from '@playwright/test';

// ─── shared test-user stub ──────────────────────────────────────────────────
const TEST_USER = {
  uid: 'playwright-test-uid',
  email: 'test@playwright.local',
  displayName: 'Test User',
};

// ─── node IDs used across tests ─────────────────────────────────────────────
const IDS = {
  mapId: 'arrow-nav-map-id',
  center: 'node-center',
  right:  'node-right',
  left:   'node-left',
  above:  'node-above',
  below:  'node-below',
};

// ─── helpers ─────────────────────────────────────────────────────────────────

/** Selector for the SVG group of a node. */
const nodeG = (id: string) => `[data-node-id="${id}"]`;

/** Returns the stroke colour of a node's rect (used to detect selection). */
async function nodeStroke(page: import('@playwright/test').Page, id: string) {
  return page.locator(`${nodeG(id)} rect`).first().getAttribute('stroke');
}

const SELECTED_STROKE = '#1D9E75';

// ─── fixture: five-node cross layout ─────────────────────────────────────────
//
//          above (500, 100)
//           |
// left --- center --- right
// (200,300) (500,300)  (800,300)
//           |
//          below (500, 500)
//
// All nodes sit at depth 1 (no hierarchy needed for spatial nav).

const fiveNodeTest = base.extend<{ page: import('@playwright/test').Page }>({
  page: async ({ page }, use) => {
    await page.addInitScript((params) => {
      window.__PLAYWRIGHT_TEST_USER__ = params.user;

      function node(id: string, label: string, x: number, y: number) {
        return { id, label, x, y, parentId: null, depth: 1, w: 90, h: 36 };
      }

      const state = {
        maps: {
          [params.mapId]: {
            id: params.mapId,
            name: 'Arrow Nav Map',
            nodes: {
              [params.center]: node(params.center, 'Center', 500, 300),
              [params.right]:  node(params.right,  'Right',  800, 300),
              [params.left]:   node(params.left,   'Left',   200, 300),
              [params.above]:  node(params.above,  'Above',  500, 100),
              [params.below]:  node(params.below,  'Below',  500, 500),
            },
            edges: [],
            links: [],
            tx: 0,
            ty: 0,
            scale: 1,
          },
        },
        mapOrder: [params.mapId],
      };
      localStorage.setItem('mindmaps_v2', JSON.stringify(state));
    }, { user: TEST_USER, ...IDS });

    await page.goto('/');
    await page.getByText('maps').waitFor();
    await use(page);
  },
});

// ─── fixture: single-node map ─────────────────────────────────────────────────

const SINGLE_IDS = {
  mapId: 'single-node-map-id',
  onlyNode: 'only-node-id',
};

const singleNodeTest = base.extend<{ page: import('@playwright/test').Page }>({
  page: async ({ page }, use) => {
    await page.addInitScript((params) => {
      window.__PLAYWRIGHT_TEST_USER__ = params.user;

      const state = {
        maps: {
          [params.mapId]: {
            id: params.mapId,
            name: 'Single Node Map',
            nodes: {
              [params.onlyNode]: {
                id: params.onlyNode,
                label: 'Solo',
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
            scale: 1,
          },
        },
        mapOrder: [params.mapId],
      };
      localStorage.setItem('mindmaps_v2', JSON.stringify(state));
    }, { user: TEST_USER, ...SINGLE_IDS });

    await page.goto('/');
    await page.getByText('maps').waitFor();
    await use(page);
  },
});

// ─── tests ────────────────────────────────────────────────────────────────────

fiveNodeTest.describe('arrow key spatial navigation', () => {
  fiveNodeTest(
    'ArrowRight selects the nearest node to the right',
    async ({ page }) => {
      // Select center node
      await page.locator(nodeG(IDS.center)).click();
      expect(await nodeStroke(page, IDS.center)).toBe(SELECTED_STROKE);

      await page.keyboard.press('ArrowRight');

      expect(await nodeStroke(page, IDS.right)).toBe(SELECTED_STROKE);
      // Center should no longer be selected
      expect(await nodeStroke(page, IDS.center)).not.toBe(SELECTED_STROKE);
    }
  );

  fiveNodeTest(
    'ArrowLeft selects the nearest node to the left',
    async ({ page }) => {
      await page.locator(nodeG(IDS.center)).click();
      await page.keyboard.press('ArrowLeft');
      expect(await nodeStroke(page, IDS.left)).toBe(SELECTED_STROKE);
    }
  );

  fiveNodeTest(
    'ArrowUp selects the nearest node above',
    async ({ page }) => {
      await page.locator(nodeG(IDS.center)).click();
      await page.keyboard.press('ArrowUp');
      expect(await nodeStroke(page, IDS.above)).toBe(SELECTED_STROKE);
    }
  );

  fiveNodeTest(
    'ArrowDown selects the nearest node below',
    async ({ page }) => {
      await page.locator(nodeG(IDS.center)).click();
      await page.keyboard.press('ArrowDown');
      expect(await nodeStroke(page, IDS.below)).toBe(SELECTED_STROKE);
    }
  );

  fiveNodeTest(
    'arrow navigation is chainable across multiple presses',
    async ({ page }) => {
      // Start at center, go right then down (from "right" node's perspective,
      // "below" is the nearest node in the down direction — still at x=500
      // — but "right" node is at x=800, so we verify we can chain at least
      // two hops correctly within the layout).
      await page.locator(nodeG(IDS.center)).click();
      await page.keyboard.press('ArrowRight');
      expect(await nodeStroke(page, IDS.right)).toBe(SELECTED_STROKE);

      // From right node, going left should return to center
      await page.keyboard.press('ArrowLeft');
      expect(await nodeStroke(page, IDS.center)).toBe(SELECTED_STROKE);
    }
  );

  fiveNodeTest(
    'arrow keys do NOT navigate when a node is in edit mode',
    async ({ page }) => {
      // Select center then enter edit mode with double-click
      await page.locator(nodeG(IDS.center)).dblclick();
      const editInput = page.locator('input[style]');
      await editInput.waitFor({ state: 'visible', timeout: 2000 });

      // Arrow key should move the cursor inside the text input, not navigate
      await page.keyboard.press('ArrowRight');

      // Edit input must still be visible — navigation would have dismissed it
      await expect(editInput).toBeVisible();

      // The right node must NOT be selected (its stroke stays at the default)
      expect(await nodeStroke(page, IDS.right)).not.toBe(SELECTED_STROKE);

      // Dismiss edit
      await page.keyboard.press('Escape');
    }
  );

  fiveNodeTest(
    'arrow keys do nothing when no node is selected',
    async ({ page }) => {
      // Click on empty canvas area to ensure nothing is selected
      const svg = page.locator('svg').first();
      await svg.click({ position: { x: 10, y: 10 } });

      // No node should be selected
      for (const id of Object.values(IDS).slice(1)) {
        expect(await nodeStroke(page, id)).not.toBe(SELECTED_STROKE);
      }

      await page.keyboard.press('ArrowRight');

      // Still nothing selected after the key press
      for (const id of Object.values(IDS).slice(1)) {
        expect(await nodeStroke(page, id)).not.toBe(SELECTED_STROKE);
      }
    }
  );
});

singleNodeTest.describe('arrow key navigation with no neighbours', () => {
  singleNodeTest(
    'arrow key does nothing when there is only one node on the map',
    async ({ page }) => {
      const { onlyNode } = SINGLE_IDS;

      // Select the sole node
      await page.locator(nodeG(onlyNode)).click();
      expect(await nodeStroke(page, onlyNode)).toBe(SELECTED_STROKE);

      // Press all four arrow keys — selection must remain on the same node
      for (const key of ['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown']) {
        await page.keyboard.press(key);
        expect(await nodeStroke(page, onlyNode)).toBe(SELECTED_STROKE);
      }
    }
  );
});
