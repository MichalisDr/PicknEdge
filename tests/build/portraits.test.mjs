// Portraits: URLs come from the roster, reruns download nothing, files are 300x400 WebP with alpha, and the roster points only at files that exist.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { headshotUrls, todo, toWebp, WIDTH, HEIGHT } from '../../scripts/build/portraits.mjs';

const ROOT = new URL('../../', import.meta.url);
const person = (code, headshot, extra = {}) => ({ type: 'J', active: true, person: { code }, ...(headshot ? { images: { headshot } } : {}), ...extra });

test('headshot URLs come from the roster entry; players without one, staff and non-https values are left out', () => {
  const urls = headshotUrls({ people: { AAA: [person('1', 'https://cdn.example/a.png'), person('2'), { type: 'E', person: { code: '3' }, images: { headshot: 'https://cdn.example/c.png' } }, person('4', 'http://cdn.example/d.png')], BBB: [person('5', 'https://cdn.example/e.png')] } });
  assert.deepEqual(urls, { P1: 'https://cdn.example/a.png', P5: 'https://cdn.example/e.png' });
});

test('a player listed twice uses the active club entry', () => {
  const urls = headshotUrls({ people: { AAA: [person('1', 'https://cdn.example/old.png', { active: false })], BBB: [person('1', 'https://cdn.example/new.png')] } });
  assert.equal(urls.P1, 'https://cdn.example/new.png');
});

test('a rerun downloads nothing; a new player, a changed URL or a missing file is downloaded', () => {
  const urls = { P1: 'u1', P2: 'u2', P3: 'u3', P4: 'u4' }, record = { P1: 'u1', P2: 'OLD', P3: 'u3' };
  assert.deepEqual(todo(urls, record, id => id !== 'P3'), ['P2', 'P3', 'P4']);
  assert.deepEqual(todo(urls, { P1: 'u1', P2: 'u2', P3: 'u3', P4: 'u4' }, () => true), []);
});

test('toWebp: 300x400, WebP, alpha kept', async () => {
  const sharp = (await import('sharp')).default;
  const png = await sharp({ create: { width: 750, height: 1000, channels: 4, background: { r: 200, g: 120, b: 60, alpha: 0.5 } } }).png().toBuffer();
  const out = await toWebp(sharp, png), meta = await sharp(out).metadata();
  assert.deepEqual([meta.format, meta.width, meta.height, meta.hasAlpha], ['webp', WIDTH, HEIGHT, true]);
});

test('the raw roster carries the player-level headshot (most players have one)', () => {
  const roster = JSON.parse(gunzipSync(readFileSync(new URL('data/raw/E2026/roster.json.gz', ROOT))));
  assert.ok(Object.keys(headshotUrls(roster)).length > 300);
});

test('roster.json: portrait only where the file exists; every recorded portrait file exists; files are small WebP', () => {
  const roster = JSON.parse(readFileSync(new URL('site/data/roster.json', ROOT), 'utf8')), record = JSON.parse(readFileSync(new URL('data/portraits.json', ROOT), 'utf8'));
  let n = 0;
  for (const [id, p] of Object.entries(roster.players)) {
    const file = new URL(`site/assets/players/${id}.webp`, ROOT);
    assert.equal('portrait' in p, existsSync(file), id);
    if (p.portrait) { n++; assert.equal(p.portrait, `assets/players/${id}.webp`); assert.ok(id in record, id + ' has a file but no record'); }
  }
  for (const id of Object.keys(record)) assert.ok(existsSync(new URL(`site/assets/players/${id}.webp`, ROOT)), id);
  assert.equal(n, Object.keys(record).length);
  for (const f of readdirSync(new URL('site/assets/players/', ROOT))) assert.ok(f.endsWith('.webp') && statSync(new URL('site/assets/players/' + f, ROOT)).size < 40 * 1024, f);
});

test('the site never loads the image tool: sharp is for the pipeline only', () => {
  const walk = (d, out = []) => { for (const e of readdirSync(d, { withFileTypes: true })) { const p = new URL(e.name + (e.isDirectory() ? '/' : ''), d); if (e.isDirectory()) { if (e.name !== 'data') walk(p, out); } else if (/\.(js|mjs|html)$/.test(e.name)) out.push(p); } return out; };
  for (const f of walk(new URL('site/', ROOT))) assert.ok(!/\bsharp\b/.test(readFileSync(f, 'utf8')), String(f));
});
