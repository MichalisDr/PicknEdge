// Players · Shooting: Volume vs efficiency (SA / 100 poss x TS%), its metric sa100, the league lines, the iso-points curves. Synthetic data only: no test reads the data files.
import test from 'node:test';
import assert from 'node:assert/strict';
import { byId as registry, evaluate } from '../../scripts/metrics/engine.mjs';
import { CHARTS, available } from '../../site/fantasy/gallery/charts.js';
import { isoCurve, isoTs } from '../../site/fantasy/gallery/curves.js';
import { pickExtremes, surname } from '../../site/fantasy/gallery/labels.js';
import { between } from '../../site/fantasy/gallery/tween.js';
import { drawScatter, bubbleRadius } from '../../site/fantasy/gallery/scatter.js';
import { size } from '../../site/core/sizes.js';
import { Data } from '../../site/core/data.js';

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);
const un = s => s.replaceAll('&quot;', '"').replaceAll('&#39;', "'").replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&amp;', '&');
const modelOf = html => JSON.parse(un(/data-plot="([^"]+)"/.exec(html)[1]));
const CHART = CHARTS.find(c => c.id === 'players-volume-efficiency');

test('sa100: shot attempts (shots + free-throw trips) per 100 team offensive possessions on court, same family as fga100', () => {
  const m = registry('sa100'), twin = registry('fga100');
  assert.deepEqual([m.scope, m.kind, m.label, m.tags, m.direction], ['player', 'per100', 'SA / 100 poss', ['fantasy', 'betting'], 0]);
  assert.equal(m.description, 'Shot attempts (shots and free-throw trips) per 100 team offensive possessions while on court.');
  assert.deepEqual(m.num, [[1, 'sa']]); assert.deepEqual(m.den, twin.den);
  near(evaluate(m, [{ played: 1, sa: 12, poss_off_on: 40 }, { played: 1, sa: 6, poss_off_on: 60 }]).value, 18);   // sum over sum, never a mean of the games
});

test('sa100: a game without verified lineups (on_ok = 0: the on-court columns are empty) leaves numerator AND denominator, exactly as for fga100', () => {
  const verified = { played: 1, sa: 16, a2: 9, a3: 5, poss_off_on: 50 }, unverified = { played: 1, sa: 30, a2: 20, a3: 8, poss_off_on: '' };
  const a = evaluate(registry('sa100'), [verified, unverified]), b = evaluate(registry('fga100'), [verified, unverified]);
  near(a.value, 16 / 50 * 100); assert.deepEqual([a.used, a.of], [1, 2]);
  near(b.value, 14 / 50 * 100); assert.deepEqual([b.used, b.of], [a.used, a.of], 'the same games in both');
  near(evaluate(registry('sa_att'), [verified, unverified]).value, 46);   // the raw attempts need no lineup: every game counts, as in TS%
  assert.equal(evaluate(registry('sa100'), [unverified]).value, null);
});

test('registration: Players · Shooting has the chart; the other charts are as they were', () => {
  assert.equal(available('players', 'shooting'), true);
  assert.deepEqual([CHART.entity, CHART.view, CHART.x, CHART.y, CHART.title, CHART.subtitle], ['players', 'shooting', 'sa100', 'ts_pct', 'Volume vs efficiency', 'SA / 100 poss × TS%']);
  assert.deepEqual(CHART.curves, [15, 20, 25, 30, 35]); assert.equal(CHART.extremes, 9); assert.equal(CHART.domain, 'listed'); assert.equal(CHART.move, true);
  assert.deepEqual(CHART.corners, { upperRight: 'High volume, efficient', lowerRight: 'High volume, below average', upperLeft: 'Low volume, efficient' });
  assert.equal(CHARTS.filter(c => c.entity === 'teams').length, 6);
  assert.ok(CHARTS.filter(c => c.entity === 'teams').every(c => !c.corners && !c.curves && !c.extremes));
});

const BOX = { x0: 5, x1: 40, y0: 30, y1: 80 };
test('iso-points curves: every point satisfies 2 x TS x SA/100 = P, stays inside the plot box, and a curve that misses the box is empty', () => {
  for (const P of [15, 20, 25, 30, 35]) {
    const c = isoCurve(P, BOX);
    assert.ok(c.length > 2, 'P=' + P);
    for (const [x, y] of c) { near(2 * x * (y / 100), P, 1e-9); assert.ok(x >= BOX.x0 - 1e-9 && x <= BOX.x1 + 1e-9 && y >= BOX.y0 - 1e-9 && y <= BOX.y1 + 1e-9, `${x},${y}`); }
    for (let i = 1; i < c.length; i++) assert.ok(c[i][0] > c[i - 1][0] && c[i][1] < c[i - 1][1], 'it falls from left to right');
  }
  assert.deepEqual(isoCurve(500, BOX), []); assert.deepEqual(isoCurve(1, BOX), []);
  near(isoTs(20, 16), 62.5);
});

test('extremes: the 9 furthest from the league lines by standardized distance (so a rate and a percent weigh alike); fewer when fewer are drawn', () => {
  const centre = { x: 20, y: 55 };
  const pts = Array.from({ length: 30 }, (_, i) => ({ id: 'q' + i, a: 20 + (i % 2 ? 1 : -1) * i * 0.1, b: 55 + (i % 3 - 1) * i * 0.5 }));
  const got = pickExtremes(pts, centre);
  assert.equal(got.length, 9);
  const all = pickExtremes(pts, centre, 99);
  assert.deepEqual(got.map(p => p.id), all.slice(0, 9).map(p => p.id));
  for (let i = 1; i < all.length; i++) assert.ok(all[i - 1].dist >= all[i].dist);
  // the same picture with y in another unit gives the same choice: the distance is standardized
  assert.deepEqual(pickExtremes(pts.map(p => ({ ...p, b: p.b * 100 })), { x: 20, y: 5500 }).map(p => p.id), got.map(p => p.id));
  assert.equal(pickExtremes(pts.slice(1, 5), centre).length, 4);
  assert.deepEqual(pickExtremes(pts, null), []);
});

// ---- a synthetic league: per window a different sa100 and TS%; 'z1' is below the thresholds, far out on both axes; the league row is the rate over the WHOLE pool
const WINDOWS = ['season', 'l10', 'l5', 'l3'], SHIFT = { season: 0, l10: 0.7, l5: -1.1, l3: 1.9 };
const IDS = Array.from({ length: 24 }, (_, i) => 'p' + i);
const rowsOf = win => {
  const rows = {};
  IDS.forEach((id, i) => { const sa100 = 10 + i * 0.8 + SHIFT[win], ts = 45 + ((i * 7) % 13) * 1.5 + SHIFT[win] * 2; rows[id] = { sa100, ts_pct: ts, pts100: 2 * sa100 * ts / 100, sa_att: 40 + i, efg: ts - 3, ftr: 20 + i, pir: 10, gp: 8, min: 20 }; });
  rows.z1 = { sa100: 48, ts_pct: 130, pts100: 124.8, sa_att: 2, efg: 150, ftr: 0, pir: 1, gp: 1, min: 2 };
  return rows;
};
const mkView = win => {
  const rows = rowsOf(win), all = Object.values(rows), sum = f => all.reduce((s, r) => s + f(r), 0);
  const league = { sa100: sum(r => r.sa100) / all.length, ts_pct: sum(r => r.ts_pct) / all.length };
  return { kind: 'players', window: win, keys: Object.keys(rows), row: id => ({ team: 'XXX', pos: 'G', name: id }), get: (id, m) => ({ value: rows[id][m] }), league: m => (m in league ? { value: league[m] } : null), fx: () => null };
};
const VIEWS = Object.fromEntries(WINDOWS.map(w => [w, mkView(w)]));
const fmtP = { digits: 1, suffix: '%' }, fmtN = { digits: 1, suffix: '' };
const BYID = Object.fromEntries([['sa100', 'SA / 100 poss', fmtN], ['ts_pct', 'TS%', fmtP], ['pts100', 'PTS / 100 poss', fmtN], ['sa_att', 'SA', { digits: 0, suffix: '' }], ['efg', 'eFG%', fmtP], ['ftr', 'FTr', fmtP], ['pir', 'PIR', fmtN], ['gp', 'GP', fmtN], ['min', 'MIN', fmtN]]
  .map(([id, label, format]) => [id, { id, label, format, direction: id === 'ts_pct' ? 1 : 0 }]));
const ROSTER = { teams: {}, players: Object.fromEntries(IDS.map((id, i) => [id, { name: 'First Surname' + i }])), logoIds: {} };
const MANIFEST = { eligibility: { availability: { window: 'l3', minGp: 1 }, windows: Object.fromEntries(WINDOWS.map(w => [w, { minGp: 3, minMin: 10, minPir: 5 }])) } };

/** galleryHtml over the synthetic league (Data stubbed, then put back). */
async function withGallery(run) {
  const saved = { ...Data };
  Object.assign(Data, { metrics: async () => ({ list: Object.values(BYID), byId: BYID }), roster: async () => ROSTER, manifest: async () => MANIFEST, view: async (kind, w) => VIEWS[w] });
  try {
    const { galleryHtml } = await import('../../site/fantasy/gallery/gallery.js');
    await run(async (win, ids = IDS, extra = {}) => { const html = await galleryHtml('players', 'shooting', { win, view: 'shooting', showAll: false, ...extra }, ids); return { html, m: modelOf(html) }; });
  } finally { Object.assign(Data, saved); }
}
const P = k => size('fantasy.charts-gallery.plot.' + k);
const plotBox = (W, H, narrow) => ({ x0: P(narrow ? 'margin-left-narrow' : 'margin-left'), x1: W - P(narrow ? 'margin-right-narrow' : 'margin-right'), y0: P('margin-top'), y1: H - P('margin-bottom') });
const curvesOf = svg => [...svg.matchAll(/<polyline class="fc-iso" data-points="(\d+)" points="([^"]+)"/g)].map(m => m[1] + ':' + m[2]);

test('axes: identical in all four windows; a below-threshold player is never drawn or on them, with the toggle on or off; position, search and the drawer never move them', async () => {
  await withGallery(async g => {
    const per = {};
    for (const w of WINDOWS) per[w] = (await g(w)).m;
    for (const w of WINDOWS) { assert.deepEqual(per[w].sx, per.season.sx); assert.deepEqual(per[w].sy, per.season.sy); }
    assert.ok(per.season.sx.hi < 48 && per.season.sy.hi < 130, 'the hidden player is not on the axes');
    const values = k => WINDOWS.flatMap(w => IDS.map(id => rowsOf(w)[id][k]));
    assert.ok(per.season.sx.lo < Math.min(...values('sa100')) && per.season.sx.hi > Math.max(...values('sa100')));
    assert.ok(per.season.sy.lo < Math.min(...values('ts_pct')) && per.season.sy.hi > Math.max(...values('ts_pct')));
    for (const s of [per.season.sx, per.season.sy]) assert.ok(s.step === 5 && s.ticks.every(t => t % 5 === 0), 'both step by 5');
    for (const w of WINDOWS) {
      const on = (await g(w, [...IDS, 'z1'], { showAll: true })).m;
      assert.deepEqual(on, per[w], w + ': the same chart with the switch on');
      assert.ok(!on.pts.some(p => p.id === 'z1'));
    }
    const filtered = (await g('season', IDS.slice(0, 5), { position: ['C'], query: 'p1', minCr: 9 })).m;
    assert.deepEqual(filtered.sx, per.season.sx); assert.deepEqual(filtered.sy, per.season.sy);
  });
});

test('league lines come from the league row of the window (the whole pool) and, with the curves, are unchanged by filters, search and the toggle', async () => {
  await withGallery(async g => {
    for (const w of WINDOWS) {
      const full = (await g(w)).m, few = (await g(w, IDS.slice(0, 3), { query: 'p1', position: ['F'] })).m;
      const league = { x: VIEWS[w].league('sa100').value, y: VIEWS[w].league('ts_pct').value };
      assert.deepEqual(full.avg, league, 'the pool includes the below-threshold player'); assert.deepEqual(few.avg, league);
      assert.deepEqual((await g(w, [...IDS, 'z1'], { showAll: true })).m.avg, league);
      assert.deepEqual(curvesOf(drawScatter(few, 900, false, 'full')), curvesOf(drawScatter(full, 900, false, 'full')), 'the curves do not move with the dots');
    }
    const first = curvesOf(drawScatter((await g('season')).m, 900, false, 'full'));
    assert.ok(first.length >= 3, 'curves drawn');
    for (const w of WINDOWS) assert.deepEqual(curvesOf(drawScatter((await g(w)).m, 900, false, 'full')), first, 'the same on every window');
    const [a, b] = [(await g('season')).m, (await g('l3')).m], mid = between(a, b, 0.5);
    near(mid.avg.x, (a.avg.x + b.avg.x) / 2); near(mid.avg.y, (a.avg.y + b.avg.y) / 2);
  });
});

test('drawn: tint only right of the volume line (above good, below bad), curves and lines inside the plot, three zone labels, nine surnames at most in the opened card and none in the thumbnail', async () => {
  await withGallery(async g => {
    const { m, html } = await g('season');
    assert.ok(html.includes('Volume vs efficiency') && html.includes('so check SA in the hover.') && !html.includes('Dashed lines = league values'));
    for (const [W, narrow, mode] of [[900, false, 'full'], [640, false, 'thumb'], [360, true, 'full'], [340, true, 'thumb']]) {
      const H = Math.round(W * P(narrow && mode === 'full' ? 'aspect-narrow' : 'aspect')), box = plotBox(W, H, narrow), svg = drawScatter(m, W, narrow, mode, H);
      const X = box.x0 + (m.avg.x - m.sx.lo) / (m.sx.hi - m.sx.lo) * (box.x1 - box.x0), Y = box.y1 - (m.avg.y - m.sy.lo) / (m.sy.hi - m.sy.lo) * (box.y1 - box.y0);
      const rects = [...svg.matchAll(/<rect class="fc-q (good|bad)" x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)"/g)].map(r => ({ tone: r[1], x: +r[2], y: +r[3], w: +r[4], h: +r[5] }));
      assert.deepEqual(rects.map(r => r.tone), ['good', 'bad']);
      for (const r of rects) { near(r.x, X, 0.11); assert.ok(r.x + r.w <= box.x1 + 0.11 && r.y >= box.y0 - 0.11 && r.y + r.h <= box.y1 + 0.11); }
      near(rects[0].y + rects[0].h, Y, 0.11); near(rects[1].y, Y, 0.11);
      for (const c of curvesOf(svg)) for (const [x, y] of c.split(':')[1].split(' ').map(q => q.split(',').map(Number))) assert.ok(x >= box.x0 - 0.11 && x <= box.x1 + 0.11 && y >= box.y0 - 0.11 && y <= box.y1 + 0.11, 'curve inside');
      assert.equal((svg.match(/class="fc-avg"/g) || []).length, 2);
      const text = [...svg.matchAll(/<text class="fc-zone (\w+)"[^>]*>([^<]+)</g)];
      assert.equal(text.map(t => t[2]).join(' ').replace(/,\s+/g, ', '), 'High volume, efficient High volume, below average Low volume, efficient');
      assert.deepEqual([...new Set(text.map(t => t[1]))], ['good', 'bad', 'neutral'], 'upper right green, lower right red, upper left neutral');
      const isoLabels = [...svg.matchAll(/<text class="fc-iso-label"[^>]*>(\d+)</g)].map(x => +x[1]);
      assert.ok(isoLabels.length >= 1 && isoLabels.every(v => CHART.curves.includes(v)), 'curves are labelled with their value');
      const names = [...svg.matchAll(/<text class="fc-pl" x="[\d.]+" y="[\d.]+" dominant-baseline="central"(?: text-anchor="(?:end|middle)")?>(Surname\d+)</g)].map(x => x[1]);
      if (mode === 'thumb') assert.equal(names.length, 0); else { assert.ok(names.length > 0 && names.length <= 9); const wanted = new Set(pickExtremes(m.pts, m.avg).map(p => 'Surname' + p.id.slice(1))); for (const n of names) assert.ok(wanted.has(n), n); }
      assert.ok(!svg.includes('<image') && svg.includes('fc-dot fc-team'), 'team-coloured dots, no logos');
    }
  });
});

test('hover: name · team · SA/100 · TS% · PTS/100 (the metric pts100, not x*y) · SA · eFG% · FT rate', async () => {
  await withGallery(async g => {
    const { m } = await g('season'), r = rowsOf('season').p3, tip = m.pts.find(p => p.id === 'p3').tip;
    assert.equal(tip, `First Surname3 · XXX · SA/100 ${r.sa100.toFixed(1)} · TS% ${r.ts_pct.toFixed(1)}% · PTS/100 ${r.pts100.toFixed(1)} · SA ${r.sa_att} · eFG% ${r.efg.toFixed(1)}% · FT rate ${r.ftr.toFixed(1)}%`);
    const odd = rowsOf('season'); odd.p3.pts100 = 99.9;   // a pts100 that is not 2 x TS x SA/100 is shown as it is
    const keep = VIEWS.season; VIEWS.season = { ...keep, get: (id, metric) => ({ value: odd[id][metric] }) };
    try { assert.ok((await g('season')).m.pts.find(p => p.id === 'p3').tip.includes('PTS/100 99.9')); } finally { VIEWS.season = keep; }
    assert.ok((await g('season')).html.includes('fc-tip-long'), 'the long read-out wraps');
  });
});

test('surname on a label: a generational suffix is never the label on its own', () => {
  assert.equal(surname('Wade Baldwin IV'), 'Baldwin IV'); assert.equal(surname('Carsen Edwards'), 'Edwards');
  assert.equal(surname('Tyrique Jones Jr.'), 'Jones Jr.'); assert.equal(surname('Lonnie Walker iv'), 'Walker iv');
});

// ---- the size of a dot = the shot attempts of the window
const circles = svg => [...svg.matchAll(/<g class="fc-pt" data-open="([^"]+)"[^>]*><circle class="fc-hit" r="([\d.]+)"\/><circle class="fc-dot fc-team" r="([\d.]+)"/g)].map(m => ({ id: m[1], hit: +m[2], r: +m[3] }));

test('bubble radius: rMin + k x sqrt(SA) from the named sizes, growing with SA; no attempts = the smallest dot', () => {
  assert.deepEqual([P('bubble-radius-min'), P('bubble-radius-per-root')], [1.5, 0.75]);
  assert.deepEqual(CHART.size, { id: 'sa_att', key: [5, 20, 60, 190] });
  near(bubbleRadius(0), 1.5); near(bubbleRadius(16), 4.5); near(bubbleRadius(100), 9);
  for (let n = 1; n < 400; n++) assert.ok(bubbleRadius(n) > bubbleRadius(n - 1));
  near(bubbleRadius(NaN), 1.5);
  assert.ok(CHARTS.filter(c => c !== CHART).every(c => !c.size), 'only this chart');
});

test('dots: the same function in every window (not normalised), scaled with the plot in a thumbnail, largest first, a hover target at least as large as the dot and never under the minimum', async () => {
  await withGallery(async g => {
    for (const w of WINDOWS) {
      const { m } = await g(w), rows = rowsOf(w);
      assert.equal(m.pts.length, IDS.length, 'nobody is left out for low attempts');
      for (const [W, narrow, mode] of [[900, false, 'full'], [360, true, 'full'], [320, false, 'thumb']]) {
        const dots = circles(drawScatter(m, W, narrow, mode)), k = mode === 'thumb' ? W / P('plot-width') : 1;
        assert.equal(dots.length, IDS.length);
        for (const d of dots) { near(d.r, bubbleRadius(rows[d.id].sa_att) * k, 0.006); near(d.hit, Math.max(d.r, P('hit-radius-min')), 1e-9); }
        for (let i = 1; i < dots.length; i++) assert.ok(dots[i - 1].r >= dots[i].r, 'largest drawn first, smallest on top');
      }
    }
    const big = (await g('season')).m; big.pts[0].n = 400; big.pts[1].n = 0;
    const dots = circles(drawScatter(big, 900, false, 'full'));
    assert.equal(dots[0].id, big.pts[0].id); assert.equal(dots.at(-1).id, big.pts[1].id);
    near(dots[0].hit, 16.5); near(dots.at(-1).hit, 8);
    const moved = between({ ...big, pts: big.pts.map(p => ({ ...p, n: 10 })) }, { ...big, pts: big.pts.map(p => ({ ...p, n: 30 })) }, 0.5);
    assert.ok(moved.pts.every(p => p.n === 20), 'the size changes with the window slide');
  });
});

test('size key: sample dots with their SA at the radii of the opened card, in this chart only; the hover still shows SA', async () => {
  await withGallery(async g => {
    const { html, m } = await g('season');
    const key = /<div class="fc-sizekey"[\s\S]*?<\/div>/.exec(html)[0];
    assert.ok(key.includes('Dot size = SA'));
    assert.deepEqual([...key.matchAll(/<circle class="fc-dot" [^>]*r="([\d.]+)"/g)].map(x => +x[1]), CHART.size.key.map(n => +bubbleRadius(n).toFixed(2)));
    assert.deepEqual([...key.matchAll(/<\/svg>(\d+)<\/span>/g)].map(x => +x[1]), CHART.size.key);
    assert.ok(m.pts.every(p => p.tip.includes(' · SA ')));
  });
});
