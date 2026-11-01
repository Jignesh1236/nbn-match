export function isValidEventCapacity(capacity: number): boolean {
  return Number.isInteger(capacity) && capacity >= 0 && capacity % 2 === 0;
}

export function getGenderCapacity(maxParticipants: number): number | null {
  return maxParticipants > 0 ? maxParticipants / 2 : null;
}

export function getGenderSpotsRemaining(maxParticipants: number, registered: number): number | null {
  const capacity = getGenderCapacity(maxParticipants);
  return capacity === null ? null : Math.max(0, capacity - registered);
}
