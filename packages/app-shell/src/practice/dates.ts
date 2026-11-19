const LOCALE = 'en-US';
const TWO_DIGITS = 2;
const DAYS_AGO_LIMIT = 7;
const MS_PER_DAY = 86_400_000;

const weekday = new Intl.DateTimeFormat(LOCALE, { weekday: 'short' });
const shortMonth = new Intl.DateTimeFormat(LOCALE, { month: 'short' });
const longMonth = new Intl.DateTimeFormat(LOCALE, { month: 'long' });

export function weekdayName(at: Date): string {
  return weekday.format(at);
}

export function monthName(at: Date): string {
  return shortMonth.format(at);
}

export function fullMonthName(at: Date): string {
  return longMonth.format(at);
}

export function initial(name: string): string {
  return name.charAt(0);
}

export function clockTime(at: Date): string {
  const pad = (value: number) => String(value).padStart(TWO_DIGITS, '0');
  return `${pad(at.getHours())}:${pad(at.getMinutes())}`;
}

export function dayMonth(at: Date): string {
  return `${String(at.getDate())} ${monthName(at)}`;
}

export function weekdayDate(at: Date): string {
  return `${weekdayName(at)} ${dayMonth(at)}`;
}

function localMidnight(at: Date): number {
  return new Date(at.getFullYear(), at.getMonth(), at.getDate()).getTime();
}

export function daysBetween(earlier: Date, later: Date): number {
  return Math.round(
    (localMidnight(later) - localMidnight(earlier)) / MS_PER_DAY,
  );
}

export function isSameDay(a: Date, b: Date): boolean {
  return daysBetween(a, b) === 0;
}

export function daysAgoText(at: Date, now: Date): string | null {
  const days = daysBetween(at, now);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return days < DAYS_AGO_LIMIT ? `${String(days)} days ago` : null;
}
