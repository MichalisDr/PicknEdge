// Fantasy credits: pull (snapshots, expired token, shape), match to our players, cr / crSeries / value / valueSeries per window, and the loader's fantasyInfo.
// No network: the backend is a fake fetch serving a small invented league. Run: node --test tests/build/fantasy.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { gunzipSync } from 'node:zlib';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pull, run, store, snapshotText, snapshotFiles, snapshotDir, mask } from '../../scripts/fetch/fantasy.mjs';
import { readFantasy, creditsAfter, matchPlayers, fantasyForBuild } from '../../scripts/build/fantasy.mjs';
import { buildViews } from '../../scripts/build/views.mjs';
import { create } from '../../site/core/data-loader.js';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const TOKEN = 'Bearer 1234567|AbCdEfGhIjKlMnOpQrStUvWxYz0123456789AbCdEfGhIjKl';   // invented, token-shaped
const COLUMNS = ['rank', 'name', 'position', 'team', 'fpt', 'quotation', 'plus'];

/* ---------- the invented league: 4 rounds, matchday ids 100..103 ---------- */
// per player: credits in force for each round (q) and the change that led into it (p); current = the price today (after round 4)
const WORLD = {
  alpha: { id: 1, name: 'A. Alpha', team: 'AAA', pos: 'Guard', q: [10, 10.5, 10.2, 10.2], p: [0, 0.5, -0.3, 0], current: 10.6 },
  beta: { id: 2, name: 'B. Beta', team: 'BBB', pos: 'Forward', q: [8, 8, 8, 8], p: [0, 0, 0, 0], current: 7.8 },
  gamma: { id: 3, name: 'C. Gamma', team: 'AAA', pos: 'Center', q: [null, 6, 6.4, 6.4], p: [null, 0, 0.4, 0], current: 6.2 },   // joins at round 2
  zed: { id: 4, name: 'Z. Zed', team: 'BBB', pos: 'Guard', q: [5, 5, 5, 5], p: [0, 0, 0, 0], current: 5 },                        // not in our data
  coach: { id: 5, name: 'H. Coach', team: 'AAA', pos: 'Head Coach', q: [10, 10, 10, 10], p: [0, 0, 0, 0], current: 10 },
};
const fmt = x => (x >= 0 ? '+' : '') + x.toFixed(1);
const rowOf = (w, i, round) => [String(i + 1), w.name, w.pos, w.team, '20.0', String(round === null ? w.current : w.q[round]), round === null ? fmt(w.current - w.q.find(q => q !== null)) : fmt(w.p[round])];
function fakeBackend(world = WORLD, { chunk = 2, status = 200, tweak = null } = {}) {
  const calls = [];
  const fn = async (url, opts) => {
    calls.push({ url, opts });
    if (status !== 200) return { status, ok: false, headers: { get: () => null }, text: async () => '{"code":"UNAUTHENTICATED"}' };
    const u = new URL(url);
    const body = j => ({ status: 200, ok: true, headers: { get: () => null }, text: async () => JSON.stringify(j) });
    if (u.pathname.includes('/trend')) return body({ data: { trend: [0, 1, 2, 3].map(r => ({ fantasy_pts: 10, matchday: { id: 100 + r, number: r + 1 } })).reverse() } });
    const md = u.searchParams.get('matchdays'), round = md ? Number(md) - 100 : null, page = Number(u.searchParams.get('page'));
    const players = Object.values(world).filter(w => round === null || w.q[round] !== null);
    const slice = players.slice((page - 1) * chunk, page * chunk);
    const j = { data: { columns: COLUMNS, players: slice.map(w => ({ id: w.id, row: rowOf(w, players.indexOf(w), round) })) }, meta: { current_page: page, per_page: chunk, total: players.length, last_page: Math.ceil(players.length / chunk) } };
    tweak?.(j, { round, page });
    return body(j);
  };
  fn.calls = calls;
  return fn;
}
const temp = () => mkdtempSync(join(tmpdir(), 'fantasy-test-'));
const files = root => (existsSync(root) ? readdirSync(root, { recursive: true }).filter(f => f.endsWith('.json.gz')).sort() : []);
const opts = (root, fetch) => ({ root, token: TOKEN, fetch, sleep: async () => {}, gapMs: 0, log: () => {}, warn: () => {} });

/* ---------- pull ---------- */
test('pull stores every response exactly as received (all pages of a table in one snapshot), 1 players table + 3 trends + 4 round tables', async () => {
  const root = temp(), fetch = fakeBackend();
  const r = await pull(opts(root, fetch));
  assert.equal(r.status, 'ok');
  assert.equal(files(root).length, 1 + 3 + 4);
  const text = gunzipSync(readFileSync(join(root, 'players', 'all', snapshotFiles(snapshotDir(root, 'players', 'all'))[0]))).toString('utf8');
  assert.ok(fetch.calls.every(c => c.opts.headers.authorization === TOKEN), 'the token is sent as the Authorization header');
  const first = await (await fetch(fetch.calls.find(c => /matchdays=&/.test(c.url)).url.replace(/page=\d+/, 'page=1'))).text();
  assert.ok(text.startsWith('{"pages":[' + first + ','), 'page 1 appears verbatim inside the snapshot');
  assert.ok(!/20\d\d-\d\d-\d\dT/.test(text), 'no timestamp inside the file');
});

test('a bare token (no "Bearer " prefix) is sent with the prefix', async () => {
  const root = temp(), fetch = fakeBackend();
  await pull({ ...opts(root, fetch), token: TOKEN.replace('Bearer ', '') });
  assert.ok(fetch.calls.every(c => c.opts.headers.authorization === TOKEN));
});

test('an unchanged snapshot is not rewritten; a changed one is added next to the old, which is never touched', async () => {
  const root = temp();
  await pull(opts(root, fakeBackend()));
  const before = files(root), oldBytes = readFileSync(join(root, 'players', 'all', snapshotFiles(snapshotDir(root, 'players', 'all'))[0]));
  const again = await pull({ ...opts(root, fakeBackend()), now: new Date(Date.now() + 86400e3) });
  assert.deepEqual(files(root), before, 'same responses: no new file');
  assert.equal(again.written, 0);
  const changed = { ...WORLD, alpha: { ...WORLD.alpha, current: 10.9 } };
  const r = await pull({ ...opts(root, fakeBackend(changed)), now: new Date(Date.now() + 2 * 86400e3) });
  assert.equal(r.written, 1, 'only the players table changed');
  const names = snapshotFiles(snapshotDir(root, 'players', 'all'));
  assert.equal(names.length, 2);
  assert.deepEqual(readFileSync(join(root, 'players', 'all', names[0])), oldBytes, 'the old snapshot is intact');
  assert.equal(files(root).length, before.length + 1);
});

test('store never overwrites a snapshot, even when two differing texts get the same second', () => {
  const root = temp(), at = new Date('2026-11-16T10:00:00Z');
  assert.equal(store(root, 'players', 'all', 'a', at), 'new');
  assert.equal(store(root, 'players', 'all', 'b', at), 'new');
  assert.equal(snapshotFiles(snapshotDir(root, 'players', 'all')).length, 2);
  assert.equal(store(root, 'players', 'all', 'b', at), 'unchanged');
});

test('expired or rejected token (401 / 403): one warning, nothing written, exit code 0', async () => {
  for (const status of [401, 403]) {
    const root = temp(), warnings = [];
    const code = await run({ argv: ['node', 'x'], env: { FANTAKING_TOKEN: TOKEN }, root, fetch: fakeBackend(WORLD, { status }), sleep: async () => {}, gapMs: 0, log: () => {}, warn: m => warnings.push(m), error: () => {} });
    assert.equal(code, 0);
    assert.deepEqual(files(root), []);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /FANTAKING_TOKEN/);
    assert.ok(!warnings[0].includes('AbCdEf'), 'the token is not printed');
  }
});

test('no token at all: one warning, nothing written, exit code 0, no request made', async () => {
  const root = temp(), warnings = [], fetch = fakeBackend();
  const code = await run({ argv: ['node', 'x'], env: {}, root, fetch, sleep: async () => {}, gapMs: 0, log: () => {}, warn: m => warnings.push(m), error: () => {} });
  assert.equal(code, 0);
  assert.equal(warnings.length, 1);
  assert.equal(fetch.calls.length, 0);
  assert.deepEqual(files(root), []);
});

test('a changed API shape stops loudly (exit 2) and the token never appears in the output', async () => {
  const root = temp(), out = [];
  const badFetch = fakeBackend(WORLD, { tweak: j => { j.data.players[0].row[5] = 'n/a'; } });
  const code = await run({ argv: ['node', 'x'], env: { FANTAKING_TOKEN: TOKEN }, root, fetch: badFetch, sleep: async () => {}, gapMs: 0, log: m => out.push(m), warn: m => out.push(m), error: m => out.push(m) });
  assert.equal(code, 2);
  assert.deepEqual(files(root), []);
  assert.match(out.join('\n'), /shape changed/);
  const leaking = async () => { throw new Error(`connection to the host failed, header was ${TOKEN}`); };
  const out2 = [];
  const code2 = await run({ argv: ['node', 'x'], env: { FANTAKING_TOKEN: TOKEN }, root, fetch: leaking, sleep: async () => {}, gapMs: 0, log: m => out2.push(m), warn: m => out2.push(m), error: m => out2.push(m) });
  assert.equal(code2, 1);
  assert.ok(!out2.join('\n').includes('AbCdEf'), 'a message that contains the token is masked');
  assert.equal(mask(`x ${TOKEN} y`, TOKEN).includes('AbCdEf'), false);
});

test('rows missing from a page (a table that moves while it is read) are caught, not stored', async () => {
  const root = temp();
  const dup = fakeBackend(WORLD, { tweak: (j, { page }) => { if (page === 2) j.data.players.push({ ...j.data.players[0] }); } });
  await assert.rejects(pull(opts(root, dup)), /twice|meta\.total/);
  assert.deepEqual(files(root), []);
});

test('no token-shaped string is committed (tracked files and the stored Fantasy snapshots)', () => {
  const SHAPES = [/\b\d{1,10}\|[A-Za-z0-9]{30,}\b/, /\bBearer\s+[A-Za-z0-9|._~+\/=-]{20,}/i];
  const listed = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: repo }).toString('utf8').split('\0').filter(Boolean);
  const hits = [];
  for (const f of listed) {
    const p = join(repo, f);
    if (!existsSync(p) || !statSync(p).isFile() || f === 'tests/build/fantasy.test.mjs') continue;     // this file holds an invented token on purpose
    if (/\.(webp|png|jpe?g|ico|woff2?)$/i.test(f)) continue;
    let text;
    try { text = /\.gz$/.test(f) ? (/\/fantasy\//.test(f) ? gunzipSync(readFileSync(p)).toString('utf8') : '') : readFileSync(p, 'utf8'); } catch { continue; }
    if (SHAPES.some(re => re.test(text))) hits.push(f);
  }
  assert.deepEqual(hits, [], 'token-shaped strings found');
});

/* ---------- from snapshots to credits ---------- */
async function snapshots() {
  const root = temp();
  await pull(opts(root, fakeBackend()));
  return root;
}

test('credits after each round: the next round\'s credits, the price today for the latest round, nothing before a player appears', async () => {
  const root = await snapshots(), f = readFantasy(root);
  assert.equal(f.lastRound, 4);
  const after = fid => creditsAfter(fid, f);
  assert.deepEqual(after(1), [10.5, 10.2, 10.2, 10.6], 'a price change between rounds shows in the series');
  assert.deepEqual(after(2), [8, 8, 8, 7.8]);
  assert.deepEqual(after(3), [null, 6.4, 6.4, 6.2], 'a round before the player existed has no credits (gap, not filled)');
});

test('names are matched exactly by team + first initial + family name; the rest is listed, not guessed', async () => {
  const f = readFantasy(await snapshots());
  const ours = [
    { id: 'P1', rawName: 'ALPHA, ANN', team: 'AA' }, { id: 'P2', rawName: 'BETA, BOB', team: 'BB' }, { id: 'P3', rawName: 'GAMMA, CARL', team: 'AA' },
    { id: 'P9', rawName: 'ALPHE, ALAN', team: 'AA' },       // close to "A. Alpha" but not the same name
    { id: 'P8', rawName: 'QUUX, QUINN', team: 'BB' },       // nobody in Fantasy
  ];
  const m = matchPlayers(f.players, ours, { teamCodes: { AAA: 'AA', BBB: 'BB' } });
  assert.deepEqual([...m.pairs.entries()].sort(), [['P1', 1], ['P2', 2], ['P3', 3]]);
  assert.deepEqual(m.unmatchedFantasy.map(p => p.name), ['Z. Zed'], 'the coach is not a player; Zed has no match');
  assert.deepEqual(m.unmatchedOurs.map(o => o.id).sort(), ['P8', 'P9']);
  const wrongTeam = matchPlayers(f.players, [{ id: 'P1', rawName: 'ALPHA, ANN', team: 'BB' }], { teamCodes: { AAA: 'AA', BBB: 'BB' } });
  assert.equal(wrongTeam.pairs.size, 0, 'a different team is not a match');
  const twins = matchPlayers(f.players, [{ id: 'P1', rawName: 'ALPHA, ANN', team: 'AA' }, { id: 'P7', rawName: 'ALPHA, ARTHUR', team: 'AA' }], { teamCodes: { AAA: 'AA', BBB: 'BB' } });
  assert.equal(twins.pairs.size, 0, 'two of ours with the same key: no guess');
  assert.equal(matchPlayers([{ fid: 1, name: 'A. Alpha', team: 'XXX', position: 'Guard' }], ours, { teamCodes: {} }).pairs.size, 0, 'an unknown team code matches nobody');
});

/* ---------- cr, crSeries, value and valueSeries per window ---------- */
// AA (Alpha, Gamma) and BB (Beta, Quux) play one game per round, rounds 1..4. PIR of a row = m1 (m1 = a1: no misses).
const game = (g, round, team, opp, home) => ({ season: 'E', game: g, round, date_utc: `2026-10-0${g}T18:00:00Z`, team, opp, home });
const TEAMS = [1, 2, 3, 4].flatMap(g => [game(g, g, 'AA', 'BB', 1), game(g, g, 'BB', 'AA', 0)]);
const pr = (g, team, id, name, pir, played = 1) => ({ season: 'E', game: g, round: g, date_utc: `2026-10-0${g}T18:00:00Z`, team, player_id: id, player: name, played, m1: pir, a1: pir, m2: 0, a2: 0, m3: 0, a3: 0, oreb: 0, dreb: 0, ast: 0, stl: 0, blk: 0, fd: 0, pf: 0, tov: 0, blk_against: 0 });
const PLAYERS = [
  ...[10, 20, 10, 20].map((v, i) => pr(i + 1, 'AA', 'P1', 'ALPHA, ANN', v)),
  ...[0, 12, 6, 12].map((v, i) => pr(i + 1, 'AA', 'P3', 'GAMMA, CARL', v, i === 0 ? 0 : 1)),
  ...[8, 8, 8, 8].map((v, i) => pr(i + 1, 'BB', 'P2', 'BETA, BOB', v)),
  ...[3, 3, 3, 3].map((v, i) => pr(i + 1, 'BB', 'P8', 'QUUX, QUINN', v)),
];
const DIM = [['P1', 'F'], ['P2', 'F'], ['P3', 'C'], ['P8', 'G']].map(([player_id, position]) => ({ player_id, position }));
const OURS = [{ id: 'P1', rawName: 'ALPHA, ANN', team: 'AA' }, { id: 'P2', rawName: 'BETA, BOB', team: 'BB' }, { id: 'P3', rawName: 'GAMMA, CARL', team: 'AA' }, { id: 'P8', rawName: 'QUUX, QUINN', team: 'BB' }];
const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-4, `${msg}: ${a} vs ${b}`);

async function built() {
  const root = await snapshots();
  const fantasy = fantasyForBuild({ dir: root, ours: OURS, fixes: {}, teamCodes: { AAA: 'AA', BBB: 'BB' } });
  return { fantasy, views: buildViews({ players: PLAYERS, teams: TEAMS, dim: DIM, fantasy }) };
}

test('cr is the latest credits; crSeries one point per round; value = PIR per game of the window / cr, for Season, L10, L5 and L3', async () => {
  const { views } = await built();
  const info = (w, id) => { const v = views[w].players, row = v.rows[id]; return { fx: row.fx, value: row.v[v.metrics.indexOf('value')] }; };
  // Alpha: PIR 10, 20, 10, 20 (team games 1-4); cr 10.6
  const season = info('season', 'P1');
  assert.equal(season.fx.cr, 10.6);
  assert.deepEqual(season.fx.crSeries, [10.5, 10.2, 10.2, 10.6]);
  near(season.value, 15 / 10.6, 'Season value');
  near(info('l10', 'P1').value, 15 / 10.6, 'L10 value (only 4 games exist)');
  near(info('l5', 'P1').value, 15 / 10.6, 'L5 value');
  near(info('l3', 'P1').value, (50 / 3) / 10.6, 'L3 value uses the L3 PIR average (games 2-4)');
  // Gamma: played games 2-4 (12, 6, 12), cr 6.2, no credits before round 2
  near(info('season', 'P3').value, 10 / 6.2, 'Gamma Season value counts only games played');
  assert.deepEqual(info('season', 'P3').fx.crSeries, [null, 6.4, 6.4, 6.2]);
  assert.equal(views.season.players.fxRounds, 4);
});

test('valueSeries: the same rule at each round (window as it stood then / credits then); a round with no credits is a gap', async () => {
  const { views } = await built();
  const vs = (w, id) => views[w].players.rows[id].fx.valueSeries;
  const a = [10 / 10.5, 15 / 10.2, (40 / 3) / 10.2, 15 / 10.6];             // Season: PIR average after rounds 1..4 over the credits after that round
  vs('season', 'P1').forEach((x, i) => near(x, a[i], `Alpha Season round ${i + 1}`));
  const l3 = [10 / 10.5, 15 / 10.2, (40 / 3) / 10.2, (50 / 3) / 10.6];      // L3: the team's last 3 games up to that round
  vs('l3', 'P1').forEach((x, i) => near(x, l3[i], `Alpha L3 round ${i + 1}`));
  assert.ok(Math.abs(vs('l3', 'P1')[1] - vs('season', 'P1')[1]) < 1e-9, 'with fewer than 3 games both windows agree');
  assert.ok(vs('l3', 'P1')[3] !== vs('season', 'P1')[3], 'at round 4 the windows differ');
  const g = vs('season', 'P3');
  assert.equal(g[0], null, 'no credits known at round 1: no point');
  near(g[1], 12 / 6.4, 'Gamma round 2'); near(g[2], 9 / 6.4, 'Gamma round 3'); near(g[3], 10 / 6.2, 'Gamma round 4');
  for (const w of ['season', 'l10', 'l5', 'l3']) for (const id of ['P1', 'P2', 'P3']) {
    const row = views[w].players.rows[id], v = row.v[views[w].players.metrics.indexOf('value')];
    near(row.fx.valueSeries.at(-1), v, `${w} ${id}: the last point is the value shown`);
  }
});

test('players without a Fantasy match have no cr, no value, no fx; their other metrics are untouched', async () => {
  const { views, fantasy } = await built();
  const q = views.season.players.rows.P8, ix = views.season.players.metrics;
  assert.equal(q.fx, undefined);
  assert.equal(q.v[ix.indexOf('value')], null);
  assert.equal(q.v[ix.indexOf('pir')], 3);
  assert.ok(!fantasy.byPlayer.has('P8'));
  assert.ok(fantasy.report.some(l => /Z\. Zed/.test(l)) && fantasy.report.some(l => /Quinn Quux/.test(l)), 'both unmatched sides are printed');
  const without = buildViews({ players: PLAYERS, teams: TEAMS, dim: DIM });
  assert.equal(without.season.players.rows.P1.fx, undefined, 'no snapshots: no credits, nothing invented');
  assert.equal(without.season.players.rows.P1.v[ix.indexOf('value')], null);
});

/* ---------- the loader ---------- */
test('fantasyInfo(playerId, window): {cr, crSeries, value, valueSeries} of that window, null when the player has no entry or the window is not loaded', async () => {
  const { views } = await built();
  const manifest = { version: 'abcdef1234' }, base = 'http://x/data/';
  const D = create({ base, fetch: async u => {
    const path = u.slice(base.length).split('?')[0];
    const body = path === 'manifest.json' ? manifest : views[path.replace(/^players-|\.json$/g, '')]?.players;
    return { ok: !!body, status: body ? 200 : 404, json: async () => body };
  } });
  assert.equal(D.fantasyInfo('P1', 'l3'), null, 'nothing loaded yet');
  await D.view('players', 'season'); await D.view('players', 'l3');
  const l3 = D.fantasyInfo('P1', 'l3'), season = D.fantasyInfo('P1');
  assert.deepEqual(Object.keys(l3).sort(), ['cr', 'crSeries', 'value', 'valueSeries']);
  assert.equal(l3.cr, 10.6);
  near(l3.value, (50 / 3) / 10.6, 'L3 value');
  near(season.value, 15 / 10.6, 'the default window is Season');
  assert.equal(season.crSeries.length, 4);
  assert.equal(D.fantasyInfo('P8', 'l3'), null, 'no Fantasy match');
  assert.equal(D.fantasyInfo('nobody', 'season'), null);
  assert.equal(D.fantasyInfo('P1', 'l5'), null, 'the l5 window has not been loaded');
  assert.equal(D.fantasyInfo('P3', 'l3').crSeries[0], null);
});

test('the real build: every Fantasy entry has cr, one credit per round and a value that matches its last series point', () => {
  const dir = join(repo, 'site', 'data');
  if (!existsSync(join(dir, 'players-season.json'))) return;
  const v = JSON.parse(readFileSync(join(dir, 'players-season.json'), 'utf8')), ix = v.metrics.indexOf('value');
  assert.ok(ix >= 0, 'metric value exists');
  const withFx = Object.entries(v.rows).filter(([, r]) => r.fx);
  if (!existsSync(join(repo, 'data', 'raw', 'E2026', 'fantasy'))) { assert.equal(withFx.length, 0); return; }
  assert.ok(withFx.length > 100, `${withFx.length} players with credits`);
  for (const [id, r] of withFx) {
    assert.ok(Number.isFinite(r.fx.cr) && r.fx.cr > 0, id);
    assert.equal(r.fx.crSeries.length, v.fxRounds, id);
    assert.equal(r.fx.valueSeries.length, v.fxRounds, id);
    const val = Array.isArray(r.v[ix]) ? r.v[ix][0] : r.v[ix];
    if (val !== null && r.fx.crSeries.at(-1) === r.fx.cr) assert.ok(Math.abs(r.fx.valueSeries.at(-1) - val) < 1e-3, id);
  }
});
