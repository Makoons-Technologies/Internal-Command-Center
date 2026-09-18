import { BoardShell } from "@/components/board-shell";
import { SalesPipeline } from "@/components/sales-pipeline";
import { getPipelineLabels, getSeedStatus, listAllBusinesses } from "@/lib/db";

export default async function SalesPipelinePage() {
  const [businesses, seed, labels] = await Promise.all([
    listAllBusinesses(),
    getSeedStatus(),
    getPipelineLabels(),
  ]);

  return (
    <BoardShell title="Sales pipeline" seedOk={seed.ok} cardCount={seed.count}>
      <SalesPipeline businesses={businesses} labels={labels} />
    </BoardShell>
  );
}
