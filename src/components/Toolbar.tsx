import type { CustomLink } from '../store/useMindMapStore';
import styles from './Toolbar.module.css';

interface ToolbarProps {
  onAddChild: () => void;
  onAddSibling: () => void;
  onDelete: () => void;
  onToggleNotes: () => void;
  onStartLink: () => void;
  onStartReparent: () => void;
  onToggleLinkStyle: () => void;
  onToggleLinkStroke: () => void;
  onSetLinkStyle: (s: CustomLink['style']) => void;
  onSetLinkStroke: (s: CustomLink['stroke']) => void;
  onToggleCollapse: () => void;
  canCollapse: boolean;
  isCollapsed: boolean;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onLayout: () => void;
  onFitView: () => void;
  onExportJson: () => void;
  onExportImg: () => void;
  hasSelected: boolean;
  notesOpen: boolean;
  isLinking: boolean;
  isReparenting: boolean;
  canReparent: boolean;
  selectedLink: CustomLink | null;
  linkStyle: CustomLink['style'];
  linkStroke: CustomLink['stroke'];
}

export default function Toolbar(props: ToolbarProps) {
  const {
    onAddChild, onAddSibling, onDelete, onToggleNotes, onStartLink, onStartReparent,
    onToggleLinkStyle, onToggleLinkStroke, onSetLinkStyle, onSetLinkStroke,
    onToggleCollapse, canCollapse, isCollapsed,
    onUndo, onRedo, canUndo, canRedo,
    onLayout, onFitView, onExportJson, onExportImg,
    hasSelected, notesOpen, isLinking, isReparenting, canReparent, selectedLink, linkStyle, linkStroke,
  } = props;

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
      <button className={`${styles.btn} ${isLinking ? styles.active : ''}`} onClick={onStartLink} disabled={!hasSelected && !isLinking}>
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
          <path d="M2 9L9 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          <path d="M6.5 2H9V4.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        link
      </button>
      <button className={`${styles.btn} ${isReparenting ? styles.active : ''}`} onClick={onStartReparent} disabled={!canReparent && !isReparenting}>
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
          <path d="M5.5 1v7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          <path d="M3 6l2.5 2.5L8 6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        move
      </button>
      <button className={`${styles.btn} ${styles.danger}`} onClick={onDelete} disabled={!hasSelected && !selectedLink}>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
        delete
      </button>
      <button className={`${styles.btn} ${notesOpen ? styles.active : ''}`} onClick={onToggleNotes} disabled={!hasSelected}>
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><rect x="1.5" y="1.5" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.2"/><path d="M3.5 4h4M3.5 6h2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
        notes
      </button>
      <button className={styles.btn} onClick={onToggleCollapse} disabled={!canCollapse} title={isCollapsed ? 'Expand children' : 'Collapse children'}>
        {isCollapsed ? (
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
            <path d="M3 4.5l2.5 2.5L8 4.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        ) : (
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
            <path d="M3 6.5l2.5-2.5L8 6.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
        {isCollapsed ? 'expand' : 'collapse'}
      </button>

      {/* Link style controls: shown when creating a link or editing one */}
      {(isLinking || selectedLink) && (
        <>
          <div className={styles.sep} />
          <button
            className={`${styles.btn} ${styles.small}`}
            onClick={() => {
              if (selectedLink) onToggleLinkStyle();
              else onSetLinkStyle(linkStyle === 'arrow' ? 'line' : 'arrow');
            }}
            title={selectedLink ? `Style: ${selectedLink.style}` : `Style: ${linkStyle}`}
          >
            {(selectedLink?.style ?? linkStyle) === 'arrow' ? (
              <svg width="14" height="10" viewBox="0 0 14 10" fill="none">
                <path d="M1 5h10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                <path d="M9 2l3 3-3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            ) : (
              <svg width="14" height="10" viewBox="0 0 14 10" fill="none">
                <path d="M1 5h12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
            )}
          </button>
          <button
            className={`${styles.btn} ${styles.small}`}
            onClick={() => {
              if (selectedLink) onToggleLinkStroke();
              else onSetLinkStroke(linkStroke === 'solid' ? 'dashed' : 'solid');
            }}
            title={selectedLink ? `Stroke: ${selectedLink.stroke}` : `Stroke: ${linkStroke}`}
          >
            {(selectedLink?.stroke ?? linkStroke) === 'solid' ? (
              <svg width="14" height="4" viewBox="0 0 14 4" fill="none">
                <path d="M1 2h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            ) : (
              <svg width="14" height="4" viewBox="0 0 14 4" fill="none">
                <path d="M1 2h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="3 2.5"/>
              </svg>
            )}
          </button>
        </>
      )}

      <div className={styles.sep} />
      <button className={styles.btn} onClick={onUndo} disabled={!canUndo} title="Undo (⌘Z)">
        <svg width="11" height="10" viewBox="0 0 11 10" fill="none"><path d="M3 3.5L1 1.5L3 -.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" transform="translate(0,2)"/><path d="M1 3.5h5.5a3 3 0 010 6H4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
        undo
      </button>
      <button className={styles.btn} onClick={onRedo} disabled={!canRedo} title="Redo (⌘⇧Z)">
        <svg width="11" height="10" viewBox="0 0 11 10" fill="none"><path d="M8 3.5L10 1.5L8 -.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" transform="translate(0,2)"/><path d="M10 3.5H4.5a3 3 0 000 6H7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
        redo
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
