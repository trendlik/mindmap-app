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
  onReorder: (newOrder: string[]) => void;
  user: User | null;
  onSignOut: () => void;
}

export default function Sidebar({ maps, mapOrder, activeMapId, onSelect, onCreate, onDelete, onRename, onReorder, user, onSignOut }: SidebarProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [width, setWidth] = useState(210);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  // Drag & drop state
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

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

      <nav className={styles.list}>
        {mapOrder.filter(id => maps[id]).map((id, index) => {
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
                onClick={() => onSelect(id)}
                onDoubleClick={() => startRename(id, m.name)}
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
