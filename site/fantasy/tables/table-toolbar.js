/* The Players toolbar: an upper row with the Profile / Shooting pair and the Table / Charts pair (icon above label), and a lower row with the sample windows
   at the left and G / F / C, Find player and Filters grouped at the right. Rows, order, alignment and visibility come from config/arrangement.json
   (fantasy.stat-table.players-view-row, .players-toolbar, ...); every element has a data-part equal to its theme / sizes / arrangement key.
   The icons are SVG files (assets/icons) drawn with currentColor: they take the colour of the button around them. */
import * as Windows from '../../core/windows.js';
import { esc } from '../../core/html.js';
import { icon } from '../../core/icons.js';
import { drawParts } from '../../core/arrangement.js';

const A = 'fantasy.stat-table.';
const part = key => `data-part="${A}${key}"`;
/** Icons to load (core/icons.js loadIcons) before the toolbar is drawn. */
export const TOOLBAR_ICONS = ['profile', 'target', 'table', 'bar-chart', 'search', 'funnel'];

/** A button with an icon over (or beside, by config) its label. kind: 'view' | 'mode'. */
function iconButton(kind, attrs, iconName, label) {
  const inner = drawParts(`${A}players-${kind}-button`, {
    [`players-${kind}-icon`]: () => `<span ${part(`players-${kind}-icon`)} aria-hidden="true">${icon(iconName)}</span>`,
    label: () => `<span>${label}</span>`,
  }, {}).map(p => p.html).join('');
  return `<button ${part(`players-${kind}-button`)} ${attrs}>${inner}</button>`;
}

/** state, show = { players, 'charts-available' }, filtersPanel = the Filters pop-up markup (empty when closed). Returns the two rows. */
export function playersToolbarHtml(state, show, filtersPanel = '') {
  const draw = {
    'view-button': () => `<div role="group" aria-label="Table view" ${part('players-view-buttons')}>${[['profile', 'profile', 'Profile'], ['shooting', 'target', 'Shooting']]
      .map(([v, ic, label]) => iconButton('view', `data-view-set="${v}" aria-pressed="${state.view === v}"`, ic, label)).join('')}</div>`,
    'players-view-divider': () => `<span ${part('players-view-divider')} aria-hidden="true"></span>`,
    'mode-tabs': () => `<div role="tablist" aria-label="Table or charts" ${part('players-mode-buttons')}>${[['table', 'table', 'Table'], ['charts', 'bar-chart', 'Charts']]
      .map(([v, ic, label]) => iconButton('mode', `data-fwmode="${v}" role="tab" aria-selected="${state.mode === v}"`, ic, label)).join('')}</div>`,
    'window-buttons': () => `<div role="group" aria-label="Sample window" ${part('players-window-buttons')}>${Windows.buttons(state)}</div>`,
    'position-buttons': () => `<div role="group" aria-label="Player position" ${part('players-position-buttons')}>${['G', 'F', 'C'].map(v => `<button data-position="${v}" aria-pressed="${state.position.includes(v)}">${v}</button>`).join('')}</div>`,
    'search': () => `<label ${part('players-search')}>${drawParts(`${A}players-search`, {
      'players-search-icon': () => `<span ${part('players-search-icon')} aria-hidden="true">${icon('search')}</span>`,
      'players-search-field': () => `<input type="search" aria-label="Find player" placeholder="Find player" value="${esc(state.query)}">`,
    }, {}).map(p => p.html).join('')}</label>`,
    'filters-button': () => `<button ${part('players-filters-button')} data-filters aria-expanded="${state.filters}" aria-label="Filters" title="Filters">${drawParts(`${A}players-filters-button`, {
      'players-filters-icon': () => `<span ${part('players-filters-icon')} aria-hidden="true">${icon('funnel')}</span>`,
    }, {}).map(p => p.html).join('')}</button>`,
  };
  const viewRow = drawParts(`${A}players-view-row`, draw, show).map(p => p.html).join('');
  const lower = drawParts(`${A}players-toolbar`, draw, show);
  return `<div ${part('players-view-row')}>${viewRow}</div>
    <div ${part('players-toolbar')}>${lower.filter(p => p.align !== 'end').map(p => p.html).join('')}<div ${part('players-toolbar-end-group')}>${lower.filter(p => p.align === 'end').map(p => p.html).join('')}</div>${filtersPanel}</div>`;
}
