import { BoardShell } from "@/components/board-shell";
import { RecurringBoard } from "@/components/recurring-board";
import { getSeedStatus, listCards } from "@/lib/db";
import { isRecurringCard } from "@/lib/recurring";

export default async function RecurringPage() {
  const [cards, seed] = await Promise.all([
    listCards({ includeDone: true }),
    getSeedStatus(),
  ]);
  const recurring = cards.filter(isRecurringCard);

  return (
    <BoardShell title="Recurring" seedOk={seed.ok} cardCount={seed.count}>
      <RecurringBoard cards={recurring} />
    </BoardShell>
  );
}
