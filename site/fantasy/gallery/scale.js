/* The one scale for every scatter of the Charts gallery: an axis fits the data range with a small padding (no forced zero), with 6 to 8 round ticks in the opened card;
   equalScale gives both axes of x = y charts the same range; separate nudges logos that would overlap. Pure functions, no DOM. */

const STEPS = [1, 2, 5];   // x 10^n: Pace by 1 or 2, DRtg by 5, percentages by 2 or 5, TOV per 100 by 1 or 2

const ticksOf = (a, b, step) => { const out = []; for (let v = Math.ceil(a / step - 1e-9) * step; v <= b + 1e-9; v += step) out.push(+v.toFixed(10)); return out; };
const stepsFor = (lo, hi, max) => { const base = Math.pow(10, Math.floor(Math.log10((hi - lo || 1) / max)) - 1), out = []; for (let e = 0; e < 4; e++) for (const m of STEPS) out.push(m * base * Math.pow(10, e)); return out.sort((p, q) => p - q); };

/** Round ticks for [lo, hi]. widen (default): the smallest step of 1 / 2 / 5 x 10^n for which the range, rounded OUTWARD to multiples of the step, holds as many ticks as possible up to `max` (normally `min` or more; rounding outward can leave a range 1 tick short of `min`); the axis then
    starts and ends on a tick. Without widen: the first step with at most `max` ticks inside [lo, hi] as it is. Returns { ticks, step, lo, hi }. */
export function niceTicks(lo, hi, min = 6, max = 8, widen = true) {
  const steps = stepsFor(lo, hi, max);
  if (!widen) { const step = steps.find(st => ticksOf(lo, hi, st).length <= max) || hi - lo; return { ticks: ticksOf(lo, hi, step), step, lo, hi }; }
  let pick = null;
  for (const step of steps) {
    const wlo = Math.floor(lo / step + 1e-9) * step, whi = Math.ceil(hi / step - 1e-9) * step, n = Math.round((whi - wlo) / step) + 1;
    if (n > max) continue;
    pick = { step, wlo, whi };   // the smallest step that fits: the most ticks within max
    break;
  }
  if (!pick) return { ticks: [lo, hi], step: hi - lo, lo, hi };
  return { ticks: ticksOf(pick.wlo, pick.whi, pick.step), step: pick.step, lo: pick.wlo, hi: pick.whi };
}

/** Axis for a list of values: the data range is extended by `pad` (4.5%) of its span on both sides, then rounded outward to the next tick of a FINE step (1 / 2 / 5 x 10^n, picked here from the range),
    so the highest and lowest value never sit on the edge but the empty margin stays small. The step is the coarsest one that gives 6 to 8 ticks with at most `room` (10%) of empty axis on each side;
    if none does, up to 10 ticks are allowed, and then the step with the smallest empty margin wins. It never goes to a coarser step just to land on round numbers.
    { lo, hi, ticks (opened card), thumb (thumbnails: at most 4), digits }. */
export function axisScale(values, pad = .045, room = .10) {
  const v = values.filter(Number.isFinite);
  if (!v.length) return { lo: 0, hi: 1, ticks: [0, 1], thumb: [0, 1], digits: 0 };
  const min = Math.min(...v), max = Math.max(...v), span = max - min, p = span ? span * pad : (Math.abs(max) * .1 || 1);
  const opts = stepsFor(min - p, max + p, 10).map(step => {
    const lo = Math.floor((min - p) / step + 1e-9) * step, hi = Math.ceil((max + p) / step - 1e-9) * step;
    return { step, lo, hi, n: Math.round((hi - lo) / step) + 1, gap: Math.max(min - lo, hi - max) / (hi - lo) };
  }).filter(o => o.n >= 4 && o.n <= 10).sort((x, y) => y.step - x.step);   // coarsest first
  const tight = o => o.gap <= room + 1e-9;
  const pick = opts.find(o => o.n >= 6 && o.n <= 8 && tight(o)) || opts.find(o => o.n >= 6 && tight(o))
    || opts.filter(o => o.n >= 6).sort((x, y) => x.gap - y.gap)[0] || opts[opts.length - 1] || niceTicks(min - p, max + p);
  const ticks = pick.ticks || ticksOf(pick.lo, pick.hi, pick.step), th = niceTicks(pick.lo, pick.hi, 3, 4, false);
  return { lo: pick.lo, hi: pick.hi, ticks, thumb: th.ticks, digits: Math.min(4, (String(+pick.step.toPrecision(6)).split('.')[1] || '').length) };
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
