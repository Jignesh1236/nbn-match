import { supabase } from './supabase.js';

export function normalizeDocumentMimeType(file: Pick<File, 'name' | 'type'>): string {
  const ext = (file.name.split('.').pop() ?? 'bin').toLowerCase();

  const JFIF_LIKE_EXTS = ['jfif', 'jpe', 'jif'];
  return file.type && file.type !== ''
    ? file.type
    : JFIF_LIKE_EXTS.includes(ext)
      ? 'image/jpeg'
      : 'application/octet-stream';
}

export function buildUploadOptions(file: Pick<File, 'name' | 'type'>) {
  return {
    metadata: { mimetype: normalizeDocumentMimeType(file) },
    upsert: false,
  };
}

export type OpenEvent = {
  id: string;
  event_code: string;
  price: number;
  discount_price: number;
  max_participants: number;
  age_range: string | null;
  area: string | null;
  religion: string | null;
  shift: string | null;
  extra_guardian_charge: number;
} | null;

export type RegistrationInput = {
  event_id: string;
  gender: string;
  private_fields: string[];
  phone?: string | null;
  photo_path?: string | null;
  id_card_path?: string | null;
  accompanying_nid_path?: string | null;
  payment_method?: string | null;
  transaction_id?: string | null;
  sender_number?: string | null;
  guardian_name?: string | null;
  guardian_phone?: string | null;
  guardian_age?: number | null;
  guardian_relation?: string | null;
  guardian_charge?: number;
  father_phone?: string | null;
  mother_phone?: string | null;
  form_data: Record<string, unknown>;
};

export type RegistrationResult = {
  status: 'success' | 'error' | 'unavailable';
  message: string;
};

/**
 * Fetch the single open event's safe fields via the get_open_event() RPC.
 * Returns null when no event is open (registration closed).
 */
export async function getOpenEvent(): Promise<OpenEvent> {
  const { data, error } = await supabase.rpc('get_open_event');
  if (error) throw error;
  return (data?.[0] as OpenEvent) ?? null;
}

/**
 * Upload a single file to the private registration-files bucket using a
 * random UUID filename. Returns the storage path.
 *
 * .jfif files are a JPEG variant; some browsers report their MIME type as
 * 'image/jpeg', 'image/pjpeg', or even an empty string. We normalise it to
 * 'image/jpeg' before passing it to the storage policy metadata check,
 * so the policy always sees a valid value.
 */
export async function uploadDocument(file: File): Promise<string> {
  const ext = (file.name.split('.').pop() ?? 'bin').toLowerCase();
  const path = `registrations/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from('registration-files')
    .upload(path, file, buildUploadOptions(file));
  if (error) throw error;
  return path;
}

/**
 * Insert a registration row. No row data is selected or returned to the
 * anonymous caller — success is determined solely by the insert completing.
 */
export async function submitRegistration(input: RegistrationInput): Promise<void> {
  const { error } = await supabase.from('registrations').insert({
    event_id: input.event_id,
    gender: input.gender,
    private_fields: input.private_fields,
    phone: input.phone ?? null,
    photo_path: input.photo_path ?? null,
    id_card_path: input.id_card_path ?? null,
    accompanying_nid_path: input.accompanying_nid_path ?? null,
    payment_method: input.payment_method ?? null,
    transaction_id: input.transaction_id ?? null,
    sender_number: input.sender_number ?? null,
    guardian_name: input.guardian_name ?? null,
    guardian_phone: input.guardian_phone ?? null,
    guardian_age: input.guardian_age ?? null,
    guardian_relation: input.guardian_relation ?? null,
    guardian_charge: input.guardian_charge ?? 0,
    father_phone: input.father_phone ?? null,
    mother_phone: input.mother_phone ?? null,
    status: 'pending',
    candidate_code: null,
    admin_note: null,
    deleted_at: null,
    deleted_by: null,
    form_data: input.form_data,
  });
  if (error) throw error;
}
