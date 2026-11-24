/* The move between two windows of one chart: a model halfway between the model of the window we leave and the one we arrive at. Pure functions, no DOM.
   The axes do not move (they are computed over all windows), so only the values do: a dot that is in both windows slides to its new position, the reference line turns with them.
   A dot that exists only in the new window appears at its final place, one that exists only in the old window is gone: there is no trail and no arrow. */

export const ease = t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);   // ease in-out (cubic)
const mix = (a, b, t) => a + (b - a) * t;

/** Two models of the same chart in different windows: the moved model at progress t (0 = from, 1 = to, eased by the caller). */
export function between(from, to, t) {
  if (t >= 1 || !from) return to;
  const was = new Map(from.pts.map(p => [p.id, p]));
  const pts = to.pts.map(p => { const q = was.get(p.id); return q ? { ...p, a: mix(q.a, p.a, t), b: mix(q.b, p.b, t) } : p; });
  const fit = from.fit && to.fit ? { ...to.fit, slope: mix(from.fit.slope, to.fit.slope, t), intercept: mix(from.fit.intercept, to.fit.intercept, t) } : to.fit;
  return { ...to, pts, fit };
}

/** Is a move wanted from what is on screen (`shown`: { win, model } or undefined) to this model? Only the charts that ask for it (model.move), only when the window really changed, never with reduced motion. */
export const wantsMove = (shown, model, reduced) => !!(model.move && shown && shown.win !== model.win && !reduced);
