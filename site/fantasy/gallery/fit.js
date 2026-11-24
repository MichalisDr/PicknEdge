/* The reference line of a "performance vs price" chart: the least-squares line of y on x over the points drawn, and the two zones it cuts the plot into.
   Pure functions, no DOM, no data files. Everything is in data units; the caller maps to pixels.
   A point is { x, y }; a box is { x0, x1, y0, y1 } with x0 < x1 and y0 < y1 (the plot area in data units). */

/** Least-squares line y = slope * x + intercept through the points, or null when it is not defined (fewer than 2 finite points, or every x the same). { slope, intercept, n } */
export function fitLine(points) {
  const p = points.filter(q => Number.isFinite(q.x) && Number.isFinite(q.y)), n = p.length;
  if (n < 2) return null;
  const mx = p.reduce((s, q) => s + q.x, 0) / n, my = p.reduce((s, q) => s + q.y, 0) / n;   // centred sums: stable for large offsets
  let sxx = 0, sxy = 0;
  for (const q of p) { sxx += (q.x - mx) ** 2; sxy += (q.x - mx) * (q.y - my); }
  if (sxx <= 1e-12 * n * Math.max(1, mx * mx)) return null;   // all the same x: no slope
  const slope = sxy / sxx;
  return { slope, intercept: my - slope * mx, n };
}

/** The line at x. */
export const lineAt = (line, x) => line.slope * x + line.intercept;

/** The part of the line that lies inside the box, as two points [[x, y], [x, y]], or null when the line does not cross it. */
export function lineSegment(line, box) {
  const { x0, x1, y0, y1 } = box, { slope: m, intercept: c } = line;
  let a = x0, b = x1;
  if (Math.abs(m) < 1e-12) { if (c < y0 || c > y1) return null; } else {
    const ta = (y0 - c) / m, tb = (y1 - c) / m;   // x where the line meets the bottom and the top edge
    a = Math.max(a, Math.min(ta, tb)); b = Math.min(b, Math.max(ta, tb));
  }
  if (!(a < b)) return null;
  return [[a, lineAt(line, a)], [b, lineAt(line, b)]];
}

/** Sutherland-Hodgman against one half-plane: keeps the part of the polygon where side * (y - line(x)) >= 0 (side +1 = above the line, -1 = below). */
function clip(poly, line, side) {
  const g = q => side * (q[1] - lineAt(line, q[0])), out = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length], gp = g(p), gq = g(q);
    if (gp >= 0) out.push(p);
    if ((gp >= 0) !== (gq >= 0)) { const t = gp / (gp - gq); out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]); }
  }
  return out;
}

/** Signed area (shoelace) of a polygon of [x, y]. */
export const area = poly => Math.abs(poly.reduce((s, p, i) => { const q = poly[(i + 1) % poly.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2;

/** The two zones of the box on either side of the line, as polygons clipped to the box: { above, below } (each a list of [x, y], or null when that side has no area inside the box).
    Nothing ever lies outside the box, so a tint drawn from these cannot spill past the plot. */
export function zones(line, box) {
  const { x0, x1, y0, y1 } = box, rect = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], whole = area(rect);
  const side = s => { const poly = clip(rect, line, s).filter((p, i, all) => i === 0 || Math.hypot(p[0] - all[i - 1][0], p[1] - all[i - 1][1]) > 1e-12); return poly.length >= 3 && area(poly) > 1e-9 * whole ? poly : null; };
  return { above: side(1), below: side(-1) };
}
