import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import {
  listRegistrations,
  getRegistrationCounts,
  approveRegistration,
  rejectRegistration,
  banRegistration,
  deleteRegistration,
  type RegistrationRow,
  type RegistrationStatus,
} from './registrations-service';

const STATUS_LABELS: Record<RegistrationStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  banned: 'Banned',
  deleted: 'Deleted',
};

const ghostButton = 'rounded-md border border-border bg-card px-4 py-2 text-sm font-medium shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60';

export function RegistrationsManager() {
  const [registrations, setRegistrations] = useState<RegistrationRow[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<RegistrationStatus | null>(null);
  const [search, setSearch] = useState('');

  const load = async () => {
    const all = await listRegistrations({event_id: selectedEvent, status: selectedStatus});
    const filtered = all.filter(r =>
      (r.participant_name?.toLowerCase().includes(search.toLowerCase()) ||
       r.transaction_id?.toLowerCase().includes(search.toLowerCase()) ||
       (r.candidate_code ?? '').toLowerCase().includes(search.toLowerCase()))
    );
    setRegistrations(filtered);
  };

  useEffect(() => { void load(); }, []);
  useEffect(() => { void load(); }, [selectedEvent, selectedStatus, search]);

  const doAction = async (regId: string, key: keyof typeof actions) => {
    const reason = window.prompt('Reason (optional):') ?? '';
    const actions = { approve: approveRegistration, reject: rejectRegistration, ban: banRegistration, delete: deleteRegistration };
    try {
      await actions[key](regId, reason);
      void load();
      window.alert(`Registration ${key}ed.`);
    } catch (e) {
      window.alert('Failed: ' + (e as Error).message);
    }
  };

  if (loading) return <p>Loading registrations…</p>;

  const page = registrations.slice(0, 20);

  return (
    <div className='space-y-4'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <select
          value={selectedEvent ?? ''}
          onChange={(e) => setSelectedEvent(e.target.value || null)}
          className='rounded-md border border-border px-3 py-2 shadow-sm'
        >
          <option value="">All events</option>
        </select>
        <select
          value={selectedStatus ?? ''}
          onChange={(e) => setSelectedStatus(e.target.value as RegistrationStatus | null)}
          className='rounded-md border border-border px-3 py-2 shadow-sm'
        >
          <option value="">All statuses</option>
          {Object.values(RegistrationStatus).map(s => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </select>
        <input
          type='text'
          placeholder='Search…'
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className='rounded-l-md border border-border w-full px-3 py-2 shadow-sm focus:outline-none focus:border-primary'
        />
      </div>

      <table className='w-full caption-bottom'>
        <caption className='text-right text-sm text-muted-foreground mb-2'>
          {registrations.length} registrations
        </caption>
        <thead>
          <tr>
            <th className='text-left p-3 text-xs font-medium text-muted-foreground'>Event</th>
            <th className='text-left p-3 text-xs font-medium text-muted-foreground'>Participant</th>
            <th className='text-left p-3 text-xs font-medium text-muted-foreground'>Gender</th>
            <th className='text-left p-3 text-xs font-medium text-muted-foreground'>Status</th>
            <th className='text-left p-3 text-xs font-medium text-muted-foreground'>Txn ID</th>
            <th className='text-left p-3 text-xs font-medium text-muted-foreground'>Created</th>
            <th className='text-right p-3 text-xs font-medium text-muted-foreground'>Actions</th>
          </tr>
        </thead>
        <tbody>
          {page.map((reg) => (
            <tr key={reg.id} className='border-b hover:bg-muted/50'>
              <td className='p-3 text-sm'>{reg.event_code || reg.event_id?.slice(0,6)}</td>
              <td className='p-3 text-sm'>{reg.participant_name || '—'}</td>
              <td className='p-3 text-sm'>{reg.gender || '—'}</td>
              <td className='p-3 text-sm'>
                <span className={STATUS_LABELS[reg.status] ? 'border px-2 py-0.5 text-xs' : ''}>
                  {STATUS_LABELS[reg.status]}
                </span>
              </td>
              <td className='p-3 text-sm'>{reg.transaction_id || '—'}</td>
              <td className='p-3 text-sm'>{reg.created_at ? new Date(reg.created_at).toLocaleDateString() : '—'}</td>
              <td className='text-right p-3'>
                <div className='space-y-1'>
                  <button onClick={() => doAction(reg.id, 'approve')} className={ghostButton} disabled={reg.status !== 'pending'}>Approve</button>
                  <button onClick={() => doAction(reg.id, 'reject')} className={ghostButton} disabled={reg.status !== 'pending'}>Reject</button>
                  <button onClick={() => doAction(reg.id, 'ban')} className={ghostButton} disabled={reg.status !== 'pending'}>Ban</button>
                  <button onClick={() => doAction(reg.id, 'delete')} className={ghostButton} disabled={reg.status !== 'pending'}>Delete</button>
                </div>
              </td>
            </tr>
          ))}
          {registrations.length === 0 && (
            <tr><td colSpan={7} className='p-6 text-center text-muted-foreground'>No registrations.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}