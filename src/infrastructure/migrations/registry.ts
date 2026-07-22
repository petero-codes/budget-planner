/**
 * Ordered migration registry — single source of truth for expected schema.
 * Filenames under docs/migrations/ must match these entries.
 */

import "server-only";

export type MigrationEntry = {
  version: string;
  fileName: string;
  title: string;
};

export const MIGRATIONS: readonly MigrationEntry[] = [
  { version: "001", fileName: "001-auth.sql", title: "Auth columns" },
  { version: "002", fileName: "002-budget-description.sql", title: "Budget description" },
  { version: "003", fileName: "003-fiscal-year-status.sql", title: "Fiscal year status" },
  { version: "004", fileName: "004-cost-center-manager.sql", title: "Cost center manager" },
  { version: "005", fileName: "005-app-budget-ops-role.sql", title: "App budget ops role" },
  { version: "006", fileName: "006-master-data.sql", title: "Master data" },
  { version: "007", fileName: "007-budget-lineage-finance.sql", title: "Budget lineage & finance" },
  { version: "008", fileName: "008-development-toolkit.sql", title: "Development toolkit" },
  { version: "009", fileName: "009-support-issues.sql", title: "Support issues" },
  { version: "010", fileName: "010-notification-tasks.sql", title: "Notification tasks" },
  {
    version: "011",
    fileName: "011-notification-task-metadata.sql",
    title: "Notification task metadata",
  },
  {
    version: "012",
    fileName: "012-schema-version.sql",
    title: "Schema version tracking",
  },
] as const;

/** Highest migration the running application code expects to be applied. */
export const EXPECTED_SCHEMA_VERSION: string =
  MIGRATIONS[MIGRATIONS.length - 1]!.version;

export function parseMigrationVersionFromPath(filePath: string): string | null {
  const base = filePath.replace(/\\/g, "/").split("/").pop() ?? "";
  const match = /^(\d{3})-/.exec(base);
  return match?.[1] ?? null;
}

export function pendingMigrations(appliedVersions: Iterable<string>): MigrationEntry[] {
  const applied = new Set(
    Array.from(appliedVersions).map((v) => v.trim().padStart(3, "0"))
  );
  return MIGRATIONS.filter((m) => !applied.has(m.version));
}

export function latestAppliedVersion(appliedVersions: Iterable<string>): string | null {
  let latest: string | null = null;
  for (const raw of Array.from(appliedVersions)) {
    const v = raw.trim().padStart(3, "0");
    if (!/^\d{3}$/.test(v)) continue;
    if (latest === null || v > latest) latest = v;
  }
  return latest;
}
