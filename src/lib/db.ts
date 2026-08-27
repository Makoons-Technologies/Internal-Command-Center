import { mkdirSync } from "node:fs";
import path from "node:path";
import { createClient as createNodeClient, type Client, type Row } from "@libsql/client";
import { createClient as createWebClient } from "@libsql/client/web";
import {
  filterBusinesses,
  parseNotes,
  parseSalesBusiness,
  resolveGreenlight,
  slugifyBusinessId,
  sortBusinesses,
  type ListBusinessesFilter,
  type SalesBusiness,
  type UpsertBusinessInput,
} from "@/lib/business";
import { SEED_BUSINESSES } from "@/lib/business-seed";
import { checklistWindow } from "@/lib/checklist";
import { nowISO, todayISO } from "@/lib/dates";
import { sortByUpdatedAtDesc, sortNeedsJoseph } from "@/lib/filters";
import {
  parsePromptTemplate,
  type PromptTemplate,
  type PromptTemplateInput,
} from "@/lib/prompt-template";
import {
  parseCommandCard,
  type ChecklistItem,
  type CommandCard,
  type FunctionOwner,
  type UpsertCardInput,
} from "@/lib/schema";
import { buildSeedChecklist, SEED_CARDS } from "@/lib/seed";

const DB_DIR = path.join(process.cwd(), "data");
const LOCAL_DB = path.join(DB_DIR, "makoons.db");

let clientSingleton: Client | null = null;
let readyPromise: Promise<void> | null = null;
let initializing = false;

function localFileUrl(): string {
  return `file:${LOCAL_DB.replaceAll("\\", "/")}`;
}

function databaseUrl(): string {
  const hosted = process.env.TURSO_DATABASE_URL?.trim();
  if (hosted) return hosted;
  // Vercel has no persistent disk. /tmp boots the board until Turso is wired.
  if (process.env.VERCEL) return "file:/tmp/makoons.db";
  return localFileUrl();
}

export function getClient(): Client {
  if (clientSingleton) return clientSingleton;

  const url = databaseUrl();
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (url.startsWith("file:")) {
    mkdirSync(path.dirname(url.slice("file:".length)), { recursive: true });
    clientSingleton = createNodeClient({ url });
  } else {
    clientSingleton = createWebClient({ url, authToken });
  }
  return clientSingleton;
}

async function ensureReady(): Promise<Client> {
  const client = getClient();
  if (initializing) return client;
  if (!readyPromise) {
    readyPromise = initialize(client);
  }
  await readyPromise;
  return client;
}

async function initialize(client: Client): Promise<void> {
  initializing = true;
  try {
    await client.execute(`
    CREATE TABLE IF NOT EXISTS cards (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      owner TEXT NOT NULL,
      cadence TEXT NOT NULL,
      status TEXT NOT NULL,
      needsJoseph INTEGER NOT NULL,
      nextStep TEXT NOT NULL,
      link TEXT,
      dueDate TEXT,
      tags TEXT,
      sourceAgent TEXT,
      updatedAt TEXT NOT NULL,
      createdAt TEXT NOT NULL
    )
  `);
    await client.execute(`
    CREATE TABLE IF NOT EXISTS checklist (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      done INTEGER NOT NULL,
      plannedDate TEXT NOT NULL,
      sortOrder INTEGER NOT NULL,
      updatedAt TEXT NOT NULL,
      createdAt TEXT NOT NULL
    )
  `);
    await ensurePromptTemplatesTable(client);
    await ensureBusinessesTable(client);
    await seedIfEmpty();
    await seedChecklistIfEmpty();
    await seedBusinessesIfEmpty();
  } finally {
    initializing = false;
  }
}

function rowToCard(row: Row): CommandCard {
  return parseCommandCard({
    id: String(row.id),
    title: String(row.title),
    owner: String(row.owner),
    cadence: String(row.cadence),
    status: String(row.status),
    needsJoseph: Boolean(row.needsJoseph),
    nextStep: String(row.nextStep),
    link: row.link ? String(row.link) : undefined,
    dueDate: row.dueDate ? String(row.dueDate) : undefined,
    tags: row.tags ? (JSON.parse(String(row.tags)) as string[]) : undefined,
    sourceAgent: row.sourceAgent ? String(row.sourceAgent) : undefined,
    updatedAt: String(row.updatedAt),
    createdAt: String(row.createdAt),
  });
}

function rowToChecklist(row: Row): ChecklistItem {
  return {
    id: String(row.id),
    title: String(row.title),
    done: Boolean(row.done),
    plannedDate: String(row.plannedDate),
    sortOrder: Number(row.sortOrder),
    updatedAt: String(row.updatedAt),
    createdAt: String(row.createdAt),
  };
}

async function persistCard(card: CommandCard): Promise<void> {
  const client = await ensureReady();
  await client.execute({
    sql: `INSERT INTO cards (
        id, title, owner, cadence, status, needsJoseph, nextStep,
        link, dueDate, tags, sourceAgent, updatedAt, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        owner = excluded.owner,
        cadence = excluded.cadence,
        status = excluded.status,
        needsJoseph = excluded.needsJoseph,
        nextStep = excluded.nextStep,
        link = excluded.link,
        dueDate = excluded.dueDate,
        tags = excluded.tags,
        sourceAgent = excluded.sourceAgent,
        updatedAt = excluded.updatedAt`,
    args: [
      card.id,
      card.title,
      card.owner,
      card.cadence,
      card.status,
      card.needsJoseph ? 1 : 0,
      card.nextStep,
      card.link ?? null,
      card.dueDate ?? null,
      card.tags ? JSON.stringify(card.tags) : null,
      card.sourceAgent ?? null,
      card.updatedAt,
      card.createdAt,
    ],
  });
}

export async function countCards(): Promise<number> {
  const client = await ensureReady();
  const result = await client.execute("SELECT COUNT(*) AS count FROM cards");
  return Number(result.rows[0]?.count ?? 0);
}

export async function seedCanonicalCards(): Promise<CommandCard[]> {
  const seeded: CommandCard[] = [];
  for (const input of SEED_CARDS) {
    seeded.push(await upsertCard(input, { preserveTimestamps: true }));
  }
  return seeded;
}

export async function seedIfEmpty(): Promise<CommandCard[]> {
  const client = getClient();
  const result = await client.execute("SELECT COUNT(*) AS count FROM cards");
  if (Number(result.rows[0]?.count ?? 0) > 0) return [];
  return seedCanonicalCards();
}

export async function seedChecklistIfEmpty(): Promise<ChecklistItem[]> {
  const client = getClient();
  const result = await client.execute("SELECT COUNT(*) AS count FROM checklist");
  if (Number(result.rows[0]?.count ?? 0) > 0) return [];
  const now = nowISO();
  const seeded: ChecklistItem[] = [];
  for (const item of buildSeedChecklist(todayISO())) {
    const full: ChecklistItem = { ...item, createdAt: now, updatedAt: now };
    await persistChecklist(full);
    seeded.push(full);
  }
  return seeded;
}

export async function getSeedStatus(): Promise<{ ok: boolean; count: number }> {
  const count = await countCards();
  return { ok: count >= 12, count };
}

export async function getCard(id: string): Promise<CommandCard | null> {
  const client = await ensureReady();
  const result = await client.execute({
    sql: "SELECT * FROM cards WHERE id = ?",
    args: [id],
  });
  const row = result.rows[0];
  return row ? rowToCard(row) : null;
}

export async function listAllCards(): Promise<CommandCard[]> {
  const client = await ensureReady();
  const result = await client.execute("SELECT * FROM cards");
  return result.rows.map(rowToCard);
}

export type ListCardsFilter = {
  owner?: FunctionOwner;
  status?: CommandCard["status"];
  cadence?: CommandCard["cadence"];
  needsJoseph?: boolean;
  tag?: string;
  includeDone?: boolean;
};

export async function listCards(filter: ListCardsFilter = {}): Promise<CommandCard[]> {
  const includeDone = filter.includeDone ?? false;
  const cards = (await listAllCards()).filter((card) => {
    if (!includeDone && card.status === "done") return false;
    if (filter.owner && card.owner !== filter.owner) return false;
    if (filter.status && card.status !== filter.status) return false;
    if (filter.cadence && card.cadence !== filter.cadence) return false;
    if (filter.needsJoseph !== undefined && card.needsJoseph !== filter.needsJoseph) {
      return false;
    }
    if (filter.tag && !(card.tags ?? []).includes(filter.tag)) return false;
    return true;
  });
  return sortByUpdatedAtDesc(cards);
}

export async function upsertCard(
  input: UpsertCardInput,
  options: { preserveTimestamps?: boolean } = {},
): Promise<CommandCard> {
  const existing = await getCard(input.id);
  const now = nowISO();
  const card = parseCommandCard({
    id: input.id,
    title: input.title,
    owner: input.owner,
    cadence: input.cadence,
    status: input.status,
    needsJoseph: input.needsJoseph,
    nextStep: input.nextStep,
    link: input.link !== undefined ? input.link : existing?.link,
    dueDate: input.dueDate !== undefined ? input.dueDate : existing?.dueDate,
    tags: input.tags !== undefined ? input.tags : existing?.tags,
    sourceAgent: input.sourceAgent !== undefined ? input.sourceAgent : existing?.sourceAgent,
    createdAt: existing?.createdAt ?? input.createdAt ?? now,
    updatedAt: options.preserveTimestamps && existing ? existing.updatedAt : now,
  });

  await persistCard(card);
  return (await getCard(card.id)) as CommandCard;
}

export async function completeCard(id: string, note?: string): Promise<CommandCard> {
  const existing = await getCard(id);
  if (!existing) {
    throw new Error(`Card not found: ${id}`);
  }

  return upsertCard({
    ...existing,
    status: "done",
    needsJoseph: false,
    nextStep: note ? `Done: ${note}` : existing.nextStep,
  });
}

export async function flagBlocker(
  id: string,
  reason: string,
  needsJoseph = true,
): Promise<CommandCard> {
  const existing = await getCard(id);
  if (!existing) {
    throw new Error(`Card not found: ${id}`);
  }

  const framed = reason.startsWith("Blocked:") ? reason : `Blocked: ${reason}`;
  return upsertCard({
    ...existing,
    status: "blocked",
    needsJoseph,
    nextStep: framed,
  });
}

export async function getNeedsJoseph(owner?: FunctionOwner): Promise<CommandCard[]> {
  const cards = (await listAllCards()).filter((card) => {
    if (!card.needsJoseph || card.status === "done") return false;
    if (owner && card.owner !== owner) return false;
    return true;
  });
  return sortNeedsJoseph(cards);
}

async function persistChecklist(item: ChecklistItem): Promise<void> {
  const client = await ensureReady();
  await client.execute({
    sql: `INSERT INTO checklist (
        id, title, done, plannedDate, sortOrder, updatedAt, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        done = excluded.done,
        plannedDate = excluded.plannedDate,
        sortOrder = excluded.sortOrder,
        updatedAt = excluded.updatedAt`,
    args: [
      item.id,
      item.title,
      item.done ? 1 : 0,
      item.plannedDate,
      item.sortOrder,
      item.updatedAt,
      item.createdAt,
    ],
  });
}

export async function getChecklistItem(id: string): Promise<ChecklistItem | null> {
  const client = await ensureReady();
  const result = await client.execute({
    sql: "SELECT * FROM checklist WHERE id = ?",
    args: [id],
  });
  const row = result.rows[0];
  return row ? rowToChecklist(row) : null;
}

export async function listChecklistItems(range?: {
  from?: string;
  to?: string;
}): Promise<ChecklistItem[]> {
  const client = await ensureReady();
  const window = checklistWindow();
  const from = range?.from ?? window.from;
  const to = range?.to ?? window.to;
  const result = await client.execute({
    sql: `SELECT * FROM checklist
          WHERE plannedDate >= ? AND plannedDate <= ?
          ORDER BY plannedDate ASC, sortOrder ASC`,
    args: [from, to],
  });
  return result.rows.map(rowToChecklist);
}

export async function addChecklistItem(
  title: string,
  plannedDate: string,
): Promise<ChecklistItem> {
  const client = await ensureReady();
  const max = await client.execute({
    sql: "SELECT COALESCE(MAX(sortOrder), -1) AS maxOrder FROM checklist WHERE plannedDate = ?",
    args: [plannedDate],
  });
  const now = nowISO();
  const item: ChecklistItem = {
    id: crypto.randomUUID(),
    title: title.trim(),
    done: false,
    plannedDate,
    sortOrder: Number(max.rows[0]?.maxOrder ?? -1) + 1,
    createdAt: now,
    updatedAt: now,
  };
  if (!item.title) {
    throw new Error("Checklist title is required");
  }
  await persistChecklist(item);
  return item;
}

export async function updateChecklistItem(
  id: string,
  patch: Partial<Pick<ChecklistItem, "title" | "done" | "plannedDate" | "sortOrder">>,
): Promise<ChecklistItem> {
  const existing = await getChecklistItem(id);
  if (!existing) {
    throw new Error(`Checklist item not found: ${id}`);
  }
  const next: ChecklistItem = {
    ...existing,
    ...patch,
    title: patch.title !== undefined ? patch.title.trim() : existing.title,
    updatedAt: nowISO(),
  };
  if (!next.title) {
    throw new Error("Checklist title is required");
  }
  await persistChecklist(next);
  return next;
}

export async function toggleChecklistItem(id: string): Promise<ChecklistItem> {
  const existing = await getChecklistItem(id);
  if (!existing) {
    throw new Error(`Checklist item not found: ${id}`);
  }
  return updateChecklistItem(id, { done: !existing.done });
}

export async function deleteChecklistItem(id: string): Promise<void> {
  const client = await ensureReady();
  await client.execute({
    sql: "DELETE FROM checklist WHERE id = ?",
    args: [id],
  });
}

async function ensurePromptTemplatesTable(client: Client): Promise<void> {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS prompt_templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      body TEXT NOT NULL,
      parameters TEXT NOT NULL,
      rows TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      createdAt TEXT NOT NULL
    )
  `);
}

function rowToPromptTemplate(row: Row): PromptTemplate {
  let parameters: unknown = [];
  let rows: unknown = [];
  try {
    parameters = JSON.parse(String(row.parameters ?? "[]"));
  } catch {
    parameters = [];
  }
  try {
    rows = JSON.parse(String(row.rows ?? "[]"));
  } catch {
    rows = [];
  }
  return parsePromptTemplate({
    id: String(row.id),
    name: String(row.name),
    body: String(row.body),
    parameters,
    rows,
    updatedAt: String(row.updatedAt),
    createdAt: String(row.createdAt),
  });
}

async function persistPromptTemplate(template: PromptTemplate): Promise<void> {
  const client = await ensureReady();
  await ensurePromptTemplatesTable(client);
  await client.execute({
    sql: `INSERT INTO prompt_templates (
        id, name, body, parameters, rows, updatedAt, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        body = excluded.body,
        parameters = excluded.parameters,
        rows = excluded.rows,
        updatedAt = excluded.updatedAt`,
    args: [
      template.id,
      template.name,
      template.body,
      JSON.stringify(template.parameters),
      JSON.stringify(template.rows),
      template.updatedAt,
      template.createdAt,
    ],
  });
}

export async function getPromptTemplate(
  id: string,
): Promise<PromptTemplate | null> {
  const client = await ensureReady();
  await ensurePromptTemplatesTable(client);
  const result = await client.execute({
    sql: "SELECT * FROM prompt_templates WHERE id = ?",
    args: [id],
  });
  const row = result.rows[0];
  return row ? rowToPromptTemplate(row) : null;
}

export async function listPromptTemplates(): Promise<PromptTemplate[]> {
  const client = await ensureReady();
  await ensurePromptTemplatesTable(client);
  const result = await client.execute(
    "SELECT * FROM prompt_templates ORDER BY updatedAt DESC",
  );
  return result.rows.map(rowToPromptTemplate);
}

export async function upsertPromptTemplate(
  input: PromptTemplateInput,
): Promise<PromptTemplate> {
  const existing = input.id ? await getPromptTemplate(input.id) : null;
  const now = nowISO();
  const template = parsePromptTemplate({
    id: existing?.id ?? input.id ?? crypto.randomUUID(),
    name: input.name,
    body: input.body,
    parameters: input.parameters,
    rows: input.rows ?? existing?.rows ?? [],
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  });
  await persistPromptTemplate(template);
  return (await getPromptTemplate(template.id)) as PromptTemplate;
}

export async function deletePromptTemplate(id: string): Promise<void> {
  const client = await ensureReady();
  await ensurePromptTemplatesTable(client);
  await client.execute({
    sql: "DELETE FROM prompt_templates WHERE id = ?",
    args: [id],
  });
}

export async function applyChecklistOrder(
  updates: { id: string; plannedDate: string; sortOrder: number }[],
): Promise<ChecklistItem[]> {
  const now = nowISO();
  const client = await ensureReady();
  if (updates.length === 0) return listChecklistItems();
  await client.batch(
    updates.map((update) => ({
      sql: "UPDATE checklist SET plannedDate = ?, sortOrder = ?, updatedAt = ? WHERE id = ?",
      args: [update.plannedDate, update.sortOrder, now, update.id],
    })),
  );
  return listChecklistItems();
}

async function ensureBusinessesTable(client: Client): Promise<void> {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS businesses (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      address TEXT,
      city TEXT,
      phone TEXT,
      website TEXT,
      instagram TEXT,
      tags TEXT NOT NULL,
      notes TEXT NOT NULL,
      reminderAt TEXT,
      reminderNote TEXT,
      status TEXT NOT NULL,
      greenlit INTEGER NOT NULL,
      greenlitReason TEXT,
      updatedAt TEXT NOT NULL,
      createdAt TEXT NOT NULL
    )
  `);
}

function rowToBusiness(row: Row): SalesBusiness {
  let tags: unknown = [];
  let notes: unknown = [];
  try {
    tags = JSON.parse(String(row.tags ?? "[]"));
  } catch {
    tags = [];
  }
  try {
    notes = JSON.parse(String(row.notes ?? "[]"));
  } catch {
    notes = [];
  }
  return parseSalesBusiness({
    id: String(row.id),
    name: String(row.name),
    type: String(row.type),
    address: row.address ? String(row.address) : undefined,
    city: row.city ? String(row.city) : undefined,
    phone: row.phone ? String(row.phone) : undefined,
    website: row.website ? String(row.website) : undefined,
    instagram: row.instagram ? String(row.instagram) : undefined,
    tags,
    notes,
    reminderAt: row.reminderAt ? String(row.reminderAt) : undefined,
    reminderNote: row.reminderNote ? String(row.reminderNote) : undefined,
    status: String(row.status),
    greenlit: Boolean(row.greenlit),
    greenlitReason: row.greenlitReason ? String(row.greenlitReason) : undefined,
    updatedAt: String(row.updatedAt),
    createdAt: String(row.createdAt),
  });
}

async function persistBusiness(business: SalesBusiness): Promise<void> {
  const client = await ensureReady();
  await ensureBusinessesTable(client);
  await client.execute({
    sql: `INSERT INTO businesses (
        id, name, type, address, city, phone, website, instagram,
        tags, notes, reminderAt, reminderNote, status, greenlit,
        greenlitReason, updatedAt, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        type = excluded.type,
        address = excluded.address,
        city = excluded.city,
        phone = excluded.phone,
        website = excluded.website,
        instagram = excluded.instagram,
        tags = excluded.tags,
        notes = excluded.notes,
        reminderAt = excluded.reminderAt,
        reminderNote = excluded.reminderNote,
        status = excluded.status,
        greenlit = excluded.greenlit,
        greenlitReason = excluded.greenlitReason,
        updatedAt = excluded.updatedAt`,
    args: [
      business.id,
      business.name,
      business.type,
      business.address ?? null,
      business.city ?? null,
      business.phone ?? null,
      business.website ?? null,
      business.instagram ?? null,
      JSON.stringify(business.tags),
      JSON.stringify(business.notes),
      business.reminderAt ?? null,
      business.reminderNote ?? null,
      business.status,
      business.greenlit ? 1 : 0,
      business.greenlitReason ?? null,
      business.updatedAt,
      business.createdAt,
    ],
  });
}

function mergeOptional(
  incoming: string | null | undefined,
  existing?: string,
): string | undefined {
  if (incoming === null) return undefined;
  if (incoming !== undefined) {
    const trimmed = incoming.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  return existing;
}

async function uniqueBusinessId(name: string): Promise<string> {
  const base = slugifyBusinessId(name);
  if (!(await getBusiness(base))) return base;
  return `${base}-${crypto.randomUUID().slice(0, 8)}`;
}

export async function getBusiness(id: string): Promise<SalesBusiness | null> {
  const client = await ensureReady();
  await ensureBusinessesTable(client);
  const result = await client.execute({
    sql: "SELECT * FROM businesses WHERE id = ?",
    args: [id],
  });
  const row = result.rows[0];
  return row ? rowToBusiness(row) : null;
}

export async function listAllBusinesses(): Promise<SalesBusiness[]> {
  const client = await ensureReady();
  await ensureBusinessesTable(client);
  const result = await client.execute("SELECT * FROM businesses");
  return sortBusinesses(result.rows.map(rowToBusiness));
}

export async function listBusinesses(
  filter: ListBusinessesFilter = {},
): Promise<SalesBusiness[]> {
  return sortBusinesses(filterBusinesses(await listAllBusinesses(), filter));
}

export async function upsertBusiness(
  input: UpsertBusinessInput,
): Promise<SalesBusiness> {
  const existing = input.id ? await getBusiness(input.id) : null;
  const now = nowISO();
  const nextFields = {
    name: input.name.trim(),
    type: input.type,
    address: mergeOptional(input.address, existing?.address),
    phone: mergeOptional(input.phone, existing?.phone),
    status: input.status ?? existing?.status ?? ("target" as const),
    greenlit: existing?.greenlit ?? false,
    greenlitReason: existing?.greenlitReason,
  };
  const greenlight = resolveGreenlight(nextFields, existing);

  const business = parseSalesBusiness({
    id: existing?.id ?? input.id ?? (await uniqueBusinessId(input.name)),
    name: nextFields.name,
    type: nextFields.type,
    address: nextFields.address,
    city: mergeOptional(input.city, existing?.city),
    phone: nextFields.phone,
    website: mergeOptional(input.website, existing?.website),
    instagram: mergeOptional(input.instagram, existing?.instagram),
    tags: input.tags !== undefined ? input.tags : existing?.tags ?? [],
    notes: existing?.notes ?? [],
    reminderAt:
      input.reminderAt !== undefined
        ? mergeOptional(input.reminderAt)
        : existing?.reminderAt,
    reminderNote:
      input.reminderNote !== undefined
        ? mergeOptional(input.reminderNote)
        : existing?.reminderNote,
    status: nextFields.status,
    greenlit: greenlight.greenlit,
    greenlitReason: greenlight.greenlitReason,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  });

  await persistBusiness(business);
  return (await getBusiness(business.id)) as SalesBusiness;
}

export async function addBusinessNote(
  id: string,
  body: string,
): Promise<SalesBusiness> {
  const existing = await getBusiness(id);
  if (!existing) {
    throw new Error(`Business not found: ${id}`);
  }
  const trimmed = body.trim();
  if (!trimmed) {
    throw new Error("Note body is required");
  }
  const now = nowISO();
  const business = parseSalesBusiness({
    ...existing,
    notes: parseNotes([
      ...existing.notes,
      { id: crypto.randomUUID(), body: trimmed, createdAt: now },
    ]),
    updatedAt: now,
  });
  await persistBusiness(business);
  return (await getBusiness(id)) as SalesBusiness;
}

export async function setBusinessReminder(
  id: string,
  reminderAt?: string | null,
  reminderNote?: string | null,
): Promise<SalesBusiness> {
  const existing = await getBusiness(id);
  if (!existing) {
    throw new Error(`Business not found: ${id}`);
  }
  const now = nowISO();
  const business = parseSalesBusiness({
    ...existing,
    reminderAt: reminderAt === null ? undefined : reminderAt ?? existing.reminderAt,
    reminderNote:
      reminderNote === null ? undefined : reminderNote ?? existing.reminderNote,
    updatedAt: now,
  });
  await persistBusiness(business);
  return (await getBusiness(id)) as SalesBusiness;
}

export async function setBusinessGreenlight(
  id: string,
  greenlit: boolean,
): Promise<SalesBusiness> {
  const existing = await getBusiness(id);
  if (!existing) {
    throw new Error(`Business not found: ${id}`);
  }
  const resolved = resolveGreenlight(existing, existing, greenlit);
  const now = nowISO();
  const business = parseSalesBusiness({
    ...existing,
    greenlit: resolved.greenlit,
    greenlitReason: resolved.greenlitReason,
    updatedAt: now,
  });
  await persistBusiness(business);
  return (await getBusiness(id)) as SalesBusiness;
}

export async function seedCanonicalBusinesses(): Promise<SalesBusiness[]> {
  const seeded: SalesBusiness[] = [];
  for (const input of SEED_BUSINESSES) {
    const existing = await getBusiness(input.id);
    const now = nowISO();
    const notes = existing?.notes?.length
      ? existing.notes
      : input.note
        ? [{ id: `${input.id}-seed-note`, body: input.note, createdAt: now }]
        : [];
    const nextFields = {
      name: input.name,
      type: input.type,
      address: input.address,
      phone: input.phone,
      status: input.status,
      greenlit: existing?.greenlit ?? false,
      greenlitReason: existing?.greenlitReason,
    };
    const greenlight = resolveGreenlight(nextFields, existing);
    const business = parseSalesBusiness({
      id: input.id,
      name: input.name,
      type: input.type,
      address: input.address,
      city: input.city,
      phone: input.phone,
      website: input.website,
      instagram: input.instagram,
      tags: input.tags,
      notes,
      reminderAt: existing?.reminderAt,
      reminderNote: existing?.reminderNote,
      status: input.status,
      greenlit: greenlight.greenlit,
      greenlitReason: greenlight.greenlitReason,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    });
    await persistBusiness(business);
    seeded.push((await getBusiness(input.id)) as SalesBusiness);
  }
  return seeded;
}

export async function seedBusinessesIfEmpty(): Promise<SalesBusiness[]> {
  const client = getClient();
  await ensureBusinessesTable(client);
  const result = await client.execute("SELECT COUNT(*) AS count FROM businesses");
  if (Number(result.rows[0]?.count ?? 0) > 0) return [];
  return seedCanonicalBusinesses();
}
