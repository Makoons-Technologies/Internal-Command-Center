"use client";

import { useState, type ReactNode } from "react";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarNav } from "@/components/sidebar-nav";
import { cn } from "@/lib/utils";

function Rail({
  brand,
  footer,
  onNavigate,
}: {
  brand: ReactNode;
  footer: ReactNode;
  onNavigate?: () => void;
}) {
  return (
    <>
      <div className="px-4 pt-5 pb-4">{brand}</div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        <SidebarNav onNavigate={onNavigate} />
      </div>
      <div className="border-t border-sidebar-border px-4 py-4">{footer}</div>
    </>
  );
}

export function BoardChrome({
  title,
  hideTitle = false,
  brand,
  footer,
  children,
}: {
  title: string;
  hideTitle?: boolean;
  brand: ReactNode;
  footer: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 hidden w-72 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:flex">
        <Rail brand={brand} footer={footer} />
      </aside>

      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-foreground/20"
            onClick={() => setOpen(false)}
          />
          <aside className="relative flex h-full w-72 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
            <button
              type="button"
              className="absolute top-3 right-3 rounded-md p-1 text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
              aria-label="Close menu"
              onClick={() => setOpen(false)}
            >
              <X className="size-4" />
            </button>
            <Rail
              brand={brand}
              footer={footer}
              onNavigate={() => setOpen(false)}
            />
          </aside>
        </div>
      ) : null}

      <div className="lg:pl-72">
        <header
          className={cn(
            "flex items-center justify-between gap-3 px-4 py-3 sm:px-6",
            hideTitle ? "lg:py-4" : "border-b border-border",
          )}
        >
          <div className="flex min-w-0 items-center gap-2">
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              className="lg:hidden"
              aria-label="Open menu"
              onClick={() => setOpen(true)}
            >
              <Menu className="size-4" />
            </Button>
            {hideTitle ? (
              <span className="sr-only">{title}</span>
            ) : (
              <h1 className="font-heading text-xl font-medium tracking-tight">
                {title}
              </h1>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
              J
            </span>
            <span className="hidden text-sm sm:inline">Joseph</span>
          </div>
        </header>
        <main className="px-4 pt-1 pb-8 sm:px-6 sm:pb-10">{children}</main>
      </div>
    </div>
  );
}
