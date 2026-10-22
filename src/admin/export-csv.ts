import {
  registrationSections,
  memberFields,
  siblingFields,
  getRegistrationValueLabel,
  type RegistrationFieldDefinition,
} from '@/lib/registration-copy';
import type { RegistrationRow } from './registrations-service';

// ─── private field names (badge === 'PRIVATE') ────────────────────────────────
const ALL_FIELDS: RegistrationFieldDefinition[] = [
  ...registrationSections.flatMap((s) => s.fields),
  ...memberFields,
];

const PRIVATE_FIELD_NAMES = new Set(
  ALL_FIELDS.filter((f) => f.badge === 'PRIVATE').map((f) => f.name)
);

// payment fields are always private (admin-only)
const PAYMENT_FIELDS = ['paymentMethod', 'transactionId', 'senderNumber'];
PAYMENT_FIELDS.forEach((f) => PRIVATE_FIELD_NAMES.add(f));

// ─── ordered column list ──────────────────────────────────────────────────────
// System columns first, then every form field in section order, then siblings.
const SYSTEM_COLS = [
  { key: 'candidate_code', label: 'Candidate Code' },
  { key: 'status',         label: 'Status' },
  { key: 'gender',         label: 'Gender' },
  { key: 'created_at',     label: 'Registered At' },
  { key: 'admin_note',     label: 'Admin Note' },
];

const FORM_COLS = ALL_FIELDS.map((f) => ({
  key: f.name,
  label: f.label.en,
  isPrivate: f.badge === 'PRIVATE',
}));

// ─── helpers ──────────────────────────────────────────────────────────────────
function escape(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = String(v).replace(/"/g, '""');
  return /[",\n\r]/.test(s) ? `"${s}"` : s;
}

function resolveValue(fieldName: string, raw: unknown): string {
  if (raw === null || raw === undefined || raw === '') return '';
  // resolve select option labels to English display text
  const display = getRegistrationValueLabel(fieldName, String(raw), 'en');
  return display;
}

function flattenSiblings(siblings: unknown[]): Record<string, string> {
  const out: Record<string, string> = {};
  siblings.forEach((sib, idx) => {
    const s = sib as Record<string, unknown>;
    siblingFields.forEach((f) => {
      const col = `Sibling ${idx + 1} — ${f.label.en}`;
      out[col] = resolveValue(f.name, s[f.name]);
    });
  });
  return out;
}

// ─── build one CSV row object ─────────────────────────────────────────────────
function buildRow(
  reg: RegistrationRow,
  includePrivate: boolean
): Record<string, string> {
  const fd = (reg.form_data ?? {}) as Record<string, unknown>;
  const row: Record<string, string> = {};

  // system columns
  for (const col of SYSTEM_COLS) {
    const v = reg[col.key as keyof RegistrationRow];
    row[col.label] =
      col.key === 'created_at' && v
        ? new Date(v as string).toLocaleString('en-GB')
        : escape(v);
  }

  // form columns
  for (const col of FORM_COLS) {
    if (!includePrivate && col.isPrivate) continue;
    row[col.label] = resolveValue(col.key, fd[col.key]);
  }

  // payment (always private)
  if (includePrivate) {
    row['Payment Method'] = escape(fd.paymentMethod);
    row['Transaction ID'] = escape(fd.transactionId);
    row['Sender Number']  = escape(fd.senderNumber);
  }

  // siblings (flatten)
  const siblings = Array.isArray(fd.siblings) ? fd.siblings : [];
  const sibCols = flattenSiblings(siblings);
  for (const [k, v] of Object.entries(sibCols)) {
    // sibling names are private
    if (!includePrivate && k.includes('Name')) continue;
    row[k] = v;
  }

  return row;
}

// ─── build CSV string from rows ───────────────────────────────────────────────
function toCsv(rows: Record<string, string>[]): string {
  if (rows.length === 0) return '';
  // union of all keys (preserves insertion order)
  const headers = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
  const lines = [
    headers.map(escape).join(','),
    ...rows.map((r) => headers.map((h) => escape(r[h] ?? '')).join(',')),
  ];
  return lines.join('\r\n');
}

// ─── trigger browser download ─────────────────────────────────────────────────
function download(csv: string, filename: string) {
  // BOM so Excel opens UTF-8 correctly
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── public API ───────────────────────────────────────────────────────────────

/** Export ALL registrations (full data including private fields). */
export function exportAllFull(regs: RegistrationRow[], eventCode = 'export') {
  const rows = regs.map((r) => buildRow(r, true));
  download(toCsv(rows), `${eventCode}_all_full_${datestamp()}.csv`);
}

/** Export a single registration with ALL fields (including private). */
export function exportOneFull(reg: RegistrationRow, eventCode = 'export') {
  const row = buildRow(reg, true);
  download(toCsv([row]), `${eventCode}_${slug(reg)}_full_${datestamp()}.csv`);
}

/** Export a single registration WITHOUT private fields. */
export function exportOnePublic(reg: RegistrationRow, eventCode = 'export') {
  const row = buildRow(reg, false);
  download(toCsv([row]), `${eventCode}_${slug(reg)}_public_${datestamp()}.csv`);
}

function datestamp() {
  return new Date().toISOString().slice(0, 10);
}

function slug(reg: RegistrationRow) {
  const fd = reg.form_data as Record<string, unknown> | undefined;
  const name = (typeof fd?.fullName === 'string' ? fd.fullName : reg.candidate_code ?? reg.id.slice(0, 8))
    .replace(/\s+/g, '_').replace(/[^\w-]/g, '');
  return name;
}
