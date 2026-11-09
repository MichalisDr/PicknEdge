// Generic evaluation of registry metrics over any set of clean rows (a season, the last N games, a custom window).
// Ratios are always Σnumerator / Σdenominator over the window, never an average of per-game ratios.
// Custom metrics receive only the window's summed components.
import { METRICS, DERIVED } from './registry.mjs';

const MULT = { per100: 100, pct: 100, perGame: 1, perMin: 60, ratio: 1, count: 1 };
export const byId = id => { const m = METRICS.find(m => m.id === id); if (!m) throw new Error(`unknown metric ${id}`); return m; };

/** Value of a term list on one row; null if any needed component is empty. */
export function termValue(terms, row) {
  let sum = 0;
  for (const [coef, name] of terms) {
    const v = name in DERIVED ? termValue(DERIVED[name], row) : row[name];
    if (v === null || v === undefined || v === '') return null;
    sum += coef * Number(v);
  }
  return sum;
}

const denOf = m => m.kind === 'perMin' ? [[1, 'sec']] : m.den;

/** A player row counts only if the player played; team and position rows always count. */
const considered = (m, rows) => m.scope === 'player' ? rows.filter(r => Number(r.played) === 1) : rows;

/** Evaluate every metric of a scope over a set of rows: plain metrics first, then the metrics that need the league benchmark (bench = the league's values of the plain ones). */
export function evaluateAll(metrics, rows, benchRows = rows, benchOverride = null) {
  const plain = metrics.filter(m => !m.bench), out = {};
  const bench = benchOverride || Object.fromEntries(metrics.map(m => [m.id, evaluate(m, benchRows).value]).filter(([, v]) => v !== null));
  for (const m of plain) out[m.id] = evaluate(m, rows);
  for (const m of metrics.filter(m => m.bench)) out[m.id] = evaluate(m, rows, bench);
  return out;
}

/** {value, used, of}: value over the rows where every component exists; `used` of `of` games had the data.
 *  A metric with `bench: [metric ids]` (a custom metric compared with the league) needs `bench` = {metric id: league value}; without it the value is null. */
export function evaluate(m, rows, bench = null) {
  const list = considered(m, rows);
  if (m.kind === 'custom') {
    const sums = Object.fromEntries(m.needs.map(n => [n, 0]));
    let used = 0;
    for (const r of list) {
      const vals = m.needs.map(n => termValue([[1, n]], r));
      if (vals.some(v => v === null)) continue;
      m.needs.forEach((n, i) => { sums[n] += vals[i]; });
      used++;
    }
    if (m.bench && !(bench && m.bench.every(id => Number.isFinite(bench[id])))) return { value: null, used, of: list.length };
    return { value: used ? m.fn(sums, bench) : null, used, of: list.length };
  }
  let N = 0, D = 0, used = 0;
  for (const r of list) {
    const n = termValue(m.num, r), d = m.kind === 'count' ? 1 : termValue(denOf(m), r);
    if (n === null || d === null) continue;
    N += n; D += d; used++;
  }
  const value = m.kind === 'count' ? N : D > 0 ? (m.mult ?? MULT[m.kind]) * N / D : null;
  return { value, used, of: list.length };
}

/** Value on a single row (used by the build audit). */
export const rowValue = (m, row) => evaluate(m, [row]).value;
