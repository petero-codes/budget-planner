import { cn } from "@/lib/utils";

export function StatusChip({
  status,
}: {
  status: string;
}) {
  const styles: Record<string, string> = {
    Draft: "bg-neutral-100 text-neutral-700 border-neutral-400/40",
    InApproval: "bg-amber-50 text-kengen-amber border-kengen-amber/40",
    Approved: "bg-emerald-50 text-kengen-green border-kengen-green/40",
    Rejected: "bg-red-50 text-kengen-red border-kengen-red/40",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded border px-1.5 py-0.5 text-meta font-medium",
        styles[status] ?? styles.Draft
      )}
    >
      {status}
    </span>
  );
}
