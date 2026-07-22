import { describe, expect, it } from "vitest";
import {
  CLIENT_FORBIDDEN_IMPORT_PATTERNS,
  formatViolation,
  runArchitectureGuard,
} from "../../scripts/architecture-guard/rules";

function readFromMap(map: Record<string, string>) {
  return (abs: string) => {
    const n = abs.replace(/\\/g, "/");
    for (const [rel, content] of Object.entries(map)) {
      if (n.endsWith("/" + rel) || n.endsWith(rel)) return content;
    }
    throw new Error(`missing fixture: ${abs}`);
  };
}

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
      CLIENT_FORBIDDEN_IMPORT_PATTERNS.some((re) =>
        re.test("../../package.json")
      )
    ).toBe(true);
  });

  it("flags transitive client → helper → application reachability with chain", () => {
    const files = [
      "src/components/bell.tsx",
      "src/lib/helper.ts",
      "src/application/svc.ts",
    ];
    const map: Record<string, string> = {
      "src/components/bell.tsx":
        `"use client";\nimport { h } from "@/lib/helper";\n`,
      "src/lib/helper.ts": `import { s } from "@/application/svc";\nexport const h = s;\n`,
      "src/application/svc.ts": `import "server-only";\nexport const s = 1;\n`,
    };
    const violations = runArchitectureGuard(
      { rootDir: "/repo", files },
      readFromMap(map),
      () => []
    );
    const reach = violations.find((v) =>
      v.rule.includes("browser-reachability")
    );
    expect(reach).toBeDefined();
    expect(reach?.chain?.join(" → ")).toContain("src/components/bell.tsx");
    expect(reach?.chain?.some((n) => n.includes("helper"))).toBe(true);
    expect(reach?.suggestedFix).toBeTruthy();
    expect(formatViolation(reach!).includes("Import chain")).toBe(true);
  });

  it("allows client type-only import of domain", () => {
    const files = [
      "src/components/form.tsx",
      "src/domain/rules/types.ts",
    ];
    const map: Record<string, string> = {
      "src/components/form.tsx":
        `"use client";\nimport type { BudgetType } from "@/domain/rules/types";\nexport type T = BudgetType;\n`,
      "src/domain/rules/types.ts": `export type BudgetType = import("@/domain/constants/budget-types").BudgetType;\n`,
    };
    const violations = runArchitectureGuard(
      { rootDir: "/repo", files },
      readFromMap(map),
      () => []
    );
    expect(violations).toHaveLength(0);
  });

  it("flags domain value-import of application (domain purity)", () => {
    const violations = runArchitectureGuard(
      {
        rootDir: "/repo",
        files: ["src/domain/rules/bad.ts"],
      },
      () => `import { svc } from "@/application/foo-service";\nexport const x = svc;\n`,
      () => []
    );
    expect(violations.some((v) => v.rule === "domain-purity")).toBe(true);
  });

  it("suggested fix mentions API route for SQL/DI terminal", () => {
    const files = ["src/components/x.tsx", "src/lib/leak.ts"];
    const map: Record<string, string> = {
      "src/components/x.tsx": `"use client";\nimport { p } from "@/lib/leak";\n`,
      "src/lib/leak.ts": `import mssql from "mssql";\nexport const p = mssql;\n`,
    };
    const violations = runArchitectureGuard(
      { rootDir: "/repo", files },
      readFromMap(map),
      () => []
    );
    const reach = violations.find((v) =>
      v.rule.includes("browser-reachability")
    );
    expect(reach?.suggestedFix).toMatch(/API route/i);
  });
});
