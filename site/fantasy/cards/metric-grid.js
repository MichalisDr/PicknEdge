import { esc } from '../../core/html.js';
import { fmt } from '../../core/format.js';
import { teamRank } from './card-data.js';

/* The stats block of a card (class .sb): what it shows is all in config/layout.json (hero, low slot, sections of cells); this file turns that into markup and
   gives every cell its place for the wide layout (--r row, --c column of the right area); the mid and narrow layouts flow in DOM order (theme/fantasy/stats-block.css).
   A cell is the button of a metric: data-metric opens its trend below the block, aria-pressed marks the selected one. */
const PER_ROW = 4, MISSING = '–';
let layoutPromise = null;
const layoutFile = () => layoutPromise || (layoutPromise = fetch(new URL('../../config/layout.json', import.meta.url)).then(r => { if (!r.ok) throw new Error('layout.json ' + r.status); return r.json(); }));

function cellHtml(id, cell, view, byId, sel, players, place = '', cls = '') {
  const m = byId[cell.metric], c = view.get(id, cell.metric), label = cell.label || m.label, has = Number.isFinite(c?.value);
  const r = players ? null : teamRank(view, cell.metric, c?.value, m.direction), tone = r ? ` ev-${r.tone}` : '';
  const subs = (cell.sub || []).map(s => {
    const sc = view.get(id, s.metric);
    if (!Number.isFinite(sc?.value)) return '';
    return `<span class="sub">${esc(sc.value === 0 && s.zeroText ? s.zeroText : s.text.replace('{v}', sc.value.toFixed(byId[s.metric].format.digits)))}</span>`;
  }).join('');
  const text = has ? fmt(c, m) : MISSING;
  return `<div class="cell ${cls}"${place ? ` style="${place}"` : ''}><button class="m t${cell.size}${tone}" data-metric="${cell.metric}" aria-pressed="${sel === cell.metric}" aria-label="${esc(label + ' ' + text + (has && cell.unit ? ' ' + cell.unit : ''))}" title="${esc(m.description)}">`
    + `<span class="lab">${esc(label)}${r ? `<span class="rk">#${r.position}</span>` : ''}</span>`
    + `<span class="v"><b>${esc(text)}</b>${has && cell.unit ? `<u>${esc(cell.unit)}</u>` : ''}</span>${subs}</button></div>`;
}

/** The stats block of a card (layout `name` of config/layout.json) with the values of entity `id`. */
export async function layoutGrid(id, name, view, byId, sel, players) {
  const L = (await layoutFile()).layouts[name];
  if (!L) throw new Error('no layout ' + name);
  let row = 1;
  const sections = L.sections.map(s => { const head = row, top = row + 1; row = top + Math.ceil(s.cells.length / PER_ROW); return { ...s, head, top }; });
  const at = (r, col) => `--r:${r}${col ? `;--c:${col}` : ''}`;
  const left = [L.hero && cellHtml(id, L.hero, view, byId, sel, players, at(sections[0]?.top ?? 1), 'left lead'), L.low && cellHtml(id, L.low, view, byId, sel, players, at(sections[1]?.top ?? sections[0]?.top ?? 1), 'left low')].filter(Boolean).join('');
  const body = sections.map(s => `<div class="sh" style="${at(s.head)}"><span>${esc(s.title)}</span><i></i></div>${s.cells.map((cell, i) => cellHtml(id, cell, view, byId, sel, players, at(s.top + Math.floor(i / PER_ROW), i % PER_ROW + 1), i % PER_ROW ? '' : 'first')).join('')}`).join('');
  return `<div class="sb" data-layout="${name}"><div class="sb-grid" style="--rows:${row - 1}">${left}<i class="vr" aria-hidden="true"></i>${body}</div></div>`;
}
