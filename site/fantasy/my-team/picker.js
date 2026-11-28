/* The player picker of the team card: a panel beside the court on wide screens, a bottom sheet elsewhere (the style sheet decides). It lists the
   players for one empty slot, with a name search and a CR / PIR / MIN order; a court slot is locked to its position, a bench slot has ALL / G / F / C.
   A player already in the team is listed dimmed and cannot be picked. The head, title and close button are the Filters drawer's, the sort chips the
   card's, the position boxes the Players toolbar's, the portrait the gallery's, the badge and CR box the Players name cell's. */
import { esc } from '../../core/html.js';
import { SIXTH_MAN, positionsOf } from '../../core/team-model.js';
import { ICONS } from '../tables/table-filters.js';
import { figuresHtml } from '../tables/table-name-cell.js';
import { POSITION_NAMES, portraitHtml } from './court-view.js';

export const SORTS = [['cr', 'CR'], ['pir', 'PIR'], ['min', 'MIN']];
export const DEFAULT_SORT = 'pir';
const POSITION_CHIPS = ['ALL', 'G', 'F', 'C'];
const part = key => `data-part="fantasy.my-team.${key}"`;

/** What a slot asks for: { title, position } (position null = any, with the position chips). slot: { area: 'starters' | 'bench', index }. */
export function slotRequest(team, { area, index }) {
  if (area === 'starters') {
    const position = positionsOf(team.formation)[index];
    return { title: `Choose a ${POSITION_NAMES[position].toLowerCase()}`, position };
  }
  return { title: index === SIXTH_MAN ? 'Choose a 6th man' : 'Choose a bench player', position: null };
}

/* Lower case without accents: "doncic" finds "Dončić". */
const plain = text => String(text).normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

/** The players to list. pool: [{ id, fullName, pos, sort: { cr, pir, min } }]. Highest first; a player without the number goes last; ties by name. */
export function pickerList(pool, { position = null, chip = 'ALL', query = '', sort = DEFAULT_SORT } = {}) {
  const wanted = position ?? (chip === 'ALL' ? null : chip), text = plain(query.trim());
  const value = p => (Number.isFinite(p.sort[sort]) ? p.sort[sort] : -Infinity);
  return pool.filter(p => (!wanted || p.pos === wanted) && (!text || plain(p.fullName).includes(text)))
    .sort((a, b) => (value(b) > value(a) ? 1 : value(b) < value(a) ? -1 : a.fullName.localeCompare(b.fullName)));
}

function rowHtml(p, taken) {
  const next = p.next ? `${p.next.home ? 'vs' : '@'} ${p.next.code}` : '';
  const stat = (label, value) => `<span ${part('picker-stat')}><span ${part('picker-stat-label')}>${label}</span><span>${esc(value)}</span></span>`;
  return `<li><button type="button" ${part('picker-row')} data-pick="${esc(p.id)}"${taken ? ' aria-disabled="true"' : ''}>
    ${portraitHtml(p)}
    <span ${part('picker-player')}><span ${part('picker-name')} title="${esc(p.fullName)}">${esc(p.name)}</span><span ${part('picker-meta')}>${['G', 'F', 'C'].includes(p.pos) ? `<span data-part="fantasy.stat-table.name-cell-position-badge" title="Position">${p.pos}</span>` : ''}<span ${part('picker-next')}>${taken ? 'in roster' : esc(next)}</span></span></span>
    ${stat('PIR', p.pir)}${stat('MIN', p.min)}
    <span ${part('picker-cr')}>${figuresHtml(p.info?.cr == null ? null : { cr: p.info.cr, value: null })}</span>
  </button></li>`;
}

/** The rows of the list; taken = the ids already in the team. */
export const listHtml = (players, taken) => (players.length ? players.map(p => rowHtml(p, taken.includes(p.id))).join('') : '<li class="fw-empty" role="status">No matching players</li>');

const chips = (dataPart, label, attr, options, selected) => `<div role="group" aria-label="${label}" data-part="${dataPart}">${options.map(([v, text]) => `<button type="button" ${attr}="${v}" aria-pressed="${v === selected}">${text}</button>`).join('')}</div>`;

/** The panel without its rows. request = slotRequest(...). */
export function pickerHtml(request) {
  return `<aside ${part('picker')} aria-label="${esc(request.title)}">
    <div class="fw-fd-head"><h2 class="fw-fd-title">${esc(request.title)}</h2><button type="button" class="fw-fd-close" data-picker-close aria-label="Close the player picker">${ICONS.close}</button></div>
    <input ${part('picker-search')} type="search" data-picker-search placeholder="Find player" aria-label="Find player" autocomplete="off">
    <div ${part('picker-chips')}>${chips('fantasy.player-card.window-buttons', 'Sort by', 'data-sort-by', SORTS, DEFAULT_SORT)}${request.position ? '' : chips('fantasy.stat-table.players-position-buttons', 'Player position', 'data-chip', POSITION_CHIPS.map(c => [c, c]), 'ALL')}</div>
    <ul ${part('picker-list')} data-picker-list></ul>
  </aside>`;
}

/** Put a picker into `host` and wire it. Returns its element. onPick(id) and onClose() are the card's. */
export function mountPicker(host, { request, pool, taken, onPick, onClose }) {
  host.insertAdjacentHTML('beforeend', pickerHtml(request));
  const el = host.lastElementChild, list = el.querySelector('[data-picker-list]'), search = el.querySelector('[data-picker-search]');
  const state = { position: request.position, chip: 'ALL', query: '', sort: DEFAULT_SORT };
  const draw = () => { list.innerHTML = listHtml(pickerList(pool, state), taken); list.scrollTop = 0; };
  const choose = (attr, key) => el.querySelectorAll(`[${attr}]`).forEach(b => {
    b.onclick = () => {
      state[key] = b.getAttribute(attr);
      el.querySelectorAll(`[${attr}]`).forEach(o => o.setAttribute('aria-pressed', String(o === b)));
      draw();
    };
  });
  choose('data-sort-by', 'sort');
  choose('data-chip', 'chip');
  search.oninput = () => { state.query = search.value; draw(); };
  list.onclick = e => {
    const row = e.target.closest('[data-pick]');
    if (row && row.getAttribute('aria-disabled') !== 'true') onPick(row.dataset.pick);
  };
  el.querySelector('[data-picker-close]').onclick = onClose;
  draw();
  el.scrollIntoView?.({ block: 'nearest' });
  /* On a touch screen the search field would open the keyboard over the sheet, so the focus starts on Close there. */
  (globalThis.matchMedia?.('(pointer:coarse)').matches ? el.querySelector('[data-picker-close]') : search).focus({ preventScroll: true });
  return el;
}
