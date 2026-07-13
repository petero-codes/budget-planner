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
}

export interface CostCenter {
  id: string;
  code: string;
  sapCostCenterCode: string | null;
  name: string;
  departmentId: string;
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
  isLocked: boolean;
}

export interface BudgetLineItem {
  id: string;
  glAccountId: string;
  amount: number;
  lineNumber: number;
}

export interface BudgetPlan {
  id: string;
  ownerId: string;
  costCenterId: string;
  fiscalYearId: string;
  budgetType: string;
  fromPeriod: string;
  toPeriod: string;
  status: import("../value-objects/budget-status").BudgetStatus;
  currentApproverId: string | null;
  submittedAt: string | null;
  sapVersion: string | null;
  lines: BudgetLineItem[];
  version: number;
  createdAt: string;
  updatedAt: string;
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

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  relatedPlanId: string | null;
  isRead: boolean;
  createdAt: string;
}
