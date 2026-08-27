"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FUNCTION_OWNERS, HORIZONS } from "@/lib/schema";
import { cn } from "@/lib/utils";

function NavLink({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "block rounded-md px-2 py-1 text-sm transition-colors",
        active
          ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
          : "text-sidebar-foreground/80 hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground",
      )}
    >
      {label}
    </Link>
  );
}

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-5 text-sm">
      <div>
        <NavLink href="/" label="Home" active={pathname === "/"} />
      </div>

      <div className="flex flex-col gap-1">
        <p className="px-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Sales
        </p>
        <NavLink
          href="/businesses"
          label="Businesses"
          active={pathname === "/businesses"}
        />
      </div>

      <div className="flex flex-col gap-1">
        <p className="px-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Horizons
        </p>
        {HORIZONS.map((horizon) => (
          <NavLink
            key={horizon}
            href={`/horizons/${horizon}`}
            label={horizon[0].toUpperCase() + horizon.slice(1)}
            active={pathname === `/horizons/${horizon}`}
          />
        ))}
      </div>

      <div className="flex flex-col gap-1">
        <p className="px-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Functions
        </p>
        {FUNCTION_OWNERS.map((owner) => (
          <NavLink
            key={owner}
            href={`/functions/${owner}`}
            label={owner}
            active={pathname === `/functions/${owner}`}
          />
        ))}
      </div>
    </nav>
  );
}
