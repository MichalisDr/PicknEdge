// Players · Performance vs price (credits x PIR / game with the line of typical PIR at that price). Every test uses synthetic data: none reads the data files.
import test from 'node:test';
import assert from 'node:assert/strict';
import { fitLine, lineSegment, zones, area } from '../../site/fantasy/gallery/fit.js';
import { between, ease, wantsMove } from '../../site/fantasy/gallery/tween.js';
import { CHARTS, available } from '../../site/fantasy/gallery/charts.js';
import { scatter, drawScatter } from '../../site/fantasy/gallery/scatter.js';
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

test('registration: one players chart in the Profile view, the Teams charts are as they were', () => {
  assert.ok(CHART);
  assert.deepEqual([CHART.entity, CHART.view, CHART.x, CHART.y], ['players', 'profile', 'cr', 'pir']);
  assert.equal(CHART.title, 'Performance vs price');
  assert.equal(CHART.subtitle, 'Credits × PIR / game · line = typical PIR at that price (fit across all players with a price)');
  assert.deepEqual(CHART.zones, ['Above typical for the price', 'Below typical for the price']);
  assert.equal(available('players', 'profile'), true);
  assert.equal(available('players', 'shooting'), true);   // volume vs efficiency (volume-chart.test.mjs)
  assert.equal(available('teams', 'profile'), true);
  assert.equal(available('teams', 'shooting'), true);
  assert.equal(CHARTS.filter(c => c.entity === 'teams').length, 6);
  assert.deepEqual(CHARTS.filter(c => c.entity === 'players' && c.view === 'profile').map(c => c.id), ['players-price-pir']);
});

test('the chart reads credits through its own accessor, plots the PIR of the window, and fits the whole pool of the window', () => {
  const m = plot('season');
  assert.equal(m.pts.length, IDS.length, 'the dots are the ids handed over');
  const p3 = m.pts.find(p => p.id === 'p3');
  assert.deepEqual([p3.a, p3.b], [7, rowsOf('season').p3.pir], 'x = credits, y = PIR / game of the window');
  assert.equal(m.xTitle, 'Credits'); assert.equal(m.yTitle, 'PIR / game');
  const expect = fitLine(Object.values(rowsOf('season')).map(r => ({ x: r.cr, y: r.pir })));
  near(m.fit.slope, expect.slope); near(m.fit.intercept, expect.intercept);
  assert.equal(m.fit.n, IDS.length + 2, 'the pool = every player of the window with a price, the two below-threshold players included');
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

test('filters never feed the line: hiding players leaves the fit and the axes exactly as they were; hidden players are not drawn but are counted in the fit', () => {
  const draw = ids => modelOf(scatter(CHART, VIEWS.season, ids, BYID, ROSTER, Object.values(VIEWS)));
  const all = draw(Object.keys(rowsOf('season'))), listed = draw(IDS), few = draw(IDS.slice(0, 8)), none = draw(['p1', 'p2']);
  assert.deepEqual([all.pts.length, listed.pts.length, few.pts.length], [26, 24, 8]);
  for (const m of [listed, few, none]) { assert.deepEqual(m.fit, all.fit); assert.deepEqual(m.sx, all.sx); assert.deepEqual(m.sy, all.sy); }
  assert.equal(all.fit.n, 26);
  assert.ok(!few.pts.some(p => p.id === 'z1' || p.id === 'p20'), 'a hidden player is not drawn');
  assert.ok(all.sy.lo < -15, 'an extreme player of the pool is on the axis (not trimmed), whether he is drawn or not');
  assert.equal((drawScatter(few, 640, false, 'thumb').match(/class="fc-pt"/g) || []).length, 8);
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

// ---- the gallery: the AXES come from the players the table lists (thresholds + toggle), over all four windows; the LINE from the whole pool of the window
test('the gallery: axes from the listed players in all four windows; a below-threshold player moves them only with the toggle on; the line is the same either way', async () => {
  const saved = { ...Data };
  const manifest = { eligibility: { availability: { window: 'l3', minGp: 1 }, windows: Object.fromEntries(WINDOWS.map(w => [w, { minGp: 3, minMin: 10, minPir: 5 }])) } };
  const FAR = { cr: 40, pir: 60, gp: 1, min: 2 };   // below the thresholds, far out on both axes
  const withFar = view => { const get = view.get, fx = view.fx; return { ...view, keys: [...view.keys, 'far'], get: (id, m) => (id === 'far' ? { value: FAR[m] } : get(id, m)), fx: id => (id === 'far' ? { cr: FAR.cr } : fx(id)), row: () => ({ team: 'XXX', pos: 'G' }) }; };
  const V = Object.fromEntries(WINDOWS.map(w => [w, withFar(VIEWS[w])]));
  Object.assign(Data, { metrics: async () => ({ list: Object.values(BYID), byId: BYID }), roster: async () => ROSTER, manifest: async () => manifest, view: async (kind, w) => V[w] });
  try {
    const { galleryHtml } = await import('../../site/fantasy/gallery/gallery.js'), EVERYONE = V.season.keys;
    const off = {}, on = {};
    for (const w of WINDOWS) {
      off[w] = modelOf(await galleryHtml('players', 'profile', { win: w, view: 'profile', showAll: false }, IDS));        // toggle off: the listed players are drawn
      on[w] = modelOf(await galleryHtml('players', 'profile', { win: w, view: 'profile', showAll: true }, EVERYONE));      // toggle on: everyone
      assert.deepEqual(off[w].sx, off.season.sx, 'same x axis in every window'); assert.deepEqual(off[w].sy, off.season.sy, 'same y axis in every window');
      assert.deepEqual(on[w].sx, on.season.sx); assert.deepEqual(on[w].sy, on.season.sy);
      assert.deepEqual(off[w].fit, on[w].fit, w + ': the line is identical with the toggle on and off');
      assert.equal(off[w].fit.n, IDS.length + 3, 'the line is fitted over the whole pool, the hidden players included');
    }
    const top = Math.max(...IDS.map((_, k) => 4 + k)), best = Math.max(...WINDOWS.flatMap(w => IDS.map(id => rowsOf(w)[id].pir)));
    assert.equal(off.season.sx.lo, 4); assert.equal(off.season.sx.hi, top + 1, 'toggle off: ends above the highest LISTED credits (not the 40 of the hidden player)');
    assert.ok(off.season.sy.hi < 60 && off.season.sy.lo > -15 && off.season.sy.hi > best, 'toggle off: the hidden players are not on the y axis');
    assert.equal(on.season.sx.hi, 41, 'toggle on: the player is listed, so he is part of the axes');
    assert.ok(on.season.sy.hi >= 60 && on.season.sy.lo < -15);
    assert.notDeepEqual(on.season.sx, off.season.sx);
    assert.equal(off.l3.pts.length, IDS.length); assert.equal(on.l3.pts.length, IDS.length + 3);
    // position, search and the drawer do not reach the axes: the dots handed over change, the axes do not
    const fewer = modelOf(await galleryHtml('players', 'profile', { win: 'season', view: 'profile', showAll: false, position: ['F'], query: 'p1', minCr: 10 }, IDS.slice(0, 4)));
    assert.deepEqual(fewer.sx, off.season.sx); assert.deepEqual(fewer.sy, off.season.sy); assert.deepEqual(fewer.fit, off.season.fit);
    const html = await galleryHtml('players', 'profile', { win: 'season', view: 'profile' }, IDS);
    assert.ok(html.includes('Performance vs price') && html.includes('filters only hide dots. It is not how Fantasy changes prices.'));
    assert.ok(html.includes('data-chart-id="players-price-pir"'));
  } finally { Object.assign(Data, saved); }
});

// ---- the credits axis: a real minimum of 4, whole numbers
import { integerScale, axisScale } from '../../site/fantasy/gallery/scale.js';
import { axisFloor } from '../../site/fantasy/gallery/axes.js';

test('integerScale: starts exactly at the floor, ends at the first whole number above the highest value, a tick at every whole number', () => {
  const s = integerScale([4, 9.5, 20.2], 4);
  assert.equal(s.lo, 4); assert.equal(s.hi, 21);
  assert.deepEqual(s.ticks, Array.from({ length: 18 }, (_, i) => 4 + i));
  assert.deepEqual(s.grid, s.ticks, 'the grid is every whole number');
  assert.deepEqual(s.thumb, [4, 6, 8, 10, 12, 14, 16, 18, 20], 'labels on every second whole number');
  assert.equal(integerScale([5, 20], 4).hi, 21, 'a highest value exactly on a whole number still gets one more');
  assert.equal(integerScale([6.1, 7], 4).lo, 4, 'the floor, not the lowest value');
  assert.equal(integerScale([3, 9], 4).lo, 3, 'a value below the floor is never cut off');
  assert.equal(axisFloor('cr'), 4); assert.equal(axisFloor('pir'), undefined);
});

test('the credits axis of the chart: 4 to the next whole number above the pool\'s highest credits (all windows), drawn with a grid line at every whole number; PIR keeps the round-tick rule', () => {
  const m = plot('season'), top = Math.max(...Object.values(rowsOf('season')).map(r => r.cr));   // 27 in the synthetic league
  assert.equal(m.sx.lo, 4); assert.equal(m.sx.hi, Math.floor(top) + 1);
  assert.deepEqual(m.sx.grid, m.sx.ticks);
  assert.equal(m.sy.grid, undefined, 'PIR: the general rule');
  assert.ok(m.sy.step > 1 || m.sy.ticks.length <= 9);
  const grid = svg => (svg.match(/<line class="fc-grid" x1="([\d.]+)" x2="\1"/g) || []).length;
  const label = svg => [...svg.matchAll(/<text class="fc-tick"[^>]*text-anchor="middle">([^<]+)</g)].map(x => +x[1]);
  const all = m.sx.ticks.length;
  assert.equal(grid(drawScatter(m, 900, false, 'full')), all); assert.deepEqual(label(drawScatter(m, 900, false, 'full')), m.sx.ticks);
  assert.equal(grid(drawScatter(m, 640, false, 'thumb')), all, 'the thumbnail keeps every grid line'); assert.deepEqual(label(drawScatter(m, 640, false, 'thumb')), m.sx.thumb);
  assert.equal(grid(drawScatter(m, 360, true, 'full')), all); assert.deepEqual(label(drawScatter(m, 360, true, 'full')), m.sx.thumb, 'narrow: every second label');
});

test('the credits axis is identical with the filters on and off, and in every window', () => {
  const draw = (w, ids) => modelOf(scatter(CHART, VIEWS[w], ids, BYID, ROSTER, Object.values(VIEWS))).sx;
  const ref = draw('season', Object.keys(rowsOf('season')));
  for (const w of WINDOWS) for (const ids of [IDS, IDS.slice(0, 3), ['p1', 'p2']]) assert.deepEqual(draw(w, ids), ref);
});

// ---- dots in the team's colour, labels on the outliers
import { readFileSync } from 'node:fs';
import { teamColour } from '../../site/core/team-colour.js';
import { teamCode } from '../../site/core/teams.js';
import { themeVariables } from '../../site/theme/generate.mjs';
import { pickOutliers, placeLabels, surname } from '../../site/fantasy/gallery/labels.js';

const VARS = new Map(themeVariables(JSON.parse(readFileSync(new URL('../../site/theme/theme.json', import.meta.url), 'utf8'))));
/** What the browser would paint for the declaration teamColour() returns: the team's own key when the theme defines it, else the default key. */
const paint = decl => {
  const [, key, fallback] = /var\((--[\w-]+), var\((--[\w-]+)\)\)/.exec(decl), pick = VARS.has(key) ? key : fallback;
  return { pick, value: VARS.get(pick) };
};

test('team colour: the theme primary for a team by public code, the neutral default only for a code not in the registry', () => {
  assert.equal(teamColour('BAR'), '--fade-colour:var(--fantasy-team-colour-primary-BAR, var(--fantasy-team-colour-neutral-colour))');
  const bar = paint(teamColour('BAR'));
  assert.equal(bar.pick, '--fantasy-team-colour-primary-BAR'); assert.match(bar.value, /^#[0-9a-f]{6}$/i);
  for (const team of ['BJK', 'PAR', 'PBB', 'VIR']) assert.equal(paint(teamColour(team)).pick, '--fantasy-team-colour-primary-' + team, team + ' keeps its true primary');
  assert.equal(paint(teamColour('ZZZ')).pick, '--fantasy-team-colour-neutral-colour', 'an unknown code gets the neutral colour');
  assert.ok(!teamColour('B<A"R').includes('<') && !teamColour('B<A"R').includes('"'));
});

test('the dots: players are drawn as team-coloured dots (thumbnail and opened card), never as logos; the Teams charts still draw logos', () => {
  const ROS = { teams: {}, players: {}, logoIds: { XXX: 'barcelona' } };
  const m = modelOf(scatter(CHART, VIEWS.season, IDS, BYID, ROS, Object.values(VIEWS)));
  assert.equal(m.plain, true); assert.ok(m.pts.every(p => p.team === 'BAR' && p.logo === ''), 'no logo on a player');
  for (const [W, narrow, mode] of [[640, false, 'thumb'], [900, false, 'full'], [360, true, 'full']]) {
    const svg = drawScatter(m, W, narrow, mode);
    assert.ok(!svg.includes('<image'), 'no logos');
    const dots = svg.match(/<circle class="fc-dot fc-team" r="(\d+)" style="--fade-colour:var\(--fantasy-team-colour-primary-BAR, var\(--fantasy-team-colour-neutral-colour\)\)"/g) || [];
    assert.equal(dots.length, IDS.length, `every dot in the team colour (${mode})`);
    assert.ok(dots.every(d => d.includes(`r="${size('fantasy.charts-gallery.plot.dot-radius')}"`)), 'radius = the dot-radius token');
  }
  assert.ok(m.pts[0].tip.includes(' · ' + teamCode(ROS, 'XXX') + ' · Credits '), 'the read-out names the team');
  // the Teams charts are as they were: a logo, no team colour
  const t = { id: 'a', a: 1, b: 2, name: 'A', logo: 'assets/logos/x.png', tip: 't' };
  const tm = { title: 't', xTitle: 'x', yTitle: 'y', equal: false, fav: { x: 0, y: 0 }, sx: axisScale([0, 4]), sy: axisScale([0, 4]), avg: null, pts: [t, { ...t, id: 'b', a: 2, b: 3 }] };
  assert.ok(drawScatter(tm, 900, false, 'full').includes('<image'), 'a team keeps its logo');
  assert.ok(!drawScatter(tm, 900, false, 'full').includes('fc-team'));
});

test('outliers: the 5 furthest above and the 5 furthest below the fitted line by vertical distance; fewer when fewer are drawn', () => {
  const line = { slope: 1, intercept: 0 };
  const pts = Array.from({ length: 24 }, (_, i) => ({ id: 'q' + i, a: i, b: i + (i % 2 ? 1 : -1) * (i + 1) / 10 }));   // residual = +-(i + 1) / 10
  const o = pickOutliers(pts, line);
  assert.equal(o.length, 10);
  assert.deepEqual(o.filter(x => x.resid > 0).map(x => x.id), ['q23', 'q21', 'q19', 'q17', 'q15'], 'above: furthest first');
  assert.deepEqual(o.filter(x => x.resid < 0).map(x => x.id), ['q22', 'q20', 'q18', 'q16', 'q14'], 'below');
  for (let i = 1; i < o.length; i++) assert.ok(Math.abs(o[i - 1].resid) >= Math.abs(o[i].resid));
  assert.equal(pickOutliers(pts.slice(0, 6), line).length, 6, 'fewer than 10 drawn: every one that lies off the line');
  assert.equal(pickOutliers(pts.slice(0, 1), line).length, 1);
  assert.deepEqual(pickOutliers(pts, null), []);
  assert.equal(pickOutliers([{ id: 'on', a: 1, b: 1 }], line).length, 0, 'a dot exactly on the line is neither above nor below');
  assert.equal(surname('Nikola Mirotic'), 'Mirotic'); assert.equal(surname('Prince'), 'Prince');
});

const clash = (a, b, gap = 0) => a.x < b.x + b.w + gap && b.x < a.x + a.w + gap && a.y < b.y + b.h + gap && b.y < a.y + a.h + gap;

test('labels never overlap each other, a blocked box, or leave the plot; one that cannot fit is dropped', () => {
  const bounds = { x0: 64, x1: 620, y0: 16, y1: 432 }, w = 56, h = 16, r = 4, gap = 4;
  const crowd = Array.from({ length: 10 }, (_, i) => ({ id: 'c' + i, x: 300 + (i % 3) * 3, y: 200 + (i % 4) * 2, r, w, h }));   // ten dots almost on top of each other
  const edge = [{ id: 'e1', x: 66, y: 18, r, w, h }, { id: 'e2', x: 618, y: 430, r, w, h }, { id: 'e3', x: 600, y: 20, r, w: 80, h }];   // at the corners of the plot
  const blocked = [{ x: 72, y: 24, w: 160, h }];
  const out = placeLabels([...edge, ...crowd], bounds, blocked, gap);
  assert.ok(out.length >= 3 && out.length < 13, 'some are placed, some are dropped: ' + out.length);
  for (const l of out) {
    assert.ok(l.x >= bounds.x0 && l.x + l.w <= bounds.x1 && l.y >= bounds.y0 && l.y + l.h <= bounds.y1, `${l.id} inside the plot`);
    assert.ok(!blocked.some(b => clash(l, b)), `${l.id} clear of the zone label`);
  }
  for (let i = 0; i < out.length; i++) for (let j = i + 1; j < out.length; j++) assert.ok(!clash(out[i], out[j], gap), `${out[i].id} / ${out[j].id}`);
  assert.deepEqual(placeLabels([{ id: 'big', x: 300, y: 200, r, w: 900, h }], bounds, [], gap), [], 'wider than the plot: dropped, not squeezed');
  assert.deepEqual(placeLabels([{ id: 'ok', x: 300, y: 200, r, w, h }], bounds, [], gap).map(l => l.id), ['ok']);
});

test('drawn: the opened card names the outliers, the thumbnail names none, and no label overlaps another or leaves the plot', () => {
  const names = Object.fromEntries(IDS.map((id, i) => [id, { name: 'First Surname' + i }]));
  const model = modelOf(scatter(CHART, VIEWS.season, IDS, BYID, { ...ROSTER, players: names }, Object.values(VIEWS)));
  const thumb = drawScatter(model, 640, false, 'thumb'), full = drawScatter(model, 900, false, 'full');
  assert.ok(!/class="fc-pl"/.test(thumb), 'no labels in the thumbnail');
  const tags = [...full.matchAll(/<text class="fc-pl" x="([\d.]+)" y="([\d.]+)" dominant-baseline="central"(?: text-anchor="(end|middle)")?>Surname(\d+)</g)];
  assert.ok(tags.length > 0 && tags.length <= 10, 'labels: ' + tags.length);
  const P = k => size('fantasy.charts-gallery.plot.' + k), L = P('margin-left'), R = P('margin-right'), H = Math.round(900 * P('aspect')), box = { x0: L, x1: 900 - R, y0: P('margin-top'), y1: H - P('margin-bottom') };
  const rects = tags.map(t => { const id = 'Surname' + t[4], w = id.length * P('label-char-width'); return { id, x: +t[1] - (t[3] === 'end' ? w : t[3] === 'middle' ? w / 2 : 0), y: +t[2] - P('label-height') / 2, w, h: P('label-height') }; });   // the box from the anchor
  for (const r of rects) assert.ok(r.x >= box.x0 - 0.1 && r.x + r.w <= box.x1 + 0.1 && r.y >= box.y0 - 0.1 && r.y + r.h <= box.y1 + 0.1, r.id + ' inside the plot');
  for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) assert.ok(!clash(rects[i], rects[j]), `${rects[i].id} / ${rects[j].id}`);
  const wanted = new Set(pickOutliers(model.pts, model.fit).map(o => 'Surname' + o.id.slice(1)));
  for (const r of rects) assert.ok(wanted.has(r.id), r.id + ' is one of the 5 + 5');
});
