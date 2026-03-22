import { useState, useCallback, useRef } from 'react';

const STORAGE_KEY = 'mindmaps_v2';

export interface MindMapNode {
  id: string;
  label: string;
  x: number;
  y: number;
  parentId: string | null;
  depth: number;
  w: number;
  h: number;
}

export interface Edge {
  from: string;
  to: string;
}

export interface MindMap {
  id: string;
  name: string;
  nodes: Record<string, MindMapNode>;
  edges: Edge[];
  tx: number;
  ty: number;
  scale: number;
}

type MapsRecord = Record<string, MindMap>;

interface NodeColor {
  fill: string;
  stroke: string;
  text: string;
}

const COLORS: NodeColor[] = [
  { fill: 'var(--node-0-fill)', stroke: 'var(--node-0-stroke)', text: 'var(--node-0-text)' },
  { fill: 'var(--node-1-fill)', stroke: 'var(--node-1-stroke)', text: 'var(--node-1-text)' },
  { fill: 'var(--node-2-fill)', stroke: 'var(--node-2-stroke)', text: 'var(--node-2-text)' },
  { fill: 'var(--node-3-fill)', stroke: 'var(--node-3-stroke)', text: 'var(--node-3-text)' },
  { fill: 'var(--node-4-fill)', stroke: 'var(--node-4-stroke)', text: 'var(--node-4-text)' },
];

export function colorForDepth(depth: number): NodeColor {
  return COLORS[depth % COLORS.length];
}

export function measureNode(label: string): { w: number; h: number } {
  return { w: Math.max(90, label.length * 8 + 36), h: 36 };
}

function loadState(): { maps: MapsRecord; counter: number } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (_e) { /* ignore */ }
  return null;
}

function saveState(maps: MapsRecord, counter: number): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ maps, counter }));
  } catch (_e) { /* ignore */ }
}

function makeRootNode(id: string, label: string): MindMapNode {
  return { id, label, x: 0, y: 0, parentId: null, depth: 0, w: 0, h: 36 };
}

function initialState(): { maps: MapsRecord; counter: number } {
  const saved = loadState();
  if (saved && Object.keys(saved.maps || {}).length > 0) {
    return { maps: saved.maps, counter: saved.counter || 0 };
  }
  const rootId = 'n0';
  const mapId = 'map0';
  return {
    counter: 1,
    maps: {
      [mapId]: {
        id: mapId,
        name: 'my first map',
        nodes: { [rootId]: makeRootNode(rootId, 'my first map') },
        edges: [],
        tx: 0, ty: 0, scale: 1,
      },
    },
  };
}

export function useMindMapStore() {
  const init = initialState();
  const [maps, setMaps] = useState<MapsRecord>(init.maps);
  const [activeMapId, setActiveMapId] = useState(Object.keys(init.maps)[0]);
  const counterRef = useRef(init.counter);
  const viewRef = useRef<Record<string, { tx: number; ty: number; scale: number }>>({});

  const nextId = (prefix: string) => `${prefix}${counterRef.current++}`;

  const persist = useCallback((newMaps: MapsRecord) => {
    saveState(newMaps, counterRef.current);
  }, []);

  const update = useCallback((updater: (prev: MapsRecord) => MapsRecord) => {
    setMaps(prev => {
      const next = updater(prev);
      persist(next);
      return next;
    });
  }, [persist]);

  const updateMap = useCallback((mapId: string, updater: (m: MindMap) => MindMap) => {
    update(prev => {
      const m = prev[mapId];
      if (!m) return prev;
      return { ...prev, [mapId]: updater(m) };
    });
  }, [update]);

  const saveView = useCallback((mapId: string, tx: number, ty: number, scale: number) => {
    viewRef.current[mapId] = { tx, ty, scale };
    update(prev => ({
      ...prev,
      [mapId]: { ...prev[mapId], tx, ty, scale },
    }));
  }, [update]);

  const createMap = useCallback((name?: string) => {
    const mapId = nextId('map');
    const rootId = nextId('n');
    const label = name || 'new map';
    const newMap: MindMap = {
      id: mapId,
      name: label,
      nodes: { [rootId]: makeRootNode(rootId, label) },
      edges: [],
      tx: 0, ty: 0, scale: 1,
    };
    update(prev => ({ ...prev, [mapId]: newMap }));
    setActiveMapId(mapId);
    return mapId;
  }, [update]);

  const deleteMap = useCallback((mapId: string, currentMaps: MapsRecord) => {
    const ids = Object.keys(currentMaps);
    if (ids.length <= 1) return;
    const next = { ...currentMaps };
    delete next[mapId];
    persist(next);
    setMaps(next);
    if (activeMapId === mapId) {
      const remaining = Object.keys(next);
      setActiveMapId(remaining[0]);
    }
  }, [activeMapId, persist]);

  const renameMap = useCallback((mapId: string, name: string) => {
    updateMap(mapId, m => ({ ...m, name }));
  }, [updateMap]);

  const switchMap = useCallback((mapId: string) => {
    setActiveMapId(mapId);
  }, []);

  const addNode = useCallback((mapId: string, label: string, x: number, y: number, parentId: string | null, depth: number) => {
    const id = nextId('n');
    updateMap(mapId, m => ({
      ...m,
      nodes: { ...m.nodes, [id]: { id, label, x, y, parentId, depth: depth || 0, w: 0, h: 36 } },
      edges: parentId ? [...m.edges, { from: parentId, to: id }] : m.edges,
    }));
    return id;
  }, [updateMap]);

  const updateNode = useCallback((mapId: string, nodeId: string, changes: Partial<MindMapNode>) => {
    updateMap(mapId, m => ({
      ...m,
      nodes: { ...m.nodes, [nodeId]: { ...m.nodes[nodeId], ...changes } },
    }));
  }, [updateMap]);

  const deleteNode = useCallback((mapId: string, nodeId: string, allNodes: Record<string, MindMapNode>, allEdges: Edge[]) => {
    const toDelete = new Set<string>();
    function collect(id: string) {
      toDelete.add(id);
      Object.values(allNodes).filter(n => n.parentId === id).forEach(c => collect(c.id));
    }
    collect(nodeId);
    const newNodes = { ...allNodes };
    toDelete.forEach(id => delete newNodes[id]);
    const newEdges = allEdges.filter(e => !toDelete.has(e.from) && !toDelete.has(e.to));
    updateMap(mapId, m => ({ ...m, nodes: newNodes, edges: newEdges }));
  }, [updateMap]);

  const applyAutoLayout = useCallback((mapId: string, canvasHeight: number, currentScale: number, currentTy: number) => {
    updateMap(mapId, m => {
      const nodes = { ...m.nodes };
      const roots = Object.values(nodes).filter(n => !n.parentId);
      if (!roots.length) return m;

      function getChildren(id: string) {
        return Object.values(nodes).filter(n => n.parentId === id);
      }
      function subtreeH(id: string): number {
        const ch = getChildren(id);
        return ch.length === 0 ? 58 : ch.reduce((s, c) => s + subtreeH(c.id), 0);
      }
      function layout(id: string, x: number, y: number) {
        nodes[id] = { ...nodes[id], x };
        const ch = getChildren(id);
        if (!ch.length) { nodes[id] = { ...nodes[id], y }; return; }
        const total = subtreeH(id);
        let cy = y - total / 2;
        ch.forEach(c => {
          const sh = subtreeH(c.id);
          layout(c.id, x + 190, cy + sh / 2);
          cy += sh;
        });
        const ys = ch.map(c => nodes[c.id].y);
        nodes[id] = { ...nodes[id], y: (Math.min(...ys) + Math.max(...ys)) / 2 };
      }

      const startY = canvasHeight / (2 * currentScale) - currentTy / currentScale;
      layout(roots[0].id, 100, startY);
      return { ...m, nodes };
    });
  }, [updateMap]);

  return {
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
  };
}
