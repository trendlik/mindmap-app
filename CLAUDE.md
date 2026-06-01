# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — dev server (Vite)
- `npm run build` — production build (output in `dist/`)
- `npm run preview` — serve production build locally
- `npx tsc --noEmit` — type-check without emitting
- `firebase deploy` — deploy hosting + Firestore rules (manual)
- `npm run test:e2e` — run Playwright E2E tests
- `npm run test:e2e:ui` — run Playwright tests with interactive UI

No linter is configured. Playwright is used for E2E tests (`e2e/` directory).

## CI/CD (GitHub Actions)

Two workflows in `.github/workflows/`:

- **ci.yml** — Runs on PRs and pushes to `master`. Steps: type-check (`tsc --noEmit`) + production build.
- **deploy.yml** — Runs on push to `master`. Builds, then deploys to Firebase Hosting (live channel) and deploys Firestore rules.

### Required GitHub secrets

| Secret | Description |
|--------|-------------|
| `VITE_FIREBASE_API_KEY` | Firebase API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase auth domain |
| `VITE_FIREBASE_PROJECT_ID` | Firebase project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase storage bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase messaging sender ID |
| `VITE_FIREBASE_APP_ID` | Firebase app ID |
| `FIREBASE_SERVICE_ACCOUNT` | Firebase service account JSON key (for deploy) |

To generate the service account key: Firebase Console → Project Settings → Service accounts → Generate new private key. Paste the full JSON as the `FIREBASE_SERVICE_ACCOUNT` secret value.

## Implementation Standards

Apply these rules whenever implementing a feature, fix, or refactor.

### Usage tracking (logging)
- Call `trackEvent(feature)` from `useUsageStats()` for every new user-facing action (e.g. a new toolbar button, a new sidebar action, a new keyboard shortcut).
- Use an existing feature key if one fits; otherwise add a new string key that matches the pattern already used in `UsageStatsContext.tsx`.
- Do not add `console.log` statements; remove any that appear during development before committing.

### Tests
- Add a Playwright E2E test in `e2e/` for every new user-facing flow.
- Cover the happy path and the primary error or edge case.
- Reuse existing page-object helpers and fixtures already present in `e2e/` rather than duplicating setup code.
- Run `npm run test:e2e` and confirm tests pass before marking work done.

### Documentation
- Update the **Architecture** section of this file (`CLAUDE.md`) whenever the data model, component hierarchy, state shape, or Firestore path changes.
- Update `.env.example` whenever a new `VITE_*` env var is introduced.
- Update `firestore.rules` and the Firestore sync section of this file whenever the Firestore schema or security rules change.
- Do not create separate documentation files; keep all project-level docs in this file.

## Architecture

React 18 + TypeScript + Vite app for freeform mind mapping. Firebase Auth (Google sign-in) + Firestore for per-user cloud persistence. localStorage used as a fast cache.

### URL scheme
The app uses hash-based routing. Two formats are supported:
- `#mapId` — opens the specified map.
- `#mapId/nodeId` — opens the specified map and focuses (selects + scrolls to) the specified node.

The hash is written as `#mapId` only when the active map changes; node focus is never auto-reflected in the address bar. A "copy link" button in the Toolbar writes the full `#mapId/nodeId` URL to the clipboard explicitly.

### Auth flow
`AuthProvider` (context in `src/contexts/AuthContext.tsx`) wraps the app. `AuthGate` component shows a sign-in screen when unauthenticated, or renders children when signed in. The `user.uid` is passed to the store hook to scope Firestore reads/writes.

### Data model
`MindMapNode` fields: `id`, `label`, `x`, `y`, `parentId`, `depth`, `w`, `h`, and optional `notes`, `link`, `icon` (emoji), `collapsed`.

`MindMap` fields: `id`, `name`, `nodes`, `edges`, optional `description` (free-text), `labels` (string tags), `archived`, `links` (custom cross-links), `tx`/`ty`/`scale` (saved view), `updatedAt`.

`CustomLink`: arbitrary cross-node connections with `style` (`arrow`|`line`), `stroke` (`solid`|`dashed`), optional `label`, and directional arrow flags.

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

### Usage stats (`src/store/usageStatsSync.ts`, `src/contexts/UsageStatsContext.tsx`)
- `UsageStatsProvider` wraps the app (inside `AuthProvider`). Exposes `trackEvent(feature)` and `getStats()` via `useUsageStats()`.
- Tracks per-feature event counts and `totalActiveMs`. Persisted to Firestore at `users/{uid}/meta/usage`.
- Disabled in Playwright test mode (`window.__PLAYWRIGHT_TEST_USER__`).

### Component hierarchy
`AuthProvider` → `UsageStatsProvider` → `App` → `AuthGate` → `Sidebar` + `Canvas` (with embedded `Toolbar` and `NotesPanel`)

- **Canvas** (`src/components/Canvas.tsx`): SVG-based canvas handling pan (drag background), zoom (scroll wheel), node drag, inline editing (HTML input overlaid on SVG), and selection. View transform is `translate(tx,ty) scale(s)` on a top-level `<g>`. Edges are cubic Bézier paths. Also handles node collapse/expand, reparent mode, and custom cross-link creation.
- **Sidebar** (`src/components/Sidebar.tsx`): Map list with create/rename (double-click)/delete/archive. Each map item has an (i) button that opens a description popover for viewing and editing free-text map descriptions. Includes a search bar that filters by map name, node labels, node notes, and map labels/tags. Archived maps are shown in a collapsible section. Shows user avatar and sign-out button in footer.
- **Toolbar** (`src/components/Toolbar.tsx`): Action buttons for add child/sibling, delete, auto-layout, fit view, export, collapse/expand, reparent, add custom link. When a node is selected, a "copy link" button copies a deep-link URL (`#mapId/nodeId`) to the clipboard.
- **NotesPanel** (`src/components/NotesPanel.tsx`): Slide-in panel for editing a selected node's notes (markdown-like text), URL link, and emoji icon.
- **StatsPanel** (`src/components/StatsPanel.tsx`): Displays per-feature usage counts and total active time from `UsageStatsContext`.
- **ConfirmDialog** (`src/components/ConfirmDialog.tsx`): Reusable modal confirmation dialog.

### Styling
CSS Modules (`.module.css`) per component. Design tokens (color palette for node depths, fonts) defined as CSS custom properties in `src/index.css`.

### Export (`src/utils/export.ts`)
JSON export serializes nodes/edges. SVG export rebuilds the mind map as a standalone SVG string with hardcoded hex colors (separate from the CSS-variable-based runtime palette).

### Firebase config
- Firebase init in `src/firebase.ts`, config values loaded from `VITE_FIREBASE_*` env vars.
- `.env.local` holds actual values (gitignored). `.env.example` documents the required vars.
- `firebase.json` configures hosting (serves `dist/`) and Firestore rules.
