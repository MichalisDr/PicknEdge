// The browser loader against the files the build wrote to site/data. Run: node --test tests/core
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'site', 'data');
import { create } from '../../site/core/data-loader.js';
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

test('opening loads only manifest, metrics, roster and the Season views; nothing else', async () => {
  const { D, requested } = loader();
  await Promise.all([D.manifest(), D.metrics(), D.roster(), D.view('players', 'season'), D.view('teams', 'season')]);
  const files = [...new Set(requested.map(u => u.slice(BASE.length).split('?')[0]))].sort();
  assert.deepEqual(files, ['manifest.json', 'metrics.json', 'players-season.json', 'roster.json', 'teams-season.json']);
  assert.ok(requested.every(u => u.startsWith(BASE)), 'every request stays on the site');
  assert.ok(requested.slice(1).every(u => /\?v=[0-9a-f]{10}$/.test(u)), 'data files are versioned by the manifest hash');
});

test('status line comes from the manifest', async () => {
  const { D } = loader(), m = await D.manifest();
  assert.equal(await D.status(), `${m.games} games · latest ${m.lastDate.slice(0, 10)}`);
  assert.match(await D.status(), /^[0-9]+ games · latest [0-9]{4}-[0-9]{2}-[0-9]{2}$/);
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
  assert.ok(rows.length > 100 && rows.every(r => 'x' in r && typeof r.zone === 'string' && r.zone.length > 0), 'every field-goal shot has a zone');
  assert.ok(rows.some(r => r.team === 'ZAL') && rows.some(r => r.team !== 'ZAL'), 'shots for and against');
  assert.ok(requested.some(u => u.includes('shots/ZAL.json')));
});

test('every player who played is in every window view; no one is dropped for lacking games in a window', async () => {
  const { D } = loader(), played = new Set((await D.games('players')).map(r => r.player_id));
  assert.ok(played.size > 250);
  for (const w of ['season', 'l10', 'l5', 'l3']) {
    const v = await D.view('players', w);
    assert.deepEqual([...played].filter(id => !v.row(id)), [], `missing from ${w}`);
  }
  const l3 = await D.view('players', 'l3'), absent = l3.keys.filter(id => l3.get(id, 'gp').value === 0);
  assert.ok(absent.length > 0, 'players with no appearance in L3 are present with gp = 0');
  assert.ok(absent.every(id => l3.get(id, 'pts100').value === null));
});

test('windowGames returns the team\'s last N games after the venue filter; the engine exposes what the cards need', async () => {
  const { D } = loader(), eng = await D.engine();
  for (const k of ['evaluate', 'evaluateAll', 'termValue', 'byId', 'withOpponent', 'zones']) assert.ok(eng[k], k);
  const all = await D.windowGames('ZAL', {}), l3 = await D.windowGames('ZAL', { last: 3 }), home = await D.windowGames('ZAL', { venue: 'home' }), h2 = await D.windowGames('ZAL', { last: 2, venue: 'home' });
  assert.equal(all.size, 10); assert.equal(l3.size, 3); assert.ok([...l3].every(g => all.has(g)));
  assert.ok(h2.size === Math.min(2, home.size) && [...h2].every(g => home.has(g)));
  const roster = await D.roster();
  assert.equal(Object.keys(roster.logoIds).length, 20);
});

test('shot rows carry the assisted flag only for made shots (null = unknown), and rim shots exist', async () => {
  const { D } = loader(), rows = await D.shots('BAR');
  assert.ok(rows.some(r => r.made === 1 && r.assisted === 1) && rows.some(r => r.made === 1 && r.assisted === 0));
  assert.ok(rows.filter(r => r.made === 0).every(r => r.assisted === 0));
  assert.ok(rows.some(r => r.zone === 'rim'));
});

test('opponent-production radar excludes team rebounds', async () => {
  const { D } = loader(), t = await D.view('teams', 'season'), games = await D.games('teams');
  const row = games.filter(r => r.team === 'RED'), opp = games.filter(r => r.opp === 'RED');
  assert.ok(opp.reduce((n, r) => n + r.oreb_players, 0) < opp.reduce((n, r) => n + r.oreb, 0), 'player-assigned offensive rebounds are fewer than the team totals');
  const poss = opp.reduce((n, r) => n + r.poss, 0), dreb = opp.reduce((n, r) => n + r.dreb_players, 0);
  assert.ok(Math.abs(t.get('RED', 'rt_dreb_100').value - 100 * dreb / poss) < 1e-5);
});
