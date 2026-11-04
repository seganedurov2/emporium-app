# Emporium 0.4.2 — Architecture & Stability

**Status:** Draft for review
**Baseline:** `657a943` (0.4.0 "CORE: Architecture & City Economy" + 0.4.1 city economy /
optional multiplayer hub)
**Intent:** Close the stability gaps that the 0.3.8 plan left open (single Escape owner,
pointer/touch map input, CI that actually gates the branch, browser smoke test) and cut
the worst of the `App.tsx` monolith without touching the save format.

Do not start the 0.4.x → 0.5 refactor of the campaign state until the P0 gate below is
green: that refactor is the first change that could break `migrateCampaignState`, so it
must land on top of real tests and a real CI.

## Gate before any architecture work (P0)

- **CI must run the checks that protect saves.** `.github/workflows/ci.yml` currently runs
  `npx tsc --noEmit` without a project, which type-checks an empty program, so type
  regressions pass. Replace with `npx tsc -b` (or `npm run build`, which already runs
  `tsc -b`).
- **CI must not pick up agent worktrees.** `.kilo/worktrees/**` contains full app copies;
  they are excluded in `vite.config.ts` now, verify CI on a clean checkout runs only the
  branch's tests (it does: CI does not have `.kilo`, but the exclusion documents intent).
- **Browser smoke test must exist in-repo.** `npm run qa:mezzanine` pointed at
  `../.codegpt/skills/browser-automation/browser.mjs`, a path outside the repository.
  Done: both `qa:` scripts now run `tools/cdp-smoke.mjs`.

## P0 — CI and QA

1. `ci.yml`: `tsc -b`, `npm run lint`, `npm test`, `npm run build`; fail the job when the
   build emits a chunk over the budget.
2. Add `tools/cdp-smoke.mjs` on top of `tools/cdp-lib.mjs` + `scripts/add-spa-404.mjs`
   output (served by `vite preview`): register → new campaign → open the mezzanine →
   save/reload → assert the mezzanine view and city plan come back. Gate it behind a
   `qa` job that runs on pull requests only (headless Chrome is ~40 s).
3. Deprecate `qa:mezzanine`'s external runner path; keep the script, change the entry.

## P0 — Single Escape owner (leftover from 0.3.8)

The docked overlay handlers were unified in 0.3.7 (`mezzanineShortcuts.ts`), but the app
shell still has its own Escape listener. Today a single press can close the app menu and
the mezzanine overlay in the same event.

- Extract the overlay stack (`keymap → city plan → mezzanine menu → app menu`) into one
  pure resolver, keep the existing one in `mezzanineShortcuts` and have the shell consult
  it before handling its own Escape.
- Unit test: one press closes exactly one overlay for every stack permutation.

## P1 — Map input (pointer + pinch)

- Pan already uses Pointer Events in `CityBuilderView`; `MezzanineTab`'s map still uses
  mouse-only drag + wheel zoom.
- Move the region/city map to Pointer Events with two-finger pinch zoom; keep
  `touch-action: none` only on the map surface so page scrolling still works elsewhere.
- Pure helper for pinch distance → zoom, unit tested.

## P1 — App.tsx decomposition (incremental, save-format neutral)

`App.tsx` is ~6.5k lines. Split along seams that cannot change the save shape:

1. `useAdvanceWeek` — the weekly cycle body (funds, reports, meta stats). Move the city
   economy block there together with the other venue income.
2. `useCampaignPersistence` — load/save/migrate/autosave, `readCampaignFromStorage`,
   slot handling. No changes to `migrateCampaignState` semantics.
3. `useTabs` / navigation shell state.

Rule: each extraction keeps the public `gameState` shape identical and is covered by the
existing `saveState.test.ts` round-trip suite plus a snapshot of `advanceWeek` output for
a fixed seed.

## P2 — Deferred to 0.5

- Connecting the city population/jobs to **employee** systems (not just funds) — needs a
  balance decision that would rewrite weekly wages.
- Full i18n of the game screens (0.4.0 shipped `src/i18n.ts` for settings/modals only).

## Risks

| Risk | Mitigation |
| --- | --- |
| Save migrations broken by the App refactor | Leave `saveState.ts`/`migrateCampaignState` untouched; extraction must be mechanical, verified by round-trip tests. |
| New city economy numbers unbalanced | Constants live in `CITY_ECONOMY_BALANCE`; tune after a 100-week playthrough, separate commit. |
| Bundle growth | Chunk budget check in CI; city economy is a small engine chunk. |
| Android (Capacitor) and Telegram Mini App | Smoke test both the web build and a `capacitor://localhost` load before the release tag. |

## Definition of done

- [x] `ci.yml` runs `tsc -b`, lint, tests and `build:web` (chunk-boundary guard); the
      typecheck now follows the project references instead of an empty program.
- [x] `npm run qa:smoke` / `npm run qa:mezzanine` run `tools/cdp-smoke.mjs`, which uses
      only in-repo tooling (`tools/cdp-lib.mjs` + Playwright's Chromium). A `qa` job in
      CI runs it on pull requests.
- [x] One Escape press closes exactly one overlay: `src/escapeStack.ts` is the single
      resolver for the shell and the hub, covered by `escapeStack.test.ts` (all stack
      permutations).
- [ ] Map pan works with mouse, pen and touch; pinch zoom works on the region map.
- [ ] `App.tsx` reduced by at least the weekly-cycle and persistence bodies, with
      unchanged saves.
- [ ] `changelog.txt` 0.4.2 entry; Android `versionName`/`versionCode` bumped.
