import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const BOARD_COOKIE = "cc_token";

export function getCommandCenterToken(): string {
  return process.env.COMMAND_CENTER_TOKEN?.trim() ?? "";
}

export function isValidBearer(header: string | null): boolean {
  const token = getCommandCenterToken();
  if (!token) {
    return process.env.VERCEL !== "1";
  }
  return header === `Bearer ${token}`;
}

export async function assertBoardAccess(): Promise<void> {
  const token = getCommandCenterToken();
  if (!token) return;
  const jar = await cookies();
  if (jar.get(BOARD_COOKIE)?.value !== token) {
    redirect("/login");
  }
}
