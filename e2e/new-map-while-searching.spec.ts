/**
 * E2E tests for issue #89: New map doesn't show in the list when a search
 * criteria is entered.
 *
 * Fix: handleNewMap() in Sidebar.tsx now calls setSearchQuery('') and
 * setFocusedResultIndex(-1) before creating the map, so the new map is always
 * visible and immediately enters inline rename mode.
 *
 * Fixture: Three maps are seeded (reusing the same pattern as search.spec.ts):
 *   "Project Alpha" — used as the currently active map
 *   "Work Notes"
 *   "Personal"
 *
 * Tests:
 *  1. Happy path — create new map while a search query is active:
 *     (a) search input is cleared
 *     (b) new map row is visible in the list
 *     (c) new map is in inline rename mode (the rename input is focused)
 *  2. Regression — creating a new map with no active search still works:
 *     new map appears + enters rename mode (the fix is a no-op when search is empty).
 */

import { test as base, expect } from '@playwright/test';

// ─── stable IDs ──────────────────────────────────────────────────────────────

const TEST_USER = {
  uid: 'playwright-test-uid',
  email: 'test@playwright.local',
  displayName: 'Test User',
};

const IDS = {
  mapAlpha:    'nm-search-map-alpha',
  mapWork:     'nm-search-map-work',
  mapPersonal: 'nm-search-map-personal',
  rootAlpha:   'nm-search-node-root-alpha',
  rootWork:    'nm-search-node-root-work',
  rootPersonal:'nm-search-node-root-personal',
};

// ─── fixture ─────────────────────────────────────────────────────────────────

const test = base.extend<{ page: import('@playwright/test').Page }>({
  page: async ({ page }, use) => {
    await page.addInitScript((params) => {
      window.__PLAYWRIGHT_TEST_USER__ = params.user;

      const state = {
        maps: {
          [params.mapAlpha]: {
            id: params.mapAlpha,
            name: 'Project Alpha',
            nodes: {
              [params.rootAlpha]: {
                id: params.rootAlpha,
                label: 'Project Alpha',
                x: 500, y: 300,
                parentId: null, depth: 0, w: 120, h: 36,
              },
            },
            edges: [],
            links: [],
            tx: 0, ty: 0, scale: 0.999,
            labels: [],
          },
          [params.mapWork]: {
            id: params.mapWork,
            name: 'Work Notes',
            nodes: {
              [params.rootWork]: {
                id: params.rootWork,
                label: 'Work Notes',
                x: 500, y: 300,
                parentId: null, depth: 0, w: 100, h: 36,
              },
            },
            edges: [],
            links: [],
            tx: 0, ty: 0, scale: 0.999,
            labels: [],
          },
          [params.mapPersonal]: {
            id: params.mapPersonal,
            name: 'Personal',
            nodes: {
              [params.rootPersonal]: {
                id: params.rootPersonal,
                label: 'Personal',
                x: 500, y: 300,
                parentId: null, depth: 0, w: 90, h: 36,
              },
            },
            edges: [],
            links: [],
            tx: 0, ty: 0, scale: 0.999,
            labels: [],
          },
        },
        mapOrder: [params.mapAlpha, params.mapWork, params.mapPersonal],
      };
      localStorage.setItem('mindmaps_v2', JSON.stringify(state));
    }, { user: TEST_USER, ...IDS });

    await page.goto('/');
    // Wait until all 3 maps are listed before each test.
    await page.getByText('3 maps', { exact: true }).waitFor();
    await use(page);
  },
});

// ─── helpers ─────────────────────────────────────────────────────────────────

const searchInput = (page: import('@playwright/test').Page) =>
  page.locator('aside input[aria-label="Search maps"]');

// The inline rename input is the only <input> inside aside nav at any given time.
const renameInput = (page: import('@playwright/test').Page) =>
  page.locator('aside nav input');

// ─── 1. Happy path — create new map while a search query is active ────────────

test('creating a new map while search is active clears the query', async ({ page }) => {
  // Type a query that hides most maps (only "Project Alpha" would match "alpha").
  await searchInput(page).fill('alpha');
  await expect(page.locator('aside nav').getByText('Work Notes', { exact: true })).not.toBeVisible();

  // Click + New map.
  await page.getByTitle('New map').click();

  // (a) The search input value must be cleared.
  await expect(searchInput(page)).toHaveValue('');
});

test('creating a new map while search is active makes the new map visible', async ({ page }) => {
  // Type a query that filters the list to just "Work Notes".
  await searchInput(page).fill('work');
  await expect(page.locator('aside nav').getByText('Project Alpha', { exact: true })).not.toBeVisible();
  await expect(page.locator('aside nav').getByText('Personal', { exact: true })).not.toBeVisible();

  // Click + New map.
  await page.getByTitle('New map').click();

  // (b) The new map row must be visible — the rename input is present.
  await expect(renameInput(page)).toBeVisible();
  // (b) Previously hidden maps are also visible again (search cleared).
  await expect(page.locator('aside nav').getByText('Project Alpha', { exact: true })).toBeVisible();
  await expect(page.locator('aside nav').getByText('Personal', { exact: true })).toBeVisible();
});

test('creating a new map while search is active puts the new map into inline rename mode', async ({ page }) => {
  // Type a query that filters the list to just "Personal".
  await searchInput(page).fill('personal');
  await expect(page.locator('aside nav').getByText('Work Notes', { exact: true })).not.toBeVisible();

  // Click + New map.
  await page.getByTitle('New map').click();

  // (c) Rename input must be present and focused so the user can type a name immediately.
  const ri = renameInput(page);
  await expect(ri).toBeVisible();
  await expect(ri).toBeFocused();
});

test('full happy path — new map created while searching can be renamed and is visible after commit', async ({ page }) => {
  // Type a query that filters away most maps.
  await searchInput(page).fill('alpha');

  // Create a new map.
  await page.getByTitle('New map').click();

  // Search is cleared, rename input is ready.
  await expect(searchInput(page)).toHaveValue('');
  const ri = renameInput(page);
  await expect(ri).toBeVisible();
  await expect(ri).toBeFocused();

  // Type a name and commit.
  await ri.clear();
  await ri.type('Brand New Map');
  await ri.press('Enter');

  // The new map must be visible in the list.
  await expect(page.locator('aside nav').getByText('Brand New Map', { exact: true })).toBeVisible();
  // Footer count reflects the new total (4 maps).
  await expect(page.locator('aside').getByText('4 maps', { exact: true })).toBeVisible();
});

// ─── 2. Regression — creating a new map with no active search still works ─────

test('creating a new map with no active search still enters rename mode', async ({ page }) => {
  // Ensure the search input is empty (default state).
  await expect(searchInput(page)).toHaveValue('');

  // Click + New map.
  await page.getByTitle('New map').click();

  // Rename input must be visible and focused (behaviour unchanged).
  const ri = renameInput(page);
  await expect(ri).toBeVisible();
  await expect(ri).toBeFocused();
});

test('creating a new map with no active search still shows the new map', async ({ page }) => {
  await page.getByTitle('New map').click();

  // All previously visible maps plus the rename input for the new map.
  await expect(renameInput(page)).toBeVisible();
  await expect(page.locator('aside nav').getByText('Project Alpha', { exact: true })).toBeVisible();
  await expect(page.locator('aside nav').getByText('Work Notes', { exact: true })).toBeVisible();
  await expect(page.locator('aside nav').getByText('Personal', { exact: true })).toBeVisible();
});
