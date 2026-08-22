"use client";

import { useState, useTransition } from "react";
import { completeCardAction, flagBlockerAction } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { CommandCard } from "@/lib/schema";

export function CardActions({ card }: { card: CommandCard }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();

  if (card.status === "done") {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() => {
          startTransition(async () => {
            await completeCardAction(card.id);
          });
        }}
      >
        Complete
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button size="sm" variant="destructive" disabled={pending}>
            Flag blocker
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Flag blocker</DialogTitle>
            <DialogDescription>
              Sets status to blocked and surfaces this card on Needs Joseph.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor={`blocker-${card.id}`}>What unblocks this?</Label>
            <Textarea
              id={`blocker-${card.id}`}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Restore BEA credentials / Stripe login / Joseph yes…"
            />
          </div>
          <DialogFooter>
            <Button
              disabled={pending || reason.trim().length === 0}
              onClick={() => {
                startTransition(async () => {
                  await flagBlockerAction(card.id, reason.trim());
                  setReason("");
                  setOpen(false);
                });
              }}
            >
              Flag blocker
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
