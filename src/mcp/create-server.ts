import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import {
  addChecklistItem,
  applyChecklistOrder,
  completeCard,
  deleteChecklistItem,
  flagBlocker,
  getNeedsJoseph,
  listCards,
  listChecklistItems,
  toggleChecklistItem,
  updateChecklistItem,
  upsertCard,
} from "../lib/db";
import { CADENCES, CARD_STATUSES, CHECKLIST_VIEWS, FUNCTION_OWNERS } from "../lib/schema";
import { endOfMonth, endOfWeek, startOfMonth, startOfWeek, todayISO } from "../lib/dates";

const ownerSchema = z.enum(FUNCTION_OWNERS);
const statusSchema = z.enum(CARD_STATUSES);
const cadenceSchema = z.enum(CADENCES);
const viewSchema = z.enum(CHECKLIST_VIEWS);

function jsonResult(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

function errorResult(error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown error";
  return {
    content: [{ type: "text" as const, text: message }],
    isError: true,
  };
}

function rangeForView(view?: (typeof CHECKLIST_VIEWS)[number]) {
  const today = todayISO();
  if (view === "today") return { from: today, to: today };
  if (view === "weekly") return { from: startOfWeek(today), to: endOfWeek(today) };
  if (view === "monthly") return { from: startOfMonth(today), to: endOfMonth(today) };
  return undefined;
}

export function createCommandCenterServer(): McpServer {
  const server = new McpServer({
    name: "makoons-command-center",
    version: "0.2.0",
  });

  server.registerTool(
    "list_cards",
    {
      description:
        "List Command Center cards. Newest updatedAt first. Done cards are hidden unless includeDone is true.",
      inputSchema: z.object({
        owner: ownerSchema.optional().describe("Filter by function lane"),
        status: statusSchema.optional().describe("Filter by workflow status"),
        cadence: cadenceSchema.optional().describe("Filter by cadence"),
        needsJoseph: z.boolean().optional().describe("Filter Needs Joseph"),
        tag: z.string().optional().describe("Match if tags contains this value"),
        includeDone: z
          .boolean()
          .optional()
          .describe("Include done cards. Default false."),
      }),
    },
    async (args) => {
      try {
        return jsonResult(await listCards(args));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "upsert_card",
    {
      description:
        "Create or update a card by id. Server sets createdAt on insert and always refreshes updatedAt.",
      inputSchema: z.object({
        card: z.object({
          id: z.string(),
          title: z.string(),
          owner: ownerSchema,
          cadence: cadenceSchema,
          status: statusSchema,
          needsJoseph: z.boolean(),
          nextStep: z.string(),
          link: z.string().optional(),
          dueDate: z.string().optional(),
          tags: z.array(z.string()).optional(),
          sourceAgent: z.string().optional(),
        }),
      }),
    },
    async ({ card }) => {
      try {
        return jsonResult(await upsertCard(card));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "complete_card",
    {
      description:
        "Mark a card done, clear needsJoseph, and bump updatedAt. Optional completion note.",
      inputSchema: z.object({
        id: z.string(),
        note: z.string().optional(),
      }),
    },
    async ({ id, note }) => {
      try {
        return jsonResult(await completeCard(id, note));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "flag_blocker",
    {
      description:
        "Set a card to blocked, update nextStep with the reason, and default needsJoseph to true.",
      inputSchema: z.object({
        id: z.string(),
        reason: z.string(),
        needsJoseph: z.boolean().optional(),
      }),
    },
    async ({ id, reason, needsJoseph }) => {
      try {
        return jsonResult(await flagBlocker(id, reason, needsJoseph ?? true));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "get_needs_joseph",
    {
      description:
        "Cards that need Joseph and are not done. Sorted blocked, ready, open, then dueDate ascending.",
      inputSchema: z.object({
        owner: ownerSchema.optional().describe("Optional function filter"),
      }),
    },
    async ({ owner }) => {
      try {
        return jsonResult(await getNeedsJoseph(owner));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "list_checklist",
    {
      description:
        "List COO checklist items. Checked items stay in the list. Optional today/weekly/monthly window.",
      inputSchema: z.object({
        view: viewSchema.optional(),
        from: z.string().optional(),
        to: z.string().optional(),
      }),
    },
    async ({ view, from, to }) => {
      try {
        const range = from || to ? { from, to } : rangeForView(view);
        return jsonResult(await listChecklistItems(range));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "add_checklist_item",
    {
      description: "Add a COO checklist item. plannedDate is YYYY-MM-DD. Defaults to today.",
      inputSchema: z.object({
        title: z.string(),
        plannedDate: z.string().optional(),
      }),
    },
    async ({ title, plannedDate }) => {
      try {
        return jsonResult(await addChecklistItem(title, plannedDate ?? todayISO()));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "update_checklist_item",
    {
      description: "Update a COO checklist item title, done flag, plannedDate, or sortOrder.",
      inputSchema: z.object({
        id: z.string(),
        title: z.string().optional(),
        done: z.boolean().optional(),
        plannedDate: z.string().optional(),
        sortOrder: z.number().int().optional(),
      }),
    },
    async ({ id, title, done, plannedDate, sortOrder }) => {
      try {
        return jsonResult(
          await updateChecklistItem(id, { title, done, plannedDate, sortOrder }),
        );
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "toggle_checklist_item",
    {
      description: "Check or uncheck a COO checklist item. Checked items stay visible and are struck through.",
      inputSchema: z.object({ id: z.string() }),
    },
    async ({ id }) => {
      try {
        return jsonResult(await toggleChecklistItem(id));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "delete_checklist_item",
    {
      description: "Remove a COO checklist item.",
      inputSchema: z.object({ id: z.string() }),
    },
    async ({ id }) => {
      try {
        await deleteChecklistItem(id);
        return jsonResult({ ok: true, id });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "reorder_checklist",
    {
      description:
        "Reorder or move COO checklist items. Pass the full set of affected rows with plannedDate and sortOrder.",
      inputSchema: z.object({
        updates: z.array(
          z.object({
            id: z.string(),
            plannedDate: z.string(),
            sortOrder: z.number().int(),
          }),
        ),
      }),
    },
    async ({ updates }) => {
      try {
        return jsonResult(await applyChecklistOrder(updates));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  return server;
}
