import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  BOARD_COOKIE,
  BOARD_PIN,
  PIN_FAIL_COOKIE,
  PIN_LOCK_COOKIE,
  PIN_LOCK_MS,
} from "@/lib/board-pin";

export {
  BOARD_COOKIE,
  BOARD_PIN,
  MAX_PIN_FAILS,
  PIN_FAIL_COOKIE,
  PIN_LOCK_COOKIE,
  PIN_LOCK_MS,
} from "@/lib/board-pin";

export const BOARD_SESSION_VALUE = createHash("sha256")
  .update(`cc-pin:${BOARD_PIN}`)
  .digest("hex");

const SESSION_COOKIE = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

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

export async function hasBoardAccess(): Promise<boolean> {
  const jar = await cookies();
  return jar.get(BOARD_COOKIE)?.value === BOARD_SESSION_VALUE;
}

export async function assertBoardAccess(): Promise<void> {
  if (!(await hasBoardAccess())) {
    redirect("/login");
  }
}

export async function getPinGuard(): Promise<{
  fails: number;
  lockedUntil: number;
}> {
  const jar = await cookies();
  const now = Date.now();
  const fails = Number.parseInt(jar.get(PIN_FAIL_COOKIE)?.value ?? "0", 10);
  const lockedUntil = Number.parseInt(jar.get(PIN_LOCK_COOKIE)?.value ?? "0", 10);
  if (Number.isFinite(lockedUntil) && lockedUntil > now) {
    return { fails: 0, lockedUntil };
  }
  return {
    fails: Number.isFinite(fails) && fails > 0 ? fails : 0,
    lockedUntil: 0,
  };
}

export async function setPinGuard(guard: {
  fails: number;
  lockedUntil: number;
}): Promise<void> {
  const jar = await cookies();
  if (guard.fails > 0) {
    jar.set(PIN_FAIL_COOKIE, String(guard.fails), {
      ...SESSION_COOKIE,
      maxAge: 5 * 60,
    });
  } else {
    jar.delete(PIN_FAIL_COOKIE);
  }
  if (guard.lockedUntil > Date.now()) {
    jar.set(PIN_LOCK_COOKIE, String(guard.lockedUntil), {
      ...SESSION_COOKIE,
      maxAge: Math.ceil(PIN_LOCK_MS / 1000) + 5,
    });
  } else {
    jar.delete(PIN_LOCK_COOKIE);
  }
}

export async function clearPinGuard(): Promise<void> {
  const jar = await cookies();
  jar.delete(PIN_FAIL_COOKIE);
  jar.delete(PIN_LOCK_COOKIE);
}

export async function setBoardSession(): Promise<void> {
  const jar = await cookies();
  jar.set(BOARD_COOKIE, BOARD_SESSION_VALUE, SESSION_COOKIE);
}
