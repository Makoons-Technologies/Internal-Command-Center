import { addDaysISO, todayISO } from "@/lib/dates";
import {
  STATUS_SORT,
  type CommandCard,
  type FunctionOwner,
  type Horizon,
} from "@/lib/schema";

export function sortNeedsJoseph(cards: CommandCard[]): CommandCard[] {
  return [...cards].sort((a, b) => {
    const statusDelta = STATUS_SORT[a.status] - STATUS_SORT[b.status];
    if (statusDelta !== 0) return statusDelta;
    if (!a.dueDate && !b.dueDate) return 0;
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return a.dueDate.localeCompare(b.dueDate);
  });
}

export function sortByUpdatedAtDesc(cards: CommandCard[]): CommandCard[] {
  return [...cards].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function isNeedsJosephCard(card: CommandCard): boolean {
  return card.needsJoseph && card.status !== "done";
}

export function isTodayCard(card: CommandCard, today = todayISO()): boolean {
  if (card.status === "done") return false;
  if (card.cadence === "daily") return true;
  if (card.dueDate === today) return true;
  if (card.status === "blocked") return true;
  return false;
}

export function isWeekCard(card: CommandCard, today = todayISO()): boolean {
  if (card.status === "done") return false;
  if (card.cadence === "weekly") return true;
  if (card.dueDate) {
    const weekEnd = addDaysISO(today, 7);
    return card.dueDate >= today && card.dueDate <= weekEnd;
  }
  return false;
}

export function isMonthCard(card: CommandCard, today = todayISO()): boolean {
  if (card.status === "done") return false;
  if (card.cadence === "monthly") return true;
  if (card.dueDate) {
    const monthEnd = addDaysISO(today, 30);
    return card.dueDate >= today && card.dueDate <= monthEnd;
  }
  return false;
}

export function isHorizonCard(
  card: CommandCard,
  horizon: Horizon,
  today = todayISO(),
): boolean {
  if (horizon === "today") return isTodayCard(card, today);
  if (horizon === "week") return isWeekCard(card, today);
  return isMonthCard(card, today);
}

export function isFunctionCard(card: CommandCard, owner: FunctionOwner): boolean {
  return card.owner === owner && card.status !== "done";
}

export function getNeedsJosephCards(cards: CommandCard[]): CommandCard[] {
  return sortNeedsJoseph(cards.filter(isNeedsJosephCard));
}

export function getTodayCards(cards: CommandCard[], today = todayISO()): CommandCard[] {
  return sortNeedsJoseph(cards.filter((card) => isTodayCard(card, today)));
}

export function getBlockedCards(cards: CommandCard[]): CommandCard[] {
  return cards
    .filter((card) => card.status === "blocked")
    .sort((a, b) => a.title.localeCompare(b.title));
}
