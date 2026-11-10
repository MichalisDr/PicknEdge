# Claude Code prompt: finish the cards, build the tables, ship both live

Repo: MichalisDr/PicknEdge (Pages: https://michalisdr.github.io/PicknEdge/). Open PR #7, branch `feature/card-layouts`, is the base for part 1. Read first, all in this repo on branch `feature/card-layouts` under `docs/`: `docs/ui-redesign-plan.md` (principles, locked table design) and `docs/card-layouts-final.md` (the FINAL card layouts and the Profile/Shooting rule). They supersede any older description of the card layouts.

## Working rules (apply to everything below)
- Work through all parts in order without asking questions. Where something is ambiguous, take the most reasonable reading, say which one in the final report, and continue. The only reason to stop is a failed gate (listed per part).
- Do not change any visual style that was not asked for (colours, fonts, borders, radii, spacing). Size/position work never includes restyling.
- Content inside tiles and cells has a constant size; fit is solved with grid or column sizes, never by scaling fonts.
- Everything stays in files: card positions in `site/layout.json`, table columns/order in `site/table-layouts.json`. The site contains no formulas.
- Commit messages end with the attribution lines your session instructs. Run `node --test $(find tests -name '*.test.mjs')` before every commit; it must be green.
- Final report to Michalis: Greek, short, outcome first (what is live, what changed, what you decided on your own), then anything left open. No recap of the steps.

## Part 1: finish PR #7 and merge it

1.1 Profile/Shooting control. Today both cards (player and team) show two tabs, Profile and Shooting. Change it to ONE toggle button, "Shooting". The card always opens in Profile. Pressing the button shows the shooting view and the button shows its pressed state; pressing it again returns to Profile. Keep the existing switch look and position, and the Sample window buttons next to it unchanged. Update tests. Interpretation note for the report: this follows Michalis' "there will not be two options, only Shooting, to go back"; if the code already makes another reading more natural, keep this one and mention it.

1.2 Verify the final layouts. `site/layout.json` must match `docs/card-layouts-final.md` exactly (positions, sizes, tiers, subs, stack order). Report any difference and fix it toward the document.

1.3 Calibration scan. For every team and a spread of at least 45 players, both views (Profile, Shooting), at 1440 px and 800 px viewport width, check that no tile in `dialog .lx-grid .fw-metric` has scrollWidth > clientWidth + 1 or scrollHeight > clientHeight + 1. Known result before your work: 1440 px clean; at 800 px the team tile "Opp PTS off TO" (a 6x1 strip) overflows by 8 px. Fix it by raising the container-query switch from the desktop grid to the stacked list (currently 651 px of container width) to the smallest container width at which every tile of every layout still fits, found by the scan (expected around 780 px). Re-run until clean at 1440, 800 and just above the new breakpoint. Do not work on the 390 px mobile look beyond confirming the stacked list still renders; the mobile polish is a later job.

1.4 Clean-up. Remove code and CSS that is provably unused after the decisions: grep plus tests must show zero references. Candidates: the six-zone "zone" box kind and its constants/tint code in `fantasy-cards.js` and its CSS (no layout uses zone boxes; do NOT touch the shot chart, `fantasy-shotchart.js` or `shot-zones.*`), the "group" tile kind (currently unused in `layout.json`), unused `.fw-pgrid` and `.fw-metrics` rules, stray screenshot or scratch files. KEEP the two documented switches `SHOW_LAYOUT_LINES` and `GROUP_EDGES` (both off, GROUP_EDGES waits for a decision) and the `lines` arrays. Gate: the four cards (player and team, Profile and Shooting) rendered at 1440 px before and after the clean-up must be pixel-identical. List what you removed in the report.

1.5 Merge and go live. Gate: tests green, 1.3 scan clean, 1.4 identical. Then squash-merge PR #7 into main, delete branch `pr7-screenshots` (its images are only needed by the PR description), confirm the GitHub Pages deployment finished, and open the live URL (`#fantasy`) to check that a player card and a team card show the final layouts. If the deploy fails, report the error and stop.

## Part 2: Phase 2 tables (new branch from main after part 1)

Branch `feature/tables` from the updated main. Implement the "Locked table design (all four tables)" section of `docs/ui-redesign-plan.md` exactly: flat header with 2px group lines and 0.5px group dividers, sticky first column, sorting and Shift/long-press combined rank, small muted "#n" ranks computed over the rows shown, text colour on values only, "Colours" toggle, default sorts, the column order given there for Players Overview, Players Shooting, Teams Profile, Teams Shooting. No Value/Credits columns.

Column calibration (this is the part Michalis cares about most):
- All numeric columns have the same width, compact, centred, tabular numerals; the width is chosen once so the widest value (including the "#n" rank and the sub-line where present) fits, and the four tables use the same width unless a column provably needs more. Columns must read as one tidy, homogeneous block.
- No big empty gaps because of long names: the first column has a fixed sensible width (derive it from the longest name in the data, then cap it), names that do not fit are cut with an ellipsis and the full name is in the `title`. Team logos/roles never push the numeric columns apart.
- Zone columns under 1 attempt per 100 show a dimmed "-" and sort last, as in the plan.
- Do not restyle fonts, colours or borders beyond what the plan states for tables.

Gates: tests green (add tests for column order, equal numeric widths via the layout file, default sort and rank pool); screenshots of all four tables at 1440 px and 390 px (horizontal scroll with sticky first column on narrow); a scan that checks, for every table, that numeric columns have equal rendered width, no cell overflows, and the first column is no wider than its cap, at both widths; no style or geometry differences outside the tables. If every gate passes, open the PR with before/after images, squash-merge, confirm the Pages deploy and open the live Players and Teams tables. If a gate fails, fix it; if it cannot be fixed, leave the PR open and report exactly why.

## When everything is done
Report in Greek: what is live (with the URLs checked), the decisions you took on your own, what you removed, and any open item. Also list which parts of `docs/ui-redesign-plan.md` are now out of date so the document can be updated.
