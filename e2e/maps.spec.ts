import { test, expect, TEST_USER, makeNode, parseTransform, waitForPageReady } from './fixtures';
import type { Page } from '@playwright/test';

test('shows default map in sidebar on first load', async ({ page }) => {
  await expect(page.locator('aside').getByText('my first map')).toBeVisible();
  await expect(page.locator('aside').getByText('1 map')).toBeVisible();
});

test('creates a new map via the + button', async ({ page }) => {
  page.on('dialog', (dialog) => dialog.accept('My Test Map'));
  await page.getByTitle('New map').click();
  await expect(page.locator('aside').getByText('My Test Map')).toBeVisible();
  await expect(page.locator('aside').getByText('2 maps')).toBeVisible();
});

test('renames a map via double-click', async ({ page }) => {
  // Double-click opens the rename input while keeping the sidebar open
  // (click timer debounce prevents the single-click from closing the sidebar)
  await page.locator('aside nav').getByText('my first map').dblclick();
  const renameInput = page.locator('aside nav input');
  await expect(renameInput).toBeVisible();
  await renameInput.fill('Renamed Map');
  await renameInput.press('Enter');
  // Sidebar stays open — renamed item must be directly visible
  await expect(page.locator('aside nav').getByText('Renamed Map')).toBeVisible();
  await expect(page.locator('aside nav').getByText('my first map')).not.toBeVisible();
});

test('pressing Escape during rename cancels the edit', async ({ page }) => {
  await page.locator('aside nav').getByText('my first map').dblclick();
  const renameInput = page.locator('aside nav input');
  await renameInput.fill('Discarded Name');
  await renameInput.press('Escape');
  // Sidebar stays open — original name must be directly visible
  await expect(page.locator('aside nav').getByText('my first map')).toBeVisible();
  await expect(page.locator('aside nav').getByText('Discarded Name')).not.toBeVisible();
});

test('deletes a map when there are multiple maps', async ({ page }) => {
  page.on('dialog', async (dialog) => {
    if (dialog.type() === 'prompt') await dialog.accept('Map B');
  });
  await page.getByTitle('New map').click();
  await expect(page.locator('aside').getByText('2 maps')).toBeVisible();

  // Hover over "my first map" item to reveal its delete button
  const nameSpan = page.locator('aside nav').getByText('my first map');
  await nameSpan.hover();
  // The delete button sits in the same .item parent as the name span
  const deleteBtn = nameSpan.locator('..').getByTitle('Delete map');
  await deleteBtn.click();

  // Confirm the custom dialog
  await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();

  await expect(page.locator('aside nav').getByText('my first map')).not.toBeVisible();
  await expect(page.locator('aside').getByText('1 map')).toBeVisible();
});

test('delete button is absent when only one map exists', async ({ page }) => {
  await expect(page.locator('aside').getByTitle('Delete map')).not.toBeAttached();
});

test('sidebar stays open after map select on wide screens', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  page.on('dialog', (dialog) => dialog.accept('Map B'));
  await page.getByTitle('New map').click();
  await expect(page.locator('aside').getByText('2 maps')).toBeVisible();

  await page.locator('aside nav').getByText('my first map').click();

  await expect(page.locator('aside').getByText('my first map')).toBeVisible();
});

test('sidebar closes after map select on narrow screens', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  page.on('dialog', (dialog) => dialog.accept('Map B'));
  await page.getByTitle('New map').click();
  await expect(page.locator('aside').getByText('2 maps')).toBeVisible();

  await page.locator('aside nav').getByText('my first map').click();

  // On narrow screens the sidebar closes — the overlay is removed from the DOM
  await expect(page.locator('[class*="overlay"]')).not.toBeAttached();
});

// ─── view persistence ─────────────────────────────────────────────────────────

const MAP_A_ID = 'view-persist-map-a';
const MAP_B_ID = 'view-persist-map-b';

const viewPersistTest = test.extend<{ page: Page }>({
  page: async ({ page }, use) => {
    const state = {
      maps: {
        [MAP_A_ID]: {
          id: MAP_A_ID,
          name: 'Map A',
          nodes: { 'va-root': makeNode('va-root', 'Map A', 500, 300) },
          edges: [],
          links: [],
          // Non-default scale avoids the auto-fitView effect (fires when scale===1)
          tx: 0,
          ty: 0,
          scale: 0.8,
        },
        [MAP_B_ID]: {
          id: MAP_B_ID,
          name: 'Map B',
          nodes: { 'vb-root': makeNode('vb-root', 'Map B', 500, 300) },
          edges: [],
          links: [],
          tx: 60,
          ty: 40,
          scale: 0.6,
        },
      },
      mapOrder: [MAP_A_ID, MAP_B_ID],
    };
    await page.addInitScript((params) => {
      window.__PLAYWRIGHT_TEST_USER__ = params.user;
      localStorage.setItem('mindmaps_v2', JSON.stringify(params.state));
    }, { user: TEST_USER, state });
    await waitForPageReady(page);
    await use(page);
  },
});

viewPersistTest('saved view transform is restored when switching between maps', async ({ page }) => {
  // The main canvas transform group is the first <g> child of the SVG.
  // Its transform attribute encodes the current tx/ty/scale.
  const transformG = page.locator('svg > g').first();

  // Map A should load with scale≈0.8
  const aTransformBefore = parseTransform(await transformG.getAttribute('transform'));
  expect(aTransformBefore.scale).toBeCloseTo(0.8, 1);

  // Switch to Map B and wait for the Canvas useEffect to apply Map B's saved view
  await page.locator('aside nav').getByText('Map B').click();
  await expect(transformG).toHaveAttribute('transform', /scale\(0\.6/);
  const bTransform = parseTransform(await transformG.getAttribute('transform'));
  expect(bTransform.scale).toBeCloseTo(0.6, 1);
  expect(bTransform.tx).toBeCloseTo(60, 0);
  expect(bTransform.ty).toBeCloseTo(40, 0);

  // Switch back to Map A — saved view must be restored
  await page.locator('aside nav').getByText('Map A').click();
  await expect(transformG).toHaveAttribute('transform', /scale\(0\.8/);
  const aTransformAfter = parseTransform(await transformG.getAttribute('transform'));
  expect(aTransformAfter.scale).toBeCloseTo(0.8, 1);
});

test('sidebarWrap width tracks sidebar after resize', async ({ page }) => {
  // Drag the resize handle 100px to the right and assert the wrapper matches
  const handle = page.locator('[class*="resizeHandle"]');
  const box = await handle.boundingBox();
  if (!box) throw new Error('resize handle not found');

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 100, box.y + box.height / 2, { steps: 10 });
  await page.mouse.up();

  const wrap = page.locator('[class*="sidebarWrap"]');
  const wrapBox = await wrap.boundingBox();
  const asideBox = await page.locator('aside').boundingBox();
  if (!wrapBox || !asideBox) throw new Error('elements not found');

  // After resize, sidebarWrap width must equal aside width (buttons no longer clipped)
  expect(wrapBox.width).toBeCloseTo(asideBox.width, 0);
  expect(wrapBox.width).toBeGreaterThan(210);
});
