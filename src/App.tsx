import { useState, useCallback, useEffect } from 'react';
import { useAuth } from './contexts/AuthContext';
import { useMindMapStore } from './store/useMindMapStore';
import type { MindMap } from './store/useMindMapStore';
import { UsageStatsProvider, useUsageStats } from './contexts/UsageStatsContext';
import AuthGate from './components/AuthGate';
import Sidebar from './components/Sidebar';
import Canvas from './components/Canvas';
import { exportJson, exportSvg, exportMarkdown } from './utils/export';
import styles from './App.module.css';

function AppInner() {
  const { user, signOut } = useAuth();
  const { trackEvent } = useUsageStats();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(210);
  const [focusedNode, setFocusedNode] = useState<{ mapId: string; nodeId: string } | null>(null);
  const [highlightQuery, setHighlightQuery] = useState<string | undefined>(undefined);
  const {
    maps,
    activeMapId,
    mapOrder,
    createMap,
    deleteMap,
    renameMap,
    updateMapLabels,
    updateMapDescription,
    reorderMaps,
    switchMap,
    saveView,
    addNode,
    updateNode,
    deleteNode,
    reparentNode,
    addLink,
    updateLink,
    deleteLink,
    setMapArchived,
    updateMapNumbering,
    applyAutoLayout,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useMindMapStore(user?.uid ?? null);

  const activeMap = activeMapId ? maps[activeMapId] : null;

  const handleNodeFocus = useCallback((mapId: string, nodeId: string) => {
    if (mapId !== activeMapId) switchMap(mapId);
    setFocusedNode({ mapId, nodeId });
  }, [activeMapId, switchMap]);

  // Sync URL hash ↔ active map (supports #mapId and #mapId/nodeId)
  useEffect(() => {
    const [hashMapId, hashNodeId] = location.hash.slice(1).split('/');
    if (hashMapId && maps[hashMapId] && hashMapId !== activeMapId) {
      switchMap(hashMapId);
    }
    if (hashMapId && hashNodeId && maps[hashMapId]) {
      handleNodeFocus(hashMapId, hashNodeId);
    }
  }, [maps]);

  useEffect(() => {
    if (activeMapId) {
      const current = location.hash.slice(1).split('/')[0];
      if (current !== activeMapId) {
        history.pushState(null, '', '#' + activeMapId);
      }
    }
  }, [activeMapId]);

  useEffect(() => {
    function onHashChange() {
      const [hashMapId, hashNodeId] = location.hash.slice(1).split('/');
      if (hashMapId && maps[hashMapId]) {
        switchMap(hashMapId);
        if (hashNodeId) {
          handleNodeFocus(hashMapId, hashNodeId);
        }
      }
    }
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [maps, switchMap, handleNodeFocus]);

  const handleSelectMap = useCallback((mapId: string) => {
    switchMap(mapId);
    trackEvent('switchMap');
    setFocusedNode(null);
    if (window.innerWidth <= 640) setSidebarOpen(false);
  }, [switchMap, trackEvent]);

  const handleCreateMap = useCallback((name?: string) => {
    createMap(name);
    trackEvent('createMap');
  }, [createMap, trackEvent]);

  const handleDeleteMap = useCallback((mapId: string, mapsRecord: Record<string, MindMap>) => {
    deleteMap(mapId, mapsRecord);
    trackEvent('deleteMap');
  }, [deleteMap, trackEvent]);

  const handleRenameMap = useCallback((mapId: string, name: string) => {
    renameMap(mapId, name);
    trackEvent('renameMap');
  }, [renameMap, trackEvent]);

  const handleSetArchived = useCallback((mapId: string, archived: boolean) => {
    setMapArchived(mapId, archived);
    if (archived) trackEvent('archiveMap');
  }, [setMapArchived, trackEvent]);

  return (
    <AuthGate>
      <div className={styles.app}>
        <button className={`${styles.menuBtn} ${sidebarOpen ? styles.menuBtnShifted : ''}`} onClick={() => setSidebarOpen(v => !v)} aria-label="Toggle sidebar">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            {sidebarOpen
              ? <path d="M5 4.5L13 9L5 13.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              : <path d="M2 4.5h14M2 9h14M2 13.5h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            }
          </svg>
        </button>
        {sidebarOpen && <div className={styles.overlay} onClick={() => setSidebarOpen(false)} />}
        <div
          className={`${styles.sidebarWrap} ${!sidebarOpen ? styles.sidebarCollapsed : ''}`}
          style={sidebarOpen ? { width: sidebarWidth } : undefined}
        >
          <Sidebar
            maps={maps}
            mapOrder={mapOrder}
            activeMapId={activeMapId}
            onSelect={handleSelectMap}
            onCreate={handleCreateMap}
            onDelete={handleDeleteMap}
            onRename={handleRenameMap}
            onUpdateLabels={(mapId, labels) => updateMapLabels(mapId, labels)}
            onUpdateDescription={updateMapDescription}
            onReorder={reorderMaps}
            onSetArchived={handleSetArchived}
            onWidthChange={setSidebarWidth}
            onNodeFocus={handleNodeFocus}
            onHighlightQueryChange={setHighlightQuery}
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
          onUndo={undo}
          onRedo={redo}
          canUndo={canUndo}
          canRedo={canRedo}
          onExportJson={exportJson}
          onExportImg={exportSvg}
          onExportMd={exportMarkdown}
          highlightQuery={highlightQuery}
          focusNodeId={focusedNode?.mapId === activeMapId ? focusedNode.nodeId : undefined}
          onUpdateMapNumbering={updateMapNumbering}
        />
      </div>
    </AuthGate>
  );
}

export default function App() {
  const { user } = useAuth();
  return (
    <UsageStatsProvider uid={user?.uid ?? null}>
      <AppInner />
    </UsageStatsProvider>
  );
}
