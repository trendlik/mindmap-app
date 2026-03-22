import { measureNode } from '../store/useMindMapStore';
import type { MindMap } from '../store/useMindMapStore';

export function exportJson(map: MindMap) {
  const data = {
    name: map.name,
    nodes: Object.values(map.nodes).map(n => ({
      id: n.id,
      label: n.label,
      x: Math.round(n.x),
      y: Math.round(n.y),
      parentId: n.parentId || null,
    })),
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${map.name || 'map'}.json`;
  a.click();
}

function hexColors() {
  const depth0 = { fill: '#E1F5EE', stroke: '#0F6E56', text: '#085041' };
  const depth1 = { fill: '#E6F1FB', stroke: '#185FA5', text: '#0C447C' };
  const depth2 = { fill: '#EEEDFE', stroke: '#534AB7', text: '#3C3489' };
  const depth3 = { fill: '#FAECE7', stroke: '#993C1D', text: '#712B13' };
  const depth4 = { fill: '#FAEEDA', stroke: '#854F0B', text: '#633806' };
  return [depth0, depth1, depth2, depth3, depth4];
}

function hexColorForDepth(depth: number) {
  const colors = hexColors();
  return colors[depth % colors.length];
}

export function exportSvg(map: MindMap) {
  const nodes = Object.values(map.nodes);
  if (!nodes.length) return;

  const xs = nodes.map(n => n.x);
  const ys = nodes.map(n => n.y);
  const pad = 70;
  const minX = Math.min(...xs) - pad;
  const maxX = Math.max(...xs) + pad;
  const minY = Math.min(...ys) - pad;
  const maxY = Math.max(...ys) + pad;
  const W = maxX - minX;
  const H = maxY - minY;

  let edgeSvg = '';
  map.edges.forEach(e => {
    const a = map.nodes[e.from];
    const b = map.nodes[e.to];
    if (!a || !b) return;
    const { h: ah } = measureNode(a.label);
    const { h: bh } = measureNode(b.label);
    const ay = a.y + ah / 2;
    const by = b.y - bh / 2;
    const my = (ay + by) / 2;
    const c = hexColorForDepth(b.depth);
    edgeSvg += `<path d="M${a.x},${ay} C${a.x},${my} ${b.x},${my} ${b.x},${by}" fill="none" stroke="${c.stroke}" stroke-width="1.5" stroke-opacity="0.5"/>`;
  });

  let nodeSvg = '';
  nodes.forEach(n => {
    const { w, h } = measureNode(n.label);
    const c = hexColorForDepth(n.depth);
    const fs = n.depth === 0 ? 14 : 13;
    const fw = n.depth === 0 ? 500 : 400;
    nodeSvg += `<g>
  <rect x="${n.x - w / 2}" y="${n.y - h / 2}" width="${w}" height="${h}" rx="8" fill="${c.fill}" stroke="${c.stroke}" stroke-width="1"/>
  <text x="${n.x}" y="${n.y + 1}" text-anchor="middle" dominant-baseline="middle" font-size="${fs}" font-weight="${fw}" fill="${c.text}" font-family="sans-serif">${escapeXml(n.label)}</text>
</g>`;
  });

  const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="${minX} ${minY} ${W} ${H}" style="background:#f5f3ef">
${edgeSvg}
${nodeSvg}
</svg>`;

  const blob = new Blob([svgContent], { type: 'image/svg+xml' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${map.name || 'map'}.svg`;
  a.click();
}

function escapeXml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
