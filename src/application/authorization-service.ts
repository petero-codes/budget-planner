import type { PermissionCode } from "@/domain/value-objects/budget-status";
import type { BudgetPlan, User } from "@/domain/entities";
import type { IUserRepository } from "@/infrastructure/repositories/interfaces";

export class AuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthorizationError";
  }
}

export class AuthorizationService {
  constructor(private readonly users: IUserRepository) {}

  hasPermission(user: User, permission: PermissionCode): boolean {
    return user.permissionCodes.includes(permission);
  }

  assertPermission(user: User, permission: PermissionCode): void {
    if (!this.hasPermission(user, permission)) {
      throw new AuthorizationError(`Missing permission: ${permission}`);
    }
  }

  /** Visibility: own + descendants; root (managerId null) sees all in department. */
  async canViewBudget(user: User, plan: BudgetPlan): Promise<boolean> {
    if (plan.ownerId === user.id) return true;
    if (user.managerId === null) return true;
    const descendants = await this.users.getDescendantIds(user.id);
    return descendants.includes(plan.ownerId);
  }

  async assertCanView(user: User, plan: BudgetPlan): Promise<void> {
    if (!(await this.canViewBudget(user, plan))) {
      throw new AuthorizationError(
        "You do not have access to this cost center or budget"
      );
    }
  }

  async visibleOwnerIds(user: User): Promise<string[] | "all"> {
    if (user.managerId === null) return "all";
    const descendants = await this.users.getDescendantIds(user.id);
    return [user.id, ...descendants];
  }
}
