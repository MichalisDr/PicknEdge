/* Card data: per-game rows of a player or team, league bands and rolling series from the engine copy of the registry (the registry's own
   definitions), and the team rank of a metric. No markup here. */
import { Data } from '../../core/data.js';
import { teamCode } from '../../core/teams.js';

const EPS = 1e-9;
const EVAL = { good: '#DFFBE9', avg: '#FBFFDF', bad: '#F6E0E3', neutral: '#bdc7d5' };   // good / average / bad evaluation palette of the team tiles
/* Team rank (#1 = best defence) and colour (green = favourable for the opposing player) from the metric's direction. */
export function teamRank(view, id, value, direction) {
  const list = view.keys.map(k => view.get(k, id).value).filter(Number.isFinite);
  if (!Number.isFinite(value) || !list.length) return null;
  const q = v => (direction === 0 ? v : direction * v);                 // higher = better for the team (pace: higher = #1)
  const position = 1 + list.filter(v => q(v) > q(value) + EPS).length;
  if (direction === 0) return { position, color: EVAL.neutral };
  const worst = 1 + list.filter(v => q(v) < q(value) - EPS).length;      // 1 = worst defence = best for the opposing player
  const n = list.length;
  return { position, color: worst <= Math.ceil(n / 3) ? EVAL.good : worst > Math.ceil(n * 2 / 3) ? EVAL.bad : EVAL.avg };
}

const order = (a, b) => a.date_utc.localeCompare(b.date_utc) || a.game - b.game;

/* ---------- per-game data (engine) ---------- */
const leagueCache = new Map();
export async function rowsOf(entity, id) {
  const eng = await Data.engine();
  if (entity === 'players') return (await Data.games('players')).filter(r => r.player_id === id).sort(order);
  return eng.withOpponent(await Data.games('teams')).filter(r => r.team === id).sort(order);
}
export async function leagueBand(entity, def) {
  const key = entity + def.id;
  if (!leagueCache.has(key)) leagueCache.set(key, (async () => {
    const eng = await Data.engine(), rows = entity === 'players' ? await Data.games('players') : eng.withOpponent(await Data.games('teams'));
    const v = rows.map(r => eng.evaluate(def, [r]).value).filter(Number.isFinite).sort((a, b) => a - b);
    const q = p => { if (!v.length) return null; const x = (v.length - 1) * p, lo = Math.floor(x), hi = Math.ceil(x); return v[lo] + (v[hi] - v[lo]) * (x - lo); };
    return { n: v.length, p2: q(.02), p25: q(.25), p75: q(.75), p98: q(.98) };
  })());
  return leagueCache.get(key);
}
/** Per-game points of a metric for one entity, with rolling value of the last 5 appearances and window membership. */
export async function series(entity, id, def, spec) {
  const eng = await Data.engine(), rows = await rowsOf(entity, id), roster = await Data.roster();
  const team = rows.at(-1)?.team, set = spec ? await Data.windowGames(team, spec) : null;
  return rows.map((r, i) => {
    const win = i >= 4 ? rows.slice(i - 4, i + 1) : null, roll = win ? eng.evaluate(def, win).value : null;
    return { game: r.game, round: r.round, opponent: teamCode(roster, r.opp), home: r.home, value: eng.evaluate(def, [r]).value, roll: Number.isFinite(roll) ? roll : null, recent: !set || set.has(r.game) };
  });
}