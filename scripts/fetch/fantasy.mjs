// Pull of the official EuroLeague Fantasy backend (fantaking-api.dunkest.com, EuroLeague = competition 49) into data/raw/<season>/fantasy/.
// Usage: FANTAKING_TOKEN=... node scripts/fetch/fantasy.mjs [--season E2026]
//
// The API is private and undocumented. Routes used (found in the Fantasy web app's network tab, checked by hand):
//   players/table  GET /api/v1/competitions/49/stats/players/table?...&page=N&per_page=100   every player with his CURRENT credits ("quotation", "plus" = total change)
//                  with `matchdays=<id>` the same table for one round: "quotation" = credits BEFORE that round, "plus" = the change after it
//                  (next credits = quotation + plus). That is the only price history the backend has: there is no per-player history route
//                  (players/<id>/profile has only the current credits; players/<id>/trend has fantasy points per round, no credits).
//   trend          GET /api/v1/players/<id>/trend?league=10   gives the matchday id <-> round number pairs (id = number + constant)
//
// What is stored: every response exactly as received (gzipped, no timestamp inside) in data/raw/<season>/fantasy/<kind>/<key>/<UTC stamp>.json.gz,
// only when it differs from the latest stored one. A stored snapshot is never overwritten or deleted. One snapshot = all pages of one table,
// written as {"pages":[<page 1 body>,<page 2 body>,...]} with every body verbatim.
// The token (FANTAKING_TOKEN) is read from the environment only; it is never printed, logged or stored.
//
// Exit codes: 0 = done, or no/expired token (one warning, nothing written: the games update must never fail because of this step);
//             2 = the API shape changed (loud, nothing more is written); 1 = other failure (retried on the next run).
import { mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync, appendFileSync, existsSync } from 'node:fs';
import { gzipSync, gunzipSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const HOST = 'https://fantaking-api.dunkest.com';
export const COMPETITION = 49;          // EuroLeague
export const LEAGUE = 10;               // the league value the web app sends; league=1 returns empty profiles, other values are rejected
export const PER_PAGE = 100;            // the API refuses larger pages (422)
const GAP_MS = 2000;                    // the API answers 429 after a burst of requests

export class ShapeError extends Error {}
export class AuthError extends Error {}

const sleep = ms => new Promise(r => setTimeout(r, ms));
const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
const need = (cond, where, what) => { if (!cond) throw new ShapeError(`Fantasy API shape changed at ${where}: ${what}`); };

/** The bare secret: the environment value may or may not already start with "Bearer ". */
export const bareToken = t => String(t || '').trim().replace(/^bearer\s+/i, '');
/** Replace every trace of the token (bare or with the Bearer prefix) in a text. */
export const mask = (text, token) => {
  const bare = bareToken(token);
  return bare.length >= 8 ? String(text).split(bare).join('***') : String(text);
};

export const tableUrl = (page, matchday = '') =>
  `${HOST}/api/v1/competitions/${COMPETITION}/stats/players/table?stats_type=avg&positions&matchdays=${matchday}&search&teams&quotations=0%2C30&page=${page}&per_page=${PER_PAGE}&sort_by=fpt&sort_order=desc&active_players=true`;
export const trendUrl = id => `${HOST}/api/v1/players/${id}/trend?league=${LEAGUE}&lang=en`;

/* ---------- shape checks (loud) ---------- */
const NEEDED_COLUMNS = ['name', 'position', 'team', 'quotation', 'plus'];
export function checkTablePage(j, where) {
  need(isObj(j) && isObj(j.data) && isObj(j.meta), where, 'data/meta');
  need(Array.isArray(j.data.columns) && Array.isArray(j.data.players), where, 'columns/players');
  for (const c of NEEDED_COLUMNS) need(j.data.columns.includes(c), where, `column ${c}`);
  for (const k of ['current_page', 'last_page', 'total']) need(Number.isInteger(j.meta[k]), where, `meta.${k}`);
  const iq = j.data.columns.indexOf('quotation'), ip = j.data.columns.indexOf('plus');
  for (const p of j.data.players) {
    need(isObj(p) && Number.isInteger(p.id) && Array.isArray(p.row) && p.row.length === j.data.columns.length, where, 'player id/row');
    need(Number.isFinite(parseFloat(p.row[iq])), where, `player ${p.id}: quotation "${p.row[iq]}" is not a number`);
    need(/^[+-]?\d+(\.\d+)?$/.test(String(p.row[ip])), where, `player ${p.id}: plus "${p.row[ip]}" is not a number`);
  }
}
export function checkTrend(j, where) {
  need(isObj(j) && isObj(j.data) && Array.isArray(j.data.trend), where, 'data.trend');
  for (const t of j.data.trend) need(isObj(t.matchday) && Number.isInteger(t.matchday.id) && Number.isInteger(t.matchday.number), where, 'matchday id/number');
}

/* ---------- store ---------- */
const stampOf = d => d.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
export const snapshotDir = (root, kind, key) => join(root, kind, String(key));
export const snapshotFiles = dir => (existsSync(dir) ? readdirSync(dir).filter(f => /^\d{8}T\d{6}Z\.json\.gz$/.test(f)).sort() : []);
export const readSnapshot = file => JSON.parse(gunzipSync(readFileSync(file)).toString('utf8'));
export const latestFile = dir => { const f = snapshotFiles(dir); return f.length ? join(dir, f.at(-1)) : null; };

/** Write a new snapshot only when its text differs from the latest stored one. Returns 'new' | 'unchanged'. Never overwrites a file. */
export function store(root, kind, key, text, now = new Date()) {
  const dir = snapshotDir(root, kind, key), last = latestFile(dir);
  if (last && gunzipSync(readFileSync(last)).toString('utf8') === text) return 'unchanged';
  mkdirSync(dir, { recursive: true });
  let at = new Date(now), file = join(dir, stampOf(at) + '.json.gz');
  while (existsSync(file)) { at = new Date(at.getTime() + 1000); file = join(dir, stampOf(at) + '.json.gz'); }   // never overwrite
  writeFileSync(file + '.tmp', gzipSync(text, { level: 9 }));
  renameSync(file + '.tmp', file);
  return 'new';
}
export const snapshotText = bodies => `{"pages":[${bodies.join(',')}]}`;

/* ---------- http ---------- */
function makeClient({ token, fetch: fetchFn = (u, o) => fetch(u, o), sleep: wait = sleep, gapMs = GAP_MS, retries = 6, log = console.log }) {
  const auth = 'Bearer ' + bareToken(token);
  let nextSlot = 0;
  const throttle = async () => { const now = Date.now(), at = Math.max(now, nextSlot); nextSlot = at + gapMs; if (at > now) await wait(at - now); };
  return async function get(url) {
    let last, backoff = 0;
    for (let attempt = 0; attempt <= retries; attempt++) {
      if (attempt) await wait(Math.max(backoff, Math.min(4000 * 2 ** (attempt - 1), 60000)));
      await throttle();
      try {
        const res = await fetchFn(url, { signal: AbortSignal.timeout(30000), headers: { accept: 'application/json', authorization: auth } });
        if (res.status === 401 || res.status === 403) throw new AuthError(`HTTP ${res.status}`);
        if (res.status === 429 || res.status >= 500) {
          backoff = (Number(res.headers?.get?.('retry-after')) || 0) * 1000;
          if (res.status === 429) nextSlot = Math.max(nextSlot, Date.now() + Math.max(backoff, 15000));
          last = new Error(`HTTP ${res.status}`); continue;
        }
        const text = await res.text();
        if (!res.ok) throw new ShapeError(`HTTP ${res.status} ${mask(url, token)} ${mask(text, token).slice(0, 120)}`);
        try { return { text, json: JSON.parse(text) }; }
        catch { throw new ShapeError(`Not JSON: ${mask(url, token)}`); }
      } catch (e) {
        if (e instanceof ShapeError || e instanceof AuthError) throw e;
        last = e;
      }
    }
    throw new Error(`Failed after ${retries + 1} attempts: ${mask(last?.message, token)}`);
  };
}

/** All pages of one table. Returns { bodies (verbatim texts), players: [{id,row}], columns }. */
async function fetchTable(get, matchday, where) {
  const bodies = [], players = [], seen = new Set();
  let columns = null, last = 1;
  for (let page = 1; page <= last; page++) {
    const { text, json } = await get(tableUrl(page, matchday));
    checkTablePage(json, `${where} page ${page}`);
    need(json.meta.current_page === page, where, `asked page ${page}, got ${json.meta.current_page}`);
    if (page === 1) { columns = json.data.columns; last = json.meta.last_page; need(last <= 50, where, `${last} pages`); }
    need(JSON.stringify(json.data.columns) === JSON.stringify(columns), where, 'columns differ between pages');
    for (const p of json.data.players) { need(!seen.has(p.id), where, `player ${p.id} appears twice (the pages moved while reading)`); seen.add(p.id); players.push(p); }
    bodies.push(text);
  }
  const total = bodies.length ? JSON.parse(bodies[0]).meta.total : 0;
  need(players.length === total, where, `${players.length} rows read, meta.total says ${total}`);
  return { bodies, players, columns };
}

/** Run the whole pull. Returns { status: 'ok' | 'no-token' | 'auth', written, unchanged, matchdays }. Throws ShapeError / Error on the other failures. */
export async function pull({ root, token, fetch: fetchFn, sleep: wait, gapMs, now = new Date(), log = console.log, warn = console.warn }) {
  if (!bareToken(token)) {
    warn('WARNING: FANTAKING_TOKEN is not set: the Fantasy credits are not pulled (nothing written). Add the secret FANTAKING_TOKEN to the repository to enable it.');
    return { status: 'no-token', written: 0, unchanged: 0, matchdays: 0 };
  }
  const get = makeClient({ token, fetch: fetchFn, sleep: wait, gapMs, log });
  let written = 0, unchanged = 0, matchdays = 0;
  const save = (kind, key, text) => { const r = store(root, kind, key, text, now); r === 'new' ? written++ : unchanged++; log(`  ${kind}/${key}: ${r}`); };
  try {
    // 1. every player with his current credits
    const current = await fetchTable(get, '', 'players table');
    const bad = current.players.find(p => String(p.row[current.columns.indexOf('quotation')]).includes('NaN'));
    need(!bad, 'players table', 'bad quotation');
    save('players', 'all', snapshotText(current.bodies));

    // 2. matchday id <-> round number, from the trend of the three players with the most points (any player's trend lists the rounds he played)
    const iName = current.columns.indexOf('position'), iFpt = current.columns.indexOf('fpt');
    const top = current.players.filter(p => p.row[iName] !== 'Head Coach').sort((a, b) => parseFloat(b.row[iFpt]) - parseFloat(a.row[iFpt])).slice(0, 3);
    need(top.length > 0, 'players table', 'no players');
    const idOf = new Map();                                    // round number -> matchday id
    for (const p of top) {
      const { text, json } = await get(trendUrl(p.id));
      checkTrend(json, `trend ${p.id}`);
      save('trend', p.id, text);
      for (const t of json.data.trend) {
        const { id, number } = t.matchday;
        need(!idOf.has(number) || idOf.get(number) === id, `trend ${p.id}`, `round ${number} has two matchday ids`);
        idOf.set(number, id);
      }
    }
    const rounds = [...idOf.keys()].sort((a, b) => a - b);
    need(rounds.length > 0 && rounds[0] === 1 && rounds.at(-1) === rounds.length, 'trend', `rounds ${rounds.join(',')} are not 1..n`);
    const offsets = new Set(rounds.map(n => idOf.get(n) - n));
    need(offsets.size === 1, 'trend', 'matchday ids are not number + constant');

    // 3. the table of every round: credits before the round and the change after it. Past rounds are fetched once; the latest is refreshed.
    for (const n of rounds) {
      const id = idOf.get(n), have = latestFile(snapshotDir(root, 'matchday', id));
      if (have && n < rounds.at(-1)) { matchdays++; continue; }
      const t = await fetchTable(get, id, `matchday ${n} (id ${id}) table`);
      save('matchday', id, snapshotText(t.bodies));
      matchdays++;
    }
    return { status: 'ok', written, unchanged, matchdays };
  } catch (e) {
    if (e instanceof AuthError) {
      warn(`WARNING: the Fantasy backend rejected FANTAKING_TOKEN (${e.message}): it is missing or expired. Nothing was pulled; renew the secret FANTAKING_TOKEN.`);
      return { status: 'auth', written, unchanged, matchdays };
    }
    throw e;
  }
}

/** The command line, returning the exit code (so a test can run it with a fake fetch). */
export async function run({ argv = process.argv, env = process.env, fetch: fetchFn, sleep: wait, gapMs, root, log = console.log, warn = console.warn, error = console.error } = {}) {
  const arg = (n, d) => { const i = argv.indexOf('--' + n); return i > 0 ? argv[i + 1] : d; };
  const token = env.FANTAKING_TOKEN;
  root ??= join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'data', 'raw', arg('season', 'E2026'), 'fantasy');
  try {
    const r = await pull({ root, token, fetch: fetchFn, sleep: wait, gapMs, log, warn });
    if (r.status === 'ok') log(`fantasy: ${r.written} new snapshot(s), ${r.unchanged} unchanged, ${r.matchdays} round(s) covered`);
    // In GitHub Actions: say how the pull ended (ok | auth | no-token) so a later step can raise one clear annotation (scripts/build/fantasy-status.mjs).
    if (env.GITHUB_OUTPUT) { try { appendFileSync(env.GITHUB_OUTPUT, `credits_pull=${r.status}\n`); } catch { /* the output is a convenience */ } }
    return 0;                                    // also for a missing / expired token: that step never fails the games update
  } catch (e) {
    const msg = mask(e.message, token);
    if (e instanceof ShapeError) { error(`
FATAL: ${msg}
Stopping: the Fantasy API response changed. Fix the checks/parser before pulling more.`); return 2; }
    error(`ERR fantasy: ${msg}`); return 1;
  }
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) process.exit(await run());
