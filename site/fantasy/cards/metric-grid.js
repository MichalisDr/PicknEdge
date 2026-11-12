import { esc } from '../../core/html.js';
import { fmt } from '../../core/format.js';
import { stackOrder } from '../../core/stack-order.js';
import { teamRank } from './card-data.js';

/* Which metrics, where, how big and which secondary lines is all in config/layout.json; this code only turns a box into a tile (classes fw-metric
   fw-m-lg / fw-m-sm). Tile tier: the box's optional 'tier' field (lg / sm / strip), else by box area w*h: >= 36 large, 13..35 small, <= 12 strip. */
let layoutPromise = null;
const layoutFile = () => layoutPromise || (layoutPromise = fetch(new URL('../../config/layout.json', import.meta.url)).then(r => { if (!r.ok) throw new Error('layout.json ' + r.status); return r.json(); }));
const unitHtml = t => t ? `<em>${esc(t)}</em>` : '';
function boxHtml(id, b, view, byId, sel, players) {
  const m = byId[b.metric], c = view.get(id, b.metric), label = b.label || m.label, area = `grid-area:${b.y + 1}/${b.x + 1}/span ${b.h}/span ${b.w}`, size = b.w * b.h;
  const r = players ? null : teamRank(view, b.metric, c.value, m.direction);
    const rank = r ? `<b class="fw-rank">#${r.position}</b>` : '';
  const val = metric => view.get(id, metric);
  const subs = (b.sub || []).map(sb => {
    const sm = byId[sb.metric], sc = val(sb.metric);
    if (!Number.isFinite(sc?.value)) return '';
    const num = sc.value.toFixed(sm.format.digits);
    const text = sb.text ? (sc.value === 0 && sb.zeroText ? sb.zeroText : sb.text.replace('{v}', num)) : (sb.label ? (sb.side ? `<i class="lx-sl">${esc(sb.label)}</i>` : sb.label + ' ') : '') + fmt(sc, sm) + (sb.unit ? `<em>${esc(sb.unit)}</em>` : '');
    return `<small${sb.side ? ' class="lx-side"' : ''}>${sb.text ? esc(text) : text}</small>`;   // side: shown on the right of the tile, small, not a metric of its own
  }).join('');
  const subTitle = (b.sub || []).filter(sb => sb.label).map(sb => ' · ' + sb.label + ': ' + byId[sb.metric].description).join('');
  const open = (cls, style, title) => `<button class="fw-metric ${cls}" style="${area}${style ? ';' + style : ''}" data-metric="${b.metric}" aria-pressed="${sel === b.metric}" title="${esc(title)}">`;
  const value = `<strong${r ? ` class="eval-${r.tone}"` : ''}>${fmt(c, m)}${Number.isFinite(c.value) ? unitHtml(b.unit) : ''}</strong>`;
  const tier = b.tier || (size >= 36 ? 'lg' : size <= 12 ? 'strip' : 'sm');
  if (tier === 'strip') return `${open('fw-m-sm lx-strip', '', m.description + subTitle)}<span>${esc(label)}</span><lx-r>${rank}${value}${subs}</lx-r></button>`;
  return `${open(tier === 'lg' ? 'fw-m-lg' : 'fw-m-sm', '', m.description + subTitle)}<lx-t><span>${esc(label)}</span>${rank}${subs}</lx-t>${value}</button>`;
}
/** The metric grid of a card (layout `name` of config/layout.json) with the values of entity `id`. */
export async function layoutGrid(id, name, view, byId, sel, players) {
  const F = await layoutFile(), L = F.layouts[name];
  if (!L) throw new Error('no layout ' + name);
  const px = L.rowPx ?? F.rowPx ?? 24, rowsT = Array.from({ length: L.rows }, (_, i) => (Array.isArray(px) ? px[i] ?? px.at(-1) : px) + 'px').join(' ');   // row heights: one number, or one per row
  const order = stackOrder(L);   // DOM order = stacked order; desktop placement is by grid-area
  return `<div class="lx" data-layout="${name}"><div class="lx-grid fw-pgrid" style="--rows:${L.rows};--gap:${F.gap ?? 8}px;--rowsT:${rowsT}">${order.map(b => boxHtml(id, b, view, byId, sel, players)).join('')}</div></div>`;
}
