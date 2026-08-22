import type { ReactNode } from "react";
import { assertBoardAccess } from "@/lib/auth";
import { SidebarNav } from "@/components/sidebar-nav";
import { Separator } from "@/components/ui/separator";

export async function BoardShell({
  title,
  seedOk,
  cardCount,
  children,
}: {
  title: string;
  seedOk: boolean;
  cardCount: number;
  children: ReactNode;
}) {
  await assertBoardAccess();
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="flex w-56 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground">
        <div className="px-4 py-4">
          <p className="font-heading text-sm font-medium tracking-tight">
            Makoons
          </p>
          <p className="text-xs text-muted-foreground">Command Center</p>
        </div>
        <Separator />
        <div className="flex-1 px-3 py-4">
          <SidebarNav />
        </div>
        <Separator />
        <div className="px-4 py-4 text-xs text-muted-foreground">
          <p className="font-medium text-sidebar-foreground">MCP status</p>
          <p>seed: {seedOk ? "ok" : "missing"}</p>
          <p>{cardCount} cards</p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b px-6 py-3">
          <h1 className="font-heading text-lg font-medium tracking-tight">
            {title}
          </h1>
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-full bg-foreground text-xs font-medium text-background">
              J
            </span>
            <span className="text-sm">Joseph</span>
          </div>
        </header>
        <main className="flex-1 px-6 py-5">{children}</main>
      </div>
    </div>
  );
}
