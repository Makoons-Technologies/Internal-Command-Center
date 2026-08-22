import { seedCanonicalCards, seedChecklistIfEmpty } from "../lib/db";

async function main() {
  const cards = await seedCanonicalCards();
  const checklist = await seedChecklistIfEmpty();
  console.log(`Seeded ${cards.length} cards and ${checklist.length} checklist items.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
