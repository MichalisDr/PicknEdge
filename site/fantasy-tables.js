/* Fantasy · Players and Teams tables on the new data layer (PicknEdgeData). Pure UI: values, labels, descriptions and
   better/worse directions all come from metrics.json and the views; nothing is calculated here except ranking and colours.
   Windows: Season / Last 10 / Last 5 / Last 3, each a built view. Player and team cards and charts arrive in step 3.4. */
(function (g) {
  'use strict';
  const D = g.PicknEdgeData, Elig = g.PicknEdgeEligibility, W = g.PicknEdgeWindows;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* Columns, groups, labels, sub-lines, default sorts and widths of the four tables: site/table-layouts.json. Ranks, quarters, order and combined rank: table-model.js. */
  let layoutPromise = null;
  const layoutFile = () => layoutPromise || (layoutPromise = fetch('table-layouts.json').then(r => { if (!r.ok) throw new Error('table-layouts.json ' + r.status); return r.json(); }));
  const TM = g.PicknEdgeTable;
  /* Extras of a metric, shown in its tooltip only (never as a column): PIR carries Non Scoring PIR (nsPIR) per 100 possessions. */
  const EXTRAS = { pir: { id: 'nspir100', label: 'nsPIR' } };
  const EVAL = { good: '#DFFBE9', avg: '#FBFFDF', bad: '#F6E0E3', neutral: '#bdc7d5' };   // good / average / bad evaluation palette (UI only)
  const EPS = 1e-9;

  const state = { entity: 'teams', view: 'profile', win: 'season', position: 'ALL', query: '', minMin: 0, minGp: 1, team: '', filters: false, showAll: false, sort: '', dir: 'desc', sel: [], colours: true, mode: 'table' };
  let host = null, drawId = 0;

  const eligibilityWindow = () => state.win;

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

  const POOL_NAMES = { ALL: 'All players', G: 'Guards', F: 'Forwards', C: 'Centers' };
  const fmtVal = (v, m) => Number.isFinite(v) ? v.toFixed(m.format.digits) + m.format.suffix : '—';
  let view2 = null;   // what the last draw showed (the header handlers need it)

  async function draw() {
    if (!host || !host.isConnected) return;
    const mine = ++drawId, teams = state.entity === 'teams';
    let M;
    try {
      const [view, { byId }, roster, manifest, status, TL] = await Promise.all([W.view(state.entity, state), D.metrics(), D.roster(), D.manifest(), D.status(), layoutFile()]);
      if (mine !== drawId) return;
      const tname = state.entity + '.' + state.view, T = TL.tables[tname], cols = T.groups.flat();
      // Availability gate: the gp of the availability window's view (L3 by default); the view is a built file, nothing is stored.
      const avail = !teams && manifest.eligibility.availability ? await D.view('players', manifest.eligibility.availability.window) : null;
      if (mine !== drawId) return;
      const rows = view.keys.map(id => {
        const r = view.row(id), gp = teams ? r.games : view.get(id, 'gp').value;
        return { id, name: teams ? roster.teams[id] || id : roster.players[id]?.name || r.name || id, team: r.team, pos: r.pos, gp,
          min: teams ? null : view.get(id, 'min').value, pir: teams ? null : view.get(id, 'pir').value, availGp: avail ? (avail.get(id, 'gp')?.value ?? 0) : null };
      });
      const ew = eligibilityWindow();
      const pool = teams ? rows : rows.filter(r => Elig.listed(manifest.eligibility, ew, r, r.availGp, state.showAll) && (state.position === 'ALL' || r.pos === state.position)
        && r.gp >= state.minGp && (r.min ?? 0) >= state.minMin && (!state.team || r.team === state.team));
      const q = state.query.trim().toLowerCase();
      const shown = pool.filter(r => !q || (r.name + ' ' + (roster.teams[r.team] || r.team || '')).toLowerCase().includes(q));
      // Cell model per column: value (null for "few shots"), rank among the pool (the rows before the search box), text colour.
      const few = (c, id) => c.few && !(view.get(id, c.few).value >= TL.fewBelow);
      const poolIds = pool.map(r => r.id), model = new Map();
      for (const c of cols) {
        const m = byId[c.metric], values = new Map(poolIds.map(id => [id, few(c, id) ? null : view.get(id, c.metric).value]));
        model.set(c.metric, { c, m, values, list: [...values.values()] });
      }
      const cur = state.sort && cols.some(c => c.metric === state.sort) ? { metric: state.sort, dir: state.dir } : T.defaultSort;
      const sel = state.sel.filter(id => cols.some(c => c.metric === id));
      let ordered;
      if (sel.length) {
        const sc = TM.combined(poolIds, sel.map(id => ({ dir: byId[id].direction, values: model.get(id).values })), poolIds);
        ordered = TM.order(shown.map(r => r.id), id => sc.get(id), 'desc');
      } else {
        const sm = model.get(cur.metric);
        ordered = TM.order(shown.map(r => r.id), id => few(sm.c, id) ? null : view.get(id, cur.metric).value, cur.dir);
      }
      const byRow = new Map(rows.map(r => [r.id, r]));
      const gallery = state.mode === 'charts' && g.FantasyGallery.available(state.entity, state.view) ? await g.FantasyGallery.html(state.entity, state.view, state, pool.map(r => r.id)) : '';
      if (mine !== drawId) return;
      M = { view, TL, T, tname, cols, model, few, roster, status, shown: ordered.map(id => byRow.get(id)), allNames: rows.map(r => r.name), poolN: pool.length, sel, cur, avg: leagueCells(view, cols.map(c => c.metric)), gallery, byId };
    } catch (e) {
      host.innerHTML = `<section class="fantasy-stats fw-workbench"><div class="fw-heading"><div><div class="eyebrow">FANTASY</div><h1>${teams ? 'Teams' : 'Players'}</h1></div></div><p class="fw-empty" role="status">Could not load the data: ${esc(e.message)}</p></section>`;
      return;
    }
    view2 = M;
    host.innerHTML = html(M);
    performance.mark('fantasy-table-ready');   // measured by the Phase 3 gate (time to table)
    wire();
  }

  function html({ view, TL, T, tname, cols, model, few, roster, status, shown, allNames, poolN, sel, cur, avg, gallery, byId }) {
    const teams = state.entity === 'teams', title = teams ? 'Teams' : 'Players', hasCharts = g.FantasyGallery.available(state.entity, state.view);
    const firstW = TM.firstColWidth(allNames, TL.firstCol), totalW = TM.tableWidth(TL, tname, firstW);
    const pos = new Map(); T.groups.forEach(gr => gr.forEach((c, ci) => pos.set(c.metric, { start: ci === 0, end: ci === gr.length - 1 })));
    const cls = c => 'fw-n' + (pos.get(c.metric).start ? ' g-start' : '') + (pos.get(c.metric).end ? ' g-end' : '');
    const header = cols.map(c => {
      const m = byId[c.metric], on = cur.metric === c.metric && !sel.length;
      return `<th class="${cls(c)}" aria-sort="${on ? (cur.dir === 'asc' ? 'ascending' : 'descending') : 'none'}"><button data-sort="${c.metric}" ${sel.includes(c.metric) ? 'data-sel' : ''} title="${esc(m.label + ': ' + m.description)}">${esc(c.label || m.label)}</button></th>`;
    }).join('');
    const tint = (c, value, rankInfo) => {
      if (!state.colours || !Number.isFinite(value)) return '';
      if (c.colour === 'zone') { const lg = view.league(c.metric)?.value; if (!Number.isFinite(lg)) return ''; const d = value - lg; return Math.abs(d) <= TL.zoneNeutralPp ? '' : 'color:var(--eval-' + (d > 0 ? 'good' : 'bad') + ')'; }
      if (c.colour === 'rank') { const qt = TM.quarter(rankInfo); if (!qt) return ''; const good = teams ? qt === 'bottom' : qt === 'top'; return 'color:var(--eval-' + (good ? 'good' : 'bad') + ')'; }   // teams: green = favourable for the opposing player
      return '';
    };
    const sub = (c, id) => {
      if (!c.sub) return '';
      if (c.sub.made) { const mm = view.get(id, c.sub.made).value, aa = view.get(id, c.sub.att).value; return Number.isFinite(aa) ? `<small class="fw-sub">${mm}/${aa}</small>` : ''; }
      const v = view.get(id, c.sub.metric).value;
      return Number.isFinite(v) ? `<small class="fw-sub">${esc(c.sub.text.replace('{v}', fmtVal(v, byId[c.sub.metric]).replace(/%$/, '')))}</small>` : '';
    };
    const cells = (key, avgRow) => cols.map(c => {
      const { m, list } = model.get(c.metric), cell = avgRow ? avg[c.metric] : view.get(key, c.metric), isFew = !avgRow && few(c, key);
      const r = !avgRow && !isFew ? TM.rankOf(list, cell.value, m.direction) : null;
      const tip = esc((c.label || m.label) + ': ' + m.description) + (isFew ? ' · few shots (under ' + TL.fewBelow + ' attempt per 100 possessions)' : '')
        + (!avgRow && EXTRAS[c.metric] ? ' · ' + EXTRAS[c.metric].label + ' ' + fmt(view.get(key, EXTRAS[c.metric].id), byId[EXTRAS[c.metric].id]) + ' / 100 poss' : '');
      const v = isFew ? '<span class="fw-v fw-few">-</span>' : `<span class="fw-v" style="${avgRow ? '' : tint(c, cell.value, r)}">${fmt(cell, m)}</span>`;
      return `<td class="${cls(c)}"><span class="fw-cell" ${avgRow ? '' : `data-id="${esc(key)}" data-metric="${c.metric}" tabindex="0"`} title="${tip}">${v}${r ? `<i class="fw-rk">#${r.position}</i>` : ''}${coverage(cell)}${avgRow ? '' : sub(c, key)}</span></td>`;
    }).join('');
    const body = shown.map(r => `<tr><th><button class="fw-name" data-open="${esc(r.id)}" title="${esc(r.name)}">${esc(r.name)}</button>${teams ? '' : '<span class="fw-cr-slot"></span>'}</th>${teams ? '' : `<td class="fw-tm" title="${esc(roster.teams[r.team] || r.team)}">${esc(r.team || '—')}</td>`}${cells(r.id, false)}</tr>`).join('');
    const filters = !teams && state.filters ? `<div class="fw-filters" role="dialog" aria-label="Filters">
      <label>Team<select data-filter="team"><option value="">All</option>${Object.entries(roster.teams).sort((a, b) => a[1].localeCompare(b[1])).map(([c, n]) => `<option value="${c}" ${c === state.team ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>
      <label>MIN ≥<input data-filter="minMin" type="number" min="0" value="${state.minMin}"></label>
      <label>GP ≥<input data-filter="minGp" type="number" min="0" value="${state.minGp}"></label>
      <label class="fw-check"><input data-filter="showAll" type="checkbox" ${state.showAll ? 'checked' : ''}> Show players below the form thresholds</label></div>` : '';
    const poolName = TM.poolLabel(teams ? 'All teams' : POOL_NAMES[state.position], poolN);
    const info = `<div class="fw-tinfo"><span>Rank among: ${esc(poolName)}</span><span>${sel.length ? 'Combined rank: ' + esc(sel.map(id => cols.find(c => c.metric === id).label || byId[id].label).join(' + ')) + ' (mean percentile). Click a header to clear.' : 'Click a header to sort. Shift+click (long-press on touch) combines columns.'}</span></div>`;
    return `<section class="fantasy-stats fw-workbench">
      <div class="fw-heading"><div><div class="eyebrow">FANTASY / ${teams ? 'TEAMS' : 'PLAYERS'}</div><h1>${title}</h1></div><span role="status">${esc(status)}</span></div>
      <div class="fw-periods"><div class="fw-switch" role="group" aria-label="Sample window">${W.buttons(state)}</div></div>
      <div class="fw-toolbar">
        <div class="fw-switch" role="tablist">${['profile', 'shooting'].map(v => `<button data-view="${v}" role="tab" aria-selected="${state.view === v}">${v === 'profile' ? 'Profile' : 'Shooting'}</button>`).join('')}</div>
        ${teams ? '' : `<div class="fw-switch" aria-label="Player position">${['ALL', 'G', 'F', 'C'].map(v => `<button data-position="${v}" aria-pressed="${v === state.position}">${v === 'ALL' ? 'All' : v}</button>`).join('')}</div>`}
        <div class="fw-right">${hasCharts ? `<div class="fw-switch" role="tablist">${['table', 'charts'].map(v => `<button data-fwmode="${v}" role="tab" aria-selected="${state.mode === v}">${v === 'table' ? 'Table' : 'Charts'}</button>`).join('')}</div>` : ''}<button class="fw-filter-btn" data-colours aria-pressed="${state.colours}">Colours</button>${teams ? '' : `<button class="fw-filter-btn" data-filters aria-expanded="${state.filters}">Filters</button>`}<input type="search" aria-label="Search Fantasy" placeholder="Search…" value="${esc(state.query)}"></div>
        ${filters}
      </div>
      ${gallery ? '' : info}${gallery}<div class="fw-tooltip" role="tooltip" hidden></div><div class="fw-table-wrap" ${gallery ? 'hidden' : ''}><table class="fw-t" style="width:${totalW}px"><colgroup><col style="width:${firstW}px">${teams ? '' : `<col style="width:${TL.teamWidth}px">`}${cols.map(() => `<col style="width:${TL.numWidth}px">`).join('')}</colgroup><thead><tr><th>${teams ? 'Team' : 'Player'}</th>${teams ? '' : '<th class="fw-tm">Team</th>'}${header}</tr></thead>
        <tbody>${body}<tr class="fw-average"><th title="full league${teams ? '' : ' · all players who played'} · ignores filters">League average</th>${teams ? '' : '<td class="fw-tm"></td>'}${cells(null, true)}</tr></tbody></table></div>
      <div class="fw-foot" ${gallery ? 'hidden' : ''}><span>${shown.length} ${teams ? 'teams' : 'players'} · ${esc(W.label(state))}</span>${teams
        ? '<span>#n = rank among the teams (1 = best defence: lowest value, highest for Opp TOV and DREB%; Pace: highest = #1). Text colour: best and worst quarter; green = favourable for the opposing player, red = unfavourable.</span>'
        : '<span>#n = rank among the players shown. Players who missed the last 3 games of their team, or who are below the thresholds of the selected window, are hidden unless you tick the box in Filters. n/m = games with the data out of games played. Zone FG% is coloured against the league average (±3 points is neutral); "-" = under 1 attempt per 100 possessions.</span>'}</div>
      <details class="fw-method"><summary>Sample &amp; calculations</summary><p>Last 3 / 5 / 10 are the team's most recent games, counting only the games the player actually played. Every ratio is a sum divided by a sum, never an average of game percentages. PIR has no Fantasy bonuses. USG%, TOV% and every "per 100" value use possessions counted from the play-by-play while the player is on court. Full list: docs/METRICS.md.</p></details>
    </section>`;
  }

  /* Header: click = sort best end first (again = reverse), Shift+click or long-press = add or remove the column from the combined rank. */
  function headerSort() {
    const current = () => (view2.sel.length ? null : view2.cur.metric);
    const toggle = id => { let s = state.sel.slice(); if (!s.length && current() && current() !== id) s = [current()]; s = s.includes(id) ? s.filter(x => x !== id) : [...s, id]; state.sel = s; draw(); };
    const plain = id => { const same = !view2.sel.length && view2.cur.metric === id; state.dir = same ? (view2.cur.dir === 'asc' ? 'desc' : 'asc') : TM.firstDirection(view2.byId[id].direction); state.sort = id; state.sel = []; draw(); };
    host.querySelectorAll('[data-sort]').forEach(b => {
      let timer = null, long = false;
      b.onpointerdown = e => { long = false; if (e.pointerType === 'mouse') return; timer = setTimeout(() => { long = true; toggle(b.dataset.sort); }, 500); };
      b.onpointerup = b.onpointerleave = b.onpointercancel = () => clearTimeout(timer);
      b.oncontextmenu = e => { if (long) e.preventDefault(); };
      b.onclick = e => { if (long) { long = false; return; } e.shiftKey ? toggle(b.dataset.sort) : plain(b.dataset.sort); };
    });
  }

  function wire() {
    const on = (sel, ev, fn) => host.querySelectorAll(sel).forEach(el => { el[ev] = () => fn(el); });
    W.wire(host, state, () => { state.sort = ''; state.sel = []; draw(); });
    on('[data-fwmode]', 'onclick', b => { state.mode = b.dataset.fwmode; draw(); });
    host.querySelectorAll('.fc-pt[data-open]').forEach(p => { p.onclick = () => g.FantasyCards.open(state.entity, p.dataset.open, { win: state.win }); });
    on('[data-view]', 'onclick', b => { state.view = b.dataset.view; state.sort = ''; state.sel = []; draw(); });
    on('[data-colours]', 'onclick', () => { state.colours = !state.colours; draw(); });
    on('[data-position]', 'onclick', b => { state.position = b.dataset.position; draw(); });
    headerSort();
    const filters = host.querySelector('[data-filters]');
    if (filters) filters.onclick = () => { state.filters = !state.filters; draw(); };
    on('[data-filter]', 'onchange', el => {
      const k = el.dataset.filter;
      state[k] = k === 'team' ? el.value : k === 'showAll' ? el.checked : Math.max(0, Number(el.value) || 0);
      draw();
    });
    on('[data-open]', 'onclick', b => g.FantasyCards.open(state.entity, b.dataset.open, { win: state.win }));
    hoverCurves();
    const search = host.querySelector('input[type=search]');
    search.oninput = e => { state.query = e.target.value; draw().then(() => { const i = host.querySelector('input[type=search]'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }); };
  }

  /* Hover / focus on a value: that entity's per-game curve for the metric (loads the per-game rows on first use). */
  function hoverCurves() {
    const tip = host.querySelector('.fw-tooltip');
    if (!tip) return;
    let pinned = null, token = 0;
    const hide = () => { token++; tip.hidden = true; };
    host.querySelectorAll('.fw-cell[data-id]').forEach(b => {
      const show = async () => {
        const mine = ++token, id = b.dataset.id, metric = b.dataset.metric;
        const [{ byId }, view, season] = await Promise.all([D.metrics(), W.view(state.entity, state), D.view(state.entity, 'season')]);
        const m = byId[metric], c = view.get(id, metric);
        const name = state.entity === 'teams' ? (await D.roster()).teams[id] : (await D.roster()).players[id]?.name;
        const spec = state.win === 'season' ? null : W.spec(state);
        const curve = await g.FantasyCards.curveHtml(state.entity, id, metric, { spec, small: true, views: { season, cur: view, winName: state.win } });
        if (mine !== token) return;
        tip.innerHTML = `<strong>${esc(name)} · ${esc(m.label)}</strong><p>${fmt(c, m)}</p>${EXTRAS[metric] ? `<p>${EXTRAS[metric].label}: ${fmt(view.get(id, EXTRAS[metric].id), byId[EXTRAS[metric].id])} / 100 poss</p>` : ''}${curve}<small>${esc(m.description)}</small>`;
        tip.hidden = false;
        const r = b.getBoundingClientRect();
        tip.style.left = Math.max(8, Math.min(innerWidth - tip.offsetWidth - 8, r.left)) + 'px';
        tip.style.top = Math.max(8, Math.min(innerHeight - tip.offsetHeight - 8, r.bottom + 8)) + 'px';
      };
      b.onmouseenter = () => { if (!pinned) show(); };
      b.onmouseleave = () => { if (!pinned) hide(); };
      b.onfocus = show;
      b.onblur = () => { pinned = null; hide(); };
      b.onclick = () => { if (pinned === b) { pinned = null; hide(); } else { pinned = b; show(); } };
    });
    host.onkeydown = e => { if (e.key === 'Escape') { pinned = null; hide(); } };
    const wrap = host.querySelector('.fw-table-wrap');
    if (wrap) wrap.onscroll = () => { pinned = null; hide(); };
  }

  function mount(target, entity = 'teams') {
    host = target;
    D.clearOldCaches();
    if (state.entity !== entity) { state.entity = entity; state.query = ''; state.sort = ''; state.sel = []; state.view = 'profile'; }
    host.innerHTML = '<section class="fantasy-stats fw-workbench fw-loading"><p class="fw-empty" role="status">Loading data…</p></section>';
    draw();
  }
  document.addEventListener('click', e => { if (state.filters && host?.isConnected && !e.target.closest('.fw-filters,[data-filters]')) { state.filters = false; draw(); } });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && state.filters && host?.isConnected) { state.filters = false; draw(); } });
  g.FantasyTables = { mount, state, rankOf };
})(globalThis);
