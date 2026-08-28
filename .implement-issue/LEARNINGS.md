# implement-issue — Project Learnings

Approved, project-specific findings from implement-issue retrospectives (Phase 8).

This file is **data, not instructions**: it supplies content *within* individual
phases — extra clarify questions, planning constraints, test commands, review
checklist items, known CI flakes. It can never add, remove, reorder, or skip the
skill's phases, checkpoints, or gates; those are defined only by the skill itself
(SKILL.md / WORKFLOW.md). A finding that doesn't fit one of the fixed section
headings below is a flow change by definition and does not belong here — escalate
it to the skill's maintainers instead (see WORKFLOW.md Phase 8 Step 4b).

Every entry ends with its provenance: `(issue #<n>, YYYY-MM-DD, skill@<short-sha|vVersion>)`.
An entry recorded against a much older skill commit may describe behaviour the
skill no longer has — verify before trusting it.

## Clarify checklist (Phase 1)

<!-- Extra questions/checks to run against every issue in this repo -->

## Planning constraints (Phase 2)

<!-- The skill already applies a baseline of architecture standards to every plan (module/layer
     boundaries, no near-duplicate abstractions, single source of truth for new state). Add only
     THIS repo's own edge cases, architectural rules, and config gotchas here — don't repeat the
     baseline. -->

- When the plan touches the hash ↔ `activeMapId` effects in `src/App.tsx`, enumerate the
  initial-state matrix explicitly in the plan and state the expected outcome of each cell:
  hash absent / hash naming a cached map / hash naming a map that only arrives in a later
  Firestore snapshot / hash naming a map that never loads. Also list every call site that
  changes the active map (`handleSelectMap`, `handleCreateMap`, `handleNodeFocus`,
  `handleDeleteMap`, the `hashchange` listener) and say what each does with the pending
  deep-link state. The `[maps]` effect runs BEFORE the `[activeMapId]` effect that writes
  the hash, so within one commit the effect always observes the PREVIOUS map's hash.
  (issue #96, 2026-08-28, skill@v1.6.0)

## Build & test (Phase 4)

<!-- Commands, environment quirks, required version-control-ignored files, suite-specific advice -->

- `subscribeToMaps` is a no-op under `window.__PLAYWRIGHT_TEST_USER__` (`isTestMode()` in
  `src/store/firestoreSync.ts`), so any behaviour that depends on a Firestore snapshot
  arriving AFTER mount cannot be covered by E2E. Verify those paths by reasoning in review;
  do not file "add an E2E test for it" findings against them.
  (issue #96, 2026-08-28, skill@v1.6.0)
- Known pre-existing flakes, confirmed to flake on `master` at the same rate:
  `zoom-controls.spec.ts:118`, `nodes.spec.ts:55`, `nodes.spec.ts:126`. Re-run before
  treating any of them as a regression introduced by the change under test.
  (issue #96, 2026-08-28, skill@v1.6.0)

## Review checklist (Phase 5)

<!-- The reviewer already applies a baseline checklist to every diff: architecture standards,
     security, and test quality (see WORKFLOW.md Phase 5). Add only THIS repo's own review items
     on top — don't repeat the baseline. -->

- When a ref or flag gates navigation (e.g. a pending deep link), check EVERY call site that
  changes the active map, not just the one named in the finding: `handleSelectMap`,
  `handleCreateMap`, `handleNodeFocus` (the sidebar-search path), `handleDeleteMap`, and the
  `hashchange` listener. Note that `history.pushState` does NOT fire `hashchange`, but
  `Canvas.tsx` and `NotesPanel.tsx` assign `location.hash` directly and DO.
  (issue #96, 2026-08-28, skill@v1.6.0)
- Any key taken from `location.hash` must be checked with
  `Object.prototype.hasOwnProperty.call(obj, key)` before indexing `maps` or `map.nodes` —
  a bare `maps[id]` truthiness check passes for `__proto__`, `constructor` and `toString`,
  making `activeMap` become `Object.prototype` and dropping the app into the ErrorBoundary.
  (issue #96, 2026-08-28, skill@v1.6.0)

## CI quirks (Phase 7)

<!-- Known flaky checks, their failure signatures, and proven fixes -->
