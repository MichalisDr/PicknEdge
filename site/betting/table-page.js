/* The Betting statistics page: draws from the state and wires the toolbar, sort, filters, search and the team-value tooltip. Data: table-data.js, markup: table-view.js. */
import { Data } from '../core/data.js';
import * as Windows from '../core/windows.js';
import { esc } from '../core/html.js';
import { state } from './table-state.js';
import { ranks, teamModel, playerModel } from './table-data.js';
import { page } from './table-view.js';
import { PLAYER_VIEWS } from './columns.js';

let host = null, drawId = 0, pinned = null;

async function draw() {
  if (!host || !host.isConnected) return;
  const mine = ++drawId;
  pinned = null;
  try {
    const [{ byId }, roster, status] = await Promise.all([Data.metrics(), Data.roster(), Data.status()]);
    const model = state.entity === 'teams' ? await teamModel(byId, roster) : await playerModel(byId, roster);
    if (mine !== drawId) return;
    host.innerHTML = page(model, status, roster);
    wire(model);
  } catch (e) {
    host.innerHTML = `<section class="bet-stats"><p class="empty" role="status">Could not load the data: ${esc(e.message)}</p></section>`;
  }
}

async function tooltip(b, m) {
  const tip = host.querySelector('#stats-tooltip'), d = m.byId[b.dataset.metric], id = b.dataset.id;
  let ranksText = '';
  if (id) {
    const parts = [];
    for (const [w, label] of [['season', 'Season'], ['l5', 'L5'], ['l3', 'L3']]) {
      const v = await Data.view('teams', w), r = ranks(v, d.id, d.direction)[id];
      if (r) parts.push(`${label} #${r}`);
    }
    ranksText = `<span class="tip-rank">Rank: ${esc(parts.join(' · '))} / ${m.nTeams}</span>`;
  }
  tip.innerHTML = `<strong>${esc(id ? m.rows.find(r => r.id === id).name : 'League average')} · ${esc(d.label)}</strong>${ranksText}<b>${esc(b.querySelector('.v').textContent)}</b><p>${esc(d.description)}</p>`;
  tip.hidden = false; b.setAttribute('aria-describedby', 'stats-tooltip');
  const rect = b.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight;
  tip.style.left = Math.max(8, Math.min(innerWidth - w - 8, rect.left + rect.width / 2 - w / 2)) + 'px';
  tip.style.top = Math.max(8, rect.bottom + h + 12 < innerHeight ? rect.bottom + 8 : rect.top - h - 8) + 'px';
}

function wire(m) {
  const on = (sel, fn) => host.querySelectorAll(sel).forEach(el => { el.onclick = () => fn(el); });
  Windows.wire(host, state, () => { pinned = null; draw(); });
  on('[data-entity]', b => { state.entity = b.dataset.entity; draw(); });
  on('[data-side]', b => { state.side = b.dataset.side; draw(); });
  on('[data-sort]', b => { const c = Number(b.dataset.sort); state.dir = state.col === c ? -state.dir : -1; state.col = c; draw(); });
  on('[data-pl-view]', b => { state.pl.view = b.dataset.plView; state.pl.col = PLAYER_VIEWS[state.pl.view][1][0]; draw(); });
  on('[data-pl-sort]', b => { const c = b.dataset.plSort; state.pl.dir = state.pl.col === c ? -state.pl.dir : -1; state.pl.col = c; draw(); });
  const pick = (id, fn) => { const el = host.querySelector(id); if (el) el.onchange = () => { fn(el.value); draw(); }; };
  pick('#pl-team', v => { state.pl.team = v; }); pick('#pl-pos', v => { state.pl.pos = v; }); pick('#pl-min', v => { state.pl.min = Number(v); });
  const search = (id, set) => { const el = host.querySelector(id); if (el) el.oninput = () => { const caret = el.selectionStart; set(el.value); draw().then(() => { const n = host.querySelector(id); n.focus(); try { n.setSelectionRange(caret, caret); } catch { /* ignore */ } }); }; };
  search('#team-search', v => { state.query = v; }); search('#pl-search', v => { state.pl.query = v; });
  if (m.kind !== 'teams') return;
  const hide = () => { const t = host.querySelector('#stats-tooltip'); if (t) t.hidden = true; host.querySelectorAll('[aria-describedby]').forEach(b => b.removeAttribute('aria-describedby')); };
  host.querySelectorAll('.stat-cell').forEach(b => {
    b.onmouseenter = () => { if (!pinned) tooltip(b, m); };
    b.onmouseleave = () => { if (!pinned) hide(); };
    b.onfocus = () => tooltip(b, m);
    b.onblur = () => { if (pinned === b) pinned = null; hide(); };
    b.onclick = () => { if (pinned === b) { pinned = null; hide(); } else { pinned = b; tooltip(b, m); } };
  });
  host.onkeydown = e => { if (e.key === 'Escape') { pinned = null; hide(); } };
  const sc = host.querySelector('.stats-scroll'); if (sc) sc.onscroll = () => { pinned = null; hide(); };
  host.onclick = e => { if (!e.target.closest('.stat-cell') && !e.target.closest('.stats-tooltip')) { pinned = null; hide(); } };
}

export function mount(target) {
  host = target;
  Data.clearOldCaches();
  host.innerHTML = '<section class="bet-stats"><p class="empty" role="status">Loading data…</p></section>';
  draw();
}
