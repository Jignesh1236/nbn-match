import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function main() {
  const event = (await supabase.rpc('get_open_event')).data[0];
  console.log('event', event.event_code, 'max', event.max_participants);

  // ---- replicate uploadDocument() exactly ----
  async function uploadDocument(file) {
    const ext = file.name.split('.').pop() ?? 'bin';
    const path = `registrations/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from('registration-files').upload(path, file, {
      metadata: { mimetype: file.type },
      upsert: false,
    });
    if (error) throw error;
    return path;
  }

  const jpeg = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10])], { type: 'image/jpeg' });
  jpeg.name = 'photo.jpg';
  const photoPath = await uploadDocument(jpeg);
  const idPath = await uploadDocument(jpeg);
  console.log('uploaded', photoPath, idPath);

  // ---- replicate submitRegistration() exactly ----
  const input = {
    event_id: event.id,
    gender: 'man',
    private_fields: ['phone'],
    photo_path: photoPath,
    id_card_path: idPath,
    payment_method: 'bkash',
    transaction_id: 'TXN-APP-REPLICA-' + Date.now(),
    sender_number: '01700000000',
    guardian_name: null,
    guardian_phone: null,
    guardian_age: null,
    guardian_relation: null,
    guardian_charge: 0,
    status: 'pending',
    candidate_code: null,
    admin_note: null,
    deleted_at: null,
    deleted_by: null,
    form_data: {
      fullName: 'Test User',
      gender: 'man',
      phone: '01700000000',
      siblings: [],
      photo: 'photo.jpg',
      idCard: 'photo.jpg',
      paymentMethod: 'bkash',
      transactionId: 'TXN-APP-REPLICA',
      senderNumber: '01700000000',
    },
  };
  const { error } = await supabase.from('registrations').insert(input);
  console.log('INSERT error:', error ? JSON.stringify(error) : 'NONE');
}

main().catch(e => { console.error('THREW', e); process.exit(1); });
