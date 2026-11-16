/* Pop-ups of the table cells: hover on a main metric value shows that entity's per-game sparkline; click or tap on any value pins a pop-out with the
   details (same rows as the shot chart's zone pop-up). */
import { Data } from '../../core/data.js';
import * as Windows from '../../core/windows.js';
import * as TM from '../../core/table-model.js';
import { esc } from '../../core/html.js';
import { fmt } from '../../core/format.js';
import { teamLabel } from '../../core/teams.js';
import { hoverSparkline } from './game-sparkline.js';

const signed = (v, d = 1) => (v < 0 ? '−' : '+') + Math.abs(v).toFixed(d);

/* Open above the cell's row (below when there is no room), never over the row itself. */
function place(el, cell) {
  const row = cell.closest('tr').getBoundingClientRect(), c = cell.getBoundingClientRect();
  el.hidden = false;
  const w = el.offsetWidth, h = el.offsetHeight;
  let top = row.top - h - 8;
  if (top < 8) top = Math.min(row.bottom + 8, Math.max(8, innerHeight - h - 8));
  el.style.left = Math.max(8, Math.min(innerWidth - w - 8, c.left + c.width / 2 - w / 2)) + 'px';
  el.style.top = top + 'px';
}
/* The hover sparkline: above the row, else below it, else beside the cell (right, or left); always inside the viewport. */
function placeTip(el, cell) {
  const row = cell.closest('tr').getBoundingClientRect(), c = cell.getBoundingClientRect();
  el.hidden = false;
  const w = el.offsetWidth, h = el.offsetHeight, M = 8, fitX = x => Math.max(M, Math.min(innerWidth - w - M, x)), fitY = y => Math.max(M, Math.min(innerHeight - h - M, y));
  let left = fitX(c.left + c.width / 2 - w / 2), top;
  if (row.top - h - M >= M) top = row.top - h - M;
  else if (row.bottom + h + M <= innerHeight - M) top = row.bottom + M;
  else { top = fitY(row.top + (row.height - h) / 2); left = c.right + M + w <= innerWidth - M ? c.right + M : fitX(c.left - w - M); }
  el.style.left = left + 'px';
  el.style.top = top + 'px';
}
/* Details of a clicked cell, same rows as the shot chart's zone pop-up. */
function popHtml(state, shown, cell) {
  const { view, cols, model, few, roster, byId, TL } = shown, id = cell.dataset.id, c = cols.find(x => x.metric === cell.dataset.metric), m = byId[c.metric], v = view.get(id, c.metric);
  const teams = state.entity === 'teams', who = teams ? teamLabel(roster, id) : roster.players[id]?.name || id;
  const row = (l, val) => `<div class="sz-pop-row"><span>${l}</span><b>${val}</b></div>`;
  const num = k => view.get(id, k).value, rank = TM.rankOf(model.get(c.metric).list, v.value, m.direction);
  let out = `<strong>${esc(who)} · ${esc(c.label)}</strong>`;
  if (few(c, id)) out += row('Attempts per 100', fmt(view.get(id, c.few), byId[c.few])) + `<small>Few shots (under ${TL.fewBelow} attempt per 100 possessions): no rank.</small>`;
  else out += row('Value', fmt(v, m));
  if (c.detail && Number.isFinite(num(c.detail.att))) out += row('Made / attempts', `${num(c.detail.made)} / ${num(c.detail.att)}`);
  if (c.detail && !c.chart && !few(c, id)) {   // zone columns
    const lg = view.league(c.metric)?.value;
    out += row('League FG%', Number.isFinite(lg) ? lg.toFixed(1) + '%' : '—') + row('Gap', Number.isFinite(lg) && Number.isFinite(v.value) ? signed(v.value - lg) + ' pp' : '—');
    if (c.detail.share) out += row('Share of attempts', fmt(view.get(id, c.detail.share), byId[c.detail.share]));
  }
  if (rank) out += row('Rank', `#${rank.position} of ${rank.n}`);
  if (v.used !== null && v.used < v.of) out += row('Games with the data', `${v.used} of ${v.of}`);
  return out;
}

/* Hover on a main metric value: that entity's per-game sparkline (lines only). Click or tap on any value: pinned pop-out with the details. */
export function wirePopups(host, state, shown) {
  const tip = host.querySelector('.fw-tooltip'), pop = host.querySelector('.fw-pop');
  let token = 0, pinCell = null;
  const hideTip = () => { token++; tip.hidden = true; };
  const unpin = () => { pinCell = null; pop.hidden = true; };
  host.querySelectorAll('.fw-cell[data-id]').forEach(b => {
    const show = async () => {
      if (pinCell || !b.hasAttribute('data-chart')) return;
      const mine = ++token, id = b.dataset.id, metric = b.dataset.metric;
      const view = await Windows.view(state.entity, state);
      const spark = await hoverSparkline(state.entity, id, metric, view.get(id, metric).value);
      if (mine !== token || pinCell || !spark) return;
      tip.innerHTML = spark;
      placeTip(tip, b);
    };
    b.onmouseenter = show; b.onfocus = show;
    b.onmouseleave = b.onblur = hideTip;
    b.onclick = e => {
      e.stopPropagation(); hideTip();
      if (pinCell === b) { unpin(); return; }
      pinCell = b; pop.innerHTML = popHtml(state, shown, b); place(pop, b);
    };
  });
  host.onkeydown = e => { if (e.key === 'Escape') { unpin(); hideTip(); } };
  host.onclick = e => { if (pinCell && !e.target.closest('.fw-pop')) unpin(); };
  const wrap = host.querySelector('.fw-table-wrap');
  if (wrap) wrap.onscroll = () => { unpin(); hideTip(); };
}
