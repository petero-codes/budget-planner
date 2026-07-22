import { describe, expect, it } from "vitest";
import { runDocsGuard } from "../../scripts/docs-guard/rules";

const rules = (violations: ReturnType<typeof runDocsGuard>) =>
  violations.map((v) => v.rule).sort();

describe("docs-guard rules — change → docs matrix", () => {
  it("empty diff produces no violations", () => {
    expect(runDocsGuard({ changedFiles: [], markerText: "" })).toEqual([]);
  });

  // ── change-history ───────────────────────────────────────────────────

  it("fails any change without CHANGE_HISTORY.md", () => {
    const v = runDocsGuard({
      changedFiles: ["README.md"],
      markerText: "",
    });
    expect(rules(v)).toEqual(["change-history"]);
  });

  it("waives change-history with [non-functional]", () => {
    const v = runDocsGuard({
      changedFiles: ["README.md"],
      markerText: "[non-functional]",
    });
    expect(v).toEqual([]);
  });

  // ── application → WORKFLOWS ──────────────────────────────────────────

  it("requires WORKFLOWS.md for application changes", () => {
    const v = runDocsGuard({
      changedFiles: [
        "src/application/budget-plan-service.ts",
        "docs/CHANGE_HISTORY.md",
      ],
      markerText: "",
    });
    expect(rules(v)).toEqual(["application-workflows"]);
  });

  it("requires WORKFLOWS.md for portal budget UI changes", () => {
    const v = runDocsGuard({
      changedFiles: [
        "src/app/(portal)/budgets/[id]/page.tsx",
        "docs/CHANGE_HISTORY.md",
      ],
      markerText: "",
    });
    expect(rules(v)).toEqual(["application-workflows"]);
  });

  it("requires WORKFLOWS.md for budget-plans API changes", () => {
    const v = runDocsGuard({
      changedFiles: [
        "src/app/api/v1/budget-plans/[id]/submit/route.ts",
        "docs/CHANGE_HISTORY.md",
      ],
      markerText: "",
    });
    expect(rules(v)).toEqual(["application-workflows"]);
  });

  it("passes application change that updates WORKFLOWS.md", () => {
    const v = runDocsGuard({
      changedFiles: [
        "src/application/budget-plan-service.ts",
        "docs/WORKFLOWS.md",
        "docs/CHANGE_HISTORY.md",
      ],
      markerText: "",
    });
    expect(v).toEqual([]);
  });

  // ── domain → BUSINESS_RULES (+ knowledge-log) ────────────────────────

  it("requires BUSINESS_RULES.md for domain changes", () => {
    const v = runDocsGuard({
      changedFiles: [
        "src/domain/rules/build-approval-route.ts",
        "docs/CHANGE_HISTORY.md",
        "docs/KNOWLEDGE_LOG.md",
      ],
      markerText: "",
    });
    expect(rules(v)).toEqual(["domain-rules"]);
  });

  it("WORKFLOWS.md alone does not satisfy a domain change", () => {
    const v = runDocsGuard({
      changedFiles: [
        "src/domain/rules/budget-plan-invariants.ts",
        "docs/WORKFLOWS.md",
        "docs/CHANGE_HISTORY.md",
        "docs/KNOWLEDGE_LOG.md",
      ],
      markerText: "",
    });
    expect(rules(v)).toEqual(["domain-rules"]);
  });

  it("passes domain change with BUSINESS_RULES + KNOWLEDGE_LOG", () => {
    const v = runDocsGuard({
      changedFiles: [
        "src/domain/rules/build-approval-route.ts",
        "docs/BUSINESS_RULES.md",
        "docs/KNOWLEDGE_LOG.md",
        "docs/CHANGE_HISTORY.md",
      ],
      markerText: "",
    });
    expect(v).toEqual([]);
  });

  // ── approval/finance core → BOTH ─────────────────────────────────────

  it("requires BOTH WORKFLOWS and BUSINESS_RULES for approval-service", () => {
    const v = runDocsGuard({
      changedFiles: [
        "src/application/approval-service.ts",
        "docs/WORKFLOWS.md",
        "docs/CHANGE_HISTORY.md",
      ],
      markerText: "",
    });
    expect(rules(v)).toEqual(["approval-core"]);
  });

  it("passes approval-service when both workflow and rule docs update", () => {
    const v = runDocsGuard({
      changedFiles: [
        "src/application/approval-service.ts",
        "docs/WORKFLOWS.md",
        "docs/BUSINESS_RULES.md",
        "docs/CHANGE_HISTORY.md",
      ],
      markerText: "",
    });
    expect(v).toEqual([]);
  });

  it("requires BOTH docs for finance-service", () => {
    const v = runDocsGuard({
      changedFiles: [
        "src/application/finance-service.ts",
        "docs/BUSINESS_RULES.md",
        "docs/CHANGE_HISTORY.md",
      ],
      markerText: "",
    });
    // application-workflows also fires (WORKFLOWS missing) + approval-core
    expect(rules(v)).toEqual(["application-workflows", "approval-core"]);
  });

  // ── migrations → DATABASE ────────────────────────────────────────────

  it("requires DATABASE.md for migrations", () => {
    const v = runDocsGuard({
      changedFiles: [
        "docs/migrations/013-example.sql",
        "docs/CHANGE_HISTORY.md",
      ],
      markerText: "",
    });
    expect(rules(v)).toEqual(["migration-docs"]);
  });

  it("passes migration with DATABASE.md", () => {
    const v = runDocsGuard({
      changedFiles: [
        "docs/migrations/013-example.sql",
        "docs/DATABASE.md",
        "docs/CHANGE_HISTORY.md",
      ],
      markerText: "",
    });
    expect(v).toEqual([]);
  });

  // ── config → ENGINEERING_BRAIN ───────────────────────────────────────

  it("requires ENGINEERING_BRAIN.md for .env.example", () => {
    const v = runDocsGuard({
      changedFiles: [".env.example", "docs/CHANGE_HISTORY.md"],
      markerText: "",
    });
    expect(rules(v)).toEqual(["config-docs"]);
  });

  // ── di.ts → DEPENDENCY_MAP ───────────────────────────────────────────

  it("requires DEPENDENCY_MAP.md when di.ts changes", () => {
    const v = runDocsGuard({
      changedFiles: [
        "src/infrastructure/di.ts",
        "docs/CHANGE_HISTORY.md",
      ],
      markerText: "",
    });
    expect(rules(v)).toEqual(["dependency-map"]);
  });

  it("passes di.ts change with DEPENDENCY_MAP.md", () => {
    const v = runDocsGuard({
      changedFiles: [
        "src/infrastructure/di.ts",
        "docs/DEPENDENCY_MAP.md",
        "docs/CHANGE_HISTORY.md",
      ],
      markerText: "",
    });
    expect(v).toEqual([]);
  });

  // ── notifications → KNOWLEDGE_LOG ────────────────────────────────────

  it("requires KNOWLEDGE_LOG for notification task surface", () => {
    const v = runDocsGuard({
      changedFiles: [
        "src/application/notification-task-actions.ts",
        "docs/WORKFLOWS.md",
        "docs/CHANGE_HISTORY.md",
      ],
      markerText: "",
    });
    expect(rules(v)).toEqual(["knowledge-log"]);
  });

  it("waives knowledge-log with [no-knowledge-change]", () => {
    const v = runDocsGuard({
      changedFiles: [
        "src/application/notification-task-actions.ts",
        "docs/WORKFLOWS.md",
        "docs/CHANGE_HISTORY.md",
      ],
      markerText: "[no-knowledge-change]",
    });
    expect(v).toEqual([]);
  });

  // ── release-note ─────────────────────────────────────────────────────

  it("fails a feature branch without a release note", () => {
    const v = runDocsGuard({
      changedFiles: [
        "src/application/budget-plan-service.ts",
        "docs/WORKFLOWS.md",
        "docs/CHANGE_HISTORY.md",
      ],
      markerText: "",
      branchName: "feature/finance-tweak",
    });
    expect(rules(v)).toEqual(["release-note"]);
  });

  it("passes a feature branch that adds a release note", () => {
    const v = runDocsGuard({
      changedFiles: [
        "src/application/budget-plan-service.ts",
        "docs/WORKFLOWS.md",
        "docs/CHANGE_HISTORY.md",
        "docs/release-notes/feature-finance-tweak.md",
      ],
      markerText: "",
      branchName: "feature/finance-tweak",
    });
    expect(v).toEqual([]);
  });

  it("does not count TEMPLATE.md as a release note", () => {
    const v = runDocsGuard({
      changedFiles: [
        "docs/release-notes/TEMPLATE.md",
        "docs/CHANGE_HISTORY.md",
      ],
      markerText: "",
      branchName: "bugfix/x",
    });
    expect(rules(v)).toEqual(["release-note"]);
  });

  it("does not require a release note on develop", () => {
    const v = runDocsGuard({
      changedFiles: ["docs/CHANGE_HISTORY.md"],
      markerText: "",
      branchName: "develop",
    });
    expect(v).toEqual([]);
  });

  // ── waivers ──────────────────────────────────────────────────────────

  it("waives application-workflows with [no-behavior-change]", () => {
    const v = runDocsGuard({
      changedFiles: [
        "src/application/approval-service.ts",
        "docs/CHANGE_HISTORY.md",
      ],
      markerText: "[no-behavior-change]",
    });
    expect(v).toEqual([]);
  });
});
