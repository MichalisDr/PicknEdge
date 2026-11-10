/* Pure helpers of the Fantasy tables (ranks, quarters, sorting, combined rank, first-column width). No DOM; values come from the views.
   Direction: 1 = higher is better, -1 = lower is better, 0 = neutral (ordered high to low, nothing is "better"). */
(function (g) {
  'use strict';
  const EPS = 1e-9;
  const sign = dir => dir === -1 ? -1 : 1;
  const finite = list => list.filter(Number.isFinite);

  /** Rank of a value among the finite values of `list` (the rank pool): position from the top (1 = best) and from the bottom. */
  function rankOf(list, value, dir) {
    const l = finite(list);
    if (!Number.isFinite(value) || !l.length) return null;
    const s = sign(dir);
    return { position: 1 + l.filter(v => s * v > s * value + EPS).length, fromBottom: 1 + l.filter(v => s * v < s * value - EPS).length, n: l.length };
  }
  /** 'top' / 'bottom' when the rank lies in the best / worst quarter of the pool, else null. */
  function quarter(r) {
    if (!r) return null;
    const k = Math.ceil(r.n / 4);
    return r.position <= k ? 'top' : r.fromBottom <= k ? 'bottom' : null;
  }
  /** Direction-aware percentile 0..1 of a value in the pool (share of the other values it beats, ties count half). */
  function percentile(list, value, dir) {
    const l = finite(list);
    if (!Number.isFinite(value) || !l.length) return null;
    if (l.length === 1) return 0.5;
    const s = sign(dir), worse = l.filter(v => s * v < s * value - EPS).length, equal = l.filter(v => Math.abs(v - value) <= EPS).length;
    return (worse + (equal - 1) / 2) / (l.length - 1);
  }
  /** Sort order of a header click: best end first (descending when higher is better or neutral, ascending when lower is better). */
  const firstDirection = dir => dir === -1 ? 'asc' : 'desc';
  /** Row ids ordered by one value each: missing values last whatever the direction; ties keep the incoming order. */
  function order(ids, valueOf, direction) {
    const k = direction === 'asc' ? 1 : -1;
    return ids.map((id, i) => ({ id, i, v: valueOf(id) })).sort((a, b) => {
      const x = Number.isFinite(a.v), y = Number.isFinite(b.v);
      return !x || !y ? (x ? -1 : y ? 1 : a.i - b.i) : (a.v - b.v) * k || a.i - b.i;
    }).map(o => o.id);
  }
  /** Combined rank: mean direction-aware percentile over the selected columns (missing values skipped). cols: [{ dir, values: Map(id -> value) }]; pool: ids of the rank pool. */
  function combined(ids, cols, pool) {
    const lists = cols.map(c => pool.map(id => c.values.get(id)));
    return new Map(ids.map(id => {
      const ps = cols.map((c, j) => percentile(lists[j], c.values.get(id), c.dir)).filter(Number.isFinite);
      return [id, ps.length ? ps.reduce((a, b) => a + b, 0) / ps.length : null];
    }));
  }
  /** Width of the first column: the widest displayed name (measured text widths in px) plus padding, within [min, cap]. */
  const firstColWidth = (textWidths, f) => Math.min(f.cap, Math.max(f.min, Math.ceil(Math.max(0, ...textWidths)) + f.pad));
  /** Text of the rank-pool note. */
  const poolLabel = (name, n) => `${name} (${n})`;
  /** Total width of a table: first column, optional team column, numeric columns (all numWidth). */
  const tableWidth = (T, name, first) => first + (T.tables[name].teamColumn ? T.teamWidth : 0) + T.tables[name].groups.flat().length * T.numWidth;

  const api = { rankOf, quarter, percentile, firstDirection, order, combined, firstColWidth, poolLabel, tableWidth, EPS };
  g.PicknEdgeTable = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
