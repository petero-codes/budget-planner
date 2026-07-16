import { NextResponse } from "next/server";
import {
  authorizationService,
  fiscalYearService,
  getCurrentUser,
  repos,
} from "@/infrastructure/di";
import type { User } from "@/domain/entities";
import type { OrgRole } from "@/application/authorization-service";

/** Strip email from directory payloads — forms only need identity + org role fields. */
function toDirectoryUser(user: User): User {
  return { ...user, email: "" };
}

/**
 * Limit which users appear in reference data (IDOR / directory enumeration).
 * Privileged roles see everyone; others see their org neighborhood.
 */
function filterDirectoryUsers(
  actor: User,
  role: OrgRole,
  all: User[]
): User[] {
  const active = all.filter((u) => u.active);
  if (role === "systemAdmin" || role === "finance" || role === "gm") {
    return active.map(toDirectoryUser);
  }

  const ids = new Set<string>([actor.id]);
  if (actor.managerId) ids.add(actor.managerId);

  if (role === "manager") {
    for (const u of active) {
      if (u.managerId === actor.id) ids.add(u.id);
      if (u.primaryCostCenterId === actor.primaryCostCenterId) ids.add(u.id);
    }
  } else {
    for (const u of active) {
      if (u.primaryCostCenterId === actor.primaryCostCenterId) ids.add(u.id);
    }
  }

  return active.filter((u) => ids.has(u.id)).map(toDirectoryUser);
}

/** Reference data used by forms — fiscal years, cost centers, and users are role-filtered. */
export async function GET() {
  const correlationId = crypto.randomUUID();
  try {
    const user = await getCurrentUser();
    const role = authorizationService.resolveOrgRole(user);
    const [allUsers, allCenters, glAccounts, fiscalYears, departments] =
      await Promise.all([
        repos.users.getAll(),
        repos.costCenters.getAll(),
        repos.glAccounts.getAll(),
        fiscalYearService.listVisible(user),
        repos.departments.getAll(),
      ]);

    let costCenters = allCenters;
    if (role === "manager") {
      costCenters = await authorizationService.listManagedCostCenters(user);
    } else if (role === "employee") {
      costCenters = allCenters.filter(
        (c) => c.id === user.primaryCostCenterId
      );
    } else if (role === "systemAdmin") {
      costCenters = [];
    }

    const users = filterDirectoryUsers(user, role, allUsers);

    return NextResponse.json({
      data: { users, costCenters, glAccounts, fiscalYears, departments },
      correlationId,
    });
  } catch (e) {
    return NextResponse.json(
      {
        error: {
          code: "UNAUTHORIZED",
          message: e instanceof Error ? e.message : "Not signed in",
          correlationId,
        },
      },
      { status: 401 }
    );
  }
}
