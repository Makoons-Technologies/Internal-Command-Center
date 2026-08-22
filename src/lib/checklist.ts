import {
  addDaysISO,
  endOfMonth,
  endOfWeek,
  formatDayHeading,
  formatWeekHeading,
  inRange,
  monthWeeks,
  startOfMonth,
  startOfWeek,
  todayISO,
  weekDays,
} from "@/lib/dates";
import type { ChecklistItem, ChecklistView } from "@/lib/schema";

export type ChecklistSection = {
  key: string;
  plannedDate: string;
  label: string;
  items: ChecklistItem[];
};

export function sortChecklist(items: ChecklistItem[]): ChecklistItem[] {
  return [...items].sort((a, b) => {
    const dateDelta = a.plannedDate.localeCompare(b.plannedDate);
    if (dateDelta !== 0) return dateDelta;
    return a.sortOrder - b.sortOrder;
  });
}

export function checklistWindow(today = todayISO()): { from: string; to: string } {
  const from = startOfWeek(startOfMonth(today));
  const to = endOfWeek(endOfMonth(today));
  return { from, to };
}

export function buildChecklistSections(
  items: ChecklistItem[],
  view: ChecklistView,
  today = todayISO(),
): ChecklistSection[] {
  const sorted = sortChecklist(items);

  if (view === "today") {
    return [
      {
        key: today,
        plannedDate: today,
        label: formatDayHeading(today),
        items: sorted.filter((item) => item.plannedDate === today),
      },
    ];
  }

  if (view === "weekly") {
    const start = startOfWeek(today);
    return weekDays(start).map((date) => ({
      key: date,
      plannedDate: date,
      label: formatDayHeading(date),
      items: sorted.filter((item) => item.plannedDate === date),
    }));
  }

  return monthWeeks(today).map((week) => ({
    key: week.start,
    plannedDate: week.start,
    label: formatWeekHeading(week.start),
    items: sorted.filter((item) =>
      inRange(item.plannedDate, week.start, week.end),
    ),
  }));
}

export function plannedDateForSection(
  view: ChecklistView,
  sectionKey: string,
  today = todayISO(),
): string {
  if (view !== "monthly") return sectionKey;
  const weekEnd = addDaysISO(sectionKey, 6);
  if (inRange(today, sectionKey, weekEnd)) return today;
  return sectionKey;
}
