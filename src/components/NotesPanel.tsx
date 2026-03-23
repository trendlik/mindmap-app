import styles from './NotesPanel.module.css';

interface NotesPanelProps {
  nodeLabel: string;
  notes: string;
  link: string;
  onChange: (notes: string) => void;
  onChangeLink: (link: string) => void;
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

export default function NotesPanel({ nodeLabel, notes, link, onChange, onChangeLink, onClose }: NotesPanelProps) {
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
      <textarea
        className={styles.textarea}
        value={notes}
        onChange={e => onChange(e.target.value)}
        placeholder="Add notes..."
      />
    </div>
  );
}
