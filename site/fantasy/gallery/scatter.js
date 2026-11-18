/* One comparative scatter chart: the entities of the current view as team logos (no backing), dashed lines for the league values from the view's league row.
   scatter() returns the card's chart block: a model in data-plot plus a first drawing; plot-wire.js redraws it at the real width (drawScatter) so that sizes and lettering are real pixels.
   Scale and logo separation live in scale.js. A logo is clickable (class fc-pt, data-open) and opens the card; hover / tap shows name and both values. */
import { esc } from '../../core/html.js';
import { size } from '../../core/sizes.js';
import { teamLogo } from '../../core/teams.js';
import { axisScale, equalScale, separate } from './scale.js';
import { favourable, quadrantTone, diagonalTone } from './tint.js';

const axisTitle = m => m.label + (m.format.suffix && !m.label.includes(m.format.suffix.trim()) ? ` (${m.format.suffix.trim()})` : '');
const fmt = (m, v) => v.toFixed(m.format.digits) + m.format.suffix;

/** Values of one metric over every entity of every window view: the axis range of a chart is computed from these, once, so it does not move when the window or a filter changes. */
const allValues = (views, id) => views.flatMap(v => v.keys.map(k => v.get(k, id)?.value)).filter(Number.isFinite);

/** The axes of a chart: [x, y] scales from the min and max over all windows (the x = y chart: one shared range from the union of both metrics). */
export function chartScales(chart, views) {
  const xs = allValues(views, chart.x), ys = allValues(views, chart.y);
  return chart.equal ? equalScale(xs, ys) : [axisScale(xs), axisScale(ys)];
}

/** views = the view of every window (Season, Last 10 / 5 / 3); `view` is the one shown. */
export function scatter(chart, view, ids, byId, roster, views = [view]) {
  const mx = byId[chart.x], my = byId[chart.y], pts = [];
  for (const id of ids) {
    const a = view.get(id, chart.x)?.value, b = view.get(id, chart.y)?.value;
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
    const name = chart.entity === 'teams' ? roster.teams[id] || id : roster.players[id]?.name || id;
    pts.push({ id, a, b, name, logo: chart.entity === 'teams' ? teamLogo(roster, id) || '' : '', tip: `${name} · ${mx.label} ${fmt(mx, a)} · ${my.label} ${fmt(my, b)}` });
  }
  if (pts.length < 2) return '<p class="fw-empty">Not enough data for this chart.</p>';
  const [sx, sy] = chartScales(chart, views);
  const lx = chart.noAvg ? null : view.league(chart.x)?.value, ly = chart.noAvg ? null : view.league(chart.y)?.value;
  const fav = { x: favourable(mx.direction), y: favourable(my.direction) };
  const model = { fav, title: chart.title, xTitle: axisTitle(mx), yTitle: axisTitle(my), equal: !!chart.equal, sx, sy, avg: Number.isFinite(lx) && Number.isFinite(ly) ? { x: lx, y: ly } : null, pts };
  return `<div class="fc-plot" data-plot="${esc(JSON.stringify(model))}"><div class="fc-canvas">${drawScatter(model, size('fantasy.charts-gallery.plot.plot-width'), false, 'thumb')}</div><div class="fc-tip fw-bar-tip" role="status" hidden></div></div>`;
}

/** The svg of a model at a pixel width (1 svg unit = 1 css px, so lettering and logos are real sizes); `narrow` = phone sizes.
    mode 'thumb' (gallery thumbnail): plain dots, no labels, few ticks; 'full' (opened card): team logos, 5-7 ticks. maxH caps the height of a large chart. */
export function drawScatter(model, W, narrow, mode = 'thumb', maxH = Infinity) {
  const full = mode === 'full';
  const L = size('fantasy.charts-gallery.plot.margin-left'), R = size('fantasy.charts-gallery.plot.margin-right'), Tp = size('fantasy.charts-gallery.plot.margin-top'), B = size('fantasy.charts-gallery.plot.margin-bottom');
  const H = Math.round(Math.min(W * size('fantasy.charts-gallery.plot.aspect'), maxH)), logo = size(narrow ? 'fantasy.charts-gallery.plot.logo-size-narrow' : 'fantasy.charts-gallery.plot.logo-size');
  const iw = W - L - R, ih = H - Tp - B, side = model.equal ? Math.min(iw, ih) : null;   // the x = y chart has a square plot area: same range on both axes = exactly 45°
  const x0 = side ? L + (iw - side) / 2 : L, x1 = side ? x0 + side : W - R, y1 = H - B, y0 = side ? y1 - side : Tp;
  const { sx, sy } = model, X = v => x0 + (v - sx.lo) / (sx.hi - sx.lo) * (x1 - x0), Y = v => y1 - (v - sy.lo) / (sy.hi - sy.lo) * (y1 - y0), f = v => +v.toFixed(1);
  const tx = full ? sx.ticks : sx.thumb, ty = full ? sy.ticks : sy.thumb;
  const grid = tx.map(v => `<line class="fc-grid" x1="${f(X(v))}" x2="${f(X(v))}" y1="${f(y0)}" y2="${f(y1)}"/><text class="fc-tick" x="${f(X(v))}" y="${f(y1 + 18)}" text-anchor="middle">${v.toFixed(sx.digits)}</text>`).join('')
    + ty.map(v => `<line class="fc-grid" x1="${f(x0)}" x2="${f(x1)}" y1="${f(Y(v))}" y2="${f(Y(v))}"/><text class="fc-tick" x="${f(x0 - 8)}" y="${f(Y(v) + 4)}" text-anchor="end">${v.toFixed(sy.digits)}</text>`).join('');
  const rect = (xa, xb, ya, yb, tone) => (tone ? `<rect class="fc-q ${tone}" x="${f(xa)}" y="${f(ya)}" width="${f(xb - xa)}" height="${f(yb - ya)}"/>` : '');
  let tint = '';
  if (model.avg) {   // the dashed league lines split the plot into four quadrants
    const ax = Math.min(x1, Math.max(x0, X(model.avg.x))), ay = Math.min(y1, Math.max(y0, Y(model.avg.y)));
    tint = rect(x0, ax, y0, ay, quadrantTone(model.fav, false, true)) + rect(ax, x1, y0, ay, quadrantTone(model.fav, true, true)) + rect(x0, ax, ay, y1, quadrantTone(model.fav, false, false)) + rect(ax, x1, ay, y1, quadrantTone(model.fav, true, false));
  } else if (model.equal) {   // the diagonal splits two halves: above it the opponent shoots better than expected
    const poly = (pts, tone) => (tone ? `<polygon class="fc-q ${tone}" points="${pts.map(q => q.map(f).join(',')).join(' ')}"/>` : '');
    tint = poly([[x0, y1], [x0, y0], [x1, y0]], diagonalTone(model.fav, true)) + poly([[x0, y1], [x1, y1], [x1, y0]], diagonalTone(model.fav, false));
  }
  const avg = model.avg ? `<line class="fc-avg" x1="${f(X(model.avg.x))}" x2="${f(X(model.avg.x))}" y1="${f(y0)}" y2="${f(y1)}"/><line class="fc-avg" x1="${f(x0)}" x2="${f(x1)}" y1="${f(Y(model.avg.y))}" y2="${f(Y(model.avg.y))}"/>` : '';
  const diag = model.equal ? `<line class="fc-diag" x1="${f(X(sx.lo))}" y1="${f(Y(sx.lo))}" x2="${f(X(sx.hi))}" y2="${f(Y(sx.hi))}"/>` : '';
  const dotR = size('fantasy.charts-gallery.plot.dot-radius'), at = full ? separate(model.pts.map(p => ({ x: X(p.a), y: Y(p.b) })), logo + 2) : model.pts.map(p => ({ x: X(p.a), y: Y(p.b) }));   // logos are centred on the data point, nothing around them; +2 px air between two
  const r = logo / 2;
  const dots = model.pts.map((p, i) => {
    const body = full && p.logo ? `<circle class="fc-hit" r="${r}"/><image href="${esc(p.logo)}" x="${f(-r)}" y="${f(-r)}" width="${logo}" height="${logo}" preserveAspectRatio="xMidYMid meet"/>`
      : `<circle class="fc-hit" r="${dotR + 5}"/><circle class="fc-dot" r="${dotR}"/>${full ? `<text class="fc-pl" x="8" y="4">${esc(p.id)}</text>` : ''}`;
    return `<g class="fc-pt" data-open="${esc(p.id)}" data-x="${f(at[i].x)}" data-y="${f(at[i].y - (full && p.logo ? r : dotR))}" data-tip="${esc(p.tip)}" tabindex="0" role="img" aria-label="${esc(p.tip)}" transform="translate(${f(at[i].x)} ${f(at[i].y)})">${body}</g>`;
  }).join('');
  return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" class="fc-svg" role="group" aria-label="${esc(model.title)}">${tint}${grid}${avg}${diag}<line class="fc-axis" x1="${f(x0)}" x2="${f(x1)}" y1="${f(y1)}" y2="${f(y1)}"/><line class="fc-axis" x1="${f(x0)}" x2="${f(x0)}" y1="${f(y0)}" y2="${f(y1)}"/>`
    + `<text class="fc-ax" x="${f((x0 + x1) / 2)}" y="${f(y1 + B - 8)}" text-anchor="middle">${esc(model.xTitle)}</text><text class="fc-ax" transform="translate(${f(x0 - L + 16)} ${f((y0 + y1) / 2)}) rotate(-90)" text-anchor="middle">${esc(model.yTitle)}</text>${dots}</svg>`;
}
