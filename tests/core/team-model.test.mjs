// My Team model: shape, formations and court slots, edits, credits with a soft cap, undo, cleaning of what was read.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../../site/core/team-model.js';

const full = () => ({ ...M.emptyTeam('T', '2-2-1'), starters: ['g1', 'g2', 'f1', 'f2', 'c1'], bench: ['six', 'b1', 'b2', 'b3', 'b4', 'coach'] });
const frozen = team => { Object.freeze(team.starters); Object.freeze(team.bench); return Object.freeze(team); };

test('two default teams, both empty, with their own formation and cap', () => {
  const [a, b] = M.defaultTeams();
  assert.equal(M.defaultTeams().length, M.MAX_TEAMS);
  assert.deepEqual([a.name, a.formation, a.capText, b.name, b.formation, b.capText], ['Team 1', '2-1-2', '115.6', 'Team 2', '2-2-1', '100']);
  for (const t of [a, b]) { assert.deepEqual(t.starters, Array(5).fill(null)); assert.deepEqual(t.bench, Array(6).fill(null)); }
  assert.notEqual(M.defaultTeams()[0].starters, a.starters, 'every call is a new copy');
});

test('the five formations count guards-forwards-centres, five players each', () => {
  assert.deepEqual(M.FORMATIONS, ['2-2-1', '2-1-2', '1-2-2', '1-3-1', '3-1-1']);
  for (const f of M.FORMATIONS) {
    const p = M.positionsOf(f);
    assert.equal(p.length, 5);
    assert.equal(['G', 'F', 'C'].map(x => p.filter(y => y === x).length).join('-'), f);
  }
  assert.throws(() => M.positionsOf('4-0-1'));
});

test('court rows go from the basket down: centres, forwards, guards', () => {
  assert.deepEqual(M.slotRows('2-1-2'), [{ position: 'C', indexes: [3, 4] }, { position: 'F', indexes: [2] }, { position: 'G', indexes: [0, 1] }]);
});

test('changing formation keeps players by position, in order, up to the new counts', () => {
  const team = frozen(full());
  assert.deepEqual(M.setFormation(team, '2-1-2').starters, ['g1', 'g2', 'f1', 'c1', null]);
  assert.deepEqual(M.setFormation(team, '1-3-1').starters, ['g1', 'f1', 'f2', null, 'c1']);
  assert.deepEqual(M.setFormation(team, '3-1-1').starters, ['g1', 'g2', null, 'f1', 'c1']);
  assert.deepEqual(M.setFormation(team, '1-2-2').starters, ['g1', 'f1', 'f2', 'c1', null]);
  assert.deepEqual(M.setFormation(team, '1-2-2').bench, team.bench, 'the bench stays');
  assert.equal(M.setFormation(team, '2-2-1'), team);
  assert.equal(M.setFormation(team, 'x'), team);
});

test('a gap before a player does not move that player to another position', () => {
  const team = { ...M.emptyTeam('T', '2-2-1'), starters: [null, 'g2', null, null, 'c1'] };
  assert.deepEqual(M.setFormation(team, '1-3-1').starters, ['g2', null, null, null, 'c1']);
});

test('put, replace and remove a player; the same player cannot be in a team twice', () => {
  const empty = frozen(M.emptyTeam('T'));
  const one = M.setPlayer(empty, 'starters', 0, 'p1');
  assert.equal(one.starters[0], 'p1');
  assert.equal(M.setPlayer(one, 'bench', M.SIXTH_MAN, 'p1'), one);
  assert.equal(M.setPlayer(one, 'starters', 0, 'p2').starters[0], 'p2');
  assert.equal(M.setPlayer(one, 'starters', 0, null).starters[0], null);
  for (const bad of [['starters', 5, 'p2'], ['bench', -1, 'p2'], ['name', 0, 'p2'], ['starters', 1, ''], ['starters', 1, 7], ['starters', 1, null]])
    assert.equal(M.setPlayer(one, ...bad), one, String(bad));
});

test('name: trimmed, never empty', () => {
  const team = M.emptyTeam('T');
  assert.equal(M.setName(team, '  Friday  ').name, 'Friday');
  assert.equal(M.setName(team, '   '), team);
  assert.equal(M.setName(team, 'T'), team);
});

test('cap: a positive number as text, decimal comma accepted; anything else keeps the old one', () => {
  const team = M.emptyTeam('T');
  assert.equal(M.setCap(team, ' 98,5 ').capText, '98.5');
  for (const bad of ['', '0', '-3', 'abc', '1e3', '12.', null]) assert.equal(M.setCap(team, bad), team, String(bad));
  assert.equal(M.parseCap('115.6'), 115.6);
});

test('credits: starters, 6th man and bench; the coach is not counted', () => {
  const c = M.credits(full(), id => (id === 'coach' ? 50 : 10.1));
  assert.deepEqual(c, { used: 101, cap: 115.6, left: 14.6, over: 0, isOver: false, missing: 0 });
});

test('soft cap: exactly at the cap is not over; above it, the amount over is reported', () => {
  const team = { ...M.emptyTeam('T', '2-2-1', '0.3'), starters: ['a', 'b', null, null, null] };
  const crOf = id => ({ a: 0.1, b: 0.2 })[id];
  assert.deepEqual(M.credits(team, crOf), { used: 0.3, cap: 0.3, left: 0, over: 0, isOver: false, missing: 0 }, 'no floating point noise');
  assert.deepEqual(M.credits({ ...team, capText: '0.2' }, crOf), { used: 0.3, cap: 0.2, left: 0, over: 0.1, isOver: true, missing: 0 });
});

test('a player without credits adds nothing and is counted as missing', () => {
  const c = M.credits(full(), id => (id === 'g1' ? null : id === 'g2' ? undefined : 5));
  assert.deepEqual([c.used, c.missing], [40, 2]);
});

test('undo: the last 20 changes, newest first; an edit that changes nothing is not recorded', () => {
  let entry = M.startHistory(M.emptyTeam('0'));
  assert.equal(M.undo(entry), entry);
  assert.equal(M.change(entry, M.setName(entry.team, '0')), entry);
  for (let i = 1; i <= 25; i++) entry = M.change(entry, M.setName(entry.team, String(i)));
  assert.equal(entry.history.length, M.UNDO_LIMIT);
  for (let i = 24; i >= 5; i--) { entry = M.undo(entry); assert.equal(entry.team.name, String(i)); }
  assert.equal(M.undo(entry), entry);
});

test('undo brings back the players a formation change dropped', () => {
  const start = M.startHistory(full());
  assert.deepEqual(M.undo(M.change(start, M.setFormation(start.team, '3-1-1'))).team, full());
});

test('cleaning: bad fields take the fallback, bad or repeated ids leave an empty slot', () => {
  const fallback = M.emptyTeam('Team 1', '2-1-2');
  const clean = M.cleanTeam({ name: ' ', capText: 100, formation: '5-0-0', starters: ['a', 'a', 3, '', 'b', 'extra'], bench: ['b', 'c'] }, fallback);
  assert.deepEqual(clean, { name: 'Team 1', capText: '115.6', formation: '2-1-2', starters: ['a', null, null, null, 'b'], bench: [null, 'c', null, null, null, null] });
  assert.deepEqual(M.cleanTeam(null, fallback), fallback);
});

test('clearing the players keeps the name, formation and cap, and undo brings them back', () => {
  const start = M.startHistory(frozen(full()));
  const cleared = M.change(start, M.clearPlayers(start.team));
  assert.deepEqual(cleared.team, M.emptyTeam('T', '2-2-1'));
  assert.deepEqual(M.undo(cleared).team, full());
  assert.equal(M.clearPlayers(cleared.team), cleared.team, 'nothing to clear is not a change');
});

test('cleaning keeps exactly two teams', () => {
  assert.deepEqual(M.cleanTeams([{ name: 'A' }]).map(t => t.name), ['A', 'Team 2']);
  assert.deepEqual(M.cleanTeams([{ name: 'A' }, { name: 'B' }, { name: 'C' }]).map(t => t.name), ['A', 'B']);
  assert.deepEqual(M.cleanTeams('nonsense'), M.defaultTeams());
});
