import { cn } from "@/lib/utils";
import { statusLabel } from "@/domain/value-objects/budget-status";

export function StatusChip({ status }: { status: string }) {
  // Spec colors: green=approved, blue=submitted, orange=returned, red=rejected, grey=not submitted
  const styles: Record<string, string> = {
    Draft: "bg-neutral-100 text-neutral-700 border-neutral-400/40",
    NotSubmitted: "bg-neutral-100 text-neutral-700 border-neutral-400/40",
    InApproval: "bg-blue-50 text-kengen-blue border-kengen-blue/40",
    ReturnedForRevision: "bg-amber-50 text-kengen-amber border-kengen-amber/40",
    PendingFinanceReview: "bg-violet-50 text-violet-800 border-violet-400/40",
    Claimed: "bg-indigo-50 text-indigo-800 border-indigo-400/40",
    Finalized: "bg-emerald-50 text-kengen-green border-kengen-green/40",
    Approved: "bg-emerald-50 text-kengen-green border-kengen-green/40",
    Rejected: "bg-red-50 text-kengen-red border-kengen-red/40",
    Open: "bg-emerald-50 text-kengen-green border-kengen-green/40",
    Closed: "bg-amber-50 text-kengen-amber border-kengen-amber/40",
    Archived: "bg-neutral-100 text-neutral-700 border-neutral-400/40",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded border px-1.5 py-0.5 text-meta font-medium",
        styles[status] ?? styles.Draft
      )}
    >
      {statusLabel(status)}
    </span>
  );
}
