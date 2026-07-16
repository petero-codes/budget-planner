import { describe, expect, it } from "vitest";
import { assertSameOrigin } from "@/lib/security/same-origin";

describe("assertSameOrigin", () => {
  it("allows matching Origin", () => {
    expect(
      assertSameOrigin({
        origin: "http://localhost:3000",
        referer: null,
        host: "localhost:3000",
      }).ok
    ).toBe(true);
  });

  it("allows matching Referer when Origin is absent", () => {
    expect(
      assertSameOrigin({
        origin: null,
        referer: "http://localhost:3000/finance",
        host: "localhost:3000",
      }).ok
    ).toBe(true);
  });

  it("rejects cross-origin Origin", () => {
    const result = assertSameOrigin({
      origin: "https://evil.example",
      referer: null,
      host: "localhost:3000",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("FORBIDDEN_ORIGIN");
  });

  it("rejects when Origin and Referer are both absent", () => {
    const result = assertSameOrigin({
      origin: null,
      referer: null,
      host: "localhost:3000",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("MISSING_ORIGIN");
  });
});
