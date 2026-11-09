/* Betting · Statistics: team profile (offense / defense) and player profile tables on the new data layer (PicknEdgeData).
   Pure UI: values, labels, descriptions and directions come from metrics.json and the views. Ranking, tones and the
   Last-3-vs-Season difference are display comparisons of values that are already calculated. Team and player cards
   (and their charts) arrive in step 3.4. */
(function (g) {
  'use strict';
  const D = g.PicknEdgeData, W = g.PicknEdgeWindows, esc = W.esc;

  const TEAM_COLUMNS = {
    offense: ['pace', 'ortg', 't_efg', 't_fg2_pct', 't_fg3_pct', 't_a3_rate', 't_ftr', 't_oreb_pct', 't_tov100', 't_ast100', 'o_blk_pct', 'o_stl100'],
    defense: ['pace', 'drtg', 'o_efg', 'o_fg2_pct', 'o_fg3_pct', 'o_a3_rate', 'o_ftr', 't_dreb_pct', 'o_tov100', 'o_ast100', 't_blk_pct', 't_stl100'],
  };
  const PLAYER_VIEWS = {
    role: ['Role & efficiency', ['gp', 'gs', 'min', 'trend', 'usg', 'ts_pct', 'ast_pct', 'tov_pct', 'oreb_pct', 'dreb_pct', 'a3_rate', 'ftr']],
    p100: ['Per 100 possessions', ['min', 'pts100', 'reb100', 'oreb100', 'dreb100', 'ast100', 'm3_100', 'a3_100', 'a1_100', 'stl100', 'blk100', 'tov100', 'fd100']],
    pg: ['Per game', ['gp', 'min', 'pts_g', 'reb_g', 'oreb_g', 'dreb_g', 'ast_g', 'm3_g', 'a3_g', 'a1_g', 'stl_g', 'blk_g', 'tov_g', 'pf_g', 'fd_g']],
  };
  const TREND = { label: 'L3 vs Season', description: 'Difference of the last 3 team games from the season: minutes per game and USG%. Colour from ±4.' };
  const POSITIONS = { G: 'Guard', F: 'Forward', C: 'Center' };
  const EPS = 1e-9, GOOD_TOP = 5;

  const state = { entity: 'teams', side: 'offense', win: 'season', col: 1, dir: -1, query: '',
    pl: { view: 'role', team: '', pos: '', min: 10, query: '', col: 'min', dir: -1 } };
  let host = null, drawId = 0, pinned = null;

  const fmt = (c, m) => !Number.isFinite(c?.value) ? '—' : c.value.toFixed(m.format.digits) + m.format.suffix;
  const coverage = c => c && c.used !== null && c.used < c.of ? `<small class="miss" title="${c.used} of ${c.of} games had the data">${c.used}/${c.of}</small>` : '';
  const sign = (v, d = 1) => !Number.isFinite(v) ? '—' : (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(d);

  /* Rank 1..n for one metric (1 = best by the metric's direction; style metrics rank from the highest). */
  function ranks(view, id, direction) {
    const list = view.keys.map(k => [k, view.get(k, id).value]).filter(([, v]) => Number.isFinite(v)), out = {};
    for (const [k, v] of list) out[k] = 1 + list.filter(([, o]) => (direction === 0 ? 1 : direction) * (o - v) > EPS).length;
    out.n = list.length;
    return out;
  }
  const tone = (direction, rank, n) => !rank ? '' : direction === 0 ? 'neutral' : rank <= GOOD_TOP ? 'good' : rank >= n - GOOD_TOP + 1 ? 'bad' : '';

  async function draw() {
    if (!host || !host.isConnected) return;
    const mine = ++drawId;
    pinned = null;
    try {
      const [{ byId }, roster, status] = await Promise.all([D.metrics(), D.roster(), D.status()]);
      const model = state.entity === 'teams' ? await teamModel(byId, roster) : await playerModel(byId, roster);
      if (mine !== drawId) return;
      host.innerHTML = page(model, status, roster);
      wire(model);
    } catch (e) {
      host.innerHTML = `<section class="bet-stats"><p class="empty" role="status">Could not load the data: ${esc(e.message)}</p></section>`;
    }
  }

  /* ---------- teams ---------- */
  async function teamModel(byId, roster) {
    const ids = TEAM_COLUMNS[state.side], defs = ids.map(id => byId[id]);
    const view = await W.view('teams', state);
    const l3 = state.win === 'season' ? await D.view('teams', 'l3') : null;
    const rk = Object.fromEntries(ids.map(id => [id, ranks(view, id, byId[id].direction)]));
    const rk3 = l3 ? Object.fromEntries(ids.map(id => [id, ranks(l3, id, byId[id].direction)])) : null;
    const q = state.query.trim().toLowerCase();
    const rows = view.keys.filter(k => !q || (roster.teams[k] || k).toLowerCase().includes(q)).map(k => ({ id: k, name: roster.teams[k] || k, games: view.row(k).games, avg: false }));
    rows.push({ id: null, name: 'League average', avg: true });
    const col = Math.min(state.col, ids.length - 1), sortId = ids[col];
    const val = r => (r.avg ? view.league(sortId) : view.get(r.id, sortId)).value;
    rows.sort((a, b) => { const x = val(a), y = val(b); return !Number.isFinite(x) ? (Number.isFinite(y) ? 1 : 0) : !Number.isFinite(y) ? -1 : (x - y) * state.dir || Number(b.avg) - Number(a.avg) || a.name.localeCompare(b.name); });
    const lastN = W.LIST.find(w => w[0] === state.win)[2].last;
    return { kind: 'teams', ids, defs, view, rows, rk, rk3, col, nTeams: view.keys.length, lastN, byId };
  }

  function teamCells(m, r) {
    const { defs, view, rk, rk3 } = m;
    return defs.map((d, i) => {
      const c = r.avg ? view.league(d.id) : view.get(r.id, d.id);
      let rank = '';
      if (!r.avg) {
        const p = rk[d.id][r.id], t = tone(d.direction, p, rk[d.id].n);
        let extra = '';
        if (rk3) {
          const p3 = rk3[d.id][r.id];
          if (p3) { const delta = p - p3, arrow = Math.abs(delta) >= 5 ? (delta > 0 ? '↑' : '↓') : ''; extra = `<span class="rk3 ${arrow && d.direction !== 0 ? (delta > 0 ? 'up' : 'down') : ''}">L3 ${p3}${d.direction === 0 ? '' : arrow}</span>`; }
        }
        rank = p ? `<span class="rk-line"><span class="rk ${t}">#${p}</span>${extra}</span>` : '';
      }
      return `<td class="${i === m.col ? 'sorted-column' : ''}"><button class="stat-cell" data-id="${r.avg ? '' : r.id}" data-metric="${d.id}" aria-label="${esc((r.avg ? 'League average' : r.name) + ' · ' + d.label + ': ' + fmt(c, d))}"><span class="v">${fmt(c, d)}</span>${coverage(c)}${rank}</button></td>`;
    }).join('');
  }

  function teamPage(m) {
    const off = state.side === 'offense';
    const head = m.defs.map((d, i) => `<th scope="col" aria-sort="${i === m.col ? (state.dir === 1 ? 'ascending' : 'descending') : 'none'}"><button data-sort="${i}" title="${esc(d.description)}">${esc(d.label)}<span class="sort-arrow">${i === m.col ? (state.dir === 1 ? '↑' : '↓') : '↕'}</span></button></th>`).join('');
    const body = m.rows.map(r => `<tr class="${r.avg ? 'league-average' : ''}"><th scope="row"><span class="club-mark">${r.avg ? '—' : esc(r.name.slice(0, 2).toUpperCase())}</span>${esc(r.name)}${r.avg ? `<small>Full league · all ${m.nTeams} teams, summed</small>` : ''}</th><td class="gp">${r.avg ? '—' : m.lastN && r.games < m.lastN ? r.games + '/' + m.lastN : r.games}</td>${teamCells(m, r)}</tr>`).join('');
    return `<div class="stats-toolbar"><div class="side-switch" role="group" aria-label="Side of the game"><button data-side="offense" aria-pressed="${off}">Offense</button><button data-side="defense" aria-pressed="${!off}">Defense</button></div>
      <div class="period-switch" role="group" aria-label="Sample window">${W.buttons(state)}</div>
      <label class="team-search"><span class="sr-only">Search team</span><input id="team-search" type="search" placeholder="Search team…" value="${esc(state.query)}"></label></div>
      <div class="stats-caption"><span>${off ? 'What the team produces' : 'What it allows the opponent'}</span><span class="rank-legend"><span class="rk good">#1–5</span> best <span class="rk bad">#${m.nTeams - 4}–${m.nTeams}</span> worst${m.rk3 ? ' · L3 = rank over the last 3 games' : ''} · Hover or tap a value for details</span></div>
      <div class="stats-scroll" tabindex="0" aria-label="Team table, scrolls horizontally"><table class="teams-table ranked"><caption class="sr-only">${off ? 'Offensive' : 'Defensive'} team statistics, ranks and league average</caption>
        <thead><tr><th scope="col" class="club-head">Team</th><th scope="col">GP</th>${head}</tr></thead><tbody>${body}</tbody></table></div>
      ${m.rows.length === 1 ? '<p class="empty">No team found. The league average still covers the whole league.</p>' : ''}
      <div class="stats-foot"><span><i></i> The league average is sorted together with the teams by the selected column.</span><span>${m.rows.length - 1} / ${m.nTeams} teams</span></div>
      <details class="stats-method"><summary>Sample &amp; calculations</summary>${method(true)}</details>`;
  }

  /* ---------- players ---------- */
  async function playerModel(byId, roster) {
    const [pv, tv] = await Promise.all([W.view('players', state), W.view('teams', state)]);
    const need = state.pl.view === 'role' ? await Promise.all([D.view('players', 'l3'), D.view('players', 'season')]) : [null, null];
    const [l3, season] = need;
    const pl = state.pl, [, ids] = PLAYER_VIEWS[pl.view], q = pl.query.trim().toLowerCase();
    const rows = [];
    for (const id of pv.keys) {
      const r = pv.row(id), gp = pv.get(id, 'gp').value, min = pv.get(id, 'min').value;
      if (!gp || (min ?? 0) < pl.min) continue;
      if (pl.team && r.team !== pl.team) continue;
      if (pl.pos && r.pos !== pl.pos) continue;
      const name = roster.players[id]?.name || r.name || id;
      if (q && !name.toLowerCase().includes(q)) continue;
      let trend = null;
      if (l3) {
        const g3 = l3.get(id, 'gp').value, s = season.get(id, 'gp').value;
        trend = g3 && s ? { min: l3.get(id, 'min').value - season.get(id, 'min').value, usg: (l3.get(id, 'usg').value ?? NaN) - (season.get(id, 'usg').value ?? NaN), gp: g3 } : s ? { none: true } : null;
      }
      rows.push({ id, name, team: r.team, pos: r.pos, gp, teamGames: tv.row(r.team)?.games ?? null, trend });
    }
    const col = ids.includes(pl.col) ? pl.col : ids[0];
    const valueOf = r => col === 'trend' ? (r.trend?.min ?? null) : pv.get(r.id, col).value;
    rows.sort((a, b) => { const x = valueOf(a), y = valueOf(b); return !Number.isFinite(x) ? (Number.isFinite(y) ? 1 : 0) : !Number.isFinite(y) ? -1 : (x - y) * pl.dir || a.name.localeCompare(b.name); });
    const defs = ids.map(id => id === 'trend' ? { id, ...TREND } : byId[id]);
    return { kind: 'players', pv, rows, defs, col, teams: roster.teams, total: pv.keys.length };
  }

  function playerPage(m) {
    const pl = state.pl;
    const head = m.defs.map(d => `<th scope="col" aria-sort="${d.id === m.col ? (pl.dir === 1 ? 'ascending' : 'descending') : 'none'}"><button data-pl-sort="${d.id}" title="${esc(d.description)}">${esc(d.label)}<span class="sort-arrow">${d.id === m.col ? (pl.dir === 1 ? '↑' : '↓') : '↕'}</span></button></th>`).join('');
    const cell = (r, d) => {
      if (d.id === 'trend') {
        const t = r.trend, c = x => Math.abs(x) >= 4 ? (x > 0 ? 'up' : 'down') : '';
        if (!t) return '<span class="muted">—</span>';
        if (t.none) return '<small class="miss">did not play in the last 3 team games</small>';
        return `<span class="trend ${c(t.min)}">${sign(t.min)}′</span><small class="trend ${Number.isFinite(t.usg) ? c(t.usg) : ''}">USG ${sign(t.usg)}</small>`;
      }
      const c = m.pv.get(r.id, d.id);
      if (d.id === 'gp') return String(r.gp) + (r.teamGames && r.teamGames !== r.gp && state.win !== 'season' ? '/' + r.teamGames : '');
      return fmt(c, d) + coverage(c);
    };
    const body = m.rows.map(r => `<tr><th scope="row"><span class="player-name">${esc(r.name)}</span><small>${esc(m.teams[r.team] || r.team)} · ${esc(POSITIONS[r.pos] || '—')}</small></th>${m.defs.map(d => `<td class="${d.id === m.col ? 'sorted-column' : ''}">${cell(r, d)}</td>`).join('')}</tr>`).join('');
    const teams = Object.entries(m.teams).sort((a, b) => a[1].localeCompare(b[1]));
    return `<div class="stats-toolbar pl-toolbar"><div class="side-switch" role="group" aria-label="View">${Object.entries(PLAYER_VIEWS).map(([k, [t]]) => `<button data-pl-view="${k}" aria-pressed="${pl.view === k}">${t}</button>`).join('')}</div>
      <div class="period-switch" role="group" aria-label="Sample window">${W.buttons(state)}</div></div>
      <div class="stats-toolbar pl-filters"><label>Team<select id="pl-team"><option value="">All</option>${teams.map(([c, n]) => `<option value="${c}" ${pl.team === c ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>
        <label>Position<select id="pl-pos"><option value="">All</option>${Object.entries(POSITIONS).map(([k, n]) => `<option value="${k}" ${pl.pos === k ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
        <label>Minutes / game<select id="pl-min">${[0, 5, 10, 15, 20, 25].map(v => `<option value="${v}" ${pl.min === v ? 'selected' : ''}>${v ? '≥ ' + v : 'All'}</option>`).join('')}</select></label>
        <label class="team-search"><span class="sr-only">Search player</span><input id="pl-search" type="search" placeholder="Search player…" value="${esc(pl.query)}"></label></div>
      <div class="stats-scroll" tabindex="0" aria-label="Player table, scrolls horizontally"><table class="teams-table"><caption class="sr-only">Player statistics</caption>
        <thead><tr><th scope="col" class="club-head">Player</th>${head}</tr></thead><tbody>${body}</tbody></table></div>
      ${m.rows.length ? '' : '<p class="empty">No players match the filters.</p>'}
      <div class="stats-foot"><span>${m.rows.length} / ${m.total} players · ${esc(W.label(state))}</span><span>n/m = games with the data out of games played</span></div>
      <details class="stats-method"><summary>Sample &amp; calculations</summary>${method(false)}</details>`;
  }

  const method = teams => `<p>Source: official EuroLeague box scores and play-by-play, processed by a scheduled job; the page only reads ready files. Last 3 / 5 / 10 are each team's most recent games${teams ? '' : ', counting only the games the player played'}. Every ratio is a sum divided by a sum, never an average of game percentages.</p>
    <p>Possessions are counted from the play-by-play: a new possession starts each time the ball changes team (shot, free throws, turnover, defensive rebound, steal) and at the start of each period; technical free throws do not change possession. If a game has no usable play-by-play, the Oliver estimate is used.</p>
    ${teams ? '<p>Rank: #1 is the best team in the league for that side. On offense #1 produces the most (or loses the fewest balls); on defense #1 allows the least. Green: best 5, red: worst 5. Pace and offensive 3PA/FGA are style, ranked from the highest and without colour. The L3 rank next to the season rank is the rank over the last 3 games; the arrow marks a change of 5 places or more. Shooting and rebound rates describe the sample; they are not adjusted for opponent strength.</p>' : '<p>USG%, TOV% and every "per 100" value use possessions counted while the player is on court. AST% = assists / (team field goals made while on court − his own). BLK% = blocks / opponent two-point attempts while on court. Rebound shares count all rebounds available, including team rebounds.</p>'}
    <p>Full list of definitions: docs/METRICS.md.</p>`;

  /* ---------- page ---------- */
  function page(m, status, roster) {
    const teams = state.entity === 'teams';
    return `<section class="bet-stats"><div class="stats-heading"><div><div class="eyebrow">BETTING / STATISTICS</div><h1>${teams ? "Every team's profile." : "Every player's profile."}</h1><p>${teams ? "Compare each team's game with the competition average." : 'Role, minutes and pace over the season and the latest games.'}</p></div><span class="pill">${esc(W.label(state).toUpperCase())}</span></div>
      <p class="live-status" data-live="live" role="status"><span>${esc(status)}</span></p>
      <div class="entity-switch" role="group" aria-label="Statistics category"><button data-entity="teams" aria-pressed="${teams}">Teams <span>${Object.keys(roster.teams).length}</span></button><button data-entity="players" aria-pressed="${!teams}">Players <span>${Object.keys(roster.players).length}</span></button></div>
      ${teams ? teamPage(m) : playerPage(m)}<div id="stats-tooltip" class="stats-tooltip" role="tooltip" hidden></div></section>`;
  }

  async function tooltip(b, m) {
    const tip = host.querySelector('#stats-tooltip'), d = m.byId[b.dataset.metric], id = b.dataset.id;
    let ranksText = '';
    if (id) {
      const parts = [];
      for (const [w, label] of [['season', 'Season'], ['l5', 'L5'], ['l3', 'L3']]) {
        const v = await D.view('teams', w), r = ranks(v, d.id, d.direction)[id];
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
    W.wire(host, state, () => { pinned = null; draw(); });
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

  function mount(target) {
    host = target;
    D.clearOldCaches();
    host.innerHTML = '<section class="bet-stats"><p class="empty" role="status">Loading data…</p></section>';
    draw();
  }
  g.BettingTables = { mount, state };
})(globalThis);
