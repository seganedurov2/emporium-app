# Emporium 0.4.4 — Mezzanine Journal: «Журнал “Информатика”»

**Status:** Draft for review  
**Baseline:** `v0.4.2` (Architecture & Stability gate; journal tab shell already present)  
**Intent:** Turn the existing `mezzanine_journal` tab from a demo stub into a complete in-game “Журнал «Информатика»”: full rubric structure, real article/content records, readable presentation, and stable integration with navigation and the Mezzanine hub — without touching campaign save semantics.

## Current state (baseline facts)

Already in codebase (do not regress):
- `src/components/mezzanine/MezzanineJournalTab.tsx` — UI shell with 15 rubric ids, search, section filter, expandable article cards, and static summary blocks.
- `src/appNavigation.ts` — `AppTab` includes `mezzanine_journal`; `APP_NAVIGATION` includes `Журнал «Информатика»`.
- `src/App.tsx` — imports/renders `<MezzanineJournalTab onOpenTab={...} />` for `activeTab === 'mezzanine_journal'`.
- `src/components/mezzanine/MezzanineTab.tsx` — exposes journal access from the hub sections/pause menu and highlights the active tab.

Gap: `JOURNAL_ARTICLES` contains only 5 sample items; lower summary blocks use hardcoded counts; there is no authoritative content source for “everything from the journal”.

## Scope

### P0 — Content model and data source (save-format neutral)

1. **Define a typed journal content module** (no React, no save coupling), e.g. `src/mezzanineJournal.ts` or `src/content/mezzanineJournal.ts`:
   - `JournalSectionId` union aligned with the 15 rubrics already used by the tab.
   - `JournalArticle` / `JournalEntry` type: stable `id`, `section`, `title`, `authors?`, `year?`, `issue?`, `volume?`, `pages?`, `abstract?`, `body?`/`content?`, `tags?`, `sourceUrl?`, `doi?` (only fields supported by the source material; keep optional where the source is incomplete).
   - `JournalBlock` / collection entries for non-article sections that the journal actually contains: practical developments, Russian-Belarusian/national programs, announcements, conference reports, book reviews. Do not represent these as fake articles unless the source provides article-like metadata.
   - Export pure selectors/helpers: `getJournalSections()`, `getEntriesBySection()`, `searchJournalEntries(query)`, counts by section. Unit-testable.

2. **Ingest “everything from Журнал «Информатика»” from an authoritative source** (chosen at implementation time; record the choice in the PR/commit):
   - Preferred: checked-in structured data (`src/content/mezzanineJournal.data.ts` or JSON imported as a module) generated from the provided source (export, spreadsheet, scraped/public listing, or user-supplied archive). Keep the generator script in `tools/` if used.
   - Constraint: do not scrape or copy paywalled/full copyrighted article text into the repo unless explicitly licensed for bundling. Store metadata (title/authors/issue/pages/abstract where permitted) and external links/identifiers; show in-game summaries/metadata and link out where appropriate.
   - Acceptance is content-complete relative to the agreed source: every rubric present in the source has its entries represented; counts in UI match data.

3. **No campaign save changes.** Journal content is static/reference data. Do not add journal fields to `ManagedCampaignState`, `saveState.ts`, or migrations unless a later, explicit requirement adds player progress (bookmarks/read state). If read state is requested, isolate it as an optional, backward-compatible field with migration/default handling and round-trip tests.

### P1 — UI integration in the game

1. **Refactor `MezzanineJournalTab.tsx` to consume the content module**:
   - Replace hardcoded `JOURNAL_ARTICLES` and hardcoded summary counts with data from the module.
   - Render all 15 rubrics with accurate counts; empty rubrics show an explicit empty state (not missing sections).
   - Section-specific rendering where metadata differs (article vs announcement/report/review/program/development) while keeping one coherent tab.
   - Search across title/authors/abstract/tags/identifiers; keep filtering fast for the full dataset (memoized selectors; no network).
   - Preserve accessibility basics: keyboard-focusable controls, visible focus, semantic headings/lists/buttons, `aria-expanded` for expandable entries.

2. **Navigation/hub consistency**:
   - Keep `mezzanine_journal` in `APP_NAVIGATION` and `AppTab` (already present); verify label/icon consistency.
   - Keep Mezzanine hub entry points (`MezzanineTab` sections menu + pause menu) opening the same tab; remove duplicate hardcoded journal label where a nav constant can be reused safely.
   - Ensure back/return flow is predictable (opening from Mezzanine returns context appropriately; no dead-end state).

3. **Visual polish within existing design language**:
   - Use existing Tailwind/slate/amber patterns; no new global theme system.
   - Long lists: paginate or virtualize only if the real dataset makes rendering sluggish; start with simple list + section filters and measure.

### P1 — Quality gates

1. **Tests** (Vitest, pure-first):
   - Content/selectors: every rubric id is known; ids unique; required fields present; search returns expected entries; counts match.
   - UI smoke (React Testing Library, if present in project) or pure render contract: tab renders rubric labels and handles empty/search states. Do not add a new test stack unless absent.
   - Save safety: no changes under `saveState`/migration tests; existing suites remain green.

2. **Verification commands** (run before marking done):
   - `npm test`
   - `npm run lint`
   - `npx tsc -b`
   - `npm run build`

3. **Manual QA checklist**:
   - Open `Журнал «Информатика»` from main navigation, Mezzanine sections, and Mezzanine pause menu.
   - Filter each rubric; confirm counts and non-empty rubrics show real entries.
   - Search by title/author/keyword; clear search restores results.
   - Expand/collapse entries; no layout break on narrow/mobile viewport.
   - Confirm no console errors and no impact on campaign load/save/autosave.

### P2 — Follow-ups (explicitly out of scope for 0.4.4)

- Player bookmarks, read/unread state, favorites, or notes (would require save design).
- Full-text article viewer/import pipeline for copyrighted bodies.
- Remote sync/CMS, admin editing UI, or localization/i18n beyond existing Russian UI.
- Gameplay effects (research bonuses, economy hooks) — only if separately specified; would touch game engines/balance and needs design.

## Risks

| Risk | Mitigation |
| --- | --- |
| “All journal content” source is incomplete or ambiguous | Block P0.2 implementation until the authoritative source/format is provided; document source and coverage. |
| Copyright/licensing of full texts | Store/link metadata and permitted summaries only; require explicit approval for bundled full text. |
| Large dataset hurts render performance | Memoize selectors; add pagination/virtualization only with evidence; keep data static. |
| Accidental save-format coupling | No save-state changes in 0.4.4; guard with existing `saveState`/round-trip tests and diff review. |
| UI duplication/drift (nav vs Mezzanine labels) | Reuse shared labels/constants where practical; test key entry points manually. |

## Definition of done

- [ ] Journal content module exists with typed rubrics/entries/selectors and unit tests.
- [ ] “Журнал «Информатика»” content is complete relative to the agreed authoritative source; rubric counts in UI match data.
- [ ] `MezzanineJournalTab` renders real data for all 15 rubrics, supports search/filter/expand, and handles empty states.
- [ ] Main nav and Mezzanine hub entry points open the tab; no navigation regressions.
- [ ] No campaign save/migration changes; `npm test`, `npm run lint`, `npx tsc -b`, and `npm run build` pass.
- [ ] Manual QA confirms mobile/desktop layout and absence of console/save regressions.
- [ ] `changelog.txt` has a `0.4.4` entry; Android `versionName`/`versionCode` bumped only when preparing the release build (separate, explicit step).
