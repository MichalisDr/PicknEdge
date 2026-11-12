// Eligibility is display-only: computed from the selected window's data and the manifest thresholds; never stored.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseCsv } from '../../scripts/build/csv.mjs';
import { buildViews } from '../../scripts/build/views.mjs';
import { METRICS } from '../../scripts/metrics/registry.mjs';

import { eligible, available, listed } from '../../site/core/eligibility.js';
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

// ---- availability gate: played at least 1 of the team's last 3 games (the gp of the L3 view), evaluated once for every window ----
const csv = f => parseCsv(readFileSync(new URL('../../data/clean/' + f, import.meta.url), 'utf8'));
const clean = { players: csv('player_games.csv'), teams: csv('team_games.csv'), dim: csv('players.csv') };
const ids = METRICS.filter(m => m.scope === 'player' && !m.internal).map(m => m.id);
const stat = (views, w, p) => { const v = views[w].players.rows[p].v, x = id => { const c = v[ids.indexOf(id)]; return Array.isArray(c) ? c[0] : c; }; return { gp: x('gp'), min: x('min'), pir: x('pir') }; };
const shown = (views, w, p, showAll = false) => listed(rule, w, stat(views, w, p), stat(views, 'l3', p).gp, showAll);
const idOf = (name, team) => { const r = clean.dim.find(d => d.player.startsWith(name) && d.team === team); assert.ok(r, name); return r.player_id; };

test('the gate is one global setting copied from data/manual/eligibility.json', () => {
  assert.deepEqual(rule.availability, { window: 'l3', minGp: 1 });
  assert.equal(available(rule, 0), false); assert.equal(available(rule, 1), true); assert.equal(available(rule, null), false);
  assert.equal(available({ windows: {} }, 0), true, 'no availability setting = no gate');
});

test('Mike James (IST) and Jean Montero (OLY) are hidden in every window by default and shown with the checkbox on', () => {
  const views = buildViews(clean);
  for (const p of [idOf('JAMES, MIKE', 'IST'), idOf('MONTERO, JEAN', 'OLY')]) {
    for (const w of ['season', 'l10', 'l5', 'l3']) {
      assert.equal(shown(views, w, p), false, `${p} hidden in ${w}`);
      assert.equal(shown(views, w, p, true), true, `${p} listed in ${w} with the checkbox`);
    }
    assert.ok(stat(views, 'season', p).gp >= 3, 'he passes the old Season rule by his early games');
  }
});

test('the gate only removes players: everyone it lists also passes the thresholds, and all players stay in the views', () => {
  const views = buildViews(clean), all = Object.keys(views.l3.players.rows);
  for (const w of ['season', 'l10', 'l5', 'l3']) {
    const byThresholds = all.filter(p => listed({ ...rule, availability: undefined }, w, stat(views, w, p), 0));
    const byGate = all.filter(p => shown(views, w, p));
    assert.ok(byGate.every(p => byThresholds.includes(p)), w);
    if (w === 'season' || w === 'l10') assert.ok(byGate.length < byThresholds.length, `${w}: the gate hides someone`);   // L5 and L3 thresholds already need recent games
    assert.ok(all.length >= 292);
  }
});

test('a player returning after an absence is listed again once he appears in the L3 view (no stored flag)', () => {
  const james = idOf('JAMES, MIKE', 'IST'), last = clean.teams.filter(t => t.team === 'IST').sort((a, b) => b.date_utc.localeCompare(a.date_utc))[0];
  const before = buildViews(clean);
  assert.equal(shown(before, 'season', james), false);
  // IST plays one more game and James plays in it
  const game = 99999, date = '2026-12-01T18:00:00.000Z';
  const teams = [...clean.teams, ...clean.teams.filter(t => t.game === last.game).map(t => ({ ...t, game, date_utc: date, round: last.round + 1 }))];
  const jamesRow = clean.players.filter(r => r.player_id === james && r.played).at(-1);
  const players = [...clean.players, { ...jamesRow, game, date_utc: date, round: last.round + 1 }];
  const after = buildViews({ ...clean, teams, players });
  assert.equal(stat(after, 'l3', james).gp, 1);
  assert.equal(available(rule, stat(after, 'l3', james).gp), true);
  for (const w of ['season', 'l10', 'l5', 'l3']) assert.equal(shown(after, w, james), listed({ ...rule, availability: undefined }, w, stat(after, w, james), 0), w);   // now only the window thresholds decide
  assert.equal(shown(after, 'season', james), true);
  assert.equal(listed(rule, 'season', stat(after, 'season', james), stat(after, 'l3', james).gp, false), true);
});
