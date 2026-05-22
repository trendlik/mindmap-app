/**
 * E2E tests for the LLM SettingsPanel.
 *
 * The panel is opened via the ⚙ toolbar button (title="LLM Settings").
 * It shows a provider select and an API key password input.
 * Save stores to localStorage; Cancel/Escape discards changes.
 */

import { test, expect } from './fixtures';

const STORAGE_KEY = 'mindmap-llm-settings';

test('opens the LLM settings panel via the toolbar button', async ({ page }) => {
  await page.getByTitle('LLM Settings').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('dialog').getByText('LLM Settings')).toBeVisible();
});

test('closes the settings panel via the Cancel button', async ({ page }) => {
  await page.getByTitle('LLM Settings').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('dialog')).not.toBeAttached();
});

test('Escape key closes the settings panel', async ({ page }) => {
  await page.getByTitle('LLM Settings').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeAttached();
});

test('saves settings to localStorage and closes the panel', async ({ page }) => {
  await page.getByTitle('LLM Settings').click();

  // Change provider and enter an API key
  await page.getByLabel('Provider').selectOption('openai');
  await page.getByLabel('API Key').fill('sk-test-key-12345');

  await page.getByRole('button', { name: 'Save' }).click();

  // Panel should close after save
  await expect(page.getByRole('dialog')).not.toBeAttached();

  // Values should be persisted in localStorage
  const stored = await page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  }, STORAGE_KEY);

  expect(stored?.provider).toBe('openai');
  expect(stored?.apiKey).toBe('sk-test-key-12345');
});
