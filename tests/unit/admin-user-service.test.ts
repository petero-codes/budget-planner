import { beforeEach, describe, expect, it } from "vitest";
import { adminUserService, repos } from "@/infrastructure/di";
import { IDS } from "@/infrastructure/repositories/mock/seed";
import {
  mockStore,
  resetMockStore,
} from "@/infrastructure/repositories/mock/store";

describe("System Administrator user management", () => {
  beforeEach(() => resetMockStore());

  it("creates a user with assigned role and an audited temporary password", async () => {
    const admin = (await repos.users.getById(IDS.admin))!;
    const created = await adminUserService.create(
      {
        name: "New ICT User",
        email: "new.ict.user@kengen.co.ke",
        positionId: IDS.posAsst,
        managerId: IDS.peter,
        departmentId: IDS.deptIct,
        primaryCostCenterId: IDS.ccRelMgmt,
        roleCodes: ["BudgetSubmitter"],
        active: true,
      },
      "hashed-temporary-password",
      admin,
      "00000000-0000-4000-8000-000000000001"
    );

    expect(created.email).toBe("new.ict.user@kengen.co.ke");
    expect(created.permissionCodes).toEqual([
      "budget.create",
      "budget.submit",
    ]);
    expect(mockStore.passwordHashes.get(created.id)).toBe(
      "hashed-temporary-password"
    );
    expect(
      (await repos.audits.list({ entity: "User", entityId: created.id }))[0]
        ?.action
    ).toBe("UserCreated");
  });

  it("prevents an administrator from locking out their own account", async () => {
    const admin = (await repos.users.getById(IDS.admin))!;
    await expect(
      adminUserService.update(
        admin.id,
        {
          name: admin.name,
          email: admin.email,
          positionId: admin.positionId,
          managerId: admin.managerId,
          departmentId: admin.departmentId,
          primaryCostCenterId: admin.primaryCostCenterId,
          roleCodes: admin.roleCodes,
          active: false,
        },
        admin
      )
    ).rejects.toMatchObject({
      code: "SELF_LOCKOUT",
    });
  });

  it("rejects manager assignments that create a reporting cycle", async () => {
    const admin = (await repos.users.getById(IDS.admin))!;
    const peter = (await repos.users.getById(IDS.peter))!;
    await expect(
      adminUserService.update(
        peter.id,
        {
          name: peter.name,
          email: peter.email,
          positionId: peter.positionId,
          managerId: IDS.patrick,
          departmentId: peter.departmentId,
          primaryCostCenterId: peter.primaryCostCenterId,
          roleCodes: peter.roleCodes,
          active: true,
        },
        admin
      )
    ).rejects.toMatchObject({
      code: "INVALID_HIERARCHY",
    });
  });

  it("deactivates users instead of deleting historical identities", async () => {
    const admin = (await repos.users.getById(IDS.admin))!;
    const patrick = (await repos.users.getById(IDS.patrick))!;
    const deactivated = await adminUserService.deactivate(
      patrick.id,
      admin,
      "00000000-0000-4000-8000-000000000002"
    );

    expect(deactivated.active).toBe(false);
    expect(await repos.users.getById(patrick.id)).not.toBeNull();
    expect(
      (await repos.audits.list({ entity: "User", entityId: patrick.id }))[0]
        ?.action
    ).toBe("UserDeactivated");
  });

  it("reactivates a user with a UserActivated audit entry", async () => {
    const admin = (await repos.users.getById(IDS.admin))!;
    const patrick = (await repos.users.getById(IDS.patrick))!;
    await adminUserService.deactivate(patrick.id, admin);
    const activated = await adminUserService.activate(patrick.id, admin);

    expect(activated.active).toBe(true);
    const actions = (
      await repos.audits.list({ entity: "User", entityId: patrick.id })
    ).map((entry) => entry.action);
    expect(actions).toContain("UserActivated");
  });

  it("rejects assigning a second active General Manager", async () => {
    const admin = (await repos.users.getById(IDS.admin))!;
    const patrick = (await repos.users.getById(IDS.patrick))!;
    await expect(
      adminUserService.update(
        patrick.id,
        {
          name: patrick.name,
          email: patrick.email,
          positionId: patrick.positionId,
          managerId: patrick.managerId,
          departmentId: patrick.departmentId,
          primaryCostCenterId: patrick.primaryCostCenterId,
          roleCodes: ["GeneralManager"],
          active: true,
        },
        admin
      )
    ).rejects.toMatchObject({
      code: "LAST_ROLE_HOLDER",
    });
  });
});
