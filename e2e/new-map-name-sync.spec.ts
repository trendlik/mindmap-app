/**
 * E2E tests for issue #96: when a new map is created, the title shown in the
 * sidebar and the new map's root node label must end up the same, and the
 * app must actually switch to (and stay on) the newly created map.
 *
 * Fix summary:
 *  - src/App.tsx: the `[maps]` hash-sync effect (which applies deep links
 *    like `#mapId` on load) used to re-run and revert the active map back to
 *    whatever the URL hash still pointed at every time `maps` changed —
 *    including immediately after creating a new map, before the
 *    `[activeMapId]` effect had a chance to rewrite the hash. An earlier
 *    version of the fix gated this with a one-shot `initialHashMapSyncDone`
 *    ref, but that was insufficient: on a cold load with no hash in the URL
 *    it would never arm, so the very first "New map" click afterwards was
 *    misread as *the* initial deep link and mishandled. The actual fix
 *    instead captures `location.hash` itself (map id + node id) into a
 *    `pendingDeepLink` ref at first render — before any effect can rewrite
 *    `location.hash` — and consumes it once the deep-linked map
 *    becomes available in `maps`, so it only ever applies a *real* deep link
 *    and never fights a later in-app map switch such as "New map".
 *  - src/store/useMindMapStore.ts: `renameMap(mapId, name, syncRootLabel)` —
 *    when `syncRootLabel` is true, also updates the root node's (parentId
 *    === null) label to the new name, but only while the root's label still
 *    equals the map's pre-rename name (divergence guard). One
 *    `updateMapWithUndo` call covers both edits.
 *  - src/components/Sidebar.tsx: `handleNewMap` starts the post-creation
 *    inline rename with `isNewMap = true`, so `commitRename` passes
 *    `syncRootLabel: true` only for that one rename. The ordinary
 *    double-click rename path always passes `false`.
 *
 * Fixture: two named maps are seeded so a bounce-back to the previously
 * active map is detectable (test 2 would otherwise not distinguish "stayed
 * on new map" from "reverted to some other single map").
 *   "Alpha Map" (root label "Alpha Map") — active map, first key in `maps`
 *   "Beta Map"  (root label "Beta Map")
 *
 * Tests:
 *  1. Happy path — create a new map, rename it to "Roadmap" via the inline
 *     rename input. Sidebar row and canvas root node both read "Roadmap".
 *  2. `renamingNewMap` reset — after the creation rename commits, renaming
 *     that SAME map again must NOT touch its root node a second time.
 *  3. Focus switch (the actual regression) — clicking "New map" must switch
 *     to, and stay on, the new map: canvas shows a single root node labelled
 *     "new map" (not "Alpha Map"), and `location.hash` is the new map's id.
 *     Under the pre-fix code this reverts back to "Alpha Map" / its hash.
 *  4. Later rename of a DIFFERENT existing map does NOT touch its root node —
 *     only the creation-time rename propagates.
 *  5. Escape (and, separately, a whitespace-only name) during the creation
 *     rename commits nothing: both the map name and its root node stay
 *     "new map".
 */

import { test as base, expect, type Page } from '@playwright/test';
import { TEST_USER, makeMap, waitForPageReady, CANVAS_EDIT_SELECTOR } from './fixtures';

// ─── stable IDs ──────────────────────────────────────────────────────────────

const IDS = {
  mapAlpha: 'nms-map-alpha',
  mapBeta:  'nms-map-beta',
  nodeAlpha: 'nms-node-alpha',
  nodeBeta:  'nms-node-beta',
};

// ─── two-map fixture ("Alpha Map" is active, first key in `maps`) ─────────────

const test = base.extend<{ page: Page }>({
  page: async ({ page }, use) => {
    const state = {
      maps: {
        [IDS.mapAlpha]: makeMap(IDS.mapAlpha, 'Alpha Map', IDS.nodeAlpha),
        [IDS.mapBeta]:  makeMap(IDS.mapBeta,  'Beta Map',  IDS.nodeBeta),
      },
      mapOrder: [IDS.mapAlpha, IDS.mapBeta],
    };
    await page.addInitScript((params) => {
      window.__PLAYWRIGHT_TEST_USER__ = params.user;
      localStorage.setItem('mindmaps_v2', JSON.stringify(params.state));
    }, { user: TEST_USER, state });

    await waitForPageReady(page);
    // Confirm the two-map seed was picked up before each test runs.
    await page.locator('aside nav').getByText('Alpha Map', { exact: true }).waitFor();
    await use(page);
  },
});

// ─── helpers ─────────────────────────────────────────────────────────────────

/** The inline rename input is the only <input> inside <aside nav> at any given time. */
const renameInput = (page: Page) => page.locator('aside nav input');

/** Root/only node rendered on the SVG canvas, scoped away from the sidebar text. */
const canvasNode = (page: Page) => page.locator('svg [data-node-id]');

/** Reads the seeded/created maps back out of localStorage. */
async function readMapsState(page: Page): Promise<{ maps: Record<string, { id: string; name: string; nodes: Record<string, { id: string; label: string; parentId: string | null }> }>; mapOrder: string[] }> {
  return page.evaluate(() => JSON.parse(localStorage.getItem('mindmaps_v2') as string));
}

/** Finds the id of the newly created map (name === 'new map', not one of the seeded ids). */
function findNewMapId(state: Awaited<ReturnType<typeof readMapsState>>): string {
  const newId = Object.keys(state.maps).find(
    id => id !== IDS.mapAlpha && id !== IDS.mapBeta,
  );
  if (!newId) throw new Error('new map not found in localStorage state');
  return newId;
}

// ─── 1. Happy path — create + rename in one flow, sidebar and root node match ─

test('creating a new map and renaming it syncs the sidebar title and the root node label', async ({ page }) => {
  await page.getByTitle('New map').click();

  const ri = renameInput(page);
  await expect(ri).toBeVisible();
  await expect(ri).toBeFocused();
  await ri.fill('Roadmap');
  await ri.press('Enter');

  // Sidebar row shows the new name.
  await expect(page.locator('aside nav').getByText('Roadmap', { exact: true })).toBeVisible();
  // Canvas root node (scoped to the <svg>, so this can't match the sidebar text) also shows it.
  await expect(canvasNode(page)).toHaveText('Roadmap');
});

// ─── 2. `renamingNewMap` must be reset after the creation rename commits ─────
// (a leaked `true` would make a later rename of the SAME map also rewrite
// its root node; test 4 below renames a *different* map so it can't catch this)

test('renaming the same map again later (after the creation rename) does not touch its root node', async ({ page }) => {
  await page.getByTitle('New map').click();

  const ri = renameInput(page);
  await expect(ri).toBeVisible();
  await expect(ri).toBeFocused();
  await ri.fill('Roadmap');
  await ri.press('Enter');

  await expect(page.locator('aside nav').getByText('Roadmap', { exact: true })).toBeVisible();
  await expect(canvasNode(page)).toHaveText('Roadmap');

  // Double-click-rename the SAME map a second time.
  await page.locator('aside nav').getByText('Roadmap', { exact: true }).dblclick();
  const ri2 = renameInput(page);
  await expect(ri2).toBeVisible();
  await ri2.fill('Backlog');
  await ri2.press('Enter');

  // Sidebar title changed, but the root node must still read the first
  // (creation-time) rename, not the second.
  await expect(page.locator('aside nav').getByText('Backlog', { exact: true })).toBeVisible();
  await expect(canvasNode(page)).toHaveText('Roadmap');
});

// ─── 3. Focus switch — creating a map actually switches to it and stays there ─

test('creating a new map switches the canvas and URL hash to the new map, not back to the previous one', async ({ page }) => {
  await page.getByTitle('New map').click();

  // The canvas must show exactly one node: the new map's root, labelled "new map".
  // Under the pre-fix bug the `[maps]` hash-sync effect reverted `activeMapId`
  // back to "Alpha Map" (the previously active map), so this would read
  // "Alpha Map" instead.
  await expect(canvasNode(page)).toHaveCount(1);
  await expect(canvasNode(page)).toHaveText('new map');

  // No inline canvas editor should have been auto-opened by the focus switch itself
  // (only the sidebar rename input should be active; the canvas editor is the overlay
  // textarea/input with an inline `style` attribute — the sidebar rename input has none).
  await expect(page.locator(CANVAS_EDIT_SELECTOR)).toHaveCount(0);

  // The URL hash must point at the new map's id, not at "Alpha Map"'s id.
  const state = await readMapsState(page);
  const newMapId = findNewMapId(state);
  await expect.poll(() => page.evaluate(() => location.hash)).toBe(`#${newMapId}`);
  const hash = await page.evaluate(() => location.hash);
  expect(hash).not.toBe(`#${IDS.mapAlpha}`);
});

// ─── 4. Later rename of an existing map must NOT touch its root node ─────────

test('renaming an existing (non-new) map later does not change its root node label', async ({ page }) => {
  // Double-click "Beta Map" to enter its rename input (this bypasses onSelect,
  // so it never switches the active map, and never touches the canvas <textarea>).
  await page.locator('aside nav').getByText('Beta Map', { exact: true }).dblclick();

  const ri = renameInput(page);
  await expect(ri).toBeVisible();
  await ri.fill('Beta Renamed');
  await ri.press('Enter');

  // Sidebar shows the new title.
  await expect(page.locator('aside nav').getByText('Beta Renamed', { exact: true })).toBeVisible();

  // Switch to that map (plain single click; the 220ms double-click-disambiguation
  // delay means this alone never triggers rename mode) and confirm its root node
  // label is unchanged.
  await page.locator('aside nav').getByText('Beta Renamed', { exact: true }).click();
  await expect(canvasNode(page)).toHaveText('Beta Map');
});

// ─── 5. Escape / whitespace-only rename during creation commits nothing ──────

test('pressing Escape during the post-creation rename leaves both the map name and root node as "new map"', async ({ page }) => {
  await page.getByTitle('New map').click();

  const ri = renameInput(page);
  await expect(ri).toBeVisible();
  await ri.fill('Should Not Be Saved');
  await ri.press('Escape');

  await expect(page.locator('aside nav').getByText('new map', { exact: true })).toBeVisible();
  await expect(canvasNode(page)).toHaveText('new map');
});

test('a whitespace-only name during the post-creation rename commits nothing', async ({ page }) => {
  await page.getByTitle('New map').click();

  const ri = renameInput(page);
  await expect(ri).toBeVisible();
  await ri.fill('   ');
  await ri.press('Enter');

  await expect(page.locator('aside nav').getByText('new map', { exact: true })).toBeVisible();
  await expect(canvasNode(page)).toHaveText('new map');
});
