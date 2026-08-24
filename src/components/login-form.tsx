"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { loginAction } from "@/lib/actions";
import { MAX_PIN_FAILS } from "@/lib/board-pin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function formatRemain(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function EnterButton({ locked }: { locked: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="mt-4 w-full" disabled={locked || pending}>
      {pending ? "Checking…" : "Enter"}
    </Button>
  );
}

export function LoginForm({
  invalid,
  fails,
  lockedUntil,
}: {
  invalid: boolean;
  fails: number;
  lockedUntil: number;
}) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    if (lockedUntil <= 0) return;
    const timer = window.setInterval(tick, 250);
    return () => window.clearInterval(timer);
  }, [lockedUntil]);

  const remain = now == null ? 0 : Math.max(0, lockedUntil - now);
  const locked = lockedUntil > 0 && (now == null || remain > 0);
  const triesLeft = Math.max(0, MAX_PIN_FAILS - fails);

  return (
    <form
      action={loginAction}
      className="w-full max-w-sm rounded-xl border bg-card p-6 shadow-sm"
    >
      <h1 className="font-heading text-lg font-medium">
        Makoons Command Center
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Internal board. Enter the 4-digit PIN.
      </p>
      <div className="mt-4 grid gap-2">
        <Label htmlFor="pin">PIN</Label>
        <Input
          id="pin"
          name="pin"
          type="password"
          inputMode="numeric"
          autoComplete="one-time-code"
          required
          minLength={4}
          maxLength={4}
          pattern="[0-9]{4}"
          disabled={locked}
          className="text-center font-mono text-lg tracking-[0.4em]"
        />
      </div>
      {locked ? (
        <p className="mt-2 text-sm text-destructive" role="alert">
          Too many attempts. Try again in {formatRemain(remain)}.
        </p>
      ) : invalid ? (
        <p className="mt-2 text-sm text-destructive" role="alert">
          Invalid PIN.
          {triesLeft > 0
            ? ` ${triesLeft} ${triesLeft === 1 ? "try" : "tries"} left.`
            : null}
        </p>
      ) : null}
      <EnterButton locked={locked} />
    </form>
  );
}
