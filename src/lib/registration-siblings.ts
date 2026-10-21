import {
  memberFields,
  registrationSections,
  siblingFields,
  type RegistrationFieldDefinition,
} from './registration-copy.ts';

/**
 * Pure helpers for the public registration form's sibling cards.
 *
 * A sibling card stores its values under the **bare** field name (`siblingName`),
 * so the admin panel can read them with the very same field definitions it uses
 * everywhere else. The card index only shows up in UI-level keys: the
 * `fieldName-index` error keys and the private-field storage keys.
 */

/** Badge that marks a field as private. */
const PRIVATE_BADGE = 'PRIVATE';

/** One sibling card's values, keyed by the bare sibling field name. */
export type SiblingValues = Record<string, string>;

function isPrivateField(field: RegistrationFieldDefinition): boolean {
  return field.badge === PRIVATE_BADGE;
}

/** Names of every sibling field, used to recognise index-based error keys. */
export const siblingFieldNames: ReadonlySet<string> = new Set(
  siblingFields.map(field => field.name),
);

/** UI key of a sibling field: the bare field name plus the card index. */
export function siblingFieldKey(fieldName: string, index: number): string {
  return `${fieldName}-${index}`;
}

/** Split a sibling UI key back into its field name and card index. */
export function parseSiblingFieldKey(key: string): { fieldName: string; index: number } | null {
  const match = /^(.*)-(\d+)$/.exec(key);
  if (!match) return null;
  const [, fieldName, rawIndex] = match;
  if (!siblingFieldNames.has(fieldName)) return null;
  return { fieldName, index: Number(rawIndex) };
}

/** Storage keys of every private field for the current sibling count (sibling keys are suffixed `-index`). */
export function collectPrivateFieldNames(siblingCount: number): string[] {
  const names = new Set<string>();
  for (const section of registrationSections) {
    for (const field of section.fields) {
      if (isPrivateField(field)) names.add(field.name);
    }
  }
  for (const field of memberFields) {
    if (isPrivateField(field)) names.add(field.name);
  }
  for (const field of siblingFields) {
    if (!isPrivateField(field)) continue;
    for (let index = 0; index < siblingCount; index += 1) {
      names.add(siblingFieldKey(field.name, index));
    }
  }
  return [...names];
}

/**
 * Validate the sibling cards. A half-filled card is an error; a completely
 * empty one is just an unused card. Errors are keyed by the indexed UI key so
 * each card can show its own message.
 */
export function validateSiblings(
  siblings: SiblingValues[],
  requiredMessage: string,
): Record<string, string> {
  const errors: Record<string, string> = {};
  siblings.forEach((sibling, index) => {
    const partiallyFilled = Object.entries(sibling).some(
      ([key, value]) => key !== 'siblingName' && value?.trim(),
    );
    if (partiallyFilled && !sibling.siblingName?.trim()) {
      errors[siblingFieldKey('siblingName', index)] = requiredMessage;
    }
  });
  return errors;
}

/** Remove the card at `index`; the cards after it shift down. */
export function removeSiblingAt(siblings: SiblingValues[], index: number): SiblingValues[] {
  return siblings.filter((_, i) => i !== index);
}

/**
 * Drop every sibling-indexed error key, keeping the other errors untouched.
 * Removing a card shifts the remaining cards down, so the index-based error
 * keys no longer point at the right card.
 */
export function clearSiblingErrors(errors: Record<string, string>): Record<string, string> {
  const next: Record<string, string> = {};
  let changed = false;
  for (const [key, value] of Object.entries(errors)) {
    if (parseSiblingFieldKey(key)) {
      changed = true;
      continue;
    }
    next[key] = value;
  }
  return changed ? next : errors;
}

/** Clear a single error key when it holds a message. */
export function clearError(errors: Record<string, string>, key: string): Record<string, string> {
  if (!errors[key]) return errors;
  return { ...errors, [key]: '' };
}

/**
 * Serialise the sibling cards for storage: only the bare field names survive,
 * never an indexed key. The admin panel reads these with the plain field
 * definitions, so an indexed key would silently drop the value.
 */
export function serializeSiblings(siblings: SiblingValues[]): SiblingValues[] {
  return siblings.map(sibling => {
    const plain: SiblingValues = {};
    for (const field of siblingFields) {
      const value = sibling[field.name];
      if (value !== undefined) plain[field.name] = value;
    }
    return plain;
  });
}
