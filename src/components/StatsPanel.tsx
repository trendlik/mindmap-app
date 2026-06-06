import { useState, useEffect } from 'react';
import { useUsageStats } from '../contexts/UsageStatsContext';
import type { FeatureKey, UsageStats } from '../contexts/UsageStatsContext';
import styles from './StatsPanel.module.css';

const FEATURE_LABELS: Record<FeatureKey, string> = {
  addChild: 'Add child',
  addSibling: 'Add sibling',
  deleteNode: 'Delete node',
  autoLayout: 'Auto layout',
  fitView: 'Fit view',
  exportJson: 'Export JSON',
  exportSvg: 'Export SVG',
  exportMd: 'Export MD',
  createMap: 'Create map',
  renameMap: 'Rename map',
  deleteMap: 'Delete map',
  switchMap: 'Switch map',
  archiveMap: 'Archive map',
  search: 'Search',
  nodeDrag: 'Node drag',
  nodeInlineEdit: 'Inline edit',
  pan: 'Pan canvas',
  zoom: 'Zoom canvas',
  undo: 'Undo',
  redo: 'Redo',
  addLink: 'Add link',
  reparent: 'Move node',
  toggleNotes: 'Toggle notes',
  collapseNode: 'Collapse node',
  searchInMap: 'Search in map',
  aiChat: 'AI Chat',
  aiChatCopy: 'AI Chat Copy',
  llmSettings: 'LLM Settings',
  notesIndent: 'Notes indent',
  notesOutdent: 'Notes outdent',
  toggleNumbering: 'Toggle numbering',
  notesPanelResize: 'Notes panel resize',
  map_description_edit: 'Map description edit',
  copyNodeLink: 'Copy node link',
  nodeLineBreak: 'Node line break',
};

const ALL_FEATURES = Object.keys(FEATURE_LABELS) as FeatureKey[];

function formatMs(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

interface StatsPanelProps {
  onClose: () => void;
}

export default function StatsPanel({ onClose }: StatsPanelProps) {
  const { getStats, resetStats } = useUsageStats();
  const [stats, setStats] = useState<UsageStats>(() => getStats());

  useEffect(() => {
    setStats(getStats());
  }, [getStats]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const rows = ALL_FEATURES
    .map(key => ({
      key,
      label: FEATURE_LABELS[key],
      count: stats.features[key]?.count ?? 0,
      lastUsed: stats.features[key]?.lastUsed ?? null,
    }))
    .sort((a, b) => b.count - a.count);

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.panel} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Usage stats">
        <div className={styles.header}>
          <span className={styles.title}>Usage stats</span>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
        <div className={styles.totalTime}>
          Total active time: <strong>{formatMs(stats.totalActiveMs)}</strong>
          <button className={styles.resetBtn} onClick={() => { resetStats(); setStats(getStats()); }}>Reset</button>
        </div>
        <div className={styles.since}>
          Since {new Date(stats.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.thFeature}>Feature</th>
                <th className={styles.thCount}>Count</th>
                <th className={styles.thLast}>Last used</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.key} className={row.count === 0 ? styles.zeroRow : undefined}>
                  <td className={styles.tdFeature}>{row.label}</td>
                  <td className={styles.tdCount}>{row.count}</td>
                  <td className={styles.tdLast}>{row.lastUsed ? relativeTime(row.lastUsed) : 'never'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
