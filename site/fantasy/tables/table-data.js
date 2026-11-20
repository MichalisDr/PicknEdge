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
import { crRange, passes } from './table-filters.js';

let layoutPromise = null;
const layoutFile = () => layoutPromise || (layoutPromise = fetch(new URL('../../config/table-layouts.json', import.meta.url)).then(r => { if (!r.ok) throw new Error('table-layouts.json ' + r.status); return r.json(); }));

/* League average row: every player (or team) of the window, straight from the view's league row; no per-game rows needed. */
const leagueCells = (view, ids) => Object.fromEntries(ids.map(id => [id, view.league(id)]));

/** Everything the table markup needs for the current state, or null when a newer draw has started (isStale()).
    widthsOf(names) = the rendered widths of the first-column texts in px. */
export async function loadTable(state, widthsOf, isStale) {
  const teams = state.entity === 'teams';
  const [view, { byId }, roster, manifest, TL] = await Promise.all([Windows.view(state.entity, state), Data.metrics(), Data.roster(), Data.manifest(), layoutFile()]);
  if (isStale()) return null;
  const tname = state.entity + '.' + state.view, T = TL.tables[tname], cols = T.groups.flat();
  // Availability gate: the gp of the availability window's view (L3 by default); the view is a built file, nothing is stored.
  const avail = !teams && manifest.eligibility.availability ? await Data.view('players', manifest.eligibility.availability.window) : null;
  if (isStale()) return null;
  const rows = view.keys.map(id => {
    const r = view.row(id), gp = teams ? r.games : view.get(id, 'gp').value, fx = teams ? null : Data.fantasyInfo(id, state.win);   // credits and value of the selected window (null = no entry)
    return { id, name: teams ? teamLabel(roster, id) : roster.players[id]?.name || r.name || id, full: teams ? roster.teams[id] || id : roster.players[id]?.name || r.name || id, team: r.team, pos: r.pos, gp,
      min: teams ? null : view.get(id, 'min').value, pir: teams ? null : view.get(id, 'pir').value, availGp: avail ? (avail.get(id, 'gp')?.value ?? 0) : null,
      cr: Number.isFinite(fx?.cr) ? fx.cr : null, value: Number.isFinite(fx?.value) ? fx.value : null };
  });
  const range = teams ? { min: 0, max: 0 } : crRange(rows.map(r => r.cr));   // the Credits bar spans the credits found in the window's data
  /* Two sets of players. The RANK POOL = the players listed by the default eligibility rule, narrowed only by the position buttons: ranks never depend on the drawer filters or the search box.
     The SHOWN rows = the same, but with the below-thresholds switch (showAll) also the players under the thresholds (they have no rank), narrowed by the drawer filters and the search box. */
  const posOk = r => !state.position.length || state.position.length >= 3 || state.position.includes(r.pos);
  const pool = teams ? rows : rows.filter(r => posOk(r) && Elig.listed(manifest.eligibility, state.win, r, r.availGp, false));
  const poolSet = new Set(pool.map(r => r.id));
  const filtered = teams ? rows : rows.filter(r => posOk(r) && Elig.listed(manifest.eligibility, state.win, r, r.availGp, state.showAll) && passes(state, range, r));
  // Next game of every team in the rows shown (same source as the player card's next-opponent button); a missing schedule only drops line 2's opponent.
  const nextOf = new Map(teams ? [] : await Promise.all([...new Set(filtered.map(r => r.team))].map(async t => [t, await Data.nextGame(t).catch(() => null)])));
  for (const r of filtered) r.next = nextOf.get(r.team) || null;
  const q = state.query.trim().toLowerCase();
  const list = filtered.filter(r => !q || (r.full + ' ' + (roster.teams[r.team] || r.team || '')).toLowerCase().includes(q));
  // Cell model per column: the value of every pool row and shown row (null for "few shots"); `list` = the pool's values, the only source of ranks.
  const few = (c, id) => c.few && !(view.get(id, c.few).value >= TL.fewBelow);
  const poolIds = pool.map(r => r.id), allIds = [...new Set([...poolIds, ...list.map(r => r.id)])], model = new Map();
  for (const c of cols) {
    const m = byId[c.metric], values = new Map(allIds.map(id => [id, few(c, id) ? null : view.get(id, c.metric).value]));
    model.set(c.metric, { c, m, values, list: poolIds.map(id => values.get(id)) });
  }
  const cur = state.sort && cols.some(c => c.metric === state.sort) ? { metric: state.sort, dir: state.dir } : T.defaultSort;
  const sel = state.sel.every(id => cols.some(c => c.metric === id)) ? state.sel : [];   // a combined rank with a column the table no longer has falls back to the default sort
  const byRow = new Map(rows.map(r => [r.id, r])), byValue = !teams && !!state.sortValue;   // Sort by value: the window's value, highest first, players without one last
  let ordered;
  if (byValue) {
    ordered = TM.order(list.map(r => r.id), id => byRow.get(id).value, 'desc');
  } else if (sel.length) {
    const sc = TM.combined(list.map(r => r.id), sel.map(id => ({ dir: byId[id].direction, values: model.get(id).values })), poolIds);
    ordered = TM.order(list.map(r => r.id), id => sc.get(id), 'desc');
  } else {
    const sm = model.get(cur.metric);
    ordered = TM.order(list.map(r => r.id), id => few(sm.c, id) ? null : view.get(id, cur.metric).value, cur.dir);
  }
  const gallery = state.mode === 'charts' && chartsAvailable(state.entity, state.view) ? await galleryHtml(state.entity, state.view, state, filtered.map(r => r.id)) : '';
  if (isStale()) return null;
  return { view, TL, T, tname, cols, model, few, roster, shown: ordered.map(id => byRow.get(id)), firstW: TM.firstColWidth(widthsOf([...rows.map(r => r.name), 'League average']), TL.firstCol), sel, cur, byValue, pool: poolSet, range, avg: leagueCells(view, cols.map(c => c.metric)), gallery, byId };
}
