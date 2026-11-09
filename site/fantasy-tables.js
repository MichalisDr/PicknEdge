/* Fantasy · Players and Teams tables on the new data layer (PicknEdgeData). Pure UI: values, labels, descriptions and
   better/worse directions all come from metrics.json and the views; nothing is calculated here except ranking and colours.
   Windows: Season / Last 10 / Last 5 / Last 3 from the built views, plus a custom window (last N games, home or away)
   summed in the browser by the same engine the tests cover. Player and team cards and charts arrive in step 3.4. */
(function (g) {
  'use strict';
  const D = g.PicknEdgeData, Elig = g.PicknEdgeEligibility, W = g.PicknEdgeWindows;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* Which metrics each table shows (ids from metrics.json). */
  const COLUMNS = {
    players: {
      profile: ['min', 'usg', 'pts100', 'ast100', 'tov_pct', 'reb100', 'ftr', 'fd100', 'pir', 'nspir', 'net_pir_usg'],
      shooting: ['efg', 'fg2_pct', 'fg3_pct', 'ft_pct'],
    },
    teams: {
      profile: ['pace', 'drtg', 'o_efg', 'o_tov100', 'o_ast100', 't_dreb_pct', 'o_ftr', 'o_sc100', 'o_fb100', 'o_pot100'],
      shooting: ['o_efg', 'o_fg2_pct', 'o_fg3_pct', 'o_zs_rim_pct', 'o_zs_paint_pct', 'o_zs_mid_pct', 'o_zs_base_pct', 'o_zs_arc_pct', 'o_zs_corner_pct'],
    },
  };
  const EVAL = { good: '#DFFBE9', avg: '#FBFFDF', bad: '#F6E0E3', neutral: '#bdc7d5' };   // good / average / bad evaluation palette (UI only)
  const EPS = 1e-9;

  const state = { entity: 'teams', view: 'profile', win: 'season', custom: { last: 7, venue: 'all' }, customOpen: false, position: 'ALL', query: '', minMin: 0, minGp: 1, team: '', filters: false, showAll: false, sort: '', dir: -1 };
  let host = null, drawId = 0;

  const eligibilityWindow = () => state.win !== 'custom' ? state.win : state.custom.last <= 3 ? 'l3' : state.custom.last <= 5 ? 'l5' : state.custom.last <= 10 ? 'l10' : 'season';

  const fmt = (c, m) => !Number.isFinite(c?.value) ? '—' : c.value.toFixed(m.format.digits) + m.format.suffix;
  const coverage = c => c && c.used !== null && c.used < c.of ? `<small class="fw-cov" title="${c.used} of ${c.of} games had the data">${c.used}/${c.of}</small>` : '';

  /* Team rank (#1 = best defence) and colour (green = favourable for the opposing player) from the metric's direction. */
  function rankOf(view, id, value, direction) {
    const list = view.keys.map(k => view.get(k, id).value).filter(Number.isFinite);
    if (!Number.isFinite(value) || !list.length) return null;
    const q = v => (direction === 0 ? v : direction * v);                 // higher = better for the team (pace: higher = #1)
    const position = 1 + list.filter(v => q(v) > q(value) + EPS).length;
    if (direction === 0) return { position, color: EVAL.neutral };
    const worst = 1 + list.filter(v => q(v) < q(value) - EPS).length;      // 1 = worst defence = best for the opposing player
    const n = list.length;
    return { position, color: worst <= Math.ceil(n / 3) ? EVAL.good : worst > Math.ceil(n * 2 / 3) ? EVAL.bad : EVAL.avg };
  }

  /* League average row: every player (or team) of the window, straight from the view's league row; no per-game rows needed. */
  const leagueCells = (view, ids) => Object.fromEntries(ids.map(id => [id, view.league(id)]));

  async function draw() {
    if (!host || !host.isConnected) return;
    const mine = ++drawId, teams = state.entity === 'teams';
    let model;
    try {
      const [view, { byId }, roster, manifest, status] = await Promise.all([W.view(state.entity, state), D.metrics(), D.roster(), D.manifest(), D.status()]);
      if (mine !== drawId) return;
      const ids = COLUMNS[state.entity][state.view], defs = ids.map(id => byId[id]);
      const rows = view.keys.map(id => {
        const r = view.row(id), gp = teams ? r.games : view.get(id, 'gp').value;
        return { id, name: teams ? roster.teams[id] || id : roster.players[id]?.name || r.name || id, team: r.team, pos: r.pos, gp,
          min: teams ? null : view.get(id, 'min').value, pir: teams ? null : view.get(id, 'pir').value };
      });
      const ew = eligibilityWindow();
      const pool = teams ? rows : rows.filter(r => (state.showAll || Elig.eligible(manifest.eligibility, ew, r)) && (state.position === 'ALL' || r.pos === state.position)
        && r.gp >= state.minGp && (r.min ?? 0) >= state.minMin && (!state.team || r.team === state.team));
      const q = state.query.trim().toLowerCase();
      const shown = pool.filter(r => !q || (r.name + ' ' + (roster.teams[r.team] || r.team || '')).toLowerCase().includes(q));
      const sortId = ids.includes(state.sort) ? state.sort : ids[0];
      shown.sort((a, b) => { const x = view.get(a.id, sortId).value, y = view.get(b.id, sortId).value;
        return !Number.isFinite(x) ? (Number.isFinite(y) ? 1 : 0) : !Number.isFinite(y) ? -1 : (x - y) * state.dir; });
      model = { view, defs, roster, status, shown, avg: leagueCells(view, ids), sortId };
    } catch (e) {
      host.innerHTML = `<section class="fantasy-stats fw-workbench"><div class="fw-heading"><div><div class="eyebrow">FANTASY</div><h1>${teams ? 'Teams' : 'Players'}</h1></div></div><p class="fw-empty" role="status">Could not load the data: ${esc(e.message)}</p></section>`;
      return;
    }
    host.innerHTML = html(model);
    wire();
  }

  function html({ view, defs, roster, status, shown, avg, sortId }) {
    const teams = state.entity === 'teams', title = teams ? 'Teams' : 'Players';
    const header = defs.map(m => `<th aria-sort="${sortId === m.id ? (state.dir > 0 ? 'ascending' : 'descending') : 'none'}"><button data-sort="${m.id}" title="${esc(m.description)}">${esc(m.label)}</button></th>`).join('');
    const cells = (key, avgRow) => defs.map(m => {
      const c = avgRow ? avg[m.id] : view.get(key, m.id), r = teams && !avgRow ? rankOf(view, m.id, c.value, m.direction) : null;
      return `<td><span class="fw-cell" title="${esc(m.label + ': ' + m.description)}" style="${r ? 'color:' + r.color : ''}">${fmt(c, m)}${coverage(c)}${r ? `<small>#${r.position}</small>` : ''}</span></td>`;
    }).join('');
    const body = shown.map(r => `<tr><th><span class="fw-name">${esc(r.name)}</span>${teams ? '' : `<small>${esc(roster.teams[r.team] || r.team)} · ${esc(r.pos || '—')}</small>`}</th><td class="fw-gp">${r.gp}</td>${cells(r.id, false)}</tr>`).join('');
    const filters = !teams && state.filters ? `<div class="fw-filters" role="dialog" aria-label="Filters">
      <label>Team<select data-filter="team"><option value="">All</option>${Object.entries(roster.teams).sort((a, b) => a[1].localeCompare(b[1])).map(([c, n]) => `<option value="${c}" ${c === state.team ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>
      <label>MIN ≥<input data-filter="minMin" type="number" min="0" value="${state.minMin}"></label>
      <label>GP ≥<input data-filter="minGp" type="number" min="0" value="${state.minGp}"></label>
      <label class="fw-check"><input data-filter="showAll" type="checkbox" ${state.showAll ? 'checked' : ''}> Show players below the form thresholds</label></div>` : '';
    return `<section class="fantasy-stats fw-workbench">
      <div class="fw-heading"><div><div class="eyebrow">FANTASY / ${teams ? 'TEAMS' : 'PLAYERS'}</div><h1>${title}</h1></div><span role="status">${esc(status)}</span></div>
      <div class="fw-periods"><div class="fw-switch" role="group" aria-label="Sample window">${W.buttons(state)}</div></div>${W.customForm(state)}
      <div class="fw-toolbar">
        <div class="fw-switch" role="tablist">${['profile', 'shooting'].map(v => `<button data-view="${v}" role="tab" aria-selected="${state.view === v}">${v === 'profile' ? 'Profile' : 'Shooting'}</button>`).join('')}</div>
        ${teams ? '' : `<div class="fw-switch" aria-label="Player position">${['ALL', 'G', 'F', 'C'].map(v => `<button data-position="${v}" aria-pressed="${v === state.position}">${v === 'ALL' ? 'All' : v}</button>`).join('')}</div>`}
        <div class="fw-right">${teams ? '' : `<button class="fw-filter-btn" data-filters aria-expanded="${state.filters}">Filters</button>`}<input type="search" aria-label="Search Fantasy" placeholder="Search…" value="${esc(state.query)}"></div>
        ${filters}
      </div>
      <div class="fw-table-wrap"><table><thead><tr><th>${teams ? 'Team' : 'Player'}</th><th class="fw-gp">GP</th>${header}</tr></thead>
        <tbody>${body}<tr class="fw-average"><th>League average<small>full league${teams ? '' : ' · all players who played'} · ignores filters</small></th><td class="fw-gp">—</td>${cells(null, true)}</tr></tbody></table></div>
      <div class="fw-foot"><span>${shown.length} ${teams ? 'teams' : 'players'} · ${esc(W.label(state))}</span>${teams
        ? '<span>#1 = best defence: lowest value (DRtg, Opp eFG%, Opp AST, Opp FTr, opponent second-chance / fast-break / points-off-turnover, opponent shooting), highest for Opp TOV and DREB%. Pace: highest = #1. Green = favourable for the opposing player.</span>'
        : '<span>Players below the form thresholds of the selected window are hidden unless you change this in Filters. n/m = games with the data out of games played.</span>'}</div>
      <details class="fw-method"><summary>Sample &amp; calculations</summary><p>Last 3 / 5 / 10 are the team's most recent games, counting only the games the player actually played. Every ratio is a sum divided by a sum, never an average of game percentages. PIR has no Fantasy bonuses. USG%, TOV% and every "per 100" value use possessions counted from the play-by-play while the player is on court. Custom windows sum any selection of games (last N, home or away) in your browser with the same definitions. Full list: docs/METRICS.md.</p></details>
    </section>`;
  }

  function wire() {
    const on = (sel, ev, fn) => host.querySelectorAll(sel).forEach(el => { el[ev] = () => fn(el); });
    W.wire(host, state, () => { state.sort = ''; draw(); });
    on('[data-view]', 'onclick', b => { state.view = b.dataset.view; state.sort = ''; draw(); });
    on('[data-position]', 'onclick', b => { state.position = b.dataset.position; draw(); });
    on('[data-sort]', 'onclick', b => { state.dir = state.sort === b.dataset.sort ? -state.dir : -1; state.sort = b.dataset.sort; draw(); });
    const filters = host.querySelector('[data-filters]');
    if (filters) filters.onclick = () => { state.filters = !state.filters; draw(); };
    on('[data-filter]', 'onchange', el => {
      const k = el.dataset.filter;
      state[k] = k === 'team' ? el.value : k === 'showAll' ? el.checked : Math.max(0, Number(el.value) || 0);
      draw();
    });
    const search = host.querySelector('input[type=search]');
    search.oninput = e => { state.query = e.target.value; draw().then(() => { const i = host.querySelector('input[type=search]'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }); };
  }

  function mount(target, entity = 'teams') {
    host = target;
    D.clearOldCaches();
    if (state.entity !== entity) { state.entity = entity; state.query = ''; state.sort = ''; state.view = 'profile'; }
    host.innerHTML = '<section class="fantasy-stats fw-workbench fw-loading"><p class="fw-empty" role="status">Loading data…</p></section>';
    draw();
  }
  document.addEventListener('click', e => { if (state.filters && host?.isConnected && !e.target.closest('.fw-filters,[data-filters]')) { state.filters = false; draw(); } });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && state.filters && host?.isConnected) { state.filters = false; draw(); } });
  g.FantasyTables = { mount, state };
})(globalThis);
