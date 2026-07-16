import type { ApprovalHistoryEntry } from "@/domain/entities";
import { statusLabel } from "@/domain/value-objects/budget-status";

const ACTION_TITLE: Record<string, string> = {
  Submitted: "Submitted",
  SubmittedAndCompleted: "Submitted and auto-approved",
  Resubmitted: "Resubmitted",
  Approved: "Approved",
  Returned: "Returned for Revision",
  Rejected: "Rejected",
};

export function ApprovalTimeline({
  history,
  names,
  currentStatus,
}: {
  history: ApprovalHistoryEntry[];
  names: Record<string, string>;
  currentStatus: string;
}) {
  if (history.length === 0) {
    return (
      <p className="text-meta text-neutral-700">No approval history yet.</p>
    );
  }

  return (
    <div className="space-y-0">
      {history.map((entry, index) => {
        const who = names[entry.performedBy] ?? entry.performedBy;
        const title = ACTION_TITLE[entry.action] ?? entry.action;
        const isLast = index === history.length - 1;
        return (
          <div key={entry.id} className="relative flex gap-3 pb-4 last:pb-0">
            {!isLast ? (
              <span
                className="absolute left-[0.4rem] top-3 h-[calc(100%-0.5rem)] w-px bg-neutral-400/40"
                aria-hidden
              />
            ) : null}
            <span
              className="relative z-[1] mt-1 h-2 w-2 shrink-0 rounded-full bg-kengen-navy"
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <p className="text-body font-medium text-kengen-navy">{title}</p>
              <p className="text-meta text-neutral-700">
                {who} · {new Date(entry.timestamp).toLocaleString()}
              </p>
              <p className="text-meta text-neutral-400">
                {statusLabel(entry.previousStatus)} →{" "}
                {statusLabel(entry.newStatus)}
              </p>
              {entry.comment ? (
                <p className="mt-1 rounded border border-neutral-400/30 bg-neutral-100/80 px-2 py-1.5 text-meta text-neutral-700">
                  <span className="font-medium text-kengen-navy">Reason: </span>
                  {entry.comment}
                </p>
              ) : null}
            </div>
          </div>
        );
      })}
      <div className="mt-2 border-t border-neutral-400/20 pt-2 text-body">
        <span className="text-meta text-neutral-700">Current status: </span>
        <span className="font-medium text-kengen-navy">
          {statusLabel(currentStatus)}
        </span>
      </div>
    </div>
  );
}
