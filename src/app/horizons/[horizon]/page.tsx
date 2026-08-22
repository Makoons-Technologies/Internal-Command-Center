import { notFound } from "next/navigation";
import { BoardShell } from "@/components/board-shell";
import { CardList } from "@/components/command-card";
import { getSeedStatus, listAllCards } from "@/lib/db";
import { isHorizonCard } from "@/lib/filters";
import { isHorizon } from "@/lib/schema";

const TITLES = {
  today: "Today",
  week: "Week",
  month: "Month",
} as const;

export default async function HorizonPage({
  params,
}: {
  params: Promise<{ horizon: string }>;
}) {
  const { horizon } = await params;
  if (!isHorizon(horizon)) notFound();

  const [allCards, seed] = await Promise.all([listAllCards(), getSeedStatus()]);
  const cards = allCards.filter((card) => isHorizonCard(card, horizon));

  return (
    <BoardShell title={TITLES[horizon]} seedOk={seed.ok} cardCount={seed.count}>
      <CardList
        cards={cards}
        empty={`No ${horizon} cards. Empty until agents upsert or a due date lands in this horizon.`}
      />
    </BoardShell>
  );
}
