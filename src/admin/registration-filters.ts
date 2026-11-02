import type { RegistrationRow } from './registrations-service';

export interface RegistrationListFilters {
  search: string;
  dateFrom: string;
  dateTo: string;
}

function localDateKey(value: string): string | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function filterRegistrationRows(
  rows: RegistrationRow[],
  filters: RegistrationListFilters,
): RegistrationRow[] {
  const term = filters.search.trim().toLocaleLowerCase();
  const digits = term.replace(/\D/g, '');

  return rows.filter((row) => {
    if (filters.dateFrom || filters.dateTo) {
      const date = localDateKey(row.created_at);
      if (!date || (filters.dateFrom && date < filters.dateFrom) || (filters.dateTo && date > filters.dateTo)) {
        return false;
      }
    }

    if (!term) return true;

    const formData = row.form_data ?? {};
    const searchableValues = [
      row.participant_name,
      formData.fullName,
      formData.memberName,
      formData.phone,
      formData.memberPhone,
      formData.email,
      formData.senderNumber,
      row.transaction_id,
      row.candidate_code,
    ].filter((value): value is string => typeof value === 'string');

    return searchableValues.some((value) => {
      if (value.toLocaleLowerCase().includes(term)) return true;
      return digits.length >= 4 && value.replace(/\D/g, '').includes(digits);
    });
  });
}
