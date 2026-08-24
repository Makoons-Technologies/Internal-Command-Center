"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  BOARD_PIN,
  clearPinGuard,
  getPinGuard,
  MAX_PIN_FAILS,
  PIN_LOCK_MS,
  setBoardSession,
  setPinGuard,
} from "@/lib/auth";
import {
  addChecklistItem,
  applyChecklistOrder,
  completeCard,
  deleteChecklistItem,
  deletePromptTemplate,
  flagBlocker,
  getCard,
  toggleChecklistItem,
  updateChecklistItem,
  upsertCard,
  upsertPromptTemplate,
} from "@/lib/db";
import type { PromptTemplateInput } from "@/lib/prompt-template";

function refreshBoard() {
  revalidatePath("/", "layout");
}

export async function completeCardAction(id: string, note?: string) {
  await completeCard(id, note);
  refreshBoard();
}

export async function flagBlockerAction(id: string, reason: string) {
  await flagBlocker(id, reason, true);
  refreshBoard();
}

export async function updateNextStepAction(id: string, nextStep: string) {
  const existing = await getCard(id);
  if (!existing) {
    throw new Error(`Card not found: ${id}`);
  }
  await upsertCard({
    ...existing,
    nextStep,
  });
  refreshBoard();
}

export async function addChecklistItemAction(title: string, plannedDate: string) {
  const item = await addChecklistItem(title, plannedDate);
  refreshBoard();
  return item;
}

export async function toggleChecklistItemAction(id: string) {
  const item = await toggleChecklistItem(id);
  refreshBoard();
  return item;
}

export async function updateChecklistTitleAction(id: string, title: string) {
  const item = await updateChecklistItem(id, { title });
  refreshBoard();
  return item;
}

export async function deleteChecklistItemAction(id: string) {
  await deleteChecklistItem(id);
  refreshBoard();
}

export async function reorderChecklistAction(
  updates: { id: string; plannedDate: string; sortOrder: number }[],
) {
  const items = await applyChecklistOrder(updates);
  refreshBoard();
  return items;
}

export async function savePromptTemplateAction(input: PromptTemplateInput) {
  const template = await upsertPromptTemplate(input);
  refreshBoard();
  return template;
}

export async function deletePromptTemplateAction(id: string) {
  await deletePromptTemplate(id);
  refreshBoard();
}

export async function loginAction(formData: FormData) {
  const now = Date.now();
  const guard = await getPinGuard();
  if (guard.lockedUntil > now) {
    redirect("/login?error=locked");
  }

  const pin = String(formData.get("pin") ?? "").trim();
  if (pin !== BOARD_PIN) {
    const fails = guard.fails + 1;
    if (fails >= MAX_PIN_FAILS) {
      await setPinGuard({ fails: 0, lockedUntil: now + PIN_LOCK_MS });
      redirect("/login?error=locked");
    }
    await setPinGuard({ fails, lockedUntil: 0 });
    redirect("/login?error=1");
  }

  await clearPinGuard();
  await setBoardSession();
  redirect("/");
}
