import { mkdirSync } from "node:fs";
import path from "node:path";
import { createClient as createNodeClient, type Client, type Row } from "@libsql/client";
import { createClient as createWebClient } from "@libsql/client/web";
import { checklistWindow } from "@/lib/checklist";
import { nowISO, todayISO } from "@/lib/dates";
import { sortByUpdatedAtDesc, sortNeedsJoseph } from "@/lib/filters";
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
    await seedIfEmpty();
    await seedChecklistIfEmpty();
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
