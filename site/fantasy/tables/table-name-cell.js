/* The Players name cell: position badge, identity block (name above team code), then the optional fantasy figures (CR, Value with its sparkline).
   Parts, order and visibility come from config/arrangement.json (fantasy.stat-table.players-name-cell and the containers inside it); every element has a
   data-part equal to its theme / sizes key. Teams keep their own cell (table-view.js). */
import { esc } from '../../core/html.js';
import { Data } from '../../core/data.js';
import { teamCode } from '../../core/teams.js';
import { drawParts } from '../../core/arrangement.js';
import { sparklineSvg, validSeries } from '../../core/sparkline.js';

const A = 'fantasy.stat-table.';
const part = key => `data-part="${A}${key}"`;

/** r: the row ({ id, name, full, team, pos }), roster, info: Data.fantasyInfo(id, window) (null while there is no data). */
export function playerNameCellHtml(r, roster, info) {
  const entry = roster.players?.[r.id], split = !!(entry?.first && entry?.last);   // given and family name only when both are known; else the display name intact
  const code = teamCode(roster, r.team), hasCr = info?.cr != null, hasValue = info?.value != null;
  const show = { players: true, 'when-data': info !== null && (hasCr || hasValue) };
  const draw = {
    'name-cell-position-badge': () => (['G', 'F', 'C'].includes(r.pos) ? `<span ${part('name-cell-position-badge')} title="Position">${r.pos}</span>` : ''),
    'name-cell-identity': () => `<div ${part('name-cell-identity')}>${drawParts(A + 'name-cell-identity', {
      'name': () => `<button class="fw-name" data-open="${esc(r.id)}" title="${esc(r.full)}">${split ? drawParts(A + 'name-cell-name', {
        'name-cell-given-name': () => `<span ${part('name-cell-given-name')}>${esc(entry.first)}</span>`,
        'name-cell-family-name': () => `<span ${part('name-cell-family-name')}>${esc(entry.last)}</span>`,
      }, show).map(p => p.html).join(' ') : esc(r.name)}</button>`,
      'team-and-position': () => (code ? `<small class="fw-who" title="${esc(roster.teams[r.team] || r.team)}">${esc(code)}</small>` : ''),
    }, show).map(p => p.html).join('')}</div>`,
    'name-cell-figures': () => {
      const figures = drawParts(A + 'name-cell-figures', {
        'cr-box': () => (hasCr ? `<span class="fw-cr-box" ${part('name-cell-cr-box')}>${esc(info.cr)}</span>` : ''),
        'value-chip': () => (hasValue ? `<span class="fw-value-chip" ${part('name-cell-value-chip')}>${drawParts(A + 'name-cell-value-chip', {
          'name-cell-value': () => `<span>${esc(Data.formatMetric('value', info.value))}</span>`,
          'name-cell-sparkline': () => sparklineSvg(info.valueSeries, A + 'name-cell-sparkline'),
        }, { 'when-data': validSeries(info.valueSeries) }).map(p => p.html).join('')}</span>` : ''),
      }, show).map(p => p.html).join('');
      return figures ? `<div ${part('name-cell-figures')}>${figures}</div>` : '';   // no figures: no group, no spacing
    },
  };
  return `<div ${part('players-name-cell')}>${drawParts(A + 'players-name-cell', draw, show).map(p => p.html).join('')}</div>`;
}
