/* The one scale for every scatter of the Charts gallery. The STEP is a property of the metric (declared in axes.js); the data decides only the two ends (no forced zero, no percentage margin).
   equalScale gives both axes of x = y charts the same range; separate nudges logos that would overlap. Pure functions, no DOM. */

const clean = v => +v.toFixed(10);

/** Axis for a list of values and the rule of its metric ({ step, floor?, ceiling? }). The low end is the multiple of the step before the lowest value and the high end the multiple after the highest one;
    an extreme that sits exactly on a multiple goes one more step. The step never depends on the data. A real limit wins: an axis with a floor starts exactly there (lower only if a value is below it,
    then at the multiple at or below that value) and keeps a grid line at every step also in thumbnails; an axis never goes above its ceiling.
    { lo, hi, ticks (every step: the opened card), thumb (every second one: thumbnails, and the labels at narrow width), grid (with a floor), step, digits (from the step) }. */
export function axisScale(values, rule) {
  const { step, floor, ceiling = Infinity } = rule || {};
  if (!(step > 0)) throw new Error('an axis needs the declared step of its metric (axes.js)');
  const v = values.filter(Number.isFinite), min = v.length ? Math.min(...v) : floor ?? 0, max = v.length ? Math.max(...v) : min;
  const lo = clean(floor === undefined ? (Math.ceil(min / step - 1e-9) - 1) * step : Math.min(floor, Math.floor(min / step + 1e-9) * step));
  const hi = clean(Math.min(ceiling, Math.max(lo + step, (Math.floor(max / step + 1e-9) + 1) * step)));
  const ticks = Array.from({ length: Math.round((hi - lo) / step) + 1 }, (_, i) => clean(lo + i * step));
  return { lo, hi, ticks, thumb: ticks.filter((_, i) => i % 2 === 0), ...(floor === undefined ? {} : { grid: ticks }), step, digits: Math.min(4, (String(+step.toPrecision(6)).split('.')[1] || '').length) };
}

/** One shared range for both axes (the x = y chart): the same domain and ticks for x and y, from both metrics, so the diagonal is exactly 45° on a square plot. */
export function equalScale(xs, ys, rule) {
  const s = axisScale([...xs, ...ys], rule);
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
