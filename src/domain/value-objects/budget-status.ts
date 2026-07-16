/** Budget plan lifecycle status. */
export type BudgetStatus =
  | "Draft"
  | "InApproval"
  | "ReturnedForRevision"
  | "PendingFinanceReview"
  | "Claimed"
  | "Finalized"
  /** @deprecated Use Finalized — kept for migration reads */
  | "Approved"
  | "Rejected";

export type EscalationStatus = "None" | "Warning" | "Escalated";

export type AttachmentSource = "Uploaded" | "Inherited" | "Copied";

export type ApprovalRouteStepStatus =
  | "Pending"
  | "Approved"
  | "Rejected"
  | "Invalidated";

export type ApprovalAction =
  | "Submitted"
  | "SubmittedAndCompleted"
  | "Resubmitted"
  | "Approved"
  | "Returned"
  | "Rejected"
  | "FinanceClaimed"
  | "FinanceReleased"
  | "FinanceReturned"
  | "FinanceFinalized";

export type WorkflowStage =
  | "Draft"
  | "Submitted"
  | "ManagerReview"
  | "GMReview"
  | "FinanceQueue"
  | "FinanceClaimed"
  | "FinanceReturned"
  | "FinanceFinalized"
  | "Rejected";

export type PermissionCode =
  | "budget.create"
  | "budget.submit"
  | "budget.approve"
  | "budget.reject"
  | "report.view"
  | "report.export"
  | "audit.view"
  | "admin.users"
  | "admin.masterdata"
  | "fy.manage"
  | "finance.view"
  | "finance.claim"
  | "finance.finalize"
  | "finance.return";

export type RoleCode =
  | "BudgetSubmitter"
  | "BudgetApprover"
  | "GeneralManager"
  | "SystemAdmin"
  | "FinanceAdministrator"
  | "AuditViewer";

/** User-facing labels (API still uses BudgetStatus codes). */
export const BUDGET_STATUS_LABEL: Record<BudgetStatus, string> = {
  Draft: "Draft",
  InApproval: "In Review",
  ReturnedForRevision: "Returned",
  PendingFinanceReview: "Pending Finance",
  Claimed: "Finance Review",
  Finalized: "Finalized",
  Approved: "Approved",
  Rejected: "Rejected",
};

export const LOCKED_BUDGET_STATUSES = new Set<BudgetStatus>([
  "Claimed",
  "Finalized",
  "Approved",
]);

/** Statuses where only Draft/Returned may be edited. */
export const EDITABLE_BUDGET_STATUSES = new Set<BudgetStatus>([
  "Draft",
  "ReturnedForRevision",
]);

const FY_STATUS_LABEL: Record<string, string> = {
  Open: "Open",
  Closed: "Closed",
  Archived: "Archived",
  NotSubmitted: "Not Submitted",
};

export function statusLabel(status: string): string {
  return (
    BUDGET_STATUS_LABEL[status as BudgetStatus] ??
    FY_STATUS_LABEL[status] ??
    status
  );
}

/** Review stage label when a budget is in the approval chain. */
export function reviewStageLabel(
  status: BudgetStatus,
  currentApproverOrgRole?: "manager" | "gm" | null
): string {
  if (status === "PendingFinanceReview") return "Finance Queue";
  if (status === "Claimed") return "Finance Review";
  if (status === "Finalized") return "Finalized";
  if (status !== "InApproval") return statusLabel(status);
  if (currentApproverOrgRole === "gm") return "GM Review";
  if (currentApproverOrgRole === "manager") return "Manager Review";
  return statusLabel(status);
}
