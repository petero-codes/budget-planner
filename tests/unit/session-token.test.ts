import { describe, expect, it } from "vitest";
import {
  createSessionToken,
  verifySessionToken,
  verifySessionClaims,
  SESSION_TTL_SECONDS,
} from "@/lib/security/session-token";

describe("session-token", () => {
  it("round-trips a signed token to the same user id and RBAC claims", async () => {
    const userId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    const token = await createSessionToken(userId, {
      roleCodes: ["SystemAdmin"],
      permissionCodes: ["admin.users", "admin.masterdata"],
    });
    await expect(verifySessionToken(token)).resolves.toBe(userId);
    const claims = await verifySessionClaims(token);
    expect(claims?.roleCodes).toEqual(["SystemAdmin"]);
    expect(claims?.permissionCodes).toContain("admin.users");
  });

  it("rejects a raw unsigned user id (legacy forgeable cookie)", async () => {
    const userId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    await expect(verifySessionToken(userId)).resolves.toBeNull();
  });

  it("rejects a tampered payload", async () => {
    const token = await createSessionToken(
      "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      { roleCodes: ["SystemAdmin"], permissionCodes: ["admin.users"] }
    );
    const [payload, sig] = token.split(".");
    const tampered = `${payload}x.${sig}`;
    await expect(verifySessionToken(tampered)).resolves.toBeNull();
  });

  it("rejects an expired token", async () => {
    const userId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    const issuedAt = Date.now() - (SESSION_TTL_SECONDS + 60) * 1000;
    const token = await createSessionToken(userId, { nowMs: issuedAt });
    await expect(verifySessionToken(token)).resolves.toBeNull();
  });
});
