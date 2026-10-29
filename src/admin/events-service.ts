import { supabase } from '@/lib/supabase';

/**
 * Phase 4 data access for the admin events screen.
 *
 * The dashboard mounts only after the guard passes is_admin() + MFA, so every
 * call here runs with the "admins full access" RLS policies in effect. The
 * event_code/serial are stamped by the assign_event_code() trigger — the
 * frontend never sends them, and the freeze_event_code() trigger rejects any
 * attempt to change them afterwards.
 */

export type EventStatus = 'open' | 'closed' | 'finished';

export interface AdminEvent {
  id: string;
  event_code: string;
  serial: number;
  date: string;
  status: EventStatus;
  price: number;
  discount_price: number;
  max_participants: number;
  age_range: string | null;
  area: string | null;
  religion: string | null;
  shift: string | null;
  extra_guardian_charge: number;
  links_open_at: string | null;
  links_close_at: string | null;
  max_requests_per_person: number;
  created_at: string;
  updated_at: string;
}

export interface EventCounts {
  event_id: string;
  total: number;
  approved: number;
}

/** Fields the form collects. Money arrives as numbers; nullable text arrives trimmed or null. */
export interface EventFormValues {
  date: string;
  status: EventStatus;
  price: number;
  discount_price: number;
  max_participants: number;
  age_range: string | null;
  area: string | null;
  religion: string | null;
  shift: string | null;
  extra_guardian_charge: number;
  links_open_at: string | null;
  links_close_at: string | null;
  max_requests_per_person: number;
}

export const EMPTY_EVENT_FORM: EventFormValues = {
  date: '',
  status: 'open',
  price: 0,
  discount_price: 0,
  max_participants: 0,
  age_range: null,
  area: null,
  religion: null,
  shift: null,
  extra_guardian_charge: 0,
  links_open_at: null,
  links_close_at: null,
  max_requests_per_person: 8,
};

/** Extra text shown when several events share one day (e.g. "Morning"). Null otherwise. */
export function eventFormFromRow(row: AdminEvent): EventFormValues {
  return {
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
    links_open_at: row.links_open_at,
    links_close_at: row.links_close_at,
    max_requests_per_person: row.max_requests_per_person,
  };
}

/** Newest first; the code column tells the story at a glance. */
export async function listEvents(): Promise<AdminEvent[]> {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .order('date', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as AdminEvent[];
}

/** One round trip for every event's registration count. */
export async function getEventCounts(): Promise<EventCounts[]> {
  const { data, error } = await supabase.rpc('event_registration_counts');
  if (error) throw error;
  return (data ?? []) as EventCounts[];
}

/** Insert only — code and serial are stamped by the database trigger. */
export async function createEvent(values: EventFormValues): Promise<AdminEvent> {
  const { data, error } = await supabase.from('events').insert(values).select().single();
  if (error) throw error;
  return data as AdminEvent;
}

/** Update only — code and serial are frozen by the database trigger. */
export async function updateEvent(id: string, values: EventFormValues): Promise<AdminEvent> {
  const { data, error } = await supabase
    .from('events')
    .update(values)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as AdminEvent;
}

/** Keep Supabase/Postgres messages readable for a non-technical admin. */
export function friendlyEventError(error: unknown): string {
  const message =
    error instanceof Error ? error.message : typeof error === 'string' ? error : 'Unknown error';
  if (/immutable once assigned/i.test(message)) {
    return 'The event code cannot be changed once it is created.';
  }
  if (/duplicate key|already exists/i.test(message)) {
    return 'An event with these details already exists.';
  }
  return message;
}
