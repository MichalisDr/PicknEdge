// The browser loader against the files the build wrote to site/data. Run: node --test tests/loader
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'site', 'data');
const { create } = createRequire(import.meta.url)('../../site/data-loader.js');
const BASE = 'http://localhost/data/';

function loader() {
  const requested = [];
  const fetchFn = async (u) => {
    requested.push(u);
    const path = u.slice(BASE.length).split('?')[0];
    try { const text = readFileSync(join(root, path), 'utf8'); return { ok: true, status: 200, json: async () => JSON.parse(text) }; }
    catch { return { ok: false, status: 404, json: async () => ({}) }; }
  };
  const importer = u => import(pathToFileURL(join(root, u.slice(BASE.length).split('?')[0])).href);
  return { D: create({ base: BASE, fetch: fetchFn, importer }), requested };
}

test('opening loads only manifest, metrics, roster, schedule and the Season views; nothing else', async () => {
  const { D, requested } = loader();
  await Promise.all([D.manifest(), D.metrics(), D.roster(), D.schedule(), D.view('players', 'season'), D.view('teams', 'season')]);
  const files = [...new Set(requested.map(u => u.slice(BASE.length).split('?')[0]))].sort();
  assert.deepEqual(files, ['manifest.json', 'metrics.json', 'players-season.json', 'roster.json', 'schedule.json', 'teams-season.json']);
  assert.ok(requested.every(u => u.startsWith(BASE)), 'every request stays on the site');
  assert.ok(requested.slice(1).every(u => /\?v=[0-9a-f]{10}$/.test(u)), 'data files are versioned by the manifest hash');
});

test('status line comes from the manifest', async () => {
  const { D } = loader(), m = await D.manifest();
  assert.equal(await D.status(), `${m.games} games · latest ${m.lastDate.slice(0, 10)}`);
  assert.match(await D.status(), /^[0-9]+ games · latest [0-9]{4}-[0-9]{2}-[0-9]{2}$/);
});

test('a custom window with no filter equals the precomputed Season view', async () => {
  const { D } = loader(), season = await D.view('players', 'season'), custom = await D.customView('players', {});
  assert.deepEqual(custom.keys.sort(), season.keys.sort());
  for (const pid of season.keys.slice(0, 60)) for (const id of season.metrics) {
    const a = season.get(pid, id), b = custom.get(pid, id);
    assert.ok((a.value === null) === (b.value === null) && (a.value === null || Math.abs(a.value - b.value) < 1e-5), `${pid} ${id}: ${a.value} vs ${b.value}`);
  }
});

test('custom Last 5 equals the precomputed L5 view, for players and teams', async () => {
  const { D } = loader();
  for (const kind of ['players', 'teams']) {
    const l5 = await D.view(kind, 'l5'), custom = await D.customView(kind, { last: 5 });
    for (const key of l5.keys.slice(0, 40)) for (const id of l5.metrics) {
      const a = l5.get(key, id), b = custom.get(key, id);
      assert.ok((a.value === null) === (b.value === null) && (a.value === null || Math.abs(a.value - b.value) < 1e-5), `${kind} ${key} ${id}: ${a.value} vs ${b.value}`);
    }
  }
});

test('home and away windows split a team\'s games exactly; Last 7 takes at most 7', async () => {
  const { D } = loader(), all = await D.customView('teams', {}), home = await D.customView('teams', { venue: 'home' }), away = await D.customView('teams', { venue: 'away' });
  for (const t of all.keys) assert.equal(home.row(t).games + away.row(t).games, all.row(t).games, t);
  const l7 = await D.customView('teams', { last: 7 });
  assert.ok(l7.keys.every(t => l7.row(t).games === Math.min(7, all.row(t).games)));
  const h3 = await D.customView('teams', { last: 3, venue: 'home' });
  assert.ok(h3.keys.every(t => h3.row(t).games === Math.min(3, home.row(t).games)));
});

test('league row equals the sum over all rows of the window', async () => {
  const { D } = loader(), v = await D.view('teams', 'season');
  const ortg = v.league('ortg').value;
  assert.ok(ortg > 90 && ortg < 130, `league ORtg ${ortg}`);
  const drtg = v.league('drtg').value;
  assert.ok(Math.abs(ortg - drtg) < 1e-6, 'league ORtg equals league DRtg: every point scored is a point allowed');
});

test('clearOldCaches removes only the old data keys', () => {
  const { D } = loader();
  const store = { 'courtvision-betting-live-E2026-v3': '1', 'picknedge-schedule-E2026-v1': '1', 'picknedge-shots-E2026-v2': '1', 'courtvision-betting-people-E2026-v1': '1', 'picknedge-theme': 'dark', other: 'x',
    removeItem(k) { delete this[k]; } };
  assert.equal(D.clearOldCaches(store), 4);
  assert.deepEqual(Object.keys(store).filter(k => typeof store[k] !== 'function').sort(), ['other', 'picknedge-theme']);
});

test('shots and per-game rows are loaded on demand', async () => {
  const { D, requested } = loader();
  const rows = await D.shots('ZAL');
  assert.ok(rows.length > 100 && rows.every(r => 'x' in r && 'zone' in r));
  assert.ok(rows.some(r => r.team === 'ZAL') && rows.some(r => r.team !== 'ZAL'), 'shots for and against');
  assert.ok(requested.some(u => u.includes('shots/ZAL.json')));
});

test('every player who played is in every window view, built and custom; no one is dropped for lacking games in a window', async () => {
  const { D } = loader(), played = new Set((await D.games('players')).map(r => r.player_id));
  assert.ok(played.size > 250);
  for (const w of ['season', 'l10', 'l5', 'l3']) {
    const v = await D.view('players', w);
    assert.deepEqual([...played].filter(id => !v.row(id)), [], `missing from ${w}`);
  }
  for (const spec of [{}, { last: 3 }, { last: 7 }, { last: 3, venue: 'home' }, { venue: 'away' }]) {
    const v = await D.customView('players', spec);
    assert.deepEqual([...played].filter(id => !v.row(id)), [], `missing from custom ${JSON.stringify(spec)}`);
  }
  const l3 = await D.view('players', 'l3'), absent = l3.keys.filter(id => l3.get(id, 'gp').value === 0);
  assert.ok(absent.length > 0, 'players with no appearance in L3 are present with gp = 0');
  assert.ok(absent.every(id => l3.get(id, 'pts100').value === null));
});

test('average() over a chosen set of players equals the engine over exactly those players\' rows', async () => {
  const { D } = loader(), season = await D.view('players', 'season');
  const keys = season.keys.filter(k => season.row(k).pos === 'G');
  const avg = await D.average('players', {}, keys), all = await D.average('players', {}, season.keys);
  assert.ok(Math.abs(all.league('pts100').value - season.league('pts100').value) < 1e-5, 'all players = the league row');
  assert.notEqual(avg.league('pts100').value, all.league('pts100').value);
  const g = await D.games('players'), rows = g.filter(r => keys.includes(r.player_id));
  const pts = rows.reduce((n, r) => n + r.m1 + 2 * r.m2 + 3 * r.m3, 0), poss = rows.reduce((n, r) => n + r.poss_off_on, 0);
  assert.ok(Math.abs(avg.league('pts100').value - 100 * pts / poss) < 1e-5);
});
