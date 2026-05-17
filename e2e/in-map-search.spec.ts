/**
 * E2E tests for in-map search (issue #24).
 *
 * Feature summary:
 *  - Cmd/Ctrl+F opens a floating search bar overlaid on the canvas.
 *  - Typing highlights all nodes whose label, notes, or link URL contains the query.
 *  - A match count badge ("N matches") is shown when the query is non-empty.
 *  - Escape or the ✕ button closes the bar and clears the query.
 *  - The in-map search operates independently of the sidebar global search.
 *
 * Fixture: one map ("Project Alpha") with three nodes:
 *   root  — label "Project Alpha"
 *   child — label "budget review", notes "Q3 financials"
 *   link  — label "Company Site", link "https://example.com"
 *
 * Note: Cmd/Ctrl+F is intercepted by Chromium at the browser-chrome level before
 * the page's JS keydown listener fires. To reliably test the handler we dispatch
 * a synthetic KeyboardEvent on window via page.evaluate(), which mirrors exactly
 * what the browser would deliver to the page after its own handling.
 */

import { test as base, expect, type Page } from '@playwright/test';

const TEST_USER = {
  uid: 'playwright-test-uid',
  email: 'test@playwright.local',
  displayName: 'Test User',
};

const IDS = {
  mapAlpha:   'inmap-map-alpha',
  rootAlpha:  'inmap-node-root',
  childAlpha: 'inmap-node-child',
  linkNode:   'inmap-node-link',
};

const test = base.extend<{ page: Page }>({
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
              [params.childAlpha]: {
                id: params.childAlpha,
                label: 'budget review',
                notes: 'Q3 financials',
                x: 700, y: 420,
                parentId: params.rootAlpha, depth: 1, w: 110, h: 36,
              },
              [params.linkNode]: {
                id: params.linkNode,
                label: 'Company Site',
                link: 'https://example.com',
                x: 700, y: 500,
                parentId: params.rootAlpha, depth: 1, w: 110, h: 36,
              },
            },
            edges: [
              { from: params.rootAlpha, to: params.childAlpha },
              { from: params.rootAlpha, to: params.linkNode },
            ],
            links: [],
            // Use 0.999 to avoid auto-fitView race condition
            tx: 0, ty: 0, scale: 0.999,
            labels: [],
          },
        },
        mapOrder: [params.mapAlpha],
      };
      localStorage.setItem('mindmaps_v2', JSON.stringify(state));
    }, { user: TEST_USER, ...IDS });

    await page.goto('/');
    // Wait for the keyboard handler useEffect to have registered its listeners.
    // React schedules effects asynchronously after DOM commit, so waiting for
    // [data-node-id] alone (DOM commit) is not sufficient — effects may not have
    // run yet. The svg[data-handlers-ready] attribute is set inside the effect,
    // so its presence guarantees Cmd+F events will be handled.
    await page.locator('svg[data-handlers-ready]').waitFor();
    await use(page);
  },
});

// ─── helpers ─────────────────────────────────────────────────────────────────

const inMapSearchInput = (page: Page) =>
  page.locator('input[placeholder="Search in this map…"]');

/** Simulate Cmd/Ctrl+F as a synthetic window keydown event.
 *  page.keyboard.press('Meta+f') is intercepted by Chromium's browser chrome
 *  (find bar) before reaching the page's JS listeners. Dispatching directly on
 *  window bypasses that and exactly mirrors what the page handler would see. */
async function pressSearchShortcut(page: Page) {
  await page.evaluate(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'f', code: 'KeyF', metaKey: true, ctrlKey: false,
      bubbles: true, cancelable: true,
    }));
  });
}

// ─── 1. Open / close ─────────────────────────────────────────────────────────

test('Cmd+F opens the in-map search bar', async ({ page }) => {
  await expect(inMapSearchInput(page)).not.toBeVisible();
  await pressSearchShortcut(page);
  await expect(inMapSearchInput(page)).toBeVisible();
});

test('Escape closes the in-map search bar', async ({ page }) => {
  await pressSearchShortcut(page);
  await expect(inMapSearchInput(page)).toBeVisible();
  // Press Escape on the input element (its own onKeyDown calls stopPropagation + close)
  await inMapSearchInput(page).press('Escape');
  await expect(inMapSearchInput(page)).not.toBeVisible();
});

test('close button (✕) closes the in-map search bar', async ({ page }) => {
  await pressSearchShortcut(page);
  await expect(inMapSearchInput(page)).toBeVisible();
  await page.getByRole('button', { name: 'Close search' }).click();
  await expect(inMapSearchInput(page)).not.toBeVisible();
});

// ─── 2. Highlighting ──────────────────────────────────────────────────────────

test('typing a query highlights matching nodes', async ({ page }) => {
  await pressSearchShortcut(page);
  await inMapSearchInput(page).fill('budget');
  await expect(page.locator('svg rect[stroke="#F39C12"]')).toBeVisible();
});

test('query with no matches shows no highlight rings', async ({ page }) => {
  await pressSearchShortcut(page);
  await inMapSearchInput(page).fill('zzznomatch');
  await expect(page.locator('svg rect[stroke="#F39C12"]')).not.toBeVisible();
});

test('closing the search bar removes highlights', async ({ page }) => {
  await pressSearchShortcut(page);
  await inMapSearchInput(page).fill('budget');
  await expect(page.locator('svg rect[stroke="#F39C12"]')).toBeVisible();
  await inMapSearchInput(page).press('Escape');
  await expect(page.locator('svg rect[stroke="#F39C12"]')).not.toBeVisible();
});

// ─── 3. Match count ───────────────────────────────────────────────────────────

test('match count badge shows "1 match" for one matching node', async ({ page }) => {
  await pressSearchShortcut(page);
  await inMapSearchInput(page).fill('budget');
  await expect(page.getByText('1 match', { exact: true })).toBeVisible();
});

test('match count badge shows plural for multiple matches', async ({ page }) => {
  await pressSearchShortcut(page);
  // 'e' appears in "Project Alpha" (Proj_e_ct), "budget r_e_view", and "Company Sit_e" — 3 matches
  await inMapSearchInput(page).fill('e');
  const countEl = page.locator('[class*="inMapSearchCount"]');
  await expect(countEl).toBeVisible();
  const text = await countEl.textContent();
  expect(text).toMatch(/matches/);
});

test('match count badge is not shown when query is empty', async ({ page }) => {
  await pressSearchShortcut(page);
  await expect(page.locator('[class*="inMapSearchCount"]')).not.toBeVisible();
});

// ─── 4. Searchable fields ─────────────────────────────────────────────────────

test('searches node notes field', async ({ page }) => {
  await pressSearchShortcut(page);
  await inMapSearchInput(page).fill('financials');
  // "Q3 financials" is in the notes of "budget review"
  await expect(page.locator('svg rect[stroke="#F39C12"]')).toBeVisible();
  await expect(page.getByText('1 match', { exact: true })).toBeVisible();
});

test('searches node link/URL field', async ({ page }) => {
  await pressSearchShortcut(page);
  await inMapSearchInput(page).fill('example.com');
  // "https://example.com" is the link on "Company Site"
  await expect(page.locator('svg rect[stroke="#F39C12"]')).toBeVisible();
  await expect(page.getByText('1 match', { exact: true })).toBeVisible();
});

// ─── 5. Independence from global search ──────────────────────────────────────

test('in-map search does not affect the sidebar search input', async ({ page }) => {
  const sidebarSearch = page.locator('aside input[aria-label="Search maps"]');
  await pressSearchShortcut(page);
  await inMapSearchInput(page).fill('budget');
  await expect(sidebarSearch).toHaveValue('');
});
