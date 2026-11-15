// Player portraits: the roster's player-level images.headshot -> site/assets/players/<playerId>.webp (300x400, alpha kept).
// Manual tool (npm run portraits), not part of the automatic data update. Usage: node scripts/build/portraits.mjs [--season E2026] [--concurrency 2]
// Every URL comes from the raw roster (data/raw/<season>/roster.json.gz), never built by hand. data/portraits.json records player id -> source URL, so a rerun
// downloads only the players that are new or whose URL changed (and any whose file is missing). The originals are not kept. `sharp` is a pipeline-only devDependency.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const WIDTH = 300, HEIGHT = 400, MAX_BYTES = 25 * 1024;

/** player id ("P" + person code, as in data/clean) -> headshot URL, for the players that have one. */
export function headshotUrls(roster) {
  const urls = {};
  for (const list of Object.values(roster.people)) for (const x of list) {
    const url = x.images?.headshot;
    if (x.type !== 'J' || !x.person?.code || typeof url !== 'string' || !/^https:\/\//.test(url)) continue;
    const id = 'P' + String(x.person.code).trim();
    if (!urls[id] || x.active) urls[id] = url;        // a player listed twice: the active club entry
  }
  return urls;
}

/** What has to be downloaded: no record for the player, a different URL, or no file. */
export const todo = (urls, record, hasFile) => Object.keys(urls).filter(id => record[id] !== urls[id] || !hasFile(id)).sort();

/** PNG -> WebP 300x400 with alpha, as small as quality allows above a floor, aiming under MAX_BYTES. */
export async function toWebp(sharp, input) {
  let out;
  for (const quality of [82, 74, 66, 58, 50]) {
    out = await sharp(input).resize(WIDTH, HEIGHT, { fit: 'cover', position: 'top' }).webp({ quality, alphaQuality: 80, effort: 5 }).toBuffer();
    if (out.length <= MAX_BYTES) break;
  }
  return out;
}

async function main() {
  const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : d; };
  const season = arg('season', 'E2026'), concurrency = Math.min(Number(arg('concurrency', 2)), 3);
  const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
  const outDir = join(repo, 'site', 'assets', 'players'), recordFile = join(repo, 'data', 'portraits.json');
  const urls = headshotUrls(JSON.parse(gunzipSync(readFileSync(join(repo, 'data', 'raw', season, 'roster.json.gz')))));
  const record = existsSync(recordFile) ? JSON.parse(readFileSync(recordFile, 'utf8')) : {};
  const file = id => join(outDir, id + '.webp');
  const need = todo(urls, record, id => existsSync(file(id)));
  console.log(`portraits: ${Object.keys(urls).length} players with a headshot, ${need.length} to download`);
  if (!need.length) return;
  const sharp = (await import('sharp')).default;
  mkdirSync(outDir, { recursive: true });
  const save = () => writeFileSync(recordFile, JSON.stringify(Object.fromEntries(Object.entries(record).sort(([a], [b]) => a.localeCompare(b))), null, 1) + '\n');

  const GAP_MS = 700;                                  // one request start per GAP_MS across the workers
  let nextSlot = 0, failures = 0, stop = false, done = 0;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const throttle = async () => { const at = Math.max(Date.now(), nextSlot); nextSlot = at + GAP_MS; if (at > Date.now()) await sleep(at - Date.now()); };
  async function download(url) {
    let last;
    for (let attempt = 0; attempt < 4; attempt++) {
      if (attempt) await sleep(2000 * 2 ** (attempt - 1));
      await throttle();
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
        if (res.status === 429 || res.status >= 500) { last = new Error('HTTP ' + res.status); nextSlot = Math.max(nextSlot, Date.now() + 10000); continue; }
        if (!res.ok) throw Object.assign(new Error('HTTP ' + res.status), { final: true });
        if (!/^image\//.test(res.headers.get('content-type') || '')) throw Object.assign(new Error('not an image: ' + res.headers.get('content-type')), { final: true });
        return Buffer.from(await res.arrayBuffer());
      } catch (e) { if (e.final) throw e; last = e; }
    }
    throw last;
  }
  const queue = [...need];
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (queue.length && !stop) {
      const id = queue.shift();
      try {
        writeFileSync(file(id), await toWebp(sharp, await download(urls[id])));
        record[id] = urls[id]; failures = 0; done++;
      } catch (e) {
        console.error(`  ${id}: ${e.message}`);
        if (++failures >= 5) { stop = true; console.error('stopping: 5 failures in a row'); }
      }
    }
  }));
  save();
  console.log(`portraits: ${done} downloaded${stop ? ', STOPPED early' : ''}`);
  if (stop) process.exit(1);
}
if (/portraits\.mjs$/.test(process.argv[1] || '')) await main();
