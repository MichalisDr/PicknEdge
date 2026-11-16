/* Card data: per-game rows of a player or team, and the team rank of a metric. No markup here. */
import { Data } from '../../core/data.js';

const EPS = 1e-9;
/* Team rank (#1 = best defence) and tone (good / avg / bad; good = favourable for the opposing player, neutral for style metrics) from the metric's direction. */
export function teamRank(view, id, value, direction) {
  const list = view.keys.map(k => view.get(k, id).value).filter(Number.isFinite);
  if (!Number.isFinite(value) || !list.length) return null;
  const q = v => (direction === 0 ? v : direction * v);                 // higher = better for the team (pace: higher = #1)
  const position = 1 + list.filter(v => q(v) > q(value) + EPS).length;
  if (direction === 0) return { position, tone: 'neutral' };
  const worst = 1 + list.filter(v => q(v) < q(value) - EPS).length;      // 1 = worst defence = best for the opposing player
  const n = list.length;
  return { position, tone: worst <= Math.ceil(n / 3) ? 'good' : worst > Math.ceil(n * 2 / 3) ? 'bad' : 'avg' };
}

const order = (a, b) => a.date_utc.localeCompare(b.date_utc) || a.game - b.game;

/* ---------- per-game data (engine) ---------- */
export async function rowsOf(entity, id) {
  const eng = await Data.engine();
  if (entity === 'players') return (await Data.games('players')).filter(r => r.player_id === id).sort(order);
  return eng.withOpponent(await Data.games('teams')).filter(r => r.team === id).sort(order);
}
