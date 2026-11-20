/* Markup of the Fantasy tables page: heading, toolbar, table with rank chips and evaluation colours, footer notes. Takes the model of table-data.js. */
import * as Windows from '../../core/windows.js';
import * as TM from '../../core/table-model.js';
import { esc } from '../../core/html.js';
import { fmt } from '../../core/format.js';
import { teamCode, teamEntry } from '../../core/teams.js';
import { teamTitleLines } from '../../core/team-city.js';
import CITIES from '../../config/team-cities.json' with { type: 'json' };
import { Data } from '../../core/data.js';
import { drawParts } from '../../core/arrangement.js';
import { available as chartsAvailable } from '../gallery/charts.js';
import { tableToolbarHtml } from './table-toolbar.js';
import { drawerHtml } from './table-filters.js';
import { playerNameCellHtml } from './table-name-cell.js';

export function tableHtml(state, { view, TL, T, tname, cols, model, few, roster, shown: rowsShown, firstW, sel, cur, byValue, pool, range, avg, gallery, byId }) {
  const teams = state.entity === 'teams', title = teams ? 'Teams' : 'Players', hasCharts = chartsAvailable(state.entity, state.view);
  const totalW = TM.tableWidth(TL, tname, firstW);
  const sortedCols = new Set(byValue ? [] : sel.length ? sel : [cur.metric]);   // Sort by value: no column is the sorted one
  const cls = c => 'fw-n' + (sortedCols.has(c.metric) ? ' fw-sorted' : '');
  const header = cols.map(c => {
    const m = byId[c.metric], on = !byValue && cur.metric === c.metric && !sel.length;
    return `<th class="${cls(c)}" aria-sort="${on ? (cur.dir === 'asc' ? 'ascending' : 'descending') : 'none'}"><button data-sort="${c.metric}" ${sel.includes(c.metric) ? 'data-sel' : ''} title="${esc(m.label + ': ' + m.description)}">${esc(c.label)}</button></th>`;
  }).join('');
  const tint = (c, value, rankInfo) => {
    if (!Number.isFinite(value)) return '';
    if (c.colour === 'zone') { const lg = view.league(c.metric)?.value; if (!Number.isFinite(lg)) return ''; const d = value - lg; return Math.abs(d) <= TL.zoneNeutralPp ? '' : (d > 0 ? ' good' : ' bad'); }
    if (c.colour === 'rank') { const qt = TM.quarter(rankInfo); if (!qt) return ''; const good = teams ? qt === 'bottom' : qt === 'top'; return good ? ' good' : ' bad'; }   // teams: green = favourable for the opposing player
    return '';
  };
  const cells = (key, avgRow) => cols.map(c => {
    const { m, list } = model.get(c.metric), cell = avgRow ? avg[c.metric] : view.get(key, c.metric), isFew = !avgRow && few(c, key);
    const ranked = !avgRow && pool.has(key), r = ranked && !isFew ? TM.rankOf(list, cell.value, m.direction) : null;   // only the rank pool has ranks; a player listed through the below-thresholds switch gets a dash
    const v = isFew ? '<span class="fw-v fw-few">-</span>' : `<span class="fw-v${avgRow ? '' : tint(c, cell.value, r)}">${fmt(cell, m)}</span>`;
    return `<td class="${cls(c)}"><span class="fw-cell" ${avgRow ? '' : `data-id="${esc(key)}" data-metric="${c.metric}" ${c.chart ? 'data-chart ' : ''}tabindex="0"`}>${v}${r ? `<i class="fw-rk">#${r.position}</i>` : !avgRow && !isFew && !ranked ? '<i class="fw-rk fw-rk-none">-</i>' : ''}</span></td>`;
  }).join('');
  /* The name cell. Players: position badge, name over team code, CR and Value (table-name-cell.js). Teams: the name alone (fantasy.stat-table.name-cell). */
  const nameCell = r => (teams
    ? (lines => `<div class="fw-namecell">${drawParts('fantasy.stat-table.name-cell', {
      'name': () => `<button class="fw-name" data-open="${esc(r.id)}" title="${esc(r.full)}"><span data-part="fantasy.stat-table.name-cell-team-name">${esc(lines.city ? lines.club : r.name)}</span></button>`,
      'name-cell-city': () => (lines.city ? `<small data-part="fantasy.stat-table.name-cell-city">${esc(lines.city)}</small>` : ''),   // no approved city: no second line
    }, { players: false, teams: true, 'when-data': false }).map(p => p.html).join('')}</div>`)(teamTitleLines(r.full, CITIES.cities[teamEntry(roster, r.id)?.id]))
    : playerNameCellHtml(r, roster, Data.fantasyInfo(r.id, state.win)));
  const rowsHtml = rowsShown.map(r => `<tr><th>${nameCell(r)}</th>${cells(r.id, false)}</tr>`);
  const averageHtml = `<tr class="fw-average"><th title="full league${teams ? '' : ' · all players who played'} · ignores filters">League average</th>${cells(null, true)}</tr>`;
  /* League average takes part in the order of the active stat and direction (at the end for a combined rank); without a value for that stat it is not drawn. */
  let averageAt = rowsHtml.length;
  if (!sel.length && !byValue) {
    const avgValue = avg[cur.metric]?.value;
    if (!Number.isFinite(avgValue)) averageAt = -1;
    else { const at = rowsShown.findIndex(r => { const v = view.get(r.id, cur.metric).value; return !Number.isFinite(v) || (cur.dir === 'asc' ? v > avgValue : v < avgValue); }); averageAt = at < 0 ? rowsHtml.length : at; }
  }
  const body = averageAt < 0 ? rowsHtml.join('') : [...rowsHtml.slice(0, averageAt), averageHtml, ...rowsHtml.slice(averageAt)].join('');
  const filters = !teams && state.filters ? drawerHtml(state, { range, roster }) : '';   // docked to the right edge of the table area (table-filters.js)
  const info = sel.length ? `<div class="fw-tinfo">Combined rank: ${esc(sel.map(id => cols.find(c => c.metric === id).label).join(' + '))} (mean percentile). Click a header to clear.</div>` : '';
  /* The toolbar (two rows, Players and Teams): its parts, order and visibility come from config/arrangement.json (fantasy.stat-table.players-view-row, .players-toolbar); see table-toolbar.js. */
  const show = { players: !teams, teams, teamCount: Object.keys(roster.teams).length, 'charts-available': hasCharts };
  const bars = tableToolbarHtml(state, show, `<h1 data-part="fantasy.stat-table.heading-title">${title}</h1>`);
  const tableMarkup = `<table class="fw-t" style="--table-total:${totalW}px"><colgroup><col style="width:${firstW}px">${cols.map(() => '<col>').join('')}</colgroup><thead><tr><th>${teams ? 'Team' : 'Player'}</th>${header}</tr></thead>
      <tbody>${body}</tbody></table>`;
  return `<section class="fantasy-stats fw-workbench">
    ${bars}
    ${gallery ? '' : info}<div class="fw-tooltip" role="tooltip" hidden></div><div class="sz-pop fw-pop" role="status" hidden></div><div class="fw-table-area" data-drawer="${!!filters}">${filters}${gallery}<div class="fw-table-wrap" ${gallery ? 'hidden' : ''}>${rowsShown.length ? tableMarkup : `<p class="fw-empty" role="status">No matching ${teams ? 'teams' : 'players'}</p>`}</div></div>
    <div class="fw-foot" ${gallery ? 'hidden' : ''}><span>${rowsShown.length} ${teams ? 'teams' : 'players'} · ${esc(Windows.label(state))}</span>${teams
      ? '<span>#n = rank among the teams (1 = best defence: lowest value, highest for Opp TOV and DREB%; Pace: highest = #1). Text colour: best and worst quarter; green = favourable for the opposing player, red = unfavourable.</span>'
      : '<span>#n = rank among the eligible players of the selected position and window; filters do not change it. Players who missed the last 3 games of their team, or who are below the thresholds of the selected window, are hidden unless you switch on "Include players below the minimum thresholds" in Filters; they are listed with a dash instead of a rank. Zone FG% is coloured against the league average (±3 points is neutral); "-" = under 1 attempt per 100 possessions.</span>'}</div>
    <details class="fw-method"><summary>Sample &amp; calculations</summary><p>Last 3 / 5 / 10 are the team's most recent games, counting only the games the player actually played. Every ratio is a sum divided by a sum, never an average of game percentages. PIR has no Fantasy bonuses. USG%, TOV% and every "per 100" value use possessions counted from the play-by-play while the player is on court.</p></details>
  </section>`;
}

/** Shown instead of the page when the data cannot be loaded. */
export const errorHtml = (state, message) => `<section class="fantasy-stats fw-workbench"><div class="fw-heading"><div><div class="eyebrow">FANTASY</div><h1>${state.entity === 'teams' ? 'Teams' : 'Players'}</h1></div></div><p class="fw-empty" role="status">Could not load the data: ${esc(message)}</p></section>`;

export const loadingHtml = '<section class="fantasy-stats fw-workbench fw-loading"><p class="fw-empty" role="status">Loading data…</p></section>';
