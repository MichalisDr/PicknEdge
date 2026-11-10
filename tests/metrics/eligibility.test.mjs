// Eligibility is display-only: computed from the selected window's data and the manifest thresholds; never stored.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { parseCsv } from '../../scripts/build/csv.mjs';
import { buildViews } from '../../scripts/build/views.mjs';
import { METRICS } from '../../scripts/metrics/registry.mjs';

const { eligible } = createRequire(import.meta.url)('../../site/eligibility.js');
const rule = JSON.parse(readFileSync(new URL('../../data/manual/eligibility.json', import.meta.url), 'utf8'));

test('a player below the threshold in one window and above it in another appears and disappears with the window', () => {
  const l3 = { gp: 3, min: 8.5, pir: 9 };              // low minutes in the last 3 games
  const l5 = { gp: 5, min: 12, pir: 7 };               // enough over the last 5
  assert.equal(eligible(rule, 'l3', l3), false);
  assert.equal(eligible(rule, 'l5', l5), true);
});

test('a new game changes the answer without any stored flag', () => {
  assert.equal(eligible(rule, 'l5', { gp: 2, min: 20, pir: 12 }), false);   // 2 games in the window: below minGp 3
  assert.equal(eligible(rule, 'l5', { gp: 3, min: 20, pir: 12 }), true);    // the third game arrives
});

test('missing data and unknown windows are not eligible', () => {
  assert.equal(eligible(rule, 'l5', { gp: 4, min: null, pir: 9 }), false);
  assert.equal(eligible(rule, 'l7', { gp: 4, min: 20, pir: 9 }), false);
  assert.equal(eligible(rule, 'l5', undefined), false);
});

test('views contain every player who played and no eligibility flag', () => {
  const read = f => parseCsv(readFileSync(new URL('../../data/clean/' + f, import.meta.url), 'utf8'));
  const players = read('player_games.csv'), views = buildViews({ players, teams: read('team_games.csv'), dim: read('players.csv') });
  const played = new Set(players.filter(r => r.played).map(r => r.player_id));
  for (const w of Object.keys(views)) assert.deepEqual([...played].filter(id => !views[w].players.rows[id]), [], `missing from ${w}`);
  assert.ok(!METRICS.some(m => /elig/i.test(m.id)));
  assert.ok(!/elig/i.test(readFileSync(new URL('../../data/clean/player_games.csv', import.meta.url), 'utf8').split('\n')[0]));
  // with real data the same player can be eligible in one window and not in another
  const ids = METRICS.filter(m => m.scope === 'player').map(m => m.id), at = (w, p, id) => views[w].players.rows[p].v[ids.indexOf(id)];
  const stat = (w, p) => { const x = id => { const v = at(w, p, id); return Array.isArray(v) ? v[0] : v; }; return { gp: x('gp'), min: x('min'), pir: x('pir') }; };
  const differs = Object.keys(views.l3.players.rows).filter(p => views.l5.players.rows[p] && eligible(rule, 'l3', stat('l3', p)) !== eligible(rule, 'l5', stat('l5', p)));
  assert.ok(differs.length > 0, 'expected at least one player whose eligibility differs between L3 and L5');
});
