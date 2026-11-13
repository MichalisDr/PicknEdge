/* The data of a Fantasy table: rows, the pool the ranks are taken from, the cell model of every column, the order, the chart gallery when it is on.
   Values, labels and directions come from metrics.json and the views; the only calculations are ranking and ordering (core/table-model.js).
   Columns, groups, labels, widths and default sorts: config/table-layouts.json. No markup here except the chart gallery string. */
import { Data } from '../../core/data.js';
import * as Windows from '../../core/windows.js';
import * as Elig from '../../core/eligibility.js';
import * as TM from '../../core/table-model.js';
import { teamLabel } from '../../core/teams.js';
import { available as chartsAvailable } from '../gallery/charts.js';
import { galleryHtml } from '../gallery/gallery.js';

let layoutPromise = null;
const layoutFile = () => layoutPromise || (layoutPromise = fetch(new URL('../../config/table-layouts.json', import.meta.url)).then(r => { if (!r.ok) throw new Error('table-layouts.json ' + r.status); return r.json(); }));

/* League average row: every player (or team) of the window, straight from the view's league row; no per-game rows needed. */
const leagueCells = (view, ids) => Object.fromEntries(ids.map(id => [id, view.league(id)]));

/** Everything the table markup needs for the current state, or null when a newer draw has started (isStale()).
    widthsOf(names) = the rendered widths of the first-column texts in px. */
export async function loadTable(state, widthsOf, isStale) {
  const teams = state.entity === 'teams';
  const [view, { byId }, roster, manifest, status, TL] = await Promise.all([Windows.view(state.entity, state), Data.metrics(), Data.roster(), Data.manifest(), Data.status(), layoutFile()]);
  if (isStale()) return null;
  const tname = state.entity + '.' + state.view, T = TL.tables[tname], cols = T.groups.flat();
  // Availability gate: the gp of the availability window's view (L3 by default); the view is a built file, nothing is stored.
  const avail = !teams && manifest.eligibility.availability ? await Data.view('players', manifest.eligibility.availability.window) : null;
  if (isStale()) return null;
  const rows = view.keys.map(id => {
    const r = view.row(id), gp = teams ? r.games : view.get(id, 'gp').value;
    return { id, name: teams ? teamLabel(roster, id) : roster.players[id]?.name || r.name || id, full: teams ? roster.teams[id] || id : roster.players[id]?.name || r.name || id, team: r.team, pos: r.pos, gp,
      min: teams ? null : view.get(id, 'min').value, pir: teams ? null : view.get(id, 'pir').value, availGp: avail ? (avail.get(id, 'gp')?.value ?? 0) : null };
  });
    const pool = teams ? rows : rows.filter(r => Elig.listed(manifest.eligibility, state.win, r, r.availGp, state.showAll) && (state.position === 'ALL' || r.pos === state.position)
    && r.gp >= state.minGp && (r.min ?? 0) >= state.minMin && (!state.team || r.team === state.team));
  const q = state.query.trim().toLowerCase();
  const list = pool.filter(r => !q || (r.full + ' ' + (roster.teams[r.team] || r.team || '')).toLowerCase().includes(q));
  // Cell model per column: value (null for "few shots"), rank among the pool (the rows before the search box).
  const few = (c, id) => c.few && !(view.get(id, c.few).value >= TL.fewBelow);
  const poolIds = pool.map(r => r.id), model = new Map();
  for (const c of cols) {
    const m = byId[c.metric], values = new Map(poolIds.map(id => [id, few(c, id) ? null : view.get(id, c.metric).value]));
    model.set(c.metric, { c, m, values, list: [...values.values()] });
  }
  const cur = state.sort && cols.some(c => c.metric === state.sort) ? { metric: state.sort, dir: state.dir } : T.defaultSort;
  const sel = state.sel.filter(id => cols.some(c => c.metric === id));
  let ordered;
  if (sel.length) {
    const sc = TM.combined(poolIds, sel.map(id => ({ dir: byId[id].direction, values: model.get(id).values })), poolIds);
    ordered = TM.order(list.map(r => r.id), id => sc.get(id), 'desc');
  } else {
    const sm = model.get(cur.metric);
    ordered = TM.order(list.map(r => r.id), id => few(sm.c, id) ? null : view.get(id, cur.metric).value, cur.dir);
  }
  const byRow = new Map(rows.map(r => [r.id, r]));
  const gallery = state.mode === 'charts' && chartsAvailable(state.entity, state.view) ? await galleryHtml(state.entity, state.view, state, pool.map(r => r.id)) : '';
  if (isStale()) return null;
  return { view, TL, T, tname, cols, model, few, roster, status, shown: ordered.map(id => byRow.get(id)), firstW: TM.firstColWidth(widthsOf([...rows.map(r => r.name), 'League average']), TL.firstCol), sel, cur, avg: leagueCells(view, cols.map(c => c.metric)), gallery, byId };
}
