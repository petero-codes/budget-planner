import type {
  ApprovalHistoryEntry,
  ApprovalRouteStep,
  AuditLogEntry,
  BudgetPlan,
  Notification,
} from "@/domain/entities";
import {
  costCenters,
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
  costCenters: clone(costCenters),
  fiscalYears: clone(fiscalYears),
  glAccounts: clone(glAccounts),
  budgets: [] as BudgetPlan[],
  routes: [] as ApprovalRouteStep[],
  history: [] as ApprovalHistoryEntry[],
  audits: [] as AuditLogEntry[],
  notifications: [] as Notification[],
  currentUserId: users.find((u) => u.name === "Patrick Njoroge")!.id,
};

export function resetMockStore(): void {
  mockStore.users = clone(users);
  mockStore.positions = clone(positions);
  mockStore.costCenters = clone(costCenters);
  mockStore.fiscalYears = clone(fiscalYears);
  mockStore.glAccounts = clone(glAccounts);
  mockStore.budgets = [];
  mockStore.routes = [];
  mockStore.history = [];
  mockStore.audits = [];
  mockStore.notifications = [];
  mockStore.currentUserId = users.find((u) => u.name === "Patrick Njoroge")!.id;
}

export function newId(prefix: string): string {
  const uuid =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${uuid}`;
}
