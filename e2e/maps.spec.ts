import { test, expect } from './fixtures';

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
    else await dialog.accept();
  });
  await page.getByTitle('New map').click();
  await expect(page.locator('aside').getByText('2 maps')).toBeVisible();

  // Hover over "my first map" item to reveal its delete button
  const nameSpan = page.locator('aside nav').getByText('my first map');
  await nameSpan.hover();
  // The delete button sits in the same .item parent as the name span
  const deleteBtn = nameSpan.locator('..').getByTitle('Delete map');
  await deleteBtn.click();

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
