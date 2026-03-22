import { useAuth } from './contexts/AuthContext';
import { useMindMapStore } from './store/useMindMapStore';
import AuthGate from './components/AuthGate';
import Sidebar from './components/Sidebar';
import Canvas from './components/Canvas';
import { exportJson, exportSvg } from './utils/export';
import styles from './App.module.css';

export default function App() {
  const { user, signOut } = useAuth();
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

  return (
    <AuthGate>
      <div className={styles.app}>
        <Sidebar
          maps={maps}
          activeMapId={activeMapId}
          onSelect={switchMap}
          onCreate={createMap}
          onDelete={deleteMap}
          onRename={renameMap}
          user={user}
          onSignOut={signOut}
        />
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
