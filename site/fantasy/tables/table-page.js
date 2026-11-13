/* The Fantasy tables page (Players and Teams): draws from the state, wires the toolbar, the header sort (click = best end first, Shift+click or
   long-press = combined rank), the filters and the search. Data: table-data.js, markup: table-view.js, cell pop-ups: table-popups.js. */
import { Data } from '../../core/data.js';
import * as Windows from '../../core/windows.js';
import * as TM from '../../core/table-model.js';
import { state } from './table-state.js';
import { loadTable } from './table-data.js';
import { tableHtml, errorHtml, loadingHtml } from './table-view.js';
import { wirePopups } from './table-popups.js';
import { open as openCard } from '../cards/card.js';

let host = null, drawId = 0, shown = null;

let measureCtx = null;
const textWidth = (text, font) => { measureCtx ||= document.createElement('canvas').getContext('2d'); measureCtx.font = font; return measureCtx.measureText(text).width; };
const widthsOf = names => { const font = '700 13px ' + getComputedStyle(document.body).fontFamily; return names.map(n => textWidth(n, font)); };

async function draw() {
  if (!host || !host.isConnected) return;
  const mine = ++drawId;
  let M;
  try {
    M = await loadTable(state, widthsOf, () => mine !== drawId);
    if (!M) return;
  } catch (e) {
    host.innerHTML = errorHtml(state, e.message);
    return;
  }
  shown = M;
  host.innerHTML = tableHtml(state, M);
  performance.mark('fantasy-table-ready');   // measured by the Phase 3 gate (time to table)
  wire();
}

/* Header: click = sort best end first (again = reverse), Shift+click or long-press = add or remove the column from the combined rank. */
function headerSort() {
  const current = () => (shown.sel.length ? null : shown.cur.metric);
  const toggle = id => { let s = state.sel.slice(); if (!s.length && current() && current() !== id) s = [current()]; s = s.includes(id) ? s.filter(x => x !== id) : [...s, id]; state.sel = s; draw(); };
  const plain = id => { const same = !shown.sel.length && shown.cur.metric === id; state.dir = same ? (shown.cur.dir === 'asc' ? 'desc' : 'asc') : TM.firstDirection(shown.byId[id].direction); state.sort = id; state.sel = []; draw(); };
  host.querySelectorAll('[data-sort]').forEach(b => {
    let timer = null, long = false;
    b.onpointerdown = e => { long = false; if (e.pointerType === 'mouse') return; timer = setTimeout(() => { long = true; toggle(b.dataset.sort); }, 500); };
    b.onpointerup = b.onpointerleave = b.onpointercancel = () => clearTimeout(timer);
    b.oncontextmenu = e => { if (long) e.preventDefault(); };
    b.onclick = e => { if (long) { long = false; return; } e.shiftKey ? toggle(b.dataset.sort) : plain(b.dataset.sort); };
  });
}

function wire() {
  const on = (sel, ev, fn) => host.querySelectorAll(sel).forEach(el => { el[ev] = () => fn(el); });
  Windows.wire(host, state, () => { state.sort = ''; state.sel = []; draw(); });
  on('[data-fwmode]', 'onclick', b => { state.mode = b.dataset.fwmode; draw(); });
  host.querySelectorAll('.fc-pt[data-open]').forEach(p => { p.onclick = () => openCard(state.entity, p.dataset.open, { win: state.win }); });
  on('[data-view-toggle]', 'onclick', () => { state.view = state.view === 'shooting' ? 'profile' : 'shooting'; state.sort = ''; state.sel = []; draw(); });
  on('[data-position]', 'onclick', b => { state.position = b.dataset.position; draw(); });
  headerSort();
  const filters = host.querySelector('[data-filters]');
  if (filters) filters.onclick = () => { state.filters = !state.filters; draw(); };
  on('[data-filter]', 'onchange', el => {
    const k = el.dataset.filter;
    state[k] = k === 'team' ? el.value : k === 'showAll' ? el.checked : Math.max(0, Number(el.value) || 0);
    draw();
  });
  on('[data-open]', 'onclick', b => openCard(state.entity, b.dataset.open, { win: state.win }));
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
document.addEventListener('click', e => { if (state.filters && host?.isConnected && !e.target.closest('.fw-filters,[data-filters]')) { state.filters = false; draw(); } });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && state.filters && host?.isConnected) { state.filters = false; draw(); } });
