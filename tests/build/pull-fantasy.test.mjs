// The local Fantasy pull (scripts/local/pull-fantasy.mjs): fake backend, fake git / gh, temp folder. No network, no real git, nothing pushed.
// Run: node --test tests/build/pull-fantasy.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, readFileSync, existsSync } from 'node:fs';
import { PassThrough } from 'node:stream';
import { gunzipSync } from 'node:zlib';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { main, askHidden } from '../../scripts/local/pull-fantasy.mjs';

const SECRET = 'AbCdEfGhIjKlMnOpQrStUvWxYz0123456789AbCdEfGhIjKl';       // an invented token body (built from pieces so no token-shaped text sits in this file)
const BARE = '1234567' + '|' + SECRET;
const TOKEN = 'Bearer ' + BARE;
const COLUMNS = ['rank', 'name', 'position', 'team', 'fpt', 'quotation', 'plus'];
const PLAYERS = [{ id: 1, name: 'A. Alpha', q: [10, 10.5], cur: 10.6 }, { id: 2, name: 'B. Beta', q: [8, 8], cur: 7.8 }];

/** A tiny backend: 2 rounds (matchday ids 100, 101), one page per table. */
function backend({ status = 200, bump = 0 } = {}) {
  const calls = [];
  const fn = async (url, opts) => {
    calls.push({ url, opts });
    if (status !== 200) return { status, ok: false, headers: { get: () => null }, text: async () => '{"code":"UNAUTHENTICATED"}' };
    const u = new URL(url), md = u.searchParams.get('matchdays'), round = md ? Number(md) - 100 : null;
    const body = j => ({ status: 200, ok: true, headers: { get: () => null }, text: async () => JSON.stringify(j) });
    if (u.pathname.includes('/trend')) return body({ data: { trend: [1, 0].map(r => ({ fantasy_pts: 10, matchday: { id: 100 + r, number: r + 1 } })) } });
    const rows = PLAYERS.map((p, i) => ({ id: p.id, row: [String(i + 1), p.name, 'Guard', 'AAA', '20.0', String(round === null ? p.cur + bump : p.q[round]), '+0.0'] }));
    return body({ data: { columns: COLUMNS, players: rows }, meta: { current_page: 1, per_page: 100, total: rows.length, last_page: 1 } });
  };
  fn.calls = calls;
  return fn;
}

/** A fake git / gh. `staged` = what `git diff --cached --name-only` answers (default: every file under the Fantasy folder, as if all were new). */
function fakeExec(root, { branch = 'main', dirty = '', staged = null, gh = true, pushOk = true } = {}) {
  const calls = [];
  const exec = (cmd, args) => {
    calls.push([cmd, ...args]);
    const key = `${cmd} ${args[0]} ${args[1] || ''}`.trim();
    if (cmd === 'gh') return { status: gh ? 0 : null, stdout: '' };
    if (key.startsWith('git rev-parse')) return { status: 0, stdout: branch + '\n' };
    if (key.startsWith('git status')) return { status: 0, stdout: dirty };
    if (key.startsWith('git diff --cached')) {
      const base = join(root, 'data', 'raw', 'E2026', 'fantasy');
      const all = existsSync(base) ? readdirSync(base, { recursive: true }).filter(f => f.endsWith('.json.gz')).map(f => 'data/raw/E2026/fantasy/' + f.replace(/\\/g, '/')) : [];
      return { status: 0, stdout: (staged ?? all).join('\n') };
    }
    if (key.startsWith('git push')) return { status: pushOk ? 0 : 1, stdout: '' };
    return { status: 0, stdout: '' };
  };
  exec.calls = calls;
  return exec;
}

const temp = () => mkdtempSync(join(tmpdir(), 'pull-fantasy-'));
const allFiles = root => readdirSync(root, { recursive: true }).map(f => join(root, f)).filter(f => { try { return readdirSync(f) && false; } catch { return true; } });
const textOf = f => { const b = readFileSync(f); return f.endsWith('.gz') ? gunzipSync(b).toString('utf8') : b.toString('utf8'); };
async function go(root, over = {}) {
  const lines = [], exec = over.exec || fakeExec(root, over.git), fetch = over.fetch || backend();
  const code = await main({ argv: ['node', 'x'], env: 'env' in over ? over.env : { FANTAKING_TOKEN: TOKEN }, root, exec, fetch, ask: over.ask, sleep: async () => {}, gapMs: 0, log: m => lines.push(m), error: m => lines.push(m) });
  return { code, lines, text: lines.join('\n'), exec, fetch };
}
const has = (exec, ...prefix) => exec.calls.some(c => prefix.every((p, i) => c[i] === p));

test('happy path: pulls, stages only the Fantasy folder, commits, pushes, starts the workflow; the token is nowhere in the output or the files', async () => {
  const root = temp(), r = await go(root);
  assert.equal(r.code, 0);
  assert.ok(r.fetch.calls.length > 0 && r.fetch.calls.every(c => c.opts.headers.authorization === TOKEN), 'the token reaches the API');
  const add = r.exec.calls.filter(c => c[1] === 'add');
  assert.deepEqual(add, [['git', 'add', '--', 'data/raw/E2026/fantasy']], 'only the Fantasy snapshots are added');
  assert.ok(has(r.exec, 'git', 'pull', '--rebase') && has(r.exec, 'git', 'commit', '-m', 'data: fantasy credits (local pull)') && has(r.exec, 'git', 'push', 'origin', 'main'));
  assert.ok(has(r.exec, 'gh', 'workflow', 'run', 'update-data.yml', '--ref', 'main'));
  assert.match(r.text, /Started the "Update data" workflow/);
  assert.ok(!r.text.includes(SECRET) && !r.text.includes(BARE), 'the token is not printed');
  const files = allFiles(root);
  assert.equal(files.length, 1 + 2 + 2, '1 players table + 2 trends (the 2 players) + 2 round tables');
  assert.ok(files.every(f => !textOf(f).includes(SECRET)), 'the token is in no written file');
  assert.ok(r.exec.calls.every(c => !c.join(' ').includes(SECRET)), 'the token is in no git / gh command');
});

test('a token without the "Bearer " prefix works, and a token typed at the hidden prompt is used when the environment has none', async () => {
  const root = temp(), asked = [];
  const r = await go(root, { env: {}, ask: async p => { asked.push(p); return BARE; } });
  assert.equal(r.code, 0);
  assert.equal(asked.length, 1);
  assert.ok(r.fetch.calls.every(c => c.opts.headers.authorization === TOKEN));
  assert.ok(!r.text.includes(SECRET));
  const none = await go(temp(), { env: {}, ask: async () => '' });
  assert.equal(none.code, 1);
  assert.equal(none.fetch.calls.length, 0);
});

test('an expired token (401): says so, writes nothing, exits non-zero, no add / commit / push', async () => {
  const root = temp(), r = await go(root, { fetch: backend({ status: 401 }) });
  assert.notEqual(r.code, 0);
  assert.match(r.text, /expired or wrong/);
  assert.deepEqual(allFiles(root), []);
  assert.ok(!has(r.exec, 'git', 'add') && !has(r.exec, 'git', 'commit') && !has(r.exec, 'git', 'push') && !has(r.exec, 'gh'));
  assert.ok(!r.text.includes(SECRET));
});

test('unchanged snapshots are not rewritten: the second pull has nothing new, makes no commit and exits 0', async () => {
  const root = temp();
  await go(root);
  const before = allFiles(root).sort();
  const again = await go(root);
  assert.equal(again.code, 0);
  assert.deepEqual(allFiles(root).sort(), before, 'no new file');
  assert.match(again.text, /Nothing new/);
  assert.ok(!has(again.exec, 'git', 'add') && !has(again.exec, 'git', 'commit') && !has(again.exec, 'git', 'push'));
  const moved = await go(root, { fetch: backend({ bump: 0.3 }) });
  assert.equal(moved.code, 0);
  assert.equal(allFiles(root).length, before.length + 1, 'a changed table adds one file next to the old one');
});

test('if anything outside data/raw/<season>/fantasy is staged, nothing is committed', async () => {
  const root = temp(), r = await go(root, { git: { staged: ['data/raw/E2026/fantasy/players/all/x.json.gz', 'site/data/players-season.json'] } });
  assert.notEqual(r.code, 0);
  assert.match(r.text, /unexpected files/);
  assert.ok(!has(r.exec, 'git', 'commit') && !has(r.exec, 'git', 'push'));
});

test('a dirty working tree and a branch other than main stop before anything is fetched', async () => {
  const dirty = await go(temp(), { git: { dirty: ' M site/app/main.js\n' } });
  assert.notEqual(dirty.code, 0);
  assert.match(dirty.text, /uncommitted changes/);
  assert.equal(dirty.fetch.calls.length, 0);
  assert.ok(!has(dirty.exec, 'git', 'pull'));
  const other = await go(temp(), { git: { branch: 'fantasy/x' } });
  assert.notEqual(other.code, 0);
  assert.match(other.text, /fantasy\/x/);
  assert.equal(other.fetch.calls.length, 0);
});

test('without gh the last line tells to run the workflow from the Actions tab; a failed push is reported, not hidden', async () => {
  const r = await go(temp(), { git: { gh: false } });
  assert.equal(r.code, 0);
  assert.match(r.text, /Actions tab/);
  assert.ok(!has(r.exec, 'gh', 'workflow'));
  const bad = await go(temp(), { git: { pushOk: false } });
  assert.notEqual(bad.code, 0);
  assert.match(bad.text, /push failed/);
  assert.ok(!has(bad.exec, 'gh', 'workflow'));
});

test('the hidden prompt does not echo what is typed', async () => {
  const input = new PassThrough(), output = new PassThrough(), seen = [];
  output.on('data', d => seen.push(String(d)));
  const p = askHidden('Token: ', { input, output });
  input.write('Bearer abc');
  input.write('def\n');
  assert.equal(await p, 'Bearer abcdef');
  assert.ok(!seen.join('').includes('abc'), 'nothing typed is written back');
  assert.ok(seen.join('').startsWith('Token: '));
});
