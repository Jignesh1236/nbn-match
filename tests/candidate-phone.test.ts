import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isPhoneLengthValid,
  normalizePhoneDigits,
  normalizedPhoneForMatch,
  phonesMatch,
} from '../src/lib/candidate-phone.ts';

test('normalizePhoneDigits keeps only digits', () => {
  assert.equal(normalizePhoneDigits('+880 1712-345678'), '8801712345678');
  assert.equal(normalizePhoneDigits(null), '');
});

test('isPhoneLengthValid rejects short and oversized input', () => {
  assert.equal(isPhoneLengthValid('12345'), false);
  assert.equal(isPhoneLengthValid('01712345678'), true);
  assert.equal(isPhoneLengthValid('+8801712345678'), true);
  assert.equal(isPhoneLengthValid('1234567890123456'), false);
  assert.equal(isPhoneLengthValid(''), false);
});

test('normalizedPhoneForMatch compares the last 10 digits like the database', () => {
  assert.equal(normalizedPhoneForMatch('+8801712345678'), '1712345678');
  assert.equal(normalizedPhoneForMatch('01712345678'), '1712345678');
  assert.equal(normalizedPhoneForMatch('12345'), null);
});

test('phonesMatch treats country-code and local formats as the same number', () => {
  assert.equal(phonesMatch('+8801712345678', '01712345678'), true);
  assert.equal(phonesMatch('+880 1712-345678', '01712345678'), true);
  assert.equal(phonesMatch('+8801712345678', '+8801812345678'), false);
  assert.equal(phonesMatch('01712345678', null), false);
});
