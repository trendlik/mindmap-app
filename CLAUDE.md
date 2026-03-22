# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — dev server (Vite)
- `npm run build` — production build (output in `dist/`)
- `npm run preview` — serve production build locally
- `npx tsc --noEmit` — type-check without emitting
- `firebase deploy` — deploy hosting + Firestore rules

No test runner or linter is configured.

## Architecture

React 18 + TypeScript + Vite app for freeform mind mapping. Firebase Auth (Google sign-in) + Firestore for per-user cloud persistence. localStorage used as a fast cache.

### Auth flow
`AuthProvider` (context in `src/contexts/AuthContext.tsx`) wraps the app. `AuthGate` component shows a sign-in screen when unauthenticated, or renders children when signed in. The `user.uid` is passed to the store hook to scope Firestore reads/writes.

### State (`src/store/useMindMapStore.ts`)
- `useMindMapStore(uid)` is the sole state hook. Accepts the Firebase user ID (or null).
- Maps are stored as `Record<string, MindMap>`. Nodes keyed by ID; edges are `{ from, to }` arrays.
- Dual persistence: writes to localStorage immediately, then debounces (500ms) to Firestore.
- On first sign-in, localStorage maps are migrated to Firestore. After that, Firestore snapshots are the source of truth.
- IDs use `crypto.randomUUID()` (safe for multi-device).
- `colorForDepth()` and `measureNode()` are exported utilities used by both Canvas and export.

### Firestore sync (`src/store/firestoreSync.ts`)
- Data model: `users/{uid}/maps/{mapId}` — one document per map.
- `subscribeToMaps()` sets up a real-time `onSnapshot` listener.
- Security rules in `firestore.rules`: each user can only read/write their own `users/{uid}` subtree.

### Component hierarchy
`AuthProvider` → `App` → `AuthGate` → `Sidebar` + `Canvas` (with embedded `Toolbar`)

- **Canvas** (`src/components/Canvas.tsx`): SVG-based canvas handling pan (drag background), zoom (scroll wheel), node drag, inline editing (HTML input overlaid on SVG), and selection. View transform is `translate(tx,ty) scale(s)` on a top-level `<g>`. Edges are cubic Bézier paths.
- **Sidebar** (`src/components/Sidebar.tsx`): Map list with create/rename (double-click)/delete. Shows user avatar and sign-out button in footer.
- **Toolbar** (`src/components/Toolbar.tsx`): Action buttons for add child/sibling, delete, auto-layout, fit view, export.

### Styling
CSS Modules (`.module.css`) per component. Design tokens (color palette for node depths, fonts) defined as CSS custom properties in `src/index.css`.

### Export (`src/utils/export.ts`)
JSON export serializes nodes/edges. SVG export rebuilds the mind map as a standalone SVG string with hardcoded hex colors (separate from the CSS-variable-based runtime palette).

### Firebase config
- Firebase init in `src/firebase.ts`, config values loaded from `VITE_FIREBASE_*` env vars.
- `.env.local` holds actual values (gitignored). `.env.example` documents the required vars.
- `firebase.json` configures hosting (serves `dist/`) and Firestore rules.
