/* Fantasy shot chart: hexagon volume / every shot, zone and area FG%, grading against the league, assisted / unassisted and
   second-chance highlights. Shots come from site/data/shots/<TEAM>.json; every percentage is evaluated by the registry
   (engine copy) from counts, and league FG% comes from the views. Geometry and the five-level grade are from shot-zones.js (drawing library).
   Players: the player's own shots. Teams: the opponents' shots against the team (the team's defence). */
(function (g) {
  'use strict';
  const D = g.PicknEdgeData, SZ = g.ShotZones, esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pc = x => Number.isFinite(x) ? x.toFixed(1) + '%' : '—';
  const signed = x => (x < 0 ? '−' : '+') + Math.abs(x).toFixed(1);
  const attr = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

  /* counts of a list of shot events per zone */
  function count(events, zones) {
    const z = zones.map(() => ({ a: 0, m: 0, as: 0, un: 0, uk: 0 })), idx = Object.fromEntries(zones.map((q, i) => [q.key, i]));
    for (const e of events) {
      const c = z[idx[e.zone]]; if (!c) continue;
      c.a++;
      if (e.made) { c.m++; if (e.assisted === 1) c.as++; else if (e.assisted === 0) c.un++; else c.uk++; }
    }
    return z;
  }
  const rowOf = (zones, counts, pre) => ({ played: 1, ...Object.fromEntries(zones.flatMap((q, i) => [[`${pre}z_${q.key}_a`, counts[i].a], [`${pre}z_${q.key}_m`, counts[i].m]])) });

  /** Prepare everything the chart needs. `ctx` = { kind: 'players'|'teams', id, team, spec, view (window view of the entity kind), teamsView (window view of teams) } */
  async function prepare(ctx) {
    const eng = await D.engine(), { ZONES, SUBS, MAINS, zonesOfSub, zonesOfMain } = eng.zones;
    const [rows, set, all] = await Promise.all([D.shots(ctx.team), D.windowGames(ctx.team, ctx.spec), D.windowGames(ctx.team, {})]);
    const mine = e => ctx.kind === 'players' ? e.team === ctx.team && e.player_id === ctx.id : e.team !== ctx.team;
    const events = rows.filter(e => mine(e) && set.has(e.game)), season = rows.filter(e => mine(e) && all.has(e.game));
    const pre = ctx.kind === 'players' ? '' : 'o_', metric = k => eng.byId(pre + k + '_pct');
    const counts = count(events, ZONES), row = rowOf(ZONES, counts, pre), seasonRow = rowOf(ZONES, count(season, ZONES), pre);
    const fg = (r, k) => eng.evaluate(metric(k), [r]).value;
    const share = (n, of) => of > 0 ? eng.evaluate(eng.byId('share'), [{ n, of }]).value : null;
    const league = k => ctx.view.league(pre + k + '_pct').value;
    const total = counts.reduce((n, c) => n + c.a, 0);
    const level = (k, c) => { const p0 = league(k); return p0 === null ? null : SZ.grade({ made: p0 * 1e4, attempts: 1e6 }, c.m, c.a); };   // p0 is a percentage: made/attempts = p0 / 100
    const rank = k => {                                                   // teams only: #1 = lowest opponent FG%
      const mine = ctx.teamsView.get(ctx.id, pre + k + '_pct').value;
      if (!Number.isFinite(mine)) return null;
      const list = ctx.teamsView.keys.map(t => ctx.teamsView.get(t, pre + k + '_pct').value).filter(Number.isFinite);
      return { rank: 1 + list.filter(v => v < mine - 1e-9).length, n: list.length };
    };
    const cmp = ctx.spec && Object.keys(ctx.spec).length > 0;
    const zones = ZONES.map((q, i) => {
      const zk = 'z_' + q.key, c = counts[i], lv = c.a ? level(zk, c) : null, f = c.a ? fg(row, zk) : null;
      return { i, key: q.key, name: q.name, ...c, fg: f, lg: league(zk), gap: lv ? lv.gap : null, level: lv ? lv.level : null, share: share(c.a, total),
        rank: ctx.kind === 'teams' && c.a ? rank(zk) : null, season: cmp && seasonRow[`${pre}z_${q.key}_a`] ? fg(seasonRow, zk) : null };
    });
    const group = (def, ids, prefix) => {
      const keys = ids, made = keys.reduce((n, k) => n + counts[ZONES.findIndex(z => z.key === k)].m, 0), att = keys.reduce((n, k) => n + counts[ZONES.findIndex(z => z.key === k)].a, 0);
      const as = keys.reduce((n, k) => n + counts[ZONES.findIndex(z => z.key === k)].as, 0), un = keys.reduce((n, k) => n + counts[ZONES.findIndex(z => z.key === k)].un, 0), uk = keys.reduce((n, k) => n + counts[ZONES.findIndex(z => z.key === k)].uk, 0);
      return { key: def.key, name: def.name, m: made, a: att, as, un, uk, fg: att ? fg(row, prefix + def.key) : null, rank: ctx.kind === 'teams' && att ? rank(prefix + def.key) : null };
    };
    const areas = MAINS.map(m => group(m, zonesOfMain(m.key), 'zm_')).sort((x, y) => ['paint', 'mid', '3p'].indexOf(x.key) - ['paint', 'mid', '3p'].indexOf(y.key));
    const rates = ctx.kind === 'players' ? [['eFG%', 'efg'], ['2P%', 'fg2_pct'], ['3P%', 'fg3_pct'], ['FT%', 'ft_pct']] : [['Opp eFG%', 'o_efg'], ['Opp 2P%', 'o_fg2_pct'], ['Opp 3P%', 'o_fg3_pct']];
    const gp = ctx.view.get(ctx.id, ctx.kind === 'players' ? 'gp' : 'pace') && (ctx.kind === 'players' ? ctx.view.get(ctx.id, 'gp').value : ctx.view.row(ctx.id).games);
    return { ctx, eng, zones, areas, events, total, share, rates: rates.map(([l, id]) => [l, ctx.view.get(ctx.id, id)?.value ?? null, rankFor(ctx, id)]), gp, cmp };
  }
  function rankFor(ctx, id) {
    if (ctx.kind !== 'teams') return null;
    const mine = ctx.teamsView.get(ctx.id, id).value, list = ctx.teamsView.keys.map(t => ctx.teamsView.get(t, id).value).filter(Number.isFinite);
    return Number.isFinite(mine) ? { rank: 1 + list.filter(v => v < mine - 1e-9).length, n: list.length } : null;
  }

  const lvlName = (lv, team) => lv === null ? '' : SZ.levelName(lv, team);

  function tip(z, mode, team, share) {
    if (mode === 'a' || mode === 'u') {
      const tot = z.as + z.un + z.uk, row = (k, l, n) => `<div class="sz-pop-row${mode === k ? ' sz-pop-sel' : ''}"><span>${l}</span><b>${n} / ${tot} · ${pc(z.uk > 0 || z.as + z.un === 0 ? null : share(n, z.as + z.un))}</b></div>`;
      return `<strong>${esc(z.name)}</strong>${row('a', 'Assisted', z.as)}${row('u', 'Unassisted', z.un)}${z.uk ? `<small>Percentage unavailable: ${z.uk} of ${tot} made shots have no confirmed assist record (assisted ${z.as}, unassisted ${z.un}).</small>` : ''}`;
    }
    const row = (l, v) => `<div class="sz-pop-row"><span>${l}</span><b>${v}</b></div>`;
    let d = '';
    if (z.change !== undefined && z.change !== null) d = `<div class="sz-pop-d">${z.change}</div>${team && z.change !== '—' ? '<small>A higher opponent FG% means a worse defence.</small>' : ''}`;
    return `<strong>${esc(z.name)}</strong>${row('Made / attempts', z.m + ' / ' + z.a + ' · ' + pc(z.fg))}${row('League FG%', pc(z.lg))}${row('Gap', (z.gap === null ? '—' : signed(z.gap) + ' pp') + (z.level !== null ? ' · ' + lvlName(z.level, team) : ''))}${row('Share of attempts', pc(z.share))}${team ? row('Defence rank', z.rank ? '#' + z.rank.rank : '—') : ''}${d}`;
  }

  function html(m, st) {
    const team = m.ctx.kind === 'teams', { zones, areas } = m;
    const unknown = zones.reduce((n, z) => n + z.uk, 0), who = team ? ' (opponent baskets)' : '';
    zones.forEach(z => { z.change = m.cmp ? (z.season === null || z.fg === null ? '—' : (Math.abs(z.fg - z.season) < 0.05 ? '0.0' : (z.fg - z.season > 0 ? '↑ ' : '↓ ') + signed(z.fg - z.season)) + ' percentage points vs Season') : null; });
    const color = z => SZ.levelColor(z.level);
    const rates = m.ctx.grid ? '' : m.rates.map(([l, v, r]) => `<div><span>${l}</span><strong>${pc(v)}</strong>${r ? `<b class="metric-rank">Rank ${r.rank} / ${r.n}</b>` : ''}</div>`).join('');
    const variants = (tag, a, b, c) => ['fg', 'a', 'u'].map((k, i) => `<${tag} data-m="${k}">${[a, b, c][i]}</${tag}>`).join('');
    const split = (c, k) => c.uk > 0 || c.as + c.un === 0 ? null : m.eng.evaluate(m.eng.byId('share'), [{ n: k === 'a' ? c.as : c.un, of: c.as + c.un }]).value;
    const areaHtml = m.ctx.grid ? '' : areas.map(a => `<div class="sz-area"><span>${a.name}</span>${variants('strong', pc(a.fg), pc(split(a, 'a')), pc(split(a, 'u')))}${variants('small', a.m + '/' + a.a, a.as + '/' + (a.as + a.un + a.uk), a.un + '/' + (a.as + a.un + a.uk))}${a.rank ? `<b class="sz-area-rank" data-m="fg">#${a.rank.rank} / ${a.rank.n}</b>` : ''}</div>`).join('');
    const { cells } = SZ.bin(m.events.map(e => ({ x: e.x, y: e.y, zone: zones.findIndex(z => z.key === e.zone) })));
    const dominant = c => c.zones.reduce((b, n, i) => n > c.zones[b] ? i : b, 0);
    const hexPath = (cx, cy, r) => SZ.hexPts(cx, cy, r).map(([a, b]) => SZ.X(a) + ',' + SZ.Y(b)).join(' ');
    const hex = cells.map(c => `<polygon points="${hexPath(c.x, c.y, c.radius)}" style="fill:${color(zones[dominant(c)])}" data-n="${c.n}"/>`).join('');
    const dot = SZ.DOT_R * SZ.SC, at = e => `cx="${SZ.X(e.x)}" cy="${SZ.Y(e.y)}" r="${dot}"`;
    const shots = m.events.map(e => `<circle class="${e.made ? 'sz-made' : 'sz-miss'}"${e.made && e.second_chance ? ' data-sc="1"' : ''} ${at(e)}/>`).join('');
    const hl = m.events.filter(e => e.made && e.assisted !== null).map(e => `<circle class="sz-hl" data-m="${e.assisted ? 'a' : 'u'}"${e.second_chance ? ' data-sc="1"' : ''} ${at(e)}/>`).join('');
    const labels = zones.map(z => {
      const [lx, ly] = SZ.LABELS[z.i], w = 32, cx = SZ.X(lx), cy = SZ.Y(ly);
      const rect = (k, h, c) => `<rect data-m="${k}"${c ? ` class="${c}"` : ''} x="${cx - w / 2}" y="${cy - 7}" width="${w}" height="${h}" rx="3"${k === 'fg' ? ` style="stroke:${z.a ? color(z) : '#56667a'}"` : ''}/>`;
      const text = (k, s) => `<text data-m="${k}" x="${cx}" y="${cy + 3.2}" text-anchor="middle">${s}</text>`;
      return `<g class="sz-label" data-zone="${z.i}"><title>${esc(z.name)}: ${z.m}/${z.a}${z.level !== null ? ' · ' + lvlName(z.level, team) : ''}${z.rank ? ' · defence rank ' + z.rank.rank + '/' + z.rank.n : ''}</title>${rect('fg', z.rank ? 24 : 14)}${text('fg', z.a ? z.fg.toFixed(1) + '%' : '—')}${z.rank ? `<text data-m="fg" class="sz-zone-rank" x="${cx}" y="${cy + 12.5}" text-anchor="middle">#${z.rank.rank} / ${z.rank.n}</text>` : ''}${rect('a', 14, 'sz-au-r')}${text('a', pc(split(z, 'a')))}${rect('u', 14, 'sz-au-r')}${text('u', pc(split(z, 'u')))}</g>`;
    }).join('');
    const svg = (view, body) => `<svg class="pc-court sz-court" data-shotview="${view}" viewBox="0 0 ${SZ.VIEW.w} ${SZ.VIEW.h}" role="img" aria-label="${team ? 'Opponent' : 'Player'} shots, ${view === 'hex' ? 'hexagon volume' : 'individual shots'}"${st.view === view ? '' : ' hidden'}>${SZ.court()}${body}${labels}</svg>`;
    const mode = (k, l) => `<p class="sz-mode" data-m="${k}">${l}: share of all made shots of each zone and area${who}${unknown ? ` · "—" where the assist is not confirmed (${unknown} made shots)` : ''}.</p>`;
    return `<div class="pc-shooting" data-hl="${st.view === 'shots' ? st.hl || 'none' : 'none'}" data-sc="${st.view === 'shots' && st.sc ? 1 : 0}">${m.ctx.grid ? '' : `<div class="pc-shoot-rates">${rates}</div>`}
      <div class="sz-head"><div class="sz-switch" role="group" aria-label="Shot chart view">${[['hex', 'Hex'], ['shots', 'Shots']].map(([k, l]) => `<button type="button" data-shotview-btn="${k}" aria-pressed="${st.view === k}">${l}</button>`).join('')}</div>
      <div class="sz-switch sz-au" role="group" aria-label="Second Chance, Assisted / Unassisted${who}"${st.view === 'shots' ? '' : ' hidden'}><button type="button" data-sc-btn aria-pressed="${st.view === 'shots' && st.sc}">Second Chance</button><span class="sz-sep" aria-hidden="true"></span>${[['a', 'Assisted'], ['u', 'Unassisted']].map(([k, l]) => `<button type="button" data-hl-btn="${k}" aria-pressed="${st.hl === k}">${l}</button>`).join('')}</div></div>
      ${mode('a', 'Assisted')}${mode('u', 'Unassisted')}${m.ctx.grid ? '' : `<div class="sz-areas">${areaHtml}</div>`}${svg('hex', `<g class="sz-hex">${hex}</g>`)}${svg('shots', `<g class="sz-shots">${shots}</g><g class="sz-hlg">${hl}</g>`)}
      <div class="sz-pop" role="status" hidden></div><p class="pc-note">${m.gp ?? 0} GP · ${m.total} FGA${team ? ' · Defence rank: #1 = lowest opponent FG%.' : ''}</p></div>`;
  }

  /** Render into `host` and wire its interactions; `st` is the card's persistent {view, hl, sc}. */
  async function mount(host, ctx, st) {
    host.innerHTML = '<p class="fw-empty" role="status">Loading shots…</p>';
    let m;
    try { m = await prepare(ctx); } catch (e) { host.innerHTML = `<p class="fw-empty">Could not load the shots: ${esc(e.message)}</p>`; return; }
    if (!m.total) { host.innerHTML = '<p class="fw-empty">No shots in this sample.</p>'; return; }
    host.innerHTML = html(m, st);
    const root = host.querySelector('.pc-shooting'), pop = root.querySelector('.sz-pop'), team = ctx.kind === 'teams';
    let pinned = null;
    const hide = () => { pop.hidden = true; };
    const share = (n, of) => of > 0 ? m.eng.evaluate(m.eng.byId('share'), [{ n, of }]).value : null;
    const zoneAt = (svg, e) => {
      const r = svg.getBoundingClientRect(), sx = (e.clientX - r.left) / r.width * SZ.VIEW.w, sy = (e.clientY - r.top) / r.height * SZ.VIEW.h, x = (sx - SZ.X(0)) / SZ.SC, y = (sy - SZ.Y(0)) / SZ.SC;
      if (!(y >= SZ.BASELINE) || Math.abs(x) > 750 || sy > SZ.VIEW.h) return -1;
      return SZ.classify(x, y, y <= SZ.CORNER_Y ? Math.abs(x) > SZ.CORNER_X : Math.hypot(x, y) > SZ.ARC);
    };
    const show = (zi, e) => {
      if (root.dataset.sc === '1') return;
      pop.innerHTML = tip(m.zones[zi], root.dataset.hl, team, share); pop.hidden = false;
      const rr = root.getBoundingClientRect(), w = pop.offsetWidth, h = pop.offsetHeight, x = e.clientX - rr.left, y = e.clientY - rr.top;
      pop.style.left = Math.max(4, Math.min(rr.width - w - 4, x + 12 > rr.width - w - 4 ? x - w - 12 : x + 12)) + 'px';
      pop.style.top = Math.max(4, Math.min(rr.height - h - 4, y - h - 14 >= 4 ? y - h - 14 : y + 14)) + 'px';
    };
    const setHl = mode => { st.hl = mode; root.dataset.hl = mode || 'none'; root.querySelectorAll('[data-hl-btn]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.hlBtn === mode))); if (pinned) show(pinned.zone, pinned.e); };
    const setSc = on => { st.sc = on; root.dataset.sc = on ? 1 : 0; root.querySelectorAll('[data-sc-btn]').forEach(b => b.setAttribute('aria-pressed', String(on))); if (on) { pinned = null; hide(); } };
    root.addEventListener('pointermove', e => { if (e.pointerType !== 'mouse' || pinned) return; const svg = e.target.closest('svg.sz-court'), z = svg ? zoneAt(svg, e) : -1; if (z >= 0) show(z, e); else hide(); });
    root.addEventListener('pointerleave', () => { if (!pinned) hide(); });
    root.addEventListener('click', e => {
      const t = e.target, view = t.closest('[data-shotview-btn]'), au = t.closest('[data-hl-btn]'), sc = t.closest('[data-sc-btn]'), svg = t.closest('svg.sz-court');
      if (view) {
        st.view = view.dataset.shotviewBtn; pinned = null; hide();
        if (st.view !== 'shots') { setHl(null); setSc(false); }
        root.querySelectorAll('[data-shotview-btn]').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.shotviewBtn === st.view)));
        root.querySelectorAll('svg[data-shotview]').forEach(s => s.toggleAttribute('hidden', s.dataset.shotview !== st.view));
        root.querySelector('.sz-au').toggleAttribute('hidden', st.view !== 'shots'); return;
      }
      if (sc) { setSc(!st.sc); return; }
      if (au) { setHl(st.hl === au.dataset.hlBtn ? null : au.dataset.hlBtn); return; }
      if (svg) { const z = zoneAt(svg, e); if (z < 0) { pinned = null; hide(); return; } if (pinned && pinned.zone === z) { pinned = null; hide(); } else { pinned = { zone: z, e: { clientX: e.clientX, clientY: e.clientY } }; show(z, e); } }
    });
  }
  g.FantasyShotChart = { mount };
})(globalThis);
