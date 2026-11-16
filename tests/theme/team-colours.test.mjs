// Team colours of the portrait fade: one entry per team in theme.json (the official feed's primaryColor), none for the four near-black teams, no hex anywhere else.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { TEAMS } from '../../site/assets/teams.js';

const SITE = new URL('../../site/', import.meta.url);
const read = rel => readFileSync(new URL(rel, SITE), 'utf8');
const theme = JSON.parse(read('theme/theme.json')), roster = JSON.parse(read('data/roster.json'));
const fade = theme.component.fantasy['player-card']['header-portrait-fade'];
const entries = Object.fromEntries(Object.entries(fade).filter(([k]) => k.startsWith('team-colour-')).map(([k, v]) => [k.slice('team-colour-'.length), v]));

// feed club code -> catalogue (Euroleague Fantasy) code: the mapping that was verified for the 20 clubs
const CATALOGUE = { IST: 'EFS', MIL: 'MIL', BES: 'BJK', RED: 'CZV', DUB: 'DUB', BAR: 'BAR', MUN: 'BAY', ULK: 'FBT', HTA: 'HTA', BAS: 'KBA', ASV: 'ASV', TEL: 'MTA', OLY: 'OLY', PAN: 'PAO', PRS: 'PBB', PAR: 'PAR', MAD: 'RMB', PAM: 'VBC', VIR: 'VIR', ZAL: 'ZAL' };
const SKIPPED = ['BES', 'PRS', 'PAR', 'VIR'];   // near-black primary colour: invisible on the dark card, they use the neutral default
const PRIMARY = { IST: '#002d74', MIL: '#e1261d', RED: '#e91d26', DUB: '#f6881f', BAR: '#023485', MUN: '#e11837', ULK: '#ffed00', HTA: '#d71920', BAS: '#0a2240', ASV: '#929292', TEL: '#fff100', OLY: '#d1061f', PAN: '#007135', MAD: '#004996', PAM: '#ff6c0e', ZAL: '#0c6f3e' };

test('the 20 team codes of the data map to the catalogue teams as verified (feed club code -> tvCode)', () => {
  assert.deepEqual(Object.keys(roster.logoIds).sort(), Object.keys(CATALOGUE).sort());
  for (const [code, id] of Object.entries(roster.logoIds)) assert.equal(TEAMS.find(t => t.id === id)?.code, CATALOGUE[code], code);
});

test('every non-skipped team has a plain #rrggbb entry with its primary colour; the four skipped teams have none', () => {
  const wanted = Object.keys(CATALOGUE).filter(c => !SKIPPED.includes(c));
  assert.equal(wanted.length, 16);
  assert.deepEqual(Object.keys(entries).sort(), wanted.sort());
  for (const c of wanted) { assert.match(entries[c], /^#[0-9a-f]{6}$/, c); assert.equal(entries[c], PRIMARY[c], c); }
  for (const c of SKIPPED) assert.ok(!(c in entries), c + ' uses the default colour');
  assert.ok(fade['default-colour'] && /^\{semantic\./.test(fade['default-colour']), 'the neutral default stays');
});

test('the colours live only in theme.json: no team hex in any script, style sheet or config (theme.css is generated from theme.json)', () => {
  const hexes = Object.values(entries);
  const walk = (dir, out = []) => { for (const e of readdirSync(new URL(dir, SITE), { withFileTypes: true })) { const rel = dir + e.name + (e.isDirectory() ? '/' : ''); if (e.isDirectory()) { if (e.name !== 'data' && e.name !== '_gate') walk(rel, out); } else if (/\.(js|css|json|html)$/.test(e.name) && !['theme/theme.json', 'theme/theme.css'].includes(rel)) out.push(rel); } return out; };
  for (const f of walk('')) { const text = read(f).toLowerCase(); for (const h of hexes) assert.ok(!text.includes(h), `${f} contains ${h}`); }
});

test('the renderer resolves the team key and falls back to the one default; the fade is the 106 degree gradient of the spec across the header', () => {
  const js = read('fantasy/cards/card-header.js'), css = read('theme/fantasy/card-layout.css');
  assert.match(js, /--fantasy-player-card-header-portrait-fade-team-colour-\$\{[^}]*\}, var\(--fantasy-player-card-header-portrait-fade-default-colour\)/);
  assert.match(css, /linear-gradient\(var\(--fantasy-player-card-header-portrait-fade-angle\),color-mix\(in srgb,var\(--fade-colour\) var\(--fantasy-player-card-header-portrait-fade-alpha-start\),transparent\) 0,/);
});
