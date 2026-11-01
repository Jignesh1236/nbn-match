import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getGenderCapacity,
  getGenderSpotsRemaining,
  isValidEventCapacity,
} from '../src/lib/gender-capacity.ts';

test('event capacity must be a non-negative even integer', () => {
  assert.equal(isValidEventCapacity(0), true);
  assert.equal(isValidEventCapacity(200), true);
  assert.equal(isValidEventCapacity(201), false);
  assert.equal(isValidEventCapacity(-2), false);
  assert.equal(isValidEventCapacity(2.5), false);
});

test('finite event capacity is split equally between men and women', () => {
  assert.equal(getGenderCapacity(200), 100);
  assert.equal(getGenderSpotsRemaining(200, 99), 1);
  assert.equal(getGenderSpotsRemaining(200, 100), 0);
  assert.equal(getGenderSpotsRemaining(200, 105), 0);
});

test('zero capacity leaves gender spots unlimited', () => {
  assert.equal(getGenderCapacity(0), null);
  assert.equal(getGenderSpotsRemaining(0, 500), null);
});
