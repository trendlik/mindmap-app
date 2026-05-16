/**
 * E2E tests for touch double-tap re-centering on mobile (issue #13).
 *
 * The feature: Android Chrome does not reliably fire `dblclick` on SVG elements,
 * so a `touchend` double-tap handler was added to `onSvgTouchEnd`. When the user
 * double-taps the empty canvas (not on a node) within 300 ms, the view re-centres
 * on the root node. Double-tapping a node does NOT re-centre (it opens inline edit
 * instead), and a single tap does NOT re-centre.
 *
 * Test setup notes:
 *  - `test.use({ hasTouch: true })` is required so that touch events are enabled.
 *    isMobile is intentionally omitted so that mouse events (used by panAway())
 *    still work.
 *  - The shared fixture seeds a single map with the root node at world coords
 *    (500, 300) and an identity transform (tx=0, ty=0, scale=1).
 *  - The SVG transform group is `<g transform="translate(tx,ty) scale(s)">`.
 *    We read its transform attribute before/after the gesture to detect panning.
 *  - doubleTap() uses page.evaluate() to dispatch native TouchEvents directly
 *    in the browser context, bypassing CDP reliability issues.
 */

import { test, expect, TEST_IDS } from './fixtures';

// Enable touch mode for every test in this file.
// NOTE: hasTouch: true is sufficient for touch event dispatch. isMobile: true is
// intentionally omitted because Playwright's mobile simulation suppresses mouse
// events, which breaks the panAway() helper that uses page.mouse.down/move/up.
test.use({ hasTouch: true });

// ─── helpers ─────────────────────────────────────────────────────────────────

/** Read the raw transform attribute of the top-level canvas SVG <g> group. */
async function svgTransform(page: import('@playwright/test').Page): Promise<string> {
  return page.locator('svg:has([data-node-id]) > g').first().getAttribute('transform') as Promise<string>;
}

/**
 * Pan the view away from its initial position by dragging the canvas,
 * then return the new transform string so tests can compare against it.
 */
async function panAway(page: import('@playwright/test').Page): Promise<string> {
  const svg = page.locator('svg').first();
  const box = await svg.boundingBox();
  if (!box) throw new Error('SVG not found');

  // Use mouse drag to pan that doesn't rely on touch-pan
  // (touch-pan uses the same handlers, but mouse drag is simpler in automation
  // and avoids polluting lastCanvasTapRef).
  const startX = box.x + box.width * 0.7;
  const startY = box.y + box.height * 0.5;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX - 200, startY - 150, { steps: 10 });
  await page.mouse.up();

  return svgTransform(page);
}

/**
 * Issue a touch double-tap at the given viewport coordinates using page.evaluate()
 * to dispatch native TouchEvents directly in the browser context. This bypasses
 * CDP-based touch dispatch which may not reliably bubble to React's event
 * delegation root in some Playwright/Chromium versions.
 */
async function doubleTap(page: import('@playwright/test').Page, x: number, y: number) {
  await page.evaluate(({ x, y }) => {
    const el = document.elementFromPoint(x, y) ?? document.body;
    function fireTap() {
      const touch = new Touch({
        identifier: 1, target: el,
        clientX: x, clientY: y, pageX: x, pageY: y, screenX: x, screenY: y,
        radiusX: 1, radiusY: 1, rotationAngle: 0, force: 1,
      });
      el.dispatchEvent(new TouchEvent('touchstart', {
        bubbles: true, cancelable: true, touches: [touch], changedTouches: [touch],
      }));
      el.dispatchEvent(new TouchEvent('touchend', {
        bubbles: true, cancelable: true, touches: [], changedTouches: [touch],
      }));
    }
    fireTap(); // first tap — sets lastCanvasTapRef
    return new Promise<void>(resolve => {
      setTimeout(() => { fireTap(); resolve(); }, 50); // second tap 50ms later — triggers centerOnRoot
    });
  }, { x, y });
  await page.waitForTimeout(100); // wait for React state to commit
}

// ─── tests ───────────────────────────────────────────────────────────────────

test('touch double-tap on empty canvas changes the SVG transform', async ({ page }) => {
  const svg = page.locator('svg').first();
  const box = await svg.boundingBox();
  if (!box) throw new Error('SVG not found');

  // Pan the view so we know the transform has a non-default value.
  await panAway(page);
  const pannedTransform = await svgTransform(page);

  // Double-tap an empty corner of the canvas (well away from any node).
  const cornerX = box.x + 20;
  const cornerY = box.y + 20;
  await doubleTap(page, cornerX, cornerY);

  // Give React one frame to process the state update.
  await page.waitForTimeout(50);

  const afterTransform = await svgTransform(page);

  // The transform must have changed from the panned position.
  expect(afterTransform).not.toBe(pannedTransform);
});

test('touch double-tap on empty canvas centres root node in SVG viewport', async ({ page }) => {
  const svg = page.locator('svg').first();
  const box = await svg.boundingBox();
  if (!box) throw new Error('SVG not found');

  // Pan far away so root node is definitely off-centre.
  await panAway(page);

  // Double-tap an empty corner of the canvas.
  const cornerX = box.x + 20;
  const cornerY = box.y + 20;
  await doubleTap(page, cornerX, cornerY);

  // Wait for the React state to propagate so the SVG group moves.
  await page.waitForTimeout(100);

  // The root node's SVG group should now be visible and roughly centred.
  const nodeGroup = page.locator(`[data-node-id="${TEST_IDS.rootNodeId}"]`);
  await expect(nodeGroup).toBeVisible();

  const nodeBox = await nodeGroup.boundingBox();
  if (!nodeBox) throw new Error('root node not found after double-tap');

  const nodeCentreX = nodeBox.x + nodeBox.width / 2;
  const nodeCentreY = nodeBox.y + nodeBox.height / 2;
  const svgCentreX = box.x + box.width / 2;
  const svgCentreY = box.y + box.height / 2;

  // centerOnRoot() places the root node at the SVG centre.
  expect(Math.abs(nodeCentreX - svgCentreX)).toBeLessThan(5);
  expect(Math.abs(nodeCentreY - svgCentreY)).toBeLessThan(5);
});

test('touch double-tap on a node does NOT re-centre the view', async ({ page }) => {
  const svg = page.locator('svg').first();
  const box = await svg.boundingBox();
  if (!box) throw new Error('SVG not found');

  // Pan slightly so fitView's 80 ms useEffect has already fired and settled
  // before we snapshot the transform. Without this, beforeTransform captures
  // the raw default (translate(0,0) scale(1)) and by the time afterTransform is
  // read, fitView has already changed it — causing a spurious mismatch.
  await panAway(page);
  const beforeTransform = await svgTransform(page);

  // Locate the root node and tap it twice (double-tap on the node).
  const nodeGroup = page.locator(`[data-node-id="${TEST_IDS.rootNodeId}"]`);
  await expect(nodeGroup).toBeVisible();
  const nodeBox = await nodeGroup.boundingBox();
  if (!nodeBox) throw new Error('root node not found');

  const nodeCentreX = nodeBox.x + nodeBox.width / 2;
  const nodeCentreY = nodeBox.y + nodeBox.height / 2;

  // First tap selects the node; second tap (within 350 ms) triggers inline edit.
  await page.touchscreen.tap(nodeCentreX, nodeCentreY);
  await page.touchscreen.tap(nodeCentreX, nodeCentreY);

  // Wait a moment for any state changes to settle.
  await page.waitForTimeout(50);

  // The transform must be unchanged — double-tap on a node must NOT call centerOnRoot().
  const afterTransform = await svgTransform(page);
  expect(afterTransform).toBe(beforeTransform);

  // The inline edit input should have appeared (confirming it was a node double-tap).
  const editInput = page.locator('input[style]');
  await expect(editInput).toBeVisible();

  // Clean up — dismiss the edit input.
  await page.keyboard.press('Escape');
});

test('single touch tap does NOT re-centre the view', async ({ page }) => {
  const svg = page.locator('svg').first();
  const box = await svg.boundingBox();
  if (!box) throw new Error('SVG not found');

  // Pan so the current transform differs from the re-centred one.
  await panAway(page);
  const pannedTransform = await svgTransform(page);

  // Issue a single tap on empty canvas.
  const cornerX = box.x + 20;
  const cornerY = box.y + 20;
  await page.touchscreen.tap(cornerX, cornerY);

  // Wait longer than the 300 ms double-tap window to confirm no delayed action.
  await page.waitForTimeout(350);

  const afterTransform = await svgTransform(page);

  // Transform must not have changed (no re-centering from a single tap).
  expect(afterTransform).toBe(pannedTransform);
});
