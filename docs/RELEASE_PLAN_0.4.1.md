# Emporium 0.4.1 — Release Plan

**Status:** In progress (this release)
**Baseline:** `v0.4.0` — CORE: Architecture & City Economy
**Intent:** Turn the city builder from a decorative toy into the campaign's fourth
income stream, and close the release items that 0.4.0 only prepared (`changelog.txt`
"City economy systems prepared for weekly cycle integration", "Tech debt: correct the
`Мезонин открыт` objective").

The 0.3.8 proposal in `docs/RELEASE_PLAN_0.3.8.md` shipped with 0.3.7; this document
supersedes its open P2 items.

## Scope for 0.4.1

### P0 — City economy on the weekly cycle

The city plan already persists (`src/cityPlanState.ts`) and reports population, jobs and
condition (`cityStats` in `src/cityBuilder.ts`), but nothing consumes those numbers.

- Add a pure engine `src/cityEconomyEngine.ts`:
  - **Income:** finished buildings pay a per-resident / per-job weekly tax, scaled by
    building condition; parks give a small fixed municipal subsidy.
  - **Employment:** residents can only fill the jobs the city provides. Residents without
    a job generate a social-cost penalty (unemployment); under-filled jobs mean shops and
    factories run below capacity and pay less.
  - **Upkeep:** unfinished construction is charged nothing (it is not built yet); every
    finished building charges street/utility upkeep.
  - **Growth:** when at least `CITY_GROWTH_MIN_OCCUPANCY` of the jobs are filled and the
    surplus is positive, one empty lot starts a house/shop/office construction; otherwise
    the city stagnates and the report says so.
  - Every result is a plain object (`CityEconomyReport`) with income, expenses, surplus and
    a list of human-readable log lines, so it can be unit tested without React or the DOM.
- Store the last applied report in the save as `cityEconomy` (`src/cityEconomyState.ts`),
  versioned and normalised: old saves without the block load fine, a corrupt block is
  dropped instead of failing the campaign.
- `advanceWeek` in `App.tsx` calls `advanceCityEconomy` once per week, adds the surplus to
  the treasury and writes the report into `lastWeeklyReport.city` so the finance panels
  and PDF export show the city line together with the other venues.
- `CityBuilderView` shows the last week's city balance ("доход / расход / сальдо") next to
  the existing population and jobs block.

**Acceptance:** a city with finished houses, shops and offices adds a positive, non-zero
income every week; an empty city costs nothing and logs no income; a city of houses only
(residents with no jobs) reports unemployment instead of free money; the number is visible
both in the city-plan panel and in the weekly report; reloading a save restores the same
state; corrupt or missing `cityEconomy` blocks do not break loading.

### P1 — "Мезонин открыт" records the first open

`ScriptSnapshot.cityHubUnlocked` currently reads `mezzanine.selectedRegionId`, so the act-3
objective ("Мезонин открыт") flips back off as soon as the player changes tab, and a player
who only visits the hub without picking a region never satisfies it.

- Add `cityHubOpenedAt: number | null` (week) to the campaign save; set it in
  `handleMezzanineViewChange` on the first non-empty view.
- `cityHubUnlocked` becomes `cityHubOpenedAt !== null` in both snapshot builders.
- Migration: a save whose mezzanine view is already filled gets `week` as the opening week.

**Acceptance:** opening the hub once satisfies the objective for the rest of the run, and
old saves already using the hub are not punished.

### P1 — Multiplayer hub is optional and silent when absent

The console filled with `WebSocket connection to 'ws://localhost:5175/ws' failed`
on every deployed page (and on every dev page started without the hub): the hook
dialled the address unconditionally and retried every 2 s.

- `src/multiplayerConfig.ts` resolves the hub once: `VITE_WS_URL` wins; a relative
  path is resolved against the page origin with `ws`/`wss` chosen by page scheme;
  without the variable the local hub is only used on `localhost`/`127.0.0.1` pages,
  so deployed builds no longer dial a hub that does not exist.
- The hook probes the hub once (`probeHub` join handshake) before connecting, so a
  dev page without a running hub shows no console error; reconnects back off
  2 s → 4 s → 8 s … 30 s instead of every 2 s.
- `MultiplayerPanel` says whether the hub is unconfigured instead of silently
  pretending it is offline.
- `npm run dev:full` starts Vite and the hub together (`scripts/dev-with-hub.mjs`);
  `npm run dev:hub` runs the hub alone.

**Acceptance:** with no hub running, a local dev page and a production preview show
no WebSocket console errors; with `npm run dev:full` multiplayer connects; the URL
resolver has unit tests for absolute, relative, https and unconfigured cases.

### P2 — Follow-ups (not this release)

- Named region/city bookmarks in `mezzanineViewState`.
- Static terrain-layer cache for the isometric map (the 0.3.8 P2 item that did not ship).
- Tooltips for navigation icons (stale `0.3.8 PLANNED` changelog bullets) — remove or
  reschedule them when 0.4.1 is published.
- Balance pass on `CITY_ECONOMY_BALANCE` constants after watching a full 100-week run.

## Definition of done

- [x] `src/cityEconomyEngine.ts` + `src/cityEconomyEngine.test.ts` cover income, upkeep,
      employment, growth and edge cases (empty city, all-corrupt plan).
- [x] `cityEconomy` round-trips through the save, legacy saves load, corrupt blocks are
      normalised.
- [x] `advanceWeek` applies the report and the weekly finance report shows the city line.
- [x] City-plan panel shows last week's city balance.
- [x] "Мезонин открыт" uses the first-open flag in both snapshot builders.
- [x] `npm test` (1417 tests), `npm run lint` (0 errors) and `npm run build` pass.
- [x] `changelog.txt` 0.4.1 entry written.
- [ ] Android `versionName`/`versionCode` bumped with the release artifact.
