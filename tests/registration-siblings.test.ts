import assert from 'node:assert/strict';
import test from 'node:test';

import {
  clearError,
  clearSiblingErrors,
  collectPrivateFieldNames,
  parseSiblingFieldKey,
  removeSiblingAt,
  serializeSiblings,
  siblingFieldKey,
  validateSiblings,
} from '../src/lib/registration-siblings.ts';

const REQUIRED = 'This field is required.';

test('serializeSiblings stores sibling values under their bare field names', () => {
  const serialized = serializeSiblings([
    {
      siblingRelation: 'brother',
      siblingName: 'Rahim',
      siblingOccupation: 'Engineer',
      siblingMaritalStatus: 'married',
    },
  ]);

  assert.deepEqual(serialized, [
    {
      siblingRelation: 'brother',
      siblingName: 'Rahim',
      siblingOccupation: 'Engineer',
      siblingMaritalStatus: 'married',
    },
  ]);
  assert.equal(serialized[0].siblingName, 'Rahim');
  assert.ok(
    !Object.keys(serialized[0]).some(key => key.includes('-')),
    'stored sibling fields must not contain an index suffix',
  );
});

test('serializeSiblings drops indexed keys that leaked in from a broken form state', () => {
  const serialized = serializeSiblings([
    {
      'siblingName-0': 'Legacy',
      'siblingRelation-0': 'sister',
      siblingName: 'Rahim',
    },
  ]);

  assert.deepEqual(serialized, [{ siblingName: 'Rahim' }]);
});

test('serializeSiblings keeps an empty card as an empty object', () => {
  assert.deepEqual(serializeSiblings([{}, { siblingName: 'Rahim' }]), [{}, { siblingName: 'Rahim' }]);
});

test('serializeSiblings never mutates the input', () => {
  const input = [{ siblingName: 'Rahim' }];
  const snapshot = structuredClone(input);

  serializeSiblings(input);

  assert.deepEqual(input, snapshot);
});

test('validateSiblings reports the error on the indexed key of the offending card', () => {
  const errors = validateSiblings(
    [
      { siblingRelation: 'brother', siblingName: 'Rahim' },
      { siblingOccupation: 'Engineer' },
    ],
    REQUIRED,
  );

  assert.deepEqual(errors, { 'siblingName-1': REQUIRED });
});

test('validateSiblings accepts a fully empty card and a fully filled card', () => {
  assert.deepEqual(validateSiblings([{}, { siblingName: 'Rahim' }], REQUIRED), {});
});

test('validateSiblings treats a whitespace-only name as missing', () => {
  const errors = validateSiblings([{ siblingName: '   ', siblingOccupation: 'Engineer' }], REQUIRED);

  assert.deepEqual(errors, { 'siblingName-0': REQUIRED });
});

test('validateSiblings keys every card by its own index', () => {
  const errors = validateSiblings(
    [{ siblingOccupation: 'Engineer' }, { siblingOccupation: 'Doctor' }],
    REQUIRED,
  );

  assert.deepEqual(Object.keys(errors).sort(), ['siblingName-0', 'siblingName-1']);
});

test('removeSiblingAt removes the card and shifts the remaining cards down', () => {
  const siblings = [{ siblingName: 'A' }, { siblingName: 'B' }, { siblingName: 'C' }];

  assert.deepEqual(removeSiblingAt(siblings, 1), [{ siblingName: 'A' }, { siblingName: 'C' }]);
  assert.deepEqual(removeSiblingAt(siblings, 0), [{ siblingName: 'B' }, { siblingName: 'C' }]);
  assert.deepEqual(removeSiblingAt(siblings, 2), [{ siblingName: 'A' }, { siblingName: 'B' }]);
});

test('removeSiblingAt leaves the list untouched for an out-of-range index', () => {
  const siblings = [{ siblingName: 'A' }];

  assert.deepEqual(removeSiblingAt(siblings, 5), siblings);
});

test('clearSiblingErrors drops the indexed sibling keys and keeps the other errors', () => {
  const errors = {
    fullName: REQUIRED,
    'siblingName-0': REQUIRED,
    'siblingName-1': REQUIRED,
    phone: 'Enter a valid phone number.',
  };

  const cleared = clearSiblingErrors(errors);

  assert.deepEqual(cleared, {
    fullName: REQUIRED,
    phone: 'Enter a valid phone number.',
  });
});

test('clearSiblingErrors keeps the same object when there is nothing to clear', () => {
  const errors = { fullName: REQUIRED };

  assert.equal(clearSiblingErrors(errors), errors);
});

test('clearError clears one key and leaves the rest untouched', () => {
  const errors = { 'siblingName-0': REQUIRED, fullName: REQUIRED };

  assert.deepEqual(clearError(errors, 'siblingName-0'), { 'siblingName-0': '', fullName: REQUIRED });
  assert.equal(clearError(errors, 'missing-key'), errors);
});

test('siblingFieldKey builds the indexed UI key', () => {
  assert.equal(siblingFieldKey('siblingName', 2), 'siblingName-2');
});

test('parseSiblingFieldKey splits an indexed key back apart', () => {
  assert.deepEqual(parseSiblingFieldKey('siblingName-2'), { fieldName: 'siblingName', index: 2 });
  assert.equal(parseSiblingFieldKey('siblingName'), null);
  assert.equal(parseSiblingFieldKey('unknownField-2'), null);
  assert.equal(parseSiblingFieldKey('siblingName-x'), null);
});

test('collectPrivateFieldNames lists the sibling private fields per card index', () => {
  const names = collectPrivateFieldNames(2);

  assert.ok(names.includes('siblingName-0'));
  assert.ok(names.includes('siblingName-1'));
  assert.ok(!names.includes('siblingName-2'));
  assert.ok(!names.includes('siblingName'), 'the bare sibling name is not a private field key');
});

test('collectPrivateFieldNames keeps the non-sibling private fields', () => {
  const names = collectPrivateFieldNames(0);

  assert.ok(names.includes('phone'));
  assert.ok(names.includes('email'));
  assert.ok(names.includes('fatherName'));
  assert.ok(!names.includes('siblingName-0'));
});
