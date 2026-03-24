import React, { useRef, useState, useEffect, useCallback } from 'react';
import { colorForDepth, measureNode } from '../store/useMindMapStore';
import type { MindMap, MindMapNode, Edge, CustomLink } from '../store/useMindMapStore';
import Toolbar from './Toolbar';
import NotesPanel from './NotesPanel';
import styles from './Canvas.module.css';

interface CanvasProps {
  map: MindMap | null;
  onSaveView: (mapId: string, tx: number, ty: number, scale: number) => void;
  onAddNode: (mapId: string, label: string, x: number, y: number, parentId: string | null, depth: number) => string;
  onUpdateNode: (mapId: string, nodeId: string, changes: Partial<MindMapNode>) => void;
  onDeleteNode: (mapId: string, nodeId: string, nodes: Record<string, MindMapNode>, edges: Edge[]) => void;
  onReparentNode: (mapId: string, nodeId: string, newParentId: string, nodes: Record<string, MindMapNode>) => void;
  onAddLink: (mapId: string, from: string, to: string, style: CustomLink['style'], stroke: CustomLink['stroke'], arrowFrom?: boolean) => string;
  onUpdateLink: (mapId: string, linkId: string, changes: Partial<CustomLink>) => void;
  onDeleteLink: (mapId: string, linkId: string) => void;
  onAutoLayout: (mapId: string, canvasHeight: number, currentScale: number, currentTy: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onExportJson: (map: MindMap) => void;
  onExportImg: (map: MindMap) => void;
}

interface PanState {
  cx: number;
  cy: number;
  tx: number;
  ty: number;
}

interface DragState {
  id: string;
  ox: number;
  oy: number;
  moved: boolean;
  /** Offsets for each node in a group drag */
  group?: { id: string; ox: number; oy: number }[];
}

interface MarqueeState {
  /** World coordinates of the starting corner */
  x0: number;
  y0: number;
  /** Current world coordinates */
  x1: number;
  y1: number;
}

interface PinchState {
  d0: number;
  scale0: number;
  cx: number;
  cy: number;
}

/** Find the point on a rectangle's edge closest to a target point, from the rect's center. */
function rectEdgePoint(cx: number, cy: number, w: number, h: number, tx: number, ty: number) {
  const dx = tx - cx;
  const dy = ty - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };
  const hw = w / 2 + 4; // small padding so arrow doesn't touch the rect
  const hh = h / 2 + 4;
  const sx = dx !== 0 ? hw / Math.abs(dx) : Infinity;
  const sy = dy !== 0 ? hh / Math.abs(dy) : Infinity;
  const s = Math.min(sx, sy);
  return { x: cx + dx * s, y: cy + dy * s };
}

function touchDist(a: React.Touch, b: React.Touch) {
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}

function touchMid(a: React.Touch, b: React.Touch, rect: DOMRect) {
  return {
    cx: (a.clientX + b.clientX) / 2 - rect.left,
    cy: (a.clientY + b.clientY) / 2 - rect.top,
  };
}

export default function Canvas({ map, onSaveView, onAddNode, onUpdateNode, onDeleteNode, onReparentNode, onAddLink, onUpdateLink, onDeleteLink, onAutoLayout, onUndo, onRedo, canUndo, canRedo, onExportJson, onExportImg }: CanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [tx, setTx] = useState(map?.tx ?? 0);
  const [ty, setTy] = useState(map?.ty ?? 0);
  const [scale, setScale] = useState(map?.scale ?? 1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editPos, setEditPos] = useState({ x: 0, y: 0, w: 0, h: 0 });
  const [notesOpen, setNotesOpen] = useState(false);
  const [notesNodeId, setNotesNodeId] = useState<string | null>(null);

  // Linking mode
  const [linkingFrom, setLinkingFrom] = useState<string | null>(null);
  const [linkArrowFrom, setLinkArrowFrom] = useState(false);
  const [linkArrowTo, setLinkArrowTo] = useState(true);
  const [linkStroke, setLinkStroke] = useState<CustomLink['stroke']>('dashed');
  const [mouseWorld, setMouseWorld] = useState({ x: 0, y: 0 });

  // Reparent mode
  const [reparentingFrom, setReparentingFrom] = useState<string | null>(null);

  // Multi-selection (desktop only)
  const [multiSelected, setMultiSelected] = useState<Set<string>>(new Set());
  const marqueeRef = useRef<MarqueeState | null>(null);
  const [marquee, setMarquee] = useState<MarqueeState | null>(null);

  // Link selection
  const [selectedLinkId, setSelectedLinkId] = useState<string | null>(null);

  const panRef = useRef<PanState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const pinchRef = useRef<PinchState | null>(null);
  const lastTapRef = useRef<{ time: number; nodeId: string | null }>({ time: 0, nodeId: null });
  const touchDragRef = useRef<DragState | null>(null);
  const viewRef = useRef({ tx, ty, scale });
  const editInputRef = useRef<HTMLInputElement>(null);
  const deleteSelectedRef = useRef<() => void>(() => {});
  const editingIdRef = useRef(editingId);
  const undoRef = useRef(onUndo);
  const redoRef = useRef(onRedo);
  const multiSelectedRef = useRef(multiSelected);
  const toggleCollapseRef = useRef<() => void>(() => {});
  const mapIdRef = useRef(map?.id);

  useEffect(() => {
    if (map && map.id !== mapIdRef.current) {
      mapIdRef.current = map.id;
      setTx(map.tx ?? 0);
      setTy(map.ty ?? 0);
      setScale(map.scale ?? 1);
      setSelectedId(null);
      setEditingId(null);
      setLinkingFrom(null);
      setReparentingFrom(null);
      setSelectedLinkId(null);
      setMultiSelected(new Set());
    }
  }, [map?.id]);

  useEffect(() => {
    viewRef.current = { tx, ty, scale };
  }, [tx, ty, scale]);

  const fitView = useCallback(() => {
    if (!map || !svgRef.current) return;
    const nodes = Object.values(map.nodes);
    if (!nodes.length) return;
    const xs = nodes.map(n => n.x);
    const ys = nodes.map(n => n.y);
    const minX = Math.min(...xs) - 90;
    const maxX = Math.max(...xs) + 90;
    const minY = Math.min(...ys) - 50;
    const maxY = Math.max(...ys) + 50;
    const r = svgRef.current.getBoundingClientRect();
    const ns = Math.min(r.width / (maxX - minX), r.height / (maxY - minY), 1.6);
    const ntx = r.width / 2 - ((minX + maxX) / 2) * ns;
    const nty = r.height / 2 - ((minY + maxY) / 2) * ns;
    setTx(ntx); setTy(nty); setScale(ns);
    onSaveView(map.id, ntx, nty, ns);
  }, [map, onSaveView]);

  useEffect(() => {
    if (map && (map.tx === 0 && map.ty === 0 && map.scale === 1)) {
      const t = setTimeout(fitView, 80);
      return () => clearTimeout(t);
    }
  }, [map?.id]);

  function toWorld(cx: number, cy: number) {
    const { tx: t, ty: u, scale: s } = viewRef.current;
    return { x: (cx - t) / s, y: (cy - u) / s };
  }

  function getSVGXY(e: MouseEvent | React.MouseEvent) {
    const r = svgRef.current!.getBoundingClientRect();
    return { cx: e.clientX - r.left, cy: e.clientY - r.top };
  }

  function getTouchXY(t: { clientX: number; clientY: number }) {
    const r = svgRef.current!.getBoundingClientRect();
    return { cx: t.clientX - r.left, cy: t.clientY - r.top };
  }

  function findNodeAtPoint(cx: number, cy: number): string | null {
    const w = toWorld(cx, cy);
    const nodes = map ? Object.values(map.nodes) : [];
    for (let i = nodes.length - 1; i >= 0; i--) {
      const n = nodes[i];
      const m = measureNode(n.label);
      if (w.x >= n.x - m.w / 2 && w.x <= n.x + m.w / 2 && w.y >= n.y - m.h / 2 && w.y <= n.y + m.h / 2) {
        return n.id;
      }
    }
    return null;
  }

  function onSvgMouseDown(e: React.MouseEvent<SVGSVGElement>) {
    const target = e.target as SVGElement;
    if (target === svgRef.current || target.tagName === 'svg' || (target.tagName === 'g' && !(target as unknown as HTMLElement).dataset.nodeId)) {
      if (linkingFrom) { setLinkingFrom(null); return; }
      if (reparentingFrom) { setReparentingFrom(null); return; }
      const { cx, cy } = getSVGXY(e);
      if (e.shiftKey) {
        // Start marquee selection
        const w = toWorld(cx, cy);
        marqueeRef.current = { x0: w.x, y0: w.y, x1: w.x, y1: w.y };
        setMarquee(marqueeRef.current);
        return;
      }
      setSelectedId(null);
      setSelectedLinkId(null);
      setMultiSelected(new Set());
      panRef.current = { cx, cy, tx: viewRef.current.tx, ty: viewRef.current.ty };
    }
  }

  function onNodeMouseDown(e: React.MouseEvent, nodeId: string) {
    e.stopPropagation();

    if (reparentingFrom) {
      if (nodeId !== reparentingFrom) {
        onReparentNode(map!.id, reparentingFrom, nodeId, map!.nodes);
      }
      setReparentingFrom(null);
      return;
    }

    if (linkingFrom) {
      if (nodeId !== linkingFrom) {
        onAddLink(map!.id, linkingFrom, nodeId, linkArrowTo ? 'arrow' : 'line', linkStroke, linkArrowFrom);
      }
      setLinkingFrom(null);
      return;
    }

    const { cx, cy } = getSVGXY(e);
    const w = toWorld(cx, cy);
    const n = map!.nodes[nodeId];

    if (e.shiftKey) {
      // Toggle node in multi-selection
      setMultiSelected(prev => {
        const next = new Set(prev);
        // If there's a single selectedId, bring it into the multi-set first
        if (selectedId && !next.has(selectedId)) next.add(selectedId);
        if (next.has(nodeId)) next.delete(nodeId);
        else next.add(nodeId);
        return next;
      });
      setSelectedId(nodeId);
      setSelectedLinkId(null);
      return;
    }

    // If clicking a node that's part of multi-selection, start group drag
    if (multiSelected.has(nodeId) && multiSelected.size > 1) {
      const group = Array.from(multiSelected).map(id => {
        const nd = map!.nodes[id];
        return { id, ox: w.x - nd.x, oy: w.y - nd.y };
      });
      dragRef.current = { id: nodeId, ox: w.x - n.x, oy: w.y - n.y, moved: false, group };
      setSelectedId(nodeId);
      setSelectedLinkId(null);
      if (notesOpen) setNotesNodeId(nodeId);
      return;
    }

    // Normal single-select
    setSelectedId(nodeId);
    setSelectedLinkId(null);
    setMultiSelected(new Set());
    if (notesOpen) setNotesNodeId(nodeId);
    dragRef.current = { id: nodeId, ox: w.x - n.x, oy: w.y - n.y, moved: false };
  }

  function onLinkClick(e: React.MouseEvent, linkId: string) {
    e.stopPropagation();
    if (linkingFrom) return;
    setSelectedLinkId(linkId);
    setSelectedId(null);
  }

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if ((linkingFrom || reparentingFrom) && svgRef.current) {
        const { cx, cy } = getSVGXY(e);
        setMouseWorld(toWorld(cx, cy));
        return;
      }
      if (marqueeRef.current && svgRef.current) {
        const { cx, cy } = getSVGXY(e);
        const w = toWorld(cx, cy);
        marqueeRef.current = { ...marqueeRef.current, x1: w.x, y1: w.y };
        setMarquee({ ...marqueeRef.current });
        return;
      }
      if (dragRef.current && map) {
        const { cx, cy } = getSVGXY(e);
        const w = toWorld(cx, cy);
        dragRef.current.moved = true;
        if (dragRef.current.group) {
          // Group drag — move all selected nodes
          for (const g of dragRef.current.group) {
            onUpdateNode(map.id, g.id, {
              x: w.x - g.ox,
              y: w.y - g.oy,
            });
          }
        } else {
          onUpdateNode(map.id, dragRef.current.id, {
            x: w.x - dragRef.current.ox,
            y: w.y - dragRef.current.oy,
          });
        }
      } else if (panRef.current) {
        const { cx, cy } = getSVGXY(e);
        const ntx = panRef.current.tx + (cx - panRef.current.cx);
        const nty = panRef.current.ty + (cy - panRef.current.cy);
        setTx(ntx); setTy(nty);
      }
    }
    function onMouseUp() {
      if (marqueeRef.current && map) {
        // Select all nodes inside the marquee rectangle
        const m = marqueeRef.current;
        const minX = Math.min(m.x0, m.x1);
        const maxX = Math.max(m.x0, m.x1);
        const minY = Math.min(m.y0, m.y1);
        const maxY = Math.max(m.y0, m.y1);
        const hits = new Set<string>();
        for (const n of Object.values(map.nodes)) {
          if (n.x >= minX && n.x <= maxX && n.y >= minY && n.y <= maxY) {
            hits.add(n.id);
          }
        }
        setMultiSelected(hits);
        if (hits.size > 0) {
          const first = Array.from(hits)[0];
          setSelectedId(first);
        }
        marqueeRef.current = null;
        setMarquee(null);
        return;
      }
      if (dragRef.current?.moved && map) {
        onSaveView(map.id, viewRef.current.tx, viewRef.current.ty, viewRef.current.scale);
      }
      if (panRef.current && map) {
        onSaveView(map.id, viewRef.current.tx, viewRef.current.ty, viewRef.current.scale);
      }
      dragRef.current = null;
      panRef.current = null;
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (linkingFrom) setLinkingFrom(null);
        if (reparentingFrom) setReparentingFrom(null);
        if (multiSelectedRef.current.size > 0) setMultiSelected(new Set());
      }
      const tag = (document.activeElement?.tagName || '').toLowerCase();
      const isEditable = tag === 'input' || tag === 'textarea' || (document.activeElement as HTMLElement)?.isContentEditable;
      if ((e.key === 'Delete' || e.key === 'Backspace') && !editingIdRef.current && !isEditable) {
        deleteSelectedRef.current();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undoRef.current();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        redoRef.current();
      }
    }
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [map, onUpdateNode, onSaveView, linkingFrom, reparentingFrom]);

  function onWheel(e: React.WheelEvent) {
    e.preventDefault();
    const { cx, cy } = getSVGXY(e as unknown as MouseEvent);
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const ns = Math.min(3, Math.max(0.15, viewRef.current.scale * delta));
    const ntx = cx - (cx - viewRef.current.tx) * (ns / viewRef.current.scale);
    const nty = cy - (cy - viewRef.current.ty) * (ns / viewRef.current.scale);
    setTx(ntx); setTy(nty); setScale(ns);
    onSaveView(map!.id, ntx, nty, ns);
  }

  function zoomBy(delta: number) {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const ns = Math.min(3, Math.max(0.15, viewRef.current.scale * delta));
    const ntx = cx - (cx - viewRef.current.tx) * (ns / viewRef.current.scale);
    const nty = cy - (cy - viewRef.current.ty) * (ns / viewRef.current.scale);
    setTx(ntx); setTy(nty); setScale(ns);
    if (map) onSaveView(map.id, ntx, nty, ns);
  }

  function onTouchStart(e: React.TouchEvent<SVGSVGElement>) {
    if (!svgRef.current) return;
    const touches = e.touches;

    if (touches.length === 2) {
      // Pinch-to-zoom start
      touchDragRef.current = null;
      panRef.current = null;
      const rect = svgRef.current.getBoundingClientRect();
      pinchRef.current = {
        d0: touchDist(touches[0], touches[1]),
        scale0: viewRef.current.scale,
        ...touchMid(touches[0], touches[1], rect),
      };
      return;
    }

    if (touches.length === 1) {
      const { cx, cy } = getTouchXY(touches[0]);
      const nodeId = findNodeAtPoint(cx, cy);

      if (nodeId) {
        // Handle linking / reparenting modes
        if (linkingFrom) {
          if (nodeId !== linkingFrom) {
            onAddLink(map!.id, linkingFrom, nodeId, linkArrowTo ? 'arrow' : 'line', linkStroke, linkArrowFrom);
          }
          setLinkingFrom(null);
          return;
        }
        if (reparentingFrom) {
          if (nodeId !== reparentingFrom) {
            onReparentNode(map!.id, reparentingFrom, nodeId, map!.nodes);
          }
          setReparentingFrom(null);
          return;
        }

        // Tap on node — start drag
        setSelectedId(nodeId);
        setSelectedLinkId(null);
        if (notesOpen) setNotesNodeId(nodeId);
        const w = toWorld(cx, cy);
        const n = map!.nodes[nodeId];
        touchDragRef.current = { id: nodeId, ox: w.x - n.x, oy: w.y - n.y, moved: false };

        // Double-tap detection
        const now = Date.now();
        if (lastTapRef.current.nodeId === nodeId && now - lastTapRef.current.time < 350) {
          // Double-tap → edit
          touchDragRef.current = null;
          const { w: nw, h: nh } = measureNode(n.label);
          const sx = (n.x - nw / 2) * scale + tx;
          const sy = (n.y - nh / 2) * scale + ty;
          setEditingId(nodeId);
          setEditValue(n.label);
          setEditPos({ x: sx, y: sy, w: nw * scale, h: nh * scale });
          setTimeout(() => { editInputRef.current?.focus(); editInputRef.current?.select(); }, 10);
          lastTapRef.current = { time: 0, nodeId: null };
          return;
        }
        lastTapRef.current = { time: now, nodeId };
      } else {
        // Tap on background
        if (linkingFrom) { setLinkingFrom(null); return; }
        if (reparentingFrom) { setReparentingFrom(null); return; }
        setSelectedId(null);
        setSelectedLinkId(null);
        panRef.current = { cx, cy, tx: viewRef.current.tx, ty: viewRef.current.ty };
        lastTapRef.current = { time: 0, nodeId: null };
      }
    }
  }

  function onTouchMove(e: React.TouchEvent<SVGSVGElement>) {
    if (!svgRef.current) return;
    const touches = e.touches;

    if (touches.length === 2 && pinchRef.current) {
      const rect = svgRef.current.getBoundingClientRect();
      const d = touchDist(touches[0], touches[1]);
      const mid = touchMid(touches[0], touches[1], rect);
      const ns = Math.min(3, Math.max(0.15, pinchRef.current.scale0 * (d / pinchRef.current.d0)));
      const ntx = mid.cx - (pinchRef.current.cx - viewRef.current.tx) * (ns / viewRef.current.scale);
      const nty = mid.cy - (pinchRef.current.cy - viewRef.current.ty) * (ns / viewRef.current.scale);
      setTx(ntx); setTy(nty); setScale(ns);
      return;
    }

    if (touches.length === 1) {
      const { cx, cy } = getTouchXY(touches[0]);

      if (touchDragRef.current && map) {
        const w = toWorld(cx, cy);
        touchDragRef.current.moved = true;
        onUpdateNode(map.id, touchDragRef.current.id, {
          x: w.x - touchDragRef.current.ox,
          y: w.y - touchDragRef.current.oy,
        });
        return;
      }

      if ((linkingFrom || reparentingFrom)) {
        setMouseWorld(toWorld(cx, cy));
        return;
      }

      if (panRef.current) {
        const ntx = panRef.current.tx + (cx - panRef.current.cx);
        const nty = panRef.current.ty + (cy - panRef.current.cy);
        setTx(ntx); setTy(nty);
      }
    }
  }

  function onTouchEnd(e: React.TouchEvent<SVGSVGElement>) {
    if (e.touches.length === 0) {
      if (touchDragRef.current?.moved && map) {
        onSaveView(map.id, viewRef.current.tx, viewRef.current.ty, viewRef.current.scale);
      }
      if (panRef.current && map) {
        onSaveView(map.id, viewRef.current.tx, viewRef.current.ty, viewRef.current.scale);
      }
      if (pinchRef.current && map) {
        onSaveView(map.id, viewRef.current.tx, viewRef.current.ty, viewRef.current.scale);
      }
      touchDragRef.current = null;
      panRef.current = null;
      pinchRef.current = null;
    }
  }

  function startEdit(e: React.MouseEvent, nodeId: string) {
    e.stopPropagation();
    if (linkingFrom) return;
    const n = map!.nodes[nodeId];
    const { w, h } = measureNode(n.label);
    const sx = (n.x - w / 2) * scale + tx;
    const sy = (n.y - h / 2) * scale + ty;
    setEditingId(nodeId);
    setEditValue(n.label);
    setEditPos({ x: sx, y: sy, w: w * scale, h: h * scale });
    setTimeout(() => { editInputRef.current?.focus(); editInputRef.current?.select(); }, 10);
  }

  function finishEdit() {
    if (!editingId) return;
    const v = editValue.trim();
    if (v) onUpdateNode(map!.id, editingId, { label: v });
    setEditingId(null);
  }

  function addChild() {
    if (!map) return;
    const pid = selectedId || Object.keys(map.nodes)[0];
    if (!pid) return;
    const p = map.nodes[pid];
    const ch = Object.values(map.nodes).filter(n => n.parentId === pid);
    const id = onAddNode(map.id, 'new idea', p.x + 190, p.y + ch.length * 55 - (ch.length - 1) * 27, pid, (p.depth || 0) + 1);
    setSelectedId(id);
    setTimeout(() => {
      const n = map.nodes[id] || { label: 'new idea', x: p.x + 190, y: p.y };
      const { w, h } = measureNode('new idea');
      const sx = (n.x - w / 2) * scale + tx;
      const sy = (n.y - h / 2) * scale + ty;
      setEditingId(id);
      setEditValue('new idea');
      setEditPos({ x: sx, y: sy, w: w * scale, h: h * scale });
      setTimeout(() => { editInputRef.current?.focus(); editInputRef.current?.select(); }, 10);
    }, 60);
  }

  function addSibling() {
    if (!map || !selectedId) return;
    const n = map.nodes[selectedId];
    const id = onAddNode(map.id, 'new idea', n.x, n.y + 55, n.parentId, n.depth);
    setSelectedId(id);
    setTimeout(() => {
      const { w, h } = measureNode('new idea');
      const sx = (n.x - w / 2) * scale + tx;
      const sy = (n.y + 55 - h / 2) * scale + ty;
      setEditingId(id);
      setEditValue('new idea');
      setEditPos({ x: sx, y: sy, w: w * scale, h: h * scale });
      setTimeout(() => { editInputRef.current?.focus(); editInputRef.current?.select(); }, 10);
    }, 60);
  }

  function toggleCollapse() {
    if (!map || !selectedId) return;
    const node = map.nodes[selectedId];
    // Only collapse nodes that have children
    const hasChildren = Object.values(map.nodes).some(n => n.parentId === selectedId);
    if (!hasChildren) return;
    onUpdateNode(map.id, selectedId, { collapsed: !node.collapsed });
  }

  function deleteSelected() {
    if (!map) return;
    if (selectedLinkId) {
      if (!confirm('Delete this link?')) return;
      onDeleteLink(map.id, selectedLinkId);
      setSelectedLinkId(null);
      return;
    }
    if (!selectedId || Object.keys(map.nodes).length <= 1) return;
    const node = map.nodes[selectedId];
    if (!confirm(`Delete "${node.label}"?`)) return;
    onDeleteNode(map.id, selectedId, map.nodes, map.edges);
    setSelectedId(null);
    if (notesNodeId === selectedId) {
      setNotesOpen(false);
      setNotesNodeId(null);
    }
  }
  deleteSelectedRef.current = deleteSelected;
  editingIdRef.current = editingId;
  undoRef.current = onUndo;
  redoRef.current = onRedo;
  multiSelectedRef.current = multiSelected;
  toggleCollapseRef.current = toggleCollapse;

  function handleLayout() {
    if (!svgRef.current || !map) return;
    const r = svgRef.current.getBoundingClientRect();
    onAutoLayout(map.id, r.height, scale, ty);
    setTimeout(fitView, 80);
  }

  function startLinking() {
    if (!selectedId) return;
    setLinkingFrom(selectedId);
    setReparentingFrom(null);
    setSelectedLinkId(null);
  }

  function startReparenting() {
    if (!selectedId || !map) return;
    const node = map.nodes[selectedId];
    if (!node?.parentId) return;
    setReparentingFrom(selectedId);
    setLinkingFrom(null);
    setSelectedLinkId(null);
  }

  // Get selected link object
  const selectedLink = selectedLinkId ? (map?.links || []).find(l => l.id === selectedLinkId) || null : null;

  if (!map) {
    return (
      <div className={styles.empty}>
        <p>select or create a map to get started</p>
      </div>
    );
  }

  // Compute set of node IDs hidden by collapsed ancestors
  const hiddenIds = new Set<string>();
  (function collectHidden() {
    const allNodes = map.nodes;
    function hideDescendants(parentId: string) {
      for (const n of Object.values(allNodes)) {
        if (n.parentId === parentId && !hiddenIds.has(n.id)) {
          hiddenIds.add(n.id);
          hideDescendants(n.id);
        }
      }
    }
    for (const n of Object.values(allNodes)) {
      if (n.collapsed) hideDescendants(n.id);
    }
  })();

  const nodes = Object.values(map.nodes).filter(n => !hiddenIds.has(n.id));
  const edges = map.edges.filter(e => !hiddenIds.has(e.from) && !hiddenIds.has(e.to));
  const links = (map.links || []).filter(l => !hiddenIds.has(l.from) && !hiddenIds.has(l.to));
  const linkingSource = linkingFrom ? map.nodes[linkingFrom] : null;
  const reparentingSource = reparentingFrom ? map.nodes[reparentingFrom] : null;

  return (
    <div className={styles.canvasWrap}>
      <svg
        ref={svgRef}
        className={`${styles.svg} ${panRef.current ? styles.grabbing : ''} ${(linkingFrom || reparentingFrom) ? styles.linking : ''}`}
        onMouseDown={onSvgMouseDown}
        onWheel={onWheel}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <defs>
          <marker id="arrowhead" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="10" markerHeight="10" orient="auto" overflow="visible">
            <path d="M 0 1 L 8 5 L 0 9 z" fill="#888" />
          </marker>
          <marker id="arrowhead-sel" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="10" markerHeight="10" orient="auto" overflow="visible">
            <path d="M 0 1 L 8 5 L 0 9 z" fill="#1D9E75" />
          </marker>
          <marker id="arrowhead-start" viewBox="0 0 10 10" refX="2" refY="5" markerWidth="10" markerHeight="10" orient="auto" overflow="visible">
            <path d="M 10 1 L 2 5 L 10 9 z" fill="#888" />
          </marker>
          <marker id="arrowhead-start-sel" viewBox="0 0 10 10" refX="2" refY="5" markerWidth="10" markerHeight="10" orient="auto" overflow="visible">
            <path d="M 10 1 L 2 5 L 10 9 z" fill="#1D9E75" />
          </marker>
        </defs>
        <g transform={`translate(${tx},${ty}) scale(${scale})`}>
          {/* Tree edges */}
          <g>
            {edges.map((e, i) => {
              const a = map.nodes[e.from];
              const b = map.nodes[e.to];
              if (!a || !b) return null;
              const { h: ah } = measureNode(a.label);
              const { h: bh } = measureNode(b.label);
              const ax = a.x, ay = a.y + ah / 2;
              const bx = b.x, by = b.y - bh / 2;
              const my = (ay + by) / 2;
              const c = colorForDepth(b.depth);
              return (
                <path
                  key={i}
                  d={`M${ax},${ay} C${ax},${my} ${bx},${my} ${bx},${by}`}
                  fill="none"
                  stroke={c.stroke}
                  strokeWidth="1.5"
                  strokeOpacity="0.5"
                />
              );
            })}
          </g>
          {/* Custom links */}
          <g>
            {links.map(link => {
              const a = map.nodes[link.from];
              const b = map.nodes[link.to];
              if (!a || !b) return null;
              const isSel = link.id === selectedLinkId;
              const color = isSel ? '#1D9E75' : '#888';
              const hasArrowTo = link.arrowTo ?? (link.style === 'arrow');
              const hasArrowFrom = link.arrowFrom ?? false;
              const markerEnd = hasArrowTo ? (isSel ? 'url(#arrowhead-sel)' : 'url(#arrowhead)') : undefined;
              const markerStart = hasArrowFrom ? (isSel ? 'url(#arrowhead-start-sel)' : 'url(#arrowhead-start)') : undefined;
              // Compute edge points so arrows aren't hidden behind nodes
              const aSize = measureNode(a.label);
              const bSize = measureNode(b.label);
              const aEdge = rectEdgePoint(a.x, a.y, aSize.w, aSize.h, b.x, b.y);
              const bEdge = rectEdgePoint(b.x, b.y, bSize.w, bSize.h, a.x, a.y);
              // Quadratic Bézier: control point offset perpendicular to the line
              const mx = (aEdge.x + bEdge.x) / 2;
              const my = (aEdge.y + bEdge.y) / 2;
              const dx = bEdge.x - aEdge.x;
              const dy = bEdge.y - aEdge.y;
              const dist = Math.hypot(dx, dy) || 1;
              const bow = Math.min(dist * 0.2, 60);
              const cx = mx - (dy / dist) * bow;
              const cy = my + (dx / dist) * bow;
              const d = `M${aEdge.x},${aEdge.y} Q${cx},${cy} ${bEdge.x},${bEdge.y}`;
              // Label position: point on the quadratic at t=0.5
              const lx = 0.25 * aEdge.x + 0.5 * cx + 0.25 * bEdge.x;
              const ly = 0.25 * aEdge.y + 0.5 * cy + 0.25 * bEdge.y;
              return (
                <g key={link.id}>
                  {/* Hit target (invisible wider path) */}
                  <path
                    d={d}
                    fill="none"
                    stroke="transparent"
                    strokeWidth="12"
                    style={{ cursor: 'pointer' }}
                    onMouseDown={e => onLinkClick(e, link.id)}
                  />
                  <path
                    d={d}
                    fill="none"
                    stroke={color}
                    strokeWidth={isSel ? 2 : 1.5}
                    strokeDasharray={link.stroke === 'dashed' ? '6 3' : 'none'}
                    markerEnd={markerEnd}
                    markerStart={markerStart}
                    style={{ pointerEvents: 'none' }}
                  />
                  {link.label && (
                    <text
                      x={lx} y={ly - 6}
                      textAnchor="middle"
                      fontSize={11}
                      fill={color}
                      fontFamily="'DM Sans', sans-serif"
                      style={{ pointerEvents: 'none', userSelect: 'none' }}
                    >
                      {link.label}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
          {/* Link preview line */}
          {linkingSource && (
            <line
              x1={linkingSource.x} y1={linkingSource.y}
              x2={mouseWorld.x} y2={mouseWorld.y}
              stroke="#1D9E75"
              strokeWidth="1.5"
              strokeDasharray="6 3"
              strokeOpacity="0.6"
              style={{ pointerEvents: 'none' }}
            />
          )}
          {/* Reparent preview line */}
          {reparentingSource && (
            <line
              x1={reparentingSource.x} y1={reparentingSource.y}
              x2={mouseWorld.x} y2={mouseWorld.y}
              stroke="#E67E22"
              strokeWidth="1.5"
              strokeDasharray="6 3"
              strokeOpacity="0.7"
              style={{ pointerEvents: 'none' }}
            />
          )}
          {/* Nodes */}
          <g>
            {nodes.map(n => {
              const { w, h } = measureNode(n.label);
              const c = colorForDepth(n.depth);
              const isSel = n.id === selectedId;
              const isMultiSel = multiSelected.has(n.id);
              return (
                <g
                  key={n.id}
                  data-node-id={n.id}
                  transform={`translate(${n.x - w / 2},${n.y - h / 2})`}
                  style={{ cursor: (linkingFrom || reparentingFrom) ? 'crosshair' : 'pointer' }}
                  onMouseDown={e => onNodeMouseDown(e, n.id)}
                  onDoubleClick={e => startEdit(e, n.id)}
                >
                  <rect
                    width={w}
                    height={h}
                    rx={n.depth === 0 ? 10 : 8}
                    fill={c.fill}
                    stroke={(isSel || isMultiSel) ? '#1D9E75' : c.stroke}
                    strokeWidth={(isSel || isMultiSel) ? 2 : 1}
                  />
                  <text
                    x={w / 2}
                    y={h / 2 + 1}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={n.depth === 0 ? 14 : 13}
                    fontWeight={n.depth === 0 ? 500 : 400}
                    fill={c.text}
                    fontFamily="'DM Sans', sans-serif"
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >
                    {n.label}
                  </text>
                  {n.link && (
                    <g transform={`translate(${w - 6},${6})`} style={{ cursor: 'pointer' }} onMouseDown={e => { e.stopPropagation(); if (n.link!.startsWith('#')) { location.hash = n.link!; } else { window.open(n.link, '_blank', 'noopener'); } }}>
                      <circle r={5.5} fill="#1D9E75" opacity=".15" />
                      <path d="M-2.5 0.5l1.5-1.5M-1 2l3-3M1.5 3l1.5-1.5" stroke="#1D9E75" strokeWidth="1" strokeLinecap="round" />
                    </g>
                  )}
                  {n.notes && (
                    <circle cx={w - (n.link ? 18 : 6)} cy={6} r={3.5} fill="#1D9E75" />
                  )}
                  {n.collapsed && (
                    <g transform={`translate(${w / 2},${h + 4})`} style={{ cursor: 'pointer' }} onMouseDown={e => { e.stopPropagation(); setSelectedId(n.id); toggleCollapseRef.current(); }}>
                      <ellipse rx={10} ry={6} fill={c.stroke} opacity=".25" />
                      <text textAnchor="middle" dominantBaseline="middle" fontSize={9} fill={c.text} fontFamily="'DM Sans', sans-serif" style={{ pointerEvents: 'none', userSelect: 'none' }}>{'···'}</text>
                    </g>
                  )}
                </g>
              );
            })}
          </g>
          {/* Marquee selection rectangle */}
          {marquee && (
            <rect
              x={Math.min(marquee.x0, marquee.x1)}
              y={Math.min(marquee.y0, marquee.y1)}
              width={Math.abs(marquee.x1 - marquee.x0)}
              height={Math.abs(marquee.y1 - marquee.y0)}
              fill="rgba(29,158,117,0.08)"
              stroke="#1D9E75"
              strokeWidth={1 / scale}
              strokeDasharray={`${4 / scale} ${3 / scale}`}
              style={{ pointerEvents: 'none' }}
            />
          )}
        </g>
      </svg>

      {editingId && (
        <input
          ref={editInputRef}
          className={styles.editInput}
          style={{
            left: editPos.x,
            top: editPos.y,
            width: editPos.w,
            height: editPos.h,
            fontSize: Math.round(13 * scale),
          }}
          value={editValue}
          onChange={e => setEditValue(e.target.value)}
          onBlur={finishEdit}
          onKeyDown={e => {
            if (e.key === 'Enter') finishEdit();
            if (e.key === 'Escape') setEditingId(null);
          }}
        />
      )}

      <Toolbar
        hasSelected={!!selectedId}
        notesOpen={notesOpen}
        isLinking={!!linkingFrom}
        isReparenting={!!reparentingFrom}
        canReparent={!!selectedId && !!map.nodes[selectedId]?.parentId}
        selectedLink={selectedLink}
        onAddChild={addChild}
        onAddSibling={addSibling}
        onDelete={deleteSelected}
        onToggleNotes={() => {
          setNotesOpen(v => {
            if (!v && selectedId) setNotesNodeId(selectedId);
            return !v;
          });
        }}
        onToggleCollapse={toggleCollapse}
        canCollapse={!!selectedId && Object.values(map.nodes).some(n => n.parentId === selectedId)}
        isCollapsed={!!selectedId && !!map.nodes[selectedId]?.collapsed}
        onStartLink={startLinking}
        onStartReparent={startReparenting}
        onToggleLinkStroke={() => {
          if (selectedLink) onUpdateLink(map.id, selectedLink.id, { stroke: selectedLink.stroke === 'solid' ? 'dashed' : 'solid' });
        }}
        onToggleArrowFrom={() => {
          if (selectedLink) onUpdateLink(map.id, selectedLink.id, { arrowFrom: !(selectedLink.arrowFrom ?? false) });
        }}
        onToggleArrowTo={() => {
          if (selectedLink) onUpdateLink(map.id, selectedLink.id, { arrowTo: !(selectedLink.arrowTo ?? (selectedLink.style === 'arrow')) });
        }}
        onSetArrowFrom={setLinkArrowFrom}
        onSetArrowTo={setLinkArrowTo}
        onSetLinkStroke={setLinkStroke}
        onSetLinkLabel={(label) => {
          if (selectedLink) onUpdateLink(map.id, selectedLink.id, { label });
        }}
        linkArrowFrom={linkArrowFrom}
        linkArrowTo={linkArrowTo}
        linkStroke={linkStroke}
        onUndo={onUndo}
        onRedo={onRedo}
        canUndo={canUndo}
        canRedo={canRedo}
        onLayout={handleLayout}
        onFitView={fitView}
        onExportJson={() => onExportJson(map)}
        onExportImg={() => onExportImg(map)}
      />

      {notesOpen && notesNodeId && map.nodes[notesNodeId] && (
        <NotesPanel
          nodeLabel={map.nodes[notesNodeId].label}
          notes={map.nodes[notesNodeId].notes || ''}
          link={map.nodes[notesNodeId].link || ''}
          onChange={(notes) => onUpdateNode(map.id, notesNodeId, { notes })}
          onChangeLink={(link) => onUpdateNode(map.id, notesNodeId, { link })}
          onClose={() => setNotesOpen(false)}
        />
      )}

      {linkingFrom && (
        <div className={styles.linkingHint}>
          click a target node to create link · Esc to cancel
        </div>
      )}

      {reparentingFrom && (
        <div className={styles.reparentHint}>
          click a new parent node · Esc to cancel
        </div>
      )}

      <div className={styles.hint}>
        {'ontouchstart' in window
          ? 'double-tap to edit · drag to pan · pinch to zoom'
          : 'double-click to edit · drag to pan · scroll to zoom'}
      </div>
      <div className={styles.zoom}>
        <button className={styles.zoomBtn} onClick={() => zoomBy(0.9)} title="Zoom out">−</button>
        <span>{Math.round(scale * 100)}%</span>
        <button className={styles.zoomBtn} onClick={() => zoomBy(1.1)} title="Zoom in">+</button>
        <span className={styles.zoomHash}>{__COMMIT_HASH__}</span>
      </div>
    </div>
  );
}
