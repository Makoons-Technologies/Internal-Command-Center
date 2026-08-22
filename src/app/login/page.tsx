import { loginAction } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <form
        action={loginAction}
        className="w-full max-w-sm rounded-xl border bg-card p-6 shadow-sm"
      >
        <h1 className="font-heading text-lg font-medium">Makoons Command Center</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Internal board. Paste the command-center token.
        </p>
        <div className="mt-4 grid gap-2">
          <Label htmlFor="token">Token</Label>
          <Input id="token" name="token" type="password" autoComplete="off" required />
        </div>
        {error ? (
          <p className="mt-2 text-sm text-destructive">Invalid token.</p>
        ) : null}
        <Button type="submit" className="mt-4 w-full">
          Enter
        </Button>
      </form>
    </main>
  );
}
