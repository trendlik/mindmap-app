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
  onAddLink: (mapId: string, from: string, to: string, style: CustomLink['style'], stroke: CustomLink['stroke']) => string;
  onUpdateLink: (mapId: string, linkId: string, changes: Partial<CustomLink>) => void;
  onDeleteLink: (mapId: string, linkId: string) => void;
  onAutoLayout: (mapId: string, canvasHeight: number, currentScale: number, currentTy: number) => void;
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
}

export default function Canvas({ map, onSaveView, onAddNode, onUpdateNode, onDeleteNode, onReparentNode, onAddLink, onUpdateLink, onDeleteLink, onAutoLayout, onExportJson, onExportImg }: CanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [tx, setTx] = useState(map?.tx ?? 0);
  const [ty, setTy] = useState(map?.ty ?? 0);
  const [scale, setScale] = useState(map?.scale ?? 1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editPos, setEditPos] = useState({ x: 0, y: 0, w: 0, h: 0 });
  const [notesOpen, setNotesOpen] = useState(false);

  // Linking mode
  const [linkingFrom, setLinkingFrom] = useState<string | null>(null);
  const [linkStyle, setLinkStyle] = useState<CustomLink['style']>('arrow');
  const [linkStroke, setLinkStroke] = useState<CustomLink['stroke']>('solid');
  const [mouseWorld, setMouseWorld] = useState({ x: 0, y: 0 });

  // Reparent mode
  const [reparentingFrom, setReparentingFrom] = useState<string | null>(null);

  // Link selection
  const [selectedLinkId, setSelectedLinkId] = useState<string | null>(null);

  const panRef = useRef<PanState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const viewRef = useRef({ tx, ty, scale });
  const editInputRef = useRef<HTMLInputElement>(null);
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

  function onSvgMouseDown(e: React.MouseEvent<SVGSVGElement>) {
    const target = e.target as SVGElement;
    if (target === svgRef.current || target.tagName === 'svg' || (target.tagName === 'g' && !(target as unknown as HTMLElement).dataset.nodeId)) {
      if (linkingFrom) { setLinkingFrom(null); return; }
      if (reparentingFrom) { setReparentingFrom(null); return; }
      setSelectedId(null);
      setSelectedLinkId(null);
      setNotesOpen(false);
      const { cx, cy } = getSVGXY(e);
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
        onAddLink(map!.id, linkingFrom, nodeId, linkStyle, linkStroke);
      }
      setLinkingFrom(null);
      return;
    }

    setSelectedId(nodeId);
    setSelectedLinkId(null);
    const { cx, cy } = getSVGXY(e);
    const w = toWorld(cx, cy);
    const n = map!.nodes[nodeId];
    dragRef.current = { id: nodeId, ox: w.x - n.x, oy: w.y - n.y, moved: false };
  }

  function onLinkClick(e: React.MouseEvent, linkId: string) {
    e.stopPropagation();
    if (linkingFrom) return;
    setSelectedLinkId(linkId);
    setSelectedId(null);
    setNotesOpen(false);
  }

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if ((linkingFrom || reparentingFrom) && svgRef.current) {
        const { cx, cy } = getSVGXY(e);
        setMouseWorld(toWorld(cx, cy));
        return;
      }
      if (dragRef.current && map) {
        const { cx, cy } = getSVGXY(e);
        const w = toWorld(cx, cy);
        dragRef.current.moved = true;
        onUpdateNode(map.id, dragRef.current.id, {
          x: w.x - dragRef.current.ox,
          y: w.y - dragRef.current.oy,
        });
      } else if (panRef.current) {
        const { cx, cy } = getSVGXY(e);
        const ntx = panRef.current.tx + (cx - panRef.current.cx);
        const nty = panRef.current.ty + (cy - panRef.current.cy);
        setTx(ntx); setTy(nty);
      }
    }
    function onMouseUp() {
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

  function deleteSelected() {
    if (!map) return;
    if (selectedLinkId) {
      onDeleteLink(map.id, selectedLinkId);
      setSelectedLinkId(null);
      return;
    }
    if (!selectedId || Object.keys(map.nodes).length <= 1) return;
    onDeleteNode(map.id, selectedId, map.nodes, map.edges);
    setSelectedId(null);
    setNotesOpen(false);
  }

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

  const nodes = Object.values(map.nodes);
  const edges = map.edges;
  const links = map.links || [];
  const linkingSource = linkingFrom ? map.nodes[linkingFrom] : null;
  const reparentingSource = reparentingFrom ? map.nodes[reparentingFrom] : null;

  return (
    <div className={styles.canvasWrap}>
      <svg
        ref={svgRef}
        className={`${styles.svg} ${panRef.current ? styles.grabbing : ''} ${(linkingFrom || reparentingFrom) ? styles.linking : ''}`}
        onMouseDown={onSvgMouseDown}
        onWheel={onWheel}
      >
        <defs>
          <marker id="arrowhead" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#888" />
          </marker>
          <marker id="arrowhead-sel" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#1D9E75" />
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
              return (
                <g key={link.id}>
                  {/* Hit target (invisible wider line) */}
                  <line
                    x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                    stroke="transparent"
                    strokeWidth="12"
                    style={{ cursor: 'pointer' }}
                    onMouseDown={e => onLinkClick(e, link.id)}
                  />
                  <line
                    x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                    stroke={color}
                    strokeWidth={isSel ? 2 : 1.5}
                    strokeDasharray={link.stroke === 'dashed' ? '6 3' : 'none'}
                    markerEnd={link.style === 'arrow' ? (isSel ? 'url(#arrowhead-sel)' : 'url(#arrowhead)') : undefined}
                    style={{ pointerEvents: 'none' }}
                  />
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
                    stroke={isSel ? '#1D9E75' : c.stroke}
                    strokeWidth={isSel ? 2 : 1}
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
                  {n.notes && (
                    <circle cx={w - 6} cy={6} r={3.5} fill="#1D9E75" />
                  )}
                </g>
              );
            })}
          </g>
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
        onToggleNotes={() => setNotesOpen(v => !v)}
        onStartLink={startLinking}
        onStartReparent={startReparenting}
        onToggleLinkStyle={() => {
          if (selectedLink) onUpdateLink(map.id, selectedLink.id, { style: selectedLink.style === 'arrow' ? 'line' : 'arrow' });
        }}
        onToggleLinkStroke={() => {
          if (selectedLink) onUpdateLink(map.id, selectedLink.id, { stroke: selectedLink.stroke === 'solid' ? 'dashed' : 'solid' });
        }}
        linkStyle={linkStyle}
        linkStroke={linkStroke}
        onSetLinkStyle={setLinkStyle}
        onSetLinkStroke={setLinkStroke}
        onLayout={handleLayout}
        onFitView={fitView}
        onExportJson={() => onExportJson(map)}
        onExportImg={() => onExportImg(map)}
      />

      {notesOpen && selectedId && map.nodes[selectedId] && (
        <NotesPanel
          nodeLabel={map.nodes[selectedId].label}
          notes={map.nodes[selectedId].notes || ''}
          onChange={(notes) => onUpdateNode(map.id, selectedId, { notes })}
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
        double-click to edit · drag to pan · scroll to zoom
      </div>
      <div className={styles.zoom}>
        {Math.round(scale * 100)}%
      </div>
    </div>
  );
}
