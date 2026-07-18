/**
 * TestDatabaseCleaner — SOLE AUTHORIZED LOCATION for disabling SQL Server
 * immutability triggers (AuditLogs, ApprovalHistory, WorkflowHistory).
 *
 * Application code, E2E harnesses, and one-off scripts must NOT emit
 * DISABLE TRIGGER themselves. Call into this module instead so the operation
 * is auditable in one place.
 *
 * Used by:
 *   - scripts/e2e-notification-spine.ts  (lineage-scoped teardown)
 *   - scripts/seed-sql.ts                (full transactional wipe on reseed)
 */

type Queryable = {
  request(): {
    input(name: string, type: unknown, value: unknown): unknown;
    query(command: string): Promise<unknown>;
  };
};

type SqlTypes = {
  UniqueIdentifier: unknown;
};

const DISABLE_IMMUTABILITY_TRIGGERS = `
  DISABLE TRIGGER dbo.TR_AuditLogs_NoUpdateDelete ON dbo.AuditLogs;
  DISABLE TRIGGER dbo.TR_ApprovalHistory_NoUpdateDelete ON dbo.ApprovalHistory;
  IF OBJECT_ID('dbo.TR_WorkflowHistory_NoUpdateDelete', 'TR') IS NOT NULL
    DISABLE TRIGGER dbo.TR_WorkflowHistory_NoUpdateDelete ON dbo.WorkflowHistory;
`;

const ENABLE_IMMUTABILITY_TRIGGERS = `
  ENABLE TRIGGER dbo.TR_AuditLogs_NoUpdateDelete ON dbo.AuditLogs;
  ENABLE TRIGGER dbo.TR_ApprovalHistory_NoUpdateDelete ON dbo.ApprovalHistory;
  IF OBJECT_ID('dbo.TR_WorkflowHistory_NoUpdateDelete', 'TR') IS NOT NULL
    ENABLE TRIGGER dbo.TR_WorkflowHistory_NoUpdateDelete ON dbo.WorkflowHistory;
`;

/**
 * Run `work` with immutability DELETE/UPDATE triggers temporarily disabled.
 * Always re-enables in `finally`, even if `work` throws.
 */
export async function withImmutabilityTriggersDisabled(
  pool: Queryable,
  work: () => Promise<void>
): Promise<void> {
  await pool.request().query(DISABLE_IMMUTABILITY_TRIGGERS);
  try {
    await work();
  } finally {
    await pool.request().query(ENABLE_IMMUTABILITY_TRIGGERS);
  }
}

/**
 * Deletes exactly one budget lineage and every child row it owns.
 * Scoped to `@lin` — never wipes unrelated plans, users, or master data.
 * Handles the circular BudgetLineage ↔ BudgetPlans FK by nulling pointers first.
 */
export async function deleteTestLineage(
  pool: Queryable,
  sql: SqlTypes,
  lineageId: string
): Promise<void> {
  await withImmutabilityTriggersDisabled(pool, async () => {
    const r = pool.request();
    r.input("lin", sql.UniqueIdentifier, lineageId);
    await r.query(`
      DECLARE @plans TABLE (Id UNIQUEIDENTIFIER);
      INSERT INTO @plans SELECT BudgetPlanId FROM dbo.BudgetPlans WHERE LineageId = @lin;

      DELETE FROM dbo.Notifications
        WHERE RelatedBudgetPlanId IN (SELECT Id FROM @plans)
           OR EntityId IN (SELECT CAST(Id AS NVARCHAR(100)) FROM @plans);
      DELETE FROM dbo.AuditLogs WHERE EntityId IN (SELECT Id FROM @plans);
      DELETE FROM dbo.ApprovalHistory WHERE BudgetPlanId IN (SELECT Id FROM @plans);
      DELETE FROM dbo.ApprovalRoute WHERE BudgetPlanId IN (SELECT Id FROM @plans);
      IF OBJECT_ID('dbo.WorkflowHistory', 'U') IS NOT NULL
        DELETE FROM dbo.WorkflowHistory WHERE BudgetVersionId IN (SELECT Id FROM @plans);
      IF OBJECT_ID('dbo.FinanceQueueClaims', 'U') IS NOT NULL
        DELETE FROM dbo.FinanceQueueClaims WHERE BudgetPlanId IN (SELECT Id FROM @plans);
      DELETE FROM dbo.BudgetItems WHERE BudgetPlanId IN (SELECT Id FROM @plans);

      UPDATE dbo.BudgetLineage
        SET CurrentVersionId = NULL, LatestFinalizedVersionId = NULL
        WHERE LineageId = @lin;
      DELETE FROM dbo.BudgetPlans WHERE LineageId = @lin;
      DELETE FROM dbo.BudgetLineage WHERE LineageId = @lin;
    `);
  });
}
