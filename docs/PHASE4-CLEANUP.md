# Phase 4 cleanup list (nothing deleted yet)

Everything below is tracked in git and is no longer loaded by the new site or the update job. The old Betting schedule code is preserved by the tag `old-site-final` (origin/main before the rebuild). This file itself is removed with the cleanup.

## 1. Old site scripts (not loaded by `site/index.html`; 271 KB)
| File | Size | Reason |
|---|---|---|
| `site/euroleague-data.js` | 29.9 KB | Browser-side fetch, parser, possession and lineup tracker: replaced by `scripts/fetch`, `scripts/build` and the data files |
| `site/fantasy-live.js` | 20.2 KB | Old aggregation, history and eligibility: replaced by the views and `site/eligibility.js` |
| `site/fantasy-metrics.js` | 14.2 KB | Old metric definitions: replaced by the registry |
| `site/fantasy-shots.js` | 7.3 KB | Old shot loading and assist linking: replaced by the build and `site/data/shots` |
| `site/fantasy-workbench.js` | 38.1 KB | Old Fantasy tables and cards: replaced by `fantasy-tables.js`, `fantasy-cards.js` |
| `site/fantasy-charts.js` | 38.5 KB | Old Charts mode: replaced by `fantasy-gallery.js` |
| `site/fantasy-viz.js` | 14.9 KB | Old radar and shot chart: replaced by `fantasy-cards.js`, `fantasy-shotchart.js` |
| `site/betting-live-data.js` | 3.7 KB | Old Betting data builder |
| `site/betting-stats.js` | 23.7 KB | Old Betting team table: replaced by `betting-tables.js` |
| `site/betting-players.js` | 51.8 KB | Old Betting player table and Tier 2 analysis (allowance, beneficiaries, rotation, absences): hidden; preserved in `old-site-final` for the redesign |
| `site/betting-schedule.js` | 16.7 KB | Old "From the schedule" page (hidden): preserved in `old-site-final` |
| `site/team-history.js` | 13.4 KB | Old team card / history: replaced by `fantasy-cards.js` |

`site/shot-zones.js` (9.6 KB) is still loaded (drawing geometry and grading) and stays.

## 2. Old tests and fixtures (they boot the old scripts above)
| File | Size | Reason |
|---|---|---|
| `tests/fantasy-curves.test.cjs` | 4.5 KB | Tests old `fantasy-metrics.js` |
| `tests/fantasy-profile.test.cjs` | 23.2 KB | Boots the old site scripts |
| `tests/shot-zones.test.cjs` | 29.4 KB | Boots the old site scripts (the assist cases were ported to `tests/build/assists.test.mjs`) |
| `tests/fixtures/betting-games-seed.js` | 11.4 KB | Old test seed |
| `tests/fixtures/betting-players-seed.js` | 97.3 KB | Old test seed |
| `tests/fixtures/fantasy-shots-seed.js` | 536.4 KB | Old test seed |
| `tests/fixtures/game75-box.json`, `game75-pbp.json` | 13.7 KB + 167.5 KB | Used only by the old tests (the new PBP tests use synthetic data and the real raw files) |

Keep: `tests/fixtures/game10-*.json` and `assist-cases.json` (used by `tests/build/assists.test.mjs`), and all of `tests/metrics`, `tests/build`, `tests/loader`.
Delete the old tests in the same commit as the old scripts, otherwise `node --test tests` fails.

## 3. Old documents and data
| Path | Size | Reason |
|---|---|---|
| `legacy/dashboard.html` | 677 KB | Old single-file dashboard, not linked by the site |
| `notes/chatgpt/*` (5 notes) | 21.9 KB | Notes about the 3StepsBasket flow, round 7 and the old live engine |
| `notes/chatgpt/fantasy-position-overrides.json` | 0.1 KB | Duplicate: the live copy is `data/manual/fantasy-position-overrides.json` |
| `tools/fetch-shot-seed.ps1` | 0.9 KB (tracked) | Fetches seeds for the deleted old tests |
| `tools/connect-fantasy-ui.cjs`, `tools/update-fantasy-live.cjs` | 1.5 KB + 2.7 KB (untracked) | One-off patch scripts for old files |
| `PLAN.md`, `ARCHITECTURE.md` (root) | 40.3 KB + 13.0 KB | Greek plan and architecture of the old design; replaced by the new README and `docs/` |
| `METRICS.md` (root, Greek) | 27.9 KB | Replaced by the generated `docs/METRICS.md` |
| `docs/UI-STRINGS-TRANSLATED.md` | 16.1 KB | Review list; remove after you have reviewed it |
| `docs/PHASE4-CLEANUP.md` | this file | Remove with the cleanup |

## 4. Keep (looks old, but is used)
- `site/fantasy-profiles.html`, `fantasy-profiles-3.html`, `fantasy-profiles-5.html` (331 B each): redirects to `#fantasy` for old bookmarks.
- `site/team-assets.js` (304.5 KB): logos; the heaviest file of the page, to optimise separately.
- `site/data/schedule.json` and the schedule snapshot in `data/raw`: not read by any page now; kept for the Betting redesign (small).
- CSS: all 10 stylesheets are still linked by `index.html`, but only part of their classes is used by the new code (shot-zones.css 22 of 22, betting-stats.css 31 of 38, fantasy-workbench.css 53 of 72, fantasy-stats.css 8 of 34, player-card.css 9 of 59, team-history.css 7 of 35, betting-schedule.css 6 of 25). Trim them in a separate, visually checked step; do not delete files blindly (rules are shared).

## 5. Must be removed before merging into main
- `site/data-check.html` (development page for the data layer).
- `.claude/launch.json` and the `.claude/` folder (untracked local preview config; never commit).
- The untracked `tools/*.cjs` files stay out of the commit.
- Check that `.gitignore` keeps `.build-tmp/` and `site/_gate/` out.

## 6. What `README.md` must say (English; today it is Greek and describes the old flow)
1. What Pick n Edge is: a EuroLeague research tool (Fantasy and Betting) over one shared data layer; all stats come only from the EuroLeague API.
2. The data flow: `data/raw` (exact API responses, gzip, immutable) → `data/clean` (components only) → `site/data` (views, per-game rows, shots, engine copy); the site reads files only and makes no EuroLeague calls.
3. The repo map: `site/`, `data/{raw,clean,manual}`, `scripts/{fetch,build,metrics,parity}`, `tests/`, `docs/METRICS.md` (generated, do not edit), `.github/workflows/{pages.yml,update-data.yml}`.
4. The one rule for metrics: every formula lives once in `scripts/metrics/registry.mjs` with a hand-checked test; the site holds none.
5. How to run it locally: `node scripts/build/build.mjs`, `node scripts/build/site-data.mjs`, `node --test tests`, `npx serve site`.
6. The update job (`update-data.yml`): manual `workflow_dispatch` (probe mode; normal mode builds, tests, commits `data/` and `site/data/`, deploys from main only); cron is off until decided.
7. Manual data (`data/manual`): position overrides, name fixes, eligibility thresholds, team ids.
8. Where the old site is: tag `old-site-final`; what is deferred (Betting redesign: schedule page, allowance, beneficiaries, rotation, absences, role shifts; Matchup; with/without; Value/CR).
