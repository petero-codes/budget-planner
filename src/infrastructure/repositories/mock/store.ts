import type {
  ApprovalHistoryEntry,
  ApprovalRouteStep,
  AuditLogEntry,
  BudgetAttachment,
  BudgetAttachmentCategory,
  BudgetLineage,
  BudgetPlan,
  CostCenterSubmissionStatus,
  FinanceQueueClaim,
  Notification,
  SapPackage,
  SupportIssue,
  WorkflowHistoryEntry,
} from "@/domain/entities";
import {
  costCenters,
  departments,
  fiscalYears,
  glAccounts,
  positions,
  users,
} from "./seed";

function clone<T>(value: T): T {
  return structuredClone(value);
}

export const mockStore = {
  users: clone(users),
  positions: clone(positions),
  departments: clone(departments),
  costCenters: clone(costCenters),
  fiscalYears: clone(fiscalYears),
  glAccounts: clone(glAccounts),
  budgets: [] as BudgetPlan[],
  lineages: [] as BudgetLineage[],
  workflowHistory: [] as WorkflowHistoryEntry[],
  financeClaims: [] as FinanceQueueClaim[],
  attachments: [] as (BudgetAttachment & { content: Buffer })[],
  attachmentCategories: [
    { id: "cat-business", code: "BusinessCase", name: "Business Case", isActive: true },
    { id: "cat-vendor", code: "VendorQuote", name: "Vendor Quote", isActive: true },
  ] as BudgetAttachmentCategory[],
  attachmentRequirements: new Map<string, string[]>(),
  sapPackages: [] as SapPackage[],
  routes: [] as ApprovalRouteStep[],
  history: [] as ApprovalHistoryEntry[],
  audits: [] as AuditLogEntry[],
  notifications: [] as Notification[],
  submissionStatuses: [] as CostCenterSubmissionStatus[],
  supportIssues: [] as SupportIssue[],
  supportIssueSequences: new Map<number, number>(),
  passwordHashes: new Map<string, string>(),
};

export function resetMockStore(): void {
  mockStore.users = clone(users);
  mockStore.positions = clone(positions);
  mockStore.departments = clone(departments);
  mockStore.costCenters = clone(costCenters);
  mockStore.fiscalYears = clone(fiscalYears);
  mockStore.glAccounts = clone(glAccounts);
  mockStore.budgets = [];
  mockStore.lineages = [];
  mockStore.workflowHistory = [];
  mockStore.financeClaims = [];
  mockStore.attachments = [];
  mockStore.attachmentRequirements = new Map();
  mockStore.sapPackages = [];
  mockStore.routes = [];
  mockStore.history = [];
  mockStore.audits = [];
  mockStore.notifications = [];
  mockStore.submissionStatuses = [];
  mockStore.supportIssues = [];
  mockStore.supportIssueSequences = new Map();
  mockStore.passwordHashes = new Map();
}

export { newId } from "@/infrastructure/id";
