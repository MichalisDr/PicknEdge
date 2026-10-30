# Player game logs

The GAME LOG tab is separate from the season aggregate profile. The initial dataset contains 89 rows across 15 players. R1–6 public game-log rows use rounded minutes and are labeled PIRScout; user-supplied 3StepsBasket screenshots provide Key and Malcolm histories plus selected R7 game totals, explicit per-100 rates and fantasy scores. Do not reconcile rounded minutes as exact seconds or substitute fantasy points for PIR.

`game-logs.json` is the auditable seed snapshot embedded in the player closure in `dashboard-fragment.html` and the standalone `dist/index.html`. Keep those embedded copies synchronized when updating the seed. `player-panel.html` contains the same game-log implementation for future authoring. Season aggregate datasets were updated using the supplied Round 7 exports. Shooting-location datasets and these partial game logs retain their previous coverage.

Coverage is deliberately partial. Missing rows are unknown, not DNPs. Missing values display as an em dash. Per-100 values are shown only when supplied explicitly in `per100`; mixed offensive/defensive possession totals are not used to infer them. Minutes, PIR and fantasy points retain their actual-game basis in both views.

The minutes comparison requires six consecutive recorded rounds and compares the most recent two with the preceding four. It describes opportunity and is not a forecast or an injury/rotation diagnosis.

## Import

Use the in-page import template and import/export controls. A JSON object must contain `season: "2026/27"` and a nonempty `rows` array. Each row requires a dashboard `playerId`, integer `round` and `opponent`; numeric actual-game fields may be null. Supported fields: `minutes`, `points`, `rebounds`, `assists`, `steals`, `blocks`, `turnovers`, `foulsDrawn`, `foulsCommitted`, `pir`, `fantasy`, `source`; an optional `per100` object contains explicitly supplied rates for counting stats. Round must be 1–50; unknown players, duplicate player/round keys and invalid numeric values are rejected atomically.

Imported rows replace matching player/round records in saved dashboard state. They do not modify season aggregates or update the shared seed for other browsers. Export a portable backup; imported text is escaped before rendering.
