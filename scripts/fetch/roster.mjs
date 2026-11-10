// Roster snapshot (clubs + people) from the feeds API, one file per season: data/raw/<season>/roster.json.gz
// Rewritten only when the content changed (no timestamp inside), so unchanged runs leave no git noise.
import { writeFile, readFile, rename } from 'node:fs/promises';
import { gzipSync, gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import { get, ShapeError } from './api.mjs';

const FEED = 'https://feeds.incrowdsports.com/provider/euroleague-feeds/v2/competitions/E/seasons/';

export async function fetchRoster(season, root) {
  const clubs = (await get(`${FEED}${season}/clubs`)).json;
  if (clubs.status !== 'success' || !Array.isArray(clubs.data) || !clubs.data.length) throw new ShapeError('API shape changed at clubs: status/data');
  const people = {};
  for (const c of clubs.data) {
    if (typeof c.code !== 'string') throw new ShapeError('API shape changed at clubs: club.code');
    const list = (await get(`${FEED}${season}/clubs/${c.code}/people`)).json;
    if (!Array.isArray(list)) throw new ShapeError(`API shape changed at clubs/${c.code}/people: expected array`);
    for (const p of list.filter(x => x.type === 'J'))
      if (!p.person?.code || !('positionName' in p) || !('active' in p)) throw new ShapeError(`API shape changed at clubs/${c.code}/people: person.code/positionName/active`);
    people[c.code] = list;
  }
  const text = JSON.stringify({ season, clubs: clubs.data.map(({ code, name, abbreviatedName, tvCode }) => ({ code, name, abbreviatedName, tvCode })), people });
  const file = join(root, 'roster.json.gz');
  let same = false;
  try { same = gunzipSync(await readFile(file)).toString('utf8') === text; } catch {}
  if (same) return { changed: false, clubs: clubs.data.length };
  await writeFile(file + '.tmp', gzipSync(text, { level: 9 }));
  await rename(file + '.tmp', file);
  return { changed: true, clubs: clubs.data.length };
}
