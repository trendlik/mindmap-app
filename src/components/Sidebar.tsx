import { useState, useRef, useEffect, useCallback } from 'react';
import type { User } from 'firebase/auth';
import type { MindMap } from '../store/useMindMapStore';
import styles from './Sidebar.module.css';

const MIN_WIDTH = 150;
const MAX_WIDTH = 400;

interface SidebarProps {
  maps: Record<string, MindMap>;
  mapOrder: string[];
  activeMapId: string;
  onSelect: (mapId: string) => void;
  onCreate: (name?: string) => void;
  onDelete: (mapId: string, maps: Record<string, MindMap>) => void;
  onRename: (mapId: string, name: string) => void;
  onUpdateLabels: (mapId: string, labels: string[]) => void;
  onReorder: (newOrder: string[]) => void;
  user: User | null;
  onSignOut: () => void;
}

function applySearch(maps: Record<string, MindMap>, mapOrder: string[], query: string): string[] {
  const ids = mapOrder.filter(id => maps[id]);
  if (!query.trim()) return ids;
  const labelMatch = query.match(/^label:(.+)$/i);
  if (labelMatch) {
    const expr = labelMatch[1];
    const mapLabels = (id: string) => (maps[id].labels ?? []).map(l => l.toLowerCase());
    if (expr.includes('|')) {
      const tags = expr.split('|').map(t => t.trim().toLowerCase());
      return ids.filter(id => tags.some(t => mapLabels(id).includes(t)));
    }
    if (expr.includes('&')) {
      const tags = expr.split('&').map(t => t.trim().toLowerCase());
      return ids.filter(id => tags.every(t => mapLabels(id).includes(t)));
    }
    const tag = expr.trim().toLowerCase();
    return ids.filter(id => mapLabels(id).includes(tag));
  }
  const q = query.trim().toLowerCase();
  return ids.filter(id => maps[id].name.toLowerCase().includes(q));
}

export default function Sidebar({ maps, mapOrder, activeMapId, onSelect, onCreate, onDelete, onRename, onUpdateLabels, onReorder, user, onSignOut }: SidebarProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [width, setWidth] = useState(210);
  const [searchQuery, setSearchQuery] = useState('');
  const [labelEditingId, setLabelEditingId] = useState<string | null>(null);
  const [labelInput, setLabelInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const dragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Drag & drop state
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  // Close label editor when clicking outside
  useEffect(() => {
    if (!labelEditingId) return;
    function handleDocClick() {
      setLabelEditingId(null);
    }
    document.addEventListener('click', handleDocClick);
    return () => document.removeEventListener('click', handleDocClick);
  }, [labelEditingId]);

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!dragging.current) return;
    const delta = e.clientX - startX.current;
    setWidth(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth.current + delta)));
  }, []);

  const onMouseUp = useCallback(() => {
    dragging.current = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
  }, [onMouseMove]);

  function startResize(e: React.MouseEvent) {
    e.preventDefault();
    dragging.current = true;
    startX.current = e.clientX;
    startWidth.current = width;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }

  function startRename(id: string, name: string) {
    setEditingId(id);
    setEditValue(name);
  }

  function commitRename() {
    if (editingId) {
      const v = editValue.trim();
      if (v) onRename(editingId, v);
      setEditingId(null);
    }
  }

  function handleNewMap() {
    const name = window.prompt('Map name:', 'new map');
    if (name !== null) onCreate(name.trim() || 'new map');
  }

  return (
    <aside className={styles.sidebar} style={{ width, minWidth: width }}>
      <div className={styles.header}>
        <span className={styles.title}>maps</span>
        <button className={styles.newBtn} onClick={handleNewMap} title="New map">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      <div className={styles.searchWrap}>
        <input
          className={styles.searchInput}
          placeholder="Search or label:tag"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
      </div>

      <nav className={styles.list}>
        {applySearch(maps, mapOrder, searchQuery).map((id, index) => {
          const m = maps[id];
          const isDragged = draggedId === id;
          return (
            <div key={id} className={styles.itemWrap}>
              {dropIndex === index && draggedId !== id && (
                <div className={styles.dropLine} />
              )}
              <div
                className={`${styles.item} ${id === activeMapId ? styles.active : ''} ${isDragged ? styles.dragging : ''}`}
                draggable={editingId !== id}
                onClick={() => {
                  if (clickTimer.current) clearTimeout(clickTimer.current);
                  clickTimer.current = setTimeout(() => onSelect(id), 220);
                }}
                onDoubleClick={() => {
                  if (clickTimer.current) { clearTimeout(clickTimer.current); clickTimer.current = null; }
                  startRename(id, m.name);
                }}
                onDragStart={e => {
                  setDraggedId(id);
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onDragEnd={() => {
                  setDraggedId(null);
                  setDropIndex(null);
                }}
                onDragOver={e => {
                  e.preventDefault();
                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  const mid = rect.top + rect.height / 2;
                  setDropIndex(e.clientY < mid ? index : index + 1);
                }}
                onDrop={e => {
                  e.preventDefault();
                  if (!draggedId || draggedId === id) return;
                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  const mid = rect.top + rect.height / 2;
                  const insertAt = e.clientY < mid ? index : index + 1;
                  const newOrder = mapOrder.filter(oid => oid !== draggedId);
                  const draggedOrigIndex = mapOrder.indexOf(draggedId);
                  const adjustedInsert = insertAt > draggedOrigIndex ? insertAt - 1 : insertAt;
                  newOrder.splice(adjustedInsert, 0, draggedId);
                  onReorder(newOrder);
                  setDraggedId(null);
                  setDropIndex(null);
                }}
              >
                <div className={styles.dot} />
                {editingId === id ? (
                  <input
                    ref={inputRef}
                    className={styles.renameInput}
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    onBlur={commitRename}
                    onKeyDown={e => {
                      if (e.key === 'Enter') commitRename();
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                    onClick={e => e.stopPropagation()}
                  />
                ) : (
                  <span className={styles.name} title={m.name}>{m.name}</span>
                )}
                <button
                  className={styles.labelBtn}
                  onClick={e => {
                    e.stopPropagation();
                    setLabelEditingId(id === labelEditingId ? null : id);
                    setLabelInput('');
                  }}
                  title="Edit labels"
                >
                  <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                    <path d="M1 1h4.5l5.5 5.5-4.5 4.5L1 5.5V1z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
                    <circle cx="3.5" cy="3.5" r="0.8" fill="currentColor"/>
                  </svg>
                </button>
                {Object.keys(maps).length > 1 && (
                  <button
                    className={styles.delBtn}
                    onClick={e => {
                      e.stopPropagation();
                      if (window.confirm(`Delete "${m.name}"?`)) onDelete(id, maps);
                    }}
                    title="Delete map"
                  >
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  </button>
                )}
              </div>
              {(m.labels ?? []).length > 0 && (
                <div className={styles.labelChips}>
                  {(m.labels ?? []).map(l => (
                    <span key={l} className={styles.labelChip}>#{l}</span>
                  ))}
                </div>
              )}
              {labelEditingId === id && (
                <div className={styles.labelEditor} onClick={e => e.stopPropagation()}>
                  {(m.labels ?? []).length > 0 && (
                    <div className={styles.labelChipsEdit}>
                      {(m.labels ?? []).map(l => (
                        <span key={l} className={styles.labelChipEdit}>
                          #{l}
                          <button onClick={() => onUpdateLabels(id, (m.labels ?? []).filter(x => x !== l))}>×</button>
                        </span>
                      ))}
                    </div>
                  )}
                  <input
                    className={styles.labelInput}
                    placeholder="Add label…"
                    value={labelInput}
                    autoFocus
                    onChange={e => setLabelInput(e.target.value)}
                    onKeyDown={e => {
                      if ((e.key === 'Enter' || e.key === ',') && labelInput.trim()) {
                        e.preventDefault();
                        const newLabel = labelInput.trim();
                        if (newLabel && !(m.labels ?? []).includes(newLabel)) {
                          onUpdateLabels(id, [...(m.labels ?? []), newLabel]);
                        }
                        setLabelInput('');
                      }
                      if (e.key === 'Escape') setLabelEditingId(null);
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}
        {dropIndex === mapOrder.length && draggedId && (
          <div className={styles.dropLine} />
        )}
      </nav>

      <div className={styles.footer}>
        {user && (
          <div className={styles.userRow}>
            {user.photoURL && (
              <img className={styles.avatar} src={user.photoURL} alt="" referrerPolicy="no-referrer" />
            )}
            <span className={styles.userName}>{user.displayName || user.email}</span>
            <button className={styles.signOutBtn} onClick={onSignOut} title="Sign out">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M4.5 10.5H2.5a1 1 0 01-1-1v-7a1 1 0 011-1h2M8 8.5l2.5-2.5L8 3.5M10.5 6H4.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        )}
        <span className={styles.footerText}>{Object.keys(maps).length} map{Object.keys(maps).length !== 1 ? 's' : ''}</span>
      </div>
      <div className={styles.resizeHandle} onMouseDown={startResize} />
    </aside>
  );
}
