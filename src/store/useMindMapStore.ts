import { useState, useCallback, useRef, useEffect } from 'react';
import { subscribeToMaps, saveMapToFirestore, deleteMapFromFirestore, saveAllMapsToFirestore } from './firestoreSync';

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
  notes?: string;
}

export interface Edge {
  from: string;
  to: string;
}

export interface CustomLink {
  id: string;
  from: string;
  to: string;
  style: 'arrow' | 'line';
  stroke: 'solid' | 'dashed';
}

export interface MindMap {
  id: string;
  name: string;
  nodes: Record<string, MindMapNode>;
  edges: Edge[];
  links?: CustomLink[];
  tx: number;
  ty: number;
  scale: number;
}

export type MapsRecord = Record<string, MindMap>;

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

function uid() {
  return crypto.randomUUID();
}

function loadLocalState(): MapsRecord | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return parsed.maps || null;
    }
  } catch (_e) { /* ignore */ }
  return null;
}

function saveLocalState(maps: MapsRecord): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ maps }));
  } catch (_e) { /* ignore */ }
}

function makeRootNode(id: string, label: string): MindMapNode {
  return { id, label, x: 0, y: 0, parentId: null, depth: 0, w: 0, h: 36 };
}

function defaultMaps(): MapsRecord {
  const rootId = uid();
  const mapId = uid();
  return {
    [mapId]: {
      id: mapId,
      name: 'my first map',
      nodes: { [rootId]: makeRootNode(rootId, 'my first map') },
      edges: [],
      tx: 0, ty: 0, scale: 1,
    },
  };
}

export function useMindMapStore(userId: string | null) {
  const [maps, setMaps] = useState<MapsRecord>(() => {
    return loadLocalState() || defaultMaps();
  });
  const [activeMapId, setActiveMapId] = useState(() => Object.keys(loadLocalState() || defaultMaps())[0]);
  const viewRef = useRef<Record<string, { tx: number; ty: number; scale: number }>>({});

  // Undo / redo history (per-map snapshots)
  const undoStack = useRef<{ mapId: string; snapshot: MindMap }[]>([]);
  const redoStack = useRef<{ mapId: string; snapshot: MindMap }[]>([]);
  const MAX_UNDO = 50;

  // Track whether Firestore has loaded initial data
  const firestoreLoadedRef = useRef(false);
  // Track locally-originated writes to avoid echo from Firestore snapshot
  const skipNextSnapshotRef = useRef(false);
  // Debounce timers for Firestore writes
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Firestore subscription
  useEffect(() => {
    if (!userId) {
      firestoreLoadedRef.current = false;
      return;
    }

    const unsub = subscribeToMaps(userId, (remoteMaps) => {
      if (skipNextSnapshotRef.current) {
        skipNextSnapshotRef.current = false;
        return;
      }

      if (!firestoreLoadedRef.current) {
        firestoreLoadedRef.current = true;
        const localMaps = loadLocalState();

        if (Object.keys(remoteMaps).length === 0 && localMaps && Object.keys(localMaps).length > 0) {
          // First sign-in: migrate localStorage maps to Firestore
          saveAllMapsToFirestore(userId, localMaps);
          // Keep local maps as-is
          return;
        }

        if (Object.keys(remoteMaps).length > 0) {
          // Use Firestore data as source of truth
          setMaps(remoteMaps);
          saveLocalState(remoteMaps);
          setActiveMapId((prev) => {
            if (remoteMaps[prev]) return prev;
            return Object.keys(remoteMaps)[0];
          });
          return;
        }
      }

      // Ongoing snapshot updates from other devices
      if (Object.keys(remoteMaps).length > 0) {
        setMaps(remoteMaps);
        saveLocalState(remoteMaps);
      }
    });

    return unsub;
  }, [userId]);

  const debouncedFirestoreSave = useCallback((map: MindMap) => {
    if (!userId) return;
    if (debounceTimers.current[map.id]) {
      clearTimeout(debounceTimers.current[map.id]);
    }
    debounceTimers.current[map.id] = setTimeout(() => {
      skipNextSnapshotRef.current = true;
      saveMapToFirestore(userId, map);
    }, 500);
  }, [userId]);

  const persist = useCallback((newMaps: MapsRecord, changedMapId?: string) => {
    saveLocalState(newMaps);
    if (changedMapId && newMaps[changedMapId]) {
      debouncedFirestoreSave(newMaps[changedMapId]);
    }
  }, [debouncedFirestoreSave]);

  const update = useCallback((updater: (prev: MapsRecord) => MapsRecord, changedMapId?: string) => {
    setMaps(prev => {
      const next = updater(prev);
      persist(next, changedMapId);
      return next;
    });
  }, [persist]);

  const updateMap = useCallback((mapId: string, updater: (m: MindMap) => MindMap) => {
    update(prev => {
      const m = prev[mapId];
      if (!m) return prev;
      return { ...prev, [mapId]: updater(m) };
    }, mapId);
  }, [update]);

  const updateMapWithUndo = useCallback((mapId: string, updater: (m: MindMap) => MindMap) => {
    setMaps(prev => {
      const m = prev[mapId];
      if (!m) return prev;
      // Push snapshot before mutation
      undoStack.current = [...undoStack.current.slice(-(MAX_UNDO - 1)), { mapId, snapshot: m }];
      redoStack.current = [];
      const next = { ...prev, [mapId]: updater(m) };
      persist(next, mapId);
      return next;
    });
  }, [persist]);

  const undo = useCallback(() => {
    const entry = undoStack.current[undoStack.current.length - 1];
    if (!entry) return;
    undoStack.current = undoStack.current.slice(0, -1);
    setMaps(prev => {
      const current = prev[entry.mapId];
      if (current) {
        redoStack.current = [...redoStack.current, { mapId: entry.mapId, snapshot: current }];
      }
      const next = { ...prev, [entry.mapId]: entry.snapshot };
      persist(next, entry.mapId);
      return next;
    });
  }, [persist]);

  const redo = useCallback(() => {
    const entry = redoStack.current[redoStack.current.length - 1];
    if (!entry) return;
    redoStack.current = redoStack.current.slice(0, -1);
    setMaps(prev => {
      const current = prev[entry.mapId];
      if (current) {
        undoStack.current = [...undoStack.current, { mapId: entry.mapId, snapshot: current }];
      }
      const next = { ...prev, [entry.mapId]: entry.snapshot };
      persist(next, entry.mapId);
      return next;
    });
  }, [persist]);

  const saveView = useCallback((mapId: string, tx: number, ty: number, scale: number) => {
    viewRef.current[mapId] = { tx, ty, scale };
    updateMap(mapId, m => ({ ...m, tx, ty, scale }));
  }, [updateMap]);

  const createMap = useCallback((name?: string) => {
    const mapId = uid();
    const rootId = uid();
    const label = name || 'new map';
    const newMap: MindMap = {
      id: mapId,
      name: label,
      nodes: { [rootId]: makeRootNode(rootId, label) },
      edges: [],
      tx: 0, ty: 0, scale: 1,
    };
    setMaps(prev => {
      const next = { ...prev, [mapId]: newMap };
      saveLocalState(next);
      if (userId) {
        saveMapToFirestore(userId, newMap);
      }
      return next;
    });
    setActiveMapId(mapId);
    return mapId;
  }, [userId]);

  const deleteMap = useCallback((mapId: string, currentMaps: MapsRecord) => {
    const ids = Object.keys(currentMaps);
    if (ids.length <= 1) return;
    const next = { ...currentMaps };
    delete next[mapId];
    saveLocalState(next);
    if (userId) {
      deleteMapFromFirestore(userId, mapId);
    }
    setMaps(next);
    if (activeMapId === mapId) {
      const remaining = Object.keys(next);
      setActiveMapId(remaining[0]);
    }
  }, [activeMapId, userId]);

  const renameMap = useCallback((mapId: string, name: string) => {
    updateMapWithUndo(mapId, m => ({ ...m, name }));
  }, [updateMapWithUndo]);

  const switchMap = useCallback((mapId: string) => {
    setActiveMapId(mapId);
  }, []);

  const addNode = useCallback((mapId: string, label: string, x: number, y: number, parentId: string | null, depth: number) => {
    const id = uid();
    updateMapWithUndo(mapId, m => ({
      ...m,
      nodes: { ...m.nodes, [id]: { id, label, x, y, parentId, depth: depth || 0, w: 0, h: 36 } },
      edges: parentId ? [...m.edges, { from: parentId, to: id }] : m.edges,
    }));
    return id;
  }, [updateMapWithUndo]);

  const updateNode = useCallback((mapId: string, nodeId: string, changes: Partial<MindMapNode>) => {
    // Position-only changes (dragging) don't get undo entries
    const keys = Object.keys(changes);
    const isPositionOnly = keys.every(k => k === 'x' || k === 'y');
    const fn = isPositionOnly ? updateMap : updateMapWithUndo;
    fn(mapId, m => ({
      ...m,
      nodes: { ...m.nodes, [nodeId]: { ...m.nodes[nodeId], ...changes } },
    }));
  }, [updateMap, updateMapWithUndo]);

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
    updateMapWithUndo(mapId, m => ({
      ...m,
      nodes: newNodes,
      edges: newEdges,
      links: (m.links || []).filter(l => !toDelete.has(l.from) && !toDelete.has(l.to)),
    }));
  }, [updateMapWithUndo]);

  const applyAutoLayout = useCallback((mapId: string, canvasHeight: number, currentScale: number, currentTy: number) => {
    updateMapWithUndo(mapId, m => {
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
  }, [updateMapWithUndo]);

  const reparentNode = useCallback((mapId: string, nodeId: string, newParentId: string, allNodes: Record<string, MindMapNode>) => {
    const node = allNodes[nodeId];
    if (!node || !node.parentId || nodeId === newParentId) return;

    // Prevent moving to a descendant (would create cycle)
    const descendants = new Set<string>();
    function collectDesc(id: string) {
      Object.values(allNodes).filter(n => n.parentId === id).forEach(c => {
        descendants.add(c.id);
        collectDesc(c.id);
      });
    }
    collectDesc(nodeId);
    if (descendants.has(newParentId)) return;

    const newDepth = allNodes[newParentId].depth + 1;
    const depthDelta = newDepth - node.depth;

    updateMapWithUndo(mapId, m => {
      const nodes = { ...m.nodes };
      // Update the moved node
      nodes[nodeId] = { ...nodes[nodeId], parentId: newParentId, depth: newDepth };
      // Update all descendant depths
      function updateDepths(id: string) {
        Object.values(nodes).filter(n => n.parentId === id).forEach(c => {
          nodes[c.id] = { ...nodes[c.id], depth: c.depth + depthDelta };
          updateDepths(c.id);
        });
      }
      updateDepths(nodeId);
      // Update edges: remove old parent edge, add new one
      const edges = m.edges.filter(e => !(e.to === nodeId));
      edges.push({ from: newParentId, to: nodeId });
      return { ...m, nodes, edges };
    });
  }, [updateMapWithUndo]);

  const addLink = useCallback((mapId: string, from: string, to: string, style: CustomLink['style'], stroke: CustomLink['stroke']) => {
    const id = uid();
    updateMapWithUndo(mapId, m => ({
      ...m,
      links: [...(m.links || []), { id, from, to, style, stroke }],
    }));
    return id;
  }, [updateMapWithUndo]);

  const updateLink = useCallback((mapId: string, linkId: string, changes: Partial<CustomLink>) => {
    updateMapWithUndo(mapId, m => ({
      ...m,
      links: (m.links || []).map(l => l.id === linkId ? { ...l, ...changes } : l),
    }));
  }, [updateMapWithUndo]);

  const deleteLink = useCallback((mapId: string, linkId: string) => {
    updateMapWithUndo(mapId, m => ({
      ...m,
      links: (m.links || []).filter(l => l.id !== linkId),
    }));
  }, [updateMapWithUndo]);

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
    reparentNode,
    addLink,
    updateLink,
    deleteLink,
    applyAutoLayout,
    undo,
    redo,
    canUndo: undoStack.current.length > 0,
    canRedo: redoStack.current.length > 0,
  };
}
