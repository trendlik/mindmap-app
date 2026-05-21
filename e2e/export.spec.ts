/**
 * E2E tests for map export (JSON, SVG, MD) via the Toolbar buttons (issue #53).
 *
 * Feature summary:
 *  - The Toolbar exposes three export buttons: JSON, SVG, and MD.
 *  - Each button triggers a file download whose content reflects the current map.
 *  - The MD export produces a Markdown file where the root node becomes a # heading.
 *
 * Fixture: standard single-map fixture from fixtures.ts ("my first map", depth-0
 * root node).
 */

import { test, expect } from './fixtures';
import * as path from 'path';

// ─── helpers ──────────────────────────────────────────────────────────────────

/** Wait for a download triggered by `action`, then return the downloaded text. */
async function downloadText(
  page: import('@playwright/test').Page,
  action: () => Promise<void>,
): Promise<{ filename: string; content: string }> {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    action(),
  ]);
  const filePath = await download.path();
  if (!filePath) throw new Error('Download path is null');
  const fs = await import('fs/promises');
  const content = await fs.readFile(filePath, 'utf-8');
  return { filename: download.suggestedFilename(), content };
}

// ─── MD export ────────────────────────────────────────────────────────────────

test('MD button downloads a .md file', async ({ page }) => {
  const { filename } = await downloadText(page, () =>
    page.getByRole('button', { name: 'MD', exact: true }).click(),
  );
  expect(filename).toMatch(/\.md$/);
});

test('MD export file contains the root node as a # heading', async ({ page }) => {
  const { content } = await downloadText(page, () =>
    page.getByRole('button', { name: 'MD', exact: true }).click(),
  );
  // The fixture root node label is "my first map" (depth 0 → # heading)
  expect(content).toContain('# my first map');
});

test('MD export filename matches the map name', async ({ page }) => {
  const { filename } = await downloadText(page, () =>
    page.getByRole('button', { name: 'MD', exact: true }).click(),
  );
  expect(filename).toBe('my first map.md');
});

// ─── JSON export (smoke) ───────────────────────────────────────────────────────

test('JSON button downloads a .json file containing the map name', async ({ page }) => {
  const { filename, content } = await downloadText(page, () =>
    page.getByRole('button', { name: 'JSON', exact: true }).click(),
  );
  expect(filename).toMatch(/\.json$/);
  const data = JSON.parse(content);
  expect(data.name).toBe('my first map');
});

// ─── SVG export (smoke) ───────────────────────────────────────────────────────

test('SVG button downloads a .svg file', async ({ page }) => {
  const { filename, content } = await downloadText(page, () =>
    page.getByRole('button', { name: 'SVG', exact: true }).click(),
  );
  expect(filename).toMatch(/\.svg$/);
  expect(content).toContain('<svg');
});
