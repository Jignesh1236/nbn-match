import { supabase } from '@/lib/supabase';

export type RegistrationStatus = 'pending' | 'approved' | 'rejected' | 'banned' | 'deleted';

export interface RegistrationRow {
  id: string;
  event_id: string;
  status: RegistrationStatus;
  gender: string | null;
  candidate_code: string | null;
  transaction_id: string | null;
  admin_note: string | null;
  created_at: string;
  deleted_at: string | null;
  photo_path: string | null;
  id_card_path: string | null;
  form_data?: Record<string, unknown>;
  participant_name?: string;
}

export interface ActionResult {
  success: boolean;
  registration?: RegistrationRow;
}

export function friendlyRegError(error: unknown): string {
  const message =
    error instanceof Error ? error.message : typeof error === 'string' ? error : 'Unknown error';
  if (/immutable once/i.test(message)) return 'This registration cannot be changed once processed.';
  if (/duplicate key|already exists/i.test(message)) return 'A registration with this transaction ID already exists.';
  return message;
}

export async function listRegistrations(filters?: {
  event_id?: string;
  status?: RegistrationStatus;
  gender?: string;
  category?: string; // 'self' | 'family'
}): Promise<RegistrationRow[]> {
  let query = supabase.from('registrations').select(
    'id, event_id, status, gender, candidate_code, transaction_id, admin_note, created_at, deleted_at, photo_path, id_card_path, form_data'
  );
  if (filters?.event_id) query = query.eq('event_id', filters.event_id);
  if (filters?.status)   query = query.eq('status', filters.status);
  if (filters?.gender)   query = query.eq('gender', filters.gender);
  // category filter: 'self' → registeringFor=self, 'family' → registeringFor=family
  if (filters?.category) query = query.eq('form_data->>registeringFor', filters.category);
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as RegistrationRow[];
}

export async function getRegistrationCounts(): Promise<{ event_id: string; total: number; approved: number }[]> {
  const { data, error } = await supabase.rpc('event_registration_counts');
  if (error) throw error;
  return (data ?? []) as Array<{ event_id: string; total: number; approved: number }>;
}

/** Generate a 60-second signed URL for a private storage file. */
export async function getSignedUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from('registration-files')
    .createSignedUrl(path, 60);
  if (error) throw error;
  return data.signedUrl;
}

// audit_log has columns from both migrations — send all four FK columns.
async function logAudit(regId: string, action: string, reason?: string) {
  const { data: { user } } = await supabase.auth.getUser();
  const uid = user?.id ?? '';
  const { error } = await supabase.from('audit_log').insert({
    reg_id:          regId,
    registration_id: regId,
    admin_user_id:   uid,
    admin_id:        uid,
    action,
    reason: reason || null,
  });
  if (error) throw error;
}

/** Approve — uses the RPC which atomically assigns M-/F- candidate code and logs to audit_log. */
export async function approveRegistration(regId: string, _reason?: string): Promise<ActionResult> {
  const { error } = await supabase.rpc('approve_registration', { p_registration_id: regId });
  if (error) throw error;
  return { success: true };
}

export async function rejectRegistration(regId: string, reason?: string): Promise<ActionResult> {
  const { data, error } = await supabase
    .from('registrations')
    .update({ status: 'rejected', admin_note: reason || null })
    .eq('id', regId)
    .select()
    .single();
  if (error) throw error;
  await logAudit(regId, 'reject', reason);
  return { success: true, registration: data as RegistrationRow };
}

/** Ban — does NOT set deleted_at so the participant slot is NOT freed. */
export async function banRegistration(regId: string, reason?: string): Promise<ActionResult> {
  const { data, error } = await supabase
    .from('registrations')
    .update({ status: 'banned', admin_note: reason || null })
    .eq('id', regId)
    .select()
    .single();
  if (error) throw error;
  await logAudit(regId, 'ban', reason);
  return { success: true, registration: data as RegistrationRow };
}

/** Soft-delete — sets deleted_at so the participant count drops by 1. */
export async function deleteRegistration(regId: string, reason?: string): Promise<ActionResult> {
  const { data, error } = await supabase
    .from('registrations')
    .update({ status: 'deleted', deleted_at: new Date().toISOString(), admin_note: reason || null })
    .eq('id', regId)
    .select()
    .single();
  if (error) throw error;
  await logAudit(regId, 'delete', reason);
  return { success: true, registration: data as RegistrationRow };
}

export async function editRegistrationNote(regId: string, note: string): Promise<ActionResult> {
  const { data, error } = await supabase
    .from('registrations')
    .update({ admin_note: note })
    .eq('id', regId)
    .select()
    .single();
  if (error) throw error;
  return { success: true, registration: data as RegistrationRow };
}
