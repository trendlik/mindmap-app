import type { MindMapNode } from '../store/useMindMapStore';
import type { LLMSettings } from '../hooks/useLLMSettings';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export function buildSubtreeContext(nodes: Record<string, MindMapNode>, rootId: string, indent = 0): string {
  const node = nodes[rootId];
  if (!node) return '';
  const prefix = '  '.repeat(indent);
  const children = Object.values(nodes).filter(n => n.parentId === rootId);
  const childText = children.map(c => buildSubtreeContext(nodes, c.id, indent + 1)).join('');
  const trimmedNotes = node.notes?.trim();
  const notesLine = trimmedNotes ? `${prefix}  [notes: ${trimmedNotes.replace(/\n+/g, ' ')}]\n` : '';
  return `${prefix}${node.label}\n${notesLine}${childText}`;
}

export function buildFullMapContext(nodes: Record<string, MindMapNode>): string {
  const roots = Object.values(nodes).filter(n => n.parentId === null);
  return roots.map(r => buildSubtreeContext(nodes, r.id, 0)).join('');
}

export async function sendMessage(
  messages: ChatMessage[],
  settings: LLMSettings,
  mapContext: string,
  selectedNodeLabel?: string,
): Promise<string> {
  const selectionLine = selectedNodeLabel
    ? `The user is currently focused on the node: "${selectedNodeLabel}".\n\n`
    : '';
  const systemPrompt = `You are a mind-map wording coach. ${selectionLine}The user's mind map structure is:\n\n${mapContext}\n\nHelp the user improve the clarity and effectiveness of their wording.`;

  if (settings.provider === 'claude') {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': settings.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4096,
        system: systemPrompt,
        messages,
      }),
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error((err as { error?: { message?: string } }).error?.message ?? `Claude API error ${resp.status}`);
    }
    const data = await resp.json() as { content: { type: string; text: string }[]; stop_reason: string };
    const text = data.content.find(b => b.type === 'text')?.text ?? '';
    if (data.stop_reason === 'max_tokens') {
      return text + '\n\n[Response was truncated due to length. Try asking a more specific question.]';
    }
    return text;
  } else {
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': `Bearer ${settings.apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'system', content: systemPrompt }, ...messages],
      }),
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error((err as { error?: { message?: string } }).error?.message ?? `OpenAI API error ${resp.status}`);
    }
    const data = await resp.json() as { choices: { message: { content: string } }[] };
    return data.choices[0]?.message?.content ?? '';
  }
}
