// My Team storage: one versioned key; blocked, full or corrupt storage falls back to the default teams without throwing.
import test from 'node:test';
import assert from 'node:assert/strict';
import { KEY, VERSION, load, save, reset } from '../../site/fantasy/my-team/team-store.js';
import { defaultTeams, setName, setPlayer } from '../../site/core/team-model.js';

const memory = (initial = {}) => {
  const data = { ...initial };
  return { data, getItem: k => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = String(v); } };
};
const broken = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('full'); } };

test('nothing saved: the two default teams', () => {
  assert.deepEqual(load(memory()), defaultTeams());
});

test('save and load use one key with a version', () => {
  const storage = memory(), [a, b] = defaultTeams();
  const teams = [setPlayer(setName(a, 'Mine'), 'starters', 0, 'P000796'), b];
  assert.equal(save(teams, storage), true);
  assert.equal(KEY, 'picknedge.my-team.v1');
  assert.deepEqual(Object.keys(storage.data), [KEY]);
  assert.equal(JSON.parse(storage.data[KEY]).version, VERSION);
  assert.deepEqual(load(storage), teams);
});

test('corrupt JSON, another version or the wrong shape fall back to the defaults', () => {
  for (const text of ['{not json', 'null', '[]', '"x"', '7', JSON.stringify({ version: 2, teams: [{ name: 'A' }] }), JSON.stringify({ teams: [] })])
    assert.deepEqual(load(memory({ [KEY]: text })), defaultTeams(), text);
});

test('a partly broken save keeps what is valid', () => {
  const loaded = load(memory({ [KEY]: JSON.stringify({ version: VERSION, teams: [{ name: 'A', formation: 'bad' }] }) }));
  assert.deepEqual(loaded.map(t => [t.name, t.formation]), [['A', '2-1-2'], ['Team 2', '2-2-1']]);
});

test('storage that throws, or is missing, does not break anything', () => {
  assert.deepEqual(load(broken), defaultTeams());
  assert.equal(save(defaultTeams(), broken), false);
  assert.deepEqual(reset(broken), defaultTeams());
  assert.deepEqual(load(), defaultTeams(), 'no usable localStorage in node');
});

test('reset saves the default teams over what was there', () => {
  const storage = memory(), [a, b] = defaultTeams();
  save([setName(a, 'Mine'), b], storage);
  assert.deepEqual(reset(storage), defaultTeams());
  assert.deepEqual(load(storage), defaultTeams());
});
