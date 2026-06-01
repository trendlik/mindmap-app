import { useState, useEffect } from 'react';
import type { CustomLink, MapNumbering } from '../store/useMindMapStore';
import { useUsageStats } from '../contexts/UsageStatsContext';
import styles from './Toolbar.module.css';

interface ToolbarProps {
  onAddChild: () => void;
  onAddSibling: () => void;
  onDelete: () => void;
  onToggleNotes: () => void;
  onStartLink: () => void;
  onStartReparent: () => void;
  onToggleLinkStroke: () => void;
  onSetLinkStroke: (s: CustomLink['stroke']) => void;
  onToggleArrowFrom: () => void;
  onToggleArrowTo: () => void;
  onSetArrowFrom: (v: boolean) => void;
  onSetArrowTo: (v: boolean) => void;
  onSetLinkLabel: (label: string) => void;
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
  onExportMd: () => void;
  onShowShortcuts: () => void;
  onOpenChat: () => void;
  onOpenSettings: () => void;
  hasSelected: boolean;
  notesOpen: boolean;
  isLinking: boolean;
  isReparenting: boolean;
  canReparent: boolean;
  selectedLink: CustomLink | null;
  linkArrowFrom: boolean;
  linkArrowTo: boolean;
  linkStroke: CustomLink['stroke'];
  numberingEnabled: boolean;
  numberingStyle: MapNumbering['style'];
  onToggleNumbering: () => void;
  onSetNumberingStyle: (style: MapNumbering['style']) => void;
  onCopyNodeLink?: () => Promise<void>;
}

export default function Toolbar(props: ToolbarProps) {
  const { trackEvent } = useUsageStats();
  const [copied, setCopied] = useState(false);
  const {
    onAddChild, onAddSibling, onDelete, onToggleNotes, onStartLink, onStartReparent,
    onToggleLinkStroke, onSetLinkStroke,
    onToggleArrowFrom, onToggleArrowTo, onSetArrowFrom, onSetArrowTo, onSetLinkLabel,
    onToggleCollapse, canCollapse, isCollapsed,
    onUndo, onRedo, canUndo, canRedo,
    onLayout, onFitView, onExportJson, onExportImg, onExportMd, onShowShortcuts, onOpenChat, onOpenSettings,
    hasSelected, notesOpen, isLinking, isReparenting, canReparent,
    selectedLink, linkArrowFrom, linkArrowTo, linkStroke,
    numberingEnabled, numberingStyle, onToggleNumbering, onSetNumberingStyle,
    onCopyNodeLink,
  } = props;

  useEffect(() => {
    if (!hasSelected) setCopied(false);
  }, [hasSelected]);

  const showArrowFrom = selectedLink ? (selectedLink.arrowFrom ?? false) : linkArrowFrom;
  const showArrowTo = selectedLink ? (selectedLink.arrowTo ?? (selectedLink.style === 'arrow')) : linkArrowTo;
  const showStroke = selectedLink?.stroke ?? linkStroke;

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
      <button className={`${styles.btn} ${isLinking ? styles.active : ''}`} onClick={() => { onStartLink(); if (!isLinking) trackEvent('addLink'); }} disabled={!hasSelected && !isLinking}>
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
          <path d="M2 9L9 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          <path d="M6.5 2H9V4.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        link
      </button>
      <button className={`${styles.btn} ${isReparenting ? styles.active : ''}`} onClick={() => { onStartReparent(); if (!isReparenting) trackEvent('reparent'); }} disabled={!canReparent && !isReparenting}>
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
      <button className={`${styles.btn} ${notesOpen ? styles.active : ''}`} onClick={() => { onToggleNotes(); trackEvent('toggleNotes'); }} disabled={!hasSelected}>
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><rect x="1.5" y="1.5" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.2"/><path d="M3.5 4h4M3.5 6h2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
        notes
      </button>
      <button className={styles.btn} onClick={() => { onToggleCollapse(); trackEvent('collapseNode'); }} disabled={!canCollapse} title={isCollapsed ? 'Expand children' : 'Collapse children'}>
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
      {hasSelected && (
        <button
          className={styles.btn}
          onClick={async () => {
            await onCopyNodeLink?.();
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          title="Copy link to this node"
          data-testid="copy-node-link"
        >
          {copied ? (
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
              <path d="M2 5.5l2.5 2.5L9 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          ) : (
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
              <rect x="4" y="1.5" width="5.5" height="6.5" rx="1.2" stroke="currentColor" strokeWidth="1.2" fill="none"/>
              <path d="M3 3H2a.7.7 0 00-.7.7v5.6c0 .4.3.7.7.7h5.6a.7.7 0 00.7-.7V8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
          )}
          {copied ? 'copied!' : 'copy link'}
        </button>
      )}

      <button
        className={`${styles.btn} ${numberingEnabled ? styles.active : ''}`}
        onClick={onToggleNumbering}
        title="Toggle node numbering"
        data-testid="numbering-toggle"
      >
        #
      </button>
      {numberingEnabled && (
        <>
          <button
            className={`${styles.btn} ${styles.small} ${numberingStyle === 'prefix' ? styles.active : ''}`}
            onClick={() => onSetNumberingStyle('prefix')}
            title="Prefix style: number inside node"
            data-testid="numbering-style-prefix"
          >
            <svg width="14" height="10" viewBox="0 0 14 10" fill="none">
              <text x="0" y="9" fontSize="8" fontFamily="sans-serif" fill="currentColor">1.2</text>
              <rect x="7" y="1" width="6" height="8" rx="1.5" stroke="currentColor" strokeWidth="1" fill="none"/>
            </svg>
          </button>
          <button
            className={`${styles.btn} ${styles.small} ${numberingStyle === 'badge' ? styles.active : ''}`}
            onClick={() => onSetNumberingStyle('badge')}
            title="Badge style: number as corner badge"
            data-testid="numbering-style-badge"
          >
            <svg width="14" height="10" viewBox="0 0 14 10" fill="none">
              <rect x="4" y="2" width="9" height="7" rx="1.5" stroke="currentColor" strokeWidth="1" fill="none"/>
              <rect x="0" y="0" width="8" height="6" rx="1.5" fill="currentColor" opacity="0.25"/>
              <text x="1" y="5.5" fontSize="5" fontFamily="sans-serif" fill="currentColor">1.2</text>
            </svg>
          </button>
        </>
      )}

      {/* Link style controls: shown when creating a link or editing one */}
      {(isLinking || selectedLink) && (
        <>
          <div className={styles.sep} />
          {/* Arrow at start (from) */}
          <button
            className={`${styles.btn} ${styles.small} ${showArrowFrom ? styles.active : ''}`}
            onClick={() => {
              if (selectedLink) onToggleArrowFrom();
              else onSetArrowFrom(!linkArrowFrom);
            }}
            title="Arrow at start"
          >
            <svg width="14" height="10" viewBox="0 0 14 10" fill="none">
              <path d="M4 5h9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              <path d="M5 2L2 5l3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          {/* Arrow at end (to) */}
          <button
            className={`${styles.btn} ${styles.small} ${showArrowTo ? styles.active : ''}`}
            onClick={() => {
              if (selectedLink) onToggleArrowTo();
              else onSetArrowTo(!linkArrowTo);
            }}
            title="Arrow at end"
          >
            <svg width="14" height="10" viewBox="0 0 14 10" fill="none">
              <path d="M1 5h9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              <path d="M9 2l3 3-3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          {/* Stroke style */}
          <button
            className={`${styles.btn} ${styles.small}`}
            onClick={() => {
              if (selectedLink) onToggleLinkStroke();
              else onSetLinkStroke(linkStroke === 'solid' ? 'dashed' : 'solid');
            }}
            title={`Stroke: ${showStroke}`}
          >
            {showStroke === 'solid' ? (
              <svg width="14" height="4" viewBox="0 0 14 4" fill="none">
                <path d="M1 2h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            ) : (
              <svg width="14" height="4" viewBox="0 0 14 4" fill="none">
                <path d="M1 2h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="3 2.5"/>
              </svg>
            )}
          </button>
          {/* Label input (only for existing selected link) */}
          {selectedLink && (
            <input
              className={styles.linkLabel}
              type="text"
              value={selectedLink.label || ''}
              onChange={e => onSetLinkLabel(e.target.value)}
              placeholder="label..."
            />
          )}
        </>
      )}

      <div className={styles.sep} />
      <button className={styles.btn} onClick={() => { onUndo(); trackEvent('undo'); }} disabled={!canUndo} title="Undo (⌘Z)">
        <svg width="11" height="10" viewBox="0 0 11 10" fill="none"><path d="M3 3.5L1 1.5L3 -.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" transform="translate(0,2)"/><path d="M1 3.5h5.5a3 3 0 010 6H4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
        undo
      </button>
      <button className={styles.btn} onClick={() => { onRedo(); trackEvent('redo'); }} disabled={!canRedo} title="Redo (⌘⇧Z)">
        <svg width="11" height="10" viewBox="0 0 11 10" fill="none"><path d="M8 3.5L10 1.5L8 -.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" transform="translate(0,2)"/><path d="M10 3.5H4.5a3 3 0 000 6H7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
        redo
      </button>
      <div className={styles.sep} />
      <button className={styles.btn} onClick={() => { onLayout(); trackEvent('autoLayout'); }}>
        <svg width="11" height="10" viewBox="0 0 11 10" fill="none"><rect x="1" y="1" width="3" height="3" rx="1" stroke="currentColor" strokeWidth="1.2"/><rect x="7" y="1" width="3" height="3" rx="1" stroke="currentColor" strokeWidth="1.2"/><rect x="7" y="6" width="3" height="3" rx="1" stroke="currentColor" strokeWidth="1.2"/><path d="M4 2.5h1.5a1 1 0 011 1v3" stroke="currentColor" strokeWidth="1.2"/></svg>
        layout
      </button>
      <button className={styles.btn} onClick={onFitView}>
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M1 4V1h3M7 1h3v3M10 7v3H7M4 10H1V7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
        fit
      </button>
      <div className={styles.sep} />
      <button className={styles.btn} onClick={() => { onExportJson(); trackEvent('exportJson'); }}>JSON</button>
      <button className={styles.btn} onClick={() => { onExportImg(); trackEvent('exportSvg'); }}>SVG</button>
      <button className={styles.btn} onClick={() => { onExportMd(); trackEvent('exportMd'); }}>MD</button>
      <div className={`${styles.sep} ${styles.shortcutsSep}`} />
      <button className={`${styles.btn} ${styles.shortcutsBtn}`} onClick={onShowShortcuts} title="Keyboard shortcuts (?)">?</button>
      <div className={styles.sep} />
      <button className={styles.btn} onClick={() => { onOpenChat(); trackEvent('aiChat'); }} title="AI Chat">✦</button>
      <button className={styles.btn} onClick={() => { onOpenSettings(); trackEvent('llmSettings'); }} title="LLM Settings">⚙</button>
    </div>
  );
}
