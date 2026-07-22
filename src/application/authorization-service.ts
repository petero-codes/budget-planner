import "server-only";

import type { PermissionCode } from "@/domain/value-objects/budget-status";
import type { BudgetPlan, CostCenter, User } from "@/domain/entities";
import type {
  IAuditLogRepository,
  ICostCenterRepository,
  IUserRepository,
} from "@/infrastructure/repositories/interfaces";
import { newId } from "@/infrastructure/id";
import { resolveOrgRole as resolveOrgRoleFromUser, type OrgRole } from "@/domain/rules/org-role";

export type { OrgRole };
export { resolveOrgRoleFromUser as resolveOrgRole };

/**
 * AuthorizationService
 *
 * Responsibility
 * --------------
 * Server-side permission checks and org-role resolution used by every mutating
 * application service. UI checks are never trusted.
 *
 * Does NOT:
 * - change budget status or write workflow history
 * - own session cookies (infrastructure/session)
 *
 * Business Rules: BR-38+
 * Workflows: cross-cutting (called by WF-001…018 mutators)
 * Dependencies: users, costCenters, audits repositories
 */
export class AuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthorizationError";
  }
}

export type VisibilityScope =
  | { kind: "none" }
  | { kind: "own" }
  | { kind: "costCenters"; ids: string[] }
  | { kind: "all" };

export class AuthorizationService {
  constructor(
    private readonly users: IUserRepository,
    private readonly costCenters: ICostCenterRepository,
    private readonly audits?: IAuditLogRepository
  ) {}

  private async recordDeniedAttempt(
    actor: User,
    action: string,
    reason: string,
    details?: Record<string, unknown>
  ): Promise<void> {
    if (!this.audits) return;
    await this.audits.append({
      id: newId("audit"),
      entity: "Authorization",
      entityId: actor.id,
      action,
      performedBy: actor.id,
      ipAddress: null,
      correlationId: newId("corr"),
      beforeJson: null,
      afterJson: JSON.stringify({
        reason,
        ...details,
      }),
      timestamp: new Date().toISOString(),
    });
  }

  hasPermission(user: User, permission: PermissionCode): boolean {
    return user.permissionCodes.includes(permission);
  }

  assertPermission(user: User, permission: PermissionCode): void {
    if (!this.hasPermission(user, permission)) {
      void this.recordDeniedAttempt(
        user,
        "AuthorizationDenied",
        `Missing permission: ${permission}`,
        { permission }
      );
      throw new AuthorizationError(`Missing permission: ${permission}`);
    }
  }

  resolveOrgRole(user: User): OrgRole {
    return resolveOrgRoleFromUser(user);
  }

  canExport(user: User): boolean {
    return this.hasPermission(user, "report.export");
  }

  /** Managers and GM may return budgets when they are the current approver. */
  canReturnBudget(user: User): boolean {
    const role = this.resolveOrgRole(user);
    return (
      (role === "manager" || role === "gm") &&
      this.hasPermission(user, "budget.approve")
    );
  }

  /** Only the GM may permanently reject a budget. */
  canRejectBudget(user: User): boolean {
    return (
      this.resolveOrgRole(user) === "gm" &&
      this.hasPermission(user, "budget.reject")
    );
  }

  async managedCostCenterIds(user: User): Promise<string[]> {
    const all = await this.costCenters.getAll();
    return all.filter((c) => c.managerId === user.id).map((c) => c.id);
  }

  async getVisibilityScope(user: User): Promise<VisibilityScope> {
    const role = this.resolveOrgRole(user);
    if (role === "systemAdmin") return { kind: "none" };
    if (role === "finance" || role === "gm") return { kind: "all" };
    if (role === "manager") {
      const ids = await this.managedCostCenterIds(user);
      return { kind: "costCenters", ids };
    }
    return { kind: "own" };
  }

  async canViewBudget(user: User, plan: BudgetPlan): Promise<boolean> {
    if (this.hasPermission(user, "finance.view")) return true;
    if (plan.ownerId === user.id) return true;

    const role = this.resolveOrgRole(user);
    if (role === "systemAdmin") return false;
    if (role === "gm") return true;
    if (role === "manager") {
      const ids = await this.managedCostCenterIds(user);
      return ids.includes(plan.costCenterId);
    }
    return false;
  }

  async assertCanView(user: User, plan: BudgetPlan): Promise<void> {
    if (!(await this.canViewBudget(user, plan))) {
      await this.recordDeniedAttempt(
        user,
        "BudgetViewDenied",
        "You do not have access to this cost center or budget",
        {
          budgetPlanId: plan.id,
          costCenterId: plan.costCenterId,
          ownerId: plan.ownerId,
        }
      );
      throw new AuthorizationError(
        "You do not have access to this cost center or budget"
      );
    }
  }

  async filterVisiblePlans(
    user: User,
    plans: BudgetPlan[]
  ): Promise<BudgetPlan[]> {
    const scope = await this.getVisibilityScope(user);
    switch (scope.kind) {
      case "none":
        return [];
      case "own":
        return plans.filter((p) => p.ownerId === user.id);
      case "costCenters": {
        const set = new Set(scope.ids);
        return plans.filter(
          (p) => set.has(p.costCenterId) || p.ownerId === user.id
        );
      }
      case "all":
        return plans;
    }
  }

  async listManagedCostCenters(user: User): Promise<CostCenter[]> {
    const all = await this.costCenters.getAll();
    return all.filter((c) => c.managerId === user.id && c.isActive);
  }
}
