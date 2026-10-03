/** 125 → "2:05" */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

const dayFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const timeFmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });

/** "2026-02-10" → "10 Feb" */
export function formatDay(date: string): string {
  return dayFmt.format(new Date(`${date}T00:00:00Z`));
}

/** ISO → "10 Feb, 14:32 UTC" */
export function formatMatchStart(iso: string): string {
  const d = new Date(iso);
  return `${dayFmt.format(d)}, ${timeFmt.format(d)} UTC`;
}

export function formatTime(iso: string): string {
  return timeFmt.format(new Date(iso));
}
