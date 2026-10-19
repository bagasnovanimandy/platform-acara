/** Date (kolom @db.Date, UTC tengah malam) → `YYYY-MM-DD`. */
export function toIsoDate(date: Date | null | undefined): string | null {
  return date ? date.toISOString().slice(0, 10) : null;
}

/** `YYYY-MM-DD` → Date UTC tengah malam. */
export function fromIsoDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}
