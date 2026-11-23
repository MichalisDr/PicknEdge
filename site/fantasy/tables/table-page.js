/* The Fantasy tables page (Players and Teams): draws from the state, wires the toolbar, the header sort (click = best end first, Shift+click or
   long-press = combined rank), the filters and the search. Data: table-data.js, markup: table-view.js, cell pop-ups: table-popups.js. */
import { Data } from '../../core/data.js';
import * as Windows from '../../core/windows.js';
import * as TM from '../../core/table-model.js';
import { state, resetFilters } from './table-state.js';
import { moveState } from './table-filters.js';
import { loadTable } from './table-data.js';
import { tableHtml, errorHtml, loadingHtml } from './table-view.js';
import { wirePopups } from './table-popups.js';
import { open as openCard } from '../cards/card.js';
import { loadIcons } from '../../core/icons.js';
import { TOOLBAR_ICONS } from './table-toolbar.js';
import { fitFirstColumn } from './table-fit.js';

let host = null, drawId = 0, shown = null;

let measureCtx = null;
const textWidth = (text, font) => { measureCtx ||= document.createElement('canvas').getContext('2d'); measureCtx.font = font; return measureCtx.measureText(text).width; };
const widthsOf = names => { const font = '700 13px ' + getComputedStyle(document.body).fontFamily; return names.map(n => textWidth(n, font)); };

/* Players: first column from the rows shown, one width per CR / Value slot (table-fit.js). Again when the container or the fonts change. */
function fit() { if (shown && shown.TL && host?.isConnected && state.entity === 'players') fitFirstColumn(host, { min: shown.TL.firstCol.min, numWidth: shown.TL.numWidth }); }
let fitFrame = 0;
window.addEventListener?.('resize', () => { cancelAnimationFrame(fitFrame); fitFrame = requestAnimationFrame(fit); });
document.fonts?.ready.then(fit);

async function draw() {
  if (!host || !host.isConnected) return;
  const mine = ++drawId;
  let M;
  try {
    await loadIcons(TOOLBAR_ICONS);
    M = await loadTable(state, widthsOf, () => mine !== drawId);
    if (!M) return;
  } catch (e) {
    host.innerHTML = errorHtml(state, e.message);
    return;
  }
  shown = M;
  const keep = document.activeElement?.dataset?.fkey, body = host.querySelector('.fw-fd-body'), top = body ? body.scrollTop : 0;   // the drawer is redrawn with the table: keep its scroll and focus
  host.innerHTML = tableHtml(state, M);
  const nb = host.querySelector('.fw-fd-body'); if (nb) nb.scrollTop = top;
  if (keep) host.querySelector(`[data-fkey="${keep}"]`)?.focus({ preventScroll: true });
  performance.mark('fantasy-table-ready');   // measured by the Phase 3 gate (time to table)
  fit();
  wire();
}

/* Header: click = sort best end first (again = reverse), Shift+click or long-press = add or remove the column from the combined rank. */
const FX = ['cr', 'value'];   // the Player header's own sort keys

function headerSort() {
  const current = () => (shown.sel.length || FX.includes(shown.cur.metric) ? null : shown.cur.metric);
  const toggle = id => { let s = state.sel.slice(); if (!s.length && current() && current() !== id) s = [current()]; s = s.includes(id) ? s.filter(x => x !== id) : [...s, id]; state.sel = s; draw(); };
  const plain = id => { const same = !shown.sel.length && shown.cur.metric === id; state.dir = same ? (shown.cur.dir === 'asc' ? 'desc' : 'asc') : TM.firstDirection(shown.byId[id].direction); state.sort = id; state.sel = []; draw(); };
  host.querySelectorAll('[data-sort-fx]').forEach(b => {   // Cr / Value: highest first, again = reverse
    b.onclick = () => { const id = b.dataset.sortFx, same = !shown.sel.length && shown.cur.metric === id; state.dir = same ? (shown.cur.dir === 'asc' ? 'desc' : 'asc') : 'desc'; state.sort = id; state.sel = []; draw(); };
  });
  host.querySelectorAll('[data-sort]').forEach(b => {
    let timer = null, long = false;
    b.onpointerdown = e => { long = false; if (e.pointerType === 'mouse') return; timer = setTimeout(() => { long = true; toggle(b.dataset.sort); }, 500); };
    b.onpointerup = b.onpointerleave = b.onpointercancel = () => clearTimeout(timer);
    b.oncontextmenu = e => { if (long) e.preventDefault(); };
    b.onclick = e => { if (long) { long = false; return; } e.shiftKey ? toggle(b.dataset.sort) : plain(b.dataset.sort); };
  });
}

/* The Filters drawer: every change applies at once. The Credits bar updates the numbers and the segment while dragging (no redraw, so the drag is not interrupted) and redraws the table on release. */
function wireDrawer() {
  const range = shown.range, num = el => (el.value === '' ? NaN : Number(el.value));
  host.querySelectorAll('[data-team]').forEach(el => { el.onchange = () => { const c = el.dataset.team; state.team = el.checked ? [...state.team, c] : state.team.filter(x => x !== c); draw(); }; });
  const all = host.querySelector('[data-team-all]'), none = host.querySelector('[data-team-none]');
  if (all) all.onclick = () => { state.team = Object.keys(shown.roster.teams); draw(); };
  if (none) none.onclick = () => { state.team = []; draw(); };
  const bar = host.querySelectorAll('[data-cr]');
  const paint = h => {
    const span = range.max - range.min || 1, out = k => host.querySelector(`[data-cr-out="${k}"]`), seg = host.querySelector('[data-cr-seg]');
    out('lo').textContent = h.lo.toFixed(1); out('hi').textContent = h.hi.toFixed(1);
    seg.style.marginLeft = ((h.lo - range.min) / span) * 100 + '%'; seg.style.setProperty('margin-right', ((range.max - h.hi) / span) * 100 + '%');
    bar.forEach(i => { i.value = i.dataset.cr === 'lo' ? h.lo : h.hi; if (i.dataset.cr === 'lo') i.toggleAttribute('data-top', h.lo > range.min + span / 2); });
    const box = host.querySelector('[data-filter="maxCr"]'); if (box) box.value = h.hi.toFixed(1);
  };
  bar.forEach(i => { i.oninput = () => paint(moveState(state, range, i.dataset.cr, num(i))); i.onchange = () => draw(); });
  host.querySelectorAll('[data-filter]').forEach(el => {
    el.onchange = () => {
      const k = el.dataset.filter;
      if (k === 'showAll') state.showAll = el.checked;
      else if (k === 'maxCr') moveState(state, range, 'hi', num(el));   // the same value as the bar's upper handle
      else state[k] = Math.max(0, num(el) || 0);
      draw();
    };
  });
  const close = host.querySelector('[data-filters-close]');
  if (close) close.onclick = () => { state.filters = false; draw(); };
  const reset = host.querySelector('[data-filters-reset]');
  if (reset) reset.onclick = () => { resetFilters(state); draw(); };   // the drawer stays open; G / F / C, search, window and Sort by value are untouched
}

function wire() {
  const on = (sel, ev, fn) => host.querySelectorAll(sel).forEach(el => { el[ev] = () => fn(el); });
  Windows.wire(host, state, () => { state.sort = ''; state.sel = []; draw(); });
  on('[data-fwmode]', 'onclick', b => { state.mode = b.dataset.fwmode; draw(); });
  host.querySelectorAll('.fc-pt[data-open]').forEach(p => { p.onclick = () => openCard(state.entity, p.dataset.open, { win: state.win, mode: state.view }); });
  on('[data-view-set]', 'onclick', b => { if (state.view === b.dataset.viewSet) return; state.view = b.dataset.viewSet; state.sort = ''; state.sel = []; draw(); });
  on('[data-position]', 'onclick', b => { const p = b.dataset.position; state.position = state.position.includes(p) ? state.position.filter(x => x !== p) : [...state.position, p]; draw(); });
  headerSort();
  const filters = host.querySelector('[data-filters]');
  if (filters) filters.onclick = () => { state.filters = !state.filters; draw(); };
  wireDrawer();
  on('[data-open]', 'onclick', b => openCard(state.entity, b.dataset.open, { win: state.win, mode: state.view }));
  wirePopups(host, state, shown);
  const search = host.querySelector('input[type=search]');
  search.oninput = e => { state.query = e.target.value; draw().then(() => { const i = host.querySelector('input[type=search]'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }); };
}

export function mount(target, entity = 'teams') {
  host = target;
  Data.clearOldCaches();
  if (state.entity !== entity) { state.entity = entity; state.query = ''; state.sort = ''; state.sel = []; }
  state.view = 'profile';   // the page always opens in Profile
  host.innerHTML = loadingHtml;
  draw();
}
document.addEventListener('keydown', e => { if (e.key === 'Escape' && state.filters && host?.isConnected) { state.filters = false; draw(); } });
