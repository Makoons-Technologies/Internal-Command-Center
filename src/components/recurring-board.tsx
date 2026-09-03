"use client";

import { useMemo, useState, useTransition } from "react";
import { ExternalLink, Pencil, Plus, Trash2 } from "lucide-react";
import {
  deleteCardAction,
  upsertRecurringCardAction,
} from "@/lib/actions";
import {
  cadenceLabel,
  groupRecurringCards,
  isRecurringCadence,
  parseCardTags,
  RECURRING_CADENCES,
  type RecurringCadence,
} from "@/lib/recurring";
import {
  CARD_STATUSES,
  FUNCTION_OWNERS,
  type CardStatus,
  type CommandCard,
  type FunctionOwner,
} from "@/lib/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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

const STATUS_VARIANT: Record<
  CardStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  blocked: "destructive",
  ready: "default",
  open: "secondary",
  done: "outline",
};

const CADENCE_COPY: Record<RecurringCadence, string> = {
  daily: "Shows on Today and the COO today list.",
  weekly: "Shows on Week and the COO weekly list.",
  monthly: "Shows on Month and the COO monthly list.",
};

type RecurringFormState = {
  id?: string;
  title: string;
  owner: FunctionOwner;
  cadence: RecurringCadence;
  status: CardStatus;
  needsJoseph: boolean;
  nextStep: string;
  link: string;
  dueDate: string;
  tags: string;
};

const EMPTY_FORM: RecurringFormState = {
  title: "",
  owner: "coo",
  cadence: "daily",
  status: "open",
  needsJoseph: false,
  nextStep: "",
  link: "",
  dueDate: "",
  tags: "",
};

function formFromCard(card: CommandCard): RecurringFormState {
  return {
    id: card.id,
    title: card.title,
    owner: card.owner,
    cadence: isRecurringCadence(card.cadence) ? card.cadence : "daily",
    status: card.status,
    needsJoseph: card.needsJoseph,
    nextStep: card.nextStep,
    link: card.link ?? "",
    dueDate: card.dueDate ?? "",
    tags: (card.tags ?? []).join(", "),
  };
}

function BoardSelect({
  label,
  value,
  onValueChange,
  options,
  className,
}: {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: { value: string; label: string }[];
  className?: string;
}) {
  const current =
    options.find((option) => option.value === value)?.label ?? options[0]?.label;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label={label}
          className={cn("min-w-36 justify-between", className)}
        >
          <span className="truncate">{current}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="bg-card text-card-foreground"
      >
        {options.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onClick={() => onValueChange(option.value)}
          >
            {option.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function RecurringRow({
  card,
  pending,
  onEdit,
  onRemove,
}: {
  card: CommandCard;
  pending: boolean;
  onEdit: (card: CommandCard) => void;
  onRemove: (card: CommandCard) => void;
}) {
  return (
    <article className="rounded-lg border px-3 py-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-medium leading-snug">{card.title}</h3>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Badge variant="outline">{card.owner}</Badge>
            <Badge variant="outline">{card.cadence}</Badge>
            <Badge variant={STATUS_VARIANT[card.status]}>{card.status}</Badge>
            {card.needsJoseph ? <Badge>needsJoseph</Badge> : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            size="icon-xs"
            variant="ghost"
            aria-label={`Edit ${card.title}`}
            disabled={pending}
            onClick={() => onEdit(card)}
          >
            <Pencil className="size-3.5" />
          </Button>
          <Button
            type="button"
            size="icon-xs"
            variant="ghost"
            aria-label={`Remove ${card.title}`}
            disabled={pending}
            onClick={() => onRemove(card)}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>
      <p className="mt-2 text-sm text-foreground/90">{card.nextStep}</p>
      {card.link || card.dueDate || card.tags?.length ? (
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {card.link ? (
            <a
              href={card.link}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-foreground hover:underline"
            >
              <ExternalLink className="size-3" />
              {card.link.replace(/^https?:\/\//, "")}
            </a>
          ) : null}
          {card.dueDate ? <span>due {card.dueDate}</span> : null}
          {card.tags?.length ? (
            <span>{card.tags.map((tag) => `#${tag}`).join(" ")}</span>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

export function RecurringBoard({ cards }: { cards: CommandCard[] }) {
  const [formOpen, setFormOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [form, setForm] = useState<RecurringFormState>(EMPTY_FORM);
  const [removing, setRemoving] = useState<CommandCard | null>(null);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const groups = useMemo(() => groupRecurringCards(cards), [cards]);

  function openCreate(cadence?: RecurringCadence) {
    setForm({
      ...EMPTY_FORM,
      cadence: cadence ?? "daily",
    });
    setError("");
    setFormOpen(true);
  }

  function openEdit(card: CommandCard) {
    setForm(formFromCard(card));
    setError("");
    setFormOpen(true);
  }

  function openRemove(card: CommandCard) {
    setRemoving(card);
    setError("");
    setRemoveOpen(true);
  }

  function saveForm() {
    const title = form.title.trim();
    const nextStep = form.nextStep.trim();
    if (!title || !nextStep) {
      setError("Title and next step are required.");
      return;
    }
    startTransition(async () => {
      try {
        await upsertRecurringCardAction({
          id: form.id,
          title,
          owner: form.owner,
          cadence: form.cadence,
          status: form.status,
          needsJoseph: form.needsJoseph,
          nextStep,
          link: form.link.trim(),
          dueDate: form.dueDate.trim(),
          tags: parseCardTags(form.tags),
        });
        setFormOpen(false);
        setError("");
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Save failed.");
      }
    });
  }

  function confirmRemove() {
    if (!removing) return;
    startTransition(async () => {
      try {
        await deleteCardAction(removing.id);
        setRemoveOpen(false);
        setRemoving(null);
        setError("");
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Remove failed.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-xl text-sm text-muted-foreground">
          Repeatable work only. One-off cards stay on Today and function lanes.
          Add, change cadence, or remove here — it writes the same cards Grok
          Bot already reads.
        </p>
        <Button type="button" size="sm" onClick={() => openCreate()}>
          <Plus className="size-3.5" />
          Add recurring
        </Button>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        {RECURRING_CADENCES.map((cadence) => {
          const items = groups[cadence];
          return (
            <section key={cadence} className="flex min-w-0 flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-medium tracking-wide uppercase">
                    {cadenceLabel(cadence)}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {CADENCE_COPY[cadence]}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{items.length}</Badge>
                  <Button
                    type="button"
                    size="icon-xs"
                    variant="outline"
                    aria-label={`Add ${cadence} item`}
                    onClick={() => openCreate(cadence)}
                  >
                    <Plus className="size-3.5" />
                  </Button>
                </div>
              </div>
              {items.length === 0 ? (
                <p className="rounded-lg border border-dashed px-3 py-5 text-sm text-muted-foreground">
                  No {cadence} repeats.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {items.map((card) => (
                    <RecurringRow
                      key={card.id}
                      card={card}
                      pending={pending}
                      onEdit={openEdit}
                      onRemove={openRemove}
                    />
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {form.id ? "Edit recurring" : "Add recurring"}
            </DialogTitle>
            <DialogDescription>
              Saves to the Command Center card store. Cadence daily / weekly /
              monthly also keeps a matching COO checklist row in sync.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-2">
              <Label htmlFor="recurring-title">Title</Label>
              <Input
                id="recurring-title"
                value={form.title}
                onChange={(event) =>
                  setForm((current) => ({ ...current, title: event.target.value }))
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Owner</Label>
                <BoardSelect
                  label="Owner"
                  value={form.owner}
                  onValueChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      owner: value as FunctionOwner,
                    }))
                  }
                  options={FUNCTION_OWNERS.map((owner) => ({
                    value: owner,
                    label: owner,
                  }))}
                  className="w-full"
                />
              </div>
              <div className="grid gap-2">
                <Label>Cadence</Label>
                <BoardSelect
                  label="Cadence"
                  value={form.cadence}
                  onValueChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      cadence: value as RecurringCadence,
                    }))
                  }
                  options={RECURRING_CADENCES.map((cadence) => ({
                    value: cadence,
                    label: cadence,
                  }))}
                  className="w-full"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Status</Label>
                <BoardSelect
                  label="Status"
                  value={form.status}
                  onValueChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      status: value as CardStatus,
                    }))
                  }
                  options={CARD_STATUSES.map((status) => ({
                    value: status,
                    label: status,
                  }))}
                  className="w-full"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="recurring-due">Due date</Label>
                <Input
                  id="recurring-due"
                  type="date"
                  value={form.dueDate}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      dueDate: event.target.value,
                    }))
                  }
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="recurring-needs-joseph"
                checked={form.needsJoseph}
                onCheckedChange={(checked) =>
                  setForm((current) => ({
                    ...current,
                    needsJoseph: checked === true,
                  }))
                }
              />
              <Label htmlFor="recurring-needs-joseph">Needs Joseph</Label>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="recurring-next">Next step</Label>
              <Textarea
                id="recurring-next"
                value={form.nextStep}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    nextStep: event.target.value,
                  }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="recurring-link">Link</Label>
              <Input
                id="recurring-link"
                value={form.link}
                placeholder="https://"
                onChange={(event) =>
                  setForm((current) => ({ ...current, link: event.target.value }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="recurring-tags">Tags</Label>
              <Input
                id="recurring-tags"
                value={form.tags}
                placeholder="packet, canva"
                onChange={(event) =>
                  setForm((current) => ({ ...current, tags: event.target.value }))
                }
              />
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>
          <DialogFooter>
            <Button
              disabled={pending || form.title.trim().length === 0}
              onClick={saveForm}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={removeOpen} onOpenChange={setRemoveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove recurring</DialogTitle>
            <DialogDescription>
              Deletes this card from the Command Center store. Agents will no
              longer see it in list_cards. A linked checklist row is removed
              too.
            </DialogDescription>
          </DialogHeader>
          {removing ? (
            <p className="text-sm">
              Remove <span className="font-medium">{removing.title}</span>?
            </p>
          ) : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button
              variant="destructive"
              disabled={pending || !removing}
              onClick={confirmRemove}
            >
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
