const DAY_MS = 24 * 60 * 60 * 1000;

export function utcDateKey(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function previousUtcDate(dateKey: string): string {
  return new Date(Date.parse(`${dateKey}T00:00:00.000Z`) - DAY_MS).toISOString().slice(0, 10);
}

export function dailyCloseAt(dateKey: string): string {
  return new Date(Date.parse(`${dateKey}T00:00:00.000Z`) + DAY_MS).toISOString();
}

export function dailyIndex(dateKey: string, length: number): number {
  if (length < 1) return -1;
  const dayNumber = Math.floor(Date.parse(`${dateKey}T00:00:00.000Z`) / DAY_MS);
  return ((dayNumber % length) + length) % length;
}

export function effectiveCloseAt(
  dilemmaCloseAt: string | null,
  dailyClose: string | null,
): string | null {
  if (!dilemmaCloseAt) return dailyClose;
  if (!dailyClose) return dilemmaCloseAt;
  return new Date(dilemmaCloseAt).getTime() <= new Date(dailyClose).getTime()
    ? dilemmaCloseAt
    : dailyClose;
}
