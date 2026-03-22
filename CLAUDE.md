# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — dev server (Vite)
- `npm run build` — production build (output in `dist/`)
- `npm run preview` — serve production build locally

No test runner or linter is configured.

## Architecture

React 18 app (Vite) for freeform mind mapping. No routing, no external state library — state lives in a single custom hook.

### State (`src/store/useMindMapStore.js`)
- `useMindMapStore()` is the sole state hook. All map CRUD, node CRUD, and layout logic lives here.
- Maps are stored as `{ [mapId]: { id, name, nodes, edges, tx, ty, scale } }`. Nodes are keyed by ID; edges are `{ from, to }` arrays.
- Persists to `localStorage` under key `mindmaps_v2` on every mutation via `persist()`.
- IDs are sequential (`n0`, `n1`, `map0`, `map1`) using a `counterRef`.
- `colorForDepth()` and `measureNode()` are exported utilities used by both Canvas and export.

### Component hierarchy
`App` → `Sidebar` + `Canvas` (with embedded `Toolbar`)

- **Canvas** (`src/components/Canvas.jsx`): SVG-based canvas handling pan (drag background), zoom (scroll wheel), node drag, inline editing (HTML input overlaid on SVG), and selection. View transform is `translate(tx,ty) scale(s)` on a top-level `<g>`. Edges are cubic Bézier paths.
- **Sidebar** (`src/components/Sidebar.jsx`): Map list with create/rename (double-click)/delete.
- **Toolbar** (`src/components/Toolbar.jsx`): Action buttons for add child/sibling, delete, auto-layout, fit view, export.

### Styling
CSS Modules (`.module.css`) per component. Design tokens (color palette for node depths, fonts) defined as CSS custom properties in `src/index.css`.

### Export (`src/utils/export.js`)
JSON export serializes nodes/edges. SVG export rebuilds the mind map as a standalone SVG string with hardcoded hex colors (separate from the CSS-variable-based runtime palette).
