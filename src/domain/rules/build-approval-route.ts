import type { User } from "../entities";

export class ApprovalRouteError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "OWNER_MISSING"
      | "OWNER_INACTIVE"
      | "MANAGER_MISSING"
      | "MANAGER_INACTIVE"
      | "GM_MISSING"
      | "CIRCULAR_HIERARCHY"
      | "BROKEN_CHAIN"
  ) {
    super(message);
    this.name = "ApprovalRouteError";
  }
}

export interface ApprovalRouteDraftStep {
  approverId: string;
  sequence: number;
  /** Manager or GM — Finance is handled after GM approval. */
  role: "manager" | "gm";
}

function isGm(user: User): boolean {
  return user.managerId === null;
}

/**
 * Fixed Manager → GM route. Finance queue follows GM approval.
 * Manager = cost-center manager if set, else owner's direct manager.
 * GM = root approver (managerId IS NULL) in the chain.
 */
export function buildApprovalRoute(
  ownerId: string,
  usersById: Map<string, User>,
  costCenterManagerId: string | null = null
): ApprovalRouteDraftStep[] {
  const owner = usersById.get(ownerId);
  if (!owner) {
    throw new ApprovalRouteError("Owner not found", "OWNER_MISSING");
  }
  if (!owner.active) {
    throw new ApprovalRouteError("Owner is inactive", "OWNER_INACTIVE");
  }

  /** GM submitter: no manager steps; Finance queue follows submit. */
  if (isGm(owner)) {
    return [];
  }

  const route: ApprovalRouteDraftStep[] = [];
  const visited = new Set<string>([ownerId]);

  let managerId: string | null =
    costCenterManagerId && costCenterManagerId !== ownerId
      ? costCenterManagerId
      : owner.managerId;

  if (managerId) {
    if (visited.has(managerId)) {
      throw new ApprovalRouteError(
        "Circular hierarchy detected",
        "CIRCULAR_HIERARCHY"
      );
    }
    const manager = usersById.get(managerId);
    if (!manager) {
      throw new ApprovalRouteError(
        `Manager ${managerId} not found`,
        "MANAGER_MISSING"
      );
    }
    if (!manager.active) {
      throw new ApprovalRouteError(
        `Manager ${manager.name} is inactive`,
        "MANAGER_INACTIVE"
      );
    }
    visited.add(managerId);
    route.push({
      approverId: manager.id,
      sequence: 1,
      role: isGm(manager) ? "gm" : "manager",
    });
    if (isGm(manager)) return route;
    managerId = manager.managerId;
  }

  while (managerId !== null) {
    if (visited.has(managerId)) {
      throw new ApprovalRouteError(
        "Circular hierarchy detected",
        "CIRCULAR_HIERARCHY"
      );
    }
    const gm = usersById.get(managerId);
    if (!gm) {
      throw new ApprovalRouteError(`GM ${managerId} not found`, "GM_MISSING");
    }
    if (!gm.active) {
      throw new ApprovalRouteError(`GM ${gm.name} is inactive`, "MANAGER_INACTIVE");
    }
    visited.add(managerId);
    if (isGm(gm)) {
      route.push({
        approverId: gm.id,
        sequence: route.length + 1,
        role: "gm",
      });
      return route;
    }
    managerId = gm.managerId;
  }

  throw new ApprovalRouteError(
    "No General Manager found in approval chain",
    "GM_MISSING"
  );
}

/** Original budget types that may start a new lineage (V1). */
export const ORIGINAL_BUDGET_TYPES = ["Primary", "Supplementary"] as const;
export type OriginalBudgetType = (typeof ORIGINAL_BUDGET_TYPES)[number];

export function isOriginalBudgetType(type: string): type is OriginalBudgetType {
  return (ORIGINAL_BUDGET_TYPES as readonly string[]).includes(type);
}
