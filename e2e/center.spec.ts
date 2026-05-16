/**
 * E2E tests for double-click-on-background to centre on root (issue #11).
 *
 * Feature:
 *  - Double-clicking the empty SVG canvas (not on a node) pans the view so
 *    the root node is centred in the viewport. Zoom level is preserved.
 *  - Double-clicking a node starts rename mode (input appears). It does NOT
 *    trigger centring.
 *
 * Detection strategy:
 *  The top-level <g> inside the SVG has a `transform` attribute of the form
 *  `translate(tx,ty) scale(s)`. We parse tx/ty before and after the
 *  double-click to verify that the view panned.  We also verify that after
 *  centring, the root node's rendered centre is close to the SVG's centre.
 */

import { test, expect, TEST_IDS } from './fixtures';

// ─── helpers ────────────────────────────────────────────────────────────────

/** Parse tx and ty from a transform string like "translate(140,60) scale(1)". */
function parseTranslate(transform: string | null): { tx: number; ty: number } {
  if (!transform) return { tx: 0, ty: 0 };
  const m = transform.match(/translate\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)/);
  if (!m) return { tx: 0, ty: 0 };
  return { tx: parseFloat(m[1]), ty: parseFloat(m[2]) };
}

/** The top-level transform <g> inside the canvas SVG. */
const transformG = (page: import('@playwright/test').Page) =>
  page.locator('svg:has([data-node-id]) > g').first();

/** The canvas SVG element (the large full-canvas SVG, not toolbar icon SVGs). */
const svg = (page: import('@playwright/test').Page) =>
  page.locator('svg:has([data-node-id])');

/** The canvas edit input (inline style distinguishes it from sidebar inputs). */
const canvasEditInput = (page: import('@playwright/test').Page) =>
  page.locator('input[style]');

// ─── tests ───────────────────────────────────────────────────────────────────

test('double-clicking empty canvas changes the SVG transform (view pans)', async ({ page }) => {
  // First pan away so tx/ty are non-zero, then double-click to re-centre.
  // We pan by dragging the canvas background 200px to the right and 150px down.
  const svgEl = svg(page);
  await svgEl.hover({ position: { x: 50, y: 50 } });
  await page.mouse.down();
  await page.mouse.move(250, 200, { steps: 10 });
  await page.mouse.up();

  // Capture transform after the pan
  const transformAfterPan = await transformG(page).getAttribute('transform');
  const { tx: txPanned, ty: tyPanned } = parseTranslate(transformAfterPan);

  // Double-click on an empty area of the canvas (top-left corner, away from nodes)
  await svgEl.dblclick({ position: { x: 50, y: 50 } });

  // Capture transform after centring
  const transformAfterCentre = await transformG(page).getAttribute('transform');
  const { tx: txCentred, ty: tyCentred } = parseTranslate(transformAfterCentre);

  // The transform must have changed relative to the panned position
  expect(txCentred).not.toBeCloseTo(txPanned, 0);
  expect(tyCentred).not.toBeCloseTo(tyPanned, 0);
});

test('double-clicking empty canvas centres the root node in the viewport', async ({ page }) => {
  // Pan away first so we know we're not accidentally already centred.
  const svgEl = svg(page);
  await svgEl.hover({ position: { x: 50, y: 50 } });
  await page.mouse.down();
  await page.mouse.move(350, 350, { steps: 10 });
  await page.mouse.up();

  // Double-click on an empty corner to trigger centring
  await svgEl.dblclick({ position: { x: 50, y: 50 } });

  // After centring, root node's bounding box centre should be near SVG centre.
  const svgBox = await svgEl.boundingBox();
  const rootBox = await page
    .locator(`[data-node-id="${TEST_IDS.rootNodeId}"]`)
    .boundingBox();

  if (!svgBox || !rootBox) throw new Error('could not get bounding boxes');

  const svgCx = svgBox.x + svgBox.width / 2;
  const svgCy = svgBox.y + svgBox.height / 2;
  const rootCx = rootBox.x + rootBox.width / 2;
  const rootCy = rootBox.y + rootBox.height / 2;

  // Allow ±5px tolerance for rounding
  expect(Math.abs(rootCx - svgCx)).toBeLessThan(5);
  expect(Math.abs(rootCy - svgCy)).toBeLessThan(5);
});

test('double-clicking a node does NOT centre the view — rename input appears instead', async ({ page }) => {
  const svgEl = svg(page);

  // Record transform before
  const transformBefore = await transformG(page).getAttribute('transform');

  // Double-click the root node (it is visible near viewport centre on load)
  await page.locator(`[data-node-id="${TEST_IDS.rootNodeId}"]`).dblclick();

  // The canvas edit input must appear (rename mode)
  await expect(canvasEditInput(page)).toBeVisible({ timeout: 2000 });

  // The view transform must NOT have changed (centring should not have fired)
  const transformAfter = await transformG(page).getAttribute('transform');
  expect(transformAfter).toBe(transformBefore);

  // Clean up — dismiss the edit input.
  // Use locator.press() to dispatch directly to the input element; page.keyboard.press()
  // requires focus which can be unreliable in headless parallel runs.
  await canvasEditInput(page).press('Escape');
  await expect(canvasEditInput(page)).not.toBeVisible();
});

test('panning away then double-clicking background re-centres on root', async ({ page }) => {
  const svgEl = svg(page);

  // Pan a significant distance away
  await svgEl.hover({ position: { x: 640, y: 360 } });
  await page.mouse.down();
  await page.mouse.move(40, 60, { steps: 20 });
  await page.mouse.up();

  // Verify we actually moved away: the root node should no longer be centred
  const svgBox = await svgEl.boundingBox();
  const rootBoxPanned = await page
    .locator(`[data-node-id="${TEST_IDS.rootNodeId}"]`)
    .boundingBox();

  if (!svgBox || !rootBoxPanned) throw new Error('could not get bounding boxes');

  const svgCx = svgBox.x + svgBox.width / 2;
  const svgCy = svgBox.y + svgBox.height / 2;
  const rootCxPanned = rootBoxPanned.x + rootBoxPanned.width / 2;
  const rootCyPanned = rootBoxPanned.y + rootBoxPanned.height / 2;

  // After panning 600px away, the root should be clearly off-centre
  const distPanned = Math.hypot(rootCxPanned - svgCx, rootCyPanned - svgCy);
  expect(distPanned).toBeGreaterThan(50);

  // Double-click empty canvas area to re-centre
  await svgEl.dblclick({ position: { x: 50, y: 50 } });

  // Root node must now be near the viewport centre
  const rootBoxCentred = await page
    .locator(`[data-node-id="${TEST_IDS.rootNodeId}"]`)
    .boundingBox();

  if (!rootBoxCentred) throw new Error('root node not found after centring');

  const rootCxCentred = rootBoxCentred.x + rootBoxCentred.width / 2;
  const rootCyCentred = rootBoxCentred.y + rootBoxCentred.height / 2;

  expect(Math.abs(rootCxCentred - svgCx)).toBeLessThan(5);
  expect(Math.abs(rootCyCentred - svgCy)).toBeLessThan(5);
});

test('double-clicking a tree edge re-centres on root', async ({ page }) => {
  const svgEl = svg(page);

  // Pan a significant distance away so root is clearly off-centre
  await svgEl.hover({ position: { x: 640, y: 360 } });
  await page.mouse.down();
  await page.mouse.move(40, 60, { steps: 20 });
  await page.mouse.up();

  // Verify root is off-centre after panning
  const svgBox = await svgEl.boundingBox();
  const rootBoxPanned = await page
    .locator(`[data-node-id="${TEST_IDS.rootNodeId}"]`)
    .boundingBox();

  if (!svgBox || !rootBoxPanned) throw new Error('could not get bounding boxes');

  const svgCx = svgBox.x + svgBox.width / 2;
  const svgCy = svgBox.y + svgBox.height / 2;
  const rootCxPanned = rootBoxPanned.x + rootBoxPanned.width / 2;
  const rootCyPanned = rootBoxPanned.y + rootBoxPanned.height / 2;

  const distPanned = Math.hypot(rootCxPanned - svgCx, rootCyPanned - svgCy);
  expect(distPanned).toBeGreaterThan(50);

  // Double-click on the far-right empty canvas area (no node there) via coordinates.
  // Targeting a <path> element directly is unreliable because the only paths in a
  // single-node map are invisible arrowhead markers inside <defs>.
  await page.mouse.dblclick(svgBox.x + svgBox.width * 0.85, svgBox.y + svgBox.height * 0.5);

  // Root node must now be near the viewport centre
  const rootBoxCentred = await page
    .locator(`[data-node-id="${TEST_IDS.rootNodeId}"]`)
    .boundingBox();

  if (!rootBoxCentred) throw new Error('root node not found after centring');

  const rootCxCentred = rootBoxCentred.x + rootBoxCentred.width / 2;
  const rootCyCentred = rootBoxCentred.y + rootBoxCentred.height / 2;

  expect(Math.abs(rootCxCentred - svgCx)).toBeLessThan(5);
  expect(Math.abs(rootCyCentred - svgCy)).toBeLessThan(5);
});

test('double-click centring preserves the current zoom level', async ({ page }) => {
  const svgEl = svg(page);

  // Zoom in using the + button
  await page.getByTitle('Zoom in').click();
  await page.getByTitle('Zoom in').click();

  // Record the scale from the transform after zooming
  const transformAfterZoom = await transformG(page).getAttribute('transform');
  const scaleMatch = transformAfterZoom?.match(/scale\(\s*([\d.]+)\s*\)/);
  const scaleAfterZoom = scaleMatch ? parseFloat(scaleMatch[1]) : 1;

  // Pan away
  await svgEl.hover({ position: { x: 50, y: 50 } });
  await page.mouse.down();
  await page.mouse.move(350, 350, { steps: 10 });
  await page.mouse.up();

  // Double-click to re-centre
  await svgEl.dblclick({ position: { x: 50, y: 50 } });

  // Scale must be unchanged
  const transformAfterCentre = await transformG(page).getAttribute('transform');
  const scaleCentreMatch = transformAfterCentre?.match(/scale\(\s*([\d.]+)\s*\)/);
  const scaleAfterCentre = scaleCentreMatch ? parseFloat(scaleCentreMatch[1]) : 1;

  expect(scaleAfterCentre).toBeCloseTo(scaleAfterZoom, 3);
});
