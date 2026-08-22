import { BoardShell } from "@/components/board-shell";
import { CardList } from "@/components/command-card";
import { CooChecklist } from "@/components/coo-checklist";
import { Badge } from "@/components/ui/badge";
import { getSeedStatus, listAllCards, listChecklistItems } from "@/lib/db";
import { todayISO } from "@/lib/dates";
import { getBlockedCards, getNeedsJosephCards } from "@/lib/filters";

export default async function HomePage() {
  const [cards, seed, checklist] = await Promise.all([
    listAllCards(),
    getSeedStatus(),
    listChecklistItems(),
  ]);
  const needsJoseph = getNeedsJosephCards(cards);
  const blockers = getBlockedCards(cards);

  return (
    <BoardShell title="HOME" seedOk={seed.ok} cardCount={seed.count}>
      <div className="flex flex-col gap-6">
        <div className="grid gap-6 xl:grid-cols-2">
          <CooChecklist items={checklist} today={todayISO()} />

          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium tracking-wide uppercase">
                Needs Joseph
              </h2>
              <Badge variant="secondary">{needsJoseph.length}</Badge>
            </div>
            <CardList
              cards={needsJoseph}
              empty="Nothing needs Joseph right now."
            />
          </section>
        </div>

        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium tracking-wide uppercase">Blockers</h2>
          {blockers.length === 0 ? (
            <p className="rounded-lg border border-dashed px-3 py-4 text-sm text-muted-foreground">
              No blockers.
            </p>
          ) : (
            <div className="flex flex-col gap-2 rounded-lg border px-3 py-3">
              {blockers.map((card) => (
                <div key={card.id} className="flex flex-col gap-0.5 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="destructive">{card.status}</Badge>
                    <span className="font-medium">{card.title}</span>
                    <span className="text-muted-foreground">{card.owner}</span>
                  </div>
                  <p className="text-muted-foreground">{card.nextStep}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </BoardShell>
  );
}
