/* Shot chart data: counts per zone, grading against the league, ranks, from the shots of a team (site/data/shots/<TEAM>.json) and the
   engine copy of the registry. No markup here. Players: the player's own shots. Teams: the opponents' shots against the team (the team's defence). */
import { Data } from '../../core/data.js';
import { ShotZones as SZ } from './shot-zones.js';

/* counts of a list of shot events per zone */
function count(events, zones) {
  const z = zones.map(() => ({ a: 0, m: 0, as: 0, un: 0, uk: 0 })), idx = Object.fromEntries(zones.map((q, i) => [q.key, i]));
  for (const e of events) {
    const c = z[idx[e.zone]]; if (!c) continue;
    c.a++;
    if (e.made) { c.m++; if (e.assisted === 1) c.as++; else if (e.assisted === 0) c.un++; else c.uk++; }
  }
  return z;
}
const rowOf = (zones, counts, pre) => ({ played: 1, ...Object.fromEntries(zones.flatMap((q, i) => [[`${pre}z_${q.key}_a`, counts[i].a], [`${pre}z_${q.key}_m`, counts[i].m]])) });

/** Prepare everything the chart needs. `ctx` = { kind: 'players'|'teams', id, team, spec, view (window view of the entity kind), teamsView (window view of teams) } */
export async function prepare(ctx) {
  const eng = await Data.engine(), { ZONES } = eng.zones;
  const [rows, set, all] = await Promise.all([Data.shots(ctx.team), Data.windowGames(ctx.team, ctx.spec), Data.windowGames(ctx.team, {})]);
  const mine = e => ctx.kind === 'players' ? e.team === ctx.team && e.player_id === ctx.id : e.team !== ctx.team;
  const events = rows.filter(e => mine(e) && set.has(e.game)), season = rows.filter(e => mine(e) && all.has(e.game));
  const pre = ctx.kind === 'players' ? '' : 'o_', metric = k => eng.byId(pre + k + '_pct');
  const counts = count(events, ZONES), row = rowOf(ZONES, counts, pre), seasonRow = rowOf(ZONES, count(season, ZONES), pre);
  const fg = (r, k) => eng.evaluate(metric(k), [r]).value;
  const share = (n, of) => of > 0 ? eng.evaluate(eng.byId('share'), [{ n, of }]).value : null;
  const league = k => ctx.view.league(pre + k + '_pct').value;
  const total = counts.reduce((n, c) => n + c.a, 0);
  const level = (k, c) => { const p0 = league(k); return p0 === null ? null : SZ.grade({ made: p0 * 1e4, attempts: 1e6 }, c.m, c.a); };   // p0 is a percentage: made/attempts = p0 / 100
  const rank = k => {                                                   // teams only: #1 = lowest opponent FG%
    const mine = ctx.teamsView.get(ctx.id, pre + k + '_pct').value;
    if (!Number.isFinite(mine)) return null;
    const list = ctx.teamsView.keys.map(t => ctx.teamsView.get(t, pre + k + '_pct').value).filter(Number.isFinite);
    return { rank: 1 + list.filter(v => v < mine - 1e-9).length, n: list.length };
  };
  const cmp = ctx.spec && Object.keys(ctx.spec).length > 0;
  const zones = ZONES.map((q, i) => {
    const zk = 'z_' + q.key, c = counts[i], lv = c.a ? level(zk, c) : null, f = c.a ? fg(row, zk) : null;
    return { i, key: q.key, name: q.name, ...c, fg: f, lg: league(zk), gap: lv ? lv.gap : null, level: lv ? lv.level : null, share: share(c.a, total),
      rank: ctx.kind === 'teams' && c.a ? rank(zk) : null, season: cmp && seasonRow[`${pre}z_${q.key}_a`] ? fg(seasonRow, zk) : null };
  });
  const gp = ctx.view.get(ctx.id, ctx.kind === 'players' ? 'gp' : 'pace') && (ctx.kind === 'players' ? ctx.view.get(ctx.id, 'gp').value : ctx.view.row(ctx.id).games);
  return { ctx, eng, zones, events, total, share, gp, cmp };
}
