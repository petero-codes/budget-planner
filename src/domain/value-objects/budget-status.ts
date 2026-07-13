/** Budget plan status — progress within InApproval uses ApprovalRoute + currentApproverId. */
export type BudgetStatus = "Draft" | "InApproval" | "Approved" | "Rejected";

export type ApprovalRouteStepStatus =
  | "Pending"
  | "Approved"
  | "Rejected"
  | "Invalidated";

export type ApprovalAction =
  | "Submitted"
  | "SubmittedAndCompleted"
  | "Approved"
  | "Rejected"
  | "Returned";

export type PermissionCode =
  | "budget.create"
  | "budget.submit"
  | "budget.approve"
  | "budget.reject"
  | "report.view"
  | "audit.view"
  | "admin.users";

export type RoleCode = "BudgetSubmitter" | "BudgetApprover" | "SystemAdmin";
