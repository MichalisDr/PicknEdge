/* A small line of the last values, drawn with currentColor only (its colour is the theme key of the element around it). Shared by the card header and the
   Players table; each passes the data-part (= theme / sizes key) of its own element, so the styles stay separate. Empty without at least two valid numbers. */
export const validSeries = values => Array.isArray(values) && values.length >= 2 && values.every(Number.isFinite);

export function sparklineSvg(values, part) {
  if (!validSeries(values)) return '';
  const lo = Math.min(...values), span = Math.max(...values) - lo || 1;
  const points = values.map((v, i) => `${(100 * i / (values.length - 1)).toFixed(1)},${(30 - 30 * (v - lo) / span).toFixed(1)}`).join(' ');
  return `<svg data-part="${part}" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true"><polyline points="${points}" fill="none" stroke="currentColor" vector-effect="non-scaling-stroke"/></svg>`;
}
