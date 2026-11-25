/* Fantasy · Charts mode: the gallery of comparative charts for the current table, over the same window and filters. Click a point to open the card;
   click a chart to enlarge it (gallery-dialog.js). */
import { Data } from '../../core/data.js';
import * as Windows from '../../core/windows.js';
import * as Elig from '../../core/eligibility.js';
import { esc } from '../../core/html.js';
import { CHARTS } from './charts.js';
import { scatter, sizeKey } from './scatter.js';

/** The views a chart takes its AXES from (all four windows, so the scale never moves with the window). A chart with domain 'listed' reads only the players the table lists by its eligibility rule
    (manifest.eligibility: availability gate and the window's minimum games, minutes and PIR; with "show players below the thresholds" on, everyone). Only the thresholds and that toggle define who is listed:
    position, search and the drawer never reach the axes. The reference line does not use this: it is fitted over the whole pool of the window (scatter.js). */
async function axisViews(chart, views, state) {
  if (chart.domain !== 'listed') return views;
  const rule = (await Data.manifest()).eligibility, avail = rule.availability ? await Data.view('players', rule.availability.window) : null;
  return views.map(v => ({ ...v, keys: v.keys.filter(id => Elig.listed(rule, v.window, { gp: v.get(id, 'gp')?.value, min: v.get(id, 'min')?.value, pir: v.get(id, 'pir')?.value }, avail ? (avail.get(id, 'gp')?.value ?? 0) : null, !!state.showAll)) }));
}

/** html of the gallery for the current view; `ids` = entities to plot (the table's list before search). */
export async function galleryHtml(kind, viewName, state, ids) {
  const [view, { byId }, roster, ...views] = await Promise.all([Windows.view(kind, state), Data.metrics(), Data.roster(), ...Windows.LIST.map(w => Windows.view(kind, state, w[0]))]);   // views = all four windows: the axes use them all
  const charts = CHARTS.filter(c => c.entity === kind && c.view === viewName), axes = await Promise.all(charts.map(c => axisViews(c, views, state)));
  const where = `${kind === 'teams' ? 'Teams' : 'Players'} · ${viewName === 'profile' ? 'Profile' : 'Shooting'} · ${Windows.label(state)}`;
  if (!charts.length) return `<section class="fc-gallery"><div class="fw-section-title"><h3>Comparative charts</h3><span>${esc(where)}</span></div><p class="fw-empty">No comparative charts for this view yet. Open a ${kind === 'teams' ? 'team' : 'player'} card (click a name in the Table) for its trends.</p></section>`;
  return `<section class="fc-gallery" data-entity="${kind}" data-win="${esc(state.win)}" data-view="${esc(state.view)}"><div class="fw-section-title"><h3>Comparative charts</h3><span>${esc(where)} · ${charts.length} ${charts.length === 1 ? 'chart' : 'charts'}</span></div><div class="fc-grid-gallery">${charts.map((c, i) => `<div class="fc-card" tabindex="0" role="button" data-chart-id="${esc(c.id)}"${c.equal ? ' data-equal' : ''}><span class="fc-card-title">${esc(c.title)}</span><span class="fc-card-sub">${esc(c.subtitle || '')}</span>${scatter(c, view, ids ?? view.keys, byId, roster, axes[i])}<div class="fc-notes">${sizeKey(c, byId)}${c.note ? `<p class="fc-note">${esc(c.note)}</p>` : ''}${c.fit || c.corners ? '' : c.equal ? '<p class="fc-note fc-note-key">Dotted line = actual equals expected · green: opponents shot better than expected (favourable for the opposing player), red: worse</p>' : '<p class="fc-note fc-note-key">Dashed lines = league values · green: favourable for the opposing player on both axes, red: unfavourable</p>'}</div></div>`).join('')}</div></section>`;}
