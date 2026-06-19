/**
 * E2E tests for document.title reflecting the active mind map name (issue #93).
 *
 * Feature summary:
 *  - Browser tab title follows the format "Mind Maps — <MapName>" when a named
 *    map is active and the user is signed in (em-dash U+2014).
 *  - Falls back to "Mind Maps" when no map is active or the name is empty.
 *  - Updates live when the active map is renamed.
 *  - Updates live when the user switches to a different map.
 *
 * Fixture notes:
 *  - The single-map happy-path tests reuse the standard `test` fixture from
 *    fixtures.ts, which seeds a map named "my first map".
 *  - The rename and map-switch tests build a two-map seed so a second map is
 *    available without relying on the "New map" button (which would produce an
 *    untitled map and complicate assertions).
 *  - The fallback test seeds a map with an empty name so the active map exists
 *    but has no displayable title, exercising the "name is empty" fallback branch.
 */

import { test, expect, TEST_USER, makeMap, waitForPageReady } from './fixtures';

// ─── stable IDs ──────────────────────────────────────────────────────────────

const IDS = {
  mapA:  'title-map-a',
  mapB:  'title-map-b',
  nodeA: 'title-node-a',
  nodeB: 'title-node-b',
  mapEmpty: 'title-map-empty',
  nodeEmpty: 'title-node-empty',
};

// ─── two-map fixture ──────────────────────────────────────────────────────────

const twoMapTest = test.extend<{ page: import('@playwright/test').Page }>({
  page: async ({ page }, use) => {
    const state = {
      maps: {
        [IDS.mapA]: makeMap(IDS.mapA, 'Alpha Map', IDS.nodeA),
        [IDS.mapB]: makeMap(IDS.mapB, 'Beta Map',  IDS.nodeB),
      },
      mapOrder: [IDS.mapA, IDS.mapB],
    };
    await page.addInitScript((params) => {
      window.__PLAYWRIGHT_TEST_USER__ = params.user;
      localStorage.setItem('mindmaps_v2', JSON.stringify(params.state));
    }, { user: TEST_USER, state });

    await waitForPageReady(page);
    // Confirm the seed was picked up before running tests
    await page.locator('aside nav').getByText('Alpha Map', { exact: true }).waitFor();
    await use(page);
  },
});

// ─── empty-name fixture (map with blank name — fallback title test) ───────────

const emptyNameTest = test.extend<{ page: import('@playwright/test').Page }>({
  page: async ({ page }, use) => {
    // Seed an authenticated user with one map whose name is an empty string.
    // The App's useEffect resolves to an empty string after trim(), so it falls
    // back to the plain "Mind Maps" title — same code path as "no active map".
    const emptyMap = makeMap(IDS.mapEmpty, '', IDS.nodeEmpty);
    const state = {
      maps: { [IDS.mapEmpty]: emptyMap },
      mapOrder: [IDS.mapEmpty],
    };
    await page.addInitScript((params) => {
      window.__PLAYWRIGHT_TEST_USER__ = params.user;
      localStorage.setItem('mindmaps_v2', JSON.stringify(params.state));
    }, { user: TEST_USER, state });

    await waitForPageReady(page);
    await use(page);
  },
});

// ─── tests ────────────────────────────────────────────────────────────────────

test('happy path: page title includes the active map name on load', async ({ page }) => {
  // The standard fixture seeds a map named "my first map"
  await expect(page).toHaveTitle('Mind Maps — my first map');
});

emptyNameTest('fallback: page title is "Mind Maps" when the active map name is empty', async ({ page }) => {
  // The app has loaded (waitForPageReady confirmed the sidebar header), so the
  // useEffect has run. With an empty map name the title must be the plain fallback.
  await expect(page).toHaveTitle('Mind Maps');
});

twoMapTest('page title updates live when the active map is renamed', async ({ page }) => {
  // Verify title reflects the initial active map
  await expect(page).toHaveTitle('Mind Maps — Alpha Map');

  // Rename via double-click on the map item in the sidebar
  await page.locator('aside nav').getByText('Alpha Map', { exact: true }).dblclick();
  const renameInput = page.locator('aside nav input');
  await expect(renameInput).toBeVisible();
  await renameInput.fill('Renamed Alpha');
  await renameInput.press('Enter');

  // Title must reflect the new name
  await expect(page).toHaveTitle('Mind Maps — Renamed Alpha');
});

twoMapTest('page title updates live when switching to another map', async ({ page }) => {
  // Alpha Map is active by default (first in mapOrder)
  await expect(page).toHaveTitle('Mind Maps — Alpha Map');

  // Switch to Beta Map
  await page.locator('aside nav').getByText('Beta Map', { exact: true }).click();

  // Title must reflect the newly active map
  await expect(page).toHaveTitle('Mind Maps — Beta Map');
});
