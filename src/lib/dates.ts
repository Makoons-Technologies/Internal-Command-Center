const WEEKDAY_LONG = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

export function todayISO(now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addDaysISO(iso: string, days: number): string {
  return todayISO(shiftDate(iso, days));
}

export function nowISO(): string {
  return new Date().toISOString();
}

export function parseISODate(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function shiftDate(iso: string, days: number): Date {
  const date = parseISODate(iso);
  date.setDate(date.getDate() + days);
  return date;
}

/** Monday-start ISO week. */
export function startOfWeek(iso: string): string {
  const date = parseISODate(iso);
  const day = date.getDay();
  const delta = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + delta);
  return todayISO(date);
}

export function endOfWeek(iso: string): string {
  return addDaysISO(startOfWeek(iso), 6);
}

export function startOfMonth(iso: string): string {
  const [year, month] = iso.split("-");
  return `${year}-${month}-01`;
}

export function endOfMonth(iso: string): string {
  const date = parseISODate(iso);
  return todayISO(new Date(date.getFullYear(), date.getMonth() + 1, 0));
}

export function weekDays(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, index) => addDaysISO(weekStart, index));
}

export function formatDayHeading(iso: string): string {
  const date = parseISODate(iso);
  return `${WEEKDAY_LONG[date.getDay()]}, ${MONTH_SHORT[date.getMonth()]} ${date.getDate()}`;
}

export function formatWeekHeading(weekStart: string): string {
  const start = parseISODate(weekStart);
  const end = parseISODate(addDaysISO(weekStart, 6));
  const sameMonth = start.getMonth() === end.getMonth();
  const startLabel = `${MONTH_SHORT[start.getMonth()]} ${start.getDate()}`;
  const endLabel = sameMonth
    ? `${end.getDate()}`
    : `${MONTH_SHORT[end.getMonth()]} ${end.getDate()}`;
  return `Week of ${startLabel}–${endLabel}`;
}

export function monthWeeks(iso: string): { start: string; end: string }[] {
  const first = startOfWeek(startOfMonth(iso));
  const last = endOfWeek(endOfMonth(iso));
  const weeks: { start: string; end: string }[] = [];
  let cursor = first;
  while (cursor <= last) {
    weeks.push({ start: cursor, end: addDaysISO(cursor, 6) });
    cursor = addDaysISO(cursor, 7);
  }
  return weeks;
}

export function inRange(iso: string, from: string, to: string): boolean {
  return iso >= from && iso <= to;
}
