import { beforeEach, describe, expect, it } from "vitest";
import { AuthorizationError } from "@/application/authorization-service";
import { sapComplianceService, repos } from "@/infrastructure/di";
import { IDS } from "@/infrastructure/repositories/mock/seed";
import { resetMockStore } from "@/infrastructure/repositories/mock/store";

describe("SapComplianceService.getFormForDownload", () => {
  beforeEach(() => {
    resetMockStore();
  });

  it("requires finance.view even for downloads", async () => {
    const finance = (await repos.users.getById(IDS.finance))!;
    const actor = {
      ...finance,
      permissionCodes: finance.permissionCodes.filter((p) => p !== "finance.view"),
    };

    await expect(
      sapComplianceService.getFormForDownload(actor, "any-plan", "csv")
    ).rejects.toBeInstanceOf(AuthorizationError);
    await expect(
      sapComplianceService.getFormForDownload(actor, "any-plan", "csv")
    ).rejects.toThrow("Missing permission: finance.view");
  });
});
