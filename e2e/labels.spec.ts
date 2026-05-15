import { test as base, expect } from './fixtures';

// IDs for the multi-map seed used across several tests
const MAP_A_ID = 'label-test-map-a';
const MAP_B_ID = 'label-test-map-b';
const MAP_C_ID = 'label-test-map-c';

const ROOT_A = 'label-root-a';
const ROOT_B = 'label-root-b';
const ROOT_C = 'label-root-c';

// A fixture that seeds three maps with varying labels:
//   Alpha  — labels: ['work', 'urgent']
//   Beta   — labels: ['work']
//   Gamma  — labels: ['personal']
const test = base.extend<object>({
  page: async ({ page }, use) => {
    await page.addInitScript((ids) => {
      const state = {
        maps: {
          [ids.mapA]: {
            id: ids.mapA,
            name: 'Alpha',
            nodes: { [ids.rootA]: { id: ids.rootA, label: 'Alpha', x: 500, y: 300, parentId: null, depth: 0, w: 90, h: 36 } },
            edges: [],
            links: [],
            tx: 0,
            ty: 0,
            scale: 1,
            labels: ['work', 'urgent'],
          },
          [ids.mapB]: {
            id: ids.mapB,
            name: 'Beta',
            nodes: { [ids.rootB]: { id: ids.rootB, label: 'Beta', x: 500, y: 300, parentId: null, depth: 0, w: 90, h: 36 } },
            edges: [],
            links: [],
            tx: 0,
            ty: 0,
            scale: 1,
            labels: ['work'],
          },
          [ids.mapC]: {
            id: ids.mapC,
            name: 'Gamma',
            nodes: { [ids.rootC]: { id: ids.rootC, label: 'Gamma', x: 500, y: 300, parentId: null, depth: 0, w: 90, h: 36 } },
            edges: [],
            links: [],
            tx: 0,
            ty: 0,
            scale: 1,
            labels: ['personal'],
          },
        },
        mapOrder: [ids.mapA, ids.mapB, ids.mapC],
      };
      localStorage.setItem('mindmaps_v2', JSON.stringify(state));
    }, { mapA: MAP_A_ID, mapB: MAP_B_ID, mapC: MAP_C_ID, rootA: ROOT_A, rootB: ROOT_B, rootC: ROOT_C });

    await page.goto('/');
    await page.getByText('maps', { exact: true }).waitFor();
    await use(page);
  },
});

// ---------------------------------------------------------------------------
// a) Add a label via the tag button
// ---------------------------------------------------------------------------
test('add a label — chip appears below map name after typing and pressing Enter', async ({ page }) => {
  const nameSpan = page.locator('aside nav').getByText('Alpha').first();
  await nameSpan.hover();

  // Click the tag/label button that appears on hover
  const tagBtn = nameSpan.locator('..').getByTitle('Edit labels');
  await tagBtn.click();

  // The label editor should open; type a new label
  const labelInput = page.locator('aside').locator('input[placeholder="Add label…"]');
  await expect(labelInput).toBeVisible();
  await labelInput.fill('newlabel');
  await labelInput.press('Enter');
  await labelInput.press('Escape'); // close editor so only the display chip remains

  // Chip should appear below the map name
  await expect(page.locator('aside').getByText('#newlabel', { exact: true })).toBeVisible();
});

// ---------------------------------------------------------------------------
// b) Remove a label — click × in the editor to delete a chip
// ---------------------------------------------------------------------------
test('remove a label — clicking × removes the chip', async ({ page }) => {
  // Alpha already has labels ['work', 'urgent'] from the seed
  await expect(page.locator('aside').getByText('#work').first()).toBeVisible();

  const nameSpan = page.locator('aside nav').getByText('Alpha').first();
  await nameSpan.hover();
  const tagBtn = nameSpan.locator('..').getByTitle('Edit labels');
  await tagBtn.click();

  // The editor shows chips with × buttons; remove 'work'
  // The × button is inside a span that contains '#work'
  const workChip = page.locator('aside').locator('[class*="labelChipEdit"]').filter({ hasText: '#work' });
  await workChip.getByRole('button').click();

  // Close editor then assert scoped to Alpha's item wrap (Beta also has #work)
  await page.keyboard.press('Escape');
  const alphaWrap = nameSpan.locator('../..');
  await expect(alphaWrap.locator('span').filter({ hasText: /^#work$/ })).not.toBeVisible();
  // urgent should still be present on Alpha
  await expect(alphaWrap.getByText('#urgent', { exact: true })).toBeVisible();
});

// ---------------------------------------------------------------------------
// c) Search by map name — plain text filters the list
// ---------------------------------------------------------------------------
test('search by name — plain text shows only matching maps', async ({ page }) => {
  const searchInput = page.locator('aside input[placeholder="Search or label:tag"]');
  await searchInput.fill('Alpha');

  await expect(page.locator('aside nav').getByText('Alpha')).toBeVisible();
  await expect(page.locator('aside nav').getByText('Beta')).not.toBeVisible();
  await expect(page.locator('aside nav').getByText('Gamma')).not.toBeVisible();
});

// ---------------------------------------------------------------------------
// d) Search by single label — label:X shows only maps with that label
// ---------------------------------------------------------------------------
test('search by single label — label:personal shows only Gamma', async ({ page }) => {
  const searchInput = page.locator('aside input[placeholder="Search or label:tag"]');
  await searchInput.fill('label:personal');

  await expect(page.locator('aside nav').getByText('Gamma')).toBeVisible();
  await expect(page.locator('aside nav').getByText('Alpha')).not.toBeVisible();
  await expect(page.locator('aside nav').getByText('Beta')).not.toBeVisible();
});

test('search by single label — label:work shows Alpha and Beta', async ({ page }) => {
  const searchInput = page.locator('aside input[placeholder="Search or label:tag"]');
  await searchInput.fill('label:work');

  await expect(page.locator('aside nav').getByText('Alpha')).toBeVisible();
  await expect(page.locator('aside nav').getByText('Beta')).toBeVisible();
  await expect(page.locator('aside nav').getByText('Gamma')).not.toBeVisible();
});

// ---------------------------------------------------------------------------
// e) Search with OR — label:X|Y shows maps with either label
// ---------------------------------------------------------------------------
test('search with OR — label:urgent|personal shows Alpha and Gamma', async ({ page }) => {
  const searchInput = page.locator('aside input[placeholder="Search or label:tag"]');
  await searchInput.fill('label:urgent|personal');

  await expect(page.locator('aside nav').getByText('Alpha')).toBeVisible();
  await expect(page.locator('aside nav').getByText('Gamma')).toBeVisible();
  await expect(page.locator('aside nav').getByText('Beta')).not.toBeVisible();
});

// ---------------------------------------------------------------------------
// f) Search with AND — label:X&Y shows only maps with both labels
// ---------------------------------------------------------------------------
test('search with AND — label:work&urgent shows only Alpha', async ({ page }) => {
  const searchInput = page.locator('aside input[placeholder="Search or label:tag"]');
  await searchInput.fill('label:work&urgent');

  await expect(page.locator('aside nav').getByText('Alpha')).toBeVisible();
  await expect(page.locator('aside nav').getByText('Beta')).not.toBeVisible();
  await expect(page.locator('aside nav').getByText('Gamma')).not.toBeVisible();
});

// ---------------------------------------------------------------------------
// g) Label editor closes on Escape
// ---------------------------------------------------------------------------
test('label editor closes on Escape', async ({ page }) => {
  const nameSpan = page.locator('aside nav').getByText('Alpha').first();
  await nameSpan.hover();
  const tagBtn = nameSpan.locator('..').getByTitle('Edit labels');
  await tagBtn.click();

  const labelInput = page.locator('aside').locator('input[placeholder="Add label…"]');
  await expect(labelInput).toBeVisible();

  await labelInput.press('Escape');
  await expect(labelInput).not.toBeVisible();
});

// ---------------------------------------------------------------------------
// h) Duplicate labels are not added
// ---------------------------------------------------------------------------
test('duplicate labels are not added — adding the same label twice keeps only one', async ({ page }) => {
  // Alpha already has ['work', 'urgent']; try to add 'work' again
  const nameSpan = page.locator('aside nav').getByText('Alpha').first();
  await nameSpan.hover();
  const tagBtn = nameSpan.locator('..').getByTitle('Edit labels');
  await tagBtn.click();

  const labelInput = page.locator('aside').locator('input[placeholder="Add label…"]');
  await labelInput.fill('work');
  await labelInput.press('Enter');

  // Close the editor
  await labelInput.press('Escape');

  // Scope to Alpha's item wrap; use exact regex so edit chips (#work×) don't match
  // and the labelChips container div is excluded (it's a div, not a span)
  const alphaWrap = page.locator('aside nav').getByText('Alpha').first().locator('../..');
  const workChips = alphaWrap.locator('span').filter({ hasText: /^#work$/ });
  await expect(workChips).toHaveCount(1);
});
