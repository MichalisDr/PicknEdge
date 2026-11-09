/* Fantasy · Charts mode: comparative scatter charts over the same window and filters as the table.
   One entry of CHARTS per chart (two metric ids from metrics.json); points are the entities of the current view, the dashed lines are
   the league values from the view's league row, tones come from each metric's direction. Click a point to open the card. */
(function (g) {
  'use strict';
  const D = g.PicknEdgeData, W = g.PicknEdgeWindows, esc = W.esc;
  const GOOD = '#DFFBE9', BAD = '#F6E0E3', NEUTRAL = '#FBFFDF', POS = { G: '#4cc3d9', F: '#f2c14e', C: '#c58af9' };

  const CHARTS = [
    { id: 'teams-pace-drtg', entity: 'teams', view: 'profile', title: 'Pace × DRtg', x: 'pace', y: 'drtg' },
    { id: 'teams-efg-tov', entity: 'teams', view: 'profile', title: 'Opp eFG% × Opp TOV', x: 'o_efg', y: 'o_tov100' },
    { id: 'teams-ast-tov', entity: 'teams', view: 'profile', title: 'Opp AST × Opp TOV', x: 'o_ast100', y: 'o_tov100' },
    { id: 'teams-dreb-efg', entity: 'teams', view: 'profile', title: 'Shooting & Rebounding Defense', subtitle: 'DREB% × Opp eFG%', x: 't_dreb_pct', y: 'o_efg',
      note: 'Shooting allowed and defensive-rebound control; on its own it does not show how the result is produced.' },
    { id: 'teams-3pa-3p', entity: 'teams', view: 'shooting', title: 'Opp 3PA × Opp 3P%', x: 'o_a3_rate', y: 'o_fg3_pct' },
    { id: 'teams-expected-efg', entity: 'teams', view: 'shooting', title: 'Expected vs Actual eFG%', subtitle: 'Opp Expected eFG% × Opp eFG% · zone-based estimate, no defender pressure', x: 'o_exp_efg', y: 'o_efg', equal: true, residual: true, noAvg: true,
      note: 'Zone-based estimate: it does not include defender pressure. The residual (actual − expected) is not attributed automatically to contest quality or luck.' },
    { id: 'teams-rim-defense', entity: 'teams', view: 'shooting', title: 'At-the-Rim Defense', subtitle: 'Opp rim FGA share × Opp rim FG%', x: 'o_rim_rate', y: 'o_zs_rim_pct',
      note: 'Only shots at the rim, not the whole paint.' },
    { id: 'teams-rim-corner', entity: 'teams', view: 'shooting', title: 'Rim & Corner Exposure', subtitle: 'Opp rim FGA share × Opp corner 3PA share', x: 'o_rim_rate', y: 'o_corner3_rate',
      note: 'Shares of attempts by zone; not a full shot-quality measure and not proof of a specific defensive scheme.' },
    { id: 'players-usg-ts', entity: 'players', view: 'profile', title: 'Usage & Scoring Efficiency', subtitle: 'USG% × TS%', x: 'usg', y: 'ts_pct', byPosition: true,
      note: 'Load and scoring efficiency against the league average; all points have the same size (no minutes weighting).' },
    { id: 'players-efficient-scorers', entity: 'players', view: 'profile', type: 'venn', title: 'Efficient Scorers', subtitle: 'USG% top · TOV% bottom · TS% top',
      sets: [{ metric: 'usg', dir: 'high' }, { metric: 'tov_pct', dir: 'low' }, { metric: 'ts_pct', dir: 'high' }],
      note: 'Players in the top (or bottom) share of the pool on each measure; the pool is the table\'s list before search. Click a region to list its players.' },
  ];
  const vstate = { pct: [30, 30, 30], sel: null };
  const SET_COL = ['#5aa9e6', '#f2a65a', '#a58bf2'];

  function nice(lo, hi, count = 4) {
    const raw = (hi - lo) / count || 1, mag = Math.pow(10, Math.floor(Math.log10(raw))), step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw - 1e-12) || 10 * mag, ticks = [];
    for (let v = Math.ceil(lo / step - 1e-9) * step; v <= hi + 1e-9; v += step) ticks.push(+v.toFixed(8));
    return ticks;
  }
  const tone = (sx, dx, sy, dy) => { const n = (sx !== 0) + (sy !== 0); if (!n) return NEUTRAL; const s = (sx * dx + sy * dy) / n; return s > 0 ? GOOD : s < 0 ? BAD : NEUTRAL; };

  function scatter(chart, view, ids, byId, roster) {
    const mx = byId[chart.x], my = byId[chart.y], pts = [];
    for (const id of ids) {
      const a = view.get(id, chart.x)?.value, b = view.get(id, chart.y)?.value;
      if (Number.isFinite(a) && Number.isFinite(b)) pts.push({ id, a, b, name: chart.entity === 'teams' ? roster.teams[id] || id : roster.players[id]?.name || id, pos: view.row(id)?.pos });
    }
    if (pts.length < 2) return '<p class="fw-empty">Not enough data for this chart.</p>';
    const Wd = 520, H = 360, L = 52, R = 14, Tp = 14, B = 44;
    const ext = k => { const v = pts.map(p => p[k]), lo = Math.min(...v), hi = Math.max(...v), pad = (hi - lo) * .06 || 1; return [lo - pad, hi + pad]; };
    let [x0, x1] = ext('a'), [y0, y1] = ext('b');
    if (chart.equal) { x0 = y0 = Math.min(x0, y0); x1 = y1 = Math.max(x1, y1); }
    const X = v => L + (v - x0) / (x1 - x0) * (Wd - L - R), Y = v => H - B - (v - y0) / (y1 - y0) * (H - B - Tp);
    const lx = chart.noAvg ? null : view.league(chart.x)?.value, ly = chart.noAvg ? null : view.league(chart.y)?.value, sx = chart.entity === 'teams' ? -mx.direction : mx.direction, sy = chart.entity === 'teams' ? -my.direction : my.direction;   // team lens: green = favourable for the opposing player
    const dot = p => {
      const color = chart.byPosition ? POS[p.pos] || '#94a3b8' : chart.residual ? (p.b - p.a > 0.05 ? GOOD : p.b - p.a < -0.05 ? BAD : NEUTRAL) : tone(sx, Math.sign(p.a - lx), sy, Math.sign(p.b - ly));
      return `<g class="fc-pt" data-open="${esc(p.id)}" tabindex="0"><circle cx="${X(p.a).toFixed(1)}" cy="${Y(p.b).toFixed(1)}" r="${chart.entity === 'teams' ? 5 : 3.5}" fill="${color}" stroke="#0b1018"><title>${esc(p.name)} · ${esc(mx.label)} ${p.a.toFixed(mx.format.digits)}${mx.format.suffix} · ${esc(my.label)} ${p.b.toFixed(my.format.digits)}${my.format.suffix}</title></circle>${chart.entity === 'teams' ? `<text x="${(X(p.a) + 7).toFixed(1)}" y="${(Y(p.b) + 3).toFixed(1)}" class="fc-pl">${esc(p.id)}</text>` : ''}</g>`;
    };
    const ticks = (lo, hi, f, vertical) => nice(lo, hi).map(v => vertical
      ? `<line class="fc-tick" x1="${X(v)}" x2="${X(v)}" y1="${Tp}" y2="${H - B}"/><text x="${X(v)}" y="${H - B + 15}" text-anchor="middle">${v}</text>`
      : `<line class="fc-tick" x1="${L}" x2="${Wd - R}" y1="${Y(v)}" y2="${Y(v)}"/><text x="${L - 6}" y="${Y(v) + 3.5}" text-anchor="end">${v}</text>`).join('');
    const avg = Number.isFinite(lx) && Number.isFinite(ly) ? `<line class="fc-avg" x1="${X(lx)}" x2="${X(lx)}" y1="${Tp}" y2="${H - B}" stroke-dasharray="4 4" stroke="#6b7c93"/><line class="fc-avg" x1="${L}" x2="${Wd - R}" y1="${Y(ly)}" y2="${Y(ly)}" stroke-dasharray="4 4" stroke="#6b7c93"/>` : '';
    return `<svg viewBox="0 0 ${Wd} ${H}" class="fc-svg" role="img" aria-label="${esc(chart.title)}">${ticks(x0, x1, X, true)}${ticks(y0, y1, Y, false)}${avg}${chart.equal ? `<line x1="${X(x0)}" y1="${Y(x0)}" x2="${X(x1)}" y2="${Y(x1)}" stroke="#6b7c93" stroke-dasharray="2 4"/>` : ''}<line x1="${L}" x2="${Wd - R}" y1="${H - B}" y2="${H - B}" stroke="#3b4655"/><line x1="${L}" x2="${L}" y1="${Tp}" y2="${H - B}" stroke="#3b4655"/>
      <text class="fc-ax" x="${(L + Wd - R) / 2}" y="${H - 8}" text-anchor="middle">${esc(mx.label)}</text><text class="fc-ax" transform="translate(13 ${(Tp + H - B) / 2}) rotate(-90)" text-anchor="middle">${esc(my.label)}</text>${pts.map(dot).join('')}</svg>`;
  }

  /* Three-circle Venn: counts per region, region click lists the players. Cut-offs and membership come from scripts/metrics/venn.mjs. */
  async function vennHtml(chart, view, ids, byId, roster) {
    const mod = await D.analysis('venn');
    const items = ids.map(id => ({ id, values: chart.sets.map(s => view.get(id, s.metric)?.value) }));
    const sets = chart.sets.map((s, k) => ({ ...s, pct: vstate.pct[k], m: byId[s.metric] }));
    const r = mod.venn(items, sets);
    if (!r.n) return '<p class="fw-empty">No players with USG%, TOV% and TS% in this window and filters.</p>';
    const Wd = 420, H = 340, top0 = 40, bot = 38, availH = H - top0 - bot, R = Math.min(availH / 2.909, Wd * .26), dd = R * 1.05, rc = dd / Math.sqrt(3), hgt = 1.5 * rc + 2 * R, topY = top0 + (availH - hgt) / 2, cy = topY + R + rc / 2, cx = Wd / 2;
    const C = [[cx - dd / 2, cy - rc / 2], [cx + dd / 2, cy - rc / 2], [cx, cy + rc]], G = [cx, cy], circ = ([x, y]) => `M${x - R} ${y}a${R} ${R} 0 1 0 ${2 * R} 0a${R} ${R} 0 1 0 ${-2 * R} 0Z`;
    const unit = (p, q) => { const dx = p[0] - q[0], dy = p[1] - q[1], l = Math.hypot(dx, dy) || 1; return [dx / l, dy / l]; }, at = (p, u, k) => [p[0] + u[0] * k, p[1] + u[1] * k];
    const defs = C.map((p, k) => `<clipPath id="vi${k}"><path d="${circ(p)}"/></clipPath><clipPath id="vo${k}"><path clip-rule="evenodd" d="M0 0H${Wd}V${H}H0Z${circ(p)}"/></clipPath>`).join('');
    const keyOf = m => [0, 1, 2].map(k => m >> (2 - k) & 1).join('');
    const spot = key => { const on = [...key].map((b, k) => b === '1' ? k : -1).filter(k => k >= 0); if (on.length === 3) return G; if (on.length === 1) return at(C[on[0]], unit(C[on[0]], G), R * .5); const mid = [(C[on[0]][0] + C[on[1]][0]) / 2, (C[on[0]][1] + C[on[1]][1]) / 2]; return at(G, unit(mid, G), R * .77); };
    const nameOf = key => { const on = [...key].map((b, k) => b === '1' ? sets[k].m.label : null).filter(Boolean); return on.length === 1 ? on[0] + ' only' : on.length === 3 ? on.join(' + ') : on.join(' + ') + ' (without ' + sets[[...key].indexOf('0')].m.label + ')'; };
    const hit = [1, 2, 3, 4, 5, 6, 7].map(m => { const key = keyOf(m); let g = `<rect class="fc-vr${vstate.sel === key ? ' on' : ''}" width="${Wd}" height="${H}" data-region="${key}" tabindex="0" role="button" aria-label="${esc(nameOf(key))}: ${r.regions[key].n} players"/>`; for (let k = 2; k >= 0; k--) g = `<g clip-path="url(#v${key[k] === '1' ? 'i' : 'o'}${k})">${g}</g>`; return g; }).join('');
    const circles = C.map((p, k) => `<path d="${circ(p)}" fill="${SET_COL[k]}" fill-opacity=".2" stroke="${SET_COL[k]}" stroke-width="1.6" pointer-events="none"/>`).join('');
    const nums = [1, 2, 3, 4, 5, 6, 7].map(m => { const key = keyOf(m), [x, y] = spot(key), n = r.regions[key].n; return `<text class="fc-vn${n ? '' : ' zero'}" x="${x.toFixed(1)}" y="${(y + 7).toFixed(1)}" text-anchor="middle">${n}</text>`; }).join('');
    const cut = (s, k) => (s.dir === 'low' ? '≤ ' : '≥ ') + fmtV(s.m, r.cuts[k]);
    const fmtV = (m, v) => v.toFixed(m.format.digits) + m.format.suffix;
    const lab = [[0, 'start', Math.max(6, C[0][0] - R), topY - 22], [1, 'end', Math.min(Wd - 6, C[1][0] + R), topY - 22], [2, 'middle', cx, C[2][1] + R + 15]].map(([k, a, x, y]) => `<text class="fc-vl" x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="${a}" fill="${SET_COL[k]}">${esc(sets[k].m.label)} ${sets[k].dir === 'low' ? 'bottom' : 'top'} ${sets[k].pct}%</text><text class="fc-vl sub" x="${x.toFixed(1)}" y="${(y + 14).toFixed(1)}" text-anchor="${a}">${esc(cut(sets[k], k))}</text>`).join('');
    const list = vstate.sel ? `<div class="fc-detail"><h4>${esc(nameOf(vstate.sel))} · ${r.regions[vstate.sel].n} players</h4>${r.regions[vstate.sel].ids.length ? `<ul>${r.regions[vstate.sel].ids.map(id => `<li><button type="button" class="fc-pt" data-open="${esc(id)}" style="background:none;border:0;color:inherit;font:inherit;cursor:pointer;text-decoration:underline;padding:0">${esc(roster.players[id]?.name || id)}</button> <small>${esc(roster.teams[view.row(id)?.team] || '')} · ${esc(view.row(id)?.pos || '')}</small></li>`).join('')}</ul>` : '<p class="fw-empty">Nobody in this region.</p>'}</div>` : '';
    const controls = `<div class="fc-controls">${chart.sets.map((s, k) => `<label>${esc(byId[s.metric].label)} ${s.dir === 'low' ? 'bottom' : 'top'} %<input type="number" data-vpct="${k}" min="5" max="50" value="${vstate.pct[k]}"></label>`).join('')}</div>`;
    return `${controls}<svg class="fc-svg" viewBox="0 0 ${Wd} ${H}" role="group" aria-label="${esc(chart.title)}"><defs>${defs}</defs>${circles}${hit}${nums}${lab}</svg>${list}<p class="fc-note">${r.n} players with all three measures${r.unavailable ? ` · ${r.unavailable} without (not enough data)` : ''}.</p>`;
  }

  /** html of the gallery for the current view; `ids` = entities to plot (the table's list before search). */
  async function html(kind, viewName, state, ids) {
    const [view, { byId }, roster] = await Promise.all([W.view(kind, state), D.metrics(), D.roster()]);
    const charts = CHARTS.filter(c => c.entity === kind && c.view === viewName);
    const where = `${kind === 'teams' ? 'Teams' : 'Players'} · ${viewName === 'profile' ? 'Profile' : 'Shooting'} · ${W.label(state)}`;
    if (!charts.length) return `<section class="fc-gallery"><div class="fw-section-title"><h3>Comparative charts</h3><span>${esc(where)}</span></div><p class="fw-empty">No comparative charts for this view yet. Open a ${kind === 'teams' ? 'team' : 'player'} card (click a name in the Table) for its radar and trends.</p></section>`;
    const vennBodies = new Map();
    for (const c of charts.filter(c => c.type === 'venn')) vennBodies.set(c.id, await vennHtml(c, view, ids ?? view.keys, byId, roster));
    return `<section class="fc-gallery"><div class="fw-section-title"><h3>Comparative charts</h3><span>${esc(where)} · ${charts.length} ${charts.length === 1 ? 'chart' : 'charts'}</span></div><div class="fc-grid-gallery">${charts.map(c => `<div class="fc-card"><span class="fc-card-title">${esc(c.title)}</span><span class="fc-card-sub">${esc(c.subtitle || '')}</span>${c.type === 'venn' ? vennBodies.get(c.id) : scatter(c, view, ids ?? view.keys, byId, roster)}${c.note ? `<p class="fc-note">${esc(c.note)}</p>` : ''}${c.type === 'venn' ? '' : c.byPosition ? '<p class="fc-note"><span style="color:#4cc3d9">● Guard</span> <span style="color:#f2c14e">● Forward</span> <span style="color:#c58af9">● Center</span> · dashed lines = league values</p>' : c.equal ? '<p class="fc-note">Dotted line = actual equals expected · green: opponents shot better than expected (favourable for the opposing player), red: worse</p>' : '<p class="fc-note">Dashed lines = league values · green: favourable for the opposing player on both axes, red: unfavourable</p>'}</div>`).join('')}</div></section>`;
  }
  /** wire the venn controls and regions inside `host`; `redraw` re-renders the page */
  function wire(host, redraw) {
    host.querySelectorAll('[data-vpct]').forEach(i => { i.onchange = () => { vstate.pct[Number(i.dataset.vpct)] = Math.max(5, Math.min(50, Number(i.value) || 30)); vstate.sel = null; redraw(); }; });
    host.querySelectorAll('[data-region]').forEach(r => { r.onclick = () => { vstate.sel = vstate.sel === r.dataset.region ? null : r.dataset.region; redraw(); }; });
  }
  g.FantasyGallery = { html, wire };
})(globalThis);
