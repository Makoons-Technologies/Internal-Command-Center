import { notFound } from "next/navigation";
import { BoardShell } from "@/components/board-shell";
import { CardList } from "@/components/command-card";
import { PromptTemplateTool } from "@/components/prompt-template-tool";
import { getSeedStatus, listAllCards, listPromptTemplates } from "@/lib/db";
import { isFunctionCard } from "@/lib/filters";
import { isFunctionOwner } from "@/lib/schema";

export default async function FunctionPage({
  params,
}: {
  params: Promise<{ owner: string }>;
}) {
  const { owner } = await params;
  if (!isFunctionOwner(owner)) notFound();

  const [allCards, seed, templates] = await Promise.all([
    listAllCards(),
    getSeedStatus(),
    owner === "marketing" ? listPromptTemplates() : Promise.resolve([]),
  ]);
  const cards = allCards.filter((card) => isFunctionCard(card, owner));

  const cardsList = (
    <CardList
      cards={cards}
      empty={
        owner === "coo"
          ? "COO cards stay empty until agents upsert here. Daily todos live on Home → COO checklist."
          : `No open ${owner} cards.`
      }
    />
  );

  return (
    <BoardShell title={owner} seedOk={seed.ok} cardCount={seed.count}>
      {owner === "marketing" ? (
        <div className="flex flex-col gap-8">
          <PromptTemplateTool templates={templates} />
          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-medium tracking-wide uppercase">
              Cards
            </h2>
            {cardsList}
          </section>
        </div>
      ) : (
        cardsList
      )}
    </BoardShell>
  );
}
