import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import {
  EMPTY_EVENT_FORM,
  friendlyEventError,
  getEventCounts,
  listEvents,
  type AdminEvent,
  type EventCounts,
  type EventFormValues,
  type EventStatus,
} from './events-service';
import { EventForm } from './EventForm';

export const STATUS_LABELS: Record<EventStatus, string> = {
  open: 'Open',
  closed: 'Closed',
  finished: 'Finished',
};

const STATUS_STYLES: Record<EventStatus, string> = {
  open: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  closed: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400',
  finished: 'border-border bg-muted text-muted-foreground',
};

const ghostButton =
  'rounded-md border border-border bg-card px-4 py-2 text-sm font-medium shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60';
const primaryButton =
  'rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60';

function formatCount(count: number | null | undefined, max: number): string {
  const registered = count ?? 0;
  return max > 0 ? `${registered} / ${max}` : `${registered} (no limit)`;
}

/**
 * Phase 4: list, create and edit events. Rendered only inside the guarded
 * dashboard. Code and serial are stamped by the DB trigger and frozen after.
 */
export function EventsManager() {
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [counts, setCounts] = useState<Record<string, EventCounts>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<AdminEvent | null>(null);
  const [initialForm, setInitialForm] = useState<EventFormValues>(EMPTY_EVENT_FORM);
  const [notice, setNotice] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [rows, countRows] = await Promise.all([listEvents(), getEventCounts()]);
      setEvents(rows);
      const byEvent: Record<string, EventCounts> = {};
      for (const row of countRows) byEvent[row.event_id] = row;
      setCounts(byEvent);
    } catch (error) {
      setLoadError(friendlyEventError(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setInitialForm(EMPTY_EVENT_FORM);
    setNotice(null);
    setShowForm(true);
  };



  const openEdit = (row: AdminEvent) => {
    setEditing(row);
    setInitialForm({
      date: row.date,
      status: row.status,
      price: row.price,
      discount_price: row.discount_price,
      max_participants: row.max_participants,
      age_range: row.age_range,
      area: row.area,
      religion: row.religion,
      shift: row.shift,
      extra_guardian_charge: row.extra_guardian_charge,
    });
    setNotice(null);
    setShowForm(true);
  };

  return (
    <div className='space-y-4'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <p className='text-sm text-muted-foreground'>
          The public registration form shows the prices of the open event. Event codes are
          generated in the database and cannot be changed afterwards.
        </p>
        <button type='button' onClick={openCreate} className={primaryButton}>
          New event
        </button>
      </div>
      {notice ? (
        <p
          role='status'
          className='rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400'
        >
          {notice}
        </p>
      ) : null}
      {loadError ? (
        <div className='space-y-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive'>
          <p role='alert'>{loadError}</p>
          <button type='button' onClick={() => void load()} className={ghostButton}>
            Retry
          </button>
        </div>
      ) : null}
      {loading ? (
        <p className='text-sm text-muted-foreground'>Loading events…</p>
      ) : events.length === 0 && !loadError ? (
        <p className='rounded-md border border-border bg-card px-3 py-6 text-center text-sm text-muted-foreground'>
          No events yet. Create the first one to open registration.
        </p>
      ) : (
        <ul className='space-y-3'>
          {events.map((row) => (
            <li key={row.id}>
              <Card>
                <CardContent className='flex flex-wrap items-center justify-between gap-4 p-4 sm:p-5'>
                  <div className='min-w-0 space-y-1'>
                    <div className='flex flex-wrap items-center gap-2'>
                      <span className='font-mono text-base font-semibold tracking-wide'>
                        {row.event_code}
                      </span>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[row.status]}`}
                      >
                        {STATUS_LABELS[row.status]}
                      </span>
                    </div>
                    <p className='text-sm text-muted-foreground'>
                      {row.date}
                      {row.shift ? ` · Shift: ${row.shift}` : null}
                      {row.area ? ` · ${row.area}` : null}
                    </p>
                    <p className='text-sm'>
                      Price {row.price}
                      {row.discount_price > 0 ? ` · Discount ${row.discount_price}` : null}
                      {` · Registered ${formatCount(counts[row.id]?.total, row.max_participants)}`}
                    </p>
                    {row.age_range || row.religion ? (
                      <p className='text-xs text-muted-foreground'>
                        {[row.age_range, row.religion].filter(Boolean).join(' · ')}
                      </p>
                    ) : null}
                  </div>
                  <button type='button' onClick={() => openEdit(row)} className={ghostButton}>
                    Edit
                  </button>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {showForm ? (
        <EventForm
          key={editing ? editing.id : 'new'}
          editingCode={editing?.event_code ?? null}
          editingId={editing?.id ?? null}
          initial={initialForm}
          onSaved={(saved, wasEdit) => {
            setEvents((prev) =>
              wasEdit ? prev.map((row) => (row.id === saved.id ? saved : row)) : [saved, ...prev],
            );
            setNotice(
              wasEdit
                ? `Event ${saved.event_code} updated.`
                : `Event ${saved.event_code} created. The public form now shows its prices.`,
            );
            setShowForm(false);
            setEditing(null);
          }}
          onCancel={() => {
            setShowForm(false);
            setEditing(null);
          }}
        />
      ) : null}
    </div>
  );
}

