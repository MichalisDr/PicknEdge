/* The one scale for every scatter of the Charts gallery: an axis fits the data range with a small padding (no forced zero), with 4 to 6 round ticks;
   equalScale gives both axes of x = y charts the same range; separate nudges logos that would overlap. Pure functions, no DOM. */

const STEPS = [1, 2, 5];   // x 10^n: Pace by 1 or 2, DRtg by 5, percentages by 2 or 5, TOV per 100 by 1 or 2

const ticksOf = (a, b, step) => { const out = []; for (let v = Math.ceil(a / step - 1e-9) * step; v <= b + 1e-9; v += step) out.push(+v.toFixed(10)); return out; };
const stepsFor = (lo, hi, max) => { const base = Math.pow(10, Math.floor(Math.log10((hi - lo || 1) / max)) - 1), out = []; for (let e = 0; e < 4; e++) for (const m of STEPS) out.push(m * base * Math.pow(10, e)); return out.sort((p, q) => p - q); };

/** Round ticks for [lo, hi]: the smallest step of 1 / 2 / 5 x 10^n that gives `min` to `max` ticks inside the range. When the steps skip over that band, the range is widened to the next multiples
    of the larger step (`widen`) so the axis still has enough ticks; without it the first step with at most `max` ticks is taken. Returns { ticks, step, lo, hi }. */
export function niceTicks(lo, hi, min = 5, max = 7, widen = true) {
  for (const step of stepsFor(lo, hi, max)) {
    const t = ticksOf(lo, hi, step);
    if (t.length > max) continue;
    if (t.length >= min || !widen) return { ticks: t, step, lo, hi };
    const wlo = Math.floor(lo / step + 1e-9) * step, whi = Math.ceil(hi / step - 1e-9) * step;
    return { ticks: ticksOf(wlo, whi, step), step, lo: wlo, hi: whi };
  }
  return { ticks: [lo, hi], step: hi - lo, lo, hi };
}

/** Axis for a list of values: domain = data range plus `pad` of the span on both sides (a little more when the ticks need it); the step is picked here, from the metric's own range.
    { lo, hi, ticks (opened card: 5-7), thumb (thumbnails: at most 4), digits }. */
export function axisScale(values, pad = .06) {
  const v = values.filter(Number.isFinite);
  if (!v.length) return { lo: 0, hi: 1, ticks: [0, 1], thumb: [0, 1], digits: 0 };
  const min = Math.min(...v), max = Math.max(...v), span = max - min, p = span ? span * pad : (Math.abs(max) * .1 || 1);
  const t = niceTicks(min - p, max + p), th = niceTicks(t.lo, t.hi, 3, 4, false);
  return { lo: t.lo, hi: t.hi, ticks: t.ticks, thumb: th.ticks, digits: Math.min(4, (String(+t.step.toPrecision(6)).split('.')[1] || '').length) };
}

/** One shared range for both axes (the x = y chart): the same domain and ticks for x and y, so the diagonal is exactly 45° on a square plot. */
export function equalScale(xs, ys) {
  const s = axisScale([...xs, ...ys]);
  return [s, s];
}

/** Move circles of radius r (min distance `gap` between centres) apart by the smallest push: overlapping pairs are separated along the line between them, half each,
    until none overlaps. points: [{ x, y }] → new [{ x, y }] in the same order (a point nothing touches does not move). */
export function separate(points, gap, iterations = 80) {
  const p = points.map(q => ({ x: q.x, y: q.y }));
  for (let it = 0; it < iterations; it++) {
    let moved = false;
    for (let i = 0; i < p.length; i++) for (let j = i + 1; j < p.length; j++) {
      let dx = p[j].x - p[i].x, dy = p[j].y - p[i].y, d = Math.hypot(dx, dy);
      if (d >= gap - 1e-6) continue;
      if (d < 1e-9) { dx = 1; dy = 0; d = 1; }   // exactly on top of each other: split sideways
      const push = (gap - d) / 2 + 1e-6, ux = dx / d, uy = dy / d;
      p[i].x -= ux * push; p[i].y -= uy * push; p[j].x += ux * push; p[j].y += uy * push; moved = true;
    }
    if (!moved) break;
  }
  return p;
}
