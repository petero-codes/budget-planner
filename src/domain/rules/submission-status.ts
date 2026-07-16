import type { SubmissionStatus } from "@/domain/entities";
import type { BudgetStatus } from "@/domain/value-objects/budget-status";

/**
 * Map a budget plan's lifecycle status onto the stored cost-center
 * submission status. A cost center with no budget for the year is
 * `NotStarted`; otherwise it reflects the latest budget's stage.
 */
export function submissionStatusForBudget(
  status: BudgetStatus
): SubmissionStatus {
  switch (status) {
    case "Draft":
      return "InProgress";
    case "InApproval":
      return "Submitted";
    case "ReturnedForRevision":
      return "Returned";
    case "PendingFinanceReview":
    case "Claimed":
      return "Submitted";
    case "Finalized":
    case "Approved":
      return "Approved";
    case "Rejected":
      return "Rejected";
  }
}

export const SUBMISSION_STATUS_LABEL: Record<SubmissionStatus, string> = {
  NotStarted: "Not Started",
  InProgress: "In Progress",
  Submitted: "Submitted",
  Returned: "Returned",
  Approved: "Approved",
  Rejected: "Rejected",
};
