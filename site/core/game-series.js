/* The per-game series of one metric for one player or team: the one module behind the card's bars chart and the table's hover sparkline.
   Slots = the team's games of the season, oldest first (a player's missed games are empty slots). A rolling or window value of N is the metric over the
   entity's games inside the team's last N games, computed from the window's totals (never an average of per-game values), the same way the views compute
   a cell, so the last point of a window equals the table cell of that window. No markup here. */
import { Data } from './data.js';
import { teamCode } from './teams.js';

/** A rolling line whose change from first to last point is smaller than this share (of the larger of the two) is flat. */
export const TREND_FLAT_BELOW = 0.04;
/** Theme token of each tone of the rolling line: good / bad reuse the table's value colours, flat is the chart's own. */
export const TREND_TOKEN = { good: 'fantasy.stat-table.value-good.text', bad: 'fantasy.stat-table.value-bad.text', flat: 'fantasy.player-card.trend-flat.line' };

/** The trend of the rolling line as drawn (nulls ignored): change = (last - first) / max(|first|, |last|), flat below TREND_FLAT_BELOW.
    direction = the metric's direction from metrics.json (+1 higher is better, -1 lower is better, 0 no judgement): up/down become good/bad
    (swapped when lower is better); a metric with no direction has no good or bad, so its line is flat-coloured. */
export function trendOf(rolling, direction) {
  const v = rolling.filter(Number.isFinite);
  if (v.length < 2) return { change: 0, trend: 'flat', tone: 'flat', token: TREND_TOKEN.flat };
  const first = v[0], last = v.at(-1), top = Math.max(Math.abs(first), Math.abs(last)), change = top === 0 ? 0 : (last - first) / top;
  const trend = Math.abs(change) < TREND_FLAT_BELOW ? 'flat' : change > 0 ? 'up' : 'down';
  const tone = trend === 'flat' || !direction ? 'flat' : (trend === 'up') === (direction > 0) ? 'good' : 'bad';
  return { change, trend, tone, token: TREND_TOKEN[tone] };
}

const order = (a, b) => a.date_utc.localeCompare(b.date_utc) || a.game - b.game;
const finite = v => (Number.isFinite(v) ? v : null);

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
    /** Rolling 5 for the charts, drawn over the last 5 rounds only: the rolling-5 value of each of the last 5 slots (null elsewhere and before round 5). */
    recentRolling: () => { const r = slots.map((_, k) => (k < 4 ? null : valueOf(rowsIn(k - 4, k)))); return r.map((v, k) => (k > last - 5 ? v : null)); },
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
