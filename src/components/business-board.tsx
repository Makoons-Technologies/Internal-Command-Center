"use client";

import { useMemo, useState, useTransition } from "react";
import {
  AtSign,
  ExternalLink,
  Phone,
  Plus,
} from "lucide-react";
import {
  addBusinessNoteAction,
  setBusinessGreenlightAction,
  setBusinessReminderAction,
  upsertBusinessAction,
} from "@/lib/actions";
import {
  BUSINESS_STATUSES,
  BUSINESS_TYPES,
  collectBusinessTags,
  filterBusinesses,
  formatChicagoDateTime,
  fromChicagoDateTimeLocal,
  instagramLabel,
  instagramUrl,
  isReminderOverdue,
  isReminderToday,
  parseTagsInput,
  SEEDED_TAGS,
  sortBusinesses,
  toChicagoDateTimeLocal,
  type BusinessStatus,
  type BusinessType,
  type SalesBusiness,
} from "@/lib/business";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

type ReminderFilter = "overdue" | "today" | null;
type GreenlitFilter = boolean | null;

const STATUS_VARIANT: Record<
  BusinessStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  target: "default",
  hold: "secondary",
  skipped: "outline",
  contacted: "secondary",
  greenlit: "default",
};

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

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-2 py-0.5 text-xs transition-colors",
        active
          ? "border-foreground bg-foreground text-background"
          : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}

type BusinessFormState = {
  id?: string;
  name: string;
  type: BusinessType;
  status: BusinessStatus;
  address: string;
  city: string;
  phone: string;
  website: string;
  instagram: string;
  tags: string;
};

const EMPTY_FORM: BusinessFormState = {
  name: "",
  type: "nails",
  status: "target",
  address: "",
  city: "",
  phone: "",
  website: "",
  instagram: "",
  tags: "target",
};

function formFromBusiness(business: SalesBusiness): BusinessFormState {
  return {
    id: business.id,
    name: business.name,
    type: business.type,
    status: business.status,
    address: business.address ?? "",
    city: business.city ?? "",
    phone: business.phone ?? "",
    website: business.website ?? "",
    instagram: business.instagram ?? "",
    tags: business.tags.join(", "),
  };
}

function latestNote(business: SalesBusiness) {
  return [...business.notes].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  )[0];
}

export function BusinessBoard({ businesses }: { businesses: SalesBusiness[] }) {
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [reminderFilter, setReminderFilter] = useState<ReminderFilter>(null);
  const [greenlitFilter, setGreenlitFilter] = useState<GreenlitFilter>(null);
  const [statusFilter, setStatusFilter] = useState<BusinessStatus | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<BusinessFormState>(EMPTY_FORM);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteId, setNoteId] = useState<string | null>(null);
  const [noteBody, setNoteBody] = useState("");
  const [reminderOpen, setReminderOpen] = useState(false);
  const [reminderId, setReminderId] = useState<string | null>(null);
  const [reminderAt, setReminderAt] = useState("");
  const [reminderNote, setReminderNote] = useState("");
  const [pending, startTransition] = useTransition();

  const tags = useMemo(() => collectBusinessTags(businesses), [businesses]);
  const filtered = useMemo(
    () =>
      sortBusinesses(
        filterBusinesses(businesses, {
          tags: selectedTags,
          reminder: reminderFilter ?? undefined,
          greenlit: greenlitFilter ?? undefined,
          status: statusFilter ?? undefined,
        }),
      ),
    [businesses, selectedTags, reminderFilter, greenlitFilter, statusFilter],
  );

  const overdueCount = businesses.filter((business) =>
    isReminderOverdue(business.reminderAt),
  ).length;
  const todayCount = businesses.filter((business) =>
    isReminderToday(business.reminderAt),
  ).length;
  const greenlitCount = businesses.filter((business) => business.greenlit).length;

  function toggleTag(tag: string) {
    setSelectedTags((current) =>
      current.includes(tag)
        ? current.filter((item) => item !== tag)
        : [...current, tag],
    );
  }

  function openCreate() {
    setForm(EMPTY_FORM);
    setFormOpen(true);
  }

  function openEdit(business: SalesBusiness) {
    setForm(formFromBusiness(business));
    setFormOpen(true);
  }

  function openNote(business: SalesBusiness) {
    setNoteId(business.id);
    setNoteBody("");
    setNoteOpen(true);
  }

  function openReminder(business: SalesBusiness) {
    setReminderId(business.id);
    setReminderAt(
      business.reminderAt ? toChicagoDateTimeLocal(business.reminderAt) : "",
    );
    setReminderNote(business.reminderNote ?? "");
    setReminderOpen(true);
  }

  function saveForm() {
    startTransition(async () => {
      await upsertBusinessAction({
        id: form.id,
        name: form.name,
        type: form.type,
        status: form.status,
        address: form.address,
        city: form.city,
        phone: form.phone,
        website: form.website,
        instagram: form.instagram,
        tags: parseTagsInput(form.tags),
      });
      setFormOpen(false);
    });
  }

  function saveNote() {
    if (!noteId) return;
    startTransition(async () => {
      await addBusinessNoteAction(noteId, noteBody);
      setNoteOpen(false);
      setNoteBody("");
    });
  }

  function saveReminder() {
    if (!reminderId) return;
    startTransition(async () => {
      await setBusinessReminderAction(
        reminderId,
        reminderAt ? fromChicagoDateTimeLocal(reminderAt) : null,
        reminderNote.trim() ? reminderNote.trim() : null,
      );
      setReminderOpen(false);
    });
  }

  function clearReminder() {
    if (!reminderId) return;
    startTransition(async () => {
      await setBusinessReminderAction(reminderId, null, null);
      setReminderOpen(false);
    });
  }

  const noteTarget = businesses.find((business) => business.id === noteId);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            Phone-sales / walk-in tracker. Springfield-area shops for Viselle
            BETA. Reminders use America/Chicago.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {businesses.length} shops · {greenlitCount} greenlit · {overdueCount}{" "}
            overdue · {todayCount} today
          </p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus data-icon="inline-start" />
          Add business
        </Button>
      </div>

      <section className="flex flex-col gap-3 rounded-lg border px-3 py-3">
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Tags
          </p>
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <FilterChip
                key={tag}
                label={`#${tag}`}
                active={selectedTags.includes(tag)}
                onClick={() => toggleTag(tag)}
              />
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-4">
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Reminders
            </p>
            <div className="flex flex-wrap gap-1.5">
              <FilterChip
                label="All"
                active={reminderFilter === null}
                onClick={() => setReminderFilter(null)}
              />
              <FilterChip
                label={`Overdue (${overdueCount})`}
                active={reminderFilter === "overdue"}
                onClick={() => setReminderFilter("overdue")}
              />
              <FilterChip
                label={`Today (${todayCount})`}
                active={reminderFilter === "today"}
                onClick={() => setReminderFilter("today")}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Greenlight
            </p>
            <div className="flex flex-wrap gap-1.5">
              <FilterChip
                label="All"
                active={greenlitFilter === null}
                onClick={() => setGreenlitFilter(null)}
              />
              <FilterChip
                label="Greenlit"
                active={greenlitFilter === true}
                onClick={() => setGreenlitFilter(true)}
              />
              <FilterChip
                label="Not yet"
                active={greenlitFilter === false}
                onClick={() => setGreenlitFilter(false)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Status
            </p>
            <div className="flex flex-wrap gap-1.5">
              <FilterChip
                label="All"
                active={statusFilter === null}
                onClick={() => setStatusFilter(null)}
              />
              {BUSINESS_STATUSES.map((status) => (
                <FilterChip
                  key={status}
                  label={status}
                  active={statusFilter === status}
                  onClick={() => setStatusFilter(status)}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {filtered.length === 0 ? (
        <p className="rounded-lg border border-dashed px-3 py-6 text-sm text-muted-foreground">
          No businesses match these filters.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((business) => {
            const note = latestNote(business);
            const overdue = isReminderOverdue(business.reminderAt);
            const today = isReminderToday(business.reminderAt);
            return (
              <Card key={business.id} size="sm" className="ring-foreground/8">
                <CardHeader className="gap-2">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <CardTitle className="text-sm">{business.name}</CardTitle>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="outline">{business.type}</Badge>
                      <Badge variant={STATUS_VARIANT[business.status]}>
                        {business.status}
                      </Badge>
                      {business.greenlit ? (
                        <Badge>
                          greenlit
                          {business.greenlitReason
                            ? ` · ${business.greenlitReason}`
                            : ""}
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    {business.address ? <span>{business.address}</span> : null}
                    {business.city ? <span>{business.city}</span> : null}
                    {business.phone ? (
                      <a
                        href={`tel:${business.phone}`}
                        className="inline-flex items-center gap-1 text-foreground hover:underline"
                      >
                        <Phone className="size-3" />
                        {business.phone}
                      </a>
                    ) : null}
                    {business.website ? (
                      <a
                        href={business.website}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-foreground hover:underline"
                      >
                        <ExternalLink className="size-3" />
                        {business.website.replace(/^https?:\/\//, "")}
                      </a>
                    ) : null}
                    {business.instagram ? (
                      <a
                        href={instagramUrl(business.instagram)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-foreground hover:underline"
                      >
                        <AtSign className="size-3" />
                        {instagramLabel(business.instagram)}
                      </a>
                    ) : null}
                    {business.tags.length ? (
                      <span>
                        {business.tags.map((tag) => `#${tag}`).join(" ")}
                      </span>
                    ) : null}
                  </div>

                  {business.reminderAt ? (
                    <p
                      className={cn(
                        "text-sm",
                        overdue
                          ? "text-destructive"
                          : today
                            ? "text-foreground"
                            : "text-muted-foreground",
                      )}
                    >
                      Reminder {formatChicagoDateTime(business.reminderAt)}
                      {overdue ? " · overdue" : today ? " · today" : ""}
                      {business.reminderNote
                        ? ` — ${business.reminderNote}`
                        : ""}
                    </p>
                  ) : null}

                  {note ? (
                    <p className="text-sm text-foreground/90">
                      {note.body}
                      <span className="ml-2 text-xs text-muted-foreground">
                        {formatChicagoDateTime(note.createdAt)}
                      </span>
                    </p>
                  ) : null}

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      onClick={() => openEdit(business)}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      onClick={() => openNote(business)}
                    >
                      Add note
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      onClick={() => openReminder(business)}
                    >
                      Reminder
                    </Button>
                    <Button
                      size="sm"
                      variant={business.greenlit ? "secondary" : "default"}
                      disabled={pending}
                      onClick={() => {
                        startTransition(async () => {
                          await setBusinessGreenlightAction(
                            business.id,
                            !business.greenlit,
                          );
                        });
                      }}
                    >
                      {business.greenlit ? "Ungreenlight" : "Greenlight"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit business" : "Add business"}</DialogTitle>
            <DialogDescription>
              Enough data to walk in: name, address, phone, type, and status
              target. That auto-greenlights. Hold/skipped stay off unless you
              mark go-in.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-2">
              <Label htmlFor="business-name">Name</Label>
              <Input
                id="business-name"
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({ ...current, name: event.target.value }))
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Type</Label>
                <BoardSelect
                  label="Type"
                  value={form.type}
                  onValueChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      type: value as BusinessType,
                    }))
                  }
                  options={BUSINESS_TYPES.map((type) => ({
                    value: type,
                    label: type,
                  }))}
                  className="w-full"
                />
              </div>
              <div className="grid gap-2">
                <Label>Status</Label>
                <BoardSelect
                  label="Status"
                  value={form.status}
                  onValueChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      status: value as BusinessStatus,
                    }))
                  }
                  options={BUSINESS_STATUSES.map((status) => ({
                    value: status,
                    label: status,
                  }))}
                  className="w-full"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="business-address">Address</Label>
              <Input
                id="business-address"
                value={form.address}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    address: event.target.value,
                  }))
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="business-city">City</Label>
                <Input
                  id="business-city"
                  value={form.city}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      city: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="business-phone">Phone</Label>
                <Input
                  id="business-phone"
                  value={form.phone}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      phone: event.target.value,
                    }))
                  }
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="business-website">Website</Label>
              <Input
                id="business-website"
                value={form.website}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    website: event.target.value,
                  }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="business-instagram">Instagram</Label>
              <Input
                id="business-instagram"
                value={form.instagram}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    instagram: event.target.value,
                  }))
                }
                placeholder="@handle"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="business-tags">Tags</Label>
              <Input
                id="business-tags"
                value={form.tags}
                onChange={(event) =>
                  setForm((current) => ({ ...current, tags: event.target.value }))
                }
                placeholder="nails, springfield, no-booking"
              />
              <div className="flex flex-wrap gap-1.5">
                {SEEDED_TAGS.map((tag) => {
                  const current = parseTagsInput(form.tags);
                  const active = current.includes(tag);
                  return (
                    <FilterChip
                      key={tag}
                      label={`#${tag}`}
                      active={active}
                      onClick={() => {
                        const next = active
                          ? current.filter((item) => item !== tag)
                          : [...current, tag];
                        setForm((state) => ({ ...state, tags: next.join(", ") }));
                      }}
                    />
                  );
                })}
              </div>
            </div>
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

      <Dialog open={noteOpen} onOpenChange={setNoteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add note</DialogTitle>
            <DialogDescription>
              {noteTarget
                ? `Timestamped note on ${noteTarget.name}.`
                : "Timestamped note."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="business-note">Note</Label>
            <Textarea
              id="business-note"
              value={noteBody}
              onChange={(event) => setNoteBody(event.target.value)}
              placeholder="Called after 2; ask for manager…"
            />
          </div>
          <DialogFooter>
            <Button
              disabled={pending || noteBody.trim().length === 0}
              onClick={saveNote}
            >
              Add note
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={reminderOpen} onOpenChange={setReminderOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set reminder</DialogTitle>
            <DialogDescription>
              When to call / follow up. Stored against America/Chicago.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-2">
              <Label htmlFor="reminder-at">When</Label>
              <Input
                id="reminder-at"
                type="datetime-local"
                value={reminderAt}
                onChange={(event) => setReminderAt(event.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="reminder-note">Note</Label>
              <Input
                id="reminder-note"
                value={reminderNote}
                onChange={(event) => setReminderNote(event.target.value)}
                placeholder="call after 2"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={pending}
              onClick={clearReminder}
            >
              Clear
            </Button>
            <Button disabled={pending || reminderAt.length === 0} onClick={saveReminder}>
              Save reminder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
