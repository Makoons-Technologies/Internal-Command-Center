import type { ReactNode } from "react";
import { assertBoardAccess } from "@/lib/auth";
import { BoardChrome } from "@/components/board-chrome";

export async function BoardShell({
  title,
  hideTitle = false,
  seedOk,
  cardCount,
  children,
}: {
  title: string;
  hideTitle?: boolean;
  seedOk: boolean;
  cardCount: number;
  children: ReactNode;
}) {
  await assertBoardAccess();
  return (
    <BoardChrome
      title={title}
      hideTitle={hideTitle}
      brand={
        <div>
          <p className="font-heading text-lg leading-none font-medium tracking-tight">
            Makoons
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Command Center</p>
        </div>
      }
      footer={
        <div className="text-xs text-muted-foreground">
          <p className="font-medium text-sidebar-foreground">Joseph Ross</p>
          <p className="mt-1">
            Seed {seedOk ? "ok" : "missing"} · {cardCount} cards
          </p>
        </div>
      }
    >
      {children}
    </BoardChrome>
  );
}
