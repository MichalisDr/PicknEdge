/* One comparative scatter chart: the entities of the current view as team logos on round backings, dashed lines for the league values from the view's league row.
   scatter() returns the card's chart block: a model in data-plot plus a first drawing; plot-wire.js redraws it at the real width (drawScatter) so that sizes and lettering are real pixels.
   Scale and logo separation live in scale.js. A logo is clickable (class fc-pt, data-open) and opens the card; hover / tap shows name and both values. */
import { esc } from '../../core/html.js';
import { size } from '../../core/sizes.js';
import { teamLogo } from '../../core/teams.js';
import { axisScale, equalScale, separate } from './scale.js';

const axisTitle = m => m.label + (m.format.suffix && !m.label.includes(m.format.suffix.trim()) ? ` (${m.format.suffix.trim()})` : '');
const fmt = (m, v) => v.toFixed(m.format.digits) + m.format.suffix;

export function scatter(chart, view, ids, byId, roster) {
  const mx = byId[chart.x], my = byId[chart.y], pts = [];
  for (const id of ids) {
    const a = view.get(id, chart.x)?.value, b = view.get(id, chart.y)?.value;
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
    const name = chart.entity === 'teams' ? roster.teams[id] || id : roster.players[id]?.name || id;
    pts.push({ id, a, b, name, logo: chart.entity === 'teams' ? teamLogo(roster, id) || '' : '', tip: `${name} · ${mx.label} ${fmt(mx, a)} · ${my.label} ${fmt(my, b)}` });
  }
  if (pts.length < 2) return '<p class="fw-empty">Not enough data for this chart.</p>';
  const [sx, sy] = chart.equal ? equalScale(pts.map(p => p.a), pts.map(p => p.b)) : [axisScale(pts.map(p => p.a)), axisScale(pts.map(p => p.b))];
  const lx = chart.noAvg ? null : view.league(chart.x)?.value, ly = chart.noAvg ? null : view.league(chart.y)?.value;
  const model = { title: chart.title, xTitle: axisTitle(mx), yTitle: axisTitle(my), equal: !!chart.equal, sx, sy, avg: Number.isFinite(lx) && Number.isFinite(ly) ? { x: lx, y: ly } : null, pts };
  return `<div class="fc-plot" data-plot="${esc(JSON.stringify(model))}"><div class="fc-canvas">${drawScatter(model, size('fantasy.charts-gallery.plot.plot-width'), false)}</div><div class="fc-tip fw-bar-tip" role="status" hidden></div></div>`;
}

/** The svg of a model at a pixel width (1 svg unit = 1 css px, so lettering and logos are real sizes); `narrow` = phone sizes. */
export function drawScatter(model, W, narrow) {
  const L = size('fantasy.charts-gallery.plot.margin-left'), R = size('fantasy.charts-gallery.plot.margin-right'), Tp = size('fantasy.charts-gallery.plot.margin-top'), B = size('fantasy.charts-gallery.plot.margin-bottom');
  const H = Math.round(W * size('fantasy.charts-gallery.plot.aspect')), logo = size(narrow ? 'fantasy.charts-gallery.plot.logo-size-narrow' : 'fantasy.charts-gallery.plot.logo-size');
  const iw = W - L - R, ih = H - Tp - B, side = model.equal ? Math.min(iw, ih) : null;   // the x = y chart has a square plot area: same range on both axes = exactly 45°
  const x0 = side ? L + (iw - side) / 2 : L, x1 = side ? x0 + side : W - R, y1 = H - B, y0 = side ? y1 - side : Tp;
  const { sx, sy } = model, X = v => x0 + (v - sx.lo) / (sx.hi - sx.lo) * (x1 - x0), Y = v => y1 - (v - sy.lo) / (sy.hi - sy.lo) * (y1 - y0), f = v => +v.toFixed(1);
  const grid = sx.ticks.map(v => `<line class="fc-grid" x1="${f(X(v))}" x2="${f(X(v))}" y1="${f(y0)}" y2="${f(y1)}"/><text class="fc-tick" x="${f(X(v))}" y="${f(y1 + 18)}" text-anchor="middle">${v.toFixed(sx.digits)}</text>`).join('')
    + sy.ticks.map(v => `<line class="fc-grid" x1="${f(x0)}" x2="${f(x1)}" y1="${f(Y(v))}" y2="${f(Y(v))}"/><text class="fc-tick" x="${f(x0 - 8)}" y="${f(Y(v) + 4)}" text-anchor="end">${v.toFixed(sy.digits)}</text>`).join('');
  const avg = model.avg ? `<line class="fc-avg" x1="${f(X(model.avg.x))}" x2="${f(X(model.avg.x))}" y1="${f(y0)}" y2="${f(y1)}"/><line class="fc-avg" x1="${f(x0)}" x2="${f(x1)}" y1="${f(Y(model.avg.y))}" y2="${f(Y(model.avg.y))}"/>` : '';
  const diag = model.equal ? `<line class="fc-diag" x1="${f(X(sx.lo))}" y1="${f(Y(sx.lo))}" x2="${f(X(sx.hi))}" y2="${f(Y(sx.hi))}"/>` : '';
  const at = separate(model.pts.map(p => ({ x: X(p.a), y: Y(p.b) })), logo + 2);   // backing diameter = logo size, +2 px air
  const r = logo / 2, img = logo * .76;
  const dots = model.pts.map((p, i) => {
    const body = p.logo ? `<circle class="fc-bk" r="${r}"/><image href="${esc(p.logo)}" x="${f(-img / 2)}" y="${f(-img / 2)}" width="${f(img)}" height="${f(img)}" preserveAspectRatio="xMidYMid meet"/>`
      : `<circle class="fc-dot" r="5"/><text class="fc-pl" x="8" y="4">${esc(p.id)}</text>`;
    return `<g class="fc-pt" data-open="${esc(p.id)}" data-x="${f(at[i].x)}" data-y="${f(at[i].y - r)}" data-tip="${esc(p.tip)}" tabindex="0" role="img" aria-label="${esc(p.tip)}" transform="translate(${f(at[i].x)} ${f(at[i].y)})">${body}</g>`;
  }).join('');
  return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" class="fc-svg" role="group" aria-label="${esc(model.title)}">${grid}${avg}${diag}<line class="fc-axis" x1="${f(x0)}" x2="${f(x1)}" y1="${f(y1)}" y2="${f(y1)}"/><line class="fc-axis" x1="${f(x0)}" x2="${f(x0)}" y1="${f(y0)}" y2="${f(y1)}"/>`
    + `<text class="fc-ax" x="${f((x0 + x1) / 2)}" y="${f(y1 + B - 8)}" text-anchor="middle">${esc(model.xTitle)}</text><text class="fc-ax" transform="translate(${f(x0 - L + 16)} ${f((y0 + y1) / 2)}) rotate(-90)" text-anchor="middle">${esc(model.yTitle)}</text>${dots}</svg>`;
}
