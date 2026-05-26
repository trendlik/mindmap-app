import { useRef, useEffect, useCallback, useState } from 'react';
import styles from './NotesPanel.module.css';
import { logger } from '../utils/logger';
import { linkifyHtml, linkifyNode } from '../utils/linkify';
import { useUsageStats } from '../contexts/UsageStatsContext';

const PANEL_WIDTH_KEY = 'notesPanelWidth';
const PANEL_MIN_WIDTH = 200;
const PANEL_MAX_WIDTH = 600;
const PANEL_DEFAULT_WIDTH = 280;

function getSavedWidth(): number {
  const saved = localStorage.getItem(PANEL_WIDTH_KEY);
  if (!saved) return PANEL_DEFAULT_WIDTH;
  const n = parseInt(saved, 10);
  return isNaN(n) ? PANEL_DEFAULT_WIDTH : Math.min(Math.max(n, PANEL_MIN_WIDTH), PANEL_MAX_WIDTH);
}

const EMOJIS = [
  '💡', '🔥', '⭐', '✅', '❌', '⚠️', '🔑', '📌',
  '🎯', '💰', '📝', '🚀', '❓', '💬', '📊', '🏆',
  '⏰', '🔎', '📁', '🎨', '⚡', '🌟', '🔔', '💎',
];

interface NotesPanelProps {
  nodeLabel: string;
  notes: string;
  link: string;
  icon: string;
  onChange: (notes: string) => void;
  onChangeLink: (link: string) => void;
  onChangeIcon: (icon: string) => void;
  onClose: () => void;
}

function normalizeLink(raw: string): string {
  if (!raw) return raw;
  try {
    const url = new URL(raw);
    if (url.origin === location.origin && url.hash) {
      return url.hash;
    }
  } catch { /* not a full URL, leave as-is */ }
  return raw;
}

function isInternalLink(link: string): boolean {
  return link.startsWith('#');
}

function isInList(): boolean {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return false;
  let node: Node | null = sel.anchorNode;
  while (node) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const tag = (node as Element).tagName;
      if (tag === 'LI' || tag === 'UL' || tag === 'OL') return true;
      if (tag === 'DIV' || tag === 'BODY') break;
    }
    node = node.parentNode;
  }
  return false;
}

function fmt(command: string, value?: string) {
  document.execCommand(command, false, value);
}

interface FmtBtnProps {
  command: string;
  title: string;
  children: React.ReactNode;
}

function FmtBtn({ command, title, children }: FmtBtnProps) {
  return (
    <button
      className={styles.fmtBtn}
      title={title}
      onMouseDown={e => { e.preventDefault(); fmt(command); }}
    >
      {children}
    </button>
  );
}

export default function NotesPanel({ nodeLabel, notes, link, icon, onChange, onChangeLink, onChangeIcon, onClose }: NotesPanelProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const isInternalUpdate = useRef(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [panelWidth, setPanelWidth] = useState(getSavedWidth);
  const { trackEvent } = useUsageStats();

  const dragCleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => { dragCleanupRef.current?.(); };
  }, []);

  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = panelRef.current!.getBoundingClientRect().width;

    function onMouseMove(ev: MouseEvent) {
      const delta = startX - ev.clientX;
      const newWidth = Math.min(Math.max(startWidth + delta, PANEL_MIN_WIDTH), PANEL_MAX_WIDTH);
      if (panelRef.current) panelRef.current.style.width = `${newWidth}px`;
    }

    function cleanup() {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      dragCleanupRef.current = null;
    }

    function onMouseUp(ev: MouseEvent) {
      cleanup();
      const delta = startX - ev.clientX;
      const finalWidth = Math.min(Math.max(startWidth + delta, PANEL_MIN_WIDTH), PANEL_MAX_WIDTH);
      setPanelWidth(finalWidth);
      localStorage.setItem(PANEL_WIDTH_KEY, String(finalWidth));
      trackEvent('notesPanelResize');
    }

    dragCleanupRef.current = cleanup;
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [trackEvent]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Tab') {
      e.preventDefault();
      if (isInList()) {
        if (e.shiftKey) {
          document.execCommand('outdent', false);
          trackEvent('notesOutdent');
        } else {
          document.execCommand('indent', false);
          trackEvent('notesIndent');
        }
      } else {
        document.execCommand('insertText', false, '  ');
      }
    }
  }

  // Sync external notes prop → editor HTML (only when the prop changes from outside)
  useEffect(() => {
    if (isInternalUpdate.current) {
      isInternalUpdate.current = false;
      return;
    }
    if (editorRef.current && editorRef.current.innerHTML !== notes) {
      editorRef.current.innerHTML = notes;
    }
  }, [notes]);

  const handleInput = useCallback(() => {
    if (!editorRef.current) return;
    isInternalUpdate.current = true;
    const value = editorRef.current.textContent?.trim()
      ? editorRef.current.innerHTML
      : '';
    onChange(value);
  }, [onChange]);

  function handleLinkBlur() {
    const normalized = normalizeLink(link);
    if (normalized !== link) onChangeLink(normalized);
    if (link) logger.logAction('node_link_set');
  }

  function handleLinkClick(e: React.MouseEvent) {
    if (isInternalLink(link)) {
      e.preventDefault();
      location.hash = link;
    }
  }

  return (
    <div ref={panelRef} className={styles.panel} style={{ width: panelWidth }} data-testid="notes-panel">
      <div
        className={styles.resizeHandle}
        onMouseDown={handleResizeMouseDown}
        data-testid="notes-resize-handle"
      />
      <div className={styles.header}>
        <span className={styles.label}>{nodeLabel}</span>
        <button className={styles.closeBtn} onClick={onClose} title="Close notes">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
      </div>
      <div className={styles.iconRow}>
        <button
          className={`${styles.iconTrigger} ${icon ? styles.iconTriggerActive : ''}`}
          onClick={() => setPickerOpen(v => !v)}
          title={icon ? 'Change or remove icon' : 'Add icon'}
        >
          {icon ? <span className={styles.iconEmoji}>{icon}</span> : (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.2"/>
              <path d="M6 4v4M4 6h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
          )}
          <span className={styles.iconTriggerLabel}>{icon ? 'Icon' : 'Add icon'}</span>
        </button>
        {icon && (
          <button
            className={styles.iconRemove}
            onClick={() => { onChangeIcon(''); setPickerOpen(false); logger.logAction('node_icon_removed'); }}
            title="Remove icon"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        )}
        {pickerOpen && (
          <div className={styles.emojiPicker}>
            {EMOJIS.map(e => (
              <button
                key={e}
                className={`${styles.emojiBtn} ${e === icon ? styles.emojiBtnActive : ''}`}
                onClick={() => { const next = e === icon ? '' : e; onChangeIcon(next); setPickerOpen(false); logger.logAction('node_icon_set', { icon: next }); }}
                title={e}
              >
                {e}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className={styles.linkRow}>
        <svg className={styles.linkIcon} width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M5 7l2-2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          <path d="M6.5 8.5l-1 1a2 2 0 01-2.83-2.83l1-1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          <path d="M5.5 3.5l1-1a2 2 0 012.83 2.83l-1 1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
        </svg>
        <input
          className={styles.linkInput}
          type="text"
          value={link}
          onChange={e => onChangeLink(e.target.value)}
          onBlur={handleLinkBlur}
          placeholder="Add URL..."
        />
        {link && (
          <a
            className={styles.linkOpen}
            href={isInternalLink(link) ? link : link}
            target={isInternalLink(link) ? undefined : '_blank'}
            rel={isInternalLink(link) ? undefined : 'noopener noreferrer'}
            title={isInternalLink(link) ? 'Go to map' : 'Open link'}
            onClick={handleLinkClick}
          >
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
              <path d="M4 1H2a1 1 0 00-1 1v7a1 1 0 001 1h7a1 1 0 001-1V7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              <path d="M7 1h3v3M6 5l4-4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </a>
        )}
      </div>
      <div className={styles.fmtBar}>
        <FmtBtn command="bold" title="Bold (⌘B)">
          <strong>B</strong>
        </FmtBtn>
        <FmtBtn command="italic" title="Italic (⌘I)">
          <em>I</em>
        </FmtBtn>
        <FmtBtn command="underline" title="Underline (⌘U)">
          <u>U</u>
        </FmtBtn>
        <FmtBtn command="strikeThrough" title="Strikethrough">
          <s>S</s>
        </FmtBtn>
        <div className={styles.fmtSep} />
        <FmtBtn command="insertUnorderedList" title="Bullet list">
          <svg width="12" height="10" viewBox="0 0 12 10" fill="none">
            <circle cx="1.5" cy="2" r="1.2" fill="currentColor"/>
            <line x1="4" y1="2" x2="11" y2="2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            <circle cx="1.5" cy="5.5" r="1.2" fill="currentColor"/>
            <line x1="4" y1="5.5" x2="11" y2="5.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            <circle cx="1.5" cy="9" r="1.2" fill="currentColor"/>
            <line x1="4" y1="9" x2="11" y2="9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
        </FmtBtn>
        <FmtBtn command="insertOrderedList" title="Numbered list">
          <svg width="12" height="10" viewBox="0 0 12 10" fill="none">
            <text x="0" y="3.5" fontSize="4.5" fill="currentColor" fontFamily="sans-serif">1</text>
            <line x1="4" y1="2" x2="11" y2="2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            <text x="0" y="7" fontSize="4.5" fill="currentColor" fontFamily="sans-serif">2</text>
            <line x1="4" y1="5.5" x2="11" y2="5.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            <text x="0" y="10.5" fontSize="4.5" fill="currentColor" fontFamily="sans-serif">3</text>
            <line x1="4" y1="9" x2="11" y2="9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
        </FmtBtn>
        <div className={styles.fmtSep} />
        <button
          className={styles.fmtBtn}
          title="Indent list item (Tab)"
          onMouseDown={e => { e.preventDefault(); if (!isInList()) return; fmt('indent'); trackEvent('notesIndent'); }}
        >
          <svg width="12" height="10" viewBox="0 0 12 10" fill="none">
            <line x1="1" y1="1.5" x2="11" y2="1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            <line x1="4" y1="5" x2="11" y2="5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            <line x1="4" y1="8.5" x2="11" y2="8.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
        </button>
        <button
          className={styles.fmtBtn}
          title="Outdent list item (Shift+Tab)"
          onMouseDown={e => { e.preventDefault(); if (!isInList()) return; fmt('outdent'); trackEvent('notesOutdent'); }}
        >
          <svg width="12" height="10" viewBox="0 0 12 10" fill="none">
            <line x1="1" y1="1.5" x2="11" y2="1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            <line x1="1" y1="5" x2="8" y2="5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            <line x1="1" y1="8.5" x2="8" y2="8.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
        </button>
      </div>
      <div
        ref={editorRef}
        className={styles.editor}
        contentEditable
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          if (editorRef.current) {
            if (!editorRef.current.textContent?.trim()) {
              isInternalUpdate.current = true;
              editorRef.current.innerHTML = '';
              onChange('');
            } else {
              const linked = linkifyHtml(editorRef.current.innerHTML);
              if (linked !== editorRef.current.innerHTML) {
                isInternalUpdate.current = true;
                editorRef.current.innerHTML = linked;
                onChange(linked);
              }
            }
          }
          if (editorRef.current?.innerHTML) logger.logAction('node_notes_edited');
        }}
        onPaste={(e) => {
          e.preventDefault();
          const text = e.clipboardData?.getData('text/plain') ?? '';
          if (!text) return;
          const selection = window.getSelection();
          if (!selection || selection.rangeCount === 0) return;
          const range = selection.getRangeAt(0);
          range.deleteContents();
          const frag = document.createDocumentFragment();
          const tmp = document.createTextNode(text);
          frag.appendChild(tmp);
          if (/https?:\/\//.test(text)) {
            // linkifyNode works on the live DOM fragment in-place
            linkifyNode(frag);
          }
          range.insertNode(frag);
          range.collapse(false);
          selection.removeAllRanges();
          selection.addRange(range);
          handleInput();
        }}
        onMouseDown={(e) => {
          const target = e.target as HTMLElement;
          if (target.tagName === 'A' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            window.open((target as HTMLAnchorElement).href, '_blank', 'noopener');
          }
        }}
        title="Cmd+click links to open them"
        data-placeholder="Add notes..."
      />
    </div>
  );
}
