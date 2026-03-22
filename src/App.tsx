import { useMindMapStore } from './store/useMindMapStore';
import Sidebar from './components/Sidebar';
import Canvas from './components/Canvas';
import { exportJson, exportSvg } from './utils/export';
import styles from './App.module.css';

export default function App() {
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
    applyAutoLayout,
  } = useMindMapStore();

  const activeMap = activeMapId ? maps[activeMapId] : null;

  return (
    <div className={styles.app}>
      <Sidebar
        maps={maps}
        activeMapId={activeMapId}
        onSelect={switchMap}
        onCreate={createMap}
        onDelete={deleteMap}
        onRename={renameMap}
      />
      <Canvas
        key={activeMapId}
        map={activeMap}
        onSaveView={saveView}
        onAddNode={addNode}
        onUpdateNode={updateNode}
        onDeleteNode={deleteNode}
        onAutoLayout={applyAutoLayout}
        onExportJson={exportJson}
        onExportImg={exportSvg}
      />
    </div>
  );
}
