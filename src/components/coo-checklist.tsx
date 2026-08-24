"use client";

import { useMemo, useState, useTransition } from "react";
import {
  closestCenter,
  DndContext,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, GripVertical, Plus, Trash2 } from "lucide-react";
import {
  addChecklistItemAction,
  deleteChecklistItemAction,
  reorderChecklistAction,
  toggleChecklistItemAction,
  updateChecklistTitleAction,
} from "@/lib/actions";
import { buildChecklistSections, plannedDateForSection } from "@/lib/checklist";
import { todayISO } from "@/lib/dates";
import type { ChecklistItem, ChecklistView } from "@/lib/schema";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const VIEW_LABELS: Record<ChecklistView, string> = {
  today: "Today",
  weekly: "Weekly",
  monthly: "Monthly",
};

function SortableRow({
  item,
  onToggle,
  onRename,
  onDelete,
}: {
  item: ChecklistItem;
  onToggle: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.title);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({
      id: item.id,
      data: { type: "item", plannedDate: item.plannedDate },
    });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex items-start gap-2 rounded-md px-1 py-1.5",
        isDragging && "bg-muted/70",
      )}
    >
      <button
        type="button"
        className="mt-0.5 cursor-grab text-muted-foreground hover:text-foreground"
        aria-label="Drag to reorder"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>
      <Checkbox
        checked={item.done}
        onCheckedChange={() => onToggle(item.id)}
        className="mt-0.5"
      />
      {editing ? (
        <Input
          value={draft}
          autoFocus
          className="h-7"
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => {
            setEditing(false);
            if (draft.trim() && draft.trim() !== item.title) {
              onRename(item.id, draft.trim());
            } else {
              setDraft(item.title);
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.currentTarget.blur();
            }
            if (event.key === "Escape") {
              setDraft(item.title);
              setEditing(false);
            }
          }}
        />
      ) : (
        <button
          type="button"
          className={cn(
            "min-w-0 flex-1 text-left text-sm",
            item.done && "text-muted-foreground line-through",
          )}
          onClick={() => setEditing(true)}
        >
          {item.title}
        </button>
      )}
      <Button
        type="button"
        size="icon-xs"
        variant="ghost"
        aria-label="Delete item"
        onClick={() => onDelete(item.id)}
      >
        <Trash2 className="size-3.5" />
      </Button>
    </div>
  );
}

function Section({
  sectionKey,
  label,
  items,
  draft,
  onDraftChange,
  onAdd,
  onToggle,
  onRename,
  onDelete,
}: {
  sectionKey: string;
  label: string;
  items: ChecklistItem[];
  draft: string;
  onDraftChange: (value: string) => void;
  onAdd: () => void;
  onToggle: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `section:${sectionKey}`,
    data: { type: "section", plannedDate: sectionKey },
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "rounded-lg border px-2 py-2",
        isOver && "border-primary/50 bg-muted/40",
      )}
    >
      <p className="px-1 pb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col">
          {items.map((item) => (
            <SortableRow
              key={item.id}
              item={item}
              onToggle={onToggle}
              onRename={onRename}
              onDelete={onDelete}
            />
          ))}
        </div>
      </SortableContext>
      <form
        className="mt-1 flex items-center gap-2 px-1"
        onSubmit={(event) => {
          event.preventDefault();
          onAdd();
        }}
      >
        <Plus className="size-3.5 text-muted-foreground" />
        <Input
          value={draft}
          placeholder="Add item"
          className="h-7 border-0 bg-transparent shadow-none focus-visible:ring-0"
          onChange={(event) => onDraftChange(event.target.value)}
        />
      </form>
    </div>
  );
}

export function CooChecklist({
  items: initialItems,
  today = todayISO(),
}: {
  items: ChecklistItem[];
  today?: string;
}) {
  const [view, setView] = useState<ChecklistView>("today");
  const [items, setItems] = useState(initialItems);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [, startTransition] = useTransition();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const sections = useMemo(
    () => buildChecklistSections(items, view, today),
    [items, view, today],
  );

  function persistOrder(next: ChecklistItem[]) {
    startTransition(async () => {
      await reorderChecklistAction(
        next.map((item) => ({
          id: item.id,
          plannedDate: item.plannedDate,
          sortOrder: item.sortOrder,
        })),
      );
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const overData = over.data.current as
      | { type?: string; plannedDate?: string }
      | undefined;
    const targetDate =
      overData?.type === "section"
        ? plannedDateForSection(view, String(overData.plannedDate ?? ""), today)
        : items.find((item) => item.id === over.id)?.plannedDate;
    if (!targetDate) return;

    const moving = items.find((item) => item.id === active.id);
    if (!moving) return;

    const without = items.filter((item) => item.id !== active.id);
    const moved = { ...moving, plannedDate: targetDate };
    const destination = without.filter((item) => item.plannedDate === targetDate);
    const source = without.filter((item) => item.plannedDate === moving.plannedDate);
    const untouched = without.filter(
      (item) => item.plannedDate !== targetDate && item.plannedDate !== moving.plannedDate,
    );

    let insertAt = destination.findIndex((item) => item.id === over.id);
    if (insertAt < 0) insertAt = destination.length;
    destination.splice(insertAt, 0, moved);

    const reindexedDestination = destination.map((item, index) => ({
      ...item,
      plannedDate: targetDate,
      sortOrder: index,
    }));
    const reindexedSource = source.map((item, index) => ({
      ...item,
      sortOrder: index,
    }));
    const next = [...untouched, ...reindexedSource, ...reindexedDestination];
    setItems(next);
    persistOrder([...reindexedSource, ...reindexedDestination]);
  }

  return (
    <section className="flex min-h-0 flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-medium tracking-wide uppercase">COO checklist</h2>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline">
              {VIEW_LABELS[view]}
              <ChevronDown className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-card text-card-foreground">
            {(Object.keys(VIEW_LABELS) as ChecklistView[]).map((option) => (
              <DropdownMenuItem key={option} onClick={() => setView(option)}>
                {VIEW_LABELS[option]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <div className="flex flex-col gap-2">
          {sections.map((section) => (
            <Section
              key={section.key}
              sectionKey={section.key}
              label={section.label}
              items={section.items}
              draft={drafts[section.key] ?? ""}
              onDraftChange={(value) =>
                setDrafts((current) => ({ ...current, [section.key]: value }))
              }
              onAdd={() => {
                const title = (drafts[section.key] ?? "").trim();
                if (!title) return;
                const plannedDate = plannedDateForSection(view, section.key, today);
                setDrafts((current) => ({ ...current, [section.key]: "" }));
                startTransition(async () => {
                  const created = await addChecklistItemAction(title, plannedDate);
                  setItems((current) => [...current, created]);
                });
              }}
              onToggle={(id) => {
                setItems((current) =>
                  current.map((item) =>
                    item.id === id ? { ...item, done: !item.done } : item,
                  ),
                );
                startTransition(async () => {
                  await toggleChecklistItemAction(id);
                });
              }}
              onRename={(id, title) => {
                setItems((current) =>
                  current.map((item) => (item.id === id ? { ...item, title } : item)),
                );
                startTransition(async () => {
                  await updateChecklistTitleAction(id, title);
                });
              }}
              onDelete={(id) => {
                setItems((current) => current.filter((item) => item.id !== id));
                startTransition(async () => {
                  await deleteChecklistItemAction(id);
                });
              }}
            />
          ))}
        </div>
      </DndContext>
    </section>
  );
}
