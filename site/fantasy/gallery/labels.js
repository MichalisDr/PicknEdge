/* Text labels on the outliers of the price chart. Pure functions, no DOM.
   pickOutliers: which players get a label (display choice computed from the dots drawn, not a metric). placeLabels: where the labels go so that they never overlap each other (or anything in `blocked`)
   and never leave the plot; a label that cannot be placed is dropped, never squeezed. */

/** The `n` drawn points furthest ABOVE the line and the `n` furthest BELOW it, by vertical distance (y - line(x)). Fewer when fewer lie on a side. pts: [{ id, a, b }], line: { slope, intercept } or null.
    Returns [{ id, resid }] ordered from the furthest to the nearest of both sides together. */
export function pickOutliers(pts, line, n = 5) {
  if (!line) return [];
  const r = pts.map(p => ({ id: p.id, resid: p.b - (line.slope * p.a + line.intercept) })).filter(p => Number.isFinite(p.resid) && p.resid !== 0);
  const above = r.filter(p => p.resid > 0).sort((p, q) => q.resid - p.resid).slice(0, n), below = r.filter(p => p.resid < 0).sort((p, q) => p.resid - q.resid).slice(0, n);
  return [...above, ...below].sort((p, q) => Math.abs(q.resid) - Math.abs(p.resid));
}

/** The `n` drawn points furthest from a centre (the two league values) by STANDARDIZED distance: each axis measured in the standard deviation of the drawn points, so a percent and a rate count alike.
    An axis on which every point is the same adds nothing. Returns [{ id, dist }], furthest first. A display choice, not a metric. */
export function pickExtremes(pts, centre, n = 9) {
  if (!centre || !pts.length) return [];
  const sd = k => { const m = pts.reduce((s, p) => s + p[k], 0) / pts.length; return Math.sqrt(pts.reduce((s, p) => s + (p[k] - m) ** 2, 0) / pts.length); };
  const sa = sd('a'), sb = sd('b'), z = (v, c, s) => (s > 0 ? (v - c) / s : 0);
  return pts.map(p => ({ id: p.id, dist: Math.hypot(z(p.a, centre.x, sa), z(p.b, centre.y, sb)) })).filter(p => Number.isFinite(p.dist) && p.dist > 0).sort((p, q) => q.dist - p.dist).slice(0, n);
}

/** The surname shown on the chart: the last word of the name; a generational suffix (Jr, Sr, II, III, IV) is not a surname, so the word before it comes with it. */
export const surname = name => { const words = String(name).trim().split(/\s+/), n = words.length; return n > 2 && /^(jr|sr|ii|iii|iv)\.?$/i.test(words[n - 1]) ? words.slice(-2).join(' ') : words[n - 1]; };

const overlap = (a, b, gap) => a.x < b.x + b.w + gap && b.x < a.x + a.w + gap && a.y < b.y + b.h + gap && b.y < a.y + a.h + gap;

/** items: [{ id, x, y, r, w, h }] in priority order (the dot's centre and radius, the label's size). bounds: { x0, x1, y0, y1 }, the plot area. blocked: [{ x, y, w, h }] boxes that stay free.
    gap: air between two labels and between a label and its dot. Each label tries the sides of its dot in turn (right, left, above, below, the four diagonals); the first spot that is inside the plot and
    clear of everything placed so far wins. Returns [{ id, x, y, w, h }] (x, y = the top-left of the label box) for the labels that fit, in the same order. */
export function placeLabels(items, bounds, blocked = [], gap = 0) {
  const placed = [], out = [];
  for (const it of items) {
    const g = it.r + gap, { w, h } = it;
    const spots = [[g, -h / 2], [-g - w, -h / 2], [-w / 2, -g - h], [-w / 2, g], [g, -h], [g, 0], [-g - w, -h], [-g - w, 0]];
    for (const [dx, dy] of spots) {
      const box = { x: it.x + dx, y: it.y + dy, w, h };
      if (box.x < bounds.x0 || box.x + w > bounds.x1 || box.y < bounds.y0 || box.y + h > bounds.y1) continue;
      if (placed.some(p => overlap(box, p, gap)) || blocked.some(p => overlap(box, p, 0))) continue;
      placed.push(box); out.push({ id: it.id, ...box });
      break;
    }
  }
  return out;
}
