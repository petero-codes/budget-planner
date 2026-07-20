import { describe, expect, it } from "vitest";
import {
  CLIENT_FORBIDDEN_IMPORT_PATTERNS,
  runArchitectureGuard,
} from "../../scripts/architecture-guard/rules";

describe("architecture guard", () => {
  it("flags client component importing application", () => {
    const violations = runArchitectureGuard(
      {
        rootDir: "/repo",
        files: ["src/components/foo.tsx"],
      },
      () => `"use client";\nimport { x } from "@/application/foo-service";\n`,
      () => []
    );
    expect(violations).toHaveLength(1);
    expect(violations[0]?.importPath).toBe("@/application/foo-service");
  });

  it("allows client component importing lib/shared", () => {
    const violations = runArchitectureGuard(
      {
        rootDir: "/repo",
        files: ["src/components/foo.tsx"],
      },
      () =>
        `"use client";\nimport { notificationDestination } from "@/lib/shared/notification-destination";\n`,
      () => []
    );
    expect(violations).toHaveLength(0);
  });

  it("flags lib/shared importing infrastructure", () => {
    const violations = runArchitectureGuard(
      {
        rootDir: "/repo",
        files: ["src/lib/shared/bad.ts"],
      },
      () => `import { pool } from "@/infrastructure/repositories/sql/pool";\n`,
      () => []
    );
    expect(violations).toHaveLength(1);
  });

  it("forbids package.json imports in client modules", () => {
    expect(
      CLIENT_FORBIDDEN_IMPORT_PATTERNS.some((re) => re.test("../../package.json"))
    ).toBe(true);
  });
});
