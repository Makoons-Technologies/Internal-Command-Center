export const CADENCES = ["daily", "weekly", "monthly", "once"] as const;
export type Cadence = (typeof CADENCES)[number];

export const CARD_STATUSES = ["open", "ready", "blocked", "done"] as const;
export type CardStatus = (typeof CARD_STATUSES)[number];

export const FUNCTION_OWNERS = [
  "eng",
  "marketing",
  "sales",
  "support",
  "books",
  "coo",
] as const;
export type FunctionOwner = (typeof FUNCTION_OWNERS)[number];

export const HORIZONS = ["today", "week", "month"] as const;
export type Horizon = (typeof HORIZONS)[number];

export const CHECKLIST_VIEWS = ["today", "weekly", "monthly"] as const;
export type ChecklistView = (typeof CHECKLIST_VIEWS)[number];

export interface ChecklistItem {
  id: string;
  title: string;
  done: boolean;
  /** ISO date YYYY-MM-DD the item is planned for. */
  plannedDate: string;
  sortOrder: number;
  updatedAt: string;
  createdAt: string;
}

export const STATUS_SORT: Record<CardStatus, number> = {
  blocked: 0,
  ready: 1,
  open: 2,
  done: 3,
};

export interface CommandCard {
  /** Stable unique id (uuid or slug). */
  id: string;
  /** Short human title. */
  title: string;
  /** Function lane. */
  owner: FunctionOwner;
  /** Planning horizon / recurrence intent. */
  cadence: Cadence;
  /** Workflow state. */
  status: CardStatus;
  /** When true, surfaces on Home → Needs Joseph. */
  needsJoseph: boolean;
  /** Concrete next action (one line preferred). */
  nextStep: string;
  /** Optional deep link (PR, Linear, Canva, Stripe, get-started, etc.). */
  link?: string;
  /** ISO date YYYY-MM-DD when relevant. */
  dueDate?: string;
  /** Free-form labels, e.g. ['joseph-pick', 'BETA', 'qa']. */
  tags?: string[];
  /** Which agent last wrote the card, if any. */
  sourceAgent?: string;
  /** ISO-8601 timestamps. */
  updatedAt: string;
  createdAt: string;
}

export type UpsertCardInput = Pick<
  CommandCard,
  "id" | "title" | "owner" | "cadence" | "status" | "needsJoseph" | "nextStep"
> &
  Partial<
    Pick<CommandCard, "link" | "dueDate" | "tags" | "sourceAgent" | "createdAt">
  >;

export function isCadence(value: unknown): value is Cadence {
  return CADENCES.includes(value as Cadence);
}

export function isCardStatus(value: unknown): value is CardStatus {
  return CARD_STATUSES.includes(value as CardStatus);
}

export function isFunctionOwner(value: unknown): value is FunctionOwner {
  return FUNCTION_OWNERS.includes(value as FunctionOwner);
}

export function isHorizon(value: unknown): value is Horizon {
  return HORIZONS.includes(value as Horizon);
}

export function parseCommandCard(value: unknown): CommandCard {
  if (!value || typeof value !== "object") {
    throw new Error("CommandCard must be an object");
  }

  const raw = value as Record<string, unknown>;
  if (typeof raw.id !== "string" || raw.id.length === 0) {
    throw new Error("CommandCard.id is required");
  }
  if (typeof raw.title !== "string" || raw.title.length === 0) {
    throw new Error("CommandCard.title is required");
  }
  if (!isFunctionOwner(raw.owner)) {
    throw new Error(`Invalid CommandCard.owner: ${String(raw.owner)}`);
  }
  if (!isCadence(raw.cadence)) {
    throw new Error(`Invalid CommandCard.cadence: ${String(raw.cadence)}`);
  }
  if (!isCardStatus(raw.status)) {
    throw new Error(`Invalid CommandCard.status: ${String(raw.status)}`);
  }
  if (typeof raw.needsJoseph !== "boolean") {
    throw new Error("CommandCard.needsJoseph must be a boolean");
  }
  if (typeof raw.nextStep !== "string") {
    throw new Error("CommandCard.nextStep is required");
  }
  if (typeof raw.updatedAt !== "string" || typeof raw.createdAt !== "string") {
    throw new Error("CommandCard timestamps are required");
  }

  const card: CommandCard = {
    id: raw.id,
    title: raw.title,
    owner: raw.owner,
    cadence: raw.cadence,
    status: raw.status,
    needsJoseph: raw.needsJoseph,
    nextStep: raw.nextStep,
    updatedAt: raw.updatedAt,
    createdAt: raw.createdAt,
  };

  if (typeof raw.link === "string" && raw.link.length > 0) {
    card.link = raw.link;
  }
  if (typeof raw.dueDate === "string" && raw.dueDate.length > 0) {
    card.dueDate = raw.dueDate;
  }
  if (Array.isArray(raw.tags)) {
    card.tags = raw.tags.filter((tag): tag is string => typeof tag === "string");
  }
  if (typeof raw.sourceAgent === "string" && raw.sourceAgent.length > 0) {
    card.sourceAgent = raw.sourceAgent;
  }

  return card;
}
