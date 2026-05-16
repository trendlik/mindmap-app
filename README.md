# Mind Map App

A freeform mind mapping app built with React 18 + TypeScript. Supports multiple maps, Google sign-in, cloud sync via Firestore, pan/zoom canvas, and export.

## Getting started

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env.local` and fill in your Firebase project values before running.

## Build for production

```bash
npm run build
npm run preview   # serve the build locally
```

## Features

- **Google sign-in** — authenticate with your Google account; each user's maps are stored privately in Firestore
- **Cloud sync** — maps persist to Firestore in real-time; localStorage is used as a fast local cache
- **Multiple maps** — create, rename (double-click), delete from the sidebar
- **Labels** — tag maps with free-form labels via the hover-reveal tag icon; filter by label in search using `label:X`, `label:X|Y` (OR), or `label:X&Y` (AND)
- **Archive** — archive maps to declutter the sidebar; archived maps collapse into a separate section and can be restored at any time
- **Map ordering** — sort the sidebar by manual drag-and-drop, name A→Z / Z→A, or recently/least-recently updated; sort preference persists across sessions
- **Global search** — search across map names, node labels, and notes; supports plain text and `label:tag` syntax (including `label:archived`)
- **Freeform canvas** — drag nodes anywhere, scroll to zoom, drag canvas to pan
- **Add nodes** — select a node, then use `+ child` or `+ sibling` in the toolbar
- **Edit nodes** — double-click any node to rename inline
- **Arrow key navigation** — use arrow keys to move between nodes spatially; the canvas auto-pans to keep the selected node in view
- **Notes panel** — attach freeform notes to any node
- **Auto-layout** — arranges all nodes into a clean tree
- **Fit view** — zooms to show all nodes
- **Re-centre** — double-click the empty canvas (or double-tap on mobile) to snap back to the root node
- **Export** — download as JSON (for re-importing) or SVG (for sharing)
- **Usage stats** — tracks per-feature usage counts and active session time, synced across devices via Firestore

## Project structure

```
src/
  App.tsx                       Root component
  App.module.css
  index.tsx
  index.css                     Design tokens + global styles
  firebase.ts                   Firebase initialisation
  contexts/
    AuthContext.tsx              Auth state provider (Google sign-in)
    UsageStatsContext.tsx        Usage tracking provider (per-feature counts + active time)
  store/
    useMindMapStore.ts           All state logic + dual localStorage/Firestore persistence
    firestoreSync.ts             Firestore real-time sync helpers
    usageStatsSync.ts            Firestore sync for usage stats
  components/
    AuthGate.tsx                 Sign-in screen shown when unauthenticated
    AuthGate.module.css
    Canvas.tsx                   SVG canvas with pan/zoom/drag/edit
    Canvas.module.css
    ConfirmDialog.tsx            Custom modal replacing native confirm()
    ConfirmDialog.module.css
    NotesPanel.tsx               Per-node notes editor
    NotesPanel.module.css
    Sidebar.tsx                  Map list with create/rename/delete/archive/sort + search
    Sidebar.module.css
    StatsPanel.tsx               Usage stats panel
    StatsPanel.module.css
    Toolbar.tsx                  Action buttons
    Toolbar.module.css
  utils/
    export.ts                    JSON and SVG export
```
