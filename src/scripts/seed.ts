import {
  seedCanonicalBusinesses,
  seedCanonicalCards,
  seedChecklistIfEmpty,
} from "../lib/db";

async function main() {
  const cards = await seedCanonicalCards();
  const checklist = await seedChecklistIfEmpty();
  const businesses = await seedCanonicalBusinesses();
  console.log(
    `Seeded ${cards.length} cards, ${checklist.length} checklist items, and ${businesses.length} businesses.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
