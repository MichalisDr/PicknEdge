/* Iso-points curves of the volume vs efficiency chart. Pure functions, no DOM.
   PTS per 100 = 2 x TS (as a fraction) x SA per 100, so the dots that score P points per 100 lie on y = P / (2x) with y a fraction; the chart's y axis is TS in percent, so y% = 100 x P / (2x). */

/** TS% (percent) that gives `points` per 100 at `x` shot attempts per 100. */
export const isoTs = (points, x) => 100 * points / (2 * x);

/** The part of the curve of `points` inside the box { x0, x1, y0, y1 } (data units), as `steps + 1` points [x, y] from its upper-left end to its lower-right end; [] when it does not cross the box.
    The curve falls all the way, so the part inside is one piece. */
export function isoCurve(points, box, steps = 48) {
  const { x0, x1, y0, y1 } = box, atY = y => isoTs(points, y);   // the x where the curve is at height y (x = 100 x points / (2y))
  const a = Math.max(x0, y1 > 0 ? atY(y1) : x0), b = Math.min(x1, y0 > 0 ? atY(y0) : x1);
  if (!(a < b) || !(a > 0)) return [];
  return Array.from({ length: steps + 1 }, (_, i) => { const x = i === steps ? b : a + (b - a) * i / steps; return [x, isoTs(points, x)]; });
}
