import type { BusinessStatus, SalesBusiness } from "@/lib/business";

export const PIPELINE_STAGES = [
  "lead",
  "qualified",
  "contact-made",
  "proposal",
  "won",
  "hold",
  "skipped",
  "lost",
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export const DEFAULT_PIPELINE_LABELS: Record<PipelineStage, string> = {
  lead: "Lead",
  qualified: "Qualified",
  "contact-made": "Contact Made",
  proposal: "Proposal",
  won: "Won",
  hold: "Hold",
  skipped: "Skipped",
  lost: "Lost",
};

export const PIPELINE_LABELS_KEY = "sales.pipeline.labels";

export function isPipelineStage(value: unknown): value is PipelineStage {
  return PIPELINE_STAGES.includes(value as PipelineStage);
}

export function stageFromStatus(status: BusinessStatus): PipelineStage {
  switch (status) {
    case "contacted":
      return "contact-made";
    case "greenlit":
      return "won";
    case "hold":
      return "hold";
    case "skipped":
      return "skipped";
    case "target":
    default:
      return "lead";
  }
}

export function statusFromStage(stage: PipelineStage): BusinessStatus {
  switch (stage) {
    case "contact-made":
    case "proposal":
      return "contacted";
    case "won":
      return "greenlit";
    case "hold":
      return "hold";
    case "skipped":
    case "lost":
      return "skipped";
    case "lead":
    case "qualified":
    default:
      return "target";
  }
}

export function resolvePipelineStage(
  business: Pick<SalesBusiness, "status" | "pipelineStage">,
): PipelineStage {
  return business.pipelineStage ?? stageFromStatus(business.status);
}

export function mergePipelineLabels(
  value: unknown,
): Record<PipelineStage, string> {
  const raw =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  const next = { ...DEFAULT_PIPELINE_LABELS };
  for (const stage of PIPELINE_STAGES) {
    const label = raw[stage];
    if (typeof label === "string" && label.trim()) {
      next[stage] = label.trim();
    }
  }
  return next;
}

export function parseDealValue(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const amount = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error("Deal value must be an empty or non-negative USD number");
  }
  return amount;
}

export function formatDealValue(value: number | undefined): string {
  if (value === undefined) return "";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value);
}

export function sumDealValues(deals: Pick<SalesBusiness, "dealValue">[]): {
  count: number;
  total: number;
  hasValues: boolean;
} {
  let total = 0;
  let hasValues = false;
  for (const deal of deals) {
    if (deal.dealValue !== undefined) {
      total += deal.dealValue;
      hasValues = true;
    }
  }
  return { count: deals.length, total, hasValues };
}

export function groupDealsByStage(
  deals: SalesBusiness[],
): Record<PipelineStage, SalesBusiness[]> {
  const grouped = Object.fromEntries(
    PIPELINE_STAGES.map((stage) => [stage, [] as SalesBusiness[]]),
  ) as Record<PipelineStage, SalesBusiness[]>;

  for (const deal of deals) {
    grouped[resolvePipelineStage(deal)].push(deal);
  }
  return grouped;
}
