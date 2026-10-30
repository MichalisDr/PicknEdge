# Betting team statistics

The platform's `#data` route is a dedicated Betting Teams view. Fantasy continues to use `dashboard.html` unchanged. Players has an explicit future-work state.

`dist/betting-team-data.js` copies the 20 club aggregate records from `dashboard-fragment.html`'s `clubRaw`. This snapshot has six games per team; it is not a live feed. Do not replace its coverage with the later screenshot's mixed six/seven-game counts. An exact cutoff timestamp is not present in this snapshot.

`dist/betting-stats.js` contains the metric definitions and rendering; `dist/betting-stats.css` contains the layout. The league row is calculated from aggregate numerators and denominators and sorted with team rows. Search never changes its cohort.

Pace is 1200 × (OfPo + DePo) / Sec. ORtg, offensive assists and turnovers use OfPo; defensive rating, opponent assists and opponent turnovers use DePo. This is intentional, unlike the legacy Fantasy table's combined-possession assist denominator. OREB% uses TOR/(TOR+ODR); DREB% uses TDR/(TDR+OOR). All percentages use total makes/attempts or the applicable opportunity denominator, never unweighted mean percentages. Missing/zero denominators show an em dash.

Secondary values use Gm. Pace's secondary is average offensive/defensive possessions per game. eFG shows FGM/FGA per game; shooting percentages show made/attempted per game; volume shares show corresponding attempts per game. Cells support hover, focus, click/tap, and Escape dismissal. Table headings sort ascending/descending. The team-name column and table headers remain sticky within the scroll area.

Validation: all 20 records checked for required numeric fields; synthetic unequal-possession and unequal-game fixtures verify denominators and weighted averages; all 40 side/metric/direction combinations verified. Browser preview verified view switching, search, average placement, per-game detail, and Players return navigation. Phone-size visual QA was not available in the browser controls.
