import type { SupportIssue } from "@/domain/entities";
import type { ISupportIssueRepository } from "../interfaces";
import { sql } from "./pool";
import { sqlRequest } from "./request";

const req = sqlRequest;

function mapIssue(row: Record<string, unknown>): SupportIssue {
  return {
    id: String(row.SupportIssueId),
    referenceNumber: String(row.ReferenceNumber),
    title: String(row.Title),
    description: String(row.Description),
    category: String(row.Category) as SupportIssue["category"],
    priority: String(row.Priority) as SupportIssue["priority"],
    status: String(row.Status) as SupportIssue["status"],
    reportedBy: String(row.ReportedBy),
    assignedTo: row.AssignedTo ? String(row.AssignedTo) : null,
    pagePath: row.PagePath ? String(row.PagePath) : null,
    pageLabel: row.PageLabel ? String(row.PageLabel) : null,
    budgetPlanId: row.BudgetPlanId ? String(row.BudgetPlanId) : null,
    fiscalYearId: row.FiscalYearId ? String(row.FiscalYearId) : null,
    costCenterId: row.CostCenterId ? String(row.CostCenterId) : null,
    browser: row.Browser ? String(row.Browser) : null,
    appVersion: row.AppVersion ? String(row.AppVersion) : null,
    correlationId: row.CorrelationId ? String(row.CorrelationId) : null,
    adminNotes: row.AdminNotes ? String(row.AdminNotes) : null,
    screenshotFileName: row.ScreenshotFileName
      ? String(row.ScreenshotFileName)
      : null,
    screenshotContentType: row.ScreenshotContentType
      ? String(row.ScreenshotContentType)
      : null,
    hasScreenshot: Boolean(row.HasScreenshot),
    createdAt: new Date(String(row.CreatedAt)).toISOString(),
    updatedAt: new Date(String(row.UpdatedAt)).toISOString(),
    closedAt: row.ClosedAt
      ? new Date(String(row.ClosedAt)).toISOString()
      : null,
  };
}

const LIST_SELECT = `
  SELECT SupportIssueId, ReferenceNumber, Title, Description, Category, Priority, Status,
         ReportedBy, AssignedTo, PagePath, PageLabel, BudgetPlanId, FiscalYearId, CostCenterId,
         Browser, AppVersion, CorrelationId, AdminNotes,
         ScreenshotFileName, ScreenshotContentType,
         CASE WHEN ScreenshotContent IS NULL THEN 0 ELSE 1 END AS HasScreenshot,
         CreatedAt, UpdatedAt, ClosedAt
  FROM dbo.SupportIssues
`;

export class SqlSupportIssueRepository implements ISupportIssueRepository {
  async getById(id: string) {
    const r = await req();
    r.input("id", sql.UniqueIdentifier, id);
    const result = await r.query(`${LIST_SELECT} WHERE SupportIssueId = @id`);
    const row = result.recordset[0] as Record<string, unknown> | undefined;
    return row ? mapIssue(row) : null;
  }

  async getByReference(referenceNumber: string) {
    const r = await req();
    r.input("ref", sql.NVarChar(32), referenceNumber);
    const result = await r.query(
      `${LIST_SELECT} WHERE ReferenceNumber = @ref`
    );
    const row = result.recordset[0] as Record<string, unknown> | undefined;
    return row ? mapIssue(row) : null;
  }

  async listMine(userId: string) {
    const r = await req();
    r.input("userId", sql.UniqueIdentifier, userId);
    const result = await r.query(`
      ${LIST_SELECT}
      WHERE ReportedBy = @userId
      ORDER BY CreatedAt DESC
    `);
    return (result.recordset as Record<string, unknown>[]).map(mapIssue);
  }

  async listAll(filters?: { status?: string }) {
    const r = await req();
    r.input("status", sql.NVarChar(20), filters?.status ?? null);
    const result = await r.query(`
      ${LIST_SELECT}
      WHERE (@status IS NULL OR Status = @status)
      ORDER BY CreatedAt DESC
    `);
    return (result.recordset as Record<string, unknown>[]).map(mapIssue);
  }

  async nextSequence(yearLabel: number) {
    const r = await req();
    r.input("year", sql.Int, yearLabel);
    const result = await r.query(`
      MERGE dbo.SupportIssueSequence WITH (HOLDLOCK) AS t
      USING (SELECT @year AS YearLabel) AS s
      ON t.YearLabel = s.YearLabel
      WHEN MATCHED THEN UPDATE SET LastValue = t.LastValue + 1
      WHEN NOT MATCHED THEN INSERT (YearLabel, LastValue) VALUES (@year, 1)
      OUTPUT inserted.LastValue;
    `);
    return Number(result.recordset[0]?.LastValue ?? 1);
  }

  async save(issue: SupportIssue, screenshot?: Buffer | null) {
    const existing = await this.getById(issue.id);
    const r = await req();
    r.input("id", sql.UniqueIdentifier, issue.id);
    r.input("ref", sql.NVarChar(32), issue.referenceNumber);
    r.input("title", sql.NVarChar(200), issue.title);
    r.input("description", sql.NVarChar(4000), issue.description);
    r.input("category", sql.NVarChar(40), issue.category);
    r.input("priority", sql.NVarChar(20), issue.priority);
    r.input("status", sql.NVarChar(20), issue.status);
    r.input("reportedBy", sql.UniqueIdentifier, issue.reportedBy);
    r.input("assignedTo", sql.UniqueIdentifier, issue.assignedTo);
    r.input("pagePath", sql.NVarChar(500), issue.pagePath);
    r.input("pageLabel", sql.NVarChar(200), issue.pageLabel);
    r.input("budgetPlanId", sql.UniqueIdentifier, issue.budgetPlanId);
    r.input("fiscalYearId", sql.UniqueIdentifier, issue.fiscalYearId);
    r.input("costCenterId", sql.UniqueIdentifier, issue.costCenterId);
    r.input("browser", sql.NVarChar(200), issue.browser);
    r.input("appVersion", sql.NVarChar(40), issue.appVersion);
    r.input("correlationId", sql.NVarChar(64), issue.correlationId);
    r.input("adminNotes", sql.NVarChar(4000), issue.adminNotes);
    r.input("fileName", sql.NVarChar(260), issue.screenshotFileName);
    r.input("contentType", sql.NVarChar(120), issue.screenshotContentType);
    r.input("createdAt", sql.DateTime2, issue.createdAt);
    r.input("updatedAt", sql.DateTime2, issue.updatedAt);
    r.input("closedAt", sql.DateTime2, issue.closedAt);

    if (!existing) {
      r.input("content", sql.VarBinary(sql.MAX), screenshot ?? null);
      await r.query(`
        INSERT INTO dbo.SupportIssues (
          SupportIssueId, ReferenceNumber, Title, Description, Category, Priority, Status,
          ReportedBy, AssignedTo, PagePath, PageLabel, BudgetPlanId, FiscalYearId, CostCenterId,
          Browser, AppVersion, CorrelationId, AdminNotes,
          ScreenshotFileName, ScreenshotContentType, ScreenshotContent,
          CreatedAt, UpdatedAt, ClosedAt
        ) VALUES (
          @id, @ref, @title, @description, @category, @priority, @status,
          @reportedBy, @assignedTo, @pagePath, @pageLabel, @budgetPlanId, @fiscalYearId, @costCenterId,
          @browser, @appVersion, @correlationId, @adminNotes,
          @fileName, @contentType, @content,
          @createdAt, @updatedAt, @closedAt
        )
      `);
    } else if (screenshot !== undefined) {
      r.input("content", sql.VarBinary(sql.MAX), screenshot);
      await r.query(`
        UPDATE dbo.SupportIssues SET
          Title = @title, Description = @description, Category = @category, Priority = @priority,
          Status = @status, AssignedTo = @assignedTo, AdminNotes = @adminNotes,
          ScreenshotFileName = @fileName, ScreenshotContentType = @contentType,
          ScreenshotContent = @content, UpdatedAt = @updatedAt, ClosedAt = @closedAt
        WHERE SupportIssueId = @id
      `);
    } else {
      await r.query(`
        UPDATE dbo.SupportIssues SET
          Title = @title, Description = @description, Category = @category, Priority = @priority,
          Status = @status, AssignedTo = @assignedTo, AdminNotes = @adminNotes,
          UpdatedAt = @updatedAt, ClosedAt = @closedAt
        WHERE SupportIssueId = @id
      `);
    }
    return (await this.getById(issue.id))!;
  }

  async getScreenshot(id: string) {
    const r = await req();
    r.input("id", sql.UniqueIdentifier, id);
    const result = await r.query(`
      SELECT ScreenshotFileName, ScreenshotContentType, ScreenshotContent
      FROM dbo.SupportIssues WHERE SupportIssueId = @id
    `);
    const row = result.recordset[0] as Record<string, unknown> | undefined;
    if (!row?.ScreenshotContent || !row.ScreenshotFileName) return null;
    return {
      content: Buffer.from(row.ScreenshotContent as Buffer),
      fileName: String(row.ScreenshotFileName),
      contentType: String(row.ScreenshotContentType ?? "application/octet-stream"),
    };
  }
}
