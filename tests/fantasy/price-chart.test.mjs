// Players · Performance vs price (credits x PIR / game with the line of typical PIR at that price). Every test uses synthetic data: none reads the data files.
import test from 'node:test';
import assert from 'node:assert/strict';
import { fitLine, lineSegment, zones, area } from '../../site/fantasy/gallery/fit.js';
import { between, ease, wantsMove } from '../../site/fantasy/gallery/tween.js';
import { CHARTS, available } from '../../site/fantasy/gallery/charts.js';
import { scatter, drawScatter } from '../../site/fantasy/gallery/scatter.js';
import { axisScale } from '../../site/fantasy/gallery/scale.js';
import { size } from '../../site/core/sizes.js';
import { Data } from '../../site/core/data.js';

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);
const un = s => s.replaceAll('&quot;', '"').replaceAll('&#39;', "'").replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&amp;', '&');
const modelOf = html => JSON.parse(un(/data-plot="([^"]+)"/.exec(html)[1]));

test('fitLine: exact slope and intercept on points that lie on a line, and the least-squares line on points that do not', () => {
  const on = [0, 1, 2, 5, 9].map(x => ({ x, y: 2.5 * x - 4 }));
  const f = fitLine(on);
  near(f.slope, 2.5); near(f.intercept, -4); assert.equal(f.n, 5);
  const g = fitLine([{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 1 }]);   // by hand: slope 1/2, intercept 1/6
  near(g.slope, 0.5); near(g.intercept, 1 / 6);
  const h = fitLine([{ x: 1000, y: 5 }, { x: 1001, y: 7 }]);   // far from zero: the centred sums keep it exact
  near(h.slope, 2, 1e-6); near(h.intercept, 5 - 2000, 1e-6);
});

test('fitLine: no line for fewer than two points, for points that are not finite, or when every x is the same', () => {
  assert.equal(fitLine([]), null);
  assert.equal(fitLine([{ x: 1, y: 2 }]), null);
  assert.equal(fitLine([{ x: 1, y: 2 }, { x: NaN, y: 3 }, { x: 2, y: Infinity }]), null);
  assert.equal(fitLine([{ x: 4, y: 1 }, { x: 4, y: 9 }, { x: 4, y: -3 }]), null);
  assert.equal(fitLine([{ x: 0.1 + 0.2, y: 1 }, { x: 0.3, y: 5 }]), null, 'the same x up to rounding');
  near(fitLine([{ x: 1, y: 3 }, { x: 2, y: 3 }]).slope, 0);   // a flat line is a line
});

const BOX = { x0: 4, x1: 24, y0: -2, y1: 40 };
const inside = (poly, b = BOX) => poly.every(([x, y]) => x >= b.x0 - 1e-9 && x <= b.x1 + 1e-9 && y >= b.y0 - 1e-9 && y <= b.y1 + 1e-9);

test('zones: two polygons clipped to the plot box that together cover it exactly', () => {
  for (const line of [{ slope: 1.2, intercept: 3 }, { slope: -0.5, intercept: 30 }, { slope: 0, intercept: 10 }, { slope: 8, intercept: -40 }]) {
    const z = zones(line, BOX), whole = (BOX.x1 - BOX.x0) * (BOX.y1 - BOX.y0);
    assert.ok(z.above && z.below, JSON.stringify(line));
    assert.ok(inside(z.above) && inside(z.below), 'no vertex outside the plot: ' + JSON.stringify(line));
    near(area(z.above) + area(z.below), whole, 1e-6);
    for (const [x, y] of z.above) assert.ok(y >= line.slope * x + line.intercept - 1e-9, 'above is above');
    for (const [x, y] of z.below) assert.ok(y <= line.slope * x + line.intercept + 1e-9, 'below is below');
  }
});

test('zones: a line that misses the plot leaves one zone covering all of it and none for the other side', () => {
  const high = zones({ slope: 0, intercept: 100 }, BOX), low = zones({ slope: 0, intercept: -100 }, BOX);
  assert.equal(high.above, null); near(area(high.below), 20 * 42);
  assert.equal(low.below, null); near(area(low.above), 20 * 42);
  assert.equal(lineSegment({ slope: 0, intercept: 100 }, BOX), null);
});

test('lineSegment: ends on the plot edge, never beyond it', () => {
  const seg = lineSegment({ slope: 3, intercept: -20 }, BOX);   // enters through the bottom edge, leaves through the top
  assert.ok(inside(seg));
  near(seg[0][1], BOX.y0); near(seg[1][1], BOX.y1);
  const flat = lineSegment({ slope: 0.5, intercept: 5 }, BOX);   // crosses both side edges
  near(flat[0][0], BOX.x0); near(flat[1][0], BOX.x1);
});

// ---- a synthetic league: cr from 4 to 24, PIR that rises with the price, a different PIR in every window; players 'z1'..'z3' are below the thresholds
const WINDOWS = ['season', 'l10', 'l5', 'l3'], FACTOR = { season: 1, l10: 1.1, l5: 0.8, l3: 1.4 };
const IDS = Array.from({ length: 24 }, (_, i) => 'p' + i);
const rowsOf = win => {
  const rows = {};
  IDS.forEach((id, i) => { rows[id] = { cr: 4 + i, pir: FACTOR[win] * (0.9 * (4 + i) + 5 + ((i * 7) % 5) - 2), gp: 8, min: 20 }; });
  rows.z1 = { cr: 4, pir: -15, gp: 1, min: 2 };   // a few minutes in L3: PIR far below everyone
  rows.z2 = { cr: 5, pir: 2, gp: 1, min: 4 };
  return rows;
};
const mkView = win => {
  const rows = rowsOf(win);
  return { kind: 'players', window: win, keys: Object.keys(rows), row: id => ({ team: 'XXX', pos: 'G', name: id }), get: (id, m) => ({ value: rows[id][m] }), league: () => null, fx: id => ({ cr: rows[id].cr }) };
};
const VIEWS = Object.fromEntries(WINDOWS.map(w => [w, mkView(w)]));
const BYID = { pir: { id: 'pir', label: 'PIR / game', format: { digits: 1, suffix: '' }, direction: 1 }, gp: { id: 'gp' }, min: { id: 'min' } };
const ROSTER = { teams: {}, players: {}, logoIds: {} };
const CHART = CHARTS.find(c => c.id === 'players-price-pir');
const plot = win => modelOf(scatter(CHART, VIEWS[win], IDS, BYID, ROSTER, Object.values(VIEWS)));

test('registration: one players chart in the Profile view, no other view gets the gallery, the Teams charts are as they were', () => {
  assert.ok(CHART);
  assert.deepEqual([CHART.entity, CHART.view, CHART.x, CHART.y], ['players', 'profile', 'cr', 'pir']);
  assert.equal(CHART.title, 'Performance vs price');
  assert.equal(CHART.subtitle, 'Credits × PIR / game · line = typical PIR at that price (fit across the players shown)');
  assert.deepEqual(CHART.zones, ['Above typical for the price', 'Below typical for the price']);
  assert.equal(available('players', 'profile'), true);
  assert.equal(available('players', 'shooting'), false);
  assert.equal(available('teams', 'profile'), true);
  assert.equal(available('teams', 'shooting'), true);
  assert.equal(CHARTS.filter(c => c.entity === 'teams').length, 6);
  assert.equal(CHARTS.filter(c => c.entity === 'players').length, 1);
});

test('the chart reads credits through its own accessor, plots the window\'s PIR, and fits the players drawn', () => {
  const m = plot('season');
  assert.equal(m.pts.length, IDS.length);
  const p3 = m.pts.find(p => p.id === 'p3');
  assert.deepEqual([p3.a, p3.b], [7, rowsOf('season').p3.pir], 'x = credits, y = PIR / game of the window');
  assert.equal(m.xTitle, 'Credits'); assert.equal(m.yTitle, 'PIR / game');
  const expect = fitLine(m.pts.map(p => ({ x: p.a, y: p.b })));
  near(m.fit.slope, expect.slope); near(m.fit.intercept, expect.intercept);
  assert.equal(m.fit.n, IDS.length);
  assert.equal(m.noLabel, true);
});

test('a change of window gives a different model: the dots and the line move, the axes do not', () => {
  const [s, l3, l5] = ['season', 'l3', 'l5'].map(plot);
  assert.notDeepEqual(s.pts.map(p => p.b), l3.pts.map(p => p.b));
  assert.notEqual(s.fit.slope, l3.fit.slope);
  assert.notEqual(l5.fit.slope, l3.fit.slope);
  assert.deepEqual(s.pts.map(p => p.a), l3.pts.map(p => p.a), 'x = credits does not change');
  assert.deepEqual(s.sx, l3.sx); assert.deepEqual(s.sy, l3.sy);
  assert.equal(s.win, 'season'); assert.equal(l3.win, 'l3');
  assert.equal(l3.move, true);
  const lo = Math.min(...WINDOWS.flatMap(w => IDS.map(id => rowsOf(w)[id].pir))), hi = Math.max(...WINDOWS.flatMap(w => IDS.map(id => rowsOf(w)[id].pir)));
  assert.ok(s.sy.lo < lo && s.sy.hi > hi, 'the y axis holds every window');
});

test('the filters change the line: it is fitted over the players drawn, not over everyone', () => {
  const all = modelOf(scatter(CHART, VIEWS.season, IDS, BYID, ROSTER, Object.values(VIEWS))), cheap = modelOf(scatter(CHART, VIEWS.season, IDS.slice(0, 8), BYID, ROSTER, Object.values(VIEWS)));
  assert.equal(cheap.fit.n, 8);
  assert.notEqual(all.fit.intercept, cheap.fit.intercept);
});

test('drawn: the tint polygons and the line stay inside the plot area, with a thumbnail and with the opened card, wide and narrow', () => {
  const m = plot('l3');
  for (const [W, narrow, mode] of [[640, false, 'thumb'], [900, false, 'full'], [360, true, 'full'], [340, true, 'thumb']]) {
    const H = Math.round(W * size('fantasy.charts-gallery.plot.' + (narrow && mode === 'full' ? 'aspect-narrow' : 'aspect')));
    const P = k => size('fantasy.charts-gallery.plot.' + k);
    const L = P(narrow ? 'margin-left-narrow' : 'margin-left'), R = P(narrow ? 'margin-right-narrow' : 'margin-right'), box = { x0: L, x1: W - R, y0: P('margin-top'), y1: H - P('margin-bottom') };
    const svg = drawScatter(m, W, narrow, mode, H);
    const polys = [...svg.matchAll(/<polygon class="fc-q (good|bad)" points="([^"]+)"/g)];
    assert.deepEqual(polys.map(p => p[1]).sort(), ['bad', 'good'], 'above = good, below = bad');
    for (const p of polys) assert.ok(inside(p[2].split(' ').map(q => q.split(',').map(Number)), box), `polygon inside the plot at ${W}`);
    const line = /<line class="fc-fit" x1="([^"]+)" y1="([^"]+)" x2="([^"]+)" y2="([^"]+)"/.exec(svg);
    assert.ok(line, 'the reference line is drawn');
    assert.ok(inside([[+line[1], +line[2]], [+line[3], +line[4]]], box), `line inside the plot at ${W}`);
    assert.ok(!/class="fc-q (good|bad)"[^>]*\bx=/.test(svg), 'no rectangular tint on this chart');
    assert.equal((svg.match(/class="fc-zone /g) || []).length, 2, 'both zone labels');
    assert.ok(svg.includes('Above typical for the price') && svg.includes('Below typical for the price'));
  }
});

test('drawn: a line that crosses the plot only partly still tints only inside it (steep line, flat line)', () => {
  const base = plot('season'), W = 640, H = 480, L = size('fantasy.charts-gallery.plot.margin-left'), R = size('fantasy.charts-gallery.plot.margin-right');
  const box = { x0: L, x1: W - R, y0: size('fantasy.charts-gallery.plot.margin-top'), y1: H - size('fantasy.charts-gallery.plot.margin-bottom') };
  for (const fit of [{ slope: 40, intercept: -400, n: 9 }, { slope: 0, intercept: 1e6, n: 9 }, { slope: -3, intercept: 80, n: 9 }]) {
    const svg = drawScatter({ ...base, fit }, W, false, 'thumb', H);
    for (const p of svg.matchAll(/<polygon class="fc-q (?:good|bad)" points="([^"]+)"/g)) assert.ok(inside(p[1].split(' ').map(q => q.split(',').map(Number)), box), JSON.stringify(fit));
  }
});

test('no line and no tint when the fit is undefined (fewer than two players, or one price)', () => {
  const same = IDS.map(() => 'x'), one = { ...VIEWS.season, fx: () => ({ cr: 10 }) };
  const m = modelOf(scatter(CHART, one, IDS, BYID, ROSTER, [one]));
  assert.equal(m.fit, null);
  const svg = drawScatter(m, 640, false, 'thumb');
  assert.ok(!svg.includes('fc-fit') && !svg.includes('<polygon') && !svg.includes('fc-zone'));
  assert.ok(same.length);
  assert.ok(scatter(CHART, VIEWS.season, ['p1'], BYID, ROSTER, [VIEWS.season]).includes('Not enough data'));
});

test('the move between windows: starts where the dots were, ends where they go, the line turns with them', () => {
  const a = plot('season'), b = plot('l3'), mid = between(a, b, 0.5);
  assert.deepEqual(between(a, b, 1), b);
  assert.deepEqual(between(undefined, b, 0.3), b);
  assert.deepEqual(between(a, b, 0).pts.map(p => p.b), a.pts.map(p => p.b));
  near(mid.fit.slope, (a.fit.slope + b.fit.slope) / 2); near(mid.fit.intercept, (a.fit.intercept + b.fit.intercept) / 2);
  mid.pts.forEach((p, i) => { near(p.b, (a.pts[i].b + b.pts[i].b) / 2); assert.equal(p.a, b.pts[i].a, 'x does not move'); });
  assert.deepEqual(mid.sx, b.sx);
  near(ease(0), 0); near(ease(1), 1); near(ease(0.5), 0.5); assert.ok(ease(0.25) < 0.25 && ease(0.75) > 0.75);
  const only = { ...b, pts: [...b.pts, { ...b.pts[0], id: 'new', b: 99 }] };   // a player who is only in the new window appears where he belongs
  assert.equal(between(a, only, 0.3).pts.find(p => p.id === 'new').b, 99);
});

test('a move is wanted only for a chart that asks, when the window changed, and not with reduced motion', () => {
  const m = plot('l3');
  assert.equal(wantsMove({ win: 'season', model: plot('season') }, m, false), true);
  assert.equal(wantsMove({ win: 'l3', model: m }, m, false), false, 'same window (a filter change, the opened card): no move');
  assert.equal(wantsMove(undefined, m, false), false, 'first drawing');
  assert.equal(wantsMove({ win: 'season', model: plot('season') }, m, true), false, 'prefers-reduced-motion: a jump');
  assert.equal(wantsMove({ win: 'season' }, { ...m, move: undefined }, false), false, 'the Teams charts never move');
  assert.ok(size('fantasy.charts-gallery.plot.move-ms') <= 500, 'a short ease');
});

// ---- the gallery: the axes come from the players the table lists, over all four windows
test('the axes are computed once over all four windows from the players the table lists; a player with a few minutes does not stretch them (unless everyone is shown)', async () => {
  const saved = { ...Data };
  const manifest = { eligibility: { availability: { window: 'l3', minGp: 1 }, windows: Object.fromEntries(WINDOWS.map(w => [w, { minGp: 3, minMin: 10, minPir: 5 }])) } };
  Object.assign(Data, { metrics: async () => ({ list: Object.values(BYID), byId: BYID }), roster: async () => ROSTER, manifest: async () => manifest, view: async (kind, w) => VIEWS[w] });
  try {
    const { galleryHtml } = await import('../../site/fantasy/gallery/gallery.js');
    const ids = IDS;   // the table's rows (the eligible ones)
    const per = {};
    for (const w of WINDOWS) per[w] = modelOf(await galleryHtml('players', 'profile', { win: w, view: 'profile', showAll: false }, ids));
    for (const w of WINDOWS.slice(1)) { assert.deepEqual(per[w].sx, per.season.sx); assert.deepEqual(per[w].sy, per.season.sy); }
    const real = WINDOWS.flatMap(w => IDS.map(id => rowsOf(w)[id].pir));
    assert.ok(per.season.sy.lo > -15, 'the -15 of a 2-minute player is not on the axis');
    assert.ok(per.season.sy.lo < Math.min(...real) && per.season.sy.hi > Math.max(...real));
    assert.notEqual(per.season.fit.slope, per.l3.fit.slope);
    const everyone = modelOf(await galleryHtml('players', 'profile', { win: 'season', view: 'profile', showAll: true }, ids));
    assert.ok(everyone.sy.lo < -15, 'with "below the thresholds" on, the extreme is on the axis (never off the plot)');
    assert.ok(axisScale(real).lo > -15);
    const html = await galleryHtml('players', 'profile', { win: 'season', view: 'profile' }, ids);
    assert.ok(html.includes('Performance vs price') && html.includes('It is not how Fantasy changes prices.'));
    assert.ok(!html.includes('Dashed lines = league values'), 'no league-lines key on this chart');
    assert.ok(html.includes('data-chart-id="players-price-pir"'));
    const shooting = await galleryHtml('players', 'shooting', { win: 'season', view: 'shooting' }, ids);
    assert.ok(shooting.includes('No comparative charts for this view yet'));
  } finally { Object.assign(Data, saved); }
});
