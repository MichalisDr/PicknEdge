/* One comparative scatter chart: the entities of the current view as team logos (no backing), dashed lines for the league values from the view's league row.
   scatter() returns the card's chart block: a model in data-plot plus a first drawing; plot-wire.js redraws it at the real width (drawScatter) so that sizes and lettering are real pixels.
   Scale and logo separation live in scale.js. A logo is clickable (class fc-pt, data-open) and opens the card; hover / tap shows name and both values. */
import { esc } from '../../core/html.js';
import { size } from '../../core/sizes.js';
import { teamLogo } from '../../core/teams.js';
import { axisScale, equalScale, separateBoxes, overlapPairs } from './scale.js';
import { logoFit, logoBox } from './logo-fit.js';
import { favourable, quadrantTone, diagonalTone } from './tint.js';
import { axisMeta, axisValue } from './axes.js';
import { fitLine, lineSegment, zones } from './fit.js';

const axisTitle = m => m.label + (m.format.suffix && !m.label.includes(m.format.suffix.trim()) ? ` (${m.format.suffix.trim()})` : '');
const fmt = (m, v) => v.toFixed(m.format.digits) + m.format.suffix;

/** Values of one metric over every entity of every window view: the axis range of a chart is computed from these, once, so it does not move when the window or a filter changes. */
const allValues = (views, id) => views.flatMap(v => v.keys.map(k => axisValue(v, k, id))).filter(Number.isFinite);

/** The axes of a chart: [x, y] scales from the min and max over all windows (the x = y chart: one shared range from the union of both metrics). */
export function chartScales(chart, views) {
  const xs = allValues(views, chart.x), ys = allValues(views, chart.y);
  return chart.equal ? equalScale(xs, ys) : [axisScale(xs), axisScale(ys)];
}

/** views = the view of every window (Season, Last 10 / 5 / 3); `view` is the one shown. */
export function scatter(chart, view, ids, byId, roster, views = [view]) {
  const mx = axisMeta(chart.x, byId), my = axisMeta(chart.y, byId), pts = [];
  for (const id of ids) {
    const a = axisValue(view, id, chart.x), b = axisValue(view, id, chart.y);
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
    const name = chart.entity === 'teams' ? roster.teams[id] || id : roster.players[id]?.name || id;
    pts.push({ id, a, b, name, logo: (chart.entity === 'teams' ? teamLogo(roster, id) : teamLogo(roster, view.row(id)?.team)) || '', tip: `${name} · ${mx.label} ${fmt(mx, a)} · ${my.label} ${fmt(my, b)}` });
  }
  if (pts.length < 2) return '<p class="fw-empty">Not enough data for this chart.</p>';
  const [sx, sy] = chartScales(chart, views);
  const lx = chart.noAvg ? null : view.league(chart.x)?.value, ly = chart.noAvg ? null : view.league(chart.y)?.value;
  const fav = { x: favourable(mx.direction), y: favourable(my.direction) };
  const model = { fav, title: chart.title, xTitle: axisTitle(mx), yTitle: axisTitle(my), equal: !!chart.equal, sx, sy, avg: Number.isFinite(lx) && Number.isFinite(ly) ? { x: lx, y: ly } : null, pts };
  if (chart.entity === 'players') model.noLabel = true;   // a player without a logo is a plain dot (his id is no label)
  if (chart.fit) Object.assign(model, { fit: fitLine(pts.map(p => ({ x: p.a, y: p.b }))), zoneLabels: chart.zones });   // the line of typical y at that x, over the points drawn
  if (chart.move) Object.assign(model, { move: true, win: view.window });   // plot-wire.js slides the dots when the window changes
  if (chart.fit || chart.move) model.key = chart.id;
  return `<div class="fc-plot" data-plot="${esc(JSON.stringify(model))}"><div class="fc-canvas">${drawScatter(model, size('fantasy.charts-gallery.plot.plot-width'), false, 'thumb')}</div><div class="fc-tip fw-bar-tip" role="status" hidden></div></div>`;
}

/** Height of the opened card's plot when the container is narrow (it follows the content, not a fixed height): width x aspect; an x = y chart is exactly as tall as its square plot area, so no empty band sits above it. */
export function narrowHeight(model, W) {
  const P = k => size('fantasy.charts-gallery.plot.' + k);
  return model.equal ? W - P('margin-left-narrow') - P('margin-right-narrow') + P('margin-top') + P('margin-bottom') : Math.round(W * P('aspect-narrow'));
}

/** The svg of a model at a pixel width (1 svg unit = 1 css px, so lettering and logos are real sizes); `narrow` = phone sizes.
    mode 'thumb' (gallery thumbnail): plain dots, no labels, every second tick; 'full' (opened card): team logos, 6-8 ticks. H = the height to fill (default: width x aspect). */
export function drawScatter(model, W, narrow, mode = 'thumb', H = Math.round(W * size('fantasy.charts-gallery.plot.' + (narrow && mode === 'full' ? 'aspect-narrow' : 'aspect')))) {
  const full = mode === 'full', P = k => size('fantasy.charts-gallery.plot.' + k);
  const L = P(narrow ? 'margin-left-narrow' : 'margin-left'), R = P(narrow ? 'margin-right-narrow' : 'margin-right'), Tp = P('margin-top'), B = P('margin-bottom');
  const iw = W - L - R, ih = H - Tp - B, side = model.equal ? Math.min(iw, ih) : null;   // the x = y chart has a square plot area: same range on both axes = exactly 45°
  const x0 = side ? L + (iw - side) / 2 : L, x1 = side ? x0 + side : W - R, y1 = H - B, y0 = side ? y1 - side : Tp;
  const { sx, sy } = model, X = v => x0 + (v - sx.lo) / (sx.hi - sx.lo) * (x1 - x0), Y = v => y1 - (v - sy.lo) / (sy.hi - sy.lo) * (y1 - y0), f = v => +v.toFixed(1);
  const tx = full ? sx.ticks : sx.thumb, ty = full ? sy.ticks : sy.thumb;
  const grid = tx.map(v => `<line class="fc-grid" x1="${f(X(v))}" x2="${f(X(v))}" y1="${f(y0)}" y2="${f(y1)}"/><text class="fc-tick" x="${f(X(v))}" y="${f(y1 + P('tick-offset-y'))}" text-anchor="middle">${v.toFixed(sx.digits)}</text>`).join('')
    + ty.map(v => `<line class="fc-grid" x1="${f(x0)}" x2="${f(x1)}" y1="${f(Y(v))}" y2="${f(Y(v))}"/><text class="fc-tick" x="${f(x0 - P('tick-offset-x'))}" y="${f(Y(v) + P('tick-baseline'))}" text-anchor="end">${v.toFixed(sy.digits)}</text>`).join('');
  const rect = (xa, xb, ya, yb, tone) => (tone ? `<rect class="fc-q ${tone}" x="${f(xa)}" y="${f(ya)}" width="${f(xb - xa)}" height="${f(yb - ya)}"/>` : '');
  let tint = '';
  if (model.avg) {   // the dashed league lines split the plot into four quadrants
    const ax = Math.min(x1, Math.max(x0, X(model.avg.x))), ay = Math.min(y1, Math.max(y0, Y(model.avg.y)));
    tint = rect(x0, ax, y0, ay, quadrantTone(model.fav, false, true)) + rect(ax, x1, y0, ay, quadrantTone(model.fav, true, true)) + rect(x0, ax, ay, y1, quadrantTone(model.fav, false, false)) + rect(ax, x1, ay, y1, quadrantTone(model.fav, true, false));
  } else if (model.equal) {   // the diagonal splits two halves: above it the opponent shoots better than expected
    const poly = (pts, tone) => (tone ? `<polygon class="fc-q ${tone}" points="${pts.map(q => q.map(f).join(',')).join(' ')}"/>` : '');
    tint = poly([[x0, y1], [x0, y0], [x1, y0]], diagonalTone(model.fav, true)) + poly([[x0, y1], [x1, y1], [x1, y0]], diagonalTone(model.fav, false));
  }
  let line = '';
  if (model.fit && !side) {   // the reference line cuts the plot into two zones: above it good, below it bad; each zone is clipped to the plot area, so nothing spills past the axes
    const box = { x0: sx.lo, x1: sx.hi, y0: sy.lo, y1: sy.hi }, z = zones(model.fit, box), seg = lineSegment(model.fit, box), pad = P('zone-label-offset'), clear = P('zone-label-clear');
    const poly = (pts, tone) => (pts ? `<polygon class="fc-q ${tone}" points="${pts.map(q => f(X(q[0])) + ',' + f(Y(q[1]))).join(' ')}"/>` : '');
    const corner = (top, tone, text) => {   // the label sits in the plot corner (left or right) that is farthest from the line, only when that corner is clear of it
      const room = cx => (top ? 1 : -1) * (Y(model.fit.slope * (cx === x0 ? sx.lo : sx.hi) + model.fit.intercept) - (top ? y0 : y1)), [left, right] = [room(x0), room(x1)], atLeft = left >= right;
      if (!text || Math.max(left, right) < clear) return '';
      return `<text class="fc-zone ${tone}" x="${f(atLeft ? x0 + pad : x1 - pad)}" y="${f(top ? y0 + pad : y1 - pad)}" text-anchor="${atLeft ? 'start' : 'end'}" dominant-baseline="${top ? 'hanging' : 'auto'}">${esc(text)}</text>`;
    };
    tint = poly(z.above, 'good') + poly(z.below, 'bad');
    line = (seg ? `<line class="fc-fit" x1="${f(X(seg[0][0]))}" y1="${f(Y(seg[0][1]))}" x2="${f(X(seg[1][0]))}" y2="${f(Y(seg[1][1]))}"/>` : '') + (z.above ? corner(true, 'good', model.zoneLabels?.[0]) : '') + (z.below ? corner(false, 'bad', model.zoneLabels?.[1]) : '');
  }
  const avg = model.avg ? `<line class="fc-avg" x1="${f(X(model.avg.x))}" x2="${f(X(model.avg.x))}" y1="${f(y0)}" y2="${f(y1)}"/><line class="fc-avg" x1="${f(x0)}" x2="${f(x1)}" y1="${f(Y(model.avg.y))}" y2="${f(Y(model.avg.y))}"/>` : '';
  const diag = model.equal ? `<line class="fc-diag" x1="${f(X(sx.lo))}" y1="${f(Y(sx.lo))}" x2="${f(X(sx.hi))}" y2="${f(Y(sx.hi))}"/>` : '';
  const cell = Math.sqrt(Math.max(1, iw * ih) / model.pts.length);   // logo size follows density: the more points on the smaller plot, the smaller the logo, between a legible minimum and a maximum
  const lo = P(narrow ? 'logo-size-min-narrow' : 'logo-size-min'), hi = P(narrow ? 'logo-size-max-narrow' : 'logo-size-max'), step = P('logo-step'), floor = P('logo-size-floor');
  const start = Math.max(lo, Math.min(hi, Math.round(cell * P('logo-density') / step) * step));   // a multiple of the step (4), between the legible minimum and the maximum
  const dotR = P('dot-radius'), place = model.pts.map(p => ({ x: X(p.a), y: Y(p.b) }));
  // Logos: overlapping ones are nudged apart by the smallest push, never further than half a logo from their data point; when that cannot clear them, the logo goes one step (4px) smaller, down to the floor (16px).
  let logo = start, at = place;
  for (; full; logo -= step) {
    const boxes = model.pts.map((p, i) => ({ ...place[i], ...(p.logo ? logoBox(p.logo, logo) : { w: dotR * 2, h: dotR * 2 }) }));
    at = separateBoxes(boxes, P('logo-gap'), logo / 2);
    if (logo - step < floor || !overlapPairs(at, boxes)) break;
  }
  const r = logo / 2, fit = {};

  const dots = model.pts.map((p, i) => {
    const body = full && p.logo ? `<circle class="fc-hit" r="${r}"/><image href="${esc(p.logo)}" x="${f((fit[p.logo] ||= logoFit(p.logo, logo)).x)}" y="${f(fit[p.logo].y)}" width="${f(fit[p.logo].width)}" height="${f(fit[p.logo].height)}" preserveAspectRatio="xMidYMid meet"/>`
      : `<circle class="fc-hit" r="${dotR + P('hit-pad')}"/><circle class="fc-dot" r="${dotR}"/>${full && !model.noLabel ? `<text class="fc-pl" x="${P('label-offset-x')}" y="${P('tick-baseline')}">${esc(p.id)}</text>` : ''}`;
    return `<g class="fc-pt" data-open="${esc(p.id)}" data-x="${f(at[i].x)}" data-y="${f(at[i].y - (full && p.logo ? r : dotR))}" data-tip="${esc(p.tip)}" tabindex="0" role="img" aria-label="${esc(p.tip)}" transform="translate(${f(at[i].x)} ${f(at[i].y)})">${body}</g>`;
  }).join('');
  return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" class="fc-svg" role="group" aria-label="${esc(model.title)}">${tint}${grid}${avg}${diag}${line}<line class="fc-axis" x1="${f(x0)}" x2="${f(x1)}" y1="${f(y1)}" y2="${f(y1)}"/><line class="fc-axis" x1="${f(x0)}" x2="${f(x0)}" y1="${f(y0)}" y2="${f(y1)}"/>`
    + `<text class="fc-ax" x="${f((x0 + x1) / 2)}" y="${f(y1 + B - P('axis-title-bottom'))}" text-anchor="middle">${esc(model.xTitle)}</text><text class="fc-ax" transform="translate(${f(x0 - L + P('axis-title-left'))} ${f((y0 + y1) / 2)}) rotate(-90)" text-anchor="middle">${esc(model.yTitle)}</text>${dots}</svg>`;
}
