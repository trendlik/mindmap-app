import { test, expect } from './fixtures';

test('bypasses sign-in and shows the app', async ({ page }) => {
  await expect(page.getByText('Sign in with Google')).not.toBeVisible();
  await expect(page.locator('aside')).toBeVisible();
});

test('shows test user name in sidebar footer', async ({ page }) => {
  await expect(page.getByText('Test User')).toBeVisible();
});
