export const BUSINESS_TYPES = [
  "nails",
  "spa",
  "hair",
  "barber",
  "other",
] as const;
export type BusinessType = (typeof BUSINESS_TYPES)[number];

export const BUSINESS_STATUSES = [
  "target",
  "hold",
  "skipped",
  "contacted",
  "greenlit",
] as const;
export type BusinessStatus = (typeof BUSINESS_STATUSES)[number];

export const GREENLIT_REASONS = ["auto", "manual"] as const;
export type GreenlitReason = (typeof GREENLIT_REASONS)[number];

export const SALES_TIME_ZONE = "America/Chicago";

export const SEEDED_TAGS = [
  "nails",
  "hair",
  "barber",
  "spa",
  "springfield",
  "nixa",
  "ozark",
  "republic",
  "no-booking",
  "hold",
  "target",
] as const;

export interface BusinessNote {
  id: string;
  body: string;
  createdAt: string;
}

export interface SalesBusiness {
  id: string;
  name: string;
  type: BusinessType;
  address?: string;
  city?: string;
  phone?: string;
  website?: string;
  instagram?: string;
  tags: string[];
  notes: BusinessNote[];
  reminderAt?: string;
  reminderNote?: string;
  status: BusinessStatus;
  greenlit: boolean;
  greenlitReason?: GreenlitReason;
  updatedAt: string;
  createdAt: string;
}

export type UpsertBusinessInput = {
  id?: string;
  name: string;
  type: BusinessType;
  address?: string | null;
  city?: string | null;
  phone?: string | null;
  website?: string | null;
  instagram?: string | null;
  tags?: string[];
  status?: BusinessStatus;
  reminderAt?: string | null;
  reminderNote?: string | null;
};

export type ListBusinessesFilter = {
  tags?: string[];
  reminder?: "overdue" | "today";
  greenlit?: boolean;
  status?: BusinessStatus;
  type?: BusinessType;
};

export function isBusinessType(value: unknown): value is BusinessType {
  return BUSINESS_TYPES.includes(value as BusinessType);
}

export function isBusinessStatus(value: unknown): value is BusinessStatus {
  return BUSINESS_STATUSES.includes(value as BusinessStatus);
}

export function isGreenlitReason(value: unknown): value is GreenlitReason {
  return GREENLIT_REASONS.includes(value as GreenlitReason);
}

function optionalTrim(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeInstagram(value: unknown): string | undefined {
  const handle = optionalTrim(value);
  if (!handle) return undefined;
  return handle.replace(/^@+/, "");
}

export function normalizeTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  const seen = new Set<string>();
  const next: string[] = [];
  for (const tag of tags) {
    if (typeof tag !== "string") continue;
    const cleaned = tag.trim().toLowerCase().replace(/\s+/g, "-");
    if (!cleaned || seen.has(cleaned)) continue;
    seen.add(cleaned);
    next.push(cleaned);
  }
  return next;
}

export function parseTagsInput(value: string): string[] {
  return normalizeTags(
    value
      .split(/[,]+/)
      .map((tag) => tag.trim())
      .filter(Boolean),
  );
}

export function parseNotes(value: unknown): BusinessNote[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const raw = item as Record<string, unknown>;
      const body = optionalTrim(raw.body);
      if (!body) return null;
      return {
        id:
          typeof raw.id === "string" && raw.id.length > 0
            ? raw.id
            : crypto.randomUUID(),
        body,
        createdAt:
          typeof raw.createdAt === "string" && raw.createdAt.length > 0
            ? raw.createdAt
            : new Date().toISOString(),
      } satisfies BusinessNote;
    })
    .filter((note): note is BusinessNote => note !== null);
}

export function slugifyBusinessId(name: string): string {
  const slug = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug || "business";
}

export function hasEnoughWalkInData(business: {
  name: string;
  address?: string;
  phone?: string;
  type?: BusinessType;
  status: BusinessStatus;
}): boolean {
  return (
    business.status === "target" &&
    Boolean(business.name.trim()) &&
    Boolean(business.address?.trim()) &&
    Boolean(business.phone?.trim()) &&
    Boolean(business.type)
  );
}

export function resolveGreenlight(
  next: Pick<
    SalesBusiness,
    "name" | "address" | "phone" | "type" | "status" | "greenlit" | "greenlitReason"
  >,
  existing?: Pick<
    SalesBusiness,
    "name" | "address" | "phone" | "type" | "status" | "greenlit" | "greenlitReason"
  > | null,
  explicit?: boolean,
): { greenlit: boolean; greenlitReason?: GreenlitReason } {
  if (explicit === true) {
    return { greenlit: true, greenlitReason: "manual" };
  }
  if (explicit === false) {
    return { greenlit: false };
  }

  const nextQualifies = hasEnoughWalkInData(next);
  const prevQualifies = existing ? hasEnoughWalkInData(existing) : false;

  if (nextQualifies && !prevQualifies) {
    return { greenlit: true, greenlitReason: "auto" };
  }
  if (!nextQualifies && existing?.greenlitReason === "auto") {
    return { greenlit: false };
  }
  if (existing?.greenlit) {
    return {
      greenlit: true,
      greenlitReason: existing.greenlitReason,
    };
  }
  return { greenlit: false };
}

export function parseSalesBusiness(value: unknown): SalesBusiness {
  if (!value || typeof value !== "object") {
    throw new Error("SalesBusiness must be an object");
  }

  const raw = value as Record<string, unknown>;
  if (typeof raw.id !== "string" || raw.id.length === 0) {
    throw new Error("SalesBusiness.id is required");
  }
  if (typeof raw.name !== "string" || raw.name.trim().length === 0) {
    throw new Error("SalesBusiness.name is required");
  }
  if (!isBusinessType(raw.type)) {
    throw new Error(`Invalid SalesBusiness.type: ${String(raw.type)}`);
  }
  if (!isBusinessStatus(raw.status)) {
    throw new Error(`Invalid SalesBusiness.status: ${String(raw.status)}`);
  }
  if (typeof raw.greenlit !== "boolean") {
    throw new Error("SalesBusiness.greenlit must be a boolean");
  }
  if (typeof raw.updatedAt !== "string" || typeof raw.createdAt !== "string") {
    throw new Error("SalesBusiness timestamps are required");
  }

  const business: SalesBusiness = {
    id: raw.id,
    name: raw.name.trim(),
    type: raw.type,
    tags: normalizeTags(raw.tags),
    notes: parseNotes(raw.notes),
    status: raw.status,
    greenlit: raw.greenlit,
    updatedAt: raw.updatedAt,
    createdAt: raw.createdAt,
  };

  const address = optionalTrim(raw.address);
  const city = optionalTrim(raw.city);
  const phone = optionalTrim(raw.phone);
  const website = optionalTrim(raw.website);
  const instagram = normalizeInstagram(raw.instagram);
  const reminderAt = optionalTrim(raw.reminderAt);
  const reminderNote = optionalTrim(raw.reminderNote);

  if (address) business.address = address;
  if (city) business.city = city;
  if (phone) business.phone = phone;
  if (website) business.website = website;
  if (instagram) business.instagram = instagram;
  if (reminderAt) business.reminderAt = reminderAt;
  if (reminderNote) business.reminderNote = reminderNote;
  if (isGreenlitReason(raw.greenlitReason)) {
    business.greenlitReason = raw.greenlitReason;
  }

  return business;
}

function zonedParts(date: Date, timeZone = SALES_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "0";
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")),
    minute: Number(get("minute")),
  };
}

function stamp(parts: {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}): number {
  return (
    parts.year * 1e8 +
    parts.month * 1e6 +
    parts.day * 1e4 +
    parts.hour * 100 +
    parts.minute
  );
}

export function chicagoTodayISO(now = new Date()): string {
  const parts = zonedParts(now);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

export function reminderDayISO(reminderAt: string): string {
  const parts = zonedParts(new Date(reminderAt));
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

export function isReminderOverdue(
  reminderAt: string | undefined,
  now = new Date(),
): boolean {
  if (!reminderAt) return false;
  return new Date(reminderAt).getTime() < now.getTime();
}

export function isReminderToday(
  reminderAt: string | undefined,
  now = new Date(),
): boolean {
  if (!reminderAt) return false;
  return reminderDayISO(reminderAt) === chicagoTodayISO(now);
}

export function formatChicagoDateTime(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: SALES_TIME_ZONE,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function toChicagoDateTimeLocal(iso: string): string {
  const parts = zonedParts(new Date(iso));
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}T${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`;
}

export function fromChicagoDateTimeLocal(local: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(local);
  if (!match) {
    throw new Error("Reminder must be YYYY-MM-DDTHH:mm in America/Chicago");
  }
  const wanted = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
  };
  let utc = Date.UTC(
    wanted.year,
    wanted.month - 1,
    wanted.day,
    wanted.hour + 6,
    wanted.minute,
  );
  for (let i = 0; i < 4; i += 1) {
    const got = zonedParts(new Date(utc));
    if (stamp(got) === stamp(wanted)) break;
    const gotUtc = Date.UTC(got.year, got.month - 1, got.day, got.hour, got.minute);
    const wantUtc = Date.UTC(
      wanted.year,
      wanted.month - 1,
      wanted.day,
      wanted.hour,
      wanted.minute,
    );
    utc += wantUtc - gotUtc;
  }
  return new Date(utc).toISOString();
}

export function filterBusinesses(
  businesses: SalesBusiness[],
  filter: ListBusinessesFilter = {},
  now = new Date(),
): SalesBusiness[] {
  return businesses.filter((business) => {
    if (
      filter.tags?.length &&
      !filter.tags.every((tag) => business.tags.includes(tag))
    ) {
      return false;
    }
    if (filter.greenlit !== undefined && business.greenlit !== filter.greenlit) {
      return false;
    }
    if (filter.status && business.status !== filter.status) return false;
    if (filter.type && business.type !== filter.type) return false;
    if (filter.reminder === "overdue" && !isReminderOverdue(business.reminderAt, now)) {
      return false;
    }
    if (filter.reminder === "today" && !isReminderToday(business.reminderAt, now)) {
      return false;
    }
    return true;
  });
}

export function sortBusinesses(
  businesses: SalesBusiness[],
  now = new Date(),
): SalesBusiness[] {
  return [...businesses].sort((a, b) => {
    const aOverdue = isReminderOverdue(a.reminderAt, now) ? 0 : 1;
    const bOverdue = isReminderOverdue(b.reminderAt, now) ? 0 : 1;
    if (aOverdue !== bOverdue) return aOverdue - bOverdue;
    const aToday = isReminderToday(a.reminderAt, now) ? 0 : 1;
    const bToday = isReminderToday(b.reminderAt, now) ? 0 : 1;
    if (aToday !== bToday) return aToday - bToday;
    return a.name.localeCompare(b.name);
  });
}

export function collectBusinessTags(businesses: SalesBusiness[]): string[] {
  const tags = new Set<string>();
  for (const business of businesses) {
    for (const tag of business.tags) tags.add(tag);
  }
  return [...tags].sort((a, b) => a.localeCompare(b));
}

export function instagramUrl(handle: string): string {
  return `https://instagram.com/${handle.replace(/^@+/, "")}`;
}

export function instagramLabel(handle: string): string {
  return `@${handle.replace(/^@+/, "")}`;
}
