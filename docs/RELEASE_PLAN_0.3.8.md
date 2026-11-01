# Emporium 0.3.8 — Release Plan

**Status:** Draft for review
**Baseline:** `v0.3.7` (`4b605a948dcc194733583968809daa7ea4d53d79`)
**Intent:** Improve continuity of the city-planning flow, reduce save churn during map interaction, and make release checks reproducible.

This document proposes scope; it does not change or replace the published `v0.3.7` release.

## Proposed priorities

### P0 — Persist the city plan (approved)

The city builder currently reconstructs its city from `citySeed` when `CityBuilderView` mounts. Buildings, demolition, and construction progress are held in component state and are lost when the view unmounts or the app reloads.

- Store one active city plan per campaign as a versioned, sparse list of placed buildings; regenerate the deterministic grid from `citySeed`.
- Restore the same city model in 2D and 3D, including IDs, construction progress, and condition.
- Pause simulation when the player navigates away from the city plan in-app. If the app closes while the plan was active, resume unfinished construction at 1× for at most 8 hours; do not apply offline condition decay.
- Confirm before a non-empty plan is replaced by another city seed or “Новый город”; Cancel preserves the current plan and seed.
- Keep older saves valid by providing an empty-plan fallback; normalize malformed plan data without dropping the campaign.
- Add pure serialization/restore, capped catch-up, round-trip, malformed-data, and legacy-save migration tests.

**Acceptance:** buildings and progress survive campaign reload and route transitions; in-app navigation pauses construction; app-close catch-up is capped and only applies if the city plan was active; older/corrupt saves load safely.

### P1 — Decouple map gestures from save writes

`App.tsx` persists campaign state when `gameState` changes. Mezzanine pan updates currently feed that state during pointer movement, causing repeated full-save writes while dragging.

- Commit the final view position on pointer release or at a bounded interval instead of persisting every movement event.
- Debounce local persistence and flush the latest state on page hide/unload.
- Preserve the final pan/zoom through reload and slot switching.
- Keep wheel events from suppressing scrolling inside map menus and other scrollable overlays.

**Acceptance:** a drag remains responsive, the settled view persists, ordinary gesture movement does not cause a write for every pointer event, and scrollable overlays remain usable.

### P1 — Unify keyboard and touch navigation

The app shell and `MezzanineTab` have separate Escape handlers, and the mezzanine map uses mouse-only drag plus wheel zoom.

- Define one Escape/menu ownership flow across the app shell and mezzanine overlays.
- Move map pan to Pointer Events and support two-finger pinch zoom on touch screens.
- Restrict `touch-action: none` to the interactive map surface so normal page gestures remain available elsewhere.
- Reuse the existing gesture utilities if their behavior matches, or remove obsolete utilities after confirming they have no callers.
- Add testable pure helpers for overlay priority and pinch-distance-to-zoom mapping.

**Acceptance:** a single Escape press closes only the topmost overlay; mouse, pen, and touch can pan; pinch zoom works without breaking normal scrolling outside the map.

### P1 — Make build and browser QA repeatable

- Add GitHub Actions checks for `npm ci`, `npm test`, `npm run build`, and `npm run lint`.
- Replace the `qa:mezzanine` dependency on the external `../.codegpt/skills/browser-automation/browser.mjs` path with an in-repository runner based on the existing `tools/cdp-lib.mjs` and installed `patchright` tooling.
- Run a browser smoke test against the production preview for registration, new-campaign creation, mezzanine rendering, save/reload, and multiplayer hub connection when the hub is available.

**Acceptance:** CI runs the same checks on a clean checkout; the production-preview smoke test can run without files outside this repository and reports failures with actionable output.

## P2 — Candidate map polish

These items can follow the persistence and input work if capacity remains:

- Add named region/city bookmarks to the normalized mezzanine view state.
- Cache deterministic static terrain layers and invalidate them on resize or zoom; the current `CHUNK_SIZE` helpers are not yet a cache implementation.
- Persist the region terrain seed so a region-only view restores the same map after reload.
- Correct the campaign act objective “Мезонин открыт” so its condition matches its label and the documented “opened at least once” behavior.
- Update or remove stale `0.3.8 PLANNED` changelog bullets after the final scope is selected.

## Not included in this release proposal

- Connecting city population/jobs to the campaign economy; this requires game-balance decisions across `cityBuilder`, `gameEngine`, and weekly-advance logic.
- Treating the current client-side localStorage login as production account security. It is not server authentication; do not use it for sensitive accounts or multiplayer authorization.

## Release Definition of Done

- [ ] City-plan saves round-trip, normalize corrupt data, and preserve legacy-save compatibility.
- [ ] Map interactions persist their settled state without serializing the entire campaign on every drag event.
- [ ] Escape and pointer/touch navigation behave consistently across desktop and mobile layouts.
- [ ] `npm test`, `npm run build`, and `npm run lint` pass locally and in GitHub Actions.
- [ ] Production-preview smoke tests cover a fresh campaign, mezzanine rendering, and reload restoration.
- [ ] The release changelog lists only completed `0.3.8` work and Android `versionName`/`versionCode` are updated for the next artifact.
