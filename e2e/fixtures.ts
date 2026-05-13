import { test as base, expect } from '@playwright/test';

const TEST_USER = {
  uid: 'playwright-test-uid',
  email: 'test@playwright.local',
  displayName: 'Test User',
};

export const TEST_IDS = {
  mapId: 'test-map-id-stable',
  rootNodeId: 'test-root-node-id-stable',
  mapName: 'my first map',
};

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
            scale: 1,
          },
        },
        mapOrder: [params.mapId],
      };
      localStorage.setItem('mindmaps_v2', JSON.stringify(state));
    }, { user: TEST_USER, ...TEST_IDS });

    await page.goto('/');
    await page.getByText('maps').waitFor();
    await use(page);
  },
});

export { expect };
