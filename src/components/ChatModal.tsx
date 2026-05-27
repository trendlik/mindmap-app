import { useEffect, useRef, useState } from 'react';
import { useLLMSettings } from '../hooks/useLLMSettings';
import { buildSubtreeContext, buildFullMapContext, sendMessage } from '../utils/llmService';
import type { ChatMessage } from '../utils/llmService';
import type { MindMapNode } from '../store/useMindMapStore';
import { useUsageStats } from '../contexts/UsageStatsContext';
import styles from './ChatModal.module.css';

interface LocalMessage extends ChatMessage {
  id: string;
}

interface Props {
  onClose: () => void;
  onOpenSettings: () => void;
  nodes: Record<string, MindMapNode>;
  selectedNodeId: string | null;
}

export default function ChatModal({ onClose, onOpenSettings, nodes, selectedNodeId }: Props) {
  const { settings } = useLLMSettings();
  const { trackEvent } = useUsageStats();
  const [scope, setScope] = useState<'selected' | 'map'>(selectedNodeId ? 'selected' : 'map');
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [pos, setPos] = useState(() => ({
    x: Math.max(16, window.innerWidth - 496),
    y: Math.max(16, window.innerHeight - 576),
  }));
  const dragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const returnFocusRef = useRef<Element | null>(null);

  useEffect(() => {
    returnFocusRef.current = document.activeElement;
    inputRef.current?.focus();
    return () => {
      (returnFocusRef.current as HTMLElement | null)?.focus?.();
    };
  }, []);

  useEffect(() => {
    function clamp(p: { x: number; y: number }) {
      return {
        x: Math.max(16, Math.min(p.x, window.innerWidth - 480 - 16)),
        y: Math.max(16, Math.min(p.y, window.innerHeight - 560 - 16)),
      };
    }
    function onMouseMove(e: MouseEvent) {
      if (!dragging.current) return;
      setPos(clamp({ x: e.clientX - dragOffset.current.x, y: e.clientY - dragOffset.current.y }));
    }
    function onMouseUp() { dragging.current = false; }
    function onResize() { setPos(p => clamp(p)); }
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function handleSend() {
    const text = input.trim();
    if (!text || loading) return;

    const mapContext = scope === 'selected' && selectedNodeId
      ? buildSubtreeContext(nodes, selectedNodeId)
      : buildFullMapContext(nodes);

    const userMsg: LocalMessage = { id: crypto.randomUUID(), role: 'user', content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput('');
    setLoading(true);
    setError(null);
    trackEvent('aiChat');

    try {
      const apiMessages: ChatMessage[] = next.map(({ role, content }) => ({ role, content }));
      const selectedNodeLabel = (scope === 'selected' && selectedNodeId) ? nodes[selectedNodeId]?.label : undefined;
      const reply = await sendMessage(apiMessages, settings, mapContext, selectedNodeLabel);
      setMessages(m => [...m, { id: crypto.randomUUID(), role: 'assistant', content: reply }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  async function handleCopy(msgId: string, content: string) {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(msgId);
      trackEvent('aiChatCopy');
      setTimeout(() => setCopiedId(prev => prev === msgId ? null : prev), 1500);
    } catch {
      // clipboard write failed silently (e.g. non-HTTPS or permission denied)
    }
  }

  const noKey = !settings.apiKey;

  function onDragStart(e: React.MouseEvent) {
    if ((e.target as HTMLElement).closest('button')) return;
    e.preventDefault();
    dragging.current = true;
    dragOffset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
  }

  return (
    <div
      className={styles.modal}
      role="dialog"
      aria-labelledby="chat-title"
      style={{ top: pos.y, left: pos.x }}
    >
      <div className={styles.header} onMouseDown={onDragStart}>
        <span id="chat-title" className={styles.title}>AI Chat</span>
        <div className={styles.headerActions}>
          {selectedNodeId && (
            <div className={styles.scopeToggle}>
              <button
                className={`${styles.scopeBtn} ${scope === 'selected' ? styles.scopeActive : ''}`}
                onClick={() => setScope('selected')}
              >
                Selected node
              </button>
              <button
                className={`${styles.scopeBtn} ${scope === 'map' ? styles.scopeActive : ''}`}
                onClick={() => setScope('map')}
              >
                Entire map
              </button>
            </div>
          )}
          <button
            className={styles.settingsBtn}
            onClick={e => { e.stopPropagation(); onOpenSettings(); }}
            title="LLM Settings"
            aria-label="LLM Settings"
          >
            ⚙
          </button>
          <button className={styles.close} onClick={onClose} aria-label="Close">×</button>
        </div>
      </div>

      <div className={styles.messages}>
        {noKey && (
          <div className={styles.noKey}>
            Configure your LLM API key in{' '}
            <button className={styles.noKeyLink} onClick={onOpenSettings}>
              Settings
            </button>{' '}
            first.
          </div>
        )}
        {messages.map(m => (
          <div key={m.id} className={m.role === 'user' ? styles.userMsg : styles.assistantMsg}>
            {m.content}
            {m.role === 'assistant' && (
              <button
                className={`${styles.copyBtn}${copiedId === m.id ? ` ${styles.copied}` : ''}`}
                onClick={() => handleCopy(m.id, m.content)}
                aria-label={copiedId === m.id ? 'Copied' : 'Copy message'}
              >
                {copiedId === m.id ? 'Copied!' : '⎘'}
              </button>
            )}
          </div>
        ))}
        {loading && (
          <div className={styles.assistantMsg}>
            <span className={styles.typing}>…</span>
          </div>
        )}
        {error && <div className={styles.errorMsg}>{error}</div>}
        <div ref={messagesEndRef} />
      </div>

      <div className={styles.inputRow}>
        <textarea
          ref={inputRef}
          className={styles.input}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={noKey ? 'Set your API key first…' : 'Ask about your mind map wording…'}
          disabled={noKey || loading}
          rows={2}
        />
        <button
          className={styles.sendBtn}
          onClick={handleSend}
          disabled={noKey || loading || !input.trim()}
          aria-label="Send"
        >
          ↑
        </button>
      </div>
    </div>
  );
}
