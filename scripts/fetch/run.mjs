// Incremental fetch of finished EuroLeague games into data/raw/<season>/<game>/.
// Usage: node scripts/fetch/run.mjs [--season E2026] [--limit N] [--concurrency 2]
// A game directory exists only if every file was fetched, validated and written
// (built in a temp dir, then renamed), so a failed call never leaves a half game behind.
import { mkdir, rename, rm, writeFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchSchedule, get, ENDPOINTS, ShapeError, checkScore } from './api.mjs';
import { fetchRoster } from './roster.mjs';

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : d; };
const season = arg('season', 'E2026');
const limit = Number(arg('limit', Infinity));
const concurrency = Number(arg('concurrency', 2));
const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'data', 'raw', season);

async function fetchGame(game) {
  const final = join(root, String(game.code));
  const tmp = join(root, `.tmp-${game.code}`);
  await rm(tmp, { recursive: true, force: true });
  await mkdir(tmp, { recursive: true });
  try {
    const bodies = { game: JSON.stringify(game) };   // schedule entry: round, date, teams, score
    const parsed = {};
    for (const [name, ep] of Object.entries(ENDPOINTS)) {
      const { text, json } = await get(ep.url(season, game.code));
      ep.check(json, `${name} game ${game.code}`);
      bodies[name] = text; parsed[name] = json;      // response text kept exactly as received
    }
    checkScore(game, parsed.boxscore);
    for (const [name, text] of Object.entries(bodies)) await writeFile(join(tmp, `${name}.json.gz`), gzipSync(text, { level: 9 }));
    await rename(tmp, final);
  } catch (e) {
    await rm(tmp, { recursive: true, force: true });
    throw e;
  }
}

async function main() {
  await mkdir(root, { recursive: true });
  for (const d of await readdir(root)) if (d.startsWith('.tmp-')) await rm(join(root, d), { recursive: true, force: true });

  const schedule = await fetchSchedule(season);
  const finished = schedule.filter(g => g.status === 'result').sort((a, b) => a.code - b.code);
  const todo = finished.filter(g => !existsSync(join(root, String(g.code)))).slice(0, limit);
  console.log(`${season}: ${schedule.length} scheduled, ${finished.length} finished, ${todo.length} to fetch`);

  const queue = [...todo], failed = [];
  let done = 0, shapeError = null;
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (queue.length && !shapeError) {
      const g = queue.shift();
      try { await fetchGame(g); console.log(`ok  game ${g.code} (${++done}/${todo.length})`); }
      catch (e) {
        if (e instanceof ShapeError) { shapeError = e; return; }
        failed.push(g.code); console.error(`ERR game ${g.code}: ${e.message}`);
      }
    }
  }));
  if (shapeError) {
    console.error(`\nFATAL: ${shapeError.message}\nStopping: the API response changed. Fix the validators/parser before fetching more.`);
    process.exit(2);
  }
  if (failed.length) { console.error(`\n${failed.length} game(s) failed (retried next run): ${failed.join(', ')}`); process.exit(1); }
  console.log(`done: ${done} fetched`);
  const r = await fetchRoster(season, root);   // once per run, after the games are safely stored
  console.log(`roster: ${r.clubs} clubs, ${r.changed ? 'updated' : 'unchanged'}`);
}
main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
