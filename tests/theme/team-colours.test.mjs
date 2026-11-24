// Team colours: the feed's primaryColor of all 20 teams in theme.json (component.fantasy.team-colour.primary), keyed by the public code; no team hex anywhere else.
// No team is special-cased: teamColour() gives every public code its own primary; the neutral colour is only the fallback for a code not in the registry.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { TEAMS } from '../../site/assets/teams.js';
import { teamColour } from '../../site/core/team-colour.js';

const SITE = new URL('../../site/', import.meta.url);
const read = rel => readFileSync(new URL(rel, SITE), 'utf8');
const theme = JSON.parse(read('theme/theme.json')), roster = JSON.parse(read('data/roster.json'));
const tc = theme.component.fantasy['team-colour'];
const snapshot = JSON.parse(gunzipSync(readFileSync(new URL('../../data/raw/E2026/roster.json.gz', import.meta.url))).toString('utf8'));

// feed club code (the key of the data) -> public code (tvCode): verified for the 20 clubs
const PUBLIC = { IST: 'EFS', MIL: 'MIL', BES: 'BJK', RED: 'CZV', DUB: 'DUB', BAR: 'BAR', MUN: 'BAY', ULK: 'FBT', HTA: 'HTA', BAS: 'KBA', ASV: 'ASV', TEL: 'MTA', OLY: 'OLY', PAN: 'PAO', PRS: 'PBB', PAR: 'PAR', MAD: 'RMB', PAM: 'VBC', VIR: 'VIR', ZAL: 'ZAL' };
const PRIMARY = { EFS: '#002d74', MIL: '#e1261d', BJK: '#000000', CZV: '#e91d26', DUB: '#f6881f', BAR: '#023485', BAY: '#e11837', FBT: '#ffed00', HTA: '#d71920', KBA: '#0a2240', ASV: '#929292', MTA: '#fff100', OLY: '#d1061f', PAO: '#007135', PBB: '#000000', PAR: '#1d1d1b', RMB: '#004996', VBC: '#ff6c0e', VIR: '#1d1d1b', ZAL: '#0c6f3e' };
const DARK = ['BJK', 'PAR', 'PBB', 'VIR'];

test('the 20 data codes map to the registry teams by public code (feed club code -> tvCode)', () => {
  assert.deepEqual(Object.keys(roster.logoIds).sort(), Object.keys(PUBLIC).sort());
  for (const [code, id] of Object.entries(roster.logoIds)) assert.equal(TEAMS.find(t => t.id === id)?.code, PUBLIC[code], code);
  for (const t of TEAMS) assert.equal(PUBLIC[t.feed], t.code, t.id);
});

test('all 20 teams have a plain #rrggbb primary colour in the theme, keyed by public code, equal to the feed primaryColor of the snapshot', () => {
  assert.deepEqual(Object.keys(tc.primary).sort(), Object.values(PUBLIC).sort());
  for (const [code, hex] of Object.entries(tc.primary)) { assert.match(hex, /^#[0-9a-f]{6}$/, code); assert.equal(hex, PRIMARY[code], code); }
  for (const c of snapshot.clubs) assert.equal(tc.primary[c.tvCode], c.primaryColor.toLowerCase(), c.code + ': the feed colour, no exception');
  assert.ok(/^\{semantic\./.test(tc.neutral.colour), 'the neutral default is a theme colour');
});

test('the colours live only in theme.json: no team hex in any script, style sheet or config (theme.css is generated from theme.json)', () => {
  const hexes = [...new Set(Object.values(tc.primary))].filter(h => h !== '#000000');
  const walk = (dir, out = []) => { for (const e of readdirSync(new URL(dir, SITE), { withFileTypes: true })) { const rel = dir + e.name + (e.isDirectory() ? '/' : ''); if (e.isDirectory()) { if (e.name !== 'data' && e.name !== '_gate') walk(rel, out); } else if (/\.(js|css|json|html)$/.test(e.name) && !['theme/theme.json', 'theme/theme.css'].includes(rel)) out.push(rel); } return out; };
  for (const f of walk('')) { const text = read(f).toLowerCase(); for (const h of hexes) assert.ok(!text.includes(h), `${f} contains ${h}`); }
});

test('teamColour: all 20 public codes give their true primary from the registry table, the four dark ones included; an unknown code gives the neutral colour', () => {
  for (const code of Object.values(PUBLIC)) {
    assert.equal(teamColour(code), `--fade-colour:var(--fantasy-team-colour-primary-${code}, var(--fantasy-team-colour-neutral-colour))`, code);
    assert.equal(tc.primary[code], PRIMARY[code], code);
  }
  for (const code of DARK) assert.ok(teamColour(code).includes(`primary-${code},`), code + ' is not special-cased');
  assert.ok(!('teams' in tc.neutral), 'no neutral list in the theme');
  assert.ok(!(('ZZZ') in tc.primary), 'an unknown code has no primary: the CSS fallback paints the neutral colour');
  assert.ok(teamColour('ZZZ').endsWith('var(--fantasy-team-colour-neutral-colour))'));
});

test('the card header and the chart read the one helper; the fade is the 106 degree gradient of the spec across the header', () => {
  const css = read('theme/fantasy/card-layout.css');
  assert.ok(read('fantasy/cards/card-header.js').includes("import { teamColour } from '../../core/team-colour.js'"), 'the card header reads the one helper');
  assert.ok(read('fantasy/gallery/scatter.js').includes("import { teamColour } from '../../core/team-colour.js'"), 'the chart reads the one helper');
  assert.match(css, /linear-gradient\(var\(--fantasy-player-card-header-portrait-fade-angle\),color-mix\(in srgb,var\(--fade-colour\) var\(--fantasy-player-card-header-portrait-fade-alpha-start\),transparent\) 0,/);
});
