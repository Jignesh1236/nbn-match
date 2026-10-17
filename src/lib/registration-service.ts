import type { Language } from '@/lib/language';

export type RegistrationResult = {
  status: 'success' | 'error' | 'unavailable';
  message: string;
};

/**
 * Single integration point for registration submissions.
 * Set VITE_REGISTRATION_ENDPOINT (e.g. a form service URL or your API route)
 * and the form will POST the entries as JSON there. Without it, visitors see
 * a short "registration not yet open" notice.
 */
export async function submitRegistration(
  language: Language,
  payload: Record<string, unknown>,
): Promise<RegistrationResult> {
  const endpoint = import.meta.env.VITE_REGISTRATION_ENDPOINT as string | undefined;
  if (!endpoint) {
    return {
      status: 'unavailable',
      message: language === 'bn'
        ? 'রেজিস্ট্রেশন গ্রহণ এখনো চালু হয়নি। শীঘ্রই আমাদের সঙ্গে যুক্ত হোন।'
        : 'Registration is not yet open. Please check back soon.',
    };
  }
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return {
      status: 'success',
      message: language === 'bn'
        ? 'রেজিস্ট্রেশন সফলভাবে জমা হয়েছে। ধন্যবাদ!'
        : 'Registration submitted successfully. Thank you!',
    };
  } catch {
    return {
      status: 'error',
      message: language === 'bn'
        ? 'জমা দেওয়া যায়নি। পরে আবার চেষ্টা করুন।'
        : 'Could not submit your registration. Please try again later.',
    };
  }
}
