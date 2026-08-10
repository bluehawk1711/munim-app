/** Coerces a core date value (Date or ISO string) into a Date. */
export function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  return value instanceof Date ? value : new Date(value);
}
