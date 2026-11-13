/* Markup of the Betting statistics page: team table (offense / defense, ranks and L3 ranks), player table (three views, filters), the notes. */
import * as Windows from '../core/windows.js';
import { esc } from '../core/html.js';
import { state } from './table-state.js';
import { tone } from './table-data.js';
import { PLAYER_VIEWS, POSITIONS } from './columns.js';

const fmt = (c, m) => !Number.isFinite(c?.value) ? '—' : c.value.toFixed(m.format.digits) + m.format.suffix;
const coverage = c => c && c.used !== null && c.used < c.of ? `<small class="miss" title="${c.used} of ${c.of} games had the data">${c.used}/${c.of}</small>` : '';
const sign = (v, d = 1) => !Number.isFinite(v) ? '—' : (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(d);

function teamCells(m, r) {
  const { defs, view, rk, rk3 } = m;
  return defs.map((d, i) => {
    const c = r.avg ? view.league(d.id) : view.get(r.id, d.id);
    let rank = '';
    if (!r.avg) {
      const p = rk[d.id][r.id], t = tone(d.direction, p, rk[d.id].n);
      let extra = '';
      if (rk3) {
        const p3 = rk3[d.id][r.id];
        if (p3) { const delta = p - p3, arrow = Math.abs(delta) >= 5 ? (delta > 0 ? '↑' : '↓') : ''; extra = `<span class="rk3 ${arrow && d.direction !== 0 ? (delta > 0 ? 'up' : 'down') : ''}">L3 ${p3}${d.direction === 0 ? '' : arrow}</span>`; }
      }
      rank = p ? `<span class="rk-line"><span class="rk ${t}">#${p}</span>${extra}</span>` : '';
    }
    return `<td class="${i === m.col ? 'sorted-column' : ''}"><button class="stat-cell" data-id="${r.avg ? '' : r.id}" data-metric="${d.id}" aria-label="${esc((r.avg ? 'League average' : r.name) + ' · ' + d.label + ': ' + fmt(c, d))}"><span class="v">${fmt(c, d)}</span>${coverage(c)}${rank}</button></td>`;
  }).join('');
}

function teamPage(m) {
  const off = state.side === 'offense';
  const head = m.defs.map((d, i) => `<th scope="col" aria-sort="${i === m.col ? (state.dir === 1 ? 'ascending' : 'descending') : 'none'}"><button data-sort="${i}" title="${esc(d.description)}">${esc(d.label)}<span class="sort-arrow">${i === m.col ? (state.dir === 1 ? '↑' : '↓') : '↕'}</span></button></th>`).join('');
  const body = m.rows.map(r => `<tr class="${r.avg ? 'league-average' : ''}"><th scope="row"><span class="club-mark">${r.avg ? '—' : esc(r.name.slice(0, 2).toUpperCase())}</span>${esc(r.name)}${r.avg ? `<small>Full league · all ${m.nTeams} teams, summed</small>` : ''}</th><td class="gp">${r.avg ? '—' : m.lastN && r.games < m.lastN ? r.games + '/' + m.lastN : r.games}</td>${teamCells(m, r)}</tr>`).join('');
  return `<div class="stats-toolbar"><div class="side-switch" role="group" aria-label="Side of the game"><button data-side="offense" aria-pressed="${off}">Offense</button><button data-side="defense" aria-pressed="${!off}">Defense</button></div>
    <div class="period-switch" role="group" aria-label="Sample window">${Windows.buttons(state)}</div>
    <label class="team-search"><span class="sr-only">Search team</span><input id="team-search" type="search" placeholder="Search team…" value="${esc(state.query)}"></label></div>
    <div class="stats-caption"><span>${off ? 'What the team produces' : 'What it allows the opponent'}</span><span class="rank-legend"><span class="rk good">#1–5</span> best <span class="rk bad">#${m.nTeams - 4}–${m.nTeams}</span> worst${m.rk3 ? ' · L3 = rank over the last 3 games' : ''} · Hover or tap a value for details</span></div>
    <div class="stats-scroll" tabindex="0" aria-label="Team table, scrolls horizontally"><table class="teams-table ranked"><caption class="sr-only">${off ? 'Offensive' : 'Defensive'} team statistics, ranks and league average</caption>
      <thead><tr><th scope="col" class="club-head">Team</th><th scope="col">GP</th>${head}</tr></thead><tbody>${body}</tbody></table></div>
    ${m.rows.length === 1 ? '<p class="empty">No team found. The league average still covers the whole league.</p>' : ''}
    <div class="stats-foot"><span><i></i> The league average is sorted together with the teams by the selected column.</span><span>${m.rows.length - 1} / ${m.nTeams} teams</span></div>
    <details class="stats-method"><summary>Sample &amp; calculations</summary>${method(true)}</details>`;
}

function playerPage(m) {
  const pl = state.pl;
  const head = m.defs.map(d => `<th scope="col" aria-sort="${d.id === m.col ? (pl.dir === 1 ? 'ascending' : 'descending') : 'none'}"><button data-pl-sort="${d.id}" title="${esc(d.description)}">${esc(d.label)}<span class="sort-arrow">${d.id === m.col ? (pl.dir === 1 ? '↑' : '↓') : '↕'}</span></button></th>`).join('');
  const cell = (r, d) => {
    if (d.id === 'trend') {
      const t = r.trend, c = x => Math.abs(x) >= 4 ? (x > 0 ? 'up' : 'down') : '';
      if (!t) return '<span class="muted">—</span>';
      if (t.none) return '<small class="miss">did not play in the last 3 team games</small>';
      return `<span class="trend ${c(t.min)}">${sign(t.min)}′</span><small class="trend ${Number.isFinite(t.usg) ? c(t.usg) : ''}">USG ${sign(t.usg)}</small>`;
    }
    const c = m.pv.get(r.id, d.id);
    if (d.id === 'gp') return String(r.gp) + (r.teamGames && r.teamGames !== r.gp && state.win !== 'season' ? '/' + r.teamGames : '');
    return fmt(c, d) + coverage(c);
  };
  const body = m.rows.map(r => `<tr><th scope="row"><span class="player-name">${esc(r.name)}</span><small>${esc(m.teams[r.team] || r.team)} · ${esc(POSITIONS[r.pos] || '—')}</small></th>${m.defs.map(d => `<td class="${d.id === m.col ? 'sorted-column' : ''}">${cell(r, d)}</td>`).join('')}</tr>`).join('');
  const teams = Object.entries(m.teams).sort((a, b) => a[1].localeCompare(b[1]));
  return `<div class="stats-toolbar pl-toolbar"><div class="side-switch" role="group" aria-label="View">${Object.entries(PLAYER_VIEWS).map(([k, [t]]) => `<button data-pl-view="${k}" aria-pressed="${pl.view === k}">${t}</button>`).join('')}</div>
    <div class="period-switch" role="group" aria-label="Sample window">${Windows.buttons(state)}</div></div>
    <div class="stats-toolbar pl-filters"><label>Team<select id="pl-team"><option value="">All</option>${teams.map(([c, n]) => `<option value="${c}" ${pl.team === c ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>
      <label>Position<select id="pl-pos"><option value="">All</option>${Object.entries(POSITIONS).map(([k, n]) => `<option value="${k}" ${pl.pos === k ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      <label>Minutes / game<select id="pl-min">${[0, 5, 10, 15, 20, 25].map(v => `<option value="${v}" ${pl.min === v ? 'selected' : ''}>${v ? '≥ ' + v : 'All'}</option>`).join('')}</select></label>
      <label class="team-search"><span class="sr-only">Search player</span><input id="pl-search" type="search" placeholder="Search player…" value="${esc(pl.query)}"></label></div>
    <div class="stats-scroll" tabindex="0" aria-label="Player table, scrolls horizontally"><table class="teams-table"><caption class="sr-only">Player statistics</caption>
      <thead><tr><th scope="col" class="club-head">Player</th>${head}</tr></thead><tbody>${body}</tbody></table></div>
    ${m.rows.length ? '' : '<p class="empty">No players match the filters.</p>'}
    <div class="stats-foot"><span>${m.rows.length} / ${m.total} players · ${esc(Windows.label(state))}</span><span>n/m = games with the data out of games played</span></div>
    <details class="stats-method"><summary>Sample &amp; calculations</summary>${method(false)}</details>`;
}

const method = teams => `<p>Source: official EuroLeague box scores and play-by-play, processed by a scheduled job; the page only reads ready files. Last 3 / 5 / 10 are each team's most recent games${teams ? '' : ', counting only the games the player played'}. Every ratio is a sum divided by a sum, never an average of game percentages.</p>
  <p>Possessions are counted from the play-by-play: a new possession starts each time the ball changes team (shot, free throws, turnover, defensive rebound, steal) and at the start of each period; technical free throws do not change possession. If a game has no usable play-by-play, the Oliver estimate is used.</p>
  ${teams ? '<p>Rank: #1 is the best team in the league for that side. On offense #1 produces the most (or loses the fewest balls); on defense #1 allows the least. Green: best 5, red: worst 5. Pace and offensive 3PA/FGA are style, ranked from the highest and without colour. The L3 rank next to the season rank is the rank over the last 3 games; the arrow marks a change of 5 places or more. Shooting and rebound rates describe the sample; they are not adjusted for opponent strength.</p>' : '<p>USG%, TOV% and every "per 100" value use possessions counted while the player is on court. AST% = assists / (team field goals made while on court − his own). BLK% = blocks / opponent two-point attempts while on court. Rebound shares count all rebounds available, including team rebounds.</p>'}`;

/* ---------- page ---------- */
export function page(m, status, roster) {
  const teams = state.entity === 'teams';
  return `<section class="bet-stats"><div class="stats-heading"><div><div class="eyebrow">BETTING / STATISTICS</div><h1>${teams ? "Every team's profile." : "Every player's profile."}</h1><p>${teams ? "Compare each team's game with the competition average." : 'Role, minutes and pace over the season and the latest games.'}</p></div><span class="pill">${esc(Windows.label(state).toUpperCase())}</span></div>
    <p class="live-status" data-live="live" role="status"><span>${esc(status)}</span></p>
    <div class="entity-switch" role="group" aria-label="Statistics category"><button data-entity="teams" aria-pressed="${teams}">Teams <span>${Object.keys(roster.teams).length}</span></button><button data-entity="players" aria-pressed="${!teams}">Players <span>${Object.keys(roster.players).length}</span></button></div>
    ${teams ? teamPage(m) : playerPage(m)}<div id="stats-tooltip" class="stats-tooltip" role="tooltip" hidden></div></section>`;
}
