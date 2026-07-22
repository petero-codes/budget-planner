/**
 * Domain entities (aggregates / records)
 *
 * Responsibility
 * --------------
 * Canonical TypeScript shapes for Users, BudgetPlans, Notifications, claims,
 * fiscal years, and related records. Pure data + small helpers (e.g. isActionableNotification).
 *
 * Does NOT:
 * - persist anything or enforce RBAC (application + repositories do)
 *
 * Business Rules: shapes underpin BR-01…37
 * Related: docs/DOMAIN_GLOSSARY.md, docs/domain-model.md
 */

import type { BudgetCategoryCode } from "../constants/budget-types";

export interface User {
  id: string;
  name: string;
  email: string;
  positionId: string;
  managerId: string | null;
  departmentId: string;
  primaryCostCenterId: string;
  active: boolean;
  roleCodes: string[];
  permissionCodes: string[];
}

export interface Position {
  id: string;
  title: string;
  positionCode: string;
  level: number;
}

export interface Department {
  id: string;
  name: string;
  code: string;
  /** Archived departments are read-only and hidden from pickers. */
  isActive: boolean;
}

export interface CostCenter {
  id: string;
  code: string;
  sapCostCenterCode: string | null;
  name: string;
  departmentId: string;
  /**
   * Supervising manager for this cost center — the approver.
   * (null = GM / unassigned.)
   */
  managerId: string | null;
  /**
   * Primary Responsible Person (Budget Holder) — the submitter who owns
   * this cost center's budget. Distinct from the approving manager.
   */
  responsiblePersonId: string | null;
  isActive: boolean;
}

export interface GlAccount {
  id: string;
  code: string;
  description: string;
  isActive: boolean;
}

export interface FiscalYear {
  id: string;
  yearLabel: number;
  startDate: string;
  endDate: string;
  /** Open | Closed | Archived — Closed/Archived are locked for edits. */
  status: "Open" | "Closed" | "Archived";
  /** Derived: true when status is not Open (kept for legacy callers). */
  isLocked: boolean;
  /**
   * The single financial year the organisation is actively budgeting for.
   * Exactly one year carries this flag; it drives dashboards and default
   * pickers. Independent of `status` (though the current year is normally Open).
   */
  isCurrent: boolean;
}

/** Stored submission progress per (CostCenter, FiscalYear). */
export type SubmissionStatus =
  | "NotStarted"
  | "InProgress"
  | "Submitted"
  | "Returned"
  | "Approved"
  | "Rejected";

export interface CostCenterSubmissionStatus {
  costCenterId: string;
  fiscalYearId: string;
  status: SubmissionStatus;
  updatedAt: string;
}

export interface BudgetLineItem {
  id: string;
  glAccountId: string;
  amount: number;
  lineNumber: number;
}

export interface BudgetLineage {
  id: string;
  costCenterId: string;
  fiscalYearId: string;
  originalBudgetCategory: BudgetCategoryCode;
  budgetNumber: string;
  currentVersionId: string | null;
  latestFinalizedVersionId: string | null;
  isArchived: boolean;
  createdAt: string;
}

export interface WorkflowHistoryEntry {
  id: string;
  budgetVersionId: string;
  stage: import("../value-objects/budget-status").WorkflowStage;
  actorId: string;
  action: string;
  comment: string | null;
  timestamp: string;
}

export interface BudgetAttachment {
  id: string;
  budgetPlanId: string;
  categoryId: string;
  fileName: string;
  contentType: string;
  fileSizeBytes: number;
  sha256: string;
  source: import("../value-objects/budget-status").AttachmentSource;
  inheritedFromAttachmentId: string | null;
  uploadedBy: string;
  uploadedAt: string;
  isArchived: boolean;
}

export interface BudgetAttachmentCategory {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
}

export interface SapPackage {
  id: string;
  budgetPlanId: string;
  sapReference: string;
  packageJson: string;
  csvContent: string;
  generatedAt: string;
  generatedBy: string;
}

export interface FinanceQueueClaim {
  id: string;
  budgetPlanId: string;
  claimedBy: string;
  claimedAt: string;
  releasedAt: string | null;
  isActive: boolean;
}

export interface BudgetPlan {
  id: string;
  ownerId: string;
  costCenterId: string;
  fiscalYearId: string;
  budgetCategory: BudgetCategoryCode;
  fromPeriod: string;
  toPeriod: string;
  /** Free-text notes / justification for this budget. */
  description: string | null;
  status: import("../value-objects/budget-status").BudgetStatus;
  currentApproverId: string | null;
  submittedAt: string | null;
  sapVersion: string | null;
  lines: BudgetLineItem[];
  /** Optimistic concurrency token — not the business revision. */
  version: number;
  createdAt: string;
  updatedAt: string;
  /** Lineage / versioning */
  lineageId: string | null;
  parentBudgetPlanId: string | null;
  lineageRevision: number;
  versionLabel: string | null;
  amendmentReason: string | null;
  isArchived: boolean;
  /** Finance SLA */
  claimDueAt: string | null;
  reviewDueAt: string | null;
  escalationStatus: import("../value-objects/budget-status").EscalationStatus;
  financeClaimedAt: string | null;
  financeClaimedBy: string | null;
  /** Development Toolkit demo marker — defaults false when omitted. */
  isDemo?: boolean;
  createdByToolkit?: boolean;
  demoBatchId?: string | null;
}

export interface ApprovalRouteStep {
  id: string;
  budgetPlanId: string;
  approverId: string;
  sequence: number;
  status: import("../value-objects/budget-status").ApprovalRouteStepStatus;
}

export interface ApprovalHistoryEntry {
  id: string;
  budgetPlanId: string;
  performedBy: string;
  action: import("../value-objects/budget-status").ApprovalAction;
  previousStatus: string;
  newStatus: string;
  comment: string | null;
  timestamp: string;
}

export interface AuditLogEntry {
  id: string;
  entity: string;
  entityId: string;
  action: string;
  performedBy: string;
  ipAddress: string | null;
  correlationId: string;
  beforeJson: string | null;
  afterJson: string | null;
  timestamp: string;
}

/** Business object a notification points at, used for navigation + resolution. */
export type NotificationEntityType =
  | "Budget"
  | "User"
  | "FiscalYear"
  | "Issue";

export type NotificationPriority = "Low" | "Medium" | "High" | "Critical";

export type NotificationCategory =
  | "Approval"
  | "Finance"
  | "Budget"
  | "Support"
  | "Administration"
  | "FiscalYear"
  | "Outcome";

/**
 * Actionable notifications represent outstanding work owned by the recipient.
 * They stay active until the workflow completes for that recipient and are
 * auto-resolved by the services — a user can never manually clear them, which
 * prevents hiding real to-do items. Every other type is informational (an
 * FYI/outcome) and is acknowledged — and thereby resolved — when the recipient
 * reads it.
 */
export const ACTIONABLE_NOTIFICATION_TYPES = [
  "Approval",
  "FinanceQueue",
  "FinanceClaim",
  "FinanceEscalation",
  "SupportIssue",
  "FiscalYear",
] as const;

export function isActionableNotification(type: string): boolean {
  return (ACTIONABLE_NOTIFICATION_TYPES as readonly string[]).includes(type);
}

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  priority: NotificationPriority;
  category: NotificationCategory;
  actionLabel: string;
  relatedPlanId: string | null;
  /** Business entity this notification represents (drives navigation + auto-resolution). */
  entityType?: NotificationEntityType | null;
  entityId?: string | null;
  /** In-app route the notification navigates to when clicked. */
  targetUrl?: string | null;
  isRead: boolean;
  /** When the recipient opened/read it. Read is NOT the same as resolved. */
  readAt?: string | null;
  /**
   * When the underlying work reached a terminal state for this recipient
   * (approved, finalized, returned, resolved…). Resolved notifications drop
   * out of the active list and the badge count, but remain for history.
   */
  resolvedAt?: string | null;
  /** User whose workflow action completed this task; null for system resolution. */
  resolvedBy?: string | null;
  /** Optional deadline after which the task may be treated as stale/escalated. */
  expiresAt?: string | null;
  createdAt: string;
  /** Soft-cleared — retained for history. Defaults false when omitted on create. */
  isCleared?: boolean;
  clearedAt?: string | null;
  clearedReason?: string | null;
}

export type SupportIssueCategory =
  | "General"
  | "Bug"
  | "Budget"
  | "Approval"
  | "Finance"
  | "Performance"
  | "Security"
  | "Other";

export type SupportIssuePriority = "Low" | "Medium" | "High";

export type SupportIssueStatus =
  | "Open"
  | "Assigned"
  | "InProgress"
  | "Resolved"
  | "Closed";

export interface SupportIssue {
  id: string;
  referenceNumber: string;
  title: string;
  description: string;
  category: SupportIssueCategory;
  priority: SupportIssuePriority;
  status: SupportIssueStatus;
  reportedBy: string;
  assignedTo: string | null;
  pagePath: string | null;
  pageLabel: string | null;
  budgetPlanId: string | null;
  fiscalYearId: string | null;
  costCenterId: string | null;
  browser: string | null;
  appVersion: string | null;
  correlationId: string | null;
  adminNotes: string | null;
  screenshotFileName: string | null;
  screenshotContentType: string | null;
  /** Present only when explicitly loaded for download; omitted from list DTOs. */
  hasScreenshot: boolean;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
}
