import { ExternalLink } from "lucide-react";
import { CardActions } from "@/components/card-actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CardStatus, CommandCard } from "@/lib/schema";

const STATUS_VARIANT: Record<
  CardStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  blocked: "destructive",
  ready: "default",
  open: "secondary",
  done: "outline",
};

export function CommandCardView({ card }: { card: CommandCard }) {
  return (
    <Card size="sm" className="ring-foreground/8">
      <CardHeader className="gap-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <CardTitle className="text-sm">{card.title}</CardTitle>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="outline">{card.owner}</Badge>
            <Badge variant="outline">{card.cadence}</Badge>
            <Badge variant={STATUS_VARIANT[card.status]}>{card.status}</Badge>
            {card.needsJoseph ? <Badge variant="joseph">needs Joseph</Badge> : null}
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-foreground/90">{card.nextStep}</p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
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
          {card.sourceAgent ? <span>via {card.sourceAgent}</span> : null}
        </div>
        <CardActions card={card} />
      </CardContent>
    </Card>
  );
}

export function CardList({
  cards,
  empty,
}: {
  cards: CommandCard[];
  empty: string;
}) {
  if (cards.length === 0) {
    return (
      <p className="rounded-lg border border-dashed px-3 py-6 text-sm text-muted-foreground">
        {empty}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {cards.map((card) => (
        <CommandCardView key={card.id} card={card} />
      ))}
    </div>
  );
}
