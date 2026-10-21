import { useState, type JSX } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import {
  registrationSections,
  memberFields,
  siblingFields,
  getRegistrationFieldLabel,
  getRegistrationValueLabel,
} from '@/lib/registration-copy';
import { useLanguage, type Language } from '@/lib/language';

const modalOverlay =
  'fixed inset-0 z-50 flex items-center justify-center';
const modalBackdrop =
  'absolute inset-0 bg-black/40 backdrop-blur-sm';
const modalPanel =
  'relative w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-card border border-border rounded-lg p-8 shadow-2xl';

const closeButton =
  'absolute right-4 top-4 rounded-md border border-border bg-card px-3 py-1 text-sm shadow-sm hover:bg-muted';

const sectionTitle =
  'mt-6 mb-3 text-sm font-semibold text-foreground border-b border-border pb-2';

const fieldRow =
  'grid grid-cols-2 gap-6 mb-4 p-3 bg-muted/30 rounded border border-border/50';
const fieldLabel =
  'text-xs font-medium text-muted-foreground';
const fieldValue =
  'text-sm text-foreground break-words';

/** Render a single form field label/value row. */
function renderField(
  language: Language,
  name: string,
  value: unknown
): JSX.Element | null {
  if (value === undefined || value === null || value === '') return null;

  const label = getRegistrationFieldLabel(name, language);
  let display = String(value);

  // Pretty-print yes/no selects
  if (
    typeof value === 'string' &&
    (value === 'yes' || value === 'no' || value === 'discuss')
  ) {
    display = getRegistrationValueLabel(name, value, language);
  }

  return (
    <div key={name} className={fieldRow}>
      <span className={fieldLabel}>{label}</span>
      <span className={fieldValue}>{display}</span>
    </div>
  );
}

/** Render all fields for one section. */
function renderSection(
  language: Language,
  title: string,
  fields: { name: string }[],
  formData: Record<string, unknown>
): JSX.Element | null {
  const rows = fields.map((f) =>
    renderField(language, f.name, formData[f.name])
  ).filter(Boolean);

  if (rows.length === 0) return null;

  return (
    <div>
      <h3 className={sectionTitle}>{title}</h3>
      <div className='space-y-2'>{rows}</div>
    </div>
  );
}

interface RegistrationDetailsProps {
  formData: Record<string, unknown> | undefined;
  open: boolean;
  onClose: () => void;
}

export function RegistrationDetails({
  formData,
  open,
  onClose,
}: RegistrationDetailsProps) {
  const { language } = useLanguage();

  if (!open) return null;

  const fd = formData ?? {};

  return (
    <div className={modalOverlay} onClick={onClose}>
      <div className={modalBackdrop} onClick={onClose} />
      <div className={modalPanel} onClick={(e) => e.stopPropagation()}>
        <button type='button' className={closeButton} onClick={onClose}>
          ✕
        </button>

        <h2 className='text-lg font-semibold mb-6'>Registration Details</h2>

        {/* Personal & contact */}
        {renderSection(
          language,
          'Personal & contact',
          registrationSections[0]?.fields ?? [],
          fd
        )}

        {/* Family background */}
        {renderSection(
          language,
          'Family background',
          registrationSections[1]?.fields ?? [],
          fd
        )}

        {/* Preferences & lifestyle */}
        {renderSection(
          language,
          'Preferences & lifestyle',
          registrationSections[2]?.fields ?? [],
          fd
        )}

        {/* About yourself */}
        {renderSection(
          language,
          'About yourself',
          registrationSections[3]?.fields ?? [],
          fd
        )}

        {/* Member details (family member registration) */}
        {renderSection(language, 'Member details', memberFields, fd)}

        {/* Siblings (rendered from the `siblings` array in form_data) */}
        {(() => {
          const siblings = fd.siblings as unknown[] ?? [];
          if (siblings.length === 0) return null;
          return (
            <div>
              <h3 className={sectionTitle}>Siblings</h3>
              {siblings.map((sib, idx) => (
                <div key={idx} className='mb-3 p-2 bg-muted/20 rounded border border-border/50'>
                  <h4 className={fieldLabel}>Sibling {idx + 1}</h4>
                  <div className='space-y-2'>
                    {renderSection(
                      language,
                      '',
                      siblingFields,
                      sib as Record<string, unknown>
                    )}
                  </div>
                </div>
              ))}
            </div>
          );
        })()}

        {/* Documents & payment */}
        <div>
          <h3 className={sectionTitle}>Documents & payment</h3>
          <div className='space-y-2'>
            {renderField(language, 'photo', fd.photo)}
            {renderField(language, 'idCard', fd.idCard)}
            {renderField(language, 'paymentMethod', fd.paymentMethod)}
            {renderField(language, 'transactionId', fd.transactionId)}
            {renderField(language, 'senderNumber', fd.senderNumber)}
          </div>
        </div>
      </div>
    </div>
  );
}