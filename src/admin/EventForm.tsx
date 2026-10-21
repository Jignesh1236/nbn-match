import { useState, type FormEvent } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  createEvent,
  friendlyEventError,
  updateEvent,
  type AdminEvent,
  type EventFormValues,
  type EventStatus,
} from './events-service';

const inputClassName =
  'w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring';
const labelClassName = 'block text-sm font-medium leading-none';
const primaryButtonClassName =
  'rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60';
const ghostButtonClassName =
  'rounded-md border border-border bg-card px-4 py-2 text-sm font-medium shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60';

interface EventFormProps {
  /** Null when creating; the code of the row being edited otherwise. */
  editingCode: string | null;
  /** editingId is null when creating. */
  editingId: string | null;
  initial: EventFormValues;
  onSaved: (saved: AdminEvent, wasEdit: boolean) => void;
  onCancel: () => void;
}

/** Create/edit form. Code and serial are never collected — the DB stamps them. */
export function EventForm({ editingCode, editingId, initial, onSaved, onCancel }: EventFormProps) {
  const [form, setForm] = useState<EventFormValues>(initial);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const set = <K extends keyof EventFormValues>(key: K, value: EventFormValues[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    if (!form.date) {
      setSaveError('Please choose an event date.');
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const saved =
        editingId != null ? await updateEvent(editingId, form) : await createEvent(form);
      onSaved(saved, editingId != null);
    } catch (error) {
      setSaveError(friendlyEventError(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{editingCode ? `Edit event ${editingCode}` : 'New event'}</CardTitle>
        <CardDescription>
          {editingCode
            ? 'The code stays fixed; everything else can be edited while places remain.'
            : 'The code is generated automatically when you save (for example 126061).'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className='space-y-4'>
          <div className='grid gap-4 sm:grid-cols-2'>
            <div className='space-y-1.5'>
              <label htmlFor='event-date' className={labelClassName}>
                Date
              </label>
              <input
                id='event-date'
                name='date'
                type='date'
                required
                value={form.date}
                onChange={(event) => set('date', event.target.value)}
                className={inputClassName}
              />
            </div>
            <div className='space-y-1.5'>
              <label htmlFor='event-status' className={labelClassName}>
                Status
              </label>
              <select
                id='event-status'
                name='status'
                value={form.status}
                onChange={(event) => set('status', event.target.value as EventStatus)}
                className={inputClassName}
              >
                <option value='open'>Open</option>
                <option value='closed'>Closed</option>
                <option value='finished'>Finished</option>
              </select>
            </div>
            <div className='space-y-1.5'>
              <label htmlFor='event-price' className={labelClassName}>
                Price
              </label>
              <input
                id='event-price'
                name='price'
                type='number'
                min={0}
                step='any'
                required
                value={form.price}
                onChange={(event) => set('price', Number(event.target.value))}
                className={inputClassName}
              />
            </div>
            <div className='space-y-1.5'>
              <label htmlFor='event-discount' className={labelClassName}>
                Discount price
              </label>
              <input
                id='event-discount'
                name='discount_price'
                type='number'
                min={0}
                step='any'
                required
                value={form.discount_price}
                onChange={(event) => set('discount_price', Number(event.target.value))}
                className={inputClassName}
              />
            </div>
            <div className='space-y-1.5'>
              <label htmlFor='event-max' className={labelClassName}>
                Max participants (0 = no limit)
              </label>
              <input
                id='event-max'
                name='max_participants'
                type='number'
                min={0}
                step={1}
                required
                value={form.max_participants}
                onChange={(event) =>
                  set('max_participants', Math.max(0, Math.trunc(Number(event.target.value))))
                }
                className={inputClassName}
              />
            </div>
            <div className='space-y-1.5'>
              <label htmlFor='event-charge' className={labelClassName}>
                Extra guardian charge
              </label>
              <input
                id='event-charge'
                name='extra_guardian_charge'
                type='number'
                min={0}
                step='any'
                required
                value={form.extra_guardian_charge}
                onChange={(event) => set('extra_guardian_charge', Number(event.target.value))}
                className={inputClassName}
              />
            </div>
          </div>
          <div className='grid gap-4 sm:grid-cols-2'>
            <div className='space-y-1.5'>
              <label htmlFor='event-age' className={labelClassName}>
                Age range
              </label>
              <input
                id='event-age'
                name='age_range'
                type='text'
                placeholder='e.g. 20-30'
                value={form.age_range ?? ''}
                onChange={(event) => set('age_range', event.target.value.trim() || null)}
                className={inputClassName}
              />
            </div>
            <div className='space-y-1.5'>
              <label htmlFor='event-area' className={labelClassName}>
                Area
              </label>
              <input
                id='event-area'
                name='area'
                type='text'
                value={form.area ?? ''}
                onChange={(event) => set('area', event.target.value.trim() || null)}
                className={inputClassName}
              />
            </div>
            <div className='space-y-1.5'>
              <label htmlFor='event-religion' className={labelClassName}>
                Religion
              </label>
              <input
                id='event-religion'
                name='religion'
                type='text'
                value={form.religion ?? ''}
                onChange={(event) => set('religion', event.target.value.trim() || null)}
                className={inputClassName}
              />
            </div>
            <div className='space-y-1.5'>
              <label htmlFor='event-shift' className={labelClassName}>
                Shift (only when several events share a day)
              </label>
              <input
                id='event-shift'
                name='shift'
                type='text'
                placeholder='e.g. Morning'
                value={form.shift ?? ''}
                onChange={(event) => set('shift', event.target.value.trim() || null)}
                className={inputClassName}
              />
            </div>
          </div>

          {saveError ? (
            <p
              role='alert'
              className='rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive'
            >
              {saveError}
            </p>
          ) : null}

          <div className='flex flex-wrap gap-2'>
            <button type='submit' disabled={saving} className={primaryButtonClassName}>
              {saving ? 'Saving…' : editingId != null ? 'Save changes' : 'Create event'}
            </button>
            <button
              type='button'
              onClick={onCancel}
              disabled={saving}
              className={ghostButtonClassName}
            >
              Cancel
            </button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
