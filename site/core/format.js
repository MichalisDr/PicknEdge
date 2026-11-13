/* Number formatting shared by the tables and cards. A cell is { value, used, of } from the views; m is the metric from metrics.json. */
export const fmt = (c, m, extra = '') => Number.isFinite(c?.value) ? c.value.toFixed(m.format.digits) + m.format.suffix + extra : '—';
export const fnum = (v, d = 1) => Number.isFinite(v) ? v.toFixed(d) : '—';
