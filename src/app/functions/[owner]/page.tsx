import { notFound } from "next/navigation";
import { BoardShell } from "@/components/board-shell";
import { CardList } from "@/components/command-card";
import { getSeedStatus, listAllCards } from "@/lib/db";
import { isFunctionCard } from "@/lib/filters";
import { isFunctionOwner } from "@/lib/schema";

export default async function FunctionPage({
  params,
}: {
  params: Promise<{ owner: string }>;
}) {
  const { owner } = await params;
  if (!isFunctionOwner(owner)) notFound();

  const [allCards, seed] = await Promise.all([listAllCards(), getSeedStatus()]);
  const cards = allCards.filter((card) => isFunctionCard(card, owner));

  return (
    <BoardShell title={owner} seedOk={seed.ok} cardCount={seed.count}>
      <CardList
        cards={cards}
        empty={
          owner === "coo"
            ? "COO cards stay empty until agents upsert here. Daily todos live on Home → COO checklist."
            : `No open ${owner} cards.`
        }
      />
    </BoardShell>
  );
}
