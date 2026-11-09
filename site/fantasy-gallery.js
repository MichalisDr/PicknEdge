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
    { id: 'teams-rim-defense', entity: 'teams', view: 'shooting', title: 'At-the-Rim Defense', subtitle: 'Opp rim FGA share × Opp rim FG%', x: 'o_rim_rate', y: 'o_zs_rim_pct',
      note: 'Only shots at the rim, not the whole paint.' },
    { id: 'teams-rim-corner', entity: 'teams', view: 'shooting', title: 'Rim & Corner Exposure', subtitle: 'Opp rim FGA share × Opp corner 3PA share', x: 'o_rim_rate', y: 'o_corner3_rate',
      note: 'Shares of attempts by zone; not a full shot-quality measure and not proof of a specific defensive scheme.' },
    { id: 'players-usg-ts', entity: 'players', view: 'profile', title: 'Usage & Scoring Efficiency', subtitle: 'USG% × TS%', x: 'usg', y: 'ts_pct', byPosition: true,
      note: 'Load and scoring efficiency against the league average; all points have the same size (no minutes weighting).' },
  ];

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
    const [x0, x1] = ext('a'), [y0, y1] = ext('b'), X = v => L + (v - x0) / (x1 - x0) * (Wd - L - R), Y = v => H - B - (v - y0) / (y1 - y0) * (H - B - Tp);
    const lx = view.league(chart.x)?.value, ly = view.league(chart.y)?.value, sx = chart.entity === 'teams' ? -mx.direction : mx.direction, sy = chart.entity === 'teams' ? -my.direction : my.direction;   // team lens: green = favourable for the opposing player
    const dot = p => {
      const color = chart.byPosition ? POS[p.pos] || '#94a3b8' : tone(sx, Math.sign(p.a - lx), sy, Math.sign(p.b - ly));
      return `<g class="fc-pt" data-open="${esc(p.id)}" tabindex="0"><circle cx="${X(p.a).toFixed(1)}" cy="${Y(p.b).toFixed(1)}" r="${chart.entity === 'teams' ? 5 : 3.5}" fill="${color}" stroke="#0b1018"><title>${esc(p.name)} · ${esc(mx.label)} ${p.a.toFixed(mx.format.digits)}${mx.format.suffix} · ${esc(my.label)} ${p.b.toFixed(my.format.digits)}${my.format.suffix}</title></circle>${chart.entity === 'teams' ? `<text x="${(X(p.a) + 7).toFixed(1)}" y="${(Y(p.b) + 3).toFixed(1)}" class="fc-pl">${esc(p.id)}</text>` : ''}</g>`;
    };
    const ticks = (lo, hi, f, vertical) => nice(lo, hi).map(v => vertical
      ? `<line class="fc-tick" x1="${X(v)}" x2="${X(v)}" y1="${Tp}" y2="${H - B}"/><text x="${X(v)}" y="${H - B + 15}" text-anchor="middle">${v}</text>`
      : `<line class="fc-tick" x1="${L}" x2="${Wd - R}" y1="${Y(v)}" y2="${Y(v)}"/><text x="${L - 6}" y="${Y(v) + 3.5}" text-anchor="end">${v}</text>`).join('');
    const avg = Number.isFinite(lx) && Number.isFinite(ly) ? `<line class="fc-avg" x1="${X(lx)}" x2="${X(lx)}" y1="${Tp}" y2="${H - B}" stroke-dasharray="4 4" stroke="#6b7c93"/><line class="fc-avg" x1="${L}" x2="${Wd - R}" y1="${Y(ly)}" y2="${Y(ly)}" stroke-dasharray="4 4" stroke="#6b7c93"/>` : '';
    return `<svg viewBox="0 0 ${Wd} ${H}" class="fc-svg" role="img" aria-label="${esc(chart.title)}">${ticks(x0, x1, X, true)}${ticks(y0, y1, Y, false)}${avg}<line x1="${L}" x2="${Wd - R}" y1="${H - B}" y2="${H - B}" stroke="#3b4655"/><line x1="${L}" x2="${L}" y1="${Tp}" y2="${H - B}" stroke="#3b4655"/>
      <text class="fc-ax" x="${(L + Wd - R) / 2}" y="${H - 8}" text-anchor="middle">${esc(mx.label)}</text><text class="fc-ax" transform="translate(13 ${(Tp + H - B) / 2}) rotate(-90)" text-anchor="middle">${esc(my.label)}</text>${pts.map(dot).join('')}</svg>`;
  }

  /** html of the gallery for the current view; `ids` = entities to plot (the table's list before search). */
  async function html(kind, viewName, state, ids) {
    const [view, { byId }, roster] = await Promise.all([W.view(kind, state), D.metrics(), D.roster()]);
    const charts = CHARTS.filter(c => c.entity === kind && c.view === viewName);
    const where = `${kind === 'teams' ? 'Teams' : 'Players'} · ${viewName === 'profile' ? 'Profile' : 'Shooting'} · ${W.label(state)}`;
    if (!charts.length) return `<section class="fc-gallery"><div class="fw-section-title"><h3>Comparative charts</h3><span>${esc(where)}</span></div><p class="fw-empty">No comparative charts for this view yet. Open a ${kind === 'teams' ? 'team' : 'player'} card (click a name in the Table) for its radar and trends.</p></section>`;
    return `<section class="fc-gallery"><div class="fw-section-title"><h3>Comparative charts</h3><span>${esc(where)} · ${charts.length} ${charts.length === 1 ? 'chart' : 'charts'}</span></div><div class="fc-grid-gallery">${charts.map(c => `<div class="fc-card"><span class="fc-card-title">${esc(c.title)}</span><span class="fc-card-sub">${esc(c.subtitle || '')}</span>${scatter(c, view, ids ?? view.keys, byId, roster)}${c.note ? `<p class="fc-note">${esc(c.note)}</p>` : ''}${c.byPosition ? '<p class="fc-note"><span style="color:#4cc3d9">● Guard</span> <span style="color:#f2c14e">● Forward</span> <span style="color:#c58af9">● Center</span> · dashed lines = league values</p>' : '<p class="fc-note">Dashed lines = league values · green: favourable for the opposing player on both axes, red: unfavourable</p>'}</div>`).join('')}</div></section>`;
  }
  g.FantasyGallery = { html };
})(globalThis);
