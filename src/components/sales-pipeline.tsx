"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type RefObject,
} from "react";
import Link from "next/link";
import {
  closestCorners,
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { Bell, Check, Plus, Store, X } from "lucide-react";
import {
  savePipelineLabelsAction,
  setBusinessPipelineStageAction,
  upsertBusinessAction,
} from "@/lib/actions";
import {
  formatChicagoDateTime,
  isReminderOverdue,
  isReminderToday,
  type SalesBusiness,
} from "@/lib/business";
import {
  formatDealValue,
  groupDealsByStage,
  isPipelineStage,
  PIPELINE_STAGES,
  resolvePipelineStage,
  sumDealValues,
  type PipelineStage,
} from "@/lib/pipeline";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type DealForm = {
  id?: string;
  name: string;
  dealValue: string;
  contactName: string;
  dealNote: string;
  stage: PipelineStage;
};

const EMPTY_FORM: DealForm = {
  name: "",
  dealValue: "",
  contactName: "",
  dealNote: "",
  stage: "lead",
};

function formFromDeal(deal: SalesBusiness): DealForm {
  return {
    id: deal.id,
    name: deal.name,
    dealValue: deal.dealValue === undefined ? "" : String(deal.dealValue),
    contactName: deal.contactName ?? "",
    dealNote: deal.dealNote ?? "",
    stage: resolvePipelineStage(deal),
  };
}

function parseFormValue(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const amount = Number(trimmed.replace(/[$,]/g, ""));
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error("Deal value must be empty or a non-negative USD number");
  }
  return amount;
}

function latestNote(deal: SalesBusiness) {
  return [...deal.notes].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
}

function stageDropId(stage: PipelineStage) {
  return `stage:${stage}`;
}

const boardCollision: CollisionDetection = (args) => {
  const pointerHits = pointerWithin(args);
  if (pointerHits.length > 0) return pointerHits;
  const rectHits = rectIntersection(args);
  if (rectHits.length > 0) return rectHits;
  return closestCorners(args);
};

function useHorizontalBoardWheel(scrollerRef: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const node = scrollerRef.current;
    if (!node) return;
    const scroller: HTMLDivElement = node;

    function onWheel(event: WheelEvent) {
      if (event.ctrlKey || event.metaKey) return;

      const deltaX =
        event.shiftKey && Math.abs(event.deltaY) >= Math.abs(event.deltaX)
          ? event.deltaY
          : event.deltaX;
      if (Math.abs(deltaX) > Math.abs(event.deltaY) || event.shiftKey) {
        if (scroller.scrollWidth <= scroller.clientWidth + 1) return;
        event.preventDefault();
        scroller.scrollLeft += deltaX;
        return;
      }

      const column = (event.target as Element | null)?.closest?.(
        "[data-column-scroll]",
      );
      if (column instanceof HTMLElement) {
        const goingUp = event.deltaY < 0;
        const canScroll = goingUp
          ? column.scrollTop > 0
          : column.scrollTop + column.clientHeight < column.scrollHeight - 1;
        if (canScroll) return;
      }

      if (scroller.scrollWidth <= scroller.clientWidth + 1) return;
      event.preventDefault();
      scroller.scrollLeft += event.deltaY;
    }

    scroller.addEventListener("wheel", onWheel, { passive: false });
    return () => scroller.removeEventListener("wheel", onWheel);
  }, [scrollerRef]);
}

function columnTone(stage: PipelineStage) {
  if (stage === "won") return "border-[color-mix(in_oklch,var(--sage),var(--border)_45%)]";
  if (stage === "lost") {
    return "border-[color-mix(in_oklch,var(--terracotta),var(--border)_40%)]";
  }
  if (stage === "hold") {
    return "border-[color-mix(in_oklch,var(--needs-joseph),var(--border)_35%)]";
  }
  return "border-border";
}

function DealCardBody({
  deal,
  labels,
}: {
  deal: SalesBusiness;
  labels: Record<PipelineStage, string>;
}) {
  const contact = deal.contactName || deal.phone;
  const note = deal.dealNote || latestNote(deal)?.body;
  const overdue = isReminderOverdue(deal.reminderAt);
  const today = isReminderToday(deal.reminderAt);

  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="font-heading text-sm leading-snug font-medium">{deal.name}</p>
        {deal.dealValue !== undefined ? (
          <p className="shrink-0 text-sm tabular-nums text-foreground">
            {formatDealValue(deal.dealValue)}
          </p>
        ) : null}
      </div>
      {contact ? (
        <p className="mt-1 text-xs text-muted-foreground">{contact}</p>
      ) : null}
      {note ? (
        <p className="mt-1.5 line-clamp-2 text-xs text-foreground/80">{note}</p>
      ) : null}
      <div className="mt-2 flex flex-wrap items-center gap-1">
        <Badge variant="outline">{deal.type}</Badge>
        {deal.greenlit ? <Badge>greenlit</Badge> : null}
        {deal.reminderAt ? (
          <Badge variant={overdue ? "destructive" : today ? "joseph" : "secondary"}>
            <Bell className="size-3" />
            {overdue ? "overdue" : today ? "today" : formatChicagoDateTime(deal.reminderAt)}
          </Badge>
        ) : null}
        {resolvePipelineStage(deal) === "won" || resolvePipelineStage(deal) === "lost" ? (
          <Badge variant="secondary">{labels[resolvePipelineStage(deal)]}</Badge>
        ) : null}
      </div>
    </>
  );
}

function DraggableDealCard({
  deal,
  labels,
  disabled,
  onOpen,
  onWon,
  onLost,
}: {
  deal: SalesBusiness;
  labels: Record<PipelineStage, string>;
  disabled: boolean;
  onOpen: () => void;
  onWon: () => void;
  onLost: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: deal.id,
    data: { type: "deal", stage: resolvePipelineStage(deal) },
    disabled,
  });
  const stage = resolvePipelineStage(deal);

  return (
    <article
      ref={setNodeRef}
      className={cn(
        "cursor-grab rounded-xl border border-border bg-card px-3 py-2.5 shadow-sm ring-foreground/5 active:cursor-grabbing",
        isDragging && "opacity-40",
      )}
      {...attributes}
      {...listeners}
      role="group"
      onClick={onOpen}
    >
      <DealCardBody deal={deal} labels={labels} />
      {stage !== "won" && stage !== "lost" ? (
        <div className="mt-2 flex gap-1.5">
          <Button
            type="button"
            size="xs"
            variant="secondary"
            disabled={disabled}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              onWon();
            }}
          >
            <Check className="size-3" />
            Won
          </Button>
          <Button
            type="button"
            size="xs"
            variant="outline"
            disabled={disabled}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              onLost();
            }}
          >
            <X className="size-3" />
            Lost
          </Button>
        </div>
      ) : null}
    </article>
  );
}

function StageColumn({
  stage,
  label,
  deals,
  labels,
  pending,
  onRename,
  onOpen,
  onMove,
}: {
  stage: PipelineStage;
  label: string;
  deals: SalesBusiness[];
  labels: Record<PipelineStage, string>;
  pending: boolean;
  onRename: (label: string) => void;
  onOpen: (deal: SalesBusiness) => void;
  onMove: (id: string, stage: PipelineStage) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: stageDropId(stage),
    data: { type: "column", stage },
  });
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(label);
  const totals = sumDealValues(deals);

  return (
    <section
      ref={setNodeRef}
      className={cn(
        "flex h-full min-h-0 w-72 shrink-0 flex-col rounded-2xl border bg-muted/35",
        columnTone(stage),
        isOver && "bg-muted/70 ring-2 ring-primary/25",
      )}
    >
      <header className="flex shrink-0 items-start justify-between gap-2 px-3 pt-3 pb-2">
        <div className="min-w-0">
          {editing ? (
            <Input
              value={draft}
              autoFocus
              className="h-7"
              aria-label="Rename stage"
              onChange={(event) => setDraft(event.target.value)}
              onBlur={() => {
                setEditing(false);
                const next = draft.trim();
                if (next && next !== label) onRename(next);
                else setDraft(label);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur();
                if (event.key === "Escape") {
                  setDraft(label);
                  setEditing(false);
                }
              }}
            />
          ) : (
            <button
              type="button"
              className="font-heading text-left text-sm font-medium hover:underline"
              onClick={() => {
                setDraft(label);
                setEditing(true);
              }}
            >
              {label}
            </button>
          )}
          <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
            {totals.count} {totals.count === 1 ? "deal" : "deals"}
            {totals.hasValues ? ` · ${formatDealValue(totals.total)}` : ""}
          </p>
        </div>
      </header>
      <div
        data-column-scroll
        className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-y-contain px-2 pb-3"
      >
        {deals.map((deal) => (
          <DraggableDealCard
            key={deal.id}
            deal={deal}
            labels={labels}
            disabled={pending}
            onOpen={() => onOpen(deal)}
            onWon={() => onMove(deal.id, "won")}
            onLost={() => onMove(deal.id, "lost")}
          />
        ))}
        {deals.length === 0 ? (
          <p className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-border px-3 py-8 text-center text-xs text-muted-foreground">
            Drop deals here
          </p>
        ) : null}
      </div>
    </section>
  );
}

export function SalesPipeline({
  businesses,
  labels: initialLabels,
}: {
  businesses: SalesBusiness[];
  labels: Record<PipelineStage, string>;
}) {
  const [deals, setDeals] = useState(businesses);
  const [labels, setLabels] = useState(initialLabels);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<DealForm>(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const suppressClick = useRef(false);
  const boardRef = useRef<HTMLDivElement>(null);
  useHorizontalBoardWheel(boardRef);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
  );

  const grouped = useMemo(() => groupDealsByStage(deals), [deals]);
  const activeDeal = deals.find((deal) => deal.id === activeId);
  const totals = sumDealValues(deals);

  function applyDeal(next: SalesBusiness) {
    setDeals((current) => {
      const index = current.findIndex((deal) => deal.id === next.id);
      if (index < 0) return [...current, next];
      const copy = [...current];
      copy[index] = next;
      return copy;
    });
  }

  function moveDeal(id: string, stage: PipelineStage) {
    const current = deals.find((deal) => deal.id === id);
    if (!current || resolvePipelineStage(current) === stage) return;
    setDeals((list) =>
      list.map((deal) =>
        deal.id === id
          ? {
              ...deal,
              pipelineStage: stage,
              status:
                stage === "won"
                  ? "greenlit"
                  : stage === "hold"
                    ? "hold"
                    : stage === "skipped" || stage === "lost"
                      ? "skipped"
                      : stage === "contact-made" || stage === "proposal"
                        ? "contacted"
                        : "target",
              greenlit: stage === "won" ? true : deal.greenlit,
            }
          : deal,
      ),
    );
    startTransition(async () => {
      applyDeal(await setBusinessPipelineStageAction(id, stage));
    });
  }

  function stageFromOver(overId: string, overStage?: PipelineStage): PipelineStage | null {
    if (overStage && isPipelineStage(overStage)) return overStage;
    if (overId.startsWith("stage:")) {
      const stage = overId.slice("stage:".length);
      return isPipelineStage(stage) ? stage : null;
    }
    const deal = deals.find((item) => item.id === overId);
    return deal ? resolvePipelineStage(deal) : null;
  }

  function handleDragStart(event: DragStartEvent) {
    suppressClick.current = true;
    setActiveId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    setTimeout(() => {
      suppressClick.current = false;
    }, 0);
    if (!over) return;
    const overData = over.data.current as { stage?: PipelineStage } | undefined;
    const stage = stageFromOver(String(over.id), overData?.stage);
    if (!stage) return;
    moveDeal(String(active.id), stage);
  }

  function openCreate() {
    setForm(EMPTY_FORM);
    setFormError("");
    setFormOpen(true);
  }

  function openEdit(deal: SalesBusiness) {
    if (suppressClick.current) return;
    setForm(formFromDeal(deal));
    setFormError("");
    setFormOpen(true);
  }

  function saveForm() {
    const name = form.name.trim();
    if (!name) {
      setFormError("Name is required");
      return;
    }
    let dealValue: number | null;
    try {
      dealValue = parseFormValue(form.dealValue);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Invalid deal value");
      return;
    }
    startTransition(async () => {
      const saved = await upsertBusinessAction({
        id: form.id,
        name,
        type: form.id
          ? (deals.find((deal) => deal.id === form.id)?.type ?? "other")
          : "other",
        pipelineStage: form.stage,
        dealValue,
        contactName: form.contactName.trim() ? form.contactName.trim() : null,
        dealNote: form.dealNote.trim() ? form.dealNote.trim() : null,
      });
      applyDeal(saved);
      setFormOpen(false);
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex shrink-0 flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            Drag shops between stages. Existing Springfield businesses seed the
            board; notes, tags, and phones stay on the record.
          </p>
          <p className="mt-1 text-xs text-muted-foreground tabular-nums">
            {totals.count} deals
            {totals.hasValues ? ` · ${formatDealValue(totals.total)} on the board` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" asChild>
            <Link href="/businesses">
              <Store data-icon="inline-start" />
              Shop list
            </Link>
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Plus data-icon="inline-start" />
            Deal
          </Button>
        </div>
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <DndContext
        sensors={sensors}
        collisionDetection={boardCollision}
        onDragStart={handleDragStart}
        onDragCancel={() => {
          setActiveId(null);
          suppressClick.current = false;
        }}
        onDragEnd={handleDragEnd}
      >
        <div
          ref={boardRef}
          role="region"
          aria-label="Pipeline stages"
          tabIndex={0}
          className="pipeline-h-scroll -mx-4 flex min-h-0 min-w-0 flex-1 flex-col px-4 pb-1 sm:-mx-6 sm:px-6"
        >
          <div className="flex min-h-0 w-max min-w-full flex-1 items-stretch gap-3">
            {PIPELINE_STAGES.map((stage) => (
              <StageColumn
                key={stage}
                stage={stage}
                label={labels[stage]}
                deals={grouped[stage]}
                labels={labels}
                pending={pending}
                onRename={(label) => {
                  setLabels((current) => ({ ...current, [stage]: label }));
                  startTransition(async () => {
                    setLabels(await savePipelineLabelsAction({ [stage]: label }));
                  });
                }}
                onOpen={openEdit}
                onMove={moveDeal}
              />
            ))}
          </div>
        </div>
        <DragOverlay>
          {activeDeal ? (
            <div className="w-72 rounded-xl border border-border bg-card px-3 py-2.5 shadow-lg">
              <DealCardBody deal={activeDeal} labels={labels} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit deal" : "Add deal"}</DialogTitle>
            <DialogDescription>
              Name is required. Value can stay empty for Viselle walk-in shops.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-2">
              <Label htmlFor="deal-name">Name</Label>
              <Input
                id="deal-name"
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({ ...current, name: event.target.value }))
                }
                placeholder="Shop or deal name"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="deal-value">Value (USD)</Label>
                <Input
                  id="deal-value"
                  inputMode="decimal"
                  value={form.dealValue}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      dealValue: event.target.value,
                    }))
                  }
                  placeholder="optional"
                />
              </div>
              <div className="grid gap-2">
                <Label>Stage</Label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button type="button" variant="outline" className="w-full justify-between">
                      {labels[form.stage]}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="start"
                    className="bg-card text-card-foreground"
                  >
                    {PIPELINE_STAGES.map((stage) => (
                      <DropdownMenuItem
                        key={stage}
                        onClick={() =>
                          setForm((current) => ({ ...current, stage }))
                        }
                      >
                        {labels[stage]}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="deal-contact">Contact</Label>
              <Input
                id="deal-contact"
                value={form.contactName}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    contactName: event.target.value,
                  }))
                }
                placeholder="Name or phone"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="deal-note">Next step</Label>
              <Textarea
                id="deal-note"
                value={form.dealNote}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    dealNote: event.target.value,
                  }))
                }
                placeholder="Call after 2 / ask for manager"
              />
            </div>
            {formError ? (
              <p className="text-sm text-destructive" role="alert">
                {formError}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              disabled={pending || form.name.trim().length === 0}
              onClick={saveForm}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
