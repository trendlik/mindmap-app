import { useState, useRef, useEffect } from 'react';
import type { User } from 'firebase/auth';
import type { MindMap } from '../store/useMindMapStore';
import styles from './Sidebar.module.css';

interface SidebarProps {
  maps: Record<string, MindMap>;
  activeMapId: string;
  onSelect: (mapId: string) => void;
  onCreate: (name?: string) => void;
  onDelete: (mapId: string, maps: Record<string, MindMap>) => void;
  onRename: (mapId: string, name: string) => void;
  user: User | null;
  onSignOut: () => void;
}

export default function Sidebar({ maps, activeMapId, onSelect, onCreate, onDelete, onRename, user, onSignOut }: SidebarProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

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
    <aside className={styles.sidebar}>
      <div className={styles.header}>
        <span className={styles.title}>maps</span>
        <button className={styles.newBtn} onClick={handleNewMap} title="New map">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      <nav className={styles.list}>
        {Object.values(maps).map(m => (
          <div
            key={m.id}
            className={`${styles.item} ${m.id === activeMapId ? styles.active : ''}`}
            onClick={() => onSelect(m.id)}
            onDoubleClick={() => startRename(m.id, m.name)}
          >
            <div className={styles.dot} />
            {editingId === m.id ? (
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
              <span className={styles.name}>{m.name}</span>
            )}
            {Object.keys(maps).length > 1 && (
              <button
                className={styles.delBtn}
                onClick={e => {
                  e.stopPropagation();
                  if (window.confirm(`Delete "${m.name}"?`)) onDelete(m.id, maps);
                }}
                title="Delete map"
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
            )}
          </div>
        ))}
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
    </aside>
  );
}
