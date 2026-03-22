import { useState, useCallback } from 'react';
import { useAuth } from './contexts/AuthContext';
import { useMindMapStore } from './store/useMindMapStore';
import AuthGate from './components/AuthGate';
import Sidebar from './components/Sidebar';
import Canvas from './components/Canvas';
import { exportJson, exportSvg } from './utils/export';
import styles from './App.module.css';

export default function App() {
  const { user, signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const {
    maps,
    activeMapId,
    createMap,
    deleteMap,
    renameMap,
    switchMap,
    saveView,
    addNode,
    updateNode,
    deleteNode,
    reparentNode,
    addLink,
    updateLink,
    deleteLink,
    applyAutoLayout,
  } = useMindMapStore(user?.uid ?? null);

  const activeMap = activeMapId ? maps[activeMapId] : null;

  const handleSelectMap = useCallback((mapId: string) => {
    switchMap(mapId);
    setSidebarOpen(false);
  }, [switchMap]);

  return (
    <AuthGate>
      <div className={styles.app}>
        <button className={styles.menuBtn} onClick={() => setSidebarOpen(v => !v)} aria-label="Toggle sidebar">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M2 4.5h14M2 9h14M2 13.5h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
        {sidebarOpen && <div className={styles.overlay} onClick={() => setSidebarOpen(false)} />}
        <div className={`${styles.sidebarWrap} ${sidebarOpen ? styles.sidebarOpen : ''}`}>
          <Sidebar
            maps={maps}
            activeMapId={activeMapId}
            onSelect={handleSelectMap}
            onCreate={createMap}
            onDelete={deleteMap}
            onRename={renameMap}
            user={user}
            onSignOut={signOut}
          />
        </div>
        <Canvas
          key={activeMapId}
          map={activeMap}
          onSaveView={saveView}
          onAddNode={addNode}
          onUpdateNode={updateNode}
          onDeleteNode={deleteNode}
          onReparentNode={reparentNode}
          onAddLink={addLink}
          onUpdateLink={updateLink}
          onDeleteLink={deleteLink}
          onAutoLayout={applyAutoLayout}
          onExportJson={exportJson}
          onExportImg={exportSvg}
        />
      </div>
    </AuthGate>
  );
}
