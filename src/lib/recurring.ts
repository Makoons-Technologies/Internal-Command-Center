import { startOfMonth, startOfWeek, todayISO } from "@/lib/dates";
import type { Cadence, CommandCard } from "@/lib/schema";

export const RECURRING_CADENCES = ["daily", "weekly", "monthly"] as const;
export type RecurringCadence = (typeof RECURRING_CADENCES)[number];

export const RECURRING_SOURCE_AGENT = "recurring-ui";

export function isRecurringCadence(value: unknown): value is RecurringCadence {
  return RECURRING_CADENCES.includes(value as RecurringCadence);
}

export function isRecurringCard(card: Pick<CommandCard, "cadence">): boolean {
  return isRecurringCadence(card.cadence);
}

export function recurringChecklistId(cardId: string): string {
  return `recurring:${cardId}`;
}

export function plannedDateForCadence(
  cadence: RecurringCadence,
  today = todayISO(),
): string {
  if (cadence === "daily") return today;
  if (cadence === "weekly") return startOfWeek(today);
  return startOfMonth(today);
}

export function slugifyCardId(title: string): string {
  const slug = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug || "card";
}

export function parseCardTags(value: string): string[] {
  return value
    .split(/[,]+/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export function groupRecurringCards(
  cards: CommandCard[],
): Record<RecurringCadence, CommandCard[]> {
  const groups: Record<RecurringCadence, CommandCard[]> = {
    daily: [],
    weekly: [],
    monthly: [],
  };
  for (const card of cards) {
    if (isRecurringCadence(card.cadence)) {
      groups[card.cadence].push(card);
    }
  }
  for (const cadence of RECURRING_CADENCES) {
    groups[cadence].sort((a, b) => a.title.localeCompare(b.title));
  }
  return groups;
}

export function cadenceLabel(cadence: Cadence): string {
  return cadence[0].toUpperCase() + cadence.slice(1);
}
