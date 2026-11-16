/* The per-game series of one metric for one player or team: the one module behind the card's bars chart and the table's hover sparkline.
   Slots = the team's games of the season, oldest first (a player's missed games are empty slots). A rolling or window value of N is the metric over the
   entity's games inside the team's last N games, computed from the window's totals (never an average of per-game values), the same way the views compute
   a cell, so the last point of a window equals the table cell of that window. No markup here. */
import { Data } from './data.js';
import * as Windows from './windows.js';
import { teamCode } from './teams.js';

const SEASON_ROLL = 5;   // the rolling length when the table shows the whole Season
const order = (a, b) => a.date_utc.localeCompare(b.date_utc) || a.game - b.game;
const finite = v => (Number.isFinite(v) ? v : null);

/** Rolling length that goes with a table window: Season 5, Last 10 -> 10, Last 5 -> 5, Last 3 -> 3. */
export const rollLength = win => Windows.spec({ win }).last ?? SEASON_ROLL;

/** Pure builder. slots: [{ game, round, opponent, home }] oldest first; rows: the entity's game rows (any order); def: registry metric;
    evaluate: the engine's evaluate. Returns the series with its per-game values, rolling lines and window values. */
export function buildSeries({ slots, rows, def, evaluate }) {
  const byGame = new Map(rows.map(r => [r.game, r]));
  const rowsIn = (from, to) => slots.slice(from, to + 1).map(s => byGame.get(s.game)).filter(Boolean);
  const valueOf = list => (list.length ? finite(evaluate(def, list).value) : null);
  const points = slots.map(s => { const r = byGame.get(s.game); return { ...s, played: !!r, value: r ? valueOf([r]) : null }; });
  const last = slots.length - 1;
  return {
    points,
    /** The metric over the whole season (the season average line). */
    average: valueOf([...byGame.values()]),
    /** One value per slot: the metric over the entity's games within the team's last n games at that slot; null before n games exist or without a game of the entity. */
    rolling: n => slots.map((_, k) => (k < n - 1 ? null : valueOf(rowsIn(k - n + 1, k)))),
    /** The window of the team's last n games: { value, used, of } = the table cell of that window (`used` games of the entity in the window, `of` team games). */
    window: n => { const from = Math.max(0, last - n + 1), list = rowsIn(from, last); return { value: valueOf(list), used: list.length, of: last - from + 1 }; },
    /** Slot indexes inside the team's last n games. */
    inWindow: n => points.filter((_, k) => k > last - n).map(p => p.game),
  };
}

/** The series of metric `metricId` for a player or team of the loaded data. */
export async function loadSeries(entity, id, metricId) {
  const [eng, roster, { byId }, teamGames] = await Promise.all([Data.engine(), Data.roster(), Data.metrics(), Data.games('teams')]);
  const def = eng.byId(metricId), players = entity === 'players';
  const rows = (players ? await Data.games('players') : eng.withOpponent(teamGames)).filter(r => (players ? r.player_id : r.team) === id).sort(order);
  const team = players ? rows.at(-1)?.team : id;
  const slots = teamGames.filter(r => r.team === team).sort(order).map(r => ({ game: r.game, round: r.round, opponent: teamCode(roster, r.opp), home: r.home === 1 }));
  return { metric: byId[metricId], ...buildSeries({ slots, rows, def, evaluate: eng.evaluate }) };
}
