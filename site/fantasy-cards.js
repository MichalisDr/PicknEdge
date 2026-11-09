/* Fantasy player and team cards: profile values, per-game trend with rolling form and league band, player radar,
   box scores and the shot chart. Pure UI over PicknEdgeData: values come from the views, per-game values from the engine copy
   (the registry's own definitions), league percentiles and spreads are statistics of those per-game values. */
(function (g) {
  'use strict';
  const D = g.PicknEdgeData, W = g.PicknEdgeWindows, esc = W.esc;
  const T = () => g.FantasyTables;

  /* Player profile grid: [metric id, label, unit, secondary metric id, secondary unit] */
  const PROFILE = [['min', 'MIN', '', null, ''], ['usg', 'USG%', '', null, ''], ['pir', 'PIR', '/g', 'pir_min', '/m'], ['pts100', 'PTS', '/100', 'pts_g', '/g'],
    ['tov_pct', 'TOV%', '', 'tov_g', '/g'], ['ast100', 'AST', '/100', 'ast_g', '/g'], ['ftr', 'FTr', '', null, ''], ['nspir', 'nSPIR', '/g', 'nspir_min', '/m'],
    ['net_pir_usg', 'NetPIR/usg', '', null, ''], ['reb100', 'REB', '/100', 'reb_g', '/g'], ['fd100', 'FD', '/100', 'fd_g', '/g'],
    ['load', 'Offensive Load', '', 'bc', ' Box Creation'], ['ctov', 'cTOV%', '', 'tov100', ' TOV/100']];
  const TEAM_RADAR = [['2p', '2P'], ['3p', '3P'], ['ft', 'FT'], ['ast', 'AST'], ['dreb', 'DREB'], ['oreb', 'OREB'], ['blk', 'BLK'], ['stl', 'STL']];
  const RADAR = [['ft', 'FT'], ['2p', '2P'], ['3p', '3P'], ['ast', 'AST−TOV'], ['dreb', 'DREB'], ['oreb', 'OREB'], ['stlblk', 'STL+BLK'], ['fd', 'FD−FC']];
  const RSCALE = { game: { lo: -3, hi: 15, step: 3, suffix: '_g', label: 'Net PIR / game' }, per100: { lo: -10, hi: 50, step: 10, suffix: '_100', label: 'Net PIR / 100 poss' } };
  const LEVELS = { good: '#DFFBE9', bad: '#F6E0E3' };

  let dialog = null, cs = null;
  const order = (a, b) => a.date_utc.localeCompare(b.date_utc) || a.game - b.game;
  const fmt = (c, m, extra = '') => Number.isFinite(c?.value) ? c.value.toFixed(m.format.digits) + m.format.suffix + extra : '—';
  const fnum = (v, d = 1) => Number.isFinite(v) ? v.toFixed(d) : '—';

  /* ---------- per-game data (engine) ---------- */
  const leagueCache = new Map();
  async function rowsOf(entity, id) {
    const eng = await D.engine();
    if (entity === 'players') return (await D.games('players')).filter(r => r.player_id === id).sort(order);
    return eng.withOpponent(await D.games('teams')).filter(r => r.team === id).sort(order);
  }
  async function leagueBand(entity, def) {
    const key = entity + def.id;
    if (!leagueCache.has(key)) leagueCache.set(key, (async () => {
      const eng = await D.engine(), rows = entity === 'players' ? await D.games('players') : eng.withOpponent(await D.games('teams'));
      const v = rows.map(r => eng.evaluate(def, [r]).value).filter(Number.isFinite).sort((a, b) => a - b);
      const q = p => { if (!v.length) return null; const x = (v.length - 1) * p, lo = Math.floor(x), hi = Math.ceil(x); return v[lo] + (v[hi] - v[lo]) * (x - lo); };
      return { n: v.length, p2: q(.02), p25: q(.25), p75: q(.75), p98: q(.98) };
    })());
    return leagueCache.get(key);
  }
  /** Per-game points of a metric for one entity, with rolling value of the last 5 appearances and window membership. */
  async function series(entity, id, def, spec) {
    const eng = await D.engine(), rows = await rowsOf(entity, id);
    const team = rows.at(-1)?.team, set = spec ? await D.windowGames(team, spec) : null;
    return rows.map((r, i) => {
      const win = i >= 4 ? rows.slice(i - 4, i + 1) : null, roll = win ? eng.evaluate(def, win).value : null;
      return { game: r.game, round: r.round, opponent: r.opp, home: r.home, value: eng.evaluate(def, [r]).value, roll: Number.isFinite(roll) ? roll : null, recent: !set || set.has(r.game) };
    });
  }

  /* ---------- trend chart ---------- */
  function niceTicks(lo, hi) {
    const raw = (hi - lo) / 3 || 1, mag = Math.pow(10, Math.floor(Math.log10(raw))), step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw - 1e-12) || 10 * mag, out = [];
    for (let v = Math.ceil(lo / step - 1e-9) * step; v <= hi + 1e-9; v += step) out.push(+v.toFixed(8));
    return { ticks: out, dec: Math.min(4, (String(+step.toPrecision(6)).split('.')[1] || '').length) };
  }
  function chart(points, m, { small = false, diff = null, ref = null, league = null } = {}) {
    const valid = points.filter(p => Number.isFinite(p.value));
    if (!valid.length) return '<p class="fw-empty">Not enough data for this metric.</p>';
    const W_ = small ? 300 : 700, H = small ? 130 : 250, shared = league && league.n >= 10 && Number.isFinite(league.p2) && league.p98 > league.p2;
    let lo, hi;
    if (shared) { const pad = (league.p98 - league.p2) * .06; lo = league.p2 - pad; hi = league.p98 + pad; } else { lo = Math.min(...valid.map(p => p.value)); hi = Math.max(...valid.map(p => p.value)); }
    const span = hi - lo || 1, clamp = v => Math.min(hi, Math.max(lo, v)), x = i => 36 + i * (W_ - 72) / Math.max(1, points.length - 1), y = v => H - 42 - (clamp(v) - lo) / span * (H - 72), dig = m.format.digits;
    const lines = key => { const out = []; let line = []; points.forEach((p, i) => { if (Number.isFinite(p[key])) line.push(x(i) + ',' + y(p[key])); else { if (line.length > 1) out.push(line); line = []; } }); if (line.length > 1) out.push(line); return out; };
    const band = shared && Number.isFinite(league.p25) && Number.isFinite(league.p75), nt = niceTicks(lo, hi), hasRef = Number.isFinite(ref);
    const svg = `<svg viewBox="0 0 ${W_} ${H}" class="fw-curve" role="img" aria-label="${esc(m.label)} per game">${band ? `<rect class="fw-band" x="36" y="${y(league.p75).toFixed(1)}" width="${W_ - 72}" height="${Math.max(1, y(league.p25) - y(league.p75)).toFixed(1)}"/>` : ''}${nt.ticks.map(v => `<line class="fw-gl" x1="36" x2="${W_ - 36}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/><text x="32" y="${(y(v) + 3.5).toFixed(1)}" text-anchor="end">${v.toFixed(nt.dec)}</text>`).join('')}<line x1="36" x2="${W_ - 36}" y1="${H - 42}" y2="${H - 42}" stroke="#3b4655"/>${hasRef ? `<line class="fw-ref" x1="36" x2="${W_ - 36}" y1="${y(ref).toFixed(1)}" y2="${y(ref).toFixed(1)}"/>` : ''}${diff ? `<text class="fw-diff" x="${W_ - 8}" y="13" text-anchor="end" fill="${diff.color}"><title>${esc(diff.title)}</title>${diff.text}</text>` : ''}${lines('value').map(p => `<polyline points="${p.join(' ')}" fill="none" stroke="#ef3d25" stroke-opacity=".55" stroke-width="1.5"/>`).join('')}${lines('roll').map(p => `<polyline points="${p.join(' ')}" fill="none" stroke="#f2c14e" stroke-width="2.4" stroke-linejoin="round"/>`).join('')}${points.map((p, i) => !Number.isFinite(p.value) ? '' : `<g>${p.mark ? `<circle cx="${x(i)}" cy="${y(p.value)}" r="8.5" fill="none" stroke="#fff" stroke-width="2"/>` : ''}<circle cx="${x(i)}" cy="${y(p.value)}" r="3.5" fill="${p.recent === false ? '#7a4a45' : '#ef3d25'}"><title>R${p.round} · ${p.home ? 'vs' : '@'} ${esc(p.opponent)}: ${p.value.toFixed(dig)}</title></circle>${points.length <= 12 || i === points.length - 1 ? `<text x="${x(i)}" y="${y(p.value) - 10}" text-anchor="middle">${p.value.toFixed(dig)}</text><text x="${x(i)}" y="${H - 18}" text-anchor="middle">R${p.round}</text>` : ''}</g>`).join('')}</svg>`;
    return svg + `<div class="fw-leg"><span><i class="fw-k-g"></i>Per game</span><span><i class="fw-k-r"></i>Rolling 5</span>${hasRef ? `<span><i class="fw-k-s"></i>Season ${ref.toFixed(dig)}${m.format.suffix}</span>` : ''}${band ? '<span><i class="fw-k-b"></i>League P25–P75</span>' : ''}</div>`;
  }
  const diffOf = (cur, season, m) => {
    if (!Number.isFinite(cur) || !Number.isFinite(season)) return { text: '—', color: '#fff', title: 'Not enough data' };
    const d = cur - season, dig = m.format.digits, zero = Math.abs(d) < Math.pow(10, -dig) / 2, good = zero ? 0 : m.direction * d;
    return { text: zero ? '0' : (d < 0 ? '−' : '+') + Math.abs(d).toFixed(dig), color: good > 0 ? LEVELS.good : good < 0 ? LEVELS.bad : '#fff', title: (m.kind === 'pct' ? 'percentage points · ' : '') + 'sample minus Season' };
  };

  /** Chart for a metric id as a self-contained html string (also used by the table hover). */
  async function curveHtml(entity, id, metricId, { spec = null, small = false, views = null } = {}) {
    const eng = await D.engine(), def = eng.byId(metricId), { byId } = await D.metrics(), m = byId[metricId];
    const [pts, league] = await Promise.all([series(entity, id, def, spec && Object.keys(spec).length ? spec : null), leagueBand(entity, def)]);
    const kind = entity;
    const season = views ? views.season.get(id, metricId)?.value : (await D.view(kind, 'season')).get(id, metricId)?.value;
    const cur = views && views.cur ? views.cur.get(id, metricId)?.value : null;
    return chart(pts, m, { small, ref: season, league, diff: views && views.cur && views.winName !== 'season' ? diffOf(cur, season, m) : null });
  }

  /* ---------- card parts ---------- */
  function profileGrid(view, byId, sel) {
    return `<div class="fw-pgrid">${PROFILE.map(([id, label, unit, sid, sunit], i) => {
      const m = byId[id], c = view.get(cs.id, id), s = sid ? view.get(cs.id, sid) : null, sm = sid ? byId[sid] : null;
      const u = (v, t) => Number.isFinite(v) && t ? `<em>${t}</em>` : '';
      return `<button class="fw-metric ${i < 4 ? 'fw-m-lg' : i >= 11 ? 'fw-m-sm fw-m-wide' : 'fw-m-sm'}" data-metric="${id}" aria-pressed="${sel === id}" title="${esc(m.description)}"><span>${label}</span><strong>${fmt(c, m)}${u(c.value, unit)}</strong>${sm ? `<small>${fmt(s, sm)}${u(s.value, sunit)}</small>` : ''}</button>`;
    }).join('')}</div>`;
  }
  function teamMetrics(view, byId, sel) {
    const ids = T().COLUMNS.teams[cs.mode];
    return `<div class="fw-metrics">${ids.map(id => {
      const m = byId[id], c = view.get(cs.id, id), r = T().rankOf(view, id, c.value, m.direction);
      return `<button class="fw-metric" data-metric="${id}" aria-pressed="${sel === id}" title="${esc(m.description)}"><span>${esc(m.label)}</span><strong style="${r ? 'color:' + r.color : ''}">${fmt(c, m)}</strong>${r ? `<b class="fw-rank" style="color:${r.color}">${r.position}#</b>` : ''}</button>`;
    }).join('')}</div>`;
  }
  /* Radar geometry shared by the player and team radars. axes = [[label, value, otherValue?]], frac maps a value to 0..1 of the radius. */
  function radarSvg(axes, frac, rings, labelOf) {
    const n = axes.length, cx = 250, cy = 195, R = 135, pt = (i, f) => [cx + Math.sin(i * 2 * Math.PI / n) * R * f, cy - Math.cos(i * 2 * Math.PI / n) * R * f];
    const poly = f => axes.map((_, i) => pt(i, f).join(',')).join(' '), shape = (k, col, fo) => `<polygon points="${axes.map((a, i) => pt(i, Number.isFinite(a[k]) ? frac(a[k]) : 0).join(',')).join(' ')}" fill="${col}${fo}" stroke="${col}" stroke-width="2"/>`;
    const two = axes.some(a => a.length > 2);
    return `<svg viewBox="0 0 500 395" role="img" aria-label="Net contribution by category">${rings.map(v => `<polygon points="${poly(frac(v))}" fill="none" stroke="${v === 0 ? '#5c6e86' : '#344152'}"/><text x="257" y="${(cy - R * frac(v)).toFixed(0)}" fill="#8191a5">${labelOf(v)}</text>`).join('')}${axes.map((_, i) => `<path d="M${cx} ${cy}L${pt(i, 1).join(' ')}" stroke="#344152"/>`).join('')}${two ? shape(2, '#b48aff', '22') : ''}${shape(1, '#ef3d25', '25')}${axes.map((a, i) => { const [x, y] = pt(i, 1.23); return `<g><text x="${x}" y="${y - 4}" text-anchor="middle">${a[0]}</text><text x="${x}" y="${y + 13}" fill="${a[1] < 0 ? LEVELS.bad : '#ff8a78'}" text-anchor="middle">${fnum(a[1])}</text>${two ? `<text x="${x}" y="${y + 26}" fill="#b48aff" text-anchor="middle">${fnum(a[2])}</text>` : ''}</g>`; }).join('')}</svg>`;
  }
  function radar(view, byId, roster, cmpView) {
    const sc = RSCALE[cs.radar], frac = v => Math.min(1, Math.max(0, (v - sc.lo) / (sc.hi - sc.lo)));
    const axes = RADAR.map(([k, l]) => { const id = `rd_${k}${sc.suffix}`, a = [l, view.get(cs.id, id).value]; if (cs.cmp && cmpView.row(cs.cmp)) a.push(cmpView.get(cs.cmp, id).value); return a; });
    const rings = []; for (let v = sc.lo; v <= sc.hi + 1e-9; v += sc.step) rings.push(v);
    const options = view.keys.filter(k => k !== cs.id && view.get(k, 'gp').value > 0).map(k => [k, roster.players[k]?.name || k]).sort((x, y) => x[1].localeCompare(y[1]));
    const cmpName = cs.cmp ? roster.players[cs.cmp]?.name || cs.cmp : '';
    return `<section class="fw-radar"><div class="fw-section-title"><h3>Net Production Radar</h3><span>${sc.label}</span></div>
      <div class="fw-switch" role="group" aria-label="Radar basis">${[['game', 'Per game'], ['per100', 'Per 100 poss']].map(([k, l]) => `<button data-radar="${k}" aria-pressed="${cs.radar === k}">${l}</button>`).join('')}</div>
      <label class="fw-cmp">Compare with <select data-cmp><option value="">—</option>${options.map(([k, n]) => `<option value="${esc(k)}" ${k === cs.cmp ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>
      ${cs.cmp ? `<div class="fw-leg"><span><i class="fw-k-r"></i>${esc(roster.players[cs.id]?.name || cs.id)}</span><span><i style="background:#b48aff"></i>${esc(cmpName)}</span></div>` : ''}
      ${radarSvg(axes, frac, rings, v => v)}
      <details class="fw-method"><summary>How the radar is calculated</summary><p>Each axis is a net contribution: shooting points minus misses (FT = made − missed, 2P = 2 × made − missed, 3P = 3 × made − missed), assists minus turnovers, steals plus blocks minus blocks against, fouls drawn minus fouls committed; rebounds as they are. Per 100: offensive categories use the team's offensive possessions on court, DREB the defensive ones, the two mixed categories the average of both. Scales are fixed (per game −3 to 15, per 100 −10 to 50); zero sits at one sixth of the radius and negative values stay in the labels. Comparing two players uses the same scale and the same window for both.</p></details></section>`;
  }
  function teamRadar(view, season) {
    const axes = TEAM_RADAR.map(([k, l]) => [l, view.get(cs.id, `rt_${k}_100`).value]);
    const cohort = [view, season].flatMap(v => v.keys.flatMap(k => TEAM_RADAR.map(([x]) => v.get(k, `rt_${x}_100`).value))).filter(Number.isFinite);
    const limit = Math.ceil(Math.max(1, ...cohort) / 5) * 5, frac = v => Math.min(1, Math.max(0, v / limit));
    return `<section class="fw-radar"><div class="fw-section-title"><h3>Opponent Production Radar</h3><span>Net PIR / 100 opponent possessions</span></div>
      ${radarSvg(axes, frac, [.25, .5, .75, 1].map(f => limit * f), v => Math.round(v))}
      <details class="fw-method"><summary>How the radar is calculated</summary><p>What the opposing players produced against this team, per 100 opponent possessions: 2P = 2 × made − missed, 3P = 3 × made − missed, FT = made − missed, plus assists, defensive and offensive rebounds, blocks and steals. Rebounds count only the rebounds credited to players: the team totals also contain team rebounds (credited to nobody, for example off the buzzer or out of bounds), which are not production of any player. Negative contributions stay in the labels; the shape stops at zero. One scale for all axes and all teams (Season and the selected window).</p></details></section>`;
  }
  async function boxScores() {
    const eng = await D.engine(), rows = (await rowsOf('players', cs.id)).slice().reverse();
    if (!rows.length) return '';
    const teams = new Map(eng.withOpponent(await D.games('teams')).map(t => [t.game + '|' + t.team, t]));
    const v = (r, id) => eng.evaluate(eng.byId(id), [r]).value, d = (r, name) => eng.termValue([[1, name]], r);
    const f = (a, b) => `${a}/${b}`, clock = s => Math.floor(s / 60) + ':' + String(Math.round(s % 60)).padStart(2, '0');
    const body = rows.map(r => {
      const t = teams.get(r.game + '|' + r.team), res = t ? `${t.pts > t.o_pts ? 'W' : 'L'} ${t.pts}–${t.o_pts}` : '—';
      return `<tr><th><b>R${r.round}</b><small>${esc(String(r.date_utc).slice(0, 10))}</small></th><td class="fw-bs-opp">${r.home ? 'vs' : '@'} ${esc(r.opp)}</td><td>${res}</td><td>${clock(r.sec)}</td><td><b>${v(r, 'pts_g')}</b></td><td>${f(d(r, 'fgm'), d(r, 'fga'))}</td><td>${f(r.m3, r.a3)}</td><td>${f(r.m1, r.a1)}</td><td title="OR ${r.oreb} · DR ${r.dreb}">${v(r, 'reb_g')}</td><td>${r.ast}</td><td>${r.stl}</td><td>${r.blk}</td><td>${r.tov}</td><td>${r.pf}</td><td><b>${v(r, 'pir')}</b></td></tr>`;
    }).join('');
    return `<section class="fw-with fw-boxscores"><div class="fw-section-title"><h3>Box scores</h3><span>Season · ${rows.length} games</span></div><div class="fw-tbl"><table><thead><tr><th>Game</th><th class="fw-bs-opp">Opponent</th><th>Result</th><th>MIN</th><th>PTS</th><th>FG</th><th>3P</th><th>FT</th><th>REB</th><th>AST</th><th>STL</th><th>BLK</th><th>TOV</th><th>PF</th><th>PIR</th></tr></thead><tbody>${body}</tbody></table></div></section>`;
  }
  async function trendBlock(view, season, byId) {
    const m = byId[cs.selected], eng = await D.engine(), spec = cs.win === 'season' ? null : W.spec(cs);
    const [pts, league] = await Promise.all([series(cs.entity, cs.id, eng.byId(cs.selected), spec), leagueBand(cs.entity, eng.byId(cs.selected))]);
    const cur = view.get(cs.id, cs.selected), base = season.get(cs.id, cs.selected);
    let insight = '';
    if (cs.entity === 'players') {
      const inWin = pts.filter(p => p.recent && Number.isFinite(p.value)).map(p => p.value), n = inWin.length, mean = inWin.reduce((a, b) => a + b, 0) / (n || 1);
      const sd = n > 1 ? Math.sqrt(inWin.reduce((a, b) => a + (b - mean) * (b - mean), 0) / (n - 1)) : null, u = m.format.suffix, dg = m.format.digits;
      const box = (t, v, s) => `<div class="fw-ibox"><span>${t}</span><strong>${v}</strong><small>${s}</small></div>`, ag = k => k + (k === 1 ? ' game' : ' games');
      insight = `<div class="fw-iboxes">${box('Season level', fmt(base, m), ag(season.get(cs.id, 'gp').value) + ' · Season')}${box('Range of appearances', n ? inWin.reduce((a, b) => Math.min(a, b)).toFixed(dg) + u + ' – ' + inWin.reduce((a, b) => Math.max(a, b)).toFixed(dg) + u : '—', ag(n) + ' · ' + W.label(cs))}${box('Variation', Number.isFinite(sd) ? 'σ ' + sd.toFixed(dg) + (m.kind === 'pct' ? ' pp' : '') : '—', 'standard deviation · ' + ag(n) + ' · ' + W.label(cs))}</div>`;
    }
    let ww = '';
    if (cs.entity === 'players') {
      const w = await withWithoutBlock(eng.byId(cs.selected), m);
      ww = w.html;
      if (cs.mate && w.marks.has(cs.mate)) pts.forEach(p => { p.mark = w.marks.get(cs.mate).has(p.game); });
    }
    return `<section class="fw-trend"><div class="fw-section-title"><h3>${esc(m.label)}</h3><b>${fmt(cur, m)}</b></div>${chart(pts, m, { ref: base.value, league, diff: cs.win === 'season' ? null : diffOf(cur.value, base.value, m) })}${insight}${ww}</section>`;
  }

  /* ---------- with / without a teammate (whole season) ---------- */
  let wwCache = null;
  async function wwData() {
    if (!wwCache) wwCache = (async () => {
      const [players, teams, mod] = await Promise.all([D.games('players'), D.games('teams'), D.analysis('samples')]);
      const rowsBy = new Map(), teamOf = new Map(), roundOf = new Map();
      for (const r of players) (rowsBy.get(r.player_id) || rowsBy.set(r.player_id, []).get(r.player_id)).push(r);
      for (const [pid, rows] of rowsBy) teamOf.set(pid, rows.slice().sort(order).at(-1).team);
      for (const t of teams) (roundOf.get(t.team) || roundOf.set(t.team, new Map()).get(t.team)).set(t.game, t.round);
      return { rowsBy, teamOf, roundOf, mod };
    })();
    return wwCache;
  }
  async function withWithoutBlock(def, m) {
    const eng = await D.engine(), roster = await D.roster(), { rowsBy, teamOf, roundOf, mod } = await wwData();
    const mates = mod.withWithout(cs.id, rowsBy, roundOf, teamOf), dig = m.format.digits, u = m.format.suffix;
    const rows = mates.map(x => ({ ...x, a: eng.evaluate(def, x.withRows).value, b: eng.evaluate(def, x.withoutRows).value }));
    const fv = v => Number.isFinite(v) ? v.toFixed(dig) + u : '—', ag = k => k + (k === 1 ? ' game' : ' games');
    const marks = new Map(rows.map(x => [x.pid, new Set(x.withoutRows.map(r => r.game))]));
    const df = x => {
      if (!Number.isFinite(x.a) || !Number.isFinite(x.b)) return '<td>—</td>';
      const d = x.b - x.a, zero = Math.abs(d) < Math.pow(10, -dig) / 2, good = zero ? 0 : m.direction * d;
      return `<td style="color:${good > 0 ? LEVELS.good : good < 0 ? LEVELS.bad : 'inherit'}">${zero ? '0' : (d < 0 ? '−' : '+') + Math.abs(d).toFixed(dig)}${m.kind === 'pct' ? ' pp' : ''}</td>`;
    };
    const body = rows.map(x => `<tr${cs.mate === x.pid ? ' class="on"' : ''}><th><button type="button" data-mate="${esc(x.pid)}" aria-pressed="${cs.mate === x.pid}">${esc(roster.players[x.pid]?.name || x.pid)}<small>${esc(roster.players[x.pid]?.pos || '—')}</small></button>${x.nWith < 3 || x.nWithout < 3 ? '<em class="fw-small">small sample</em>' : ''}</th><td>${fv(x.a)}<small>${x.nWith} gm</small></td><td>${fv(x.b)}<small>${x.nWithout} gm</small></td>${df(x)}</tr>`).join('');
    const mate = rows.find(x => x.pid === cs.mate);
    const detail = mate ? `<div class="fw-absent"><h4>Without ${esc(roster.players[mate.pid]?.name || mate.pid)} · ${ag(mate.nWithout)}</h4><ul>${mate.withoutRows.map(r => `<li><span>R${r.round}</span><span>${esc(r.opp)}</span><b>${fv(eng.evaluate(def, [r]).value)}</b></li>`).join('')}</ul></div>` : '';
    const mine = (rowsBy.get(cs.id) || []).filter(r => r.team === teamOf.get(cs.id)).length;
    const html = `<section class="fw-with"><div class="fw-section-title"><h3>With / without a teammate</h3><span>Season · ${ag(mine)} · difference = without − with</span></div>${rows.length ? `<div class="fw-tbl"><table><thead><tr><th>Teammate</th><th>With</th><th>Without</th><th>Difference</th></tr></thead><tbody>${body}</tbody></table></div>` : '<p class="fw-empty">No teammates with recorded absences.</p>'}${detail}</section>`;
    return { html, marks };
  }

  /* ---------- matchup: where his PIR comes from x what the opponent allows to his position ---------- */
  const MU = { give: ['GIVES', '#7fc6ac'], neu: ['NEUTRAL', '#b8c6d7'], cut: ['CUTS', '#e7919b'], na: ['—', '#6e839b'] };
  const VERDICT = { fav: ['POSITIVE', '#7fc6ac'], neu: ['NEUTRAL', '#b8c6d7'], neg: ['NEGATIVE', '#e7919b'] };
  async function matchupHtml(view, roster, team) {
    const eng = await D.engine(), M = await D.analysis('matchup'), pos = view.row(cs.id)?.pos;
    if (!pos) return '<p class="fw-empty">No roster position for this player.</p>';
    const sched = await D.schedule(), name = c => roster.teams[c] || c;
    const next = sched.filter(x => x.status !== 'result' && (x.home.code === team || x.away.code === team)).sort((a, b) => a.date.localeCompare(b.date))
      .map(x => ({ round: x.round, date: String(x.date).slice(0, 10), opp: x.home.code === team ? x.away.code : x.home.code, home: x.home.code === team }));
    const others = Object.keys(roster.teams).filter(c => c !== team).sort((a, b) => name(a).localeCompare(name(b)));
    if (!cs.mu.opp || cs.mu.opp === team) cs.mu.opp = next[0]?.opp || others[0];
    const opp = cs.mu.opp, fx = next.find(x => x.opp === opp), nwin = cs.mu.win;
    const sel = `<div class="mu-controls"><label>Opponent <select data-mu="opp" aria-label="Opponent">${next.length ? `<optgroup label="Next games">${next.slice(0, 6).map(x => `<option value="${x.opp}" ${x.opp === opp ? 'selected' : ''}>${esc(`R${x.round} · ${x.date} · ${name(x.opp)} (${x.home ? 'home' : 'away'})`)}</option>`).join('')}</optgroup>` : ''}<optgroup label="All teams">${others.map(c => `<option value="${c}" ${c === opp && !fx ? 'selected' : ''}>${esc(name(c))}</option>`).join('')}</optgroup></select></label><div role="group" aria-label="Player sample">${[['l3', 'Player: last 3'], ['l5', 'Player: last 5']].map(([k, l]) => `<button data-mu="win" data-v="${k}" aria-pressed="${nwin === k}">${l}</button>`).join('')}</div></div>`;
    const [pv, p3, p5, t3, t5] = await Promise.all([D.view('players', nwin), D.view('positions', 'l3'), D.view('positions', 'l5'), D.view('teams', 'l3'), D.view('teams', 'l5')]);
    const gp = pv.get(cs.id, 'gp').value;
    if (!gp) return sel + '<p class="fw-empty">No recent games for this player.</p>';
    const values = {}, factors = {};
    for (const s of M.SOURCES) {
      values[s.k] = pv.get(cs.id, s.metric).value;
      if (s.factor) factors[s.k] = [p3.get(opp + '|' + pos, s.factor)?.value ?? null, p5.get(opp + '|' + pos, s.factor)?.value ?? null];
    }
    const r = M.matchup(values, factors), [vText, vColor] = VERDICT[r.overall];
    const f2 = x => Number.isFinite(x) ? '×' + x.toFixed(2) : '—', f1 = x => Number.isFinite(x) ? x.toFixed(1) : '—';
    const label = { mu_a2: '2P attempts', mu_p2: '2P%', mu_a3: '3P attempts', mu_p3: '3P%', mu_a1: 'free throws', mu_fd: 'fouls drawn', mu_dr: 'defensive rebounds', mu_or: 'offensive rebounds', mu_as: 'assists', mu_tv: 'turnovers' };
    const pct = id => (id === 'mu_p2' ? 'pos_fg2_pct' : 'pos_fg3_pct');
    const detail = s => s.show.map(id => id === 'mu_p2' || id === 'mu_p3'
      ? `${label[id]} ${f1(p3.get(opp + '|' + pos, pct(id))?.value)}% / ${f1(p5.get(opp + '|' + pos, pct(id))?.value)}% (league ${f1(p5.leagueOf(pos, pct(id))?.value)}%)`
      : `${label[id]} ${f2(p3.get(opp + '|' + pos, id)?.value)} / ${f2(p5.get(opp + '|' + pos, id)?.value)}`).join(' · ');
    const maxAbs = Math.max(1, ...r.sources.map(s => Math.abs(s.v || 0)));
    const srcRows = r.sources.filter(s => Math.abs(s.v) >= .2 || s === r.main).sort((a, b) => Math.abs(b.v) - Math.abs(a.v)).map(s => {
      const [cl, cc] = MU[s.c];
      return `<div class="mu-src${s === r.main ? ' main' : ''}" data-c="${s.c}"><div class="mu-src-head"><span class="mu-src-name">${s.name}${s === r.main ? ' <em>main source</em>' : ''}</span><span class="mu-src-val">${s.v >= 0 ? '+' : ''}${f1(s.v)} <small>PIR/game${s.v > 0 ? ' · ' + Math.round(100 * s.share) + '%' : ''}</small></span>${s.factor ? `<b class="mu-verdict" style="color:${cc};border-color:${cc}">${cl}</b>` : '<b class="mu-verdict na">—</b>'}</div><div class="mu-src-bar"><i style="width:${(100 * Math.abs(s.v) / maxAbs).toFixed(0)}%;background:${s.v < 0 ? '#e7919b55' : '#eda65f88'}"></i></div>${s.factor ? `<p class="mu-note">${esc(name(opp))} vs ${pos} (last 3 / last 5, per position minute against the league): ${detail(s)}${s.note ? ' · <i>' + esc(s.note) + '</i>' : ''}</p>` : '<p class="mu-note">Not driven directly by the opponent.</p>'}</div>`;
    }).join('');
    const rowsN = (await rowsOf('players', cs.id)).filter(x => x.team === team), set = await D.windowGames(team, { last: nwin === 'l3' ? 3 : 5 });
    const mine = rowsN.filter(x => set.has(x.game)), pirList = mine.map(x => eng.evaluate(eng.byId('pir'), [x]).value), mins = mine.map(x => Math.round(x.sec / 60));
    const mainTxt = r.main ? `Main source: <b>${r.main.name}</b> (${Math.round(100 * r.main.share)}% of his positive PIR) · the opponent ${r.main.c === 'give' ? '<b style="color:#7fc6ac">gives it</b>' : r.main.c === 'cut' ? '<b style="color:#e7919b">cuts it</b>' : 'is <b>neutral</b> on it'}${r.main.note === 'stable source' ? ' · stable source, gives a floor' : ''}` : '';
    const fxText = fx ? `R${fx.round} · ${fx.date} · ${fx.home ? 'home' : 'away'} · ` : '';
    const pace = (v, k) => v.get(k, 'poss_g')?.value;
    return `${sel}<section class="mu-summary" data-v="${r.overall}"><div><h3>${esc(roster.players[cs.id]?.name || cs.id)} (${pos}) · ${fxText}vs ${esc(name(opp))}</h3><p class="mu-big" style="color:${vColor}">${vText}</p><p class="mu-main">${mainTxt}</p></div>
      <div class="mu-ctx"><div><span>PIR last ${gp}</span><strong>${f1(pv.get(cs.id, 'pir').value)}</strong><small>${pirList.join(', ')}</small></div><div><span>Minutes</span><strong>${f1(pv.get(cs.id, 'min').value)}′</strong><small>${mins.join(', ')}</small></div><div><span>Pace (possessions / game)</span><strong>${f1(pace(t5, opp))}</strong><small>${esc(name(opp))} last 3 ${f1(pace(t3, opp))} · ${esc(name(team))} ${f1(pace(t5, team))} · league ${f1(t5.league('poss_g')?.value)}</small></div></div></section>
      <section class="mu-group"><h3>WHERE HIS PIR COMES FROM · WHAT THE OPPONENT DOES ABOUT IT</h3>${srcRows}</section>
      <p class="pc-note">Player: average per game over his last ${gp} games (net: made − missed). Opponent: what it allowed to ${pos} (EuroLeague roster positions, with manual overrides) over its last 3 and last 5 games, per minute of the position, against the whole league over the same games. GIVES ≥ ×1.08 · CUTS ≤ ×0.92 (mean of last 3 and last 5). The verdict follows the player's main source; if the opponent does not touch it, the weighted total counts. Thresholds are heuristics to be evaluated.</p>`;
  }

  /* ---------- dialog ---------- */
  async function draw() {
    if (!dialog) return;
    const root = dialog.querySelector('.fw-card'), mine = cs.token = (cs.token || 0) + 1;
    const kind = cs.entity;
    try {
      const [view, season, teamsView, { byId }, roster] = await Promise.all([W.view(kind, cs), D.view(kind, 'season'), W.view('teams', cs), D.metrics(), D.roster()]);
      if (mine !== cs.token || !dialog) return;
      const row = view.row(cs.id) || season.row(cs.id);
      if (!row) { root.textContent = 'No data available.'; return; }
      const players = kind === 'players', gp = players ? view.get(cs.id, 'gp').value : view.row(cs.id)?.games;
      const team = players ? row.team : cs.id, name = players ? roster.players[cs.id]?.name || cs.id : roster.teams[cs.id] || cs.id;
      const logoId = roster.logoIds?.[team], logo = (g.PICKNEDGE_TEAMS || []).find(t => t.id === logoId)?.logo;
      const sel = cs.selected && byId[cs.selected] ? cs.selected : null;
      let visual = '';
      if (!gp && players) visual = '<p class="fw-empty">No appearances in this sample.</p>';
      else if (cs.mode === 'matchup') visual = await matchupHtml(view, roster, team);
      else if (sel) visual = await trendBlock(view, season, byId);
      else if (cs.mode === 'shooting') visual = '<div class="fw-shots" data-shots></div>';
      else if (players) visual = radar(view, byId, roster, cs.cmp ? await W.view('players', cs) : null);
      else visual = teamRadar(view, season);
      root.innerHTML = `<header class="fw-identity">${logo ? `<img src="${esc(logo)}" alt="">` : ''}<div><small>${players ? 'PLAYER' : 'TEAM'} / FANTASY</small><h2>${esc(name)}</h2><p>${players ? esc(roster.teams[team] || team) + ' · ' + esc(row.pos || '—') : ''}</p></div><b>${gp || 0} GP</b></header>
        <div class="fw-card-controls"><div class="fw-switch" role="group" aria-label="Sample window">${W.buttons(cs, 'data-card-window')}</div><div class="fw-switch" role="tablist">${(players ? ['profile', 'shooting', 'matchup'] : ['profile', 'shooting']).map(v => `<button data-card-view="${v}" role="tab" aria-selected="${v === cs.mode}">${{ profile: 'Profile', shooting: 'Shooting', matchup: 'Matchup' }[v]}</button>`).join('')}</div></div>${W.customForm(cs)}
        ${!gp && players ? '' : players && cs.mode === 'profile' ? profileGrid(view, byId, sel) : players ? '' : teamMetrics(view, byId, sel)}<div class="fw-visual">${visual}</div>${players ? '<div data-box></div>' : ''}`;
      W.wire(root, cs, () => { cs.selected = null; draw(); }, 'data-card-window');
      root.querySelectorAll('[data-card-view]').forEach(b => { b.onclick = () => { cs.mode = b.dataset.cardView; cs.selected = null; draw(); }; });
      root.querySelectorAll('[data-metric]').forEach(b => { b.onclick = () => { cs.selected = cs.selected === b.dataset.metric ? null : b.dataset.metric; cs.mate = null; draw(); }; });
      root.querySelectorAll('[data-mate]').forEach(b => { b.onclick = () => { cs.mate = cs.mate === b.dataset.mate ? null : b.dataset.mate; draw(); }; });
      root.querySelectorAll('[data-mu]').forEach(el => { if (el.tagName === 'SELECT') el.onchange = () => { cs.mu.opp = el.value; draw(); }; else el.onclick = () => { cs.mu.win = el.dataset.v; draw(); }; });
      root.querySelectorAll('[data-radar]').forEach(b => { b.onclick = () => { cs.radar = b.dataset.radar; draw(); }; });
      const cmp = root.querySelector('[data-cmp]');
      if (cmp) cmp.onchange = () => { cs.cmp = cmp.value; draw(); };
      const shots = root.querySelector('[data-shots]');
      if (shots && (gp || !players)) g.FantasyShotChart.mount(shots, { kind, id: cs.id, team, spec: W.spec(cs), view, teamsView }, cs.shot);
      const box = root.querySelector('[data-box]');
      if (box && players) boxScores().then(h => { if (mine === cs.token && box.isConnected) box.innerHTML = h; });
    } catch (e) { root.textContent = 'Could not load the card: ' + e.message; }
  }

  function open(entity, id, from = {}) {
    close();
    cs = { entity, id, win: from.win || 'season', custom: from.custom || { last: 7, venue: 'all' }, customOpen: false, mode: from.mode || 'profile', selected: null, mate: null, cmp: '', mu: { opp: null, win: 'l5' }, radar: 'game', shot: { view: 'hex', hl: null, sc: false } };
    dialog = document.createElement('dialog');
    dialog.className = 'fw-dialog';
    dialog.innerHTML = '<button class="fw-close" aria-label="Close card">×</button><div class="fw-card"><p class="fw-empty" role="status">Loading…</p></div>';
    document.body.append(dialog);
    const previous = document.activeElement;
    const done = () => { close(); previous?.focus?.(); };
    dialog.querySelector('.fw-close').onclick = done;
    dialog.oncancel = e => { e.preventDefault(); done(); };
    dialog.onclick = e => { if (e.target === dialog) done(); };
    dialog.showModal();
    draw();
  }
  function close() { if (dialog) { dialog.close(); dialog.remove(); dialog = null; cs = null; } }
  g.addEventListener('hashchange', close);
  g.FantasyCards = { open, close, curveHtml };
})(globalThis);
