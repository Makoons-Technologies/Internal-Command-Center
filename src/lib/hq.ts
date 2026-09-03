import {
  isReminderOverdue,
  isReminderToday,
  SALES_TIME_ZONE,
  type SalesBusiness,
} from "@/lib/business";
import { getBlockedCards, getNeedsJosephCards, isNeedsJosephCard } from "@/lib/filters";
import { isRecurringCadence } from "@/lib/recurring";
import {
  FUNCTION_OWNERS,
  type CommandCard,
  type FunctionOwner,
} from "@/lib/schema";

export const FUNCTION_LEAD_OWNERS = [
  "eng",
  "marketing",
  "sales",
  "support",
  "books",
] as const satisfies readonly FunctionOwner[];

export type FunctionLeadOwner = (typeof FUNCTION_LEAD_OWNERS)[number];

export const FUNCTION_META: Record<
  FunctionOwner,
  { label: string; blurb: string }
> = {
  eng: { label: "Engineering", blurb: "PRs, QA, and blockers" },
  marketing: { label: "Marketing", blurb: "Drafts and Joseph yes" },
  sales: { label: "Sales", blurb: "Trials, calls, and shops" },
  support: { label: "Support", blurb: "Tickets and decisions" },
  books: { label: "Books", blurb: "Charges and invoices" },
  coo: { label: "COO", blurb: "Personal ops" },
};

export type HqKpis = {
  openCards: number;
  needsJoseph: number;
  blockers: number;
  greenlit: number;
  dueReminders: number;
  recurring: { daily: number; weekly: number; monthly: number };
};

export type HqInsight =
  | { kind: "clear" }
  | { kind: "blocker" | "needsJoseph"; card: CommandCard };

export type FunctionStatus = {
  owner: FunctionOwner;
  label: string;
  blurb: string;
  open: number;
  needsJoseph: number;
  blockers: number;
};

export function chicagoClock(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: SALES_TIME_ZONE,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    hourCycle: "h23",
  }).formatToParts(now);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  const hour = Number(get("hour"));
  let greeting = "Good evening";
  if (hour >= 5 && hour < 12) greeting = "Good morning";
  else if (hour >= 12 && hour < 17) greeting = "Good afternoon";

  return {
    greeting,
    dateLabel: `${get("weekday")}, ${get("month")} ${get("day")}, ${get("year")}`,
    hour,
  };
}

export function computeHqKpis(
  cards: CommandCard[],
  businesses: SalesBusiness[],
  now = new Date(),
): HqKpis {
  const open = cards.filter((card) => card.status !== "done");
  const recurring = { daily: 0, weekly: 0, monthly: 0 };
  for (const card of open) {
    if (isRecurringCadence(card.cadence)) {
      recurring[card.cadence] += 1;
    }
  }

  return {
    openCards: open.length,
    needsJoseph: getNeedsJosephCards(cards).length,
    blockers: getBlockedCards(cards).length,
    greenlit: businesses.filter((business) => business.greenlit).length,
    dueReminders: businesses.filter(
      (business) =>
        isReminderOverdue(business.reminderAt, now) ||
        isReminderToday(business.reminderAt, now),
    ).length,
    recurring,
  };
}

export function pickHqInsight(cards: CommandCard[]): HqInsight {
  const needsJoseph = getNeedsJosephCards(cards);
  const blockers = getBlockedCards(cards);
  const blockedJoseph = needsJoseph.find((card) => card.status === "blocked");
  if (blockedJoseph) return { kind: "blocker", card: blockedJoseph };
  if (blockers[0]) return { kind: "blocker", card: blockers[0] };
  if (needsJoseph[0]) return { kind: "needsJoseph", card: needsJoseph[0] };
  return { kind: "clear" };
}

export function functionStatuses(cards: CommandCard[]): FunctionStatus[] {
  return FUNCTION_OWNERS.map((owner) => {
    const open = cards.filter(
      (card) => card.owner === owner && card.status !== "done",
    );
    return {
      owner,
      label: FUNCTION_META[owner].label,
      blurb: FUNCTION_META[owner].blurb,
      open: open.length,
      needsJoseph: open.filter(isNeedsJosephCard).length,
      blockers: open.filter((card) => card.status === "blocked").length,
    };
  });
}

export function dueReminderShops(
  businesses: SalesBusiness[],
  now = new Date(),
): SalesBusiness[] {
  return businesses.filter(
    (business) =>
      isReminderOverdue(business.reminderAt, now) ||
      isReminderToday(business.reminderAt, now),
  );
}

export function matchesHqQuery(
  query: string,
  parts: Array<string | undefined | null>,
): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return parts.some((part) => part?.toLowerCase().includes(needle));
}

export function cardMatchesQuery(card: CommandCard, query: string): boolean {
  return matchesHqQuery(query, [
    card.title,
    card.nextStep,
    card.owner,
    FUNCTION_META[card.owner].label,
    card.status,
    card.cadence,
    card.dueDate,
    ...(card.tags ?? []),
  ]);
}

export function businessMatchesQuery(
  business: SalesBusiness,
  query: string,
): boolean {
  return matchesHqQuery(query, [
    business.name,
    business.type,
    business.city,
    business.status,
    business.reminderNote,
    ...business.tags,
  ]);
}
