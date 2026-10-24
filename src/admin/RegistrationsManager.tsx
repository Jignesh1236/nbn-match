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
  pending:  'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-700',
  approved: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-700',
  rejected: 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-700',
  banned:   'bg-zinc-200 text-zinc-700 border-zinc-400 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-600',
  deleted:  'bg-red-200 text-red-900 border-red-400 dark:bg-red-950/60 dark:text-red-300 dark:border-red-700',
};

const STATUS_DOT: Record<RegistrationStatus, string> = {
  pending:  'bg-amber-500',
  approved: 'bg-emerald-500',
  rejected: 'bg-rose-500',
  banned:   'bg-zinc-500',
  deleted:  'bg-red-700',
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
        className='flex items-center justify-center rounded-lg border border-border p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground'
        aria-label='More actions'
      >
        <span className='icon' style={{ fontSize: 18 }}>more_horiz</span>
      </button>
      {open && (
        <div className='absolute right-0 z-20 mt-1 w-44 rounded-xl border border-border bg-card p-1 shadow-lg'>
          <button
            type='button'
            disabled={!ACTIONS.ban.allowed.includes(reg.status)}
            onClick={() => { setOpen(false); onAction(reg, 'ban'); }}
            className='flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-30'
          >
            <span className='icon text-amber-500' style={{ fontSize: 16 }}>block</span> Ban Participant
          </button>
          <button
            type='button'
            disabled={!ACTIONS.delete.allowed.includes(reg.status)}
            onClick={() => { setOpen(false); onAction(reg, 'delete'); }}
            className='flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-30'
          >
            <span className='icon' style={{ fontSize: 16 }}>delete</span> Delete Record
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
    action === 'delete' ? 'bg-destructive text-destructive-foreground hover:opacity-90'
    : action === 'ban'  ? 'bg-zinc-700 text-white hover:bg-zinc-800'
    : action === 'reject' ? 'bg-amber-600 text-white hover:bg-amber-700'
    : 'bg-emerald-600 text-white hover:bg-emerald-700';

  return (
    <div className='fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4'>
      <div className='fixed inset-0 bg-black/60 backdrop-blur-xs' onClick={onCancel} />
      <div className='relative w-full max-w-lg rounded-t-2xl border border-border bg-card p-5 shadow-2xl sm:rounded-2xl sm:p-6'>
        <div className='mb-4 flex items-center justify-between'>
          <h3 className='text-base font-semibold'>{cfg.label} Registration</h3>
          <button
            type='button'
            onClick={onCancel}
            className='rounded-lg p-1 text-muted-foreground hover:bg-muted'
          >
            <span className='icon' style={{ fontSize: 18 }}>close</span>
          </button>
        </div>
        <p className='mb-4 text-sm text-muted-foreground'>{cfg.confirmText(name)}</p>
        <label className='mb-1.5 block text-xs font-medium text-muted-foreground'>{cfg.reasonLabel}</label>
        <textarea
          className='w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-xs focus:outline-none focus:ring-2 focus:ring-primary'
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={cfg.needsReason ? 'Required reason…' : 'Optional note…'}
          autoFocus
        />
        {invalid && <p className='mt-1 text-xs text-destructive'>A reason is required.</p>}
        <div className='mt-5 flex items-center justify-end gap-2.5'>
          <button
            type='button' onClick={onCancel} disabled={busy}
            className='rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50'
          >
            Cancel
          </button>
          <button
            type='button' disabled={busy || invalid} onClick={() => onConfirm(reason)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold shadow-xs disabled:opacity-50 ${confirmBtnClass}`}
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
    <div className={`fixed bottom-6 left-1/2 z-50 -translate-x-1/2 flex items-center gap-2 rounded-full border px-5 py-2.5 text-sm font-medium shadow-xl sm:left-auto sm:right-6 sm:translate-x-0 sm:rounded-xl ${ok ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-700' : 'border-rose-300 bg-rose-50 text-rose-800 dark:bg-rose-950 dark:text-rose-200 dark:border-rose-700'}`}>
      <span className='icon icon-filled' style={{ fontSize: 18 }}>{ok ? 'check_circle' : 'error'}</span>
      {message}
    </div>
  );
}

// ─── counts bar ───────────────────────────────────────────────────────────────
function CountsBar({ rows }: { rows: RegistrationRow[] }) {
  const statuses: RegistrationStatus[] = ['pending', 'approved', 'rejected', 'banned', 'deleted'];
  const counts = statuses.map((s) => ({ s, n: rows.filter((r) => r.status === s).length })).filter(({ n }) => n > 0);
  const men   = rows.filter((r) => r.gender === 'man').length;
  const women = rows.filter((r) => r.gender === 'woman').length;
  const other = rows.length - men - women;

  return (
    <div className='rounded-xl border border-border bg-card p-3 sm:p-4 shadow-xs'>
      <div className='flex flex-wrap items-center justify-between gap-3 text-xs'>
        {/* status counts */}
        <div className='flex flex-wrap items-center gap-1.5 sm:gap-2'>
          <span className='mr-1 font-semibold uppercase tracking-wider text-muted-foreground'>Status:</span>
          {counts.map(({ s, n }) => (
            <span key={s} className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLE[s]}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[s]}`} />
              <span className='capitalize'>{s}</span>
              <span className='ml-0.5 rounded-full bg-background/50 px-1 text-[10px]'>{n}</span>
            </span>
          ))}
        </div>

        {/* gender & total */}
        <div className='flex flex-wrap items-center gap-2'>
          <span className='font-semibold uppercase tracking-wider text-muted-foreground'>Gender:</span>
          <span className='inline-flex items-center gap-1 rounded-full border border-sky-300 bg-sky-50 px-2.5 py-0.5 text-sky-800 font-medium dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-700'>
            ♂ Man {men}
          </span>
          <span className='inline-flex items-center gap-1 rounded-full border border-pink-300 bg-pink-50 px-2.5 py-0.5 text-pink-800 font-medium dark:bg-pink-950/40 dark:text-pink-300 dark:border-pink-700'>
            ♀ Woman {women}
          </span>
          {other > 0 && (
            <span className='rounded-full border border-zinc-300 bg-zinc-50 px-2.5 py-0.5 text-zinc-700 font-medium dark:bg-zinc-800 dark:text-zinc-300'>
              Other {other}
            </span>
          )}
          <span className='ml-2 font-bold text-foreground'>Total: {rows.length}</span>
        </div>
      </div>
    </div>
  );
}

// ─── mobile registration card ─────────────────────────────────────────────────
function RegCard({
  reg,
  eventLabel,
  onView,
  onAction,
}: {
  reg: RegistrationRow;
  eventLabel: (id: string) => string;
  onView: () => void;
  onAction: (reg: RegistrationRow, action: ActionKey) => void;
}) {
  const fd = reg.form_data as Record<string, unknown> | undefined;
  const phone = (typeof fd?.phone === 'string' && fd.phone) ||
                (typeof fd?.memberPhone === 'string' && fd.memberPhone) || '—';

  return (
    <div className='rounded-xl border border-border bg-card p-4 shadow-xs transition-shadow hover:shadow-sm'>
      <div className='flex items-start justify-between gap-3'>
        <div className='min-w-0 flex-1 space-y-1.5'>
          <div className='flex flex-wrap items-center gap-2'>
            {reg.candidate_code ? (
              <span className={`inline-block rounded-md border px-2 py-0.5 font-mono text-xs font-bold ${
                reg.candidate_code.startsWith('M')
                  ? 'border-sky-300 bg-sky-50 text-sky-800 dark:bg-sky-950/50 dark:text-sky-300'
                  : 'border-pink-300 bg-pink-50 text-pink-800 dark:bg-pink-950/50 dark:text-pink-300'
              }`}>
                {reg.candidate_code}
              </span>
            ) : null}
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[reg.status]}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[reg.status]}`} />
              <span className='capitalize'>{reg.status}</span>
            </span>
            <span className='text-xs font-medium text-muted-foreground capitalize'>
              {reg.gender === 'man' ? '♂ Man' : reg.gender === 'woman' ? '♀ Woman' : reg.gender}
            </span>
          </div>

          <h3 className='text-sm font-semibold text-foreground'>{reg.participant_name || '—'}</h3>
          
          <div className='flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground'>
            <span className='flex items-center gap-1'>
              <span className='icon text-muted-foreground/70' style={{ fontSize: 14 }}>phone</span>
              {phone}
            </span>
            <span className='flex items-center gap-1 font-mono'>
              <span className='icon text-muted-foreground/70' style={{ fontSize: 14 }}>event</span>
              {eventLabel(reg.event_id)}
            </span>
          </div>

          <div className='flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground/80'>
            {reg.transaction_id && (
              <span className='font-mono'>Txn: {reg.transaction_id}</span>
            )}
            {reg.created_at && (
              <span>Date: {new Date(reg.created_at).toLocaleDateString()}</span>
            )}
          </div>
        </div>

        <OverflowMenu reg={reg} onAction={onAction} />
      </div>

      <div className='mt-3.5 flex flex-wrap items-center gap-2 border-t border-border/60 pt-3'>
        <button
          type='button'
          onClick={onView}
          className='flex items-center gap-1 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold hover:bg-muted'
        >
          <span className='icon' style={{ fontSize: 15 }}>visibility</span> View Details
        </button>
        {reg.status === 'pending' && (
          <button
            type='button'
            onClick={() => onAction(reg, 'approve')}
            className='flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700'
          >
            <span className='icon' style={{ fontSize: 15 }}>check</span> Approve
          </button>
        )}
        {reg.status === 'pending' && (
          <button
            type='button'
            onClick={() => onAction(reg, 'reject')}
            className='flex items-center gap-1 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700'
          >
            <span className='icon' style={{ fontSize: 15 }}>close</span> Reject
          </button>
        )}
        {ACTIONS.edit.allowed.includes(reg.status) && (
          <button
            type='button'
            onClick={() => onAction(reg, 'edit')}
            className='flex items-center gap-1 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted'
          >
            <span className='icon' style={{ fontSize: 15 }}>edit_note</span> Note
          </button>
        )}
      </div>
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

      if (action === 'delete') {
        setAllRows((prev) => prev.filter((r) => r.id !== reg.id));
        if (detailReg?.id === reg.id) setDetailReg(null);
      } else if (action === 'ban') {
        setAllRows((prev) => prev.map((r) => r.id === reg.id ? { ...r, status: 'banned' as RegistrationStatus } : r));
      } else if (action === 'approve') {
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

  const selClass = 'rounded-lg border border-input bg-background px-3 py-2 text-xs sm:text-sm shadow-xs focus:outline-none focus:ring-2 focus:ring-primary';

  return (
    <div className='admin-shell min-h-screen bg-background text-foreground'>

      {/* ── sticky page header ── */}
      <header className='sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur-sm'>
        <div className='mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6'>
          <div className='flex items-center gap-2.5'>
            <Link
              to={import.meta.env.VITE_ADMIN_PATH || '/nbn-admin'}
              className='flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground'
            >
              <span className='icon' style={{ fontSize: 16 }}>arrow_back</span>
              <span className='hidden sm:inline'>Dashboard</span>
            </Link>
            <span className='text-muted-foreground/30'>|</span>
            <h1 className='text-sm sm:text-base font-bold tracking-tight'>Registrations</h1>
          </div>

          <div className='flex items-center gap-2'>
            <span
              className='rounded-full px-2.5 py-0.5 text-xs font-bold'
              style={{ background: 'hsl(339 79% 53%)', color: '#fff' }}
            >
              {filtered.length} total
            </span>

            <button
              type='button'
              onClick={() => void load()}
              className='flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium shadow-xs hover:bg-muted'
              title='Refresh'
            >
              <span className='icon' style={{ fontSize: 15 }}>refresh</span>
              <span className='hidden sm:inline'>Refresh</span>
            </button>

            {allRows.length > 0 && (
              <button
                type='button'
                onClick={() => {
                  const code = selectedEvent ? (events.find((e) => e.id === selectedEvent)?.event_code ?? 'export') : 'all';
                  exportAllFull(filtered, code);
                }}
                className='flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium shadow-xs hover:bg-muted'
                title='Export CSV'
              >
                <span className='icon' style={{ fontSize: 15 }}>download</span>
                <span className='hidden sm:inline'>Export CSV</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ── main content ── */}
      <main className='mx-auto max-w-7xl space-y-4 px-4 py-4 sm:px-6 sm:py-6'>

        {/* ── filters card ── */}
        <div className='rounded-xl border border-border bg-card p-3 sm:p-4 shadow-xs'>
          <div className='grid grid-cols-2 gap-2.5 md:flex md:flex-wrap md:items-center'>
            <select
              value={selectedEvent ?? ''}
              onChange={(e) => setSelectedEvent(e.target.value || undefined)}
              className={selClass}
            >
              <option value=''>All events</option>
              {events.map((e) => <option key={e.id} value={e.id}>{e.event_code} — {e.date}</option>)}
            </select>

            <select
              value={selectedStatus ?? ''}
              onChange={(e) => setSelectedStatus((e.target.value as RegistrationStatus) || undefined)}
              className={selClass}
            >
              <option value=''>All statuses</option>
              {(['pending','approved','rejected','banned','deleted'] as RegistrationStatus[]).map((s) => (
                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </select>

            <select
              value={selectedGender ?? ''}
              onChange={(e) => setSelectedGender(e.target.value || undefined)}
              className={selClass}
            >
              <option value=''>All genders</option>
              <option value='man'>Man</option>
              <option value='woman'>Woman</option>
              <option value='other'>Other</option>
            </select>

            <select
              value={selectedCategory ?? ''}
              onChange={(e) => setSelectedCategory(e.target.value || undefined)}
              className={selClass}
            >
              <option value=''>All categories</option>
              <option value='self'>Self</option>
              <option value='family'>Family member</option>
            </select>

            <div className='col-span-2 md:col-span-1 md:min-w-64 md:flex-1'>
              <input
                type='text'
                placeholder='Search name, phone, txn ID, code…'
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={`w-full ${selClass}`}
              />
            </div>
          </div>
        </div>

        {/* ── list body ── */}
        {loading ? (
          <div className='flex flex-col items-center justify-center gap-3 py-16'>
            <div className='h-8 w-8 animate-spin rounded-full border-4 border-primary/20 border-t-primary' />
            <p className='text-sm text-muted-foreground'>Loading registrations…</p>
          </div>
        ) : loadError ? (
          <div className='rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-4 text-sm text-destructive'>
            <p role='alert' className='font-semibold'>Failed to load registrations</p>
            <p className='mt-1 text-xs'>{loadError}</p>
            <button type='button' onClick={() => void load()} className='mt-3 inline-block rounded-lg bg-destructive px-3 py-1.5 text-xs font-semibold text-destructive-foreground'>
              Retry
            </button>
          </div>
        ) : (
          <>
            <CountsBar rows={filtered} />

            {/* Desktop Table View */}
            <div className='hidden overflow-hidden rounded-xl border border-border bg-card shadow-xs lg:block'>
              <div className='overflow-x-auto'>
                <table className='w-full text-sm text-left'>
                  <thead className='border-b border-border bg-muted/40 text-xs font-semibold uppercase tracking-wider text-muted-foreground'>
                    <tr>
                      <th className='px-4 py-3'>Code</th>
                      <th className='px-4 py-3'>Event</th>
                      <th className='px-4 py-3'>Participant</th>
                      <th className='px-4 py-3'>Phone</th>
                      <th className='px-4 py-3'>Gender</th>
                      <th className='px-4 py-3'>Status</th>
                      <th className='px-4 py-3'>Txn ID</th>
                      <th className='px-4 py-3'>Date</th>
                      <th className='px-4 py-3 text-right'>Actions</th>
                    </tr>
                  </thead>
                  <tbody className='divide-y divide-border'>
                    {pageRows.map((reg) => {
                      const fd = reg.form_data as Record<string, unknown> | undefined;
                      const phone = (typeof fd?.phone === 'string' && fd.phone) ||
                                    (typeof fd?.memberPhone === 'string' && fd.memberPhone) || '—';
                      return (
                        <tr key={reg.id} className='transition-colors hover:bg-muted/40'>
                          <td className='px-4 py-3 font-mono'>
                            {reg.candidate_code ? (
                              <span className={`inline-block rounded-md border px-2 py-0.5 text-xs font-bold ${
                                reg.candidate_code.startsWith('M')
                                  ? 'border-sky-300 bg-sky-50 text-sky-800 dark:bg-sky-950/50 dark:text-sky-300'
                                  : 'border-pink-300 bg-pink-50 text-pink-800 dark:bg-pink-950/50 dark:text-pink-300'
                              }`}>
                                {reg.candidate_code}
                              </span>
                            ) : (
                              <span className='text-xs text-muted-foreground'>—</span>
                            )}
                          </td>
                          <td className='px-4 py-3 font-mono text-xs text-muted-foreground'>
                            {eventLabel(reg.event_id)}
                          </td>
                          <td className='px-4 py-3 font-medium text-foreground max-w-[180px] truncate'>
                            {reg.participant_name || '—'}
                          </td>
                          <td className='px-4 py-3 text-xs text-muted-foreground'>
                            {phone}
                          </td>
                          <td className='px-4 py-3 text-xs capitalize'>
                            {reg.gender === 'man' ? '♂ Man' : reg.gender === 'woman' ? '♀ Woman' : reg.gender || '—'}
                          </td>
                          <td className='px-4 py-3'>
                            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLE[reg.status]}`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[reg.status]}`} />
                              <span className='capitalize'>{reg.status}</span>
                            </span>
                          </td>
                          <td className='px-4 py-3 font-mono text-xs text-muted-foreground max-w-[120px] truncate'>
                            {reg.transaction_id || '—'}
                          </td>
                          <td className='whitespace-nowrap px-4 py-3 text-xs text-muted-foreground'>
                            {reg.created_at ? new Date(reg.created_at).toLocaleDateString() : '—'}
                          </td>
                          <td className='px-4 py-3 text-right'>
                            <div className='flex items-center justify-end gap-1.5'>
                              <button
                                type='button'
                                onClick={() => setDetailReg(reg)}
                                className='flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-semibold hover:bg-muted'
                              >
                                <span className='icon' style={{ fontSize: 15 }}>visibility</span> View
                              </button>
                              {reg.status === 'pending' && (
                                <button
                                  type='button'
                                  onClick={() => handleAction(reg, 'approve')}
                                  className='flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700'
                                >
                                  <span className='icon' style={{ fontSize: 15 }}>check</span> Approve
                                </button>
                              )}
                              {reg.status === 'pending' && (
                                <button
                                  type='button'
                                  onClick={() => handleAction(reg, 'reject')}
                                  className='flex items-center gap-1 rounded-md bg-amber-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-amber-700'
                                >
                                  <span className='icon' style={{ fontSize: 15 }}>close</span> Reject
                                </button>
                              )}
                              {ACTIONS.edit.allowed.includes(reg.status) && (
                                <button
                                  type='button'
                                  onClick={() => handleAction(reg, 'edit')}
                                  className='flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs font-medium hover:bg-muted'
                                  title='Edit Note'
                                >
                                  <span className='icon' style={{ fontSize: 15 }}>edit_note</span>
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
                        <td colSpan={9} className='px-4 py-16 text-center text-muted-foreground'>
                          <span className='icon mb-2 block text-muted-foreground/40' style={{ fontSize: 40 }}>search_off</span>
                          No registrations found matching the filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile Cards View */}
            <div className='space-y-3 lg:hidden'>
              {pageRows.length === 0 ? (
                <div className='flex flex-col items-center justify-center gap-2 rounded-xl border border-border bg-card py-16 text-center'>
                  <span className='icon text-muted-foreground/40' style={{ fontSize: 40 }}>search_off</span>
                  <p className='text-sm text-muted-foreground'>No registrations found matching filters.</p>
                </div>
              ) : (
                pageRows.map((reg) => (
                  <RegCard
                    key={reg.id}
                    reg={reg}
                    eventLabel={eventLabel}
                    onView={() => setDetailReg(reg)}
                    onAction={handleAction}
                  />
                ))
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className='flex flex-wrap items-center justify-between gap-3 pt-2 text-sm'>
                <span className='text-xs text-muted-foreground'>
                  Page <span className='font-bold text-foreground'>{page}</span> of {totalPages} ({filtered.length} total)
                </span>
                <div className='flex items-center gap-1.5'>
                  <button
                    type='button'
                    disabled={page === 1}
                    onClick={() => setPage((p) => p - 1)}
                    className='flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-40'
                  >
                    <span className='icon' style={{ fontSize: 16 }}>chevron_left</span>
                    <span>Prev</span>
                  </button>
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    const p = totalPages <= 5 ? i + 1 : page <= 3 ? i + 1 : page + i - 2;
                    if (p < 1 || p > totalPages) return null;
                    return (
                      <button
                        key={p}
                        type='button'
                        onClick={() => setPage(p)}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${p === page ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card hover:bg-muted'}`}
                      >
                        {p}
                      </button>
                    );
                  })}
                  <button
                    type='button'
                    disabled={page === totalPages}
                    onClick={() => setPage((p) => p + 1)}
                    className='flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-40'
                  >
                    <span>Next</span>
                    <span className='icon' style={{ fontSize: 16 }}>chevron_right</span>
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Detail Modal */}
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

        {/* Confirm Modal */}
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
      </main>
    </div>
  );
}
