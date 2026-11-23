/* Quadrant colouring of the scatter charts. Which way is favourable for the OPPOSING player comes from the metric's own direction in metrics.json
   (direction = better for the team; the tables read teams from the player's side, so favourable = the opposite). No second list.
   fav: +1 high values favour the opposing player, -1 low values do, 0 no judgement (style metrics such as Pace). */
export const favourable = direction => (direction ? -Math.sign(direction) : 0);

/** Tone of the quadrant on the right / left (x) and top / bottom (y) of the league lines: 'good' (green) when favourable on both axes, 'bad' (red) when unfavourable on both,
    '' (no tint) when mixed. An axis without judgement is left out: the other axis decides alone; both without judgement = no tint. */
export function quadrantTone(fav, right, top) {
  const s = [fav.x ? fav.x * (right ? 1 : -1) : 0, fav.y ? fav.y * (top ? 1 : -1) : 0].filter(Boolean);
  if (!s.length) return '';
  return s.every(v => v > 0) ? 'good' : s.every(v => v < 0) ? 'bad' : '';
}

/** x = y chart: tone of the half above the diagonal (actual y above x, i.e. the opponent shoots better than expected, when high y is favourable). */
export const diagonalTone = (fav, above) => { const s = fav.y * (above ? 1 : -1); return s > 0 ? 'good' : s < 0 ? 'bad' : ''; };
