import type { User } from "../entities";

export class ApprovalRouteError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "OWNER_MISSING"
      | "OWNER_INACTIVE"
      | "MANAGER_MISSING"
      | "MANAGER_INACTIVE"
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
}

/**
 * Walk Users.managerId upward. Never inspect titles or role names.
 */
export function buildApprovalRoute(
  ownerId: string,
  usersById: Map<string, User>
): ApprovalRouteDraftStep[] {
  const owner = usersById.get(ownerId);
  if (!owner) {
    throw new ApprovalRouteError("Owner not found", "OWNER_MISSING");
  }
  if (!owner.active) {
    throw new ApprovalRouteError("Owner is inactive", "OWNER_INACTIVE");
  }

  const route: ApprovalRouteDraftStep[] = [];
  const visited = new Set<string>([ownerId]);
  let walker: string | null = owner.managerId;
  let sequence = 1;

  while (walker !== null) {
    if (visited.has(walker)) {
      throw new ApprovalRouteError(
        "Circular hierarchy detected",
        "CIRCULAR_HIERARCHY"
      );
    }
    const manager = usersById.get(walker);
    if (!manager) {
      throw new ApprovalRouteError(
        `Manager ${walker} not found in hierarchy`,
        "MANAGER_MISSING"
      );
    }
    if (!manager.active) {
      throw new ApprovalRouteError(
        `Manager ${manager.name} is inactive`,
        "MANAGER_INACTIVE"
      );
    }
    visited.add(walker);
    route.push({ approverId: manager.id, sequence });
    sequence += 1;
    walker = manager.managerId;
  }

  return route;
}
