/**
 * Docs Guard — pure rule engine.
 *
 * Flow: CODE CHANGE → Subsystem Detection → Required Documentation → Validation.
 * Source of truth for the matrix: docs/ENGINEERING_GOVERNANCE.md ("Change → docs matrix").
 * Pure module (no I/O); git/CI plumbing lives in cli.ts.
 */

export interface DocsGuardInput {
  /** Changed file paths relative to repo root, forward slashes. */
  changedFiles: string[];
  /** Text searched for exemption markers: PR title + body + commit messages. */
  markerText: string;
  /** Source branch name (e.g. "feature/x"). Enables the release-note rule. Optional. */
  branchName?: string;
}

export interface Violation {
  rule: string;
  message: string;
  /** Marker that would waive this violation, e.g. "[no-behavior-change]". */
  waiver: string;
}

const norm = (p: string) => p.replace(/\\/g, "/");

function hasMarker(text: string, marker: string): boolean {
  return text.toLowerCase().includes(marker.toLowerCase());
}

function anyMatch(files: string[], patterns: RegExp[]): string[] {
  return files.filter((f) => patterns.some((re) => re.test(f)));
}

function preview(files: string[]): string {
  return (
    files.slice(0, 5).join(", ") + (files.length > 5 ? ", …" : "")
  );
}

export function runDocsGuard(input: DocsGuardInput): Violation[] {
  const files = input.changedFiles.map(norm);
  const changed = (path: string) => files.includes(path);
  const violations: Violation[] = [];

  // ── Rule: change-history ──────────────────────────────────────────────
  // Any change → CHANGE_HISTORY.md
  if (
    files.length > 0 &&
    !changed("docs/CHANGE_HISTORY.md") &&
    !hasMarker(input.markerText, "[non-functional]")
  ) {
    violations.push({
      rule: "change-history",
      message:
        "No docs/CHANGE_HISTORY.md entry in this PR. Every change records project memory.",
      waiver: "[non-functional]",
    });
  }

  // ── Rule: application-workflows ───────────────────────────────────────
  // src/application/** OR portal UI workflow pages OR mutating API routes → WORKFLOWS.md
  // (Approval/finance cores also hit approval-core below.)
  const applicationSurface = anyMatch(files, [
    /^src\/application\//,
    /^src\/app\/\(portal\)\/(budgets|approvals|finance|notifications)\//,
    /^src\/app\/api\/v1\/(budget-plans|approvals|finance|notifications)\//,
  ]);
  if (
    applicationSurface.length > 0 &&
    !changed("docs/WORKFLOWS.md") &&
    !hasMarker(input.markerText, "[no-behavior-change]")
  ) {
    violations.push({
      rule: "application-workflows",
      message:
        `Application/UI/API workflow surface changed (${preview(applicationSurface)}) ` +
        "but docs/WORKFLOWS.md was not updated.",
      waiver: "[no-behavior-change]",
    });
  }

  // ── Rule: domain-rules ────────────────────────────────────────────────
  // src/domain/** → BUSINESS_RULES.md
  const domainFiles = anyMatch(files, [/^src\/domain\//]);
  if (
    domainFiles.length > 0 &&
    !changed("docs/BUSINESS_RULES.md") &&
    !hasMarker(input.markerText, "[no-behavior-change]")
  ) {
    violations.push({
      rule: "domain-rules",
      message:
        `Domain code changed (${preview(domainFiles)}) but docs/BUSINESS_RULES.md was not updated.`,
      waiver: "[no-behavior-change]",
    });
  }

  // ── Rule: approval-core ───────────────────────────────────────────────
  // Approval / finance services → BOTH WORKFLOWS.md and BUSINESS_RULES.md
  const approvalCore = anyMatch(files, [
    /^src\/application\/approval-service\.ts$/,
    /^src\/application\/finance-service\.ts$/,
  ]);
  if (
    approvalCore.length > 0 &&
    !(changed("docs/WORKFLOWS.md") && changed("docs/BUSINESS_RULES.md")) &&
    !hasMarker(input.markerText, "[no-behavior-change]")
  ) {
    violations.push({
      rule: "approval-core",
      message:
        `Approval/finance core changed (${preview(approvalCore)}) — update BOTH ` +
        "docs/WORKFLOWS.md and docs/BUSINESS_RULES.md.",
      waiver: "[no-behavior-change]",
    });
  }

  // ── Rule: migration-docs ──────────────────────────────────────────────
  const migrationFiles = anyMatch(files, [
    /^docs\/migrations\/.+\.sql$/,
    /^docs\/schema\.sql$/,
  ]);
  if (
    migrationFiles.length > 0 &&
    !changed("docs/DATABASE.md") &&
    !hasMarker(input.markerText, "[no-schema-change]")
  ) {
    violations.push({
      rule: "migration-docs",
      message:
        `Migration/schema files changed (${migrationFiles.join(", ")}) but ` +
        "docs/DATABASE.md was not updated.",
      waiver: "[no-schema-change]",
    });
  }

  // ── Rule: config-docs ─────────────────────────────────────────────────
  const configFiles = anyMatch(files, [
    /^\.env\.example$/,
    /^next\.config\.js$/,
    /^middleware\.ts$/,
    /^src\/middleware\.ts$/,
  ]);
  if (
    configFiles.length > 0 &&
    !changed("docs/ENGINEERING_BRAIN.md") &&
    !hasMarker(input.markerText, "[no-architecture-change]")
  ) {
    violations.push({
      rule: "config-docs",
      message:
        `Configuration files changed (${configFiles.join(", ")}) but ` +
        "docs/ENGINEERING_BRAIN.md was not updated.",
      waiver: "[no-architecture-change]",
    });
  }

  // ── Rule: dependency-map ──────────────────────────────────────────────
  // Composition root / DI wiring → DEPENDENCY_MAP.md
  const diFiles = anyMatch(files, [/^src\/infrastructure\/di\.ts$/]);
  if (
    diFiles.length > 0 &&
    !changed("docs/DEPENDENCY_MAP.md") &&
    !hasMarker(input.markerText, "[no-architecture-change]")
  ) {
    violations.push({
      rule: "dependency-map",
      message:
        "src/infrastructure/di.ts changed but docs/DEPENDENCY_MAP.md was not updated.",
      waiver: "[no-architecture-change]",
    });
  }

  // ── Rule: knowledge-log ───────────────────────────────────────────────
  // Domain invariants OR notification task model → KNOWLEDGE_LOG.md
  const knowledgeSurface = anyMatch(files, [
    /^src\/domain\//,
    /^src\/application\/notification-task-actions\.ts$/,
    /^src\/components\/layout\/notification-bell\.tsx$/,
    /^src\/app\/\(portal\)\/notifications\//,
    /^src\/app\/api\/v1\/notifications\//,
    /^src\/app\/api\/v1\/me\//,
  ]);
  if (
    knowledgeSurface.length > 0 &&
    !changed("docs/KNOWLEDGE_LOG.md") &&
    !hasMarker(input.markerText, "[no-knowledge-change]")
  ) {
    violations.push({
      rule: "knowledge-log",
      message:
        `Permanent-behavior surface changed (${preview(knowledgeSurface)}) but ` +
        "docs/KNOWLEDGE_LOG.md was not updated. Add/supersede a K-entry, or waive.",
      waiver: "[no-knowledge-change]",
    });
  }

  // ── Rule: release-note ────────────────────────────────────────────────
  const isReleaseBranch =
    !!input.branchName && /^(feature|bugfix|hotfix)\//i.test(input.branchName);
  const releaseNoteTouched =
    anyMatch(files, [/^docs\/release-notes\/(?!TEMPLATE\.md$).+\.md$/])
      .length > 0;
  if (
    isReleaseBranch &&
    !releaseNoteTouched &&
    !hasMarker(input.markerText, "[no-release-note]")
  ) {
    violations.push({
      rule: "release-note",
      message:
        `Branch "${input.branchName}" is a feature/bugfix/hotfix branch but no per-branch ` +
        "release note under docs/release-notes/ was added or updated (see TEMPLATE.md).",
      waiver: "[no-release-note]",
    });
  }

  return violations;
}
