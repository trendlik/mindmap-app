/**
 * E2E tests for archive/unarchive mind maps (issue #7).
 *
 * Feature summary:
 *  - Active map items expose a hover-reveal "Archive map" button.
 *  - Archiving removes the map from the active list and adds it to a
 *    collapsible "Archived (N)" section below (collapsed by default).
 *  - Archived items expose a hover-reveal "Unarchive map" button.
 *  - Footer shows "X maps (Y archived)" when Y > 0.
 *  - "label:archived" in the search box shows only archived maps.
 *  - Plain text search never surfaces archived maps.
 *  - Clicking an archived item in the expanded section does NOT navigate to it.
 *
 * Fixture notes:
 *  - Most tests need two maps so archive/footer counts are meaningful and the
 *    sidebar behaves correctly (Delete button only shown when >1 map exists).
 *  - Page-ready wait uses getByText('maps').first() (sidebar header) plus a
 *    nav-scoped wait for a map name — the same pattern as fixtures.ts.
 *  - Archive button is opacity:0 until hover; Playwright's hover() forces CSS
 *    :hover state so the button becomes interactable even while visually hidden.
 *  - Archived items have no onSelect handler, so clicking one must not change
 *    the active canvas map.
 */

import { test as base, expect } from '@playwright/test';
import { TEST_USER, makeMap, waitForPageReady } from './fixtures';

// ─── stable IDs ──────────────────────────────────────────────────────────────

const IDS = {
  mapA:     'archive-map-a',
  mapB:     'archive-map-b',
  nodeA:    'archive-node-a',
  nodeB:    'archive-node-b',
};

// ─── two-map fixture (both maps active, mapA is the selected map) ─────────────

const twoMapTest = base.extend<{ page: import('@playwright/test').Page }>({
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
    // Also wait for a specific map name to confirm the two-map seed was picked up.
    await page.locator('aside nav').getByText('Alpha Map', { exact: true }).waitFor();
    await use(page);
  },
});

// ─── helpers ─────────────────────────────────────────────────────────────────

/** Returns the name span of an active list item (scoped to <nav>). */
const activeItem = (page: import('@playwright/test').Page, name: string) =>
  page.locator('aside nav').getByText(name, { exact: true });

/** Hovers the active item and clicks its "Archive map" button. */
async function archiveMap(page: import('@playwright/test').Page, name: string) {
  const nameSpan = activeItem(page, name);
  await nameSpan.hover();
  const archiveBtn = nameSpan.locator('..').getByTitle('Archive map');
  await archiveBtn.click();
}

/** Returns the "Archived (N)" collapsible header button. */
const archivedHeader = (page: import('@playwright/test').Page) =>
  page.locator('aside').getByRole('button', { name: /^Archived \(\d+\)$/ });

// ─── tests ────────────────────────────────────────────────────────────────────

twoMapTest('archive a map — it disappears from the active list and "Archived (1)" header appears',
  async ({ page }) => {
    await archiveMap(page, 'Alpha Map');

    // Alpha Map should no longer appear in the active nav
    await expect(page.locator('aside nav').getByText('Alpha Map', { exact: true })).not.toBeVisible();

    // The archived section header should appear
    await expect(archivedHeader(page)).toBeVisible();
    await expect(archivedHeader(page)).toContainText('Archived (1)');
  }
);

twoMapTest('archived section is collapsed by default — map name inside is not visible',
  async ({ page }) => {
    await archiveMap(page, 'Alpha Map');

    // Header visible but the map name inside the collapsed list must not be visible
    await expect(archivedHeader(page)).toBeVisible();
    // The archivedList div is only rendered when archivedOpen === true
    await expect(page.locator('aside').getByText('Alpha Map', { exact: true })).not.toBeVisible();
  }
);

twoMapTest('expand archived section — clicking the header reveals the archived map name',
  async ({ page }) => {
    await archiveMap(page, 'Alpha Map');

    // Expand
    await archivedHeader(page).click();

    // Now the archived map name should be visible inside the expanded section
    await expect(page.locator('aside').getByText('Alpha Map', { exact: true })).toBeVisible();
  }
);

twoMapTest('unarchive a map — it returns to the active list and the archived section disappears',
  async ({ page }) => {
    await archiveMap(page, 'Alpha Map');
    await archivedHeader(page).click();

    // Hover the archived item and click "Unarchive map"
    const archivedName = page.locator('aside').getByText('Alpha Map', { exact: true });
    await archivedName.hover();
    const restoreBtn = archivedName.locator('..').getByTitle('Unarchive map');
    await restoreBtn.click();

    // Map returns to the active list
    await expect(activeItem(page, 'Alpha Map')).toBeVisible();

    // Archived section disappears (no archived maps left)
    await expect(archivedHeader(page)).not.toBeAttached();
  }
);

twoMapTest('footer shows "2 maps (1 archived)" after archiving one of two maps',
  async ({ page }) => {
    await archiveMap(page, 'Alpha Map');

    // Footer must contain the combined count text
    await expect(page.locator('aside').getByText('2 maps', { exact: false }))
      .toContainText('2 maps');
    await expect(page.locator('aside').getByText('1 archived', { exact: false }))
      .toBeVisible();
  }
);

twoMapTest('"label:archived" search shows only archived maps',
  async ({ page }) => {
    await archiveMap(page, 'Alpha Map');

    // Type "label:archived" into the search box
    const searchInput = page.locator('aside input[aria-label="Search maps"]');
    await searchInput.fill('label:archived');

    // Alpha Map (archived) should now appear
    await expect(page.locator('aside').getByText('Alpha Map', { exact: true })).toBeVisible();

    // Beta Map (active) should not appear in the search results
    await expect(page.locator('aside nav').getByText('Beta Map', { exact: true })).not.toBeVisible();
  }
);

twoMapTest('plain text search does not surface archived maps',
  async ({ page }) => {
    await archiveMap(page, 'Alpha Map');

    // Search for part of the archived map's name
    const searchInput = page.locator('aside input[aria-label="Search maps"]');
    await searchInput.fill('alpha');

    // Alpha Map must NOT appear in the active nav — archived maps are excluded
    await expect(page.locator('aside nav').getByText('Alpha Map', { exact: true })).not.toBeVisible();

    // The archived section header is still visible (it is always visible when
    // archived maps exist, regardless of the search query)
    await expect(archivedHeader(page)).toBeVisible();
  }
);

twoMapTest('clicking an archived item in the expanded section does not change the active map',
  async ({ page }) => {
    // Select Beta Map first to establish a known active map
    await activeItem(page, 'Beta Map').click();
    // Wait for Beta Map to become active (active item has a distinct background
    // class; we verify the canvas root node label instead, which is cheaper)
    await expect(page.locator('[data-node-id]')).toBeVisible();

    // Capture the current canvas title before any archive interaction
    const canvasBefore = await page.locator('[data-node-id]').first().textContent();

    // Archive Alpha Map and expand the archived section
    await archiveMap(page, 'Alpha Map');
    await archivedHeader(page).click();

    // Click the archived item
    const archivedName = page.locator('aside').getByText('Alpha Map', { exact: true });
    await archivedName.click();

    // The canvas must still show the same map as before
    const canvasAfter = await page.locator('[data-node-id]').first().textContent();
    expect(canvasAfter).toBe(canvasBefore);
  }
);
