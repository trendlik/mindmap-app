import { useState, useCallback, useEffect, useRef } from 'react';
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

  const initialNodeFocusDone = useRef(false);
  // Deep-link map id + node id, both captured at first render (before the
  // hash-writing effect below can overwrite location.hash), and consumed
  // together once the map becomes available in `maps` (Firestore arrives
  // after mount). Capturing the node id here too — rather than re-reading
  // the live hash in the effect below — matters because the `[activeMapId]`
  // effect may have already pushState'd `#activeMapId` over the deep link by
  // the time `maps` resolves, which would otherwise make the node segment
  // silently disappear. Cleared by any user-initiated map switch
  // (handleSelectMap / handleCreateMap) so neither half can later yank the
  // user back onto, or refocus a node on, a map they've since navigated away
  // from.
  const pendingDeepLink = useRef(location.hash.slice(1).split('/'));

  const handleNodeFocus = useCallback((mapId: string, nodeId: string) => {
    if (mapId !== activeMapId) switchMap(mapId);
    setFocusedNode({ mapId, nodeId });
  }, [activeMapId, switchMap]);

  // Apply the INITIAL deep link (#mapId or #mapId/nodeId) once `maps` has loaded.
  // Consumes the id(s) captured at first render so this never overrides a later
  // in-app map switch (e.g. creating a new map).
  useEffect(() => {
    const [deepLinkMapId, deepLinkNodeId] = pendingDeepLink.current;
    if (deepLinkMapId && Object.prototype.hasOwnProperty.call(maps, deepLinkMapId)) {
      pendingDeepLink.current = [];
      if (deepLinkMapId !== activeMapId) switchMap(deepLinkMapId);
      if (!initialNodeFocusDone.current && deepLinkNodeId && Object.prototype.hasOwnProperty.call(maps[deepLinkMapId].nodes, deepLinkNodeId)) {
        initialNodeFocusDone.current = true;
        handleNodeFocus(deepLinkMapId, deepLinkNodeId);
      }
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
      if (hashMapId && Object.prototype.hasOwnProperty.call(maps, hashMapId)) {
        switchMap(hashMapId);
        if (hashNodeId) {
          handleNodeFocus(hashMapId, hashNodeId);
        }
      }
    }
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [maps, switchMap, handleNodeFocus]);

  useEffect(() => {
    const base = 'Mind Maps';
    const name = user ? activeMap?.name?.trim() : '';
    document.title = name ? `${base} — ${name}` : base;
  }, [user, activeMap?.name]);

  const handleSelectMap = useCallback((mapId: string) => {
    // A deliberate map switch consumes any still-armed deep link, so a late
    // Firestore snapshot for the deep-linked map can't later yank the user
    // (or refocus a node) back onto a map they've already navigated away from.
    pendingDeepLink.current = [];
    switchMap(mapId);
    trackEvent('switchMap');
    setFocusedNode(null);
    if (window.innerWidth <= 640) setSidebarOpen(false);
  }, [switchMap, trackEvent]);

  const handleCreateMap = useCallback((name?: string): string => {
    pendingDeepLink.current = [];
    const mapId = createMap(name);
    trackEvent('createMap');
    return mapId;
  }, [createMap, trackEvent]);

  const handleDeleteMap = useCallback((mapId: string, mapsRecord: Record<string, MindMap>) => {
    deleteMap(mapId, mapsRecord);
    trackEvent('deleteMap');
  }, [deleteMap, trackEvent]);

  const handleRenameMap = useCallback((mapId: string, name: string, syncRootLabel?: boolean) => {
    renameMap(mapId, name, syncRootLabel);
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
