/* Fantasy · Charts mode: the gallery of comparative charts for the current table, over the same window and filters. Click a point to open the card;
   click a chart to enlarge it (gallery-dialog.js). */
import { Data } from '../../core/data.js';
import * as Windows from '../../core/windows.js';
import { esc } from '../../core/html.js';
import { CHARTS } from './charts.js';
import { scatter } from './scatter.js';

/** html of the gallery for the current view; `ids` = entities to plot (the table's list before search). */
export async function galleryHtml(kind, viewName, state, ids) {
  const [view, { byId }, roster] = await Promise.all([Windows.view(kind, state), Data.metrics(), Data.roster()]);
  const charts = CHARTS.filter(c => c.entity === kind && c.view === viewName);
  const where = `${kind === 'teams' ? 'Teams' : 'Players'} · ${viewName === 'profile' ? 'Profile' : 'Shooting'} · ${Windows.label(state)}`;
  if (!charts.length) return `<section class="fc-gallery"><div class="fw-section-title"><h3>Comparative charts</h3><span>${esc(where)}</span></div><p class="fw-empty">No comparative charts for this view yet. Open a ${kind === 'teams' ? 'team' : 'player'} card (click a name in the Table) for its radar and trends.</p></section>`;
  return `<section class="fc-gallery" data-entity="${kind}" data-win="${esc(state.win)}"><div class="fw-section-title"><h3>Comparative charts</h3><span>${esc(where)} · ${charts.length} ${charts.length === 1 ? 'chart' : 'charts'}</span></div><div class="fc-grid-gallery">${charts.map(c => `<div class="fc-card" tabindex="0" role="button" data-chart-id="${esc(c.id)}"><span class="fc-card-title">${esc(c.title)}</span><span class="fc-card-sub">${esc(c.subtitle || '')}</span>${scatter(c, view, ids ?? view.keys, byId, roster)}${c.note ? `<p class="fc-note">${esc(c.note)}</p>` : ''}${c.equal ? '<p class="fc-note">Dotted line = actual equals expected · green: opponents shot better than expected (favourable for the opposing player), red: worse</p>' : '<p class="fc-note">Dashed lines = league values · green: favourable for the opposing player on both axes, red: unfavourable</p>'}</div>`).join('')}</div></section>`;}
