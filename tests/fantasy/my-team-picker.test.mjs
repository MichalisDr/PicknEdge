// My Team picker: what a slot asks for, the list (position, search, order), the rows and the reused parts.
import test from 'node:test';
import assert from 'node:assert/strict';
import { pickerList, slotRequest, listHtml, pickerHtml } from '../../site/fantasy/my-team/picker.js';
import { pickerPool } from '../../site/fantasy/my-team/team-page.js';
import { emptyTeam } from '../../site/core/team-model.js';

const player = (id, fullName, pos, cr, pir, min) => ({ id, fullName, name: fullName, pos, portrait: null, next: { home: true, code: 'ASV' }, info: cr === null ? null : { cr }, pir: String(pir ?? '—'), min: String(min ?? '—'), sort: { cr, pir, min } });
const pool = [player('1', 'Ana Dončić', 'G', 10, 5, 30), player('2', 'Bob Guard', 'G', 12, 20, 10), player('3', 'Cy Forward', 'F', null, 9, 20), player('4', 'Di Center', 'C', 15, null, null), player('5', 'Al Guard', 'G', 8, 5, 25)];
const ids = list => list.map(p => p.id).join('');

test('a court slot asks for its position; the bench for anyone', () => {
  const team = emptyTeam('T', '2-1-2');
  assert.deepEqual(slotRequest(team, { area: 'starters', index: 0 }), { title: 'Choose a guard', position: 'G' });
  assert.deepEqual(slotRequest(team, { area: 'starters', index: 2 }), { title: 'Choose a forward', position: 'F' });
  assert.deepEqual(slotRequest(team, { area: 'starters', index: 4 }), { title: 'Choose a center', position: 'C' });
  assert.deepEqual(slotRequest(team, { area: 'bench', index: 0 }), { title: 'Choose a 6th man', position: null });
  assert.deepEqual(slotRequest(team, { area: 'bench', index: 3 }), { title: 'Choose a bench player', position: null });
});

test('order: PIR by default, highest first, ties by name, no number last', () => {
  assert.equal(ids(pickerList(pool)), '23514');
  assert.equal(ids(pickerList(pool, { sort: 'cr' })), '42153');
  assert.equal(ids(pickerList(pool, { sort: 'min' })), '15324');
});

test('position: a locked slot ignores the chips; the bench follows them', () => {
  assert.equal(ids(pickerList(pool, { position: 'G', chip: 'C' })), '251');
  assert.equal(ids(pickerList(pool, { chip: 'F' })), '3');
  assert.equal(pickerList(pool, { chip: 'ALL' }).length, 5);
});

test('search: by name, without case or accents', () => {
  assert.equal(ids(pickerList(pool, { query: ' doncic ' })), '1');
  assert.equal(ids(pickerList(pool, { query: 'GUARD' })), '25');
  assert.equal(ids(pickerList(pool, { query: 'zz' })), '');
});

test('rows: next opponent, PIR, MIN and the CR box only; a player in the team is dimmed and says so', () => {
  const html = listHtml(pool.slice(0, 2), ['2']);
  assert.equal(html.match(/data-pick=/g).length, 2);
  assert.equal(html.match(/aria-disabled="true"/g).length, 1);
  assert.match(html, /data-pick="2" aria-disabled="true"[\s\S]*>in roster</);
  assert.ok(html.includes('>vs ASV<') && html.includes('name-cell-cr-box') && !html.includes('value-chip'));
  assert.ok(!listHtml([pool[2]], []).includes('cr-box'), 'no credits, no box');
  assert.ok(listHtml([], []).includes('No matching players'));
});

test('panel: drawer head and close, card sort chips; position boxes only without a locked position', () => {
  const bench = pickerHtml({ title: 'Choose a bench player', position: null }), court = pickerHtml({ title: 'Choose a guard', position: 'G' });
  for (const html of [bench, court]) {
    assert.ok(html.includes('class="fw-fd-title"') && html.includes('class="fw-fd-close"') && html.includes('data-part="fantasy.player-card.window-buttons"'));
    assert.match(html, /data-sort-by="pir" aria-pressed="true"/);
  }
  assert.deepEqual([...bench.matchAll(/data-chip="(\w+)"/g)].map(m => m[1]), ['ALL', 'G', 'F', 'C']);
  assert.ok(!court.includes('data-chip'));
});

test('the pool: players of the Season view who are still on a roster', () => {
  const roster = { teams: {}, players: { a: { name: 'A', pos: 'G', active: 1 }, gone: { name: 'Gone', pos: 'G', active: 0 } } };
  const season = { keys: ['a', 'gone', 'unknown'], row: () => ({ pos: 'G', team: 'X' }), get: (id, m) => ({ value: m === 'pir' ? 7 : 20 }) };
  const [only, ...rest] = pickerPool({ roster, season, nextOf: new Map() });
  assert.equal(rest.length, 0);
  assert.deepEqual([only.id, only.sort], ['a', { cr: null, pir: 7, min: 20 }]);
});
