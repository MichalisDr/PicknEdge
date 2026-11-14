import test from 'node:test';
import assert from 'node:assert/strict';
import { displayName, nameParts } from '../../scripts/build/names.mjs';

test('display names', () => {
  assert.equal(displayName('ALLMAN, KYLE'), 'Kyle Allman');
  assert.equal(displayName("O'BRIEN, JOHN-PAUL"), "John-Paul O'Brien");
  assert.equal(displayName('MCINTYRE, ALEX', { Mcintyre: 'McIntyre' }), 'Alex McIntyre');
  assert.equal(displayName('SMITH III, JOHN'), 'John Smith III');
  assert.equal(displayName('SINGLENAME'), 'Singlename');
});

test('name parts: passport name and surname only when they say the same letters as the raw name, part by part', () => {
  assert.deepEqual(nameParts('PAYNE, CAMERON', 'CAMERON', 'PAYNE'), { first: 'Cameron', last: 'Payne' });
  assert.deepEqual(nameParts('PÉREZ, JOSÉ', 'JOSE', 'PEREZ'), { first: 'Jose', last: 'Perez' }, 'accents and case do not matter');
  assert.equal(nameParts('JONES, KAI', 'KAI MARTINEZ', 'JONES'), null, 'a longer legal name is not the name the player goes by');
  assert.equal(nameParts('DJURISIC, NIKOLA', 'NIKOLA', 'DURISIC'), null);
  assert.equal(nameParts('PAYNE, CAMERON', undefined, 'PAYNE'), null);
  assert.equal(nameParts('PAYNE, CAMERON', '', ''), null);
  assert.equal(nameParts('PAYNE', 'CAMERON', 'PAYNE'), null, 'no "LAST, FIRST" to compare with');
  assert.deepEqual(nameParts('LEDAY, JOHN', 'JOHN', 'LEDAY', { Leday: 'LeDay' }), { first: 'John', last: 'LeDay' }, 'name-fixes apply');
  assert.deepEqual(nameParts('DE COLO, NANDO', 'NANDO', 'DE COLO'), { first: 'Nando', last: 'De Colo' }, 'a space inside a part stays');
});

test('site/data/roster.json: first and last are optional, agree with rawName, and name / rawName are untouched', async () => {
  const { readFileSync } = await import('node:fs');
  const roster = JSON.parse(readFileSync(new URL('../../site/data/roster.json', import.meta.url), 'utf8'));
  const fold = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '');
  let withParts = 0;
  for (const p of Object.values(roster.players)) {
    assert.ok(('first' in p) === ('last' in p), p.rawName);
    if (!p.first) continue;
    withParts++;
    const [last, first] = p.rawName.split(/\s*,\s*/);
    assert.equal(fold(p.first), fold(first), p.rawName); assert.equal(fold(p.last), fold(last), p.rawName);
    assert.equal(p.name, displayName(p.rawName, JSON.parse(readFileSync(new URL('../../data/manual/name-fixes.json', import.meta.url), 'utf8')).words), 'display name unchanged');
  }
  assert.ok(withParts > 100);
});
