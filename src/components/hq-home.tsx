"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Code2,
  Handshake,
  LifeBuoy,
  Megaphone,
  Search,
  Store,
} from "lucide-react";
import { CooChecklist } from "@/components/coo-checklist";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  formatChicagoDateTime,
  isReminderOverdue,
  type SalesBusiness,
} from "@/lib/business";
import {
  businessMatchesQuery,
  cardMatchesQuery,
  computeHqKpis,
  dueReminderShops,
  FUNCTION_LEAD_OWNERS,
  FUNCTION_META,
  functionStatuses,
  matchesHqQuery,
  pickHqInsight,
  type FunctionLeadOwner,
} from "@/lib/hq";
import { getNeedsJosephCards } from "@/lib/filters";
import type { ChecklistItem, CommandCard } from "@/lib/schema";
import { cn } from "@/lib/utils";

const LEAD_ICONS = {
  eng: Code2,
  marketing: Megaphone,
  sales: Handshake,
  support: LifeBuoy,
  books: BookOpen,
} as const;

function HqPanel({
  title,
  hint,
  action,
  children,
  className,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "flex flex-col rounded-2xl border border-border bg-card p-5",
        className,
      )}
    >
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-heading text-lg leading-tight font-medium">
            {title}
          </h2>
          {hint ? (
            <p className="mt-0.5 text-sm text-muted-foreground">{hint}</p>
          ) : null}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
      {children}
    </p>
  );
}

function KpiTile({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "joseph" | "blocker" | "sage";
}) {
  return (
    <div
      className={cn(
        "min-w-[9.5rem] flex-1 rounded-2xl border border-border bg-card px-4 py-3",
        tone === "joseph" && "border-[color-mix(in_oklch,var(--needs-joseph),var(--border)_35%)]",
        tone === "blocker" && value !== "0" && "border-[color-mix(in_oklch,var(--terracotta),var(--border)_40%)]",
        tone === "sage" && "border-[color-mix(in_oklch,var(--sage),var(--border)_45%)]",
      )}
    >
      <p className="text-xs tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <p className="font-heading mt-1 text-2xl leading-none font-medium tabular-nums">
        {value}
      </p>
      {hint ? (
        <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

function InsightBanner({
  cards,
}: {
  cards: CommandCard[];
}) {
  const insight = pickHqInsight(cards);

  if (insight.kind === "clear") {
    return (
      <section className="flex flex-col gap-2 rounded-2xl border border-border bg-card px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 size-5 text-primary" />
          <div>
            <p className="text-xs tracking-wide text-muted-foreground uppercase">
              Board is clear
            </p>
            <p className="font-heading mt-0.5 text-lg font-medium">
              Nothing needs Joseph, and there are no blockers.
            </p>
          </div>
        </div>
      </section>
    );
  }

  const { card, kind } = insight;
  const joseph = card.needsJoseph;
  return (
    <section
      className={cn(
        "flex flex-col gap-3 rounded-2xl border px-5 py-4 sm:flex-row sm:items-center sm:justify-between",
        kind === "blocker"
          ? "border-[color-mix(in_oklch,var(--terracotta),var(--border)_30%)] bg-[color-mix(in_oklch,var(--card),var(--terracotta)_6%)]"
          : "border-[color-mix(in_oklch,var(--needs-joseph),var(--border)_25%)] bg-[color-mix(in_oklch,var(--card),var(--needs-joseph)_18%)]",
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        <AlertTriangle
          className={cn(
            "mt-0.5 size-5 shrink-0",
            kind === "blocker" ? "text-terracotta" : "text-needs-joseph-foreground",
          )}
        />
        <div className="min-w-0">
          <p className="text-xs tracking-wide text-muted-foreground uppercase">
            {kind === "blocker" ? "Top blocker" : "Needs Joseph"}
          </p>
          <p className="font-heading mt-0.5 text-lg leading-snug font-medium">
            {card.title}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{card.nextStep}</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Badge variant="outline">{FUNCTION_META[card.owner].label}</Badge>
            <Badge variant={card.status === "blocked" ? "destructive" : "secondary"}>
              {card.status}
            </Badge>
            {joseph ? <Badge variant="joseph">needs Joseph</Badge> : null}
          </div>
        </div>
      </div>
      <Link
        href={`/functions/${card.owner}`}
        className="shrink-0 self-start rounded-xl border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-muted sm:self-center"
      >
        Open {FUNCTION_META[card.owner].label}
      </Link>
    </section>
  );
}

function CompactCard({ card }: { card: CommandCard }) {
  return (
    <Link
      href={`/functions/${card.owner}`}
      className="block rounded-xl border border-border px-3 py-2.5 transition-colors hover:bg-muted/60"
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-sm font-medium">{card.title}</span>
        {card.status === "blocked" ? (
          <Badge variant="destructive">blocked</Badge>
        ) : null}
        {card.needsJoseph ? <Badge variant="joseph">Joseph</Badge> : null}
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{card.nextStep}</p>
    </Link>
  );
}

function FunctionStatusList({ cards }: { cards: CommandCard[] }) {
  const rows = functionStatuses(cards);
  return (
    <ul className="flex flex-col gap-2">
      {rows.map((row) => (
        <li key={row.owner}>
          <Link
            href={`/functions/${row.owner}`}
            className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2.5 hover:bg-muted/60"
          >
            <span>
              <span className="block text-sm font-medium">{row.label}</span>
              <span className="text-xs text-muted-foreground">{row.blurb}</span>
            </span>
            <span className="flex shrink-0 items-center gap-1.5 text-xs tabular-nums">
              <span className="text-muted-foreground">{row.open} open</span>
              {row.blockers > 0 ? (
                <Badge variant="destructive">{row.blockers}</Badge>
              ) : null}
              {row.needsJoseph > 0 ? (
                <Badge variant="joseph">{row.needsJoseph}</Badge>
              ) : null}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function SalesSnapshot({
  businesses,
  query,
}: {
  businesses: SalesBusiness[];
  query: string;
}) {
  const greenlit = businesses.filter((business) => business.greenlit);
  const due = dueReminderShops(businesses);
  const shown = query
    ? businesses.filter((business) => businessMatchesQuery(business, query))
    : due.length > 0
      ? due
      : greenlit.slice(0, 4);

  return (
    <HqPanel
      title="Sales snapshot"
      hint="Greenlit shops and due reminders only — no invented pipeline."
      action={
        <Link
          href="/businesses"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          All shops
        </Link>
      }
    >
      <div className="mb-3 flex flex-wrap gap-2 text-sm">
        <span className="rounded-full bg-muted px-2.5 py-1 tabular-nums">
          {greenlit.length} greenlit
        </span>
        <span className="rounded-full bg-muted px-2.5 py-1 tabular-nums">
          {due.length} due reminders
        </span>
      </div>
      {shown.length === 0 ? (
        <EmptyNote>
          {query
            ? "No shops match that filter."
            : "No greenlit shops or due reminders yet."}
        </EmptyNote>
      ) : (
        <ul className="flex flex-col gap-2">
          {shown.slice(0, 6).map((business) => {
            const overdue = isReminderOverdue(business.reminderAt);
            return (
              <li
                key={business.id}
                className="flex items-start justify-between gap-3 rounded-xl border border-border px-3 py-2.5"
              >
                <span className="min-w-0">
                  <span className="flex items-center gap-2">
                    <Store className="size-3.5 text-muted-foreground" />
                    <span className="text-sm font-medium">{business.name}</span>
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {business.city ?? business.type}
                    {business.reminderNote ? ` · ${business.reminderNote}` : ""}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  {business.greenlit ? (
                    <Badge variant="secondary">greenlit</Badge>
                  ) : null}
                  {business.reminderAt ? (
                    <span
                      className={cn(
                        "text-xs tabular-nums",
                        overdue ? "text-terracotta" : "text-muted-foreground",
                      )}
                    >
                      {formatChicagoDateTime(business.reminderAt)}
                    </span>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </HqPanel>
  );
}

function LeadColumn({
  cards,
  query,
}: {
  cards: CommandCard[];
  query: string;
}) {
  const needsJoseph = getNeedsJosephCards(cards);
  const grouped = FUNCTION_LEAD_OWNERS.map((owner) => ({
    owner,
    cards: needsJoseph.filter((card) => card.owner === owner),
  }));

  return (
    <HqPanel
      title="Needs Joseph"
      hint="Live function list. No AI roster."
    >
      <div className="flex flex-col gap-4">
        {grouped.map(({ owner, cards: lane }) => (
          <LeadLane
            key={owner}
            owner={owner}
            cards={lane}
            query={query}
          />
        ))}
      </div>
    </HqPanel>
  );
}

function LeadLane({
  owner,
  cards,
  query,
}: {
  owner: FunctionLeadOwner;
  cards: CommandCard[];
  query: string;
}) {
  const Icon = LEAD_ICONS[owner];
  const visible = query
    ? cards.filter((card) => cardMatchesQuery(card, query))
    : cards;
  const meta = FUNCTION_META[owner];

  if (query && visible.length === 0) return null;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <Link
          href={`/functions/${owner}`}
          className="flex items-center gap-2 text-sm font-medium hover:underline"
        >
          <Icon className="size-3.5 text-muted-foreground" />
          {meta.label}
        </Link>
        {visible.length > 0 ? (
          <Badge variant="joseph">{visible.length}</Badge>
        ) : (
          <span className="text-xs text-muted-foreground">Clear</span>
        )}
      </div>
      {visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">No cards need you here.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {visible.map((card) => (
            <CompactCard key={card.id} card={card} />
          ))}
        </div>
      )}
    </div>
  );
}

export function HqHome({
  greeting,
  dateLabel,
  today,
  cards,
  checklist,
  businesses,
}: {
  greeting: string;
  dateLabel: string;
  today: string;
  cards: CommandCard[];
  checklist: ChecklistItem[];
  businesses: SalesBusiness[];
}) {
  const [query, setQuery] = useState("");
  const kpis = useMemo(
    () => computeHqKpis(cards, businesses),
    [cards, businesses],
  );

  const filteredCards = query
    ? cards.filter((card) => cardMatchesQuery(card, query))
    : cards;
  const filteredChecklist = query
    ? checklist.filter((item) => matchesHqQuery(query, [item.title]))
    : checklist;
  const searching = query.trim().length > 0;
  const recurringHint = `${kpis.recurring.daily} daily · ${kpis.recurring.weekly} weekly · ${kpis.recurring.monthly} monthly`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="font-heading text-3xl leading-tight font-medium sm:text-4xl">
            {greeting}, Joseph
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Live Command Center — cards, checklist, and shops. America/Chicago.
          </p>
        </div>
        <p className="text-sm text-muted-foreground tabular-nums">{dateLabel}</p>
      </div>

      <label className="relative block">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Filter cards, checklist, and shops…"
          className="h-10 rounded-2xl bg-card pr-3 pl-9"
          aria-label="Filter cards, checklist, and shops"
        />
      </label>

      <div className="flex gap-3 overflow-x-auto pb-1 xl:grid xl:grid-cols-6 xl:overflow-visible">
        <KpiTile label="Open cards" value={String(kpis.openCards)} />
        <KpiTile
          label="Needs Joseph"
          value={String(kpis.needsJoseph)}
          tone="joseph"
        />
        <KpiTile
          label="Blockers"
          value={String(kpis.blockers)}
          tone="blocker"
        />
        <KpiTile
          label="Greenlit shops"
          value={String(kpis.greenlit)}
          tone="sage"
        />
        <KpiTile label="Due reminders" value={String(kpis.dueReminders)} />
        <KpiTile
          label="Recurring"
          value={`${kpis.recurring.daily} / ${kpis.recurring.weekly} / ${kpis.recurring.monthly}`}
          hint={recurringHint}
        />
      </div>

      <InsightBanner cards={searching ? filteredCards : cards} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="flex flex-col gap-6">
          <HqPanel
            title="Today checklist"
            hint="Same COO list as before — add, check, drag."
          >
            {searching ? (
              filteredChecklist.length === 0 ? (
                <EmptyNote>No checklist items match that filter.</EmptyNote>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {filteredChecklist.map((item) => (
                    <li
                      key={item.id}
                      className={cn(
                        "rounded-xl border border-border px-3 py-2 text-sm",
                        item.done && "text-muted-foreground line-through",
                      )}
                    >
                      {item.title}
                    </li>
                  ))}
                </ul>
              )
            ) : (
              <CooChecklist items={checklist} today={today} hideHeading />
            )}
          </HqPanel>

          <div className="grid gap-6 lg:grid-cols-2">
            <HqPanel title="Function status" hint="Open work by lane.">
              <FunctionStatusList cards={filteredCards} />
            </HqPanel>
            <SalesSnapshot businesses={businesses} query={query} />
          </div>
        </div>

        <LeadColumn cards={filteredCards} query={query} />
      </div>
    </div>
  );
}
