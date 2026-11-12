/* Fantasy player and team cards, as a dialog: identity header, controls (sample window, GP, Shooting), the metric grid, then the radar, a metric's trend,
   or the shot chart, and the player's box scores. Pure UI over the data layer; the parts live in the files next to this one. */
import { Data } from '../../core/data.js';
import * as Windows from '../../core/windows.js';
import { teamLogo } from '../../core/teams.js';
import { headerHtml, controlsHtml } from './card-header.js';
import { layoutGrid } from './metric-grid.js';
import { radar, teamRadar } from './radar.js';
import { trendBlock } from './card-trend.js';
import { boxScores } from './box-scores.js';
import { mount as mountShotChart } from '../shotchart/shotchart.js';

let dialog = null, cs = null;   // the open dialog and the state of its card
/* ---------- dialog ---------- */
async function draw() {
  if (!dialog) return;
  const root = dialog.querySelector('.fw-card'), mine = cs.token = (cs.token || 0) + 1;
  const kind = cs.entity;
  try {
    const [view, season, teamsView, { byId }, roster] = await Promise.all([Windows.view(kind, cs), Data.view(kind, 'season'), Windows.view('teams', cs), Data.metrics(), Data.roster()]);
    const next = kind === 'players' && season.row(cs.id) ? await Data.nextGame(season.row(cs.id).team).catch(() => null) : null;
    if (mine !== cs.token || !dialog) return;
    const row = view.row(cs.id) || season.row(cs.id);
    if (!row) { root.textContent = 'No data available.'; return; }
    const players = kind === 'players', gp = players ? view.get(cs.id, 'gp').value : view.row(cs.id)?.games;
    const team = players ? row.team : cs.id, name = players ? roster.players[cs.id]?.name || cs.id : roster.teams[cs.id] || cs.id;
    const logo = teamLogo(roster, team);
    const sel = cs.selected && byId[cs.selected] ? cs.selected : null;
    let visual = '', gridHtml = '';
    if (gp || !players) gridHtml = await layoutGrid(cs.id, (players ? 'player.' : 'team.') + cs.mode, view, byId, sel, players);
    if (mine !== cs.token || !dialog) return;
    if (!gp && players) visual = '<p class="fw-empty">No appearances in this sample.</p>';
    else if (sel) visual = await trendBlock(cs, view, season, byId);
    else if (cs.mode === 'shooting') visual = '<div class="fw-shots" data-shots></div>';
    else if (players) visual = radar(cs, view, byId, roster, cs.cmp ? await Windows.view('players', cs) : null);
    else visual = teamRadar(cs, view, season);
    root.innerHTML = `${headerHtml({ cs, players, name, team, row, roster, logo, next })}
      ${controlsHtml({ cs, players, gp })}
      ${!gp && players ? '' : gridHtml}<div class="fw-visual">${visual}</div>${players ? '<div data-box></div>' : ''}`;
    Windows.wire(root, cs, () => { cs.selected = null; draw(); }, 'data-card-window');
    root.querySelector('[data-next]')?.addEventListener('click', e => { const t = e.currentTarget.dataset.next; open('teams', t, { win: cs.win, back: { id: cs.id, name }, previous: cs.previous }); });
    root.querySelector('[data-back]')?.addEventListener('click', () => open('players', cs.back.id, { win: cs.win, previous: cs.previous }));
    root.querySelectorAll('[data-card-view]').forEach(b => { b.onclick = () => { cs.mode = cs.mode === 'shooting' ? 'profile' : 'shooting'; cs.selected = null; draw(); }; });
    root.querySelectorAll('[data-metric]').forEach(b => { b.onclick = () => { cs.selected = cs.selected === b.dataset.metric ? null : b.dataset.metric; draw(); }; });
    root.querySelectorAll('[data-radar]').forEach(b => { b.onclick = () => { cs.radar = b.dataset.radar; draw(); }; });
    root.querySelectorAll('[data-net]').forEach(b => { b.onclick = () => { cs.net = b.dataset.net; draw(); }; });
    const cmp = root.querySelector('[data-cmp]');
    if (cmp) cmp.onchange = () => { cs.cmp = cmp.value; draw(); };
    const shots = root.querySelector('[data-shots]');
    if (shots && (gp || !players)) mountShotChart(shots, { kind, id: cs.id, team, spec: Windows.spec(cs), view, teamsView }, cs.shot);
    const box = root.querySelector('[data-box]');
    if (box && players) boxScores(cs).then(h => { if (mine === cs.token && box.isConnected) box.innerHTML = h; });
  } catch (e) { root.textContent = 'Could not load the card: ' + e.message; }
}

export function open(entity, id, from = {}) {
  close();
  const previous = from.previous || document.activeElement;
  cs = { entity, id, previous, back: from.back || null, win: from.win || 'season', mode: 'profile', selected: null, cmp: '', radar: 'game', net: 'net', shot: { view: 'hex', hl: null, sc: false } };
  dialog = document.createElement('dialog');
  dialog.className = 'fw-dialog';
  dialog.innerHTML = '<button class="fw-close" aria-label="Close card">×</button><div class="fw-card"><p class="fw-empty" role="status">Loading…</p></div>';
  document.body.append(dialog);
  const done = () => { close(); previous?.focus?.(); };
  dialog.querySelector('.fw-close').onclick = done;
  dialog.oncancel = e => { e.preventDefault(); done(); };
  dialog.onclick = e => { if (e.target === dialog) done(); };
  dialog.showModal();
  draw();
}
export function close() { if (dialog) { dialog.close(); dialog.remove(); dialog = null; cs = null; } }
window.addEventListener('hashchange', close);
