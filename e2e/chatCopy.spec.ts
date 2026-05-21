/**
 * E2E tests for the copy-to-clipboard button on AI assistant messages (issue #55).
 *
 * Feature summary:
 *  - A copy button appears on assistant messages only, revealed on hover.
 *  - Clicking the button copies the message text to the clipboard.
 *  - The button label changes to "Copied!" for 1.5 s then reverts to the copy icon (⎘).
 *
 * Setup:
 *  - A fake LLM settings object is injected into localStorage so the chat modal
 *    does not show the "Configure your API key first" gate.
 *  - The Anthropic API endpoint is intercepted via page.route so no real network
 *    requests are made.
 */

import { test, expect } from './fixtures';

const LLM_SETTINGS_KEY = 'mindmap-llm-settings';
const FAKE_REPLY = 'Here is a helpful assistant response.';

/** Seed a fake Claude API key in localStorage before the app boots. */
async function seedLlmSettings(page: import('@playwright/test').Page) {
  await page.addInitScript((key) => {
    localStorage.setItem(key, JSON.stringify({ provider: 'claude', apiKey: 'test-key-playwright' }));
  }, LLM_SETTINGS_KEY);
}

/** Intercept the Anthropic messages endpoint and return a canned response. */
async function mockAnthropicApi(page: import('@playwright/test').Page, replyText: string) {
  await page.route('**/api.anthropic.com/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'msg_test',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: replyText }],
        model: 'claude-3-5-haiku-20241022',
        stop_reason: 'end_turn',
        usage: { input_tokens: 10, output_tokens: 20 },
      }),
    });
  });
}

/** Open the AI chat modal via the Toolbar button. */
async function openChat(page: import('@playwright/test').Page) {
  await page.getByTitle('AI Chat').click();
  await expect(page.getByRole('dialog', { name: 'AI Chat' })).toBeVisible();
}

/** Send a message and wait for the assistant reply bubble to appear. */
async function sendAndWaitForReply(page: import('@playwright/test').Page, message: string) {
  const dialog = page.getByRole('dialog', { name: 'AI Chat' });
  await dialog.getByRole('textbox').fill(message);
  await dialog.getByRole('button', { name: 'Send' }).click();
  // Wait for the assistant message to appear
  await expect(dialog.locator('[class*="assistantMsg"]').filter({ hasText: FAKE_REPLY })).toBeVisible({ timeout: 5000 });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test('copy button is hidden by default and visible on hover', async ({ page }) => {
  await seedLlmSettings(page);
  await mockAnthropicApi(page, FAKE_REPLY);

  await page.goto('/');
  await page.getByText('maps').waitFor();
  await openChat(page);
  await sendAndWaitForReply(page, 'Hello');

  const dialog = page.getByRole('dialog', { name: 'AI Chat' });
  const assistantBubble = dialog.locator('[class*="assistantMsg"]').filter({ hasText: FAKE_REPLY });
  const copyBtn = assistantBubble.getByRole('button', { name: 'Copy message' });

  // Button should be in the DOM but visually hidden (opacity: 0)
  await expect(copyBtn).toBeAttached();
  await expect(copyBtn).toHaveCSS('opacity', '0');

  // Hover reveals the button
  await assistantBubble.hover();
  await expect(copyBtn).toHaveCSS('opacity', '1');
});

test('clicking copy button shows "Copied!" then reverts to copy icon', async ({ page }) => {
  await seedLlmSettings(page);
  await mockAnthropicApi(page, FAKE_REPLY);

  // Mock clipboard before navigating so the API is available immediately
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: (_text: string) => Promise.resolve(),
      },
      writable: true,
      configurable: true,
    });
  });

  await page.goto('/');
  await page.getByText('maps').waitFor();
  await openChat(page);
  await sendAndWaitForReply(page, 'Hello');

  const dialog = page.getByRole('dialog', { name: 'AI Chat' });
  const assistantBubble = dialog.locator('[class*="assistantMsg"]').filter({ hasText: FAKE_REPLY });
  const copyBtn = assistantBubble.getByRole('button', { name: 'Copy message' });

  // Hover to reveal, then click
  await assistantBubble.hover();
  await copyBtn.click();

  // Button should immediately show "Copied!"
  await expect(copyBtn).toHaveText('Copied!');

  // After 1.6 s the button should revert to the copy icon
  await page.waitForTimeout(1600);
  await expect(copyBtn).toHaveText('⎘');
});

test('copy button copies assistant message text to clipboard', async ({ page }) => {
  await seedLlmSettings(page);
  await mockAnthropicApi(page, FAKE_REPLY);

  // Capture what is written to the clipboard
  let clipboardText = '';
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: (text: string) => {
          (window as unknown as Record<string, unknown>).__clipboardText__ = text;
          return Promise.resolve();
        },
      },
      writable: true,
      configurable: true,
    });
  });

  await page.goto('/');
  await page.getByText('maps').waitFor();
  await openChat(page);
  await sendAndWaitForReply(page, 'Hello');

  const dialog = page.getByRole('dialog', { name: 'AI Chat' });
  const assistantBubble = dialog.locator('[class*="assistantMsg"]').filter({ hasText: FAKE_REPLY });
  const copyBtn = assistantBubble.getByRole('button', { name: 'Copy message' });

  await assistantBubble.hover();
  await copyBtn.click();

  // Read what ended up in our mock clipboard
  clipboardText = await page.evaluate(() => (window as unknown as Record<string, unknown>).__clipboardText__ as string ?? '');
  expect(clipboardText).toBe(FAKE_REPLY);
});

test('copy button is NOT shown on user messages', async ({ page }) => {
  await seedLlmSettings(page);
  await mockAnthropicApi(page, FAKE_REPLY);

  await page.goto('/');
  await page.getByText('maps').waitFor();
  await openChat(page);
  await sendAndWaitForReply(page, 'Hello');

  const dialog = page.getByRole('dialog', { name: 'AI Chat' });
  const userBubble = dialog.locator('[class*="userMsg"]').filter({ hasText: 'Hello' });

  // Hover over the user bubble — no copy button should appear
  await userBubble.hover();
  await expect(userBubble.getByRole('button', { name: 'Copy message' })).not.toBeAttached();
});
