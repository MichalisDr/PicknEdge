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

test('name parts: from "SURNAME, GIVEN" with exactly one comma, never split on spaces, and first + last is the display name', () => {
  assert.deepEqual(nameParts('PAYNE, CAMERON'), { first: 'Cameron', last: 'Payne' });
  assert.deepEqual(nameParts('DE COLO, NANDO'), { first: 'Nando', last: 'De Colo' }, 'a space inside a part stays');
  assert.deepEqual(nameParts("BRISSETT, O'SHAE J"), { first: "O'Shae J", last: 'Brissett' });
  assert.deepEqual(nameParts('LEDAY, JOHN', { Leday: 'LeDay' }), { first: 'John', last: 'LeDay' }, 'name-fixes apply');
  for (const bad of ['PAYNE', 'PAYNE,', ', CAMERON', ' , ', 'A, B, C', '', undefined]) assert.equal(nameParts(bad), null, String(bad));
  for (const raw of ['ALLMAN, KYLE', "O'BRIEN, JOHN-PAUL", 'MCINTYRE, ALEX', 'WALKER IV, LONNIE']) { const p = nameParts(raw); assert.equal(p.first + ' ' + p.last, displayName(raw)); }
});

test('site/data/roster.json: first and last are optional, are the two sides of rawName, and name / rawName are untouched', async () => {
  const { readFileSync } = await import('node:fs');
  const roster = JSON.parse(readFileSync(new URL('../../site/data/roster.json', import.meta.url), 'utf8'));
  const fixes = JSON.parse(readFileSync(new URL('../../data/manual/name-fixes.json', import.meta.url), 'utf8')).words;
  let withParts = 0;
  for (const p of Object.values(roster.players)) {
    assert.ok(('first' in p) === ('last' in p), p.rawName);
    if (!p.first) continue;
    withParts++;
    assert.deepEqual({ first: p.first, last: p.last }, nameParts(p.rawName, fixes), p.rawName);
    assert.equal(p.first + ' ' + p.last, p.name, p.rawName);
    assert.equal(p.name, displayName(p.rawName, fixes), 'display name unchanged');
  }
  assert.ok(withParts >= 0.9 * Object.keys(roster.players).length, 'almost every player has a "SURNAME, GIVEN" name');
});
