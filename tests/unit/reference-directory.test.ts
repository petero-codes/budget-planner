import { describe, expect, it } from "vitest";
import type { User } from "@/domain/entities";
import type { OrgRole } from "@/application/authorization-service";

/** Mirrors filter logic in reference/route.ts for unit coverage. */
function filterDirectoryUsers(
  actor: User,
  role: OrgRole,
  all: User[]
): User[] {
  const active = all.filter((u) => u.active);
  if (role === "systemAdmin" || role === "finance" || role === "gm") {
    return active.map((u) => ({ ...u, email: "" }));
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
  return active.filter((u) => ids.has(u.id)).map((u) => ({ ...u, email: "" }));
}

function stubUser(partial: Partial<User> & Pick<User, "id" | "name">): User {
  return {
    email: `${partial.id}@example.com`,
    positionId: "pos",
    managerId: null,
    departmentId: "dept",
    primaryCostCenterId: "cc-a",
    active: true,
    roleCodes: [],
    permissionCodes: [],
    ...partial,
  };
}

describe("reference directory filter", () => {
  const alice = stubUser({
    id: "alice",
    name: "Alice",
    primaryCostCenterId: "cc-a",
  });
  const bob = stubUser({
    id: "bob",
    name: "Bob",
    primaryCostCenterId: "cc-a",
    managerId: "alice",
  });
  const carol = stubUser({
    id: "carol",
    name: "Carol",
    primaryCostCenterId: "cc-b",
  });

  it("redacts email and scopes employees to their cost center", () => {
    const result = filterDirectoryUsers(bob, "employee", [alice, bob, carol]);
    expect(result.map((u) => u.id).sort()).toEqual(["alice", "bob"]);
    expect(result.every((u) => u.email === "")).toBe(true);
  });

  it("lets finance see all active users", () => {
    const result = filterDirectoryUsers(alice, "finance", [alice, bob, carol]);
    expect(result).toHaveLength(3);
  });
});
