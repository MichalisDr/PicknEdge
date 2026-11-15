// Team card title lines: club name and the approved city below it (config/team-cities.json), from the stable team catalogue id.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { teamTitleLines } from '../../site/core/team-city.js';
import CITIES from '../../site/config/team-cities.json' with { type: 'json' };
import { TEAMS } from '../../site/assets/teams.js';

test('no approved city: the display name alone, no second line', () => {
  for (const entry of [undefined, null, {}, { city: '' }, { city: '  ' }, { club: 'Real' }]) assert.deepEqual(teamTitleLines('Real Madrid', entry), { club: 'Real Madrid', city: null });
});

test('a city that is a trailing part of the display name is shown once, across the two lines', () => {
  assert.deepEqual(teamTitleLines('Hapoel IBI Tel Aviv', { city: 'Tel Aviv' }), { club: 'Hapoel IBI', city: 'Tel Aviv' });
  assert.deepEqual(teamTitleLines('Olympiacos Piraeus', { city: 'Piraeus' }), { club: 'Olympiacos', city: 'Piraeus' });
  assert.deepEqual(teamTitleLines('Tel Aviv', { city: 'Tel Aviv' }), { club: 'Tel Aviv', city: 'Tel Aviv' }, 'nothing left of the name: no split');
  assert.deepEqual(teamTitleLines('Valencia Basket', { city: 'Valencia' }), { club: 'Valencia Basket', city: 'Valencia' }, 'a leading city is not split');
});

test('an approved club name overrides the split; the original display name is untouched', () => {
  assert.deepEqual(teamTitleLines('Real Madrid', { city: 'Madrid', club: 'Real Madrid' }), { club: 'Real Madrid', city: 'Madrid' });
  assert.deepEqual(teamTitleLines('Kosner Baskonia Vitoria-Gasteiz', { city: 'Vitoria-Gasteiz', club: 'Baskonia' }), { club: 'Baskonia', city: 'Vitoria-Gasteiz' });
  const name = 'Anadolu Efes Istanbul'; teamTitleLines(name, { city: 'Istanbul' }); assert.equal(name, 'Anadolu Efes Istanbul');
});

test('the mapping file is keyed by catalogue ids only; nothing is invented (empty until the labels are approved)', () => {
  const ids = new Set(TEAMS.map(t => t.id));
  for (const [id, e] of Object.entries(CITIES.cities)) { assert.ok(ids.has(id), id + ' is not a catalogue id'); assert.equal(typeof e.city, 'string'); }
  assert.ok(typeof CITIES.note === 'string');
});
