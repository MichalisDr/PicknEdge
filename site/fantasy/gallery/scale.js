/* The one scale for every scatter of the Charts gallery: the axis ends at the next round tick beyond the data (no forced zero, no percentage margin), 6 to 8 ticks in the opened card;
   equalScale gives both axes of x = y charts the same range; separate nudges logos that would overlap. Pure functions, no DOM. */

const MANTISSAS = [1, 2, 2.5, 5];   // x 10^n (10 is 1 x 10^(n+1)): Pace by 1 or 2, DRtg by 5, TOV per 100 by 1 or 2, percentages by 2, 2.5 or 5
const clean = v => +v.toFixed(10);

/** Every round step (1, 2, 2.5, 5 x 10^n) from fine to coarse that could suit a range of this size. */
const stepsFor = span => { const base = Math.pow(10, Math.floor(Math.log10((span || 1) / 12))), out = []; for (let e = 0; e < 3; e++) for (const m of MANTISSAS) out.push(clean(m * base * Math.pow(10, e))); return out; };

/** The edges for [min, max] at a step: the next multiple of the step BEYOND each extreme (an extreme that sits exactly on a multiple goes one more step). */
const edges = (min, max, step) => ({ step, lo: clean((Math.ceil(min / step - 1e-9) - 1) * step), hi: clean((Math.floor(max / step + 1e-9) + 1) * step) });

/** Axis for a list of values. The axis ends at the next round tick beyond the highest value and starts at the previous round tick before the lowest (one more step when an extreme sits exactly on a tick);
    nothing else adds margin, so every gap is smaller than one step. The step (1, 2, 2.5, 5 x 10^n) is picked here from the range: the one that gives 6 to 8 ticks (the smallest margin wins, then the coarser step);
    when none does, the step whose tick count is nearest to 7. Thumbnails keep the same range and every second tick (at most 4, round numbers).
    { lo, hi, ticks (opened card), thumb (thumbnails), step, digits }. */
export function axisScale(values) {
  const v = values.filter(Number.isFinite);
  if (!v.length) return { lo: 0, hi: 1, ticks: [0, 1], thumb: [0, 1], step: 1, digits: 0 };
  const min = Math.min(...v), max = Math.max(...v);
  const opts = stepsFor(max - min || Math.abs(max) * .2 || 1).map(st => { const e = edges(min, max, st); return { ...e, n: Math.round((e.hi - e.lo) / st) + 1 }; });
  const inBand = opts.filter(o => o.n >= 6 && o.n <= 8);
  const pick = (inBand.length ? inBand : opts).sort((p, q) => (inBand.length ? 0 : Math.abs(p.n - 7) - Math.abs(q.n - 7)) || (p.hi - p.lo) - (q.hi - q.lo) || q.step - p.step)[0];
  const ticks = Array.from({ length: pick.n }, (_, i) => clean(pick.lo + i * pick.step));
  return { lo: pick.lo, hi: pick.hi, ticks, thumb: ticks.filter((_, i) => i % 2 === 0), step: pick.step, digits: Math.min(4, (String(+pick.step.toPrecision(6)).split('.')[1] || '').length) };
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

/** Resolve overlaps of logo boxes (the visible artwork, w x h px, centred on the point; `gap` px of air between two) by the SMALLEST nudge: a pair that overlaps in both directions is pushed
    apart along the direction where it overlaps less, half each. No logo ever ends further than `maxShift` px from its data point (the standard: at most half the logo size), so a pair that
    cannot be separated within that stays slightly overlapped. items: [{ x, y, w, h }] → new [{ x, y }] in the same order (a logo nothing touches does not move). */
export function separateBoxes(items, gap, maxShift, iterations = 120) {
  const p = items.map(q => ({ x: q.x, y: q.y }));
  const clamp = (q, o) => { const dx = q.x - o.x, dy = q.y - o.y, d = Math.hypot(dx, dy); if (d > maxShift) { q.x = o.x + dx / d * maxShift; q.y = o.y + dy / d * maxShift; } };
  for (let it = 0; it < iterations; it++) {
    let moved = false;
    for (let i = 0; i < p.length; i++) for (let j = i + 1; j < p.length; j++) {
      const dx = p[j].x - p[i].x, dy = p[j].y - p[i].y;
      const ox = (items[i].w + items[j].w) / 2 + gap - Math.abs(dx), oy = (items[i].h + items[j].h) / 2 + gap - Math.abs(dy);
      if (ox <= 1e-6 || oy <= 1e-6) continue;
      if (ox <= oy) { const s = (dx < 0 ? -1 : 1) * (ox / 2 + 1e-6); p[i].x -= s; p[j].x += s; } else { const s = (dy < 0 ? -1 : 1) * (oy / 2 + 1e-6); p[i].y -= s; p[j].y += s; }
      clamp(p[i], items[i]); clamp(p[j], items[j]); moved = true;
    }
    if (!moved) break;
  }
  return p;
}

/** How many pairs of logo boxes (x, y = centres from `points`, w x h from `items`) still cover each other. */
export function overlapPairs(points, items) {
  let n = 0;
  for (let i = 0; i < points.length; i++) for (let j = i + 1; j < points.length; j++) {
    if ((items[i].w + items[j].w) / 2 - Math.abs(points[j].x - points[i].x) > 1e-6 && (items[i].h + items[j].h) / 2 - Math.abs(points[j].y - points[i].y) > 1e-6) n++;
  }
  return n;
}
