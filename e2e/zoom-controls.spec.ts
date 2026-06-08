/**
 * E2E tests for issue #88: "Do not zoom in/out using touchpad."
 *
 * Behaviour under test:
 *  - Scroll/touchpad over the canvas PANS the view (it no longer zooms).
 *    The zoom percentage stays unchanged after a wheel scroll.
 *  - Zoom is driven by the on-canvas + / − buttons and by keyboard
 *    shortcuts: `+`/`=` zoom in, `-`/`_` zoom out, `0` reset to 100%.
 *
 * Detection strategy:
 *  The `.zoom` control holds a <span> showing the current zoom percentage
 *  (e.g. "100%") between the "Zoom out" (−) and "Zoom in" (+) buttons.
 *  The top-level <g> inside the SVG carries `translate(tx,ty) scale(s)`.
 */

import { test, expect, parseTransform } from './fixtures';

// ─── helpers ──────────────────────────────────────────────────────────────────

/** The canvas SVG element (the large full-canvas SVG, not toolbar icon SVGs). */
const svg = (page: import('@playwright/test').Page) =>
  page.locator('svg:has([data-node-id])');

/** The top-level transform <g> inside the canvas SVG. */
const transformG = (page: import('@playwright/test').Page) =>
  page.locator('svg:has([data-node-id]) > g').first();

/** The zoom-percentage <span> shown between the −/+ buttons. */
const zoomPct = (page: import('@playwright/test').Page) =>
  page.getByText(/^\d+%$/);

async function readZoomPct(page: import('@playwright/test').Page): Promise<number> {
  const text = (await zoomPct(page).innerText()).trim();
  return parseInt(text.replace('%', ''), 10);
}

async function readScale(page: import('@playwright/test').Page): Promise<number> {
  const transform = await transformG(page).getAttribute('transform');
  return parseTransform(transform).scale;
}

/**
 * Click empty canvas background to make sure no node is selected / in edit
 * mode, so the +/-/0 keyboard shortcuts are not swallowed by the inline
 * editor's `isEditable` guard.
 */
async function focusEmptyCanvas(page: import('@playwright/test').Page) {
  // Single-click an empty area away from nodes AND from the sidebar-toggle
  // menu button (which overlays the top-left corner). dblclick would re-centre
  // the view, so we use a single click.
  await svg(page).click({ position: { x: 120, y: 120 } });
}

// ─── tests ────────────────────────────────────────────────────────────────────

test('wheel/scroll over the canvas pans but does NOT change the zoom percentage', async ({ page }) => {
  const svgEl = svg(page);
  await svgEl.hover({ position: { x: 200, y: 200 } });

  const pctBefore = await readZoomPct(page);
  const transformBefore = await transformG(page).getAttribute('transform');
  const { tx: txBefore, ty: tyBefore } = parseTransform(transformBefore);

  // Simulate a touchpad / mouse-wheel scroll over the canvas. Dispatch a real
  // wheel event on the SVG (mouse.wheel can be flaky about hit-testing the
  // React onWheel handler) so the pan reliably fires.
  await svgEl.dispatchEvent('wheel', { deltaX: 0, deltaY: 200 });

  // The view should pan (translate changes) — primary side effect of scroll.
  await expect
    .poll(async () => {
      const t = await transformG(page).getAttribute('transform');
      const { tx, ty } = parseTransform(t);
      return Math.abs(tx - txBefore) > 1 || Math.abs(ty - tyBefore) > 1;
    })
    .toBe(true);

  // Primary assertion: zoom percentage must be unchanged by the scroll.
  const pctAfter = await readZoomPct(page);
  expect(pctAfter).toBe(pctBefore);
});

test('the + button increases and the − button decreases the zoom percentage', async ({ page }) => {
  const pctStart = await readZoomPct(page);

  await page.getByTitle('Zoom in').click();
  const pctAfterIn = await readZoomPct(page);
  expect(pctAfterIn).toBeGreaterThan(pctStart);

  await page.getByTitle('Zoom out').click();
  await page.getByTitle('Zoom out').click();
  const pctAfterOut = await readZoomPct(page);
  expect(pctAfterOut).toBeLessThan(pctAfterIn);
});

test('keyboard +/− zoom and 0 resets to 100%', async ({ page }) => {
  await focusEmptyCanvas(page);

  const pctStart = await readZoomPct(page);

  // `+` zooms in.
  await page.keyboard.press('+');
  const pctAfterPlus = await readZoomPct(page);
  expect(pctAfterPlus).toBeGreaterThan(pctStart);

  // `-` zooms out (twice, so we drop below the start level).
  await page.keyboard.press('-');
  await page.keyboard.press('-');
  const pctAfterMinus = await readZoomPct(page);
  expect(pctAfterMinus).toBeLessThan(pctAfterPlus);

  // `0` resets zoom to exactly 100%.
  await page.keyboard.press('0');
  expect(await readZoomPct(page)).toBe(100);
  expect(await readScale(page)).toBeCloseTo(1, 5);
});
