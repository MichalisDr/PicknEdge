/* Markup of the Fantasy tables page: heading, toolbar, table with rank chips and evaluation colours, footer notes. Takes the model of table-data.js. */
import * as Windows from '../../core/windows.js';
import * as TM from '../../core/table-model.js';
import { esc } from '../../core/html.js';
import { fmt } from '../../core/format.js';
import { teamCode } from '../../core/teams.js';
import { available as chartsAvailable } from '../gallery/charts.js';

export function tableHtml(state, { view, TL, T, tname, cols, model, few, roster, status, shown: rowsShown, firstW, sel, cur, avg, gallery, byId }) {
  const teams = state.entity === 'teams', title = teams ? 'Teams' : 'Players', hasCharts = chartsAvailable(state.entity, state.view);
  const totalW = TM.tableWidth(TL, tname, firstW);
  const sortedCols = new Set(sel.length ? sel : [cur.metric]);
  const cls = c => 'fw-n' + (sortedCols.has(c.metric) ? ' fw-sorted' : '');
  const header = cols.map(c => {
    const m = byId[c.metric], on = cur.metric === c.metric && !sel.length;
    return `<th class="${cls(c)}" aria-sort="${on ? (cur.dir === 'asc' ? 'ascending' : 'descending') : 'none'}"><button data-sort="${c.metric}" ${sel.includes(c.metric) ? 'data-sel' : ''} title="${esc(m.label + ': ' + m.description)}">${esc(c.label)}</button></th>`;
  }).join('');
  const tint = (c, value, rankInfo) => {
    if (!Number.isFinite(value)) return '';
    if (c.colour === 'zone') { const lg = view.league(c.metric)?.value; if (!Number.isFinite(lg)) return ''; const d = value - lg; return Math.abs(d) <= TL.zoneNeutralPp ? '' : 'color:var(--eval-' + (d > 0 ? 'good' : 'bad') + '-text)'; }
    if (c.colour === 'rank') { const qt = TM.quarter(rankInfo); if (!qt) return ''; const good = teams ? qt === 'bottom' : qt === 'top'; return 'color:var(--eval-' + (good ? 'good' : 'bad') + '-text)'; }   // teams: green = favourable for the opposing player
    return '';
  };
  const cells = (key, avgRow) => cols.map(c => {
    const { m, list } = model.get(c.metric), cell = avgRow ? avg[c.metric] : view.get(key, c.metric), isFew = !avgRow && few(c, key);
    const r = !avgRow && !isFew ? TM.rankOf(list, cell.value, m.direction) : null;
    const v = isFew ? '<span class="fw-v fw-few">-</span>' : `<span class="fw-v" style="${avgRow ? '' : tint(c, cell.value, r)}">${fmt(cell, m)}</span>`;
    return `<td class="${cls(c)}"><span class="fw-cell" ${avgRow ? '' : `data-id="${esc(key)}" data-metric="${c.metric}" ${c.chart ? 'data-chart ' : ''}tabindex="0"`}>${v}${r ? `<i class="fw-rk">#${r.position}</i>` : ''}</span></td>`;
  }).join('');
  const body = rowsShown.map(r => `<tr><th><button class="fw-name" data-open="${esc(r.id)}" title="${esc(r.full)}">${esc(r.name)}</button>${teams ? '' : `<small class="fw-who" title="${esc(roster.teams[r.team] || r.team)}">${esc([teamCode(roster, r.team), r.pos].filter(Boolean).join(' · '))}</small>`}</th>${cells(r.id, false)}</tr>`).join('');
  const filters = !teams && state.filters ? `<div class="fw-filters" role="dialog" aria-label="Filters">
    <label>Team<select data-filter="team"><option value="">All</option>${Object.entries(roster.teams).sort((a, b) => a[1].localeCompare(b[1])).map(([c, n]) => `<option value="${c}" ${c === state.team ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>
    <label>MIN ≥<input data-filter="minMin" type="number" min="0" value="${state.minMin}"></label>
    <label>GP ≥<input data-filter="minGp" type="number" min="0" value="${state.minGp}"></label>
    <label class="fw-check"><input data-filter="showAll" type="checkbox" ${state.showAll ? 'checked' : ''}> Show players below the form thresholds</label></div>` : '';
  const info = sel.length ? `<div class="fw-tinfo">Combined rank: ${esc(sel.map(id => cols.find(c => c.metric === id).label).join(' + '))} (mean percentile). Click a header to clear.</div>` : '';
  return `<section class="fantasy-stats fw-workbench">
    <div class="fw-heading"><div><div class="eyebrow">FANTASY / ${teams ? 'TEAMS' : 'PLAYERS'}</div><h1>${title}</h1></div><span role="status">${esc(status)}</span></div>
    <div class="fw-periods"><div class="fw-switch" role="group" aria-label="Sample window">${Windows.buttons(state)}</div></div>
    <div class="fw-toolbar">
      <div class="fw-switch" role="group" aria-label="Table view"><button data-view-toggle aria-pressed="${state.view === 'shooting'}">Shooting</button></div>
      ${teams ? '' : `<div class="fw-switch" aria-label="Player position">${['ALL', 'G', 'F', 'C'].map(v => `<button data-position="${v}" aria-pressed="${v === state.position}">${v === 'ALL' ? 'All' : v}</button>`).join('')}</div>`}
      <div class="fw-right">${hasCharts ? `<div class="fw-switch" role="tablist">${['table', 'charts'].map(v => `<button data-fwmode="${v}" role="tab" aria-selected="${state.mode === v}">${v === 'table' ? 'Table' : 'Charts'}</button>`).join('')}</div>` : ''}${teams ? '' : `<button class="fw-filter-btn" data-filters aria-expanded="${state.filters}">Filters</button>`}<input type="search" aria-label="Search Fantasy" placeholder="Search…" value="${esc(state.query)}"></div>
      ${filters}
    </div>
    ${gallery ? '' : info}${gallery}<div class="fw-tooltip" role="tooltip" hidden></div><div class="sz-pop fw-pop" role="status" hidden></div><div class="fw-table-wrap" ${gallery ? 'hidden' : ''}><table class="fw-t" style="min-width:${totalW}px"><colgroup><col style="width:${firstW}px">${cols.map(() => '<col>').join('')}</colgroup><thead><tr><th>${teams ? 'Team' : 'Player'}</th>${header}</tr></thead>
      <tbody>${body}<tr class="fw-average"><th title="full league${teams ? '' : ' · all players who played'} · ignores filters">League average</th>${cells(null, true)}</tr></tbody></table></div>
    <div class="fw-foot" ${gallery ? 'hidden' : ''}><span>${rowsShown.length} ${teams ? 'teams' : 'players'} · ${esc(Windows.label(state))}</span>${teams
      ? '<span>#n = rank among the teams (1 = best defence: lowest value, highest for Opp TOV and DREB%; Pace: highest = #1). Text colour: best and worst quarter; green = favourable for the opposing player, red = unfavourable.</span>'
      : '<span>#n = rank among the players shown. Players who missed the last 3 games of their team, or who are below the thresholds of the selected window, are hidden unless you tick the box in Filters. Zone FG% is coloured against the league average (±3 points is neutral); "-" = under 1 attempt per 100 possessions.</span>'}</div>
    <details class="fw-method"><summary>Sample &amp; calculations</summary><p>Last 3 / 5 / 10 are the team's most recent games, counting only the games the player actually played. Every ratio is a sum divided by a sum, never an average of game percentages. PIR has no Fantasy bonuses. USG%, TOV% and every "per 100" value use possessions counted from the play-by-play while the player is on court.</p></details>
  </section>`;
}

/** Shown instead of the page when the data cannot be loaded. */
export const errorHtml = (state, message) => `<section class="fantasy-stats fw-workbench"><div class="fw-heading"><div><div class="eyebrow">FANTASY</div><h1>${state.entity === 'teams' ? 'Teams' : 'Players'}</h1></div></div><p class="fw-empty" role="status">Could not load the data: ${esc(message)}</p></section>`;

export const loadingHtml = '<section class="fantasy-stats fw-workbench fw-loading"><p class="fw-empty" role="status">Loading data…</p></section>';
