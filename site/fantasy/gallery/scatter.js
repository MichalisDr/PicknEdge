/* One comparative scatter chart: the entities of the current view as team logos (no backing), dashed lines for the league values from the view's league row.
   scatter() returns the card's chart block: a model in data-plot plus a first drawing; plot-wire.js redraws it at the real width (drawScatter) so that sizes and lettering are real pixels.
   Scale and logo separation live in scale.js. A logo is clickable (class fc-pt, data-open) and opens the card; hover / tap shows name and both values. */
import { esc } from '../../core/html.js';
import { size } from '../../core/sizes.js';
import { teamLogo, teamCode } from '../../core/teams.js';
import { teamColour } from '../../core/team-colour.js';
import { axisScale, equalScale, separateBoxes, overlapPairs } from './scale.js';
import { logoFit, logoBox } from './logo-fit.js';
import { favourable, quadrantTone, diagonalTone } from './tint.js';
import { axisMeta, axisValue, axisRule } from './axes.js';
import { fitLine, lineSegment, zones } from './fit.js';
import { pickOutliers, pickExtremes, placeLabels, surname } from './labels.js';
import { isoCurve, isoTs } from './curves.js';

const axisTitle = m => m.label + (m.format.suffix && !m.label.includes(m.format.suffix.trim()) ? ` (${m.format.suffix.trim()})` : '');
const fmt = (m, v) => v.toFixed(m.format.digits) + m.format.suffix;

/** Values of one metric over every entity of every window view: the axis range of a chart is computed from these, once, so it does not move when the window or a filter changes. */
const allValues = (views, id) => views.flatMap(v => v.keys.map(k => axisValue(v, k, id))).filter(Number.isFinite);

/** The axes of a chart: [x, y] scales, the ends from the min and max over all windows, the step from the metric (the x = y chart: one shared range from the union of both metrics, which share their step). */
export function chartScales(chart, views) {
  const xs = allValues(views, chart.x), ys = allValues(views, chart.y);
  return chart.equal ? equalScale(xs, ys, axisRule(chart.x)) : [axisScale(xs, axisRule(chart.x)), axisScale(ys, axisRule(chart.y))];
}

const plotSize = k => size('fantasy.charts-gallery.plot.' + k);

/** The radius of a dot whose size is an amount (chart.size: shot attempts), in px at the reference size: rMin + k x sqrt(amount), so the dot's area grows with the amount. The same function in every window. */
export const bubbleRadius = n => plotSize('bubble-radius-min') + plotSize('bubble-radius-per-root') * Math.sqrt(n > 0 ? n : 0);

/** The size key of a chart whose dots have a size: sample dots at the radii of the opened card, with their amounts. '' for the other charts. */
export function sizeKey(chart, byId) {
  if (!chart.size) return '';
  const label = byId[chart.size.id].label, biggest = bubbleRadius(Math.max(...chart.size.key)), box = Math.ceil(2 * biggest) + 2;   // every sample as tall as the biggest, each only as wide as its own dot
  return `<div class="fc-sizekey" role="img" aria-label="${esc(`Dot size shows ${label}: ${chart.size.key.join(', ')}`)}"><span>Dot size = ${esc(label)}</span>${chart.size.key.map(n => { const r = +bubbleRadius(n).toFixed(2), w = Math.ceil(2 * r) + 2; return `<span class="fc-sizekey-item"><svg width="${w}" height="${box}" viewBox="0 0 ${w} ${box}" aria-hidden="true"><circle class="fc-dot" cx="${w / 2}" cy="${box / 2}" r="${r}"/></svg>${n}</span>`; }).join('')}</div>`;
}

/** The read-out of a chart that lists its own figures (chart.hover): 'name · team · label value · ...', each in its metric's format ('—' when there is none). */
const readOut = (chart, view, id, byId, name, team) => [name, ...(team ? [team] : []), ...chart.hover.map(([key, label]) => { const v = axisValue(view, id, key); return `${label} ${Number.isFinite(v) ? fmt(byId[key], v) : '—'}`; })].join(' · ');

/** views = the view of every window (Season, Last 10 / 5 / 3); `view` is the one shown. */
export function scatter(chart, view, ids, byId, roster, views = [view]) {
  const mx = axisMeta(chart.x, byId), my = axisMeta(chart.y, byId), pts = [];
  for (const id of ids) {
    const a = axisValue(view, id, chart.x), b = axisValue(view, id, chart.y);
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
    const name = chart.entity === 'teams' ? roster.teams[id] || id : roster.players[id]?.name || id;
    const dataTeam = chart.entity === 'teams' ? null : view.row(id)?.team, team = dataTeam ? teamCode(roster, dataTeam) : null;   // a player's dot takes his team's colour (core/team-colour.js, by public code); the Teams charts keep their logos
    const amount = chart.size ? axisValue(view, id, chart.size.id) : undefined;   // the size of the dot; a player without one is still drawn (the smallest dot)
    pts.push({ id, a, b, ...(chart.size ? { n: Number.isFinite(amount) ? amount : 0 } : {}), name, label: chart.entity === 'teams' ? teamCode(roster, id) : id, logo: chart.entity === 'teams' ? teamLogo(roster, id) || '' : '', ...(team ? { team } : {}), tip: chart.hover ? readOut(chart, view, id, byId, name, team) : `${name} · ${team ? team + ' · ' : ''}${mx.label} ${fmt(mx, a)} · ${my.label} ${fmt(my, b)}` });
  }
  if (pts.length < 2) return '<p class="fw-empty">Not enough data for this chart.</p>';
  const [sx, sy] = chartScales(chart, views);
  const lx = chart.noAvg ? null : view.league(chart.x)?.value, ly = chart.noAvg ? null : view.league(chart.y)?.value;
  const fav = { x: favourable(mx.direction), y: favourable(my.direction) };
  const model = { fav, title: chart.title, xTitle: axisTitle(mx), yTitle: axisTitle(my), equal: !!chart.equal, sx, sy, avg: Number.isFinite(lx) && Number.isFinite(ly) ? { x: lx, y: ly } : null, pts };
  if (chart.entity === 'players') Object.assign(model, { noLabel: true, plain: true });   // players: team-coloured dots, no logos, no code labels; the outliers get a surname in the opened card
  if (chart.fit) {   // the line of typical y at that x: over the whole pool of the window (every player of the view with both values), NOT over the dots drawn; the filters only hide dots
    const pool = view.keys.map(id => ({ x: axisValue(view, id, chart.x), y: axisValue(view, id, chart.y) })).filter(q => Number.isFinite(q.x) && Number.isFinite(q.y));
    Object.assign(model, { fit: fitLine(pool), zoneLabels: chart.zones });
  }
  if (chart.move) Object.assign(model, { move: true, win: view.window });   // plot-wire.js slides the dots when the window changes
  if (chart.corners) model.corners = chart.corners;   // the league lines (model.avg: the league row of the window = the whole pool, never the dots drawn) split the plot; only the right side is tinted
  if (chart.curves) model.curves = chart.curves;
  if (chart.extremes) model.extremes = chart.extremes;
  if (chart.size) model.sized = true;
  if (chart.fit || chart.move) model.key = chart.id;
  return `<div class="fc-plot" data-plot="${esc(JSON.stringify(model))}"><div class="fc-canvas">${drawScatter(model, size('fantasy.charts-gallery.plot.plot-width'), false, 'thumb')}</div><div class="fc-tip fw-bar-tip${chart.hover ? ' fc-tip-long' : ''}" role="status" hidden></div></div>`;
}

/** Height of the opened card's plot when the container is narrow (it follows the content, not a fixed height): width x aspect; an x = y chart is exactly as tall as its square plot area, so no empty band sits above it. */
export function narrowHeight(model, W) {
  const P = k => size('fantasy.charts-gallery.plot.' + k);
  return model.equal ? W - P('margin-left-narrow') - P('margin-right-narrow') + P('margin-top') + P('margin-bottom') : Math.round(W * P('aspect-narrow'));
}

/** The svg of a model at a pixel width (1 svg unit = 1 css px, so lettering and logos are real sizes); `narrow` = phone sizes.
    mode 'thumb' (gallery thumbnail): plain dots, no labels, every second tick; 'full' (opened card): team logos, a grid line and a label at every step (narrow: a label at every second one). H = the height to fill (default: width x aspect). */
export function drawScatter(model, W, narrow, mode = 'thumb', H = Math.round(W * size('fantasy.charts-gallery.plot.' + (narrow && mode === 'full' ? 'aspect-narrow' : 'aspect')))) {
  const full = mode === 'full', P = k => size('fantasy.charts-gallery.plot.' + k);
  const L = P(narrow ? 'margin-left-narrow' : 'margin-left'), R = P(narrow ? 'margin-right-narrow' : 'margin-right'), Tp = P('margin-top'), B = P('margin-bottom');
  const iw = W - L - R, ih = H - Tp - B, side = model.equal ? Math.min(iw, ih) : null;   // the x = y chart has a square plot area: same range on both axes = exactly 45°
  const x0 = side ? L + (iw - side) / 2 : L, x1 = side ? x0 + side : W - R, y1 = H - B, y0 = side ? y1 - side : Tp;
  const { sx, sy } = model, X = v => x0 + (v - sx.lo) / (sx.hi - sx.lo) * (x1 - x0), Y = v => y1 - (v - sy.lo) / (sy.hi - sy.lo) * (y1 - y0), f = v => +v.toFixed(1);
  // Opened card: a grid line at every step (an axis with a floor keeps them in the thumbnail too, every other axis shows every second one there); a label on every grid line only in the wide opened card.
  const lines = s => (full ? s.ticks : s.grid || s.thumb), labels = s => (full && !narrow ? s.ticks : s.thumb);
  const grid = lines(sx).map(v => `<line class="fc-grid" x1="${f(X(v))}" x2="${f(X(v))}" y1="${f(y0)}" y2="${f(y1)}"/>`).join('')
    + labels(sx).map(v => `<text class="fc-tick" x="${f(X(v))}" y="${f(y1 + P('tick-offset-y'))}" text-anchor="middle">${v.toFixed(sx.digits)}</text>`).join('')
    + lines(sy).map(v => `<line class="fc-grid" x1="${f(x0)}" x2="${f(x1)}" y1="${f(Y(v))}" y2="${f(Y(v))}"/>`).join('')
    + labels(sy).map(v => `<text class="fc-tick" x="${f(x0 - P('tick-offset-x'))}" y="${f(Y(v) + P('tick-baseline'))}" text-anchor="end">${v.toFixed(sy.digits)}</text>`).join('');
  const rect = (xa, xb, ya, yb, tone) => (tone ? `<rect class="fc-q ${tone}" x="${f(xa)}" y="${f(ya)}" width="${f(xb - xa)}" height="${f(yb - ya)}"/>` : '');
  let tint = '';
  if (model.corners && model.avg) {   // only the right of the volume line is judged: above the efficiency line good, below it bad; clipped to the plot
    const ax = Math.min(x1, Math.max(x0, X(model.avg.x))), ay = Math.min(y1, Math.max(y0, Y(model.avg.y)));
    tint = rect(ax, x1, y0, ay, 'good') + rect(ax, x1, ay, y1, 'bad');
  } else if (model.avg) {   // the dashed league lines split the plot into four quadrants
    const ax = Math.min(x1, Math.max(x0, X(model.avg.x))), ay = Math.min(y1, Math.max(y0, Y(model.avg.y)));
    tint = rect(x0, ax, y0, ay, quadrantTone(model.fav, false, true)) + rect(ax, x1, y0, ay, quadrantTone(model.fav, true, true)) + rect(x0, ax, ay, y1, quadrantTone(model.fav, false, false)) + rect(ax, x1, ay, y1, quadrantTone(model.fav, true, false));
  } else if (model.equal) {   // the diagonal splits two halves: above it the opponent shoots better than expected
    const poly = (pts, tone) => (tone ? `<polygon class="fc-q ${tone}" points="${pts.map(q => q.map(f).join(',')).join(' ')}"/>` : '');
    tint = poly([[x0, y1], [x0, y0], [x1, y0]], diagonalTone(model.fav, true)) + poly([[x0, y1], [x1, y1], [x1, y0]], diagonalTone(model.fav, false));
  }
  let line = '';
  const blocked = [];   // boxes the outlier labels must keep clear of (the zone labels)
  if (model.fit && !side) {   // the reference line cuts the plot into two zones: above it good, below it bad; each zone is clipped to the plot area, so nothing spills past the axes
    const box = { x0: sx.lo, x1: sx.hi, y0: sy.lo, y1: sy.hi }, z = zones(model.fit, box), seg = lineSegment(model.fit, box), pad = P('zone-label-offset'), clear = P('zone-label-clear');
    const poly = (pts, tone) => (pts ? `<polygon class="fc-q ${tone}" points="${pts.map(q => f(X(q[0])) + ',' + f(Y(q[1]))).join(' ')}"/>` : '');
    const corner = (top, tone, text) => {   // (its box is remembered: an outlier label keeps clear of it)   // the label sits in the plot corner (left or right) that is farthest from the line, only when that corner is clear of it
      const room = cx => (top ? 1 : -1) * (Y(model.fit.slope * (cx === x0 ? sx.lo : sx.hi) + model.fit.intercept) - (top ? y0 : y1)), [left, right] = [room(x0), room(x1)], atLeft = left >= right;
      if (!text || Math.max(left, right) < clear) return '';
      const bw = text.length * P('label-char-width'), bh = P('label-height');
      blocked.push({ x: atLeft ? x0 + pad : x1 - pad - bw, y: top ? y0 + pad : y1 - pad - bh, w: bw, h: bh });
      return `<text class="fc-zone ${tone}" x="${f(atLeft ? x0 + pad : x1 - pad)}" y="${f(top ? y0 + pad : y1 - pad)}" text-anchor="${atLeft ? 'start' : 'end'}" dominant-baseline="${top ? 'hanging' : 'auto'}">${esc(text)}</text>`;
    };
    tint = poly(z.above, 'good') + poly(z.below, 'bad');
    line = (seg ? `<line class="fc-fit" x1="${f(X(seg[0][0]))}" y1="${f(Y(seg[0][1]))}" x2="${f(X(seg[1][0]))}" y2="${f(Y(seg[1][1]))}"/>` : '') + (z.above ? corner(true, 'good', model.zoneLabels?.[0]) : '') + (z.below ? corner(false, 'bad', model.zoneLabels?.[1]) : '');
  }
  if (model.corners && model.avg) {
    const pad = P('zone-label-offset'), h = P('label-height'), cw = P('label-char-width'), ax = Math.min(x1, Math.max(x0, X(model.avg.x)));
    const zone = (text, tone, right, top) => {   // in its corner of the plot; broken at the comma when its side of the volume line is too narrow for one line
      if (!text) return '';
      const room = (right ? x1 - ax : ax - x0) - 2 * pad, cut = text.indexOf(', '), rows = text.length * cw > room && cut > 0 ? [text.slice(0, cut + 1), text.slice(cut + 2)] : [text];
      const w = Math.max(...rows.map(t => t.length)) * cw, tx = right ? x1 - pad : x0 + pad;
      blocked.push({ x: right ? tx - w : tx, y: top ? y0 + pad : y1 - pad - rows.length * h, w, h: rows.length * h });
      return rows.map((t, i) => `<text class="fc-zone ${tone}" x="${f(tx)}" y="${f(top ? y0 + pad + i * h : y1 - pad - (rows.length - 1 - i) * h)}" text-anchor="${right ? 'end' : 'start'}" dominant-baseline="${top ? 'hanging' : 'auto'}">${esc(t)}</text>`).join('');
    };
    line += zone(model.corners.upperRight, 'good', true, true) + zone(model.corners.lowerRight, 'bad', true, false) + zone(model.corners.upperLeft, 'neutral', false, true);
  }
  if (model.curves) {   // iso-points: they depend on the axes only (the same in every window), clipped to the plot, each labelled with its points per 100 near the top, below the zone labels
    const box = { x0: sx.lo, x1: sx.hi, y0: sy.lo, y1: sy.hi }, h = P('label-height'), gap = P('label-gap'), row = y0 + P('zone-label-offset') + 2 * h + h / 2;
    let paths = '', names = '';
    for (const points of model.curves) {
      const c = isoCurve(points, box);
      if (!c.length) continue;
      paths += `<polyline class="fc-iso" data-points="${points}" points="${c.map(q => f(X(q[0])) + ',' + f(Y(q[1]))).join(' ')}"/>`;
      const atRow = sy.hi - (row - y0) / (y1 - y0) * (sy.hi - sy.lo), x = Math.min(c.at(-1)[0], Math.max(c[0][0], atRow > 0 ? isoTs(points, atRow) : c[0][0]));
      const w = String(points).length * P('label-char-width'), px = X(x), py = Math.min(y1 - h / 2, Math.max(y0 + h / 2, Y(isoTs(points, x)))), bx = px + gap + w > x1 ? px - gap - w : px + gap;
      if (blocked.some(b => bx < b.x + b.w && b.x < bx + w && py - h / 2 < b.y + b.h && b.y < py + h / 2)) continue;
      blocked.push({ x: bx, y: py - h / 2, w, h });
      names += `<text class="fc-iso-label" x="${f(bx)}" y="${f(py)}" dominant-baseline="central">${points}</text>`;
    }
    line = paths + names + line;
  }
  const avg = model.avg ? `<line class="fc-avg" x1="${f(X(model.avg.x))}" x2="${f(X(model.avg.x))}" y1="${f(y0)}" y2="${f(y1)}"/><line class="fc-avg" x1="${f(x0)}" x2="${f(x1)}" y1="${f(Y(model.avg.y))}" y2="${f(Y(model.avg.y))}"/>` : '';
  const diag = model.equal ? `<line class="fc-diag" x1="${f(X(sx.lo))}" y1="${f(Y(sx.lo))}" x2="${f(X(sx.hi))}" y2="${f(Y(sx.hi))}"/>` : '';
  const cell = Math.sqrt(Math.max(1, iw * ih) / model.pts.length);   // logo size follows density: the more points on the smaller plot, the smaller the logo, between a legible minimum and a maximum
  const lo = P(narrow ? 'logo-size-min-narrow' : 'logo-size-min'), hi = P(narrow ? 'logo-size-max-narrow' : 'logo-size-max'), step = P('logo-step'), floor = P('logo-size-floor');
  const start = Math.max(lo, Math.min(hi, Math.round(cell * P('logo-density') / step) * step));   // a multiple of the step (4), between the legible minimum and the maximum
  const dotR = P('dot-radius'), place = model.pts.map(p => ({ x: X(p.a), y: Y(p.b) }));
  // Logos: overlapping ones are nudged apart by the smallest push, never further than half a logo from their data point; when that cannot clear them, the logo goes one step (4px) smaller, down to the floor (16px).
  let logo = start, at = place;
  for (; full && !model.plain; logo -= step) {   // team logos only: the players' price chart draws plain coloured dots (no density logic)
    const boxes = model.pts.map((p, i) => ({ ...place[i], ...(p.logo ? logoBox(p.logo, logo) : { w: dotR * 2, h: dotR * 2 }) }));
    at = separateBoxes(boxes, P('logo-gap'), logo / 2);
    if (logo - step < floor || !overlapPairs(at, boxes)) break;
  }
  const r = logo / 2, fit = {};

  // A dot with a size has its own radius (in a thumbnail scaled with the plot, from the reference plot width); every other dot has the one dot radius. Largest first, so a small dot is never under a big one.
  const radii = model.pts.map(p => (model.sized ? bubbleRadius(p.n) * (full ? 1 : W / P('plot-width')) : dotR));
  const order = model.pts.map((_, i) => i);
  if (model.sized) order.sort((i, j) => radii[j] - radii[i]);
  const dots = order.map(i => {
    const p = model.pts[i], dr = +radii[i].toFixed(2), hit = model.sized ? Math.max(dr, P('hit-radius-min')) : dotR + P('hit-pad');
    const body = full && p.logo ? `<circle class="fc-hit" r="${r}"/><image href="${esc(p.logo)}" x="${f((fit[p.logo] ||= logoFit(p.logo, logo)).x)}" y="${f(fit[p.logo].y)}" width="${f(fit[p.logo].width)}" height="${f(fit[p.logo].height)}" preserveAspectRatio="xMidYMid meet"/>`
      : `<circle class="fc-hit" r="${hit}"/><circle class="fc-dot${p.team ? ' fc-team' : ''}" r="${dr}"${p.team ? ` style="${teamColour(p.team)}"` : ''}/>${full && !model.noLabel ? `<text class="fc-pl" x="${P('label-offset-x')}" y="${P('tick-baseline')}">${esc(p.label ?? p.id)}</text>` : ''}`;
    return `<g class="fc-pt" data-open="${esc(p.id)}" data-x="${f(at[i].x)}" data-y="${f(at[i].y - (full && p.logo ? r : dr))}" data-tip="${esc(p.tip)}" tabindex="0" role="img" aria-label="${esc(p.tip)}" transform="translate(${f(at[i].x)} ${f(at[i].y)})">${body}</g>`;
  }).join('');
  let tags = '';   // the opened card names its outliers: the 5 dots furthest above the line and the 5 furthest below (of the dots drawn), a surname each, where it fits
  const picked = !full || !model.plain ? [] : model.fit ? pickOutliers(model.pts, model.fit, 5) : model.extremes ? pickExtremes(model.pts, model.avg, model.extremes) : [];
  if (picked.length) {
    const text = new Map(model.pts.map(p => [p.id, surname(p.name)])), index = new Map(model.pts.map((p, i) => [p.id, i]));
    const items = picked.map(o => ({ id: o.id, x: at[index.get(o.id)].x, y: at[index.get(o.id)].y, r: radii[index.get(o.id)], w: text.get(o.id).length * P('label-char-width'), h: P('label-height') }));
    // The box is an estimate that is wider than the real lettering: the text is anchored on the side of its own dot (left of the dot: at the box's end; above / below: centred), so it never floats away from it.
    tags = placeLabels(items, { x0, x1, y0, y1 }, blocked, P('label-gap')).map(l => {
      const cx = at[index.get(l.id)].x, anchor = l.x + l.w <= cx ? 'end' : l.x >= cx ? '' : 'middle', tx = anchor === 'end' ? l.x + l.w : anchor ? l.x + l.w / 2 : l.x;
      return `<text class="fc-pl" x="${f(tx)}" y="${f(l.y + l.h / 2)}" dominant-baseline="central"${anchor ? ` text-anchor="${anchor}"` : ''}>${esc(text.get(l.id))}</text>`;
    }).join('');
  }
  return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" class="fc-svg" role="group" aria-label="${esc(model.title)}">${tint}${grid}${avg}${diag}${line}<line class="fc-axis" x1="${f(x0)}" x2="${f(x1)}" y1="${f(y1)}" y2="${f(y1)}"/><line class="fc-axis" x1="${f(x0)}" x2="${f(x0)}" y1="${f(y0)}" y2="${f(y1)}"/>`
    + `<text class="fc-ax" x="${f((x0 + x1) / 2)}" y="${f(y1 + B - P('axis-title-bottom'))}" text-anchor="middle">${esc(model.xTitle)}</text><text class="fc-ax" transform="translate(${f(x0 - L + P('axis-title-left'))} ${f((y0 + y1) / 2)}) rotate(-90)" text-anchor="middle">${esc(model.yTitle)}</text>${dots}${tags}</svg>`;
}
