import { useEffect, useRef, useState, type JSX } from 'react';
import {
  registrationSections,
  memberFields,
  siblingFields,
  getRegistrationFieldLabel,
  getRegistrationValueLabel,
} from '@/lib/registration-copy';
import { useLanguage, type Language } from '@/lib/language';
import {
  getSignedUrl,
  editRegistrationNote,
  friendlyRegError,
  type RegistrationRow,
  type RegistrationStatus,
} from './registrations-service';
import { exportOneFull, exportOnePublic } from './export-csv';

export type ActionKey = 'approve' | 'reject' | 'ban' | 'delete' | 'edit';

const STATUS_STYLE: Record<RegistrationStatus, string> = {
  pending:  'bg-yellow-100 text-yellow-800 border-yellow-300',
  approved: 'bg-green-100  text-green-800  border-green-300',
  rejected: 'bg-red-100    text-red-800    border-red-300',
  banned:   'bg-gray-200   text-gray-700   border-gray-400',
  deleted:  'bg-red-200    text-red-900    border-red-400',
};

// ─── signed-URL document viewer ───────────────────────────────────────────────
function DocViewer({ path, label }: { path: string; label: string }) {
  const [url, setUrl]     = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(false);
    try {
      const signed = await getSignedUrl(path);
      setUrl(signed);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const isImage = /\.(jpe?g|png)$/i.test(path);

  return (
    <div className='rounded border border-border bg-muted/20 p-3'>
      <p className='mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide'>{label}</p>
      {!url && !loading && !error && (
        <button
          type='button'
          onClick={load}
          className='rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90'
        >
          Load (60 s link)
        </button>
      )}
      {loading && <p className='text-xs text-muted-foreground'>Generating signed URL…</p>}
      {error   && <p className='text-xs text-red-500'>Failed to load. <button type='button' onClick={load} className='underline'>Retry</button></p>}
      {url && (
        <div className='mt-2 space-y-2'>
          {isImage ? (
            <img src={url} alt={label} className='max-h-64 rounded border border-border object-contain' />
          ) : (
            <a href={url} target='_blank' rel='noreferrer' className='text-xs text-blue-600 underline'>
              Open PDF ↗
            </a>
          )}
          <p className='text-xs text-muted-foreground'>Link expires in ~60 s. <button type='button' onClick={load} className='underline'>Refresh</button></p>
        </div>
      )}
    </div>
  );
}

// ─── inline admin note editor ─────────────────────────────────────────────────
function AdminNoteEditor({
  regId,
  initial,
  onSaved,
}: {
  regId: string;
  initial: string | null;
  onSaved: (note: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue]     = useState(initial ?? '');
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await editRegistrationNote(regId, value);
      onSaved(value);
      setEditing(false);
    } catch (e) {
      setError(friendlyRegError(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className='rounded border border-border bg-muted/20 p-3'>
      <p className='mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground'>Admin Note</p>
      {editing ? (
        <>
          <textarea
            className='w-full rounded border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary'
            rows={3}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoFocus
          />
          {error && <p className='mt-1 text-xs text-red-500'>{error}</p>}
          <div className='mt-2 flex gap-2'>
            <button
              type='button' onClick={save} disabled={saving}
              className='rounded bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50'
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              type='button' onClick={() => { setEditing(false); setValue(initial ?? ''); }}
              className='rounded border border-border px-3 py-1 text-xs hover:bg-muted'
            >
              Cancel
            </button>
          </div>
        </>
      ) : (
        <div className='flex items-start justify-between gap-2'>
          <p className='text-sm text-foreground'>{value || <span className='italic text-muted-foreground'>No note</span>}</p>
          <button
            type='button' onClick={() => setEditing(true)}
            className='shrink-0 rounded border border-border px-2 py-0.5 text-xs hover:bg-muted'
          >
            Edit
          </button>
        </div>
      )}
    </div>
  );
}

// ─── overflow menu (Ban + Delete) ─────────────────────────────────────────────
function OverflowMenu({
  status,
  onAction,
}: {
  status: RegistrationStatus;
  onAction: (action: ActionKey) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const banAllowed    = ['pending','approved','rejected'].includes(status);
  const deleteAllowed = ['pending','approved','rejected','banned'].includes(status);

  return (
    <div className='relative' ref={ref}>
      <button
        type='button'
        onClick={() => setOpen((v) => !v)}
        className='rounded border border-border px-3 py-1.5 text-xs hover:bg-muted'
      >
        ⋯ More
      </button>
      {open && (
        <div className='absolute right-0 z-20 mt-1 w-40 rounded-lg border border-border bg-card shadow-lg'>
          <button
            type='button'
            disabled={!banAllowed}
            onClick={() => { setOpen(false); onAction('ban'); }}
            className='flex w-full items-center gap-2 px-3 py-2.5 text-xs font-medium text-gray-800 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-30'
          >
            🚫 Ban
          </button>
          <button
            type='button'
            disabled={!deleteAllowed}
            onClick={() => { setOpen(false); onAction('delete'); }}
            className='flex w-full items-center gap-2 px-3 py-2.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-30'
          >
            🗑 Delete
          </button>
        </div>
      )}
    </div>
  );
}

// ─── field / section renderers ────────────────────────────────────────────────
function renderField(language: Language, name: string, value: unknown): JSX.Element | null {
  if (value === undefined || value === null || value === '') return null;
  const label = getRegistrationFieldLabel(name, language);
  const display =
    typeof value === 'string' && ['yes','no','discuss'].includes(value)
      ? getRegistrationValueLabel(name, value, language)
      : String(value);
  return (
    <div key={name} className='grid grid-cols-2 gap-4 rounded border border-border/50 bg-muted/30 px-3 py-2'>
      <span className='text-xs font-medium text-muted-foreground'>{label}</span>
      <span className='break-words text-sm text-foreground'>{display}</span>
    </div>
  );
}

function renderSection(
  language: Language,
  title: string,
  fields: { name: string }[],
  formData: Record<string, unknown>
): JSX.Element | null {
  const rows = fields.map((f) => renderField(language, f.name, formData[f.name])).filter(Boolean);
  if (rows.length === 0) return null;
  return (
    <div>
      {title && (
        <h3 className='mb-2 mt-5 border-b border-border pb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
          {title}
        </h3>
      )}
      <div className='space-y-1.5'>{rows}</div>
    </div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────
interface RegistrationDetailsProps {
  registration: RegistrationRow;
  open: boolean;
  onClose: () => void;
  onAction?: (action: ActionKey) => void;
  onNoteUpdated?: (note: string) => void;
  eventCode?: string;
}

export function RegistrationDetails({
  registration,
  open,
  onClose,
  onAction,
  onNoteUpdated,
  eventCode = 'export',
}: RegistrationDetailsProps) {
  const { language } = useLanguage();
  if (!open) return null;

  const fd = (registration.form_data ?? {}) as Record<string, unknown>;

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center'>
      <div className='absolute inset-0 bg-black/50 backdrop-blur-sm' onClick={onClose} />
      <div
        className='relative flex w-full max-w-3xl flex-col max-h-[92vh] overflow-hidden rounded-xl border border-border bg-card shadow-2xl'
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── header ── */}
        <div className='flex items-start justify-between gap-4 border-b border-border px-6 py-4'>
          <div>
            <h2 className='text-base font-semibold text-foreground'>Registration Details</h2>
            <div className='mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground'>
              <span className={`rounded-full border px-2 py-0.5 font-medium ${STATUS_STYLE[registration.status]}`}>
                {registration.status}
              </span>
              {registration.candidate_code && (
                <span className='font-mono'>Code: {registration.candidate_code}</span>
              )}
              {registration.transaction_id && (
                <span className='font-mono'>Txn: {registration.transaction_id}</span>
              )}
              <span className='text-muted-foreground capitalize'>{registration.gender ?? ''}</span>
            </div>
          </div>
          <button type='button' onClick={onClose} className='rounded-md border border-border px-3 py-1 text-sm hover:bg-muted'>
            ✕
          </button>
        </div>

        {/* ── scrollable body ── */}
        <div className='flex-1 space-y-1 overflow-y-auto px-6 py-4'>
          {renderSection(language, 'Personal & contact',      registrationSections[0]?.fields ?? [], fd)}
          {renderSection(language, 'Family background',       registrationSections[1]?.fields ?? [], fd)}
          {renderSection(language, 'Preferences & lifestyle', registrationSections[2]?.fields ?? [], fd)}
          {renderSection(language, 'About yourself',          registrationSections[3]?.fields ?? [], fd)}
          {renderSection(language, 'Member details',          memberFields, fd)}

          {/* siblings */}
          {(() => {
            const siblings = (fd.siblings as unknown[]) ?? [];
            if (!siblings.length) return null;
            return (
              <div>
                <h3 className='mb-2 mt-5 border-b border-border pb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
                  Siblings
                </h3>
                {siblings.map((sib, idx) => (
                  <div key={idx} className='mb-2 rounded border border-border/50 bg-muted/20 p-3'>
                    <p className='mb-1.5 text-xs font-medium text-muted-foreground'>Sibling {idx + 1}</p>
                    <div className='space-y-1.5'>
                      {siblingFields.map((f) =>
                        renderField(language, f.name, (sib as Record<string, unknown>)[f.name])
                      )}
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* payment */}
          <div>
            <h3 className='mb-2 mt-5 border-b border-border pb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
              Payment
            </h3>
            <div className='space-y-1.5'>
              {renderField(language, 'paymentMethod', fd.paymentMethod)}
              {renderField(language, 'transactionId', fd.transactionId)}
              {renderField(language, 'senderNumber',  fd.senderNumber)}
            </div>
          </div>

          {/* documents — signed URLs */}
          <div>
            <h3 className='mb-2 mt-5 border-b border-border pb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
              Documents
            </h3>
            <div className='space-y-3'>
              {registration.photo_path
                ? <DocViewer path={registration.photo_path} label='Photo' />
                : <p className='text-xs text-muted-foreground'>No photo uploaded.</p>
              }
              {registration.id_card_path
                ? <DocViewer path={registration.id_card_path} label='ID Card' />
                : <p className='text-xs text-muted-foreground'>No ID card uploaded.</p>
              }
            </div>
          </div>

          {/* inline admin note */}
          <div className='mt-5'>
            <AdminNoteEditor
              regId={registration.id}
              initial={registration.admin_note}
              onSaved={(note) => onNoteUpdated?.(note)}
            />
          </div>
        </div>

        {/* ── action + export footer ── */}
        <div className='flex flex-wrap items-center gap-2 border-t border-border px-6 py-4'>
          {/* action buttons */}
          {onAction && registration.status === 'pending' && (
            <>
              <button
                type='button'
                onClick={() => onAction('approve')}
                className='rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700'
              >
                Approve
              </button>
              <button
                type='button'
                onClick={() => onAction('reject')}
                className='rounded-md bg-orange-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-600'
              >
                Reject
              </button>
            </>
          )}

          {/* export buttons */}
          <div className='ml-auto flex items-center gap-2'>
            <span className='text-xs text-muted-foreground'>Export:</span>
            <button
              type='button'
              onClick={() => exportOneFull(registration, eventCode)}
              className='rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted'
              title='Download all fields including private data'
            >
              📥 With Private
            </button>
            <button
              type='button'
              onClick={() => exportOnePublic(registration, eventCode)}
              className='rounded-md border border-green-300 bg-green-50 px-3 py-1.5 text-xs font-medium text-green-800 hover:bg-green-100'
              title='Download public fields only — safe to share'
            >
              📤 Public Only
            </button>
            {onAction && (
              <OverflowMenu status={registration.status} onAction={onAction} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
