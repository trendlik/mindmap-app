import styles from './Toolbar.module.css';

interface ToolbarProps {
  onAddChild: () => void;
  onAddSibling: () => void;
  onDelete: () => void;
  onToggleNotes: () => void;
  onLayout: () => void;
  onFitView: () => void;
  onExportJson: () => void;
  onExportImg: () => void;
  hasSelected: boolean;
  notesOpen: boolean;
}

export default function Toolbar({ onAddChild, onAddSibling, onDelete, onToggleNotes, onLayout, onFitView, onExportJson, onExportImg, hasSelected, notesOpen }: ToolbarProps) {
  return (
    <div className={styles.toolbar}>
      <button className={styles.btn} onClick={onAddChild}>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M5 1v8M1 5h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
        child
      </button>
      <button className={styles.btn} onClick={onAddSibling}>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1 5h8M5 1v8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
        sibling
      </button>
      <button className={`${styles.btn} ${styles.danger}`} onClick={onDelete} disabled={!hasSelected}>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
        delete
      </button>
      <button className={`${styles.btn} ${notesOpen ? styles.active : ''}`} onClick={onToggleNotes} disabled={!hasSelected}>
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><rect x="1.5" y="1.5" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.2"/><path d="M3.5 4h4M3.5 6h2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
        notes
      </button>
      <div className={styles.sep} />
      <button className={styles.btn} onClick={onLayout}>
        <svg width="11" height="10" viewBox="0 0 11 10" fill="none"><rect x="1" y="1" width="3" height="3" rx="1" stroke="currentColor" strokeWidth="1.2"/><rect x="7" y="1" width="3" height="3" rx="1" stroke="currentColor" strokeWidth="1.2"/><rect x="7" y="6" width="3" height="3" rx="1" stroke="currentColor" strokeWidth="1.2"/><path d="M4 2.5h1.5a1 1 0 011 1v3" stroke="currentColor" strokeWidth="1.2"/></svg>
        layout
      </button>
      <button className={styles.btn} onClick={onFitView}>
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M1 4V1h3M7 1h3v3M10 7v3H7M4 10H1V7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
        fit
      </button>
      <div className={styles.sep} />
      <button className={styles.btn} onClick={onExportJson}>JSON</button>
      <button className={styles.btn} onClick={onExportImg}>SVG</button>
    </div>
  );
}
