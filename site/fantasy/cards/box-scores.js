/* Box scores of a player's season on his card, newest game first. */
import { Data } from '../../core/data.js';
import { esc } from '../../core/html.js';
import { teamCode } from '../../core/teams.js';
import { rowsOf } from './card-data.js';

export async function boxScores(cs) {
  const eng = await Data.engine(), rows = (await rowsOf('players', cs.id)).slice().reverse(), roster = await Data.roster();
  if (!rows.length) return '';
  const teams = new Map(eng.withOpponent(await Data.games('teams')).map(t => [t.game + '|' + t.team, t]));
  const v = (r, id) => eng.evaluate(eng.byId(id), [r]).value, d = (r, name) => eng.termValue([[1, name]], r);
  const f = (a, b) => `${a}/${b}`, clock = s => Math.floor(s / 60) + ':' + String(Math.round(s % 60)).padStart(2, '0');
  const body = rows.map(r => {
    const t = teams.get(r.game + '|' + r.team), res = t ? `${t.pts > t.o_pts ? 'W' : 'L'} ${t.pts}–${t.o_pts}` : '—';
    return `<tr><th><b>R${r.round}</b><small>${esc(String(r.date_utc).slice(0, 10))}</small></th><td class="fw-bs-opp">${r.home ? 'vs' : '@'} ${esc(teamCode(roster, r.opp))}</td><td>${res}</td><td>${clock(r.sec)}</td><td><b>${v(r, 'pts_g')}</b></td><td>${f(d(r, 'fgm'), d(r, 'fga'))}</td><td>${f(r.m3, r.a3)}</td><td>${f(r.m1, r.a1)}</td><td title="OR ${r.oreb} · DR ${r.dreb}">${v(r, 'reb_g')}</td><td>${r.ast}</td><td>${r.stl}</td><td>${r.blk}</td><td>${r.tov}</td><td>${r.pf}</td><td><b>${v(r, 'pir')}</b></td></tr>`;
  }).join('');
  return `<section class="fw-with fw-boxscores"><div class="fw-section-title"><h3>Box scores</h3><span>Season · ${rows.length} games</span></div><div class="fw-tbl"><table><thead><tr><th>Game</th><th class="fw-bs-opp">Opponent</th><th>Result</th><th>MIN</th><th>PTS</th><th>FG</th><th>3P</th><th>FT</th><th>REB</th><th>AST</th><th>STL</th><th>BLK</th><th>TOV</th><th>PF</th><th>PIR</th></tr></thead><tbody>${body}</tbody></table></div></section>`;}
