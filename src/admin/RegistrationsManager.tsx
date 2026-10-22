import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  listRegistrations,
  approveRegistration,
  rejectRegistration,
  banRegistration,
  deleteRegistration,
  editRegistrationNote,
  friendlyRegError,
  type RegistrationRow,
  type RegistrationStatus,
} from './registrations-service';
import { listEvents } from './events-service';
import type { AdminEvent } from './events-service';
import { RegistrationDetails } from './RegistrationDetails';
import { exportAllFull } from './export-csv';

const PAGE_SIZE = 25;

const STATUS_STYLE: Record<RegistrationStatus, string> = {
  pending:  'bg-yellow-100 text-yellow-800 border-yellow-300',
  approved: 'bg-green-100  text-green-800  border-green-300',
  rejected: 'bg-red-100    text-red-800    border-red-300',
  banned:   'bg-gray-200   text-gray-700   border-gray-400',
  deleted:  'bg-red-200    text-red-900    border-red-400',
};

type ActionKey = 'approve' | 'reject' | 'ban' | 'delete' | 'edit';

interface ActionConfig {
  label: string;
  needsReason: boolean;
  reasonLabel: string;
  confirmText: (name: string) => string;
  allowed: RegistrationStatus[];
  overflow?: boolean;
}

const ACTIONS: Record<ActionKey, ActionConfig> = {
  approve: {
    label: 'Approve',
    needsReason: false,
    reasonLabel: 'Note (optional)',
    confirmText: (n) => `Approve registration for ${n}?`,
    allowed: ['pending'],
  },
  reject: {
    label: 'Reject',
    needsReason: true,
    reasonLabel: 'Reason for rejection',
    confirmText: (n) => `Reject registration for ${n}?`,
    allowed: ['pending'],
  },
  edit: {
    label: 'Edit Note',
    needsReason: false,
    reasonLabel: 'Admin note',
    confirmText: (n) => `Update admin note for ${n}?`,
    allowed: ['pending', 'approved', 'rejected', 'banned'],
  },
  ban: {
    label: 'Ban',
    needsReason: true,
    reasonLabel: 'Reason for ban',
    confirmText: (n) => `Ban ${n}? Their slot will NOT be freed.`,
    allowed: ['pending', 'approved', 'rejected'],
    overflow: true,
  },
  delete: {
    label: 'Delete',
    needsReason: true,
    reasonLabel: 'Reason for deletion',
    confirmText: (n) => `Delete registration for ${n}? Their slot WILL be freed (−1 participant).`,
    allowed: ['pending', 'approved', 'rejected', 'banned'],
    overflow: true,
  },
};

// ─── overflow (⋯) menu ────────────────────────────────────────────────────────
function OverflowMenu({
  reg,
  onAction,
}: {
  reg: RegistrationRow;
  onAction: (reg: RegistrationRow, action: ActionKey) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className='relative' ref={ref}>
      <button
        type='button'
        onClick={() => setOpen((v) => !v)}
        className='flex items-center rounded border border-border px-2 py-1 text-xs hover:bg-muted'
        aria-label='More actions'
      >
        <span className='icon' style={{ fontSize: 16 }}>more_horiz</span>
      </button>
      {open && (
        <div className='absolute right-0 z-20 mt-1 w-40 rounded-lg border border-border bg-card shadow-lg'>
          <button
            type='button'
            disabled={!ACTIONS.ban.allowed.includes(reg.status)}
            onClick={() => { setOpen(false); onAction(reg, 'ban'); }}
            className='flex w-full items-center gap-2 px-3 py-2.5 text-xs font-medium text-gray-800 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-30'
          >
            <span className='icon' style={{ fontSize: 16 }}>block</span> Ban
          </button>
          <button
            type='button'
            disabled={!ACTIONS.delete.allowed.includes(reg.status)}
            onClick={() => { setOpen(false); onAction(reg, 'delete'); }}
            className='flex w-full items-center gap-2 px-3 py-2.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-30'
          >
            <span className='icon' style={{ fontSize: 16 }}>delete</span> Delete
          </button>
        </div>
      )}
    </div>
  );
}

// ─── confirm modal ────────────────────────────────────────────────────────────
function ConfirmModal({
  action, name, onConfirm, onCancel, busy,
}: {
  action: ActionKey; name: string;
  onConfirm: (reason: string) => void; onCancel: () => void; busy: boolean;
}) {
  const cfg = ACTIONS[action];
  const [reason, setReason] = useState('');
  const invalid = cfg.needsReason && !reason.trim();

  const confirmBtnClass =
    action === 'delete' ? 'bg-red-600 hover:bg-red-700'
    : action === 'ban'  ? 'bg-gray-700 hover:bg-gray-800'
    : action === 'reject' ? 'bg-orange-500 hover:bg-orange-600'
    : 'bg-green-600 hover:bg-green-700';

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center'>
      <div className='absolute inset-0 bg-black/50 backdrop-blur-sm' onClick={onCancel} />
      <div className='relative w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl'>
        <h3 className='mb-1 text-base font-semibold'>{cfg.label} Registration</h3>
        <p className='mb-4 text-sm text-muted-foreground'>{cfg.confirmText(name)}</p>
        <label className='mb-1 block text-xs font-medium text-muted-foreground'>{cfg.reasonLabel}</label>
        <textarea
          className='w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary'
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={cfg.needsReason ? 'Required…' : 'Optional…'}
          autoFocus
        />
        {invalid && <p className='mt-1 text-xs text-red-500'>A reason is required.</p>}
        <div className='mt-5 flex justify-end gap-3'>
          <button
            type='button' onClick={onCancel} disabled={busy}
            className='rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50'
          >
            Cancel
          </button>
          <button
            type='button' disabled={busy || invalid} onClick={() => onConfirm(reason)}
            className={`rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-50 ${confirmBtnClass}`}
          >
            {busy ? 'Processing…' : `Confirm ${cfg.label}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── toast ────────────────────────────────────────────────────────────────────
function Toast({ message, ok }: { message: string; ok: boolean }) {
  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium shadow-lg ${ok ? 'border-green-300 bg-green-50 text-green-800' : 'border-red-300 bg-red-50 text-red-800'}`}>
      <span className='icon icon-filled' style={{ fontSize: 16 }}>{ok ? 'check_circle' : 'error'}</span>
      {message}
    </div>
  );
}

// ─── counts bar ───────────────────────────────────────────────────────────────
function CountsBar({ rows }: { rows: RegistrationRow[] }) {
  const statuses: RegistrationStatus[] = ['pending', 'approved', 'rejected', 'banned', 'deleted'];
  const counts = statuses.map((s) => ({ s, n: rows.filter((r) => r.status === s).length }));
  const men   = rows.filter((r) => r.gender === 'man').length;
  const women = rows.filter((r) => r.gender === 'woman').length;
  const other = rows.length - men - women;

  return (
    <div className='flex flex-wrap gap-2 rounded-lg border border-border bg-muted/30 px-4 py-3 text-xs'>
      <span className='mr-1 font-semibold text-foreground'>Status:</span>
      {counts.map(({ s, n }) => (
        <span key={s} className={`rounded-full border px-2 py-0.5 font-medium ${STATUS_STYLE[s]}`}>
          {s} {n}
        </span>
      ))}
      <span className='ml-4 font-semibold text-foreground'>Gender:</span>
      <span className='rounded-full border border-blue-300 bg-blue-50 px-2 py-0.5 text-blue-800'>♂ {men}</span>
      <span className='rounded-full border border-pink-300 bg-pink-50 px-2 py-0.5 text-pink-800'>♀ {women}</span>
      {other > 0 && <span className='rounded-full border border-gray-300 bg-gray-50 px-2 py-0.5 text-gray-700'>other {other}</span>}
      <span className='ml-auto text-muted-foreground'>Total: {rows.length}</span>
    </div>
  );
}

// ─── main ─────────────────────────────────────────────────────────────────────
export default function RegistrationsManager() {
  const [allRows, setAllRows]               = useState<RegistrationRow[]>([]);
  const [events, setEvents]                 = useState<AdminEvent[]>([]);
  const [selectedEvent, setSelectedEvent]   = useState<string | undefined>(undefined);
  const [selectedStatus, setSelectedStatus] = useState<RegistrationStatus | undefined>(undefined);
  const [selectedGender, setSelectedGender] = useState<string | undefined>(undefined);
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>(undefined);
  const [search, setSearch]     = useState('');
  const [page, setPage]         = useState(1);
  const [detailReg, setDetailReg] = useState<RegistrationRow | null>(null);
  const [loading, setLoading]   = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [modal, setModal]       = useState<{ reg: RegistrationRow; action: ActionKey } | null>(null);
  const [modalBusy, setModalBusy] = useState(false);
  const [toast, setToast]       = useState<{ message: string; ok: boolean } | null>(null);

  const showToast = (message: string, ok: boolean) => {
    setToast({ message, ok });
    setTimeout(() => setToast(null), 3500);
  };

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [rows, evts] = await Promise.all([
        listRegistrations({
          event_id: selectedEvent,
          status: selectedStatus,
          gender: selectedGender,
          category: selectedCategory,
        }),
        listEvents(),
      ]);
      setEvents(evts);
      setAllRows(rows.map((r) => {
        const fd = r.form_data as Record<string, unknown> | undefined;
        const participant_name =
          typeof fd?.fullName === 'string' && fd.fullName ? fd.fullName
          : typeof fd?.memberName === 'string' && fd.memberName ? fd.memberName
          : undefined;
        return { ...r, participant_name };
      }));
      setPage(1);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err));
      setAllRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [selectedEvent, selectedStatus, selectedGender, selectedCategory]);
  useEffect(() => { setPage(1); }, [search]);

  const filtered = search.trim()
    ? allRows.filter((r) => {
        const fd = r.form_data as Record<string, unknown> | undefined;
        const phone = (typeof fd?.phone === 'string' ? fd.phone : '') +
                      (typeof fd?.memberPhone === 'string' ? fd.memberPhone : '');
        const term = search.toLowerCase();
        return (
          r.participant_name?.toLowerCase().includes(term) ||
          phone.toLowerCase().includes(term) ||
          r.transaction_id?.toLowerCase().includes(term) ||
          (r.candidate_code ?? '').toLowerCase().includes(term)
        );
      })
    : allRows;

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows   = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleAction = (reg: RegistrationRow, action: ActionKey) => {
    setModal({ reg, action });
  };

  const handleConfirm = async (reason: string) => {
    if (!modal) return;
    setModalBusy(true);
    try {
      const { reg, action } = modal;
      if (action === 'approve') await approveRegistration(reg.id);
      else if (action === 'reject') await rejectRegistration(reg.id, reason);
      else if (action === 'ban')    await banRegistration(reg.id, reason);
      else if (action === 'delete') await deleteRegistration(reg.id, reason);
      else if (action === 'edit')   await editRegistrationNote(reg.id, reason);

      setModal(null);

      // Optimistic update — remove deleted rows immediately; update status for others.
      if (action === 'delete') {
        setAllRows((prev) => prev.filter((r) => r.id !== reg.id));
        if (detailReg?.id === reg.id) setDetailReg(null);
      } else if (action === 'ban') {
        setAllRows((prev) => prev.map((r) => r.id === reg.id ? { ...r, status: 'banned' as RegistrationStatus } : r));
      } else if (action === 'approve') {
        // reload to get the assigned candidate_code from the RPC
        void load();
      } else if (action === 'reject') {
        setAllRows((prev) => prev.map((r) => r.id === reg.id ? { ...r, status: 'rejected' as RegistrationStatus, admin_note: reason || r.admin_note } : r));
      } else if (action === 'edit') {
        setAllRows((prev) => prev.map((r) => r.id === reg.id ? { ...r, admin_note: reason } : r));
      }

      showToast(
        action === 'edit' ? 'Note updated.' : `Registration ${action}d successfully.`,
        true,
      );
    } catch (err) {
      showToast(friendlyRegError(err), false);
    } finally {
      setModalBusy(false);
    }
  };

  const eventLabel = (id: string) =>
    events.find((e) => e.id === id)?.event_code ?? id.slice(0, 8);

  const sel = 'rounded-md border border-border bg-card px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary';

  return (
    <div className='admin-shell min-h-screen bg-background text-foreground'>

      {/* ── page header ── */}
      <header className='flex items-center justify-between gap-4 border-b border-border bg-card px-6 py-4'>
        <div className='flex items-center gap-3'>
          <Link
            to={import.meta.env.VITE_ADMIN_PATH || '/nbn-admin'}
            className='flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground'
          >
            <span className='icon' style={{ fontSize: 16 }}>arrow_back</span>
            Dashboard
          </Link>
          <span className='text-muted-foreground/40'>|</span>
          <h1 className='text-sm font-semibold tracking-tight'>Registrations</h1>
        </div>
        <span
          className='rounded-full px-2.5 py-0.5 text-xs font-semibold'
          style={{ background: 'hsl(339 79% 53%)', color: '#fff' }}
        >
          {filtered.length} total
        </span>
      </header>

      <div className='space-y-4 p-4 sm:p-6 lg:p-8'>

        {/* ── filters row ── */}
        <div className='flex flex-wrap items-center gap-2'>
          <select value={selectedEvent ?? ''} onChange={(e) => setSelectedEvent(e.target.value || undefined)} className={sel}>
            <option value=''>All events</option>
            {events.map((e) => <option key={e.id} value={e.id}>{e.event_code} — {e.date}</option>)}
          </select>

          <select value={selectedStatus ?? ''} onChange={(e) => setSelectedStatus((e.target.value as RegistrationStatus) || undefined)} className={sel}>
            <option value=''>All statuses</option>
            {(['pending','approved','rejected','banned','deleted'] as RegistrationStatus[]).map((s) => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>

          <select value={selectedGender ?? ''} onChange={(e) => setSelectedGender(e.target.value || undefined)} className={sel}>
            <option value=''>All genders</option>
            <option value='man'>Man</option>
            <option value='woman'>Woman</option>
            <option value='other'>Other</option>
          </select>

          <select value={selectedCategory ?? ''} onChange={(e) => setSelectedCategory(e.target.value || undefined)} className={sel}>
            <option value=''>All categories</option>
            <option value='self'>Self</option>
            <option value='family'>Family member</option>
          </select>

          <input
            type='text'
            placeholder='Search name / phone / txn ID / code…'
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`min-w-48 flex-1 ${sel}`}
          />

          <button
            type='button'
            onClick={() => void load()}
            className='flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-sm shadow-sm hover:bg-muted'
          >
            <span className='icon' style={{ fontSize: 16 }}>refresh</span>
            Refresh
          </button>

          {allRows.length > 0 && (
            <button
              type='button'
              onClick={() => {
                const code = selectedEvent ? (events.find((e) => e.id === selectedEvent)?.event_code ?? 'export') : 'all';
                exportAllFull(filtered, code);
              }}
              className='flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium shadow-sm hover:bg-muted'
              title='Export all visible registrations including private fields'
            >
              <span className='icon' style={{ fontSize: 16 }}>download</span>
              Export All ({filtered.length})
            </button>
          )}
        </div>

        {/* ── body ── */}
        {loading ? (
          <p className='text-sm text-muted-foreground'>Loading registrations…</p>
        ) : loadError ? (
          <div className='rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive'>
            <p role='alert'>Failed to load: {loadError}</p>
            <button type='button' onClick={() => void load()} className='mt-2 underline text-xs'>Retry</button>
          </div>
        ) : (
          <>
            <CountsBar rows={filtered} />

            <div className='overflow-x-auto rounded-lg border border-border'>
              <table className='w-full text-sm'>
                <thead className='bg-muted/50'>
                  <tr>
                    {['ID','Event','Participant','Phone','Gender','Status','Txn ID','Date','Actions'].map((h) => (
                      <th key={h} className='whitespace-nowrap px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground'>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((reg) => {
                    const fd = reg.form_data as Record<string, unknown> | undefined;
                    const phone = (typeof fd?.phone === 'string' && fd.phone) ||
                                  (typeof fd?.memberPhone === 'string' && fd.memberPhone) || '—';
                    return (
                      <tr key={reg.id} className='border-t border-border transition-colors hover:bg-muted/30'>
                        <td className='px-3 py-2.5'>
                          {reg.candidate_code ? (
                            <span className={`inline-block rounded-md border px-2 py-0.5 font-mono text-xs font-bold ${
                              reg.candidate_code.startsWith('M')
                                ? 'border-blue-300 bg-blue-50 text-blue-800'
                                : 'border-pink-300 bg-pink-50 text-pink-800'
                            }`}>
                              {reg.candidate_code}
                            </span>
                          ) : (
                            <span className='text-xs text-muted-foreground'>—</span>
                          )}
                        </td>
                        <td className='px-3 py-2.5 font-mono text-xs'>{eventLabel(reg.event_id)}</td>
                        <td className='px-3 py-2.5 font-medium'>{reg.participant_name || '—'}</td>
                        <td className='px-3 py-2.5 text-muted-foreground'>{phone}</td>
                        <td className='px-3 py-2.5 capitalize'>{reg.gender || '—'}</td>
                        <td className='px-3 py-2.5'>
                          <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[reg.status]}`}>
                            {reg.status}
                          </span>
                        </td>
                        <td className='px-3 py-2.5 font-mono text-xs'>{reg.transaction_id || '—'}</td>
                        <td className='whitespace-nowrap px-3 py-2.5 text-xs text-muted-foreground'>
                          {reg.created_at ? new Date(reg.created_at).toLocaleDateString() : '—'}
                        </td>
                        <td className='px-3 py-2.5'>
                          <div className='flex items-center gap-1'>
                            <button
                              type='button'
                              onClick={() => setDetailReg(reg)}
                              className='flex items-center gap-1 rounded border border-border px-2 py-1 text-xs hover:bg-muted'
                            >
                              <span className='icon' style={{ fontSize: 15 }}>visibility</span>
                              View
                            </button>
                            {reg.status === 'pending' && (
                              <button
                                type='button'
                                onClick={() => handleAction(reg, 'approve')}
                                className='flex items-center gap-1 rounded bg-green-600 px-2 py-1 text-xs font-medium text-white hover:bg-green-700'
                              >
                                <span className='icon' style={{ fontSize: 15 }}>check</span>
                                Approve
                              </button>
                            )}
                            {reg.status === 'pending' && (
                              <button
                                type='button'
                                onClick={() => handleAction(reg, 'reject')}
                                className='flex items-center gap-1 rounded bg-orange-500 px-2 py-1 text-xs font-medium text-white hover:bg-orange-600'
                              >
                                <span className='icon' style={{ fontSize: 15 }}>close</span>
                                Reject
                              </button>
                            )}
                            {ACTIONS.edit.allowed.includes(reg.status) && (
                              <button
                                type='button'
                                onClick={() => handleAction(reg, 'edit')}
                                className='flex items-center gap-1 rounded border border-border px-2 py-1 text-xs hover:bg-muted'
                              >
                                <span className='icon' style={{ fontSize: 15 }}>edit_note</span>
                                Note
                              </button>
                            )}
                            <OverflowMenu reg={reg} onAction={handleAction} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {pageRows.length === 0 && (
                    <tr>
                      <td colSpan={9} className='px-3 py-8 text-center text-muted-foreground'>
                        No registrations found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className='flex items-center justify-between text-sm'>
                <span className='text-xs text-muted-foreground'>
                  Page {page} of {totalPages} · {filtered.length} total
                </span>
                <div className='flex gap-2'>
                  <button
                    type='button'
                    disabled={page === 1}
                    onClick={() => setPage((p) => p - 1)}
                    className='flex items-center gap-1 rounded border border-border px-3 py-1.5 text-xs hover:bg-muted disabled:opacity-40'
                  >
                    <span className='icon' style={{ fontSize: 15 }}>chevron_left</span> Prev
                  </button>
                  {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                    const p = totalPages <= 7 ? i + 1 : page <= 4 ? i + 1 : page + i - 3;
                    if (p < 1 || p > totalPages) return null;
                    return (
                      <button
                        key={p}
                        type='button'
                        onClick={() => setPage(p)}
                        className={`rounded border px-3 py-1.5 text-xs ${p === page ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-muted'}`}
                      >
                        {p}
                      </button>
                    );
                  })}
                  <button
                    type='button'
                    disabled={page === totalPages}
                    onClick={() => setPage((p) => p + 1)}
                    className='flex items-center gap-1 rounded border border-border px-3 py-1.5 text-xs hover:bg-muted disabled:opacity-40'
                  >
                    Next <span className='icon' style={{ fontSize: 15 }}>chevron_right</span>
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {detailReg && (
          <RegistrationDetails
            registration={detailReg}
            open
            onClose={() => setDetailReg(null)}
            onAction={(action) => { setDetailReg(null); setModal({ reg: detailReg, action }); }}
            onNoteUpdated={(note) => {
              setAllRows((prev) => prev.map((r) => r.id === detailReg.id ? { ...r, admin_note: note } : r));
            }}
            eventCode={selectedEvent ? (events.find((e) => e.id === selectedEvent)?.event_code ?? 'export') : 'export'}
          />
        )}

        {modal && (
          <ConfirmModal
            action={modal.action}
            name={modal.reg.participant_name ?? 'this registration'}
            onConfirm={handleConfirm}
            onCancel={() => setModal(null)}
            busy={modalBusy}
          />
        )}

        {toast && <Toast message={toast.message} ok={toast.ok} />}
      </div>
    </div>
  );
}
