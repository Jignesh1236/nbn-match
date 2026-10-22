import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, FileText, Heart } from 'lucide-react';
import { SiteHeader } from '@/components/site-header';
import { useLanguage, type Language } from '@/lib/language';
import {
  memberFields,
  registrationLabels,
  registrationSections,
  requiredByStep,
  siblingFields,
  type RegistrationFieldDefinition,
} from '@/lib/registration-copy';
import {
  clearError,
  clearSiblingErrors,
  collectPrivateFieldNames,
  removeSiblingAt,
  serializeSiblings,
  siblingFieldKey,
  validateSiblings,
} from '@/lib/registration-siblings';
import {
  getOpenEvent,
  submitRegistration,
  uploadDocument,
  type OpenEvent,
  type RegistrationInput,
} from '@/lib/registration-service';

type Values = Record<string, string>;

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];
const MAX_FILE_SIZE = 5 * 1024 * 1024;

function Field({
  field,
  fieldName,
  idPrefix = '',
  value,
  error,
  onChange,
  language,
}: {
  field: RegistrationFieldDefinition;
  /** Storage key for value state. Defaults to field.name; sibling cards pass `name-index`. */
  fieldName?: string;
  /** Keeps DOM ids and data-testids unique when the same definition renders more than once. */
  idPrefix?: string;
  value: string;
  error?: string;
  onChange: (name: string, value: string) => void;
  language: Language;
}) {
  const text = registrationLabels[language];
  const name = fieldName ?? field.name;
  const id = `field-${idPrefix}${field.name}`;
  return (
    <div className={`field${field.full ? ' full' : ''}`}>
      <label htmlFor={id} style={{ display: 'block', marginBottom: 4 }}>
        {field.label[language]}
        {field.required && <span aria-label={text.requiredAria}> *</span>}
        {field.badge && <span className="field-badge" aria-label={field.badge}>{field.badge}</span>}
      </label>
      {field.type === 'textarea' ? (
        <textarea
          id={id}
          value={value || ''}
          placeholder={field.placeholder?.[language]}
          onChange={e => onChange(name, e.target.value)}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          data-testid={`input-${idPrefix}${field.name}`}
        />
      ) : field.type === 'select' ? (
        <select
          id={id}
          value={value || ''}
          onChange={e => onChange(name, e.target.value)}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          data-testid={`input-${idPrefix}${field.name}`}
        >
          {(field.options || []).map(option => (
            <option key={option.value} value={option.value}>{option.label[language]}</option>
          ))}
        </select>
      ) : (
        <input
          id={id}
          type={field.type || 'text'}
          value={value || ''}
          placeholder={field.placeholder?.[language]}
          onChange={e => onChange(name, e.target.value)}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          data-testid={`input-${idPrefix}${field.name}`}
        />
      )}
      {error && <span id={`${id}-error`} className="field-error" role="alert">{error}</span>}
    </div>
  );
}

/** Creates one object URL per file and revokes it on change/unmount so nothing leaks. */
function useObjectUrl(file: File | null): string | null {
  const url = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  return url;
}

function LocalPreview({ file }: { file: File }) {
  const url = useObjectUrl(file);
  if (!url) return null;
  return (
    <img
      src={url}
      alt={file.name}
      draggable={false}
      style={{ width: 34, height: 34, objectFit: 'cover', borderRadius: 4 }}
    />
  );
}
function FilePicker({
  label,
  file,
  onChange,
  onRemove,
  language,
}: {
  label: string;
  file: File | null;
  onChange: (file: File | null) => void;
  onRemove: () => void;
  language: Language;
}) {
  const text = registrationLabels[language];
  return (
    <div style={{ marginTop: 12, padding: 12, border: '1px solid #ddcbd1', borderRadius: 9, background: '#fffdfa' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <FileText size={18} color="#9b3157" />
        <strong style={{ color: '#5d3446' }}>{label}</strong>
      </div>
      {file ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {file.type.startsWith('image/') ? <LocalPreview file={file} /> : <FileText size={18} />}
          <span style={{ fontSize: '0.88rem', color: '#452b36' }}>{file.name}</span>
          <span style={{ fontSize: '0.8rem', color: '#806f76' }}>{(file.size / 1024 / 1024).toFixed(1)} MB</span>
          <button
            type="button"
            onClick={onRemove}
            aria-label={`${text.removeFile}: ${file.name}`}
            style={{ marginLeft: 'auto', background: 'none', border: 0, color: '#a52246', cursor: 'pointer', fontSize: '0.85rem', textDecoration: 'underline' }}
          >
            {text.removeFile}
          </button>
        </div>
      ) : (
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 14px', border: '1px solid #ddcbd1', borderRadius: 7, background: '#fff', color: '#452b36', cursor: 'pointer', fontSize: '0.9rem' }}>
          {text.chooseFile}
          <input
            type="file"
            accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
            onChange={e => {
              const f = e.target.files?.[0] ?? null;
              if (!f) return;
              if (!ACCEPTED_TYPES.includes(f.type)) {
                alert(text.fileTypeError);
                return;
              }
              if (f.size > MAX_FILE_SIZE) {
                alert(text.fileSizeError);
                return;
              }
              onChange(f);
            }}
            style={{ display: 'none' }}
          />
        </label>
      )}
    </div>
  );
}

function RegistrationForm() {
  const { language } = useLanguage();
  const text = registrationLabels[language];
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<Values>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [idCardFile, setIdCardFile] = useState<File | null>(null);
  const [siblings, setSiblings] = useState<Record<string, string>[]>([]);
  const [consent, setConsent] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [senderNumber, setSenderNumber] = useState('');
  const [event, setEvent] = useState<OpenEvent>(null);
  const [eventError, setEventError] = useState<string | null>(null);
  const [loadingEvent, setLoadingEvent] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const section = registrationSections[step];
  const memberMode = values.registeringFor === 'family';

  const update = (name: string, value: string) => {
    setValues(old => ({ ...old, [name]: value }));
    setErrors(old => clearError(old, name));
  };

  const updateSibling = (index: number, name: string, value: string) => {
    setSiblings(old => {
      const next = [...old];
      next[index] = { ...next[index], [name]: value };
      return next;
    });
    setErrors(old => clearError(old, siblingFieldKey(name, index)));
  };

  const addSibling = () => setSiblings(old => [...old, {}]);
  const removeSibling = (index: number) => {
    setSiblings(old => removeSiblingAt(old, index));
    // Removing a card shifts the remaining cards down, so the index-based
    // error keys no longer point at the right card. Drop them and let the
    // next validation run rebuild them.
    setErrors(clearSiblingErrors);
  };

  useEffect(() => {
    let cancelled = false;
    async function loadEvent() {
      try {
        const ev = await getOpenEvent();
        if (!cancelled) setEvent(ev);
      } catch (err) {
        if (!cancelled) {
          setEventError(err instanceof Error && err.message ? err.message : text.eventLoadError);
        }
      } finally {
        if (!cancelled) setLoadingEvent(false);
      }
    }
    loadEvent();
    return () => { cancelled = true; };
    // Fetched once for the lifetime of the form; `text` only supplies a fallback string.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    document.title = `${text.titleSuffix} | NBN Match Making Event`;
  }, [text.titleSuffix]);

  const validate = () => {
    const next: Record<string, string> = {};
    (requiredByStep[step] || []).forEach(name => {
      if (!values[name]?.trim()) next[name] = text.requiredError;
    });
    if (step === 0 && values.phone && !/^[+\d][\d\s()-]{6,}$/.test(values.phone)) next.phone = text.phoneError;
    if (step === 0 && values.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(values.email)) next.email = text.emailError;
    if (step === 1) {
      // A half-filled sibling entry is an error; a completely empty one is just an unused card.
      Object.assign(next, validateSiblings(siblings, text.requiredError));
    }
    if (step === 4 && memberMode) {
      ['memberName', 'memberRelation'].forEach(name => {
        if (!values[name]?.trim()) next[name] = text.memberForError;
      });
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const nextStep = () => {
    if (validate()) {
      setStep(Math.min(step + 1, registrationSections.length - 1));
      setSubmitError(null);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const submit = async () => {
    if (!validate()) return;
    if (!event) {
      setSubmitError(text.registrationClosedError);
      return;
    }

    const paymentErrors: Record<string, string> = {};
    if (paymentMethod !== 'bkash' && paymentMethod !== 'nagad') paymentErrors.paymentMethod = text.paymentMethodError;
    if (!transactionId.trim()) paymentErrors.transactionId = text.transactionIdError;
    if (!senderNumber.trim()) paymentErrors.senderNumber = text.senderNumberError;
    if (!consent) paymentErrors.consent = text.consentError;
    if (Object.keys(paymentErrors).length > 0) {
      setErrors(old => ({ ...old, ...paymentErrors }));
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const photoPath = photoFile ? await uploadDocument(photoFile) : null;
      const idCardPath = idCardFile ? await uploadDocument(idCardFile) : null;

      const input: RegistrationInput = {
        event_id: event.id,
        gender: values.gender || 'other',
        private_fields: collectPrivateFieldNames(siblings.length),
        photo_path: photoPath,
        id_card_path: idCardPath,
        payment_method: paymentMethod,
        transaction_id: transactionId.trim(),
        sender_number: senderNumber.trim(),
        guardian_name: values.guardianName || null,
        guardian_phone: values.guardianPhone || null,
        guardian_age: values.guardianAge ? Number(values.guardianAge) : null,
        guardian_relation: values.guardianRelation || null,
        guardian_charge: 0,
        form_data: {
          ...values,
          // Siblings are stored under their bare field names so the admin
          // panel can read them with the regular field definitions.
          siblings: serializeSiblings(siblings),
          photo: photoFile?.name ?? null,
          idCard: idCardFile?.name ?? null,
          paymentMethod,
          transactionId: transactionId.trim(),
          senderNumber: senderNumber.trim(),
        },
      };

      await submitRegistration(input);
      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '';
      const friendly = message.includes('not open')
        ? text.eventClosedError
        : message.includes('maximum')
        ? text.eventFullError
        : message.includes('23505') || (err as { code?: string })?.code === '23505'
        ? text.duplicateTransactionError
        : text.submitFailedError;
      setSubmitError(friendly);
      setSubmitting(false);
    }
  };
  if (submitted) {
    return (
      <div className="form-page">
        <div className="form-top">
          <div className="container-wide">
            <span className="eyebrow">{text.brand}</span>
            <h1 style={{ fontSize: 'clamp(2rem,4vw,3rem)', color: '#55263b', margin: '8px 0' }}>
              {text.submittedTitle}
            </h1>
          </div>
        </div>
        <div className="container-wide form-layout" style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ textAlign: 'center', maxWidth: 500, padding: 40 }}>
            <Check size={48} color="#2e7d5b" style={{ marginBottom: 20 }} />
            <h2 style={{ color: '#55263b', marginBottom: 12 }}>{text.submittedHeading}</h2>
            <p style={{ color: '#75616a', lineHeight: 1.6, marginBottom: 24 }}>{text.submittedBody}</p>
            <Link to="/" className="button-outline" data-testid="link-registration-complete-home">{text.home}</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="form-page">
      <div className="form-top">
        <div className="container-wide">
          <span className="eyebrow">{text.brand}</span>
          <h1 style={{ fontSize: 'clamp(2rem,4vw,3rem)', color: '#55263b', margin: '8px 0' }}>{text.title}</h1>
          <p style={{ color: '#75616a', margin: 0 }}>{text.intro}</p>
          {event ? (
            <div style={{ marginTop: 16, padding: 14, background: '#fffaf7', borderRadius: 9, border: '1px solid #e8d9c8' }}>
              <strong style={{ color: '#5d3446' }}>{text.eventCodeLabel}</strong> {event.event_code}
              <span style={{ marginLeft: 16, color: '#75616a' }}>{text.priceLabel} {event.price}</span>
              {event.discount_price > 0 && (
                <span style={{ marginLeft: 12, color: '#2e7d5b' }}>{text.discountPriceLabel} {event.discount_price}</span>
              )}
            </div>
          ) : (
            <p
              style={{ marginTop: 16, padding: 14, background: '#f4f1f7', borderRadius: 9, border: '1px solid #e0d3e0', color: '#75616a', fontSize: '0.9rem' }}
              role="status"
              data-testid="status-no-open-event"
            >
              {loadingEvent ? text.loadingEvent : (eventError || text.noOpenEvent)}
            </p>
          )}
        </div>
      </div>
      <div className="container-wide form-layout">
        <aside className="form-aside" aria-label={text.progressTitle}>
          <h2 style={{ marginTop: 0 }}>{text.progressTitle}</h2>
          <ol className="progress-list">{registrationSections.map((s, i) => (
            <li key={s.title[language]} className={`${i === step ? 'current' : ''} ${i < step ? 'complete' : ''}`} aria-current={i === step ? 'step' : undefined}>
              <span className="progress-dot">{i < step ? <Check size={15} /> : i + 1}</span>
              <span>{s.title[language]}</span>
            </li>
          ))}
          </ol>
        </aside>
        <main className="form-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 15, alignItems: 'start' }}>
            <div>
              <span className="eyebrow">{text.step} {step + 1} / {registrationSections.length}</span>
              <h2 style={{ fontSize: '1.7rem', margin: '8px 0' }}>{section.title[language]}</h2>
              <p style={{ color: '#806f76', marginTop: 0 }}>{section.subtitle[language]}</p>
            </div>
            <Heart size={22} color="#b63861" aria-hidden="true" />
          </div>
          {step < 5 && (
            <div className="form-grid">
              {section.fields.map(field => (
                <Field
                  key={field.name}
                  field={field}
                  value={values[field.name] || ''}
                  error={errors[field.name]}
                  onChange={update}
                  language={language}
                />
              ))}
              {step === 4 && memberMode && memberFields.map(field => (
                <Field
                  key={field.name}
                  field={field}
                  value={values[field.name] || ''}
                  error={errors[field.name]}
                  onChange={update}
                  language={language}
                />
              ))}
            </div>
          )}

          {step === 1 && (
            <div className="sibling-section">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ color: '#5d3446', margin: 0, fontSize: '1.1rem' }}>{text.siblingsHeading}</h3>
                <button type="button" onClick={addSibling} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 0, color: '#b63861', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem' }}>
                  <span style={{ width: 20, height: 20, borderRadius: '50%', border: '1px solid #b63861', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', fontWeight: 700, color: '#b63861' }}>+</span>
                  {text.addSibling}
                </button>
              </div>
              {siblings.map((sibling, index) => (
                <div key={index} className="sibling-card">
                  <div style={{ color: '#b63861', fontWeight: 700, fontSize: '0.85rem', marginBottom: 12, marginLeft: 4 }}>{text.siblingCardLabel} {index + 1}</div>
                  <div className="form-grid" style={{ gap: '16px 12px' }}>
                    {siblingFields.map(field => {
                      const fieldName = `${field.name}-${index}`;
                      return (
                        <Field
                          key={fieldName}
                          field={field}
                          fieldName={fieldName}
                          idPrefix={`sibling-${index}-`}
                          value={sibling[field.name] || ''}
                          error={errors[fieldName]}
                          // The card stores values under the bare field name, so the
                          // index suffix of the storage key is stripped here.
                          onChange={(_name, val) => updateSibling(index, field.name, val)}
                          language={language}
                        />
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeSibling(index)}
                    aria-label={`${text.removeSibling} ${index + 1}`}
                    style={{ gridColumn: '1/-1', justifySelf: 'start', marginTop: 8, background: 'none', border: 0, color: '#a52246', cursor: 'pointer', fontSize: '0.85rem', textDecoration: 'underline' }}
                  >
                    {text.removeSibling}
                  </button>
                </div>
              ))}
            </div>
          )}
          {step === 5 && (
            <div>
              <div style={{ marginBottom: 16 }}>
                <FilePicker
                  label={text.photoLabel}
                  file={photoFile}
                  onChange={setPhotoFile}
                  onRemove={() => setPhotoFile(null)}
                  language={language}
                />
                <FilePicker
                  label={text.idCardLabel}
                  file={idCardFile}
                  onChange={setIdCardFile}
                  onRemove={() => setIdCardFile(null)}
                  language={language}
                />
              </div>

              <h3 style={{ color: '#55263b', marginTop: 24, marginBottom: 12 }}>{text.paymentDetails}</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label htmlFor="payment-method" style={{ display: 'block', marginBottom: 6, color: '#55263b', fontWeight: 600 }}>
                    {text.paymentMethodLabel}
                  </label>
                  <select
                    id="payment-method"
                    value={paymentMethod}
                    onChange={e => {
                      setPaymentMethod(e.target.value);
                      setErrors(old => (old.paymentMethod ? { ...old, paymentMethod: '' } : old));
                    }}
                    aria-invalid={!!errors.paymentMethod}
                    aria-describedby={errors.paymentMethod ? 'payment-method-error' : undefined}
                    style={{ width: '100%', padding: 10, borderRadius: 7, border: '1px solid #ddcbd1' }}
                  >
                    <option value="">{text.selectOption}</option>
                    <option value="bkash">bKash</option>
                    <option value="nagad">Nagad</option>
                  </select>
                  {errors.paymentMethod && <span id="payment-method-error" className="field-error" role="alert">{errors.paymentMethod}</span>}
                </div>
                <div>
                  <label htmlFor="transaction-id" style={{ display: 'block', marginBottom: 6, color: '#55263b', fontWeight: 600 }}>
                    {text.transactionIdLabel}
                  </label>
                  <input
                    id="transaction-id"
                    type="text"
                    value={transactionId}
                    onChange={e => {
                      setTransactionId(e.target.value);
                      setErrors(old => (old.transactionId ? { ...old, transactionId: '' } : old));
                    }}
                    placeholder={text.transactionIdPlaceholder}
                    aria-invalid={!!errors.transactionId}
                    aria-describedby={errors.transactionId ? 'transaction-id-error' : undefined}
                    style={{ width: '100%', padding: 10, borderRadius: 7, border: '1px solid #ddcbd1' }}
                  />
                  {errors.transactionId && <span id="transaction-id-error" className="field-error" role="alert">{errors.transactionId}</span>}
                </div>
                <div style={{ gridColumn: '1/-1' }}>
                  <label htmlFor="sender-number" style={{ display: 'block', marginBottom: 6, color: '#55263b', fontWeight: 600 }}>
                    {text.senderNumberLabel}
                  </label>
                  <input
                    id="sender-number"
                    type="tel"
                    value={senderNumber}
                    onChange={e => {
                      setSenderNumber(e.target.value);
                      setErrors(old => (old.senderNumber ? { ...old, senderNumber: '' } : old));
                    }}
                    placeholder={text.senderNumberPlaceholder}
                    aria-invalid={!!errors.senderNumber}
                    aria-describedby={errors.senderNumber ? 'sender-number-error' : undefined}
                    style={{ width: '100%', padding: 10, borderRadius: 7, border: '1px solid #ddcbd1' }}
                  />
                  {errors.senderNumber && <span id="sender-number-error" className="field-error" role="alert">{errors.senderNumber}</span>}
                </div>
              </div>

              <div style={{ marginTop: 20, padding: 14, background: '#fffaf7', borderRadius: 9, border: '1px solid #e8d9c8' }}>
                <label style={{ display: 'flex', alignItems: 'start', gap: 10, cursor: 'pointer', fontSize: '0.9rem', lineHeight: 1.5 }}>
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={e => {
                      setConsent(e.target.checked);
                      setErrors(old => (old.consent ? { ...old, consent: '' } : old));
                    }}
                    aria-invalid={!!errors.consent}
                    aria-describedby={errors.consent ? 'consent-error' : undefined}
                    style={{ marginTop: 2 }}
                  />
                  <span>{text.consentText}</span>
                </label>
                {errors.consent && <span id="consent-error" style={{ color: '#a52246', fontSize: '0.85rem', marginTop: 6, display: 'block' }} role="alert">{errors.consent}</span>}
              </div>

              <div style={{ marginTop: 20, padding: 14, background: '#f4f1f7', borderRadius: 9, border: '1px solid #e0d3e0' }}>
                <small style={{ color: '#75616a' }}>{text.privateBucketNote}</small>
              </div>
            </div>
          )}
          {submitError && (
            <div role="status" aria-live="polite" className="form-warning" style={{ marginTop: 20, color: '#a52246' }} data-testid="status-registration">
              {submitError}
            </div>
          )}
          <div className="form-actions">
            {step > 0 ? (
              <button
                type="button"
                className="button-outline"
                onClick={() => { setStep(step - 1); setSubmitError(null); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                data-testid="button-previous"
              >
                <ArrowLeft size={17} /> {text.previous}
              </button>
            ) : (
              <Link to="/" className="button-outline" data-testid="link-cancel-registration">
                {text.home}
              </Link>
            )}
            {step < registrationSections.length - 1 ? (
              <button type="button" className="button-primary" onClick={nextStep} disabled={submitting} data-testid="button-continue">
                {text.continue} <ArrowRight size={17} />
              </button>
            ) : (
              <button type="button" className="button-primary" onClick={submit} disabled={submitting} data-testid="button-submit-registration">
                {submitting ? text.submitting : text.submit} <ArrowRight size={17} />
              </button>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return <><SiteHeader /><RegistrationForm /></>;
}
