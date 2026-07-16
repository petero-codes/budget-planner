import type { ApprovalHistoryEntry } from "@/domain/entities";

export type ApprovalOutcome = {
  action: "Returned" | "Rejected";
  reason: string;
  performedBy: string;
  timestamp: string;
};

/** Latest return or rejection on a budget (most recent wins). */
export function latestApprovalOutcome(
  history: ApprovalHistoryEntry[]
): ApprovalOutcome | null {
  let latest: ApprovalOutcome | null = null;
  for (const entry of history) {
    if (entry.action !== "Returned" && entry.action !== "Rejected") continue;
    if (
      !latest ||
      entry.timestamp.localeCompare(latest.timestamp) > 0
    ) {
      latest = {
        action: entry.action,
        reason: entry.comment ?? "",
        performedBy: entry.performedBy,
        timestamp: entry.timestamp,
      };
    }
  }
  return latest;
}
