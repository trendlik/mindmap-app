# Mind Map App

A freeform mind mapping app built with React. Supports multiple maps, persistent storage, pan/zoom canvas, and export.

## Getting started

```bash
npm install
npm run dev
```

## Build for production

```bash
npm run build
npm run preview   # serve the build locally
```

## Features

- Multiple maps — create, rename (double-click), delete from the sidebar
- Freeform canvas — drag nodes anywhere, scroll to zoom, drag canvas to pan
- Add nodes — select a node, then use `+ child` or `+ sibling` in the toolbar
- Edit nodes — double-click any node to rename inline
- Auto-layout — arranges all nodes into a clean tree
- Fit view — zooms to show all nodes
- Export — download as JSON (for re-importing) or SVG (for sharing)
- Persistent — all maps saved to localStorage automatically

## Project structure

```
src/
  App.jsx                  Root component
  App.module.css
  index.js
  index.css                Design tokens + global styles
  store/
    useMindMapStore.js     All state logic + localStorage persistence
  components/
    Canvas.jsx             SVG canvas with pan/zoom/drag/edit
    Canvas.module.css
    Sidebar.jsx            Map list with create/rename/delete
    Sidebar.module.css
    Toolbar.jsx            Action buttons
    Toolbar.module.css
  utils/
    export.js              JSON and SVG export
```
