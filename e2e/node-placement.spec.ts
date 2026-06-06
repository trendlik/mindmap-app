/**
 * E2E tests for non-overlapping node placement (issue #81).
 *
 * When a new node is created via "add child" or "add sibling", it must not be
 * placed on top of an existing visible node. The Canvas computes a default
 * position; if that spot collides with an existing node it searches outward for
 * the nearest free spot (expanding-ring search). When the default spot is free
 * the behaviour is unchanged.
 *
 * Test setup notes:
 *  - Each node renders as an SVG <g data-node-id="…"> whose transform is
 *    translate(n.x - w/2, n.y - h/2); the inner <rect> carries width/height.
 *    We read these directly to reconstruct each node's bounding box in canvas
 *    coordinates (independent of pan/zoom).
 *  - We seed localStorage with deterministic multi-node maps so the default
 *    placement spot is fully under test control.
 *  - The canvas edit input is an <input style="…">; after creating a node we
 *    wait for it then press Escape (matching the nodes.spec.ts pattern) so the
 *    "new idea" node is committed without an extra undo entry.
 */

import { test as base, expect, type Page } from '@playwright/test';
import { TEST_USER, makeNode, waitForPageReady, waitForEditInput } from './fixtures';

const nodeG = (id: string) => `[data-node-id="${id}"]`;

interface Box {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/**
 * Read a node's bounding box (canvas coordinates) from the rendered SVG.
 * The <g> transform encodes the top-left corner; the <rect> gives w/h.
 */
async function nodeBox(page: Page, id: string): Promise<Box> {
  const g = page.locator(nodeG(id));
  const transform = await g.getAttribute('transform');
  const m = transform?.match(/translate\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)/);
  if (!m) throw new Error(`could not parse transform for node ${id}: ${transform}`);
  const left = parseFloat(m[1]);
  const top = parseFloat(m[2]);
  const rect = g.locator('rect').first();
  const w = parseFloat((await rect.getAttribute('width'))!);
  const h = parseFloat((await rect.getAttribute('height'))!);
  return { left, right: left + w, top, bottom: top + h };
}

/** True if two axis-aligned bounding boxes overlap (any shared interior area). */
function boxesOverlap(a: Box, b: Box): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

/** All node IDs currently rendered on the canvas. */
async function renderedNodeIds(page: Page): Promise<string[]> {
  return page.locator('[data-node-id]').evaluateAll((els) =>
    els.map((el) => el.getAttribute('data-node-id')!),
  );
}

/** Click add-child / add-sibling, wait for the edit input, then commit via Escape. */
async function addChildAndClose(page: Page) {
  await page.getByRole('button', { name: 'child', exact: true }).click();
  await waitForEditInput(page);
  await page.keyboard.press('Escape');
}
async function addSiblingAndClose(page: Page) {
  await page.getByRole('button', { name: 'sibling', exact: true }).click();
  await waitForEditInput(page);
  await page.keyboard.press('Escape');
}

/** Select a node by clicking its SVG group. */
async function selectNode(page: Page, id: string) {
  await page.locator(nodeG(id)).click();
}

// ─── fixture builder ──────────────────────────────────────────────────────────

function seededTest(mapId: string, nodes: Record<string, ReturnType<typeof makeNode>>) {
  return base.extend<{ page: Page }>({
    page: async ({ page }, use) => {
      const state = {
        maps: {
          [mapId]: {
            id: mapId,
            name: 'Placement Map',
            nodes,
            edges: [] as { from: string; to: string }[],
            links: [] as unknown[],
            tx: 0,
            ty: 0,
            scale: 0.999,
          },
        },
        mapOrder: [mapId],
      };
      await page.addInitScript((params) => {
        window.__PLAYWRIGHT_TEST_USER__ = params.user;
        localStorage.setItem('mindmaps_v2', JSON.stringify(params.state));
      }, { user: TEST_USER, state });
      await waitForPageReady(page);
      await use(page);
    },
  });
}

// ─── happy path: near-empty map, default placement, no overlap ───────────────
//
// A lone root node. The first child's default spot (root.x + 190) is empty, so
// placement is unchanged; we just confirm the node is created and does not
// overlap the root.

const HAPPY_IDS = { mapId: 'placement-happy-map', root: 'placement-happy-root' };

const happyTest = seededTest(HAPPY_IDS.mapId, {
  [HAPPY_IDS.root]: makeNode(HAPPY_IDS.root, 'Root', 500, 300, null, 0),
});

happyTest('add child in empty space creates a non-overlapping node', async ({ page }) => {
  const before = await renderedNodeIds(page);

  await selectNode(page, HAPPY_IDS.root);
  await addChildAndClose(page);

  await expect(page.locator('[data-node-id]')).toHaveCount(2);

  const after = await renderedNodeIds(page);
  const newIds = after.filter((id) => !before.includes(id));
  expect(newIds).toHaveLength(1);

  const newBox = await nodeBox(page, newIds[0]);
  const rootBox = await nodeBox(page, HAPPY_IDS.root);
  expect(boxesOverlap(newBox, rootBox)).toBe(false);
});

happyTest('add sibling in empty space creates a non-overlapping node', async ({ page }) => {
  // Add a first child, then a sibling of it. With only these few nodes the
  // sibling's default spot is free, so placement is unchanged — assert no overlap.
  await selectNode(page, HAPPY_IDS.root);
  await addChildAndClose(page);
  await expect(page.locator('[data-node-id]')).toHaveCount(2);

  const before = await renderedNodeIds(page);
  await addSiblingAndClose(page);
  await expect(page.locator('[data-node-id]')).toHaveCount(3);

  const after = await renderedNodeIds(page);
  const newIds = after.filter((id) => !before.includes(id));
  expect(newIds).toHaveLength(1);

  const newBox = await nodeBox(page, newIds[0]);
  for (const id of before) {
    expect(boxesOverlap(newBox, await nodeBox(page, id))).toBe(false);
  }
});

// ─── collision case: add child ───────────────────────────────────────────────
//
// Root at (500,300). The first child's default position is (root.x + 190, root.y)
// = (690, 300). We pre-place an "occupant" node EXACTLY there so the default
// spot collides. The new child must be relocated to a free spot that overlaps
// no existing node.

const CHILD_IDS = {
  mapId: 'placement-child-collision-map',
  root: 'pc-root',
  occupant: 'pc-occupant',
};

const childCollisionTest = seededTest(CHILD_IDS.mapId, {
  [CHILD_IDS.root]: makeNode(CHILD_IDS.root, 'Root', 500, 300, null, 0),
  // Sits on the default first-child spot (500 + 190, 300).
  [CHILD_IDS.occupant]: makeNode(CHILD_IDS.occupant, 'Occupant', 690, 300, null, 1),
});

childCollisionTest('add child does not overlap an existing node at the default spot', async ({ page }) => {
  await expect(page.locator('[data-node-id]')).toHaveCount(2);
  const before = await renderedNodeIds(page);

  await selectNode(page, CHILD_IDS.root);
  await addChildAndClose(page);

  await expect(page.locator('[data-node-id]')).toHaveCount(3);
  const after = await renderedNodeIds(page);
  const newIds = after.filter((id) => !before.includes(id));
  expect(newIds).toHaveLength(1);

  const newBox = await nodeBox(page, newIds[0]);
  // The new node must not overlap ANY pre-existing node.
  for (const id of before) {
    const existing = await nodeBox(page, id);
    expect(
      boxesOverlap(newBox, existing),
      `new child overlaps existing node ${id}`,
    ).toBe(false);
  }
});

// ─── collision case: add sibling ─────────────────────────────────────────────
//
// A child at (500,300). Its sibling's default position is (child.x, child.y + 55)
// = (500, 355). We pre-place an "occupant" node there so the default sibling spot
// collides. The new sibling must be relocated to a free spot.

const SIB_IDS = {
  mapId: 'placement-sibling-collision-map',
  root: 'ps-root',
  child: 'ps-child',
  occupant: 'ps-occupant',
};

const siblingCollisionTest = seededTest(SIB_IDS.mapId, {
  [SIB_IDS.root]: makeNode(SIB_IDS.root, 'Root', 200, 300, null, 0),
  [SIB_IDS.child]: makeNode(SIB_IDS.child, 'Child', 500, 300, SIB_IDS.root, 1),
  // Sits on the default sibling spot (500, 300 + 55).
  [SIB_IDS.occupant]: makeNode(SIB_IDS.occupant, 'Occupant', 500, 355, SIB_IDS.root, 1),
});

siblingCollisionTest('add sibling does not overlap an existing node at the default spot', async ({ page }) => {
  await expect(page.locator('[data-node-id]')).toHaveCount(3);
  const before = await renderedNodeIds(page);

  await selectNode(page, SIB_IDS.child);
  await addSiblingAndClose(page);

  await expect(page.locator('[data-node-id]')).toHaveCount(4);
  const after = await renderedNodeIds(page);
  const newIds = after.filter((id) => !before.includes(id));
  expect(newIds).toHaveLength(1);

  const newBox = await nodeBox(page, newIds[0]);
  for (const id of before) {
    const existing = await nodeBox(page, id);
    expect(
      boxesOverlap(newBox, existing),
      `new sibling overlaps existing node ${id}`,
    ).toBe(false);
  }
});
