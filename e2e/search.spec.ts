/**
 * E2E tests for global search in the sidebar (issue #5).
 *
 * Feature summary:
 *  - A search bar at the top of the sidebar accepts plain text and prefixed queries.
 *  - title:X  — filters map list to maps whose name contains X (no node hits shown).
 *  - node:X   — shows only maps with matching node text/notes; indented node-hit
 *               rows appear below each matching map entry.
 *  - label:X  — existing label filter (unchanged regression check).
 *  - Plain text — matches map names OR node text/notes; node-hit rows shown.
 *  - Empty query — shows all non-archived maps.
 *  - Clicking a node-hit row switches to that map (if different) and the matching
 *    node gets an amber highlight ring on the canvas.
 *
 * Fixture notes:
 *  - Three maps are seeded:
 *      "Project Alpha" — root node "Project Alpha", child node "budget review"
 *                        with notes "Q3 financials"
 *      "Work Notes"    — root node "Work Notes", labels: ['work']
 *      "Personal"      — root node "Personal", labels: ['personal']
 *  - "Project Alpha" is the active map on load (first in mapOrder).
 *  - The page-ready wait uses getByText('3 maps', { exact: true }) to avoid a
 *    strict-mode violation from the footer counting phrase.
 */

import { test as base, expect } from '@playwright/test';

// ─── stable IDs ──────────────────────────────────────────────────────────────

const TEST_USER = {
  uid: 'playwright-test-uid',
  email: 'test@playwright.local',
  displayName: 'Test User',
};

const IDS = {
  mapAlpha:      'search-map-alpha',
  mapWork:       'search-map-work',
  mapPersonal:   'search-map-personal',
  rootAlpha:     'search-node-root-alpha',
  childAlpha:    'search-node-child-alpha',
  rootWork:      'search-node-root-work',
  rootPersonal:  'search-node-root-personal',
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
              [params.childAlpha]: {
                id: params.childAlpha,
                label: 'budget review',
                notes: 'Q3 financials',
                x: 700, y: 400,
                parentId: params.rootAlpha, depth: 1, w: 110, h: 36,
              },
            },
            edges: [{ from: params.rootAlpha, to: params.childAlpha }],
            links: [],
            tx: 0, ty: 0, scale: 1,
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
            tx: 0, ty: 0, scale: 1,
            labels: ['work'],
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
            tx: 0, ty: 0, scale: 1,
            labels: ['personal'],
          },
        },
        mapOrder: [params.mapAlpha, params.mapWork, params.mapPersonal],
      };
      localStorage.setItem('mindmaps_v2', JSON.stringify(state));
    }, { user: TEST_USER, ...IDS });

    await page.goto('/');
    // Use exact:true to avoid matching "3 maps" inside a longer phrase.
    await page.getByText('3 maps', { exact: true }).waitFor();
    await use(page);
  },
});

// ─── helpers ─────────────────────────────────────────────────────────────────

const searchInput = (page: import('@playwright/test').Page) =>
  page.locator('aside input[aria-label="Search maps"]');

// ─── 1. Empty query shows all non-archived maps (regression) ─────────────────

test('empty query — all non-archived maps are shown', async ({ page }) => {
  // Ensure the search box is empty and all three maps are visible
  await expect(page.locator('aside nav').getByText('Project Alpha', { exact: true })).toBeVisible();
  await expect(page.locator('aside nav').getByText('Work Notes', { exact: true })).toBeVisible();
  await expect(page.locator('aside nav').getByText('Personal', { exact: true })).toBeVisible();
});

// ─── 2. Plain text finds maps by name ────────────────────────────────────────

test('plain text — finds map by name and hides non-matching maps', async ({ page }) => {
  await searchInput(page).fill('project');

  await expect(page.locator('aside nav').getByTitle('Project Alpha')).toBeVisible();
  await expect(page.locator('aside nav').getByTitle('Work Notes')).not.toBeVisible();
  await expect(page.locator('aside nav').getByTitle('Personal')).not.toBeVisible();
});

// ─── 3. Plain text also finds maps by node text ───────────────────────────────

test('plain text — finds map by node label text', async ({ page }) => {
  await searchInput(page).fill('budget');

  // Project Alpha has a child node with label "budget review"
  await expect(page.locator('aside nav').getByText('Project Alpha', { exact: true })).toBeVisible();
  await expect(page.locator('aside nav').getByText('Work Notes', { exact: true })).not.toBeVisible();
  await expect(page.locator('aside nav').getByText('Personal', { exact: true })).not.toBeVisible();
});

test('plain text — node hit rows appear below the matching map', async ({ page }) => {
  await searchInput(page).fill('budget');

  // A node-hit row with the text "budget review" should appear below Project Alpha
  await expect(page.locator('aside').getByText('budget review', { exact: true })).toBeVisible();
});

test('plain text — finds map by node notes text', async ({ page }) => {
  await searchInput(page).fill('financials');

  // The notes "Q3 financials" are in Project Alpha's child node
  await expect(page.locator('aside nav').getByText('Project Alpha', { exact: true })).toBeVisible();
  await expect(page.locator('aside nav').getByText('Work Notes', { exact: true })).not.toBeVisible();
});

// ─── 4. title: prefix filters maps by name only (no node hits shown) ─────────

test('title: prefix — shows only maps whose name matches', async ({ page }) => {
  await searchInput(page).fill('title:alpha');

  await expect(page.locator('aside nav').getByText('Project Alpha', { exact: true })).toBeVisible();
  await expect(page.locator('aside nav').getByText('Work Notes', { exact: true })).not.toBeVisible();
  await expect(page.locator('aside nav').getByText('Personal', { exact: true })).not.toBeVisible();
});

test('title: prefix — does not surface maps matched only by node text', async ({ page }) => {
  // "budget review" is a node label, NOT the map name; title: should not match
  await searchInput(page).fill('title:budget');

  await expect(page.locator('aside nav').getByText('Project Alpha', { exact: true })).not.toBeVisible();
  await expect(page.locator('aside nav').getByText('Work Notes', { exact: true })).not.toBeVisible();
  await expect(page.locator('aside nav').getByText('Personal', { exact: true })).not.toBeVisible();
});

test('title: prefix — does not show node hit rows', async ({ page }) => {
  await searchInput(page).fill('title:alpha');

  // No indented node-hit rows should appear (title: suppresses them)
  // Node hit buttons are rendered as <button> inside .itemWrap with nodeHit class;
  // the text "budget review" must not appear in the sidebar
  await expect(page.locator('aside').getByText('budget review', { exact: true })).not.toBeVisible();
});

// ─── 5. node: prefix shows node hit rows for maps with matching nodes ─────────

test('node: prefix — shows map with matching node text', async ({ page }) => {
  await searchInput(page).fill('node:budget');

  await expect(page.locator('aside nav').getByText('Project Alpha', { exact: true })).toBeVisible();
  await expect(page.locator('aside nav').getByText('Work Notes', { exact: true })).not.toBeVisible();
});

test('node: prefix — shows indented node hit row under the matching map', async ({ page }) => {
  await searchInput(page).fill('node:budget');

  await expect(page.locator('aside').getByText('budget review', { exact: true })).toBeVisible();
});

test('node: prefix — does not show map matched only by name when node does not match', async ({ page }) => {
  // "notes" appears in the map name "Work Notes" but not in any node label/notes
  // of Project Alpha. With node: prefix only node-text matches count.
  await searchInput(page).fill('node:alpha');

  // "Project Alpha" node label matches — map should be visible
  await expect(page.locator('aside nav').getByTitle('Project Alpha')).toBeVisible();
  // "Work Notes" map name doesn't match any node text containing "alpha"
  await expect(page.locator('aside nav').getByTitle('Work Notes')).not.toBeVisible();
});

test('node: prefix — matches notes field as well as label', async ({ page }) => {
  await searchInput(page).fill('node:financials');

  // "Q3 financials" is in notes — map should appear
  await expect(page.locator('aside nav').getByText('Project Alpha', { exact: true })).toBeVisible();
});

// ─── 6. Clicking a node hit switches to that map and highlights the node ──────

test('clicking a node hit row on the active map — matching node gets highlighted on canvas', async ({ page }) => {
  // Project Alpha is already active; search for a node within it
  await searchInput(page).fill('budget');

  // Click the node-hit row
  const nodeHitBtn = page.locator('aside').getByText('budget review', { exact: true });
  await nodeHitBtn.click();

  // The canvas should show a highlight ring (amber stroke) for the matching node.
  // The highlight rect is rendered as a <rect> with stroke="#F39C12" or "#1D9E75"
  // immediately before the regular node rect inside the same <g>.
  // We check for the presence of any highlighted rect in the SVG.
  await expect(page.locator('svg rect[stroke="#F39C12"], svg rect[stroke="#1D9E75"]').first()).toBeVisible();
});

test('clicking a node hit row on a different map — switches active map', async ({ page }) => {
  // Start on Project Alpha (already active).
  // Search for something that only appears in Work Notes map name, but
  // to trigger a cross-map node click we need a node hit in another map.
  // "Work Notes" node label is the root of the Work Notes map.
  await searchInput(page).fill('Work Notes');

  // The node hit row "Work Notes" should appear (root node label matches plain-text)
  const nodeHitRows = page.locator('aside button', { hasText: 'Work Notes' });
  // There may be both a map entry and a node hit row; click the node hit button
  // (it is a <button> element, not a <div>)
  await nodeHitRows.first().click();

  // After clicking, the Work Notes map becomes active — its root node should be
  // visible on the canvas with the data-node-id attribute.
  await expect(page.locator('[data-node-id]')).toBeVisible();
  // The canvas should now render the Work Notes root node text
  const nodeTexts = await page.locator('[data-node-id] text').allTextContents();
  const combined = nodeTexts.join(' ');
  expect(combined.toLowerCase()).toContain('work');
});

// ─── 7. Keyboard navigation (↑/↓/Enter) ─────────────────────────────────────

test('ArrowDown + Enter selects a map from the result list', async ({ page }) => {
  // Type a query that matches only "Work Notes" by name so the first (and only)
  // result item is the map row for Work Notes.
  await searchInput(page).fill('work');

  // Project Alpha is currently active; Work Notes map should be the first result item.
  // Press ArrowDown once to move focus to index 0 (the "Work Notes" map row).
  await searchInput(page).press('ArrowDown');

  // Press Enter — should activate the Work Notes map.
  await searchInput(page).press('Enter');

  // After activation the Work Notes map becomes active; its root node text should
  // appear on the canvas.
  await expect(page.locator('[data-node-id]')).toBeVisible();
  const nodeTexts = await page.locator('[data-node-id] text').allTextContents();
  expect(nodeTexts.join(' ').toLowerCase()).toContain('work');
});

test('ArrowDown navigates through map + node hit rows and Enter activates node hit', async ({ page }) => {
  // "budget" matches Project Alpha by node label — produces one map row + one node-hit row.
  await searchInput(page).fill('budget');

  // Index 0 → map row "Project Alpha"
  // Index 1 → node-hit row "budget review"
  // Press ArrowDown twice to reach the node-hit row.
  await searchInput(page).press('ArrowDown');
  await searchInput(page).press('ArrowDown');

  // Press Enter — should focus the node (canvas highlight ring should appear).
  await searchInput(page).press('Enter');

  await expect(page.locator('svg rect[stroke="#F39C12"], svg rect[stroke="#1D9E75"]').first()).toBeVisible();
});

// ─── 8. label: prefix still works (regression) ───────────────────────────────

test('label:work — shows only maps with the work label', async ({ page }) => {
  await searchInput(page).fill('label:work');

  await expect(page.locator('aside nav').getByText('Work Notes', { exact: true })).toBeVisible();
  await expect(page.locator('aside nav').getByText('Project Alpha', { exact: true })).not.toBeVisible();
  await expect(page.locator('aside nav').getByText('Personal', { exact: true })).not.toBeVisible();
});

test('label:personal — shows only maps with the personal label', async ({ page }) => {
  await searchInput(page).fill('label:personal');

  await expect(page.locator('aside nav').getByText('Personal', { exact: true })).toBeVisible();
  await expect(page.locator('aside nav').getByText('Work Notes', { exact: true })).not.toBeVisible();
  await expect(page.locator('aside nav').getByText('Project Alpha', { exact: true })).not.toBeVisible();
});

test('label: prefix — does not produce node hit rows', async ({ page }) => {
  // label:work matches Work Notes; no node content in Work Notes matches "work"
  // in a surprising way, but more importantly label: should suppress node hits
  await searchInput(page).fill('label:work');

  // budget review is in Project Alpha which is not matched — must not be visible
  await expect(page.locator('aside').getByText('budget review', { exact: true })).not.toBeVisible();
});

// ─── 9. Escape key clears the search query ───────────────────────────────────

test('pressing Escape clears the search and restores all maps', async ({ page }) => {
  await searchInput(page).fill('alpha');

  // Only Project Alpha visible
  await expect(page.locator('aside nav').getByText('Work Notes', { exact: true })).not.toBeVisible();

  await searchInput(page).press('Escape');

  // All maps restored
  await expect(page.locator('aside nav').getByText('Project Alpha', { exact: true })).toBeVisible();
  await expect(page.locator('aside nav').getByText('Work Notes', { exact: true })).toBeVisible();
  await expect(page.locator('aside nav').getByText('Personal', { exact: true })).toBeVisible();
});
