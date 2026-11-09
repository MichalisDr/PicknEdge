// Prints one line per fetched game (teams, score, play-by-play events, file sizes) for manual checking.
// Usage: node scripts/fetch/summary.mjs [--season E2026] [--max 20]
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { countEvents } from './api.mjs';

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : d; };
const season = arg('season', 'E2026'), max = Number(arg('max', 20));
const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'data', 'raw', season);
const read = (dir, f) => JSON.parse(gunzipSync(readFileSync(join(dir, f + '.json.gz'))));

let total = 0, games = 0;
for (const code of readdirSync(root).filter(d => /^\d+$/.test(d)).sort((a, b) => a - b)) {
  const dir = join(root, code);
  const sizes = readdirSync(dir).map(f => [f.replace('.json.gz', ''), statSync(join(dir, f)).size]);
  const bytes = sizes.reduce((n, [, s]) => n + s, 0);
  total += bytes; games++;
  if (games > max) continue;
  const g = read(dir, 'game'), pbp = read(dir, 'playbyplay'), shots = read(dir, 'shots');
  console.log(`game ${code} | round ${g.round.round} | ${g.date.slice(0, 10)} | ${g.home.name} ${g.home.score}-${g.away.score} ${g.away.name}` +
    ` | pbp events ${countEvents(pbp)} | shots ${shots.Rows.length} | ` + sizes.map(([n, s]) => `${n} ${(s / 1024).toFixed(1)}KB`).join(', ') + ` | total ${(bytes / 1024).toFixed(1)}KB`);
}
console.log(`${games} games, ${(total / 1048576).toFixed(2)} MB (avg ${(total / Math.max(games, 1) / 1024).toFixed(1)} KB/game)`);
