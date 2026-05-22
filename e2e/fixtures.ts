import { test as base, expect, type Page, type Locator } from '@playwright/test';

export const TEST_USER = {
  uid: 'playwright-test-uid',
  email: 'test@playwright.local',
  displayName: 'Test User',
};

export const TEST_IDS = {
  mapId: 'test-map-id-stable',
  rootNodeId: 'test-root-node-id-stable',
  mapName: 'my first map',
};

export function makeNode(
  id: string,
  label: string,
  x: number,
  y: number,
  parentId: string | null = null,
  depth: number = 0,
  w: number = 90,
  h: number = 36,
) {
  return { id, label, x, y, parentId, depth, w, h };
}

export function makeMap(id: string, name: string, nodeId: string) {
  return {
    id,
    name,
    nodes: { [nodeId]: makeNode(nodeId, name, 500, 300) },
    edges: [] as { from: string; to: string }[],
    links: [] as unknown[],
    tx: 0,
    ty: 0,
    scale: 1,
  };
}

export function parseTransform(transform: string | null): { tx: number; ty: number; scale: number } {
  if (!transform) return { tx: 0, ty: 0, scale: 1 };
  const tm = transform.match(/translate\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)/);
  const sm = transform.match(/scale\(\s*([-\d.]+)\s*\)/);
  return {
    tx: tm ? parseFloat(tm[1]) : 0,
    ty: tm ? parseFloat(tm[2]) : 0,
    scale: sm ? parseFloat(sm[1]) : 1,
  };
}

export async function waitForEditInput(page: Page): Promise<Locator> {
  const input = page.locator('input[style]');
  await input.waitFor({ state: 'visible', timeout: 2000 });
  return input;
}

export async function waitForPageReady(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByText('maps', { exact: true }).waitFor();
}

export const test = base.extend({
  page: async ({ page }, use) => {
    await page.addInitScript((params) => {
      window.__PLAYWRIGHT_TEST_USER__ = params.user;
      // Pre-populate a consistent state so maps/mapOrder/activeMapId all agree.
      // defaultMaps() uses crypto.randomUUID() and would generate different UUIDs
      // for each of the three useState initializers if localStorage is empty.
      const state = {
        maps: {
          [params.mapId]: {
            id: params.mapId,
            name: params.mapName,
            nodes: {
              [params.rootNodeId]: {
                id: params.rootNodeId,
                label: params.mapName,
                x: 500,
                y: 300,
                parentId: null,
                depth: 0,
                w: 90,
                h: 36,
              },
            },
            edges: [],
            links: [],
            tx: 0,
            ty: 0,
            // Use 0.999 (not 1) so the Canvas auto-fitView effect
            // (fires when tx===0 && ty===0 && scale===1) does not race
            // against test operations.
            scale: 0.999,
          },
        },
        mapOrder: [params.mapId],
      };
      localStorage.setItem('mindmaps_v2', JSON.stringify(state));
    }, { user: TEST_USER, ...TEST_IDS });

    await page.goto('/');
    await page.getByText('maps', { exact: true }).waitFor();
    await use(page);
  },
});

export { expect };
