import test from 'node:test';
import assert from 'node:assert/strict';
import { displayName } from '../../scripts/build/names.mjs';

test('display names', () => {
  assert.equal(displayName('ALLMAN, KYLE'), 'Kyle Allman');
  assert.equal(displayName("O'BRIEN, JOHN-PAUL"), "John-Paul O'Brien");
  assert.equal(displayName('MCINTYRE, ALEX', { Mcintyre: 'McIntyre' }), 'Alex McIntyre');
  assert.equal(displayName('SMITH III, JOHN'), 'John Smith III');
  assert.equal(displayName('SINGLENAME'), 'Singlename');
});
