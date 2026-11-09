// Generic evaluation of registry metrics over any set of clean rows (a season, the last N games, a custom window).
// Ratios are always Σnumerator / Σdenominator over the window, never an average of per-game ratios.
import { METRICS, DERIVED } from './registry.mjs';

const MULT = { per100: 100, pct: 100, perGame: 1, perMin: 60, count: 1 };
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

const denOf = m => m.kind === 'count' ? [[0, 'played']] : m.kind === 'perMin' ? [[1, 'sec']] : m.den;

/** A player row counts for a metric only if the player played; a team row always counts. */
const considered = (m, rows) => m.scope === 'player' ? rows.filter(r => Number(r.played) === 1) : rows;

/** {value, used, of}: value over the rows where every component exists; `used` of `of` games had the data. */
export function evaluate(m, rows) {
  const list = considered(m, rows);
  let N = 0, D = 0, used = 0;
  for (const r of list) {
    const n = termValue(m.num, r), d = termValue(denOf(m), r);
    if (n === null || d === null) continue;
    N += n; D += d; used++;
  }
  const value = m.kind === 'count' ? (used ? N : null) : D > 0 ? MULT[m.kind] * N / D : null;
  return { value, used, of: list.length };
}

/** Value on a single row (used by the build audit). */
export const rowValue = (m, row) => evaluate(m, [row]).value;
