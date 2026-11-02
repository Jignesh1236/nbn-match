export const MIN_PHONE_DIGITS = 10;
export const MAX_PHONE_DIGITS = 15;

/**
 * Keep only the digits from a phone value so "+880 1712-345678" and
 * "01712345678" can be compared safely.
 */
export function normalizePhoneDigits(value: string | null | undefined): string {
  if (!value) return '';
  return value.replace(/\D/g, '');
}

/**
 * Format a candidate number for WhatsApp click-to-chat links so admins can send
 * a pre-filled message directly to the saved contact when a valid number exists.
 * Bangladesh local numbers like "01712345678" become "+8801712345678".
 */
export function formatWhatsAppNumber(value: string | null | undefined): string | null {
  const digits = normalizePhoneDigits(value);
  if (!digits) return null;
  if (digits.length < MIN_PHONE_DIGITS || digits.length > MAX_PHONE_DIGITS) return null;

  if (digits.startsWith('880')) return `+${digits}`;
  if (digits.startsWith('0')) return `+88${digits}`;
  if (digits.length === 10) return `+880${digits}`;
  return `+${digits}`;
}

export const toWhatsAppNumber = formatWhatsAppNumber;

export function buildWhatsAppShareUrl(value: string | null | undefined, text: string): string {
  const encodedText = encodeURIComponent(text.trim() || 'NBN Match Making Event');
  const number = formatWhatsAppNumber(value);
  if (number) {
    return `https://wa.me/${number}?text=${encodedText}`;
  }
  return `https://wa.me/?text=${encodedText}`;
}

export const getWhatsAppShareUrl = buildWhatsAppShareUrl;

/**
 * A candidate link is verified against the phone saved on the registration.
 * Reject obviously unusable input before calling the server so a typo does not
 * count as a failed attempt and the user gets an immediate "invalid number".
 */
export function isPhoneLengthValid(value: string | null | undefined): boolean {
  const digits = normalizePhoneDigits(value);
  return digits.length >= MIN_PHONE_DIGITS && digits.length <= MAX_PHONE_DIGITS;
}

/**
 * Mirror of public.norm_phone() in the database: compare the last 10 digits so
 * country-code and leading-zero variants of the same number match.
 */
export function normalizedPhoneForMatch(value: string | null | undefined): string | null {
  const digits = normalizePhoneDigits(value);
  return digits.length >= 10 ? digits.slice(-10) : null;
}

export function phonesMatch(first: string | null | undefined, second: string | null | undefined): boolean {
  const a = normalizedPhoneForMatch(first);
  const b = normalizedPhoneForMatch(second);
  return a !== null && b !== null && a === b;
}
