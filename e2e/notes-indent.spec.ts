/**
 * E2E tests for multi-level bullet points in notes (issue #50).
 *
 * Feature summary:
 *  - Tab while in a list item indents (creates a sub-bullet).
 *  - Shift+Tab while in a list item outdents (moves back to parent level).
 *  - Toolbar indent button indents the current list item.
 *  - Toolbar outdent button outdents the current list item.
 *
 * Fixture: standard single-map fixture from fixtures.ts with a root node.
 */

import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';

// ─── helpers ──────────────────────────────────────────────────────────────────

/** Click the root node on the canvas to select it. */
async function selectRootNode(page: Page) {
  await page.locator('[data-node-id]').first().click();
}

/** Open the notes panel via the toolbar notes button. */
async function openNotes(page: Page) {
  await page.getByRole('button', { name: 'notes', exact: true }).click();
}

/** The contentEditable notes editor div. */
const editor = (page: Page) => page.locator('[contenteditable]');

// ─── 1. Tab creates a sub-bullet ─────────────────────────────────────────────

test('Tab in a bullet list creates a nested sub-bullet', async ({ page }) => {
  await selectRootNode(page);
  await openNotes(page);

  const ed = editor(page);
  await ed.click();

  // Start a bullet list
  await page.getByTitle('Bullet list').click();
  await ed.type('item 1');

  // Press Enter to start a new item, then Tab to indent
  await page.keyboard.press('Enter');
  await page.keyboard.press('Tab');

  // Verify a nested <ul> exists inside the editor
  await expect(ed.locator('ul ul')).toHaveCount(1);

  await ed.type('sub-item');

  // Nested <ul> should still be present
  await expect(ed.locator('ul ul')).toHaveCount(1);
});

// ─── 2. Shift+Tab outdents back to top level ─────────────────────────────────

test('Shift+Tab outdents a sub-bullet back to top level', async ({ page }) => {
  await selectRootNode(page);
  await openNotes(page);

  const ed = editor(page);
  await ed.click();

  // Build: bullet list → item 1 → Enter → Tab (sub-item level)
  await page.getByTitle('Bullet list').click();
  await ed.type('item 1');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Tab');

  // Confirm nesting exists
  await expect(ed.locator('ul ul')).toHaveCount(1);

  // Outdent with Shift+Tab
  await page.keyboard.press('Shift+Tab');

  // Nesting should be gone (back to single level)
  await expect(ed.locator('ul ul')).toHaveCount(0);
});

// ─── 3. Toolbar indent/outdent buttons ───────────────────────────────────────

test('toolbar indent button indents a list item', async ({ page }) => {
  await selectRootNode(page);
  await openNotes(page);

  const ed = editor(page);
  await ed.click();

  // Start a bullet list with two items
  await page.getByTitle('Bullet list').click();
  await ed.type('item 1');
  await page.keyboard.press('Enter');
  await ed.type('item 2');

  // Use toolbar indent button to indent item 2
  await page.getByTitle('Indent list item (Tab)').click();

  // Nested <ul> should now exist
  await expect(ed.locator('ul ul')).toHaveCount(1);
});

test('Tab outside a list inserts two spaces instead of indenting', async ({ page }) => {
  await selectRootNode(page);
  await openNotes(page);

  const ed = editor(page);
  await ed.click();
  await ed.type('plain text');
  await page.keyboard.press('Tab');

  // Should contain two spaces, not a blockquote
  await expect(ed.locator('blockquote')).toHaveCount(0);
  const html = await ed.innerHTML();
  expect(html).toContain('  ');
});

test('toolbar outdent button outdents a nested list item', async ({ page }) => {
  await selectRootNode(page);
  await openNotes(page);

  const ed = editor(page);
  await ed.click();

  // Build indented structure via keyboard
  await page.getByTitle('Bullet list').click();
  await ed.type('item 1');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Tab');

  // Confirm nesting exists
  await expect(ed.locator('ul ul')).toHaveCount(1);

  // Use toolbar outdent button
  await page.getByTitle('Outdent list item (Shift+Tab)').click();

  // Nesting should be gone
  await expect(ed.locator('ul ul')).toHaveCount(0);
});

// ─── 4. URL link field ────────────────────────────────────────────────────────

test('URL link field stores a link on the selected node', async ({ page }) => {
  await selectRootNode(page);
  await openNotes(page);

  const linkInput = page.getByPlaceholder('Add URL...');
  await linkInput.fill('https://example.com');
  // Blur to trigger onChangeLink persist
  await linkInput.press('Tab');

  // Re-open the notes panel and verify the link is still there
  // (close then re-select + re-open)
  await page.getByRole('button', { name: 'notes', exact: true }).click();
  await selectRootNode(page);
  await openNotes(page);

  await expect(page.getByPlaceholder('Add URL...')).toHaveValue('https://example.com');
});

// ─── 5. Emoji icon picker ─────────────────────────────────────────────────────

test('emoji icon picker sets an emoji on the selected node', async ({ page }) => {
  await selectRootNode(page);
  await openNotes(page);

  // Open the icon picker
  await page.getByTitle('Add icon').click();

  // Pick the first emoji (💡)
  const firstEmoji = page.locator('[class*="emojiBtn"]').first();
  const emojiChar = await firstEmoji.textContent();
  await firstEmoji.click();

  // The icon trigger should now display the chosen emoji
  await expect(page.locator('[class*="iconEmoji"]')).toHaveText(emojiChar ?? '💡');
});

test('removing an emoji icon clears it from the selected node', async ({ page }) => {
  await selectRootNode(page);
  await openNotes(page);

  // Set an icon first
  await page.getByTitle('Add icon').click();
  await page.locator('[class*="emojiBtn"]').first().click();
  await expect(page.locator('[class*="iconEmoji"]')).toBeVisible();

  // Remove the icon (exact: true avoids matching "Change or remove icon")
  await page.getByTitle('Remove icon', { exact: true }).click();
  await expect(page.locator('[class*="iconEmoji"]')).toHaveCount(0);
});
