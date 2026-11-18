/* Places a team logo by its visible artwork: the artwork box (assets/logo-bounds.js, transparent margins removed) is fitted into a square of `box` px by its LARGER side, so wide, tall and round
   logos look equally big, and its centre sits on the data point. Returns the <image> geometry relative to the point: { x, y, width, height }. */
import { LOGO_BOUNDS } from '../../assets/logo-bounds.js';

export const logoId = path => String(path || '').split('/').pop().replace(/\.[a-z]+$/i, '');

export function logoFit(path, box) {
  const b = LOGO_BOUNDS[logoId(path)];
  if (!b) return { x: -box / 2, y: -box / 2, width: box, height: box };   // no metadata: the whole picture, fitted by the browser (preserveAspectRatio)
  const k = box / Math.max(b.bw, b.bh);
  return { x: -(b.x + b.bw / 2) * k, y: -(b.y + b.bh / 2) * k, width: b.w * k, height: b.h * k };
}
