"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { BOARD_COOKIE, getCommandCenterToken } from "@/lib/auth";
import {
  addChecklistItem,
  applyChecklistOrder,
  completeCard,
  deleteChecklistItem,
  flagBlocker,
  getCard,
  toggleChecklistItem,
  updateChecklistItem,
  upsertCard,
} from "@/lib/db";

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

export async function loginAction(formData: FormData) {
  const token = getCommandCenterToken();
  const submitted = String(formData.get("token") ?? "");
  if (!token || submitted !== token) {
    redirect("/login?error=1");
  }
  const jar = await cookies();
  jar.set(BOARD_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
  redirect("/");
}
