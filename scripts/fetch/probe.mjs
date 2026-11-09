// Connectivity/consistency probe: re-fetch N already-stored games into a temp folder and compare
// byte-for-byte (decompressed) with data/raw. Writes nothing under data/. Exit 1 on any mismatch/failure.
// Usage: node scripts/fetch/probe.mjs [--season E2026] [--count 5] [--out <dir>]
import { readdirSync, readFileSync, mkdirSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchSchedule, get, ENDPOINTS } from './api.mjs';

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : d; };
const season = arg('season', 'E2026'), count = Number(arg('count', 5));
const out = arg('out', join(process.env.RUNNER_TEMP || tmpdir(), 'picknedge-probe'));
const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'data', 'raw', season);

const stored = readdirSync(root).filter(d => /^\d+$/.test(d)).map(Number).sort((a, b) => a - b);
if (stored.length < count) { console.error(`Only ${stored.length} stored games, need ${count}`); process.exit(1); }
const step = Math.floor(stored.length / count);
const codes = Array.from({ length: count }, (_, i) => stored[i * step]);   // spread across the season
const read = (code, name) => gunzipSync(readFileSync(join(root, String(code), `${name}.json.gz`))).toString('utf8');

mkdirSync(out, { recursive: true });
let bad = 0;
const report = (code, name, ok, note = '') => { if (!ok) bad++; console.log(`${ok ? 'MATCH   ' : 'MISMATCH'} game ${code} ${name} ${note}`); };

// The schedule entry also carries volatile/decorative data (image URLs, broadcasters...), so only the
// fields we rely on must match; any other difference is listed as a NOTE and does not fail the probe.
const flat = (o, p = '', acc = {}) => {
  if (o && typeof o === 'object') for (const k of Object.keys(o)) flat(o[k], p ? `${p}.${k}` : k, acc);
  else acc[p] = o;
  return acc;
};
const RELIED_ON = ['round.round', 'date', 'status', 'home.code', 'home.name', 'home.score', 'away.code', 'away.name', 'away.score'];
function compareGame(code, fresh, stored) {
  const f = flat(fresh), s = flat(stored);
  const wrong = RELIED_ON.filter(k => f[k] !== s[k]);
  report(code, 'game', !wrong.length, wrong.length ? `fields differ: ${wrong.map(k => `${k} ${JSON.stringify(s[k])} -> ${JSON.stringify(f[k])}`).join('; ')}` : `(${RELIED_ON.length} relied-on fields)`);
  const other = [...new Set([...Object.keys(f), ...Object.keys(s)])].filter(k => !RELIED_ON.includes(k) && f[k] !== s[k]);
  for (const k of other) console.log(`NOTE     game ${code} game: ${k} | stored ${JSON.stringify(s[k])?.slice(0, 300)} | fresh ${JSON.stringify(f[k])?.slice(0, 300)}`);
}

const schedule = await fetchSchedule(season);
for (const code of codes) {
  const game = schedule.find(g => g.code === code);
  const fresh = { game: game && JSON.stringify(game) };
  for (const [name, ep] of Object.entries(ENDPOINTS)) {
    try { fresh[name] = (await get(ep.url(season, code))).text; }
    catch (e) { fresh[name] = null; console.log(`FAILED   game ${code} ${name}: ${e.message}`); }
  }
  for (const [name, text] of Object.entries(fresh)) {
    if (text == null) { bad++; continue; }
    await writeFile(join(out, `${code}-${name}.json`), text);
    if (name === 'game') { compareGame(code, JSON.parse(text), JSON.parse(read(code, name))); continue; }
    const same = text === read(code, name);
    report(code, name, same, same ? `(${text.length} bytes)` : `(fresh ${text.length} vs stored ${read(code, name).length} bytes)`);
  }
}
console.log(bad ? `\nPROBE FAILED: ${bad} problem(s)` : `\nPROBE OK: ${codes.length} games (${codes.join(', ')}) identical to data/raw`);
process.exit(bad ? 1 : 0);
