/** A calendar month in UTC as the half-open window `[since, until)`. */
export interface MonthWindow {
  month: string;
  since: Date;
  until: Date;
}

/** Parse `YYYY-MM` (default: the current UTC month). Anything else is rejected. */
export function monthWindow(month: string | undefined, now: Date = new Date()): MonthWindow {
  const value = month ?? `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(value);
  if (!match) throw new RangeError('Month must look like 2026-11.');
  const year = Number(match[1]);
  const index = Number(match[2]) - 1;
  return { month: value, since: new Date(Date.UTC(year, index, 1)), until: new Date(Date.UTC(year, index + 1, 1)) };
}
