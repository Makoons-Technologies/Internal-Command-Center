import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { getPinGuard, hasBoardAccess } from "@/lib/auth";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await hasBoardAccess()) {
    redirect("/");
  }

  const { error } = await searchParams;
  const guard = await getPinGuard();

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <LoginForm
        invalid={error === "1" && guard.lockedUntil === 0}
        fails={guard.fails}
        lockedUntil={guard.lockedUntil}
      />
    </main>
  );
}
