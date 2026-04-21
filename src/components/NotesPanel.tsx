import { useRef, useEffect, useCallback, useState } from 'react';
import styles from './NotesPanel.module.css';

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
  const isInternalUpdate = useRef(false);
  const [pickerOpen, setPickerOpen] = useState(false);

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
    onChange(editorRef.current.innerHTML);
  }, [onChange]);

  function handleLinkBlur() {
    const normalized = normalizeLink(link);
    if (normalized !== link) onChangeLink(normalized);
  }

  function handleLinkClick(e: React.MouseEvent) {
    if (isInternalLink(link)) {
      e.preventDefault();
      location.hash = link;
    }
  }

  return (
    <div className={styles.panel}>
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
            onClick={() => { onChangeIcon(''); setPickerOpen(false); }}
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
                onClick={() => { onChangeIcon(e === icon ? '' : e); setPickerOpen(false); }}
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
      </div>
      <div
        ref={editorRef}
        className={styles.editor}
        contentEditable
        onInput={handleInput}
        data-placeholder="Add notes..."
      />
    </div>
  );
}
