import styles from './NotesPanel.module.css';

interface NotesPanelProps {
  nodeLabel: string;
  notes: string;
  onChange: (notes: string) => void;
  onClose: () => void;
}

export default function NotesPanel({ nodeLabel, notes, onChange, onClose }: NotesPanelProps) {
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
      <textarea
        className={styles.textarea}
        value={notes}
        onChange={e => onChange(e.target.value)}
        placeholder="Add notes..."
        autoFocus
      />
    </div>
  );
}
