/* Fantasy player and team cards: profile values, per-game trend with rolling form and league band, player radar,
   box scores and the shot chart. Pure UI over PicknEdgeData: values come from the views, per-game values from the engine copy
   (the registry's own definitions), league percentiles and spreads are statistics of those per-game values. */
(function (g) {
  'use strict';
  const SHOW_LAYOUT_LINES = false;
  const GROUP_EDGES = false;        // the group lines of layout.json shown as brighter outline sides of the tiles next to them (instead of separate lines)   // the 1px divider lines of layout.json on the desktop grid; false hides them
  const D = g.PicknEdgeData, W = g.PicknEdgeWindows, esc = W.esc;
  const T = () => g.FantasyTables;

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
    const svg = `<svg viewBox="0 0 ${W_} ${H}" class="fw-curve" role="img" aria-label="${esc(m.label)} per game">${band ? `<rect class="fw-band" x="36" y="${y(league.p75).toFixed(1)}" width="${W_ - 72}" height="${Math.max(1, y(league.p25) - y(league.p75)).toFixed(1)}"/>` : ''}${nt.ticks.map(v => `<line class="fw-gl" x1="36" x2="${W_ - 36}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/><text x="32" y="${(y(v) + 3.5).toFixed(1)}" text-anchor="end">${v.toFixed(nt.dec)}</text>`).join('')}<line x1="36" x2="${W_ - 36}" y1="${H - 42}" y2="${H - 42}" stroke="#3b4655"/>${hasRef ? `<line class="fw-ref" x1="36" x2="${W_ - 36}" y1="${y(ref).toFixed(1)}" y2="${y(ref).toFixed(1)}"/>` : ''}${diff ? `<text class="fw-diff" x="${W_ - 8}" y="13" text-anchor="end" fill="${diff.color}"><title>${esc(diff.title)}</title>${diff.text}</text>` : ''}${lines('value').map(p => `<polyline points="${p.join(' ')}" fill="none" stroke="#ef3d25" stroke-opacity=".55" stroke-width="1.5"/>`).join('')}${lines('roll').map(p => `<polyline points="${p.join(' ')}" fill="none" stroke="#f2c14e" stroke-width="2.4" stroke-linejoin="round"/>`).join('')}${points.map((p, i) => !Number.isFinite(p.value) ? '' : `<g><circle cx="${x(i)}" cy="${y(p.value)}" r="3.5" fill="${p.recent === false ? '#7a4a45' : '#ef3d25'}"><title>R${p.round} · ${p.home ? 'vs' : '@'} ${esc(p.opponent)}: ${p.value.toFixed(dig)}</title></circle>${points.length <= 12 || i === points.length - 1 ? `<text x="${x(i)}" y="${y(p.value) - 10}" text-anchor="middle">${p.value.toFixed(dig)}</text><text x="${x(i)}" y="${H - 18}" text-anchor="middle">R${p.round}</text>` : ''}</g>`).join('')}</svg>`;
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
  /* ---------- card metric grids: drawn from site/layout.json (24 columns) ----------
     Which metrics, where, how big and which secondary lines is all in the layout file; this code only turns a box into the old tile
     markup (classes fw-metric fw-m-lg / fw-m-sm, same CSS as before). Tile tier: the box's optional 'tier' field (lg / sm / strip), else by box area w*h: >= 36 large, 13..35 small, <= 12 strip. */
  let layoutPromise = null;
  const layoutFile = () => layoutPromise || (layoutPromise = fetch('layout.json').then(r => { if (!r.ok) throw new Error('layout.json ' + r.status); return r.json(); }));
  const ZONE_TINT = true;            // one-line switch: green/red tint of the player zone boxes by FG% versus the league zone average
  const ZONE_TINT_MAX = 0.38, ZONE_TINT_PP = 15;   // strongest alpha, reached at this many percentage points from the league
  const ZONE_FEW = 1;                // attempts per 100 possessions below this: "–" and a dimmed box
  const unitHtml = t => t ? `<em>${esc(t)}</em>` : '';
  function boxHtml(b, view, byId, sel, players, edge = '') {
    const m = byId[b.metric], c = view.get(cs.id, b.metric), label = b.label || m.label, area = `grid-area:${b.y + 1}/${b.x + 1}/span ${b.h}/span ${b.w}`, size = b.w * b.h;
    const r = players ? null : T().rankOf(view, b.metric, c.value, m.direction);
    const tint = r ? `color:${r.color}` : '';
    const rank = r ? `<b class="fw-rank">#${r.position}</b>` : '';
    const val = id => view.get(cs.id, id);
    const subs = (b.sub || []).map(sb => {
      const sm = byId[sb.metric], sc = val(sb.metric);
      if (!Number.isFinite(sc?.value)) return '';
      const num = sc.value.toFixed(sm.format.digits);
      const text = sb.text ? (sc.value === 0 && sb.zeroText ? sb.zeroText : sb.text.replace('{v}', num)) : (sb.label ? (sb.side ? `<i class="lx-sl">${esc(sb.label)}</i>` : sb.label + ' ') : '') + fmt(sc, sm) + (sb.unit ? `<em>${esc(sb.unit)}</em>` : '');
      return `<small${sb.side ? ' class="lx-side"' : ''}>${sb.text ? esc(text) : text}</small>`;   // side: shown on the right of the tile, small, not a metric of its own
    }).join('');
    const subTitle = (b.sub || []).filter(sb => sb.label).map(sb => ' · ' + sb.label + ': ' + byId[sb.metric].description).join('');
    const open = (cls, style, title) => `<button class="fw-metric ${cls}${edge}" style="${area}${style ? ';' + style : ''}" data-metric="${b.metric}" aria-pressed="${sel === b.metric}" title="${esc(title)}">`;
    if (b.kind === 'group') {   // several related metrics in one wide tile; each item keeps its own value and rank
      const items = b.items.map(it => {
        const im = byId[it.metric], ic = val(it.metric), ir = players ? null : T().rankOf(view, it.metric, ic.value, im.direction);
        return `<span class="lx-gi" data-metric="${it.metric}" role="button" tabindex="0" title="${esc(im.description)}"><span>${esc(it.label)}</span><lx-r>${ir ? `<b class="fw-rank">#${ir.position}</b>` : ''}<strong style="${ir ? 'color:' + ir.color : ''}">${fmt(ic, im)}${Number.isFinite(ic.value) ? unitHtml(it.unit) : ''}</strong></lx-r></span>`;
      }).join('');
      return `<div class="fw-metric lx-group${b.h > 1 ? ' lx-gv' : ''}${edge}" style="${area}"><span class="lx-gt">${esc(label)}</span>${items}</div>`;
    }
    if (b.kind === 'zone' && players) {
      const made = val(b.made).value, att = val(b.att).value, share = val(b.share).value, p100 = val(b.per100).value;
      const few = !(p100 >= ZONE_FEW), lg = view.league(b.metric)?.value;
      let style = '';
      if (ZONE_TINT && !few && Number.isFinite(c.value) && Number.isFinite(lg)) {
        const d = c.value - lg, a = Math.min(ZONE_TINT_MAX, Math.abs(d) / ZONE_TINT_PP * ZONE_TINT_MAX);
        style = `background:${d >= 0 ? `rgba(60,200,120,${a.toFixed(3)})` : `rgba(235,80,95,${a.toFixed(3)})`}`;
      }
      const tip = `${label}: ${Number.isFinite(share) ? share.toFixed(1) + '% of the player\'s shots' : 'no shots'} · ${Number.isFinite(p100) ? p100.toFixed(1) : '—'} attempts per 100 possessions${Number.isFinite(lg) ? ' · league FG% ' + lg.toFixed(1) + '%' : ''}${few ? ' · few shots' : ''}`;
      return `${open('fw-m-sm lx-zone' + (few ? ' lx-few' : ''), style, tip)}<span>${esc(label)}</span><strong>${few ? '–' : fmt(c, m)}</strong><small>${Number.isFinite(att) ? `${made}/${att}` : ''}</small></button>`;
    }
    if (b.kind === 'zone') return `${open('fw-m-sm lx-zone', '', m.description)}<span>${esc(label)}</span><strong style="${tint}">${fmt(c, m)}</strong>${rank}</button>`;
    const value = `<strong style="${tint}">${fmt(c, m)}${Number.isFinite(c.value) ? unitHtml(b.unit) : ''}</strong>`;
    const tier = b.tier || (size >= 36 ? 'lg' : size <= 12 ? 'strip' : 'sm');
    if (tier === 'strip') return `${open('fw-m-sm lx-strip', '', m.description + subTitle)}<span>${esc(label)}</span><lx-r>${rank}${value}${subs}</lx-r></button>`;
    return `${open(tier === 'lg' ? 'fw-m-lg' : 'fw-m-sm', '', m.description + subTitle)}<lx-t><span>${esc(label)}</span>${rank}${subs}</lx-t>${value}</button>`;
  }
  /* CSS length of grid line k (of `count` cells) on one axis: the middle of the gap between cell k-1 and k */
  const linePos = (k, count) => k <= 0 ? '0px' : k >= count ? '100%' : `(${k} * (100% - ${count - 1} * var(--gap)) / ${count} + ${k - 0.5} * var(--gap))`;
  /* Group lines as tile outline sides: a line on a grid line brightens the facing side of every box that touches it (top/bottom of a horizontal line, left/right of a vertical one). */
  function groupEdges(L) {
    const out = {};
    if (!GROUP_EDGES) return out;
    for (const l of L.lines) for (const b of L.boxes) {
      const add = c => { out[b.id] = (out[b.id] || '') + ' ' + c; };
      if (l.o === 'h' && b.x < l.x + l.n && b.x + b.w > l.x) { if (b.y === l.y) add('lx-e-t'); if (b.y + b.h === l.y) add('lx-e-b'); }
      if (l.o === 'v' && b.y < l.y + l.n && b.y + b.h > l.y) { if (b.x === l.x) add('lx-e-l'); if (b.x + b.w === l.x) add('lx-e-r'); }
    }
    return out;
  }
  async function layoutGrid(name, view, byId, sel, players) {
    const F = await layoutFile(), L = F.layouts[name];
    if (!L) throw new Error('no layout ' + name);
    const px = L.rowPx ?? F.rowPx ?? 24, rowsT = Array.from({ length: L.rows }, (_, i) => (Array.isArray(px) ? px[i] ?? px.at(-1) : px) + 'px').join(' ');   // row heights: one number, or one per row
    const edges = groupEdges(L), order = g.PicknEdgeLayout.stackOrder(L);   // DOM order = stacked order; desktop placement is by grid-area
    const lines = !SHOW_LAYOUT_LINES ? '' : L.lines.map(l => {
      const a = l.o === 'h' ? [l.x, l.x + l.n, 24, l.y, L.rows] : [l.y, l.y + l.n, L.rows, l.x, 24];
      return l.o === 'h'
        ? `<i class="lx-line" style="left:calc${linePos(a[0], a[2])};right:calc(100% - ${linePos(a[1], a[2])});top:calc${linePos(a[3], a[4])};height:1px"></i>`
        : `<i class="lx-line" style="top:calc${linePos(a[0], a[2])};bottom:calc(100% - ${linePos(a[1], a[2])});left:calc${linePos(a[3], a[4])};width:1px"></i>`;
    }).join('');
    return `<div class="lx" data-layout="${name}"><div class="lx-grid fw-pgrid" style="--rows:${L.rows};--gap:${F.gap ?? 8}px;--rowsT:${rowsT}">${order.map(b => boxHtml(b, view, byId, sel, players, edges[b.id] || '')).join('')}${lines}</div></div>`;
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
    const axes = RADAR.map(([k, l]) => { const id = `${cs.net === 'gross' ? 'rg' : 'rd'}_${k}${sc.suffix}`, a = [l, view.get(cs.id, id).value]; if (cs.cmp && cmpView.row(cs.cmp)) a.push(cmpView.get(cs.cmp, id).value); return a; });
    const rings = []; for (let v = sc.lo; v <= sc.hi + 1e-9; v += sc.step) rings.push(v);
    const options = view.keys.filter(k => k !== cs.id && view.get(k, 'gp').value > 0).map(k => [k, roster.players[k]?.name || k]).sort((x, y) => x[1].localeCompare(y[1]));
    const cmpName = cs.cmp ? roster.players[cs.cmp]?.name || cs.cmp : '';
    return `<section class="fw-radar"><div class="fw-section-title"><h3>Net Production Radar</h3><span>${cs.net === 'gross' ? sc.label.replace('Net', 'Gross') : sc.label}</span></div>
      <div class="fw-switch" role="group" aria-label="Radar contribution">${[['net', 'Net'], ['gross', 'Gross']].map(([k, l]) => `<button data-net="${k}" aria-pressed="${cs.net === k}">${l}</button>`).join('')}</div> <div class="fw-switch" role="group" aria-label="Radar basis">${[['game', 'Per game'], ['per100', 'Per 100 poss']].map(([k, l]) => `<button data-radar="${k}" aria-pressed="${cs.radar === k}">${l}</button>`).join('')}</div>
      <label class="fw-cmp">Compare with <select data-cmp><option value="">—</option>${options.map(([k, n]) => `<option value="${esc(k)}" ${k === cs.cmp ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>
      ${cs.cmp ? `<div class="fw-leg"><span><i class="fw-k-r"></i>${esc(roster.players[cs.id]?.name || cs.id)}</span><span><i style="background:#b48aff"></i>${esc(cmpName)}</span></div>` : ''}
      ${radarSvg(axes, frac, rings, v => v)}
      <details class="fw-method"><summary>How the radar is calculated</summary><p>Net: each axis is a net contribution: shooting points minus misses (FT = made − missed, 2P = 2 × made − missed, 3P = 3 × made − missed), assists minus turnovers, steals plus blocks minus blocks against, fouls drawn minus fouls committed; rebounds as they are. Per 100: offensive categories use the team's offensive possessions on court, DREB the defensive ones, the two mixed categories the average of both. Scales are fixed (per game −3 to 15, per 100 −10 to 50); zero sits at one sixth of the radius and negative values stay in the labels. Gross shows only the positive contributions (made free throws, 2 × made twos, 3 × made threes, assists, rebounds, steals plus blocks, fouls drawn) on the same scales. Comparing two players uses the same scale and the same window for both.</p></details></section>`;
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
      const box = (t, v, s) => `<div class="fw-ibox"><span>${t}</span><strong>${v}</strong><small>${s}${n < 3 ? ' · <em class="fw-small">small sample</em>' : ''}</small></div>`, ag = k => k + (k === 1 ? ' game' : ' games');
      insight = `<div class="fw-iboxes">${box('Season level', fmt(base, m), ag(season.get(cs.id, 'gp').value) + ' · Season')}${box('Range of appearances', n ? inWin.reduce((a, b) => Math.min(a, b)).toFixed(dg) + u + ' – ' + inWin.reduce((a, b) => Math.max(a, b)).toFixed(dg) + u : '—', ag(n) + ' · ' + W.label(cs))}${box('Variation', Number.isFinite(sd) ? 'σ ' + sd.toFixed(dg) + (m.kind === 'pct' ? ' pp' : '') : '—', 'standard deviation · ' + ag(n) + ' · ' + W.label(cs))}</div>`;
    }
    return `<section class="fw-trend"><div class="fw-section-title"><h3>${esc(m.label)}</h3><b>${fmt(cur, m)}</b></div>${chart(pts, m, { ref: base.value, league, diff: cs.win === 'season' ? null : diffOf(cur.value, base.value, m) })}${insight}</section>`;
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
      let visual = '', gridHtml = '';
      if (gp || !players) gridHtml = await layoutGrid((players ? 'player.' : 'team.') + cs.mode, view, byId, sel, players);
      if (mine !== cs.token || !dialog) return;
      if (!gp && players) visual = '<p class="fw-empty">No appearances in this sample.</p>';
      else if (sel) visual = await trendBlock(view, season, byId);
      else if (cs.mode === 'shooting') visual = '<div class="fw-shots" data-shots></div>';
      else if (players) visual = radar(view, byId, roster, cs.cmp ? await W.view('players', cs) : null);
      else visual = teamRadar(view, season);
      root.innerHTML = `<header class="fw-identity">${logo ? `<img src="${esc(logo)}" alt="">` : ''}<div><small>${players ? 'PLAYER' : 'TEAM'} / FANTASY</small><h2>${esc(name)}</h2><p>${players ? esc(roster.teams[team] || team) + ' · ' + esc(row.pos || '—') : ''}</p></div><b>${gp || 0} GP</b></header>
        <div class="fw-card-controls"><div class="fw-switch" role="group" aria-label="Sample window">${W.buttons(cs, 'data-card-window')}</div><div class="fw-switch" role="tablist">${['profile', 'shooting'].map(v => `<button data-card-view="${v}" role="tab" aria-selected="${v === cs.mode}">${v === 'profile' ? 'Profile' : 'Shooting'}</button>`).join('')}</div></div>
        ${!gp && players ? '' : gridHtml}<div class="fw-visual">${visual}</div>${players ? '<div data-box></div>' : ''}`;
      W.wire(root, cs, () => { cs.selected = null; draw(); }, 'data-card-window');
      root.querySelectorAll('[data-card-view]').forEach(b => { b.onclick = () => { cs.mode = b.dataset.cardView; cs.selected = null; draw(); }; });
      root.querySelectorAll('[data-metric]').forEach(b => { b.onclick = () => { cs.selected = cs.selected === b.dataset.metric ? null : b.dataset.metric; draw(); }; });
      root.querySelectorAll('[data-radar]').forEach(b => { b.onclick = () => { cs.radar = b.dataset.radar; draw(); }; });
      root.querySelectorAll('[data-net]').forEach(b => { b.onclick = () => { cs.net = b.dataset.net; draw(); }; });
      const cmp = root.querySelector('[data-cmp]');
      if (cmp) cmp.onchange = () => { cs.cmp = cmp.value; draw(); };
      const shots = root.querySelector('[data-shots]');
      if (shots && (gp || !players)) g.FantasyShotChart.mount(shots, { kind, id: cs.id, team, spec: W.spec(cs), view, teamsView, grid: true }, cs.shot);
      const box = root.querySelector('[data-box]');
      if (box && players) boxScores().then(h => { if (mine === cs.token && box.isConnected) box.innerHTML = h; });
    } catch (e) { root.textContent = 'Could not load the card: ' + e.message; }
  }

  function open(entity, id, from = {}) {
    close();
    cs = { entity, id, win: from.win || 'season', mode: from.mode || 'profile', selected: null, cmp: '', radar: 'game', net: 'net', shot: { view: 'hex', hl: null, sc: false } };
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
