import { supabase } from '@/lib/supabase';

/** Status values a registration can have. */
export type RegistrationStatus = 'pending' | 'approved' | 'rejected' | 'banned' | 'deleted';

/** Minimal fields needed in the admin table view. */
export interface RegistrationRow {
  id: string;
  event_id: string;
  status: RegistrationStatus;
  gender: string | null;
  candidate_code: string | null;   // e.g. M-001 or F-001
  transaction_id: string | null;
  admin_note: string | null;
  created_at: string;
  /** Submitted form data (JSONB) — holds fullName, phone, religion, etc. */
  form_data?: Record<string, unknown>;
  /** Optional denormalised fields used for the admin list. */
  participant_name?: string;   // derived from form_data if present
}

/** Values that an admin can write back (approve/reject/ban/delete). */
export interface RegistrationUpdate {
  status: RegistrationStatus;
  reason?: string;   // free‑text reason, stored in audit_log
}

/** Result returned after an admin action. */
export interface ActionResult {
  success: boolean;
  registration?: RegistrationRow;
  auditId?: string;   // id of the inserted audit_log row
}

/** Extra text shown when an action is immutable or duplicate. */
function friendlyRegError(error: unknown): string {
  const message =
    error instanceof Error ? error.message : typeof error === 'string' ? error : 'Unknown error';
  if (/immutable once/i.test(message)) {
    return 'The registration cannot be changed once it has been processed.';
  }
  if (/duplicate key|already exists/i.test(message)) {
    return 'A registration with this transaction ID already exists.';
  }
  return message;
}

/** List all registrations (optionally filtered by event or status). */
export async function listRegistrations(
  filters?: { event_id?: string; status?: RegistrationStatus }
): Promise<RegistrationRow[]> {
  let query = supabase.from('registrations').select(`
    id,
    event_id,
    status,
    gender,
    candidate_code,
    transaction_id,
    admin_note,
    created_at,
    form_data
  `);

  if (filters?.event_id) {
    query = query.eq('event_id', filters.event_id);
  }
  if (filters?.status) {
    query = query.eq('status', filters.status);
  }

  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as RegistrationRow[];
}

/** Round‑trip count per event (total + approved) using the existing function. */
export async function getRegistrationCounts(): Promise<{ event_id: string; total: number; approved: number }[]> {
  const { data, error } = await supabase.rpc('event_registration_counts');
  if (error) throw error;
  return (data ?? []) as Array<{
    event_id: string;
    total: number;
    approved: number;
  }>;
}

/** Update a registration status and record the action in audit_log. */
export async function updateRegistrationStatus(
  regId: string,
  update: RegistrationUpdate
): Promise<ActionResult> {
  // 1️⃣ Update the registration
  const { data, error } = await supabase
    .from('registrations')
    .update({ status: update.status })
    .eq('id', regId)
    .select()
    .single();
  if (error) throw error;

  // 2️⃣ Insert audit_log entry (admin_user_id comes from the session; we expose it via a Supabase helper)
  const { error: auditError } = await supabase
    .from('audit_log')
    .insert({
      reg_id: regId,
      admin_user_id: (await supabase.auth.getUser()).data.user?.id ?? '',
      action: update.status,
      reason: update.reason,
    });
  if (auditError) throw auditError;

  return {
    success: true,
    registration: data as RegistrationRow,
    auditId: (await supabase.from('audit_log').select('id', { count: 'exact', head: true })).data?.[0]?.id,
  };
}

/** Approve a registration (status → approved). */
export async function approveRegistration(regId: string, reason?: string): Promise<ActionResult> {
  return updateRegistrationStatus(regId, { status: 'approved', reason });
}

/** Reject a registration (status → rejected). */
export async function rejectRegistration(regId: string, reason?: string): Promise<ActionResult> {
  return updateRegistrationStatus(regId, { status: 'rejected', reason });
}

/** Ban a registration (status → banned). Typically used for policy violations. */
export async function banRegistration(regId: string, reason?: string): Promise<ActionResult> {
  return updateRegistrationStatus(regId, { status: 'banned', reason });
}

/** Soft‑delete a registration (status → deleted). */
export async function deleteRegistration(regId: string, reason?: string): Promise<ActionResult> {
  return updateRegistrationStatus(regId, { status: 'deleted', reason });
}