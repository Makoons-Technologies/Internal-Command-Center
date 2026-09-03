import { BoardShell } from "@/components/board-shell";
import { HqHome } from "@/components/hq-home";
import { chicagoTodayISO } from "@/lib/business";
import {
  getSeedStatus,
  listAllBusinesses,
  listAllCards,
  listChecklistItems,
} from "@/lib/db";
import { chicagoClock } from "@/lib/hq";

export default async function HomePage() {
  const now = new Date();
  const [cards, seed, checklist, businesses] = await Promise.all([
    listAllCards(),
    getSeedStatus(),
    listChecklistItems(),
    listAllBusinesses(),
  ]);
  const clock = chicagoClock(now);

  return (
    <BoardShell title="Home" hideTitle seedOk={seed.ok} cardCount={seed.count}>
      <HqHome
        greeting={clock.greeting}
        dateLabel={clock.dateLabel}
        today={chicagoTodayISO(now)}
        cards={cards}
        checklist={checklist}
        businesses={businesses}
      />
    </BoardShell>
  );
}
