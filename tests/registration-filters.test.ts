import assert from 'node:assert/strict';
import test from 'node:test';

import { filterRegistrationRows } from '../src/admin/registration-filters.ts';
import type { RegistrationRow } from '../src/admin/registrations-service.ts';

function registration(overrides: Partial<RegistrationRow> = {}): RegistrationRow {
  return {
    id: 'registration-1',
    event_id: 'event-1',
    status: 'pending',
    gender: 'woman',
    candidate_code: 'F102',
    transaction_id: 'TXN-abc',
    admin_note: null,
    created_at: '2026-11-01T12:30:00',
    deleted_at: null,
    photo_path: null,
    id_card_path: null,
    participant_name: 'Ayesha Rahman',
    form_data: {
      fullName: 'Ayesha Rahman',
      memberName: 'Samira Rahman',
      phone: '+8801712345678',
      memberPhone: '01812345678',
      email: 'ayesha@example.com',
      senderNumber: '01712345678',
    },
    ...overrides,
  };
}

test('registration search trims and matches participant names and email case-insensitively', () => {
  const rows = [
    registration(),
    registration({
      id: 'registration-2',
      participant_name: 'Nadia',
      form_data: { fullName: 'Nadia', email: 'nadia@example.com' },
    }),
  ];

  assert.deepEqual(
    filterRegistrationRows(rows, { search: '  AYESHA  ', dateFrom: '', dateTo: '' }).map((row) => row.id),
    ['registration-1'],
  );
  assert.deepEqual(
    filterRegistrationRows(rows, { search: 'AYESHA@EXAMPLE.COM', dateFrom: '', dateTo: '' }).map((row) => row.id),
    ['registration-1'],
  );
});

test('registration search finds family names and phone numbers independent of formatting', () => {
  const row = registration();

  assert.deepEqual(
    filterRegistrationRows([row], { search: 'Samira', dateFrom: '', dateTo: '' }).map((item) => item.id),
    ['registration-1'],
  );
  assert.deepEqual(
    filterRegistrationRows([row], { search: '8801712345678', dateFrom: '', dateTo: '' }).map((item) => item.id),
    ['registration-1'],
  );
});

test('registration date range is inclusive and excludes invalid or out-of-range dates', () => {
  const rows = [
    registration({ id: 'start', created_at: '2026-10-31T23:59:59' }),
    registration({ id: 'inside', created_at: '2026-11-01T12:30:00' }),
    registration({ id: 'end', created_at: '2026-11-02T00:00:00' }),
    registration({ id: 'invalid', created_at: 'not-a-date' }),
  ];

  assert.deepEqual(
    filterRegistrationRows(rows, { search: '', dateFrom: '2026-11-01', dateTo: '2026-11-02' }).map((row) => row.id),
    ['inside', 'end'],
  );
});
