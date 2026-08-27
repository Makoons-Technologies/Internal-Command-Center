import { BusinessBoard } from "@/components/business-board";
import { BoardShell } from "@/components/board-shell";
import { getSeedStatus, listAllBusinesses } from "@/lib/db";

export default async function BusinessesPage() {
  const [businesses, seed] = await Promise.all([
    listAllBusinesses(),
    getSeedStatus(),
  ]);

  return (
    <BoardShell title="Businesses" seedOk={seed.ok} cardCount={seed.count}>
      <BusinessBoard businesses={businesses} />
    </BoardShell>
  );
}
