# Pick n Edge: FINAL card layouts (locked 2026-11-10 evening)

Supersedes any older description of the card layouts. Source of truth in code: `site/layout.json` (branch `feature/card-layouts`, PR #7).

## Rules that apply to all four cards
- 24 columns, gap 12 px, fixed row unit per layout (`rowPx`), box = x,y,w,h in cells. Cell counts are incidental; only the arrangement and the size ratios between tiles are locked.
- Tile content has a constant size (large tile value 28 px, small tile value 19 px, strip = one horizontal row). Fit is solved by grid and unit, never by scaling fonts.
- Tile type comes from the box `tier` field when present, otherwise from area: >=36 cells large, <=12 strip, otherwise small.
- Rank shown as small muted "#n". Layout lines (SHOW_LAYOUT_LINES) off. Group outline edges (GROUP_EDGES) built but off, undecided.
- Below 650 px container width the cards become a stacked list (to be raised so that every tile fits, see the finish prompt, part 1.3). Mobile polish is a later job.
- Profile/Shooting: ONE toggle button "Shooting" (card opens in Profile; pressing again returns to Profile).

## Player Profile (24 x 10, rowPx 22)
MIN 0,0,6,4 large | PIR 6,0,11,4 large (sub "/m" under the value; nsPIR small on the right inside the tile, "/100 poss") | PTS/100 17,0,7,4 large (sub "/g") | USG% 0,4,6,3 | Offensive Load 0,7,6,3 (sub Box Creation) | TOV% 6,4,6,3 (sub "/g") | cTOV% 6,7,6,3 (sub TOV/100) | FTr 12,4,5,6 large (no sub, no FT%) | AST/100 17,4,7,2 strip | REB/100 17,6,7,2 strip | FD/100 17,8,7,2 strip (each strip with its "/g" sub).
Stack order: PIR, MIN, USG%, Offensive Load, TOV%, cTOV%, PTS/100, AST/100, REB/100, FTr, FD/100.

## Team Profile (24 x 5, rowPx 50)
Row 1: Pace 0,0,6,2 | DRtg 6,0,12,2 | Opp FTr 18,0,6,2 (all three tier small, stacked style).
Below: Opp eFG% 0,2,6,3 | DREB% 6,2,6,2 + Opp 2nd chance 6,4,6,1 | Opp TOV/100 12,2,6,3 | Opp AST/100 18,2,6,1 | Opp PTS off TO 18,3,6,1 | Opp fast break 18,4,6,1.
Reasoning (agreed): eFG% -> DREB% -> 2nd chance read as a chain (misses, rebounds, second chances); PTS off TO and fast break sit together because their points overlap (do not add them up). Opp TOV = turnovers the opponent commits; PTS off TO = points the opponent scores off the team's own turnovers: different sides, not paired. No Opp PIR, no team fouls.

## Player Shooting (24 x 4)
eFG% 0,0,7,4 | 2FG% 7,0,6,4 | 3FG% 13,0,6,4 | FT% 19,0,5,4, all large. Subs: FGA {v} /100, {v}% of FGA, 3PA text ("no 3PA" at zero). No zone boxes (the shot chart below carries the zones). Chart below at natural size.

## Team Shooting (24 x 4)
Opp eFG% 0,0,8,4 | Opp 2FG% 8,0,8,4 | Opp 3FG% 16,0,8,4, all large. No zone boxes.

## Metric notes
Opp second-chance, fast-break and points-off-turnover categories overlap by definition (never sum them).
