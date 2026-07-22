import "server-only";

import type {
  ApprovalHistoryEntry,
  ApprovalRouteStep,
  AuditLogEntry,
  BudgetLineItem,
  BudgetPlan,
  CostCenter,
  CostCenterSubmissionStatus,
  Department,
  FiscalYear,
  GlAccount,
  Notification,
  Position,
  SubmissionStatus,
  User,
} from "@/domain/entities";
import type { BudgetStatus } from "@/domain/value-objects/budget-status";
import type { ApprovalRouteStepStatus } from "@/domain/value-objects/budget-status";
import type { ApprovalAction } from "@/domain/value-objects/budget-status";

function str(v: unknown): string {
  if (v == null) return "";
  return String(v);
}

function strOrNull(v: unknown): string | null {
  if (v == null) return null;
  return String(v);
}

function isoDate(v: unknown): string {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = str(v);
  return s.length >= 10 ? s.slice(0, 10) : s;
}

function isoDateTime(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  return str(v);
}

export function mapDepartment(row: Record<string, unknown>): Department {
  return {
    id: str(row.DepartmentId),
    name: str(row.Name),
    code: str(row.Code),
    // Column may be absent on pre-migration DBs — treat as active.
    isActive: row.IsActive == null ? true : Boolean(row.IsActive),
  };
}

export function mapCostCenter(row: Record<string, unknown>): CostCenter {
  return {
    id: str(row.CostCenterId),
    code: str(row.Code),
    sapCostCenterCode: strOrNull(row.SapCostCenterCode),
    name: str(row.Name),
    departmentId: str(row.DepartmentId),
    managerId: strOrNull(row.ManagerId),
    responsiblePersonId: strOrNull(row.ResponsiblePersonId),
    isActive: Boolean(row.IsActive),
  };
}

export function mapSubmissionStatus(
  row: Record<string, unknown>
): CostCenterSubmissionStatus {
  return {
    costCenterId: str(row.CostCenterId),
    fiscalYearId: str(row.FiscalYearId),
    status: str(row.Status) as SubmissionStatus,
    updatedAt: isoDateTime(row.UpdatedAt),
  };
}

export function mapGlAccount(row: Record<string, unknown>): GlAccount {
  return {
    id: str(row.GlAccountId),
    code: str(row.Code),
    description: str(row.Description),
    isActive: Boolean(row.IsActive),
  };
}

export function mapFiscalYear(row: Record<string, unknown>): FiscalYear {
  const statusRaw = str(row.Status);
  const status: FiscalYear["status"] =
    statusRaw === "Closed" || statusRaw === "Archived"
      ? statusRaw
      : Boolean(row.IsLocked)
        ? "Closed"
        : "Open";
  return {
    id: str(row.FiscalYearId),
    yearLabel: Number(row.YearLabel),
    startDate: isoDate(row.StartDate),
    endDate: isoDate(row.EndDate),
    status,
    isLocked: status !== "Open",
    isCurrent: Boolean(row.IsCurrent),
  };
}

export function mapPosition(row: Record<string, unknown>): Position {
  return {
    id: str(row.PositionId),
    title: str(row.Title),
    positionCode: str(row.PositionCode),
    level: Number(row.Level),
  };
}

export function mapUser(
  row: Record<string, unknown>,
  roleCodes: string[],
  permissionCodes: string[]
): User {
  return {
    id: str(row.UserId),
    name: str(row.Name),
    email: str(row.Email),
    positionId: str(row.PositionId),
    managerId: strOrNull(row.ManagerId),
    departmentId: str(row.DepartmentId),
    primaryCostCenterId: str(row.PrimaryCostCenterId),
    active: Boolean(row.Active),
    roleCodes,
    permissionCodes,
  };
}

export function mapBudgetLine(row: Record<string, unknown>): BudgetLineItem {
  return {
    id: str(row.BudgetItemId),
    glAccountId: str(row.GlAccountId),
    amount: Number(row.Amount),
    lineNumber: Number(row.LineNumber),
  };
}

export function mapBudgetPlan(
  row: Record<string, unknown>,
  lines: BudgetLineItem[]
): BudgetPlan {
  return {
    id: str(row.BudgetPlanId),
    ownerId: str(row.OwnerId),
    costCenterId: str(row.CostCenterId),
    fiscalYearId: str(row.FiscalYearId),
    budgetCategory: str(row.BudgetType) as BudgetPlan["budgetCategory"],
    fromPeriod: isoDate(row.FromPeriod),
    toPeriod: isoDate(row.ToPeriod),
    description: strOrNull(row.Description),
    status: str(row.Status) as BudgetStatus,
    currentApproverId: strOrNull(row.CurrentApproverId),
    submittedAt: row.SubmittedAt ? isoDateTime(row.SubmittedAt) : null,
    sapVersion: strOrNull(row.SapVersion),
    lines,
    version: Number(row.Version ?? 1),
    createdAt: isoDateTime(row.CreatedAt),
    updatedAt: isoDateTime(row.UpdatedAt),
    lineageId: strOrNull(row.LineageId),
    parentBudgetPlanId: strOrNull(row.ParentBudgetPlanId),
    lineageRevision: Number(row.LineageRevision ?? 1),
    versionLabel: strOrNull(row.VersionLabel),
    amendmentReason: strOrNull(row.AmendmentReason),
    isArchived: Boolean(row.IsArchived),
    claimDueAt: row.ClaimDueAt ? isoDateTime(row.ClaimDueAt) : null,
    reviewDueAt: row.ReviewDueAt ? isoDateTime(row.ReviewDueAt) : null,
    escalationStatus: (str(row.EscalationStatus) || "None") as import("@/domain/value-objects/budget-status").EscalationStatus,
    financeClaimedAt: row.FinanceClaimedAt ? isoDateTime(row.FinanceClaimedAt) : null,
    financeClaimedBy: strOrNull(row.FinanceClaimedBy),
    isDemo: Boolean(row.IsDemo ?? false),
    createdByToolkit: Boolean(row.CreatedByToolkit ?? false),
    demoBatchId: strOrNull(row.DemoBatchId),
  };
}

export function mapRouteStep(row: Record<string, unknown>): ApprovalRouteStep {
  return {
    id: str(row.RouteId),
    budgetPlanId: str(row.BudgetPlanId),
    approverId: str(row.ApproverId),
    sequence: Number(row.Sequence),
    status: str(row.Status) as ApprovalRouteStepStatus,
  };
}

export function mapHistory(row: Record<string, unknown>): ApprovalHistoryEntry {
  return {
    id: str(row.ApprovalHistoryId),
    budgetPlanId: str(row.BudgetPlanId),
    performedBy: str(row.PerformedBy),
    action: str(row.Action) as ApprovalAction,
    previousStatus: str(row.PreviousStatus),
    newStatus: str(row.NewStatus),
    comment: strOrNull(row.Comment),
    timestamp: isoDateTime(row.Timestamp),
  };
}

export function mapAudit(row: Record<string, unknown>): AuditLogEntry {
  return {
    id: str(row.AuditLogId),
    entity: str(row.Entity),
    entityId: str(row.EntityId),
    action: str(row.Action),
    performedBy: str(row.PerformedBy),
    ipAddress: strOrNull(row.IpAddress),
    correlationId: str(row.CorrelationId),
    beforeJson: strOrNull(row.BeforeJson),
    afterJson: strOrNull(row.AfterJson),
    timestamp: isoDateTime(row.Timestamp),
  };
}

export function mapNotification(row: Record<string, unknown>): Notification {
  return {
    id: str(row.NotificationId),
    userId: str(row.UserId),
    type: str(row.Type),
    title: str(row.Title),
    message: str(row.Body),
    priority: str(row.Priority) as Notification["priority"],
    category: str(row.Category) as Notification["category"],
    actionLabel: str(row.ActionLabel),
    relatedPlanId: strOrNull(row.RelatedBudgetPlanId),
    entityType: (strOrNull(row.EntityType) as Notification["entityType"]) ?? null,
    entityId: strOrNull(row.EntityId),
    targetUrl: strOrNull(row.TargetUrl),
    isRead: Boolean(row.IsRead),
    readAt: row.ReadAt ? isoDateTime(row.ReadAt) : null,
    resolvedAt: row.ResolvedAt ? isoDateTime(row.ResolvedAt) : null,
    resolvedBy: strOrNull(row.ResolvedBy),
    expiresAt: row.ExpiresAt ? isoDateTime(row.ExpiresAt) : null,
    createdAt: isoDateTime(row.CreatedAt),
    isCleared: Boolean(row.IsCleared ?? false),
    clearedAt: row.ClearedAt ? isoDateTime(row.ClearedAt) : null,
    clearedReason: strOrNull(row.ClearedReason),
  };
}
