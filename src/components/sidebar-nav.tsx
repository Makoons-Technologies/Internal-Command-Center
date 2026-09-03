"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  CalendarDays,
  CalendarRange,
  ClipboardList,
  Code2,
  Handshake,
  House,
  LifeBuoy,
  Megaphone,
  Repeat,
  Store,
  Sun,
  type LucideIcon,
} from "lucide-react";
import { FUNCTION_META } from "@/lib/hq";
import { FUNCTION_OWNERS, HORIZONS } from "@/lib/schema";
import { cn } from "@/lib/utils";

const HORIZON_META: Record<(typeof HORIZONS)[number], { label: string; blurb: string; icon: LucideIcon }> =
  {
    today: { label: "Today", blurb: "Due today and daily", icon: Sun },
    week: { label: "Week", blurb: "This week's horizon", icon: CalendarDays },
    month: { label: "Month", blurb: "This month's horizon", icon: CalendarRange },
  };

const FUNCTION_ICONS: Record<(typeof FUNCTION_OWNERS)[number], LucideIcon> = {
  eng: Code2,
  marketing: Megaphone,
  sales: Handshake,
  support: LifeBuoy,
  books: BookOpen,
  coo: ClipboardList,
};

function NavItem({
  href,
  label,
  blurb,
  icon: Icon,
  active,
  featured = false,
  onNavigate,
}: {
  href: string;
  label: string;
  blurb: string;
  icon: LucideIcon;
  active: boolean;
  featured?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={cn(
        "flex items-start gap-2.5 rounded-2xl px-2.5 py-2 transition-colors",
        featured && "border",
        active
          ? featured
            ? "border-sidebar-border bg-sidebar-accent text-sidebar-accent-foreground"
            : "bg-sidebar-accent/80 text-sidebar-accent-foreground"
          : featured
            ? "border-transparent hover:border-sidebar-border hover:bg-sidebar-accent/50"
            : "text-sidebar-foreground/85 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground",
      )}
    >
      <Icon
        className={cn(
          "mt-0.5 size-4 shrink-0",
          active ? "text-primary" : "text-muted-foreground",
        )}
      />
      <span className="min-w-0">
        <span className={cn("block text-sm leading-tight", active && "font-medium")}>
          {label}
        </span>
        <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
          {blurb}
        </span>
      </span>
    </Link>
  );
}

function NavGroup({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <p className="px-2.5 pb-1 text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
        {label}
      </p>
      {children}
    </div>
  );
}

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-6 text-sm">
      <NavItem
        href="/"
        label="Home"
        blurb="Today's board — HQ"
        icon={House}
        active={pathname === "/"}
        featured
        onNavigate={onNavigate}
      />

      <NavGroup label="Core">
        <NavItem
          href="/recurring"
          label="Recurring"
          blurb="Daily, weekly, monthly"
          icon={Repeat}
          active={pathname === "/recurring"}
          onNavigate={onNavigate}
        />
        {HORIZONS.map((horizon) => {
          const meta = HORIZON_META[horizon];
          return (
            <NavItem
              key={horizon}
              href={`/horizons/${horizon}`}
              label={meta.label}
              blurb={meta.blurb}
              icon={meta.icon}
              active={pathname === `/horizons/${horizon}`}
              onNavigate={onNavigate}
            />
          );
        })}
      </NavGroup>

      <NavGroup label="Sales">
        <NavItem
          href="/businesses"
          label="Businesses"
          blurb="Springfield walk-ins"
          icon={Store}
          active={pathname === "/businesses"}
          onNavigate={onNavigate}
        />
      </NavGroup>

      <NavGroup label="Functions">
        {FUNCTION_OWNERS.map((owner) => {
          const meta = FUNCTION_META[owner];
          return (
            <NavItem
              key={owner}
              href={`/functions/${owner}`}
              label={meta.label}
              blurb={meta.blurb}
              icon={FUNCTION_ICONS[owner]}
              active={pathname === `/functions/${owner}`}
              onNavigate={onNavigate}
            />
          );
        })}
      </NavGroup>
    </nav>
  );
}
