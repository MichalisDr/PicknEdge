# Pick n Edge: UI redesign plan (cards, tables, theme)

Last updated 2026-11-10 (evening). Decisions here were made with Michalis; do not change without asking.
NOTE: the card layouts and the Profile/Shooting control are now defined in `docs/card-layouts-final.md`, which supersedes the old "Locked card layouts" and the "open decision on team tiles" that this file used to contain.

## Principles
- One central data layer; the site reads ready files; zero EuroLeague calls from the site.
- Layout, colours and appearance live in files, not in code. Positions and sizes: `site/layout.json` (cards) and `site/table-layouts.json` (tables). Colours, fonts, borders, spacing: a theme file (planned). The site contains no formulas: it reads ready hex values.
- Do not change any visual style that was not asked for (colours, fonts, borders, radii, spacing). Size/position requests never include restyling.
- Only real registry metrics; new ones are flagged. Credits/Value are out until a data source exists.

## Status (2026-11-10 evening)
- Phase 1 (cards): PR #7 (feature/card-layouts). Final layouts are in `docs/card-layouts-final.md`. Before/after images are in the PR description, hosted on branch `pr7-screenshots` (delete that branch only after merge). Squash on merge.
- Phase 2 (tables): spec below, to be run from main after PR #7 is merged. Not started.
- Phase 3 (theme): audit-only prompt written, parked. Run after cards and tables are merged (the audit alone is read-only and can run any time).
- Appearance and colour discussion paused by Michalis on 2026-11-10 18:06; resume later (see Appearance decisions).

## Locked table design (all four tables)
- Flat header row; a thin 2px line above each column group (no group names, not clickable); 0.5px vertical divider at the start of each group; sticky first column; equal-width centered numeric columns; horizontal scroll on narrow screens.
- Click a header: sort (best end first: descending for high-is-better, ascending for low-is-better). Shift+click: combined rank = mean direction-aware percentile of the selected columns (nulls skipped). Plain click clears it. Touch: long-press instead of Shift. Info text top right. No Combine button, group lines are not clickable.
- Small muted "#n" rank after the value, computed over the rows currently shown (follows window, position and eligibility filters). Info text states the pool, e.g. "Rank among: Guards (42)".
- Colour on the value text only: teams top/bottom quarter by rank; players Overview only on unambiguous columns; player zone FG% vs league average (neutral within 3 points, not affected by position filter). "Colours" toggle.
- Players Overview: name (+ credits slot, empty until data) and Team, then PIR | MIN, USG%, Offensive load, TOV%, cTOV% | PTS/100, AST/100, REB/100 | FTr, FD/100. Default sort PIR desc. MIN, USG%, load neutral (no colour). No Value/Credits columns.
- Players Shooting: eFG%, 2FG%, 3FG%, FT% | At the rim, Rest of paint, Mid-range, Baseline, Arc 3, Corner 3. Sub-lines: FGA /100, % of FGA, makes/attempts. Zones under 1 attempt per 100 show "-" dimmed ("few shots"), no rank, sorted last. No Value column.
- Teams Profile: Pace, DRtg | Opp eFG%, Opp FTr | Opp TOV/100, Opp AST/100, DREB% | Opp PTS off TO, Opp fast break, Opp 2nd chance. Default sort DRtg asc. Pace neutral.
- Teams Shooting: Opp eFG%, Opp 2FG%, Opp 3FG% | six zones (opponent FG%, makes/attempts). Default sort Opp eFG% asc.

## Appearance decisions (paused, resume later)
Decided:
- One background for page and card: card background = page background (card.bg defaults to bg.page), separation by frame colour and the dim overlay, tiles are the raised surface. One-line switch to split them.
- Frames have their own colour slot (card and tile border). To be promoted to the main slots in the editor mock.
- Layers: palette -> semantic -> per-component tokens. Surfaces and lines are stored as exact hex values. An editor helper (background + tint) can generate harmonious surfaces, but only the resulting hex are stored; the site has no formulas.
- Editor mock: 7 main pickers (background, tint helper, accent, text primary, text secondary, good, bad) + advanced (header, zebra, tile, lines, outer frame, card frame, card background) + "card = page" toggle + send-palette button. Site shows no palette editor yet; an in-site Appearance page needs an Export button because the site is static.
- Table view look (mock): sorted or combined columns get an accent header and a faintly lighter column; the name column has the row background (sticky); team logo circle left of the name with "team · position" subtitle and a credits slot on the right; text colours for good/bad distinct from the accent; small #n rank; tabular numerals.
Measured current colours (from screenshots): page #0b1018; table header and name column #111b29; zebra #141e2b; tile #182335; card/modal #101925 (to become #0b1018); fields #0b121c; lines #243144 (rows), #263242 (header, sidebar, outer), #324052 (button groups), #3a4d68 (tile border), #2b394b (card section divider), #172130 (table outer border); accent #ef3d25; active sidebar item bg #2e1716; brand n #b48aff; text #f0f3f6 primary, #94a3b8 secondary, #b8c7da inactive tabs, #d9e3ef and #acbace inside tiles, #757575 placeholder. Proposed good #3ee08f and bad #f0959f (not from the site).
Ideas from the EuroLeague Fantasy feel, pending Michalis' picks: trend bars with value labels and Last 5 / Last 10 chips; big numerals in a heavy condensed display font as a theme slot; pill toggles and one accent action per screen; Next 5 schedule strip (needs schedule data); key-stats strip at the top of the player card; prev/next player arrows in the card header; card opens at the table's current window but stays independently switchable; tabular numerals; per-section accent for Fantasy vs Betting. Adopted in the table mock: sorted-column highlight, team logo next to names. Withdrawn: card as side panel.
Order after the pause: finish PR #7 -> Phase 2 tables -> theme audit -> theme refactor with a pixel-identical gate -> requested visual changes in separate commits.

## Theme plan (parked)
Three layers: palette (only place with raw colours) -> semantic tokens -> per-component tokens. A component token points at a semantic one by default, so changing the page background changes the card too; overriding one component token changes only that component.
Repo structure proposal: site/layouts/cards.json and tables.json (positions, columns); site/theme/theme.json (single source for colours, fonts, borders, spacing) plus generated theme.css; site/components (no raw colours or sizes); docs/APPEARANCE.md with a "I want to change X -> edit Y" table; a test forbidding raw colours outside theme.json.
Slots: Surfaces (page, card, tile, table header, row hover); Lines (card border, tile border, table lines, layout lines); Text (primary, secondary, muted); Brand and interaction (accent, hover, selected tab/button, focus); Status (good, neutral, bad, zone tint good/bad, stars); Data (team colours per team, radar series, shot zone and heat colours); per-area overrides (cards, tables, radar, chart). All data colours are editable slots too, in their own group.
Audit prompt (read-only, no code changes): inventory every hard-coded colour, font, radius, border, shadow and repeating spacing in site/; separate theme from data colours; map every usage to a slot with its current value and files; propose theme.json plus generated CSS variables; list hard cases (inline JS styles, colours computed in code, SVG strings, opacity/color-mix); propose a lint test that forbids raw colours outside the tokens file (allowlist for data colours); propose migration order and a screenshot pixel-diff gate at 1440px and 390px. Do not look for or modify any existing palette editor.

## Backlog
- Mobile polish of the cards (stacked list exists; needs a dedicated pass).
- Shot chart labels at 390px (court is a 460-unit SVG; labels need about 1.7x bigger boxes and repositioning, or a cropped/zoomed chart on narrow screens): design decision pending.
- Credits/Value data source; value chip and progression popover in the header.
- Cron schedule decision, planning doc update, Betting redesign, stylesheet trimming, team-assets.js optimisation, eligibility thresholds L10/Season, cleanup of old branches, EuroLeague data terms, hosting/subscription.
- Delete branch pr7-screenshots only after PR #7 is merged.
