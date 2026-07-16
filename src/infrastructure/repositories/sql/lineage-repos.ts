import type {
  BudgetAttachment,
  BudgetAttachmentCategory,
  BudgetLineage,
  FinanceQueueClaim,
  SapPackage,
  WorkflowHistoryEntry,
} from "@/domain/entities";
import type {
  IBudgetAttachmentCategoryRepository,
  IBudgetAttachmentRepository,
  IBudgetLineageRepository,
  IFinanceClaimRepository,
  ISapPackageRepository,
  IWorkflowHistoryRepository,
} from "../interfaces";
import { sql } from "./pool";
import { sqlRequest } from "./request";

const req = sqlRequest;

export class SqlBudgetLineageRepository implements IBudgetLineageRepository {
  async getById(id: string) {
    const r = await req();
    r.input("id", sql.UniqueIdentifier, id);
    const result = await r.query(`SELECT * FROM dbo.BudgetLineage WHERE LineageId = @id`);
    const row = result.recordset[0] as Record<string, unknown> | undefined;
    return row ? mapLineage(row) : null;
  }
  async getByKey(costCenterId: string, fiscalYearId: string, originalBudgetType: string) {
    const r = await req();
    r.input("cc", sql.UniqueIdentifier, costCenterId);
    r.input("fy", sql.UniqueIdentifier, fiscalYearId);
    r.input("type", sql.NVarChar(50), originalBudgetType);
    const result = await r.query(`
      SELECT * FROM dbo.BudgetLineage
      WHERE CostCenterId = @cc AND FiscalYearId = @fy
        AND OriginalBudgetType = @type AND IsArchived = 0
    `);
    const row = result.recordset[0] as Record<string, unknown> | undefined;
    return row ? mapLineage(row) : null;
  }
  async listBudgetNumbers() {
    const result = await (await req()).query(`SELECT BudgetNumber FROM dbo.BudgetLineage`);
    return (result.recordset as { BudgetNumber: string }[]).map((r) => r.BudgetNumber);
  }
  async save(lineage: BudgetLineage) {
    const r = await req();
    r.input("id", sql.UniqueIdentifier, lineage.id);
    r.input("cc", sql.UniqueIdentifier, lineage.costCenterId);
    r.input("fy", sql.UniqueIdentifier, lineage.fiscalYearId);
    r.input("type", sql.NVarChar(50), lineage.originalBudgetType);
    r.input("num", sql.NVarChar(50), lineage.budgetNumber);
    // Null CurrentVersionId is required on first insert (circular FK with BudgetPlans).
    r.input(
      "current",
      sql.UniqueIdentifier,
      lineage.currentVersionId ?? null
    );
    r.input(
      "finalized",
      sql.UniqueIdentifier,
      lineage.latestFinalizedVersionId ?? null
    );
    r.input("archived", sql.Bit, lineage.isArchived);
    r.input("created", sql.DateTime2, lineage.createdAt);
    await r.query(`
      INSERT INTO dbo.BudgetLineage (
        LineageId, CostCenterId, FiscalYearId, OriginalBudgetType, BudgetNumber,
        CurrentVersionId, LatestFinalizedVersionId, IsArchived, CreatedAt
      ) VALUES (@id, @cc, @fy, @type, @num, @current, @finalized, @archived, @created)
    `);
    return (await this.getById(lineage.id))!;
  }
  async updatePointers(lineageId: string, pointers: {
    currentVersionId?: string | null;
    latestFinalizedVersionId?: string | null;
  }) {
    const sets: string[] = [];
    const r = await req();
    r.input("id", sql.UniqueIdentifier, lineageId);
    if (pointers.currentVersionId !== undefined) {
      r.input("current", sql.UniqueIdentifier, pointers.currentVersionId);
      sets.push("CurrentVersionId = @current");
    }
    if (pointers.latestFinalizedVersionId !== undefined) {
      r.input("finalized", sql.UniqueIdentifier, pointers.latestFinalizedVersionId);
      sets.push("LatestFinalizedVersionId = @finalized");
    }
    if (sets.length) {
      await r.query(`UPDATE dbo.BudgetLineage SET ${sets.join(", ")} WHERE LineageId = @id`);
    }
    return (await this.getById(lineageId))!;
  }

  async setArchived(lineageId: string, isArchived: boolean) {
    const r = await req();
    r.input("id", sql.UniqueIdentifier, lineageId);
    r.input("archived", sql.Bit, isArchived);
    await r.query(
      `UPDATE dbo.BudgetLineage SET IsArchived = @archived WHERE LineageId = @id`
    );
  }
}

function mapLineage(row: Record<string, unknown>): BudgetLineage {
  return {
    id: String(row.LineageId),
    costCenterId: String(row.CostCenterId),
    fiscalYearId: String(row.FiscalYearId),
    originalBudgetType: String(row.OriginalBudgetType),
    budgetNumber: String(row.BudgetNumber),
    currentVersionId: row.CurrentVersionId ? String(row.CurrentVersionId) : null,
    latestFinalizedVersionId: row.LatestFinalizedVersionId
      ? String(row.LatestFinalizedVersionId)
      : null,
    isArchived: Boolean(row.IsArchived),
    createdAt: String(row.CreatedAt),
  };
}

export class SqlWorkflowHistoryRepository implements IWorkflowHistoryRepository {
  async append(entry: WorkflowHistoryEntry) {
    const r = await req();
    r.input("id", sql.UniqueIdentifier, entry.id);
    r.input("planId", sql.UniqueIdentifier, entry.budgetVersionId);
    r.input("stage", sql.NVarChar(50), entry.stage);
    r.input("actor", sql.UniqueIdentifier, entry.actorId);
    r.input("action", sql.NVarChar(50), entry.action);
    r.input("comment", sql.NVarChar(1000), entry.comment);
    r.input("ts", sql.DateTime2, entry.timestamp);
    await r.query(`
      INSERT INTO dbo.WorkflowHistory (
        WorkflowHistoryId, BudgetVersionId, Stage, ActorId, Action, Comment, [Timestamp]
      ) VALUES (@id, @planId, @stage, @actor, @action, @comment, @ts)
    `);
  }
  async listByBudgetId(budgetVersionId: string) {
    const r = await req();
    r.input("planId", sql.UniqueIdentifier, budgetVersionId);
    const result = await r.query(`
      SELECT * FROM dbo.WorkflowHistory
      WHERE BudgetVersionId = @planId ORDER BY [Timestamp]
    `);
    return (result.recordset as Record<string, unknown>[]).map((row) => ({
      id: String(row.WorkflowHistoryId),
      budgetVersionId: String(row.BudgetVersionId),
      stage: String(row.Stage) as WorkflowHistoryEntry["stage"],
      actorId: String(row.ActorId),
      action: String(row.Action),
      comment: row.Comment ? String(row.Comment) : null,
      timestamp: String(row.Timestamp),
    }));
  }
}

export class SqlFinanceClaimRepository implements IFinanceClaimRepository {
  async getActiveClaim(budgetPlanId: string) {
    const r = await req();
    r.input("planId", sql.UniqueIdentifier, budgetPlanId);
    const result = await r.query(`
      SELECT TOP 1 * FROM dbo.FinanceQueueClaims
      WHERE BudgetPlanId = @planId AND IsActive = 1
    `);
    const row = result.recordset[0] as Record<string, unknown> | undefined;
    return row ? mapClaim(row) : null;
  }
  async claim(claim: FinanceQueueClaim) {
    const r = await req();
    r.input("id", sql.UniqueIdentifier, claim.id);
    r.input("planId", sql.UniqueIdentifier, claim.budgetPlanId);
    r.input("userId", sql.UniqueIdentifier, claim.claimedBy);
    r.input("claimedAt", sql.DateTime2, claim.claimedAt);
    await r.query(`
      INSERT INTO dbo.FinanceQueueClaims (ClaimId, BudgetPlanId, ClaimedBy, ClaimedAt, IsActive)
      VALUES (@id, @planId, @userId, @claimedAt, 1)
    `);
    return claim;
  }
  async release(budgetPlanId: string, releasedAt: string) {
    const r = await req();
    r.input("planId", sql.UniqueIdentifier, budgetPlanId);
    r.input("releasedAt", sql.DateTime2, releasedAt);
    await r.query(`
      UPDATE dbo.FinanceQueueClaims SET IsActive = 0, ReleasedAt = @releasedAt
      WHERE BudgetPlanId = @planId AND IsActive = 1
    `);
  }
}

function mapClaim(row: Record<string, unknown>): FinanceQueueClaim {
  return {
    id: String(row.ClaimId),
    budgetPlanId: String(row.BudgetPlanId),
    claimedBy: String(row.ClaimedBy),
    claimedAt: String(row.ClaimedAt),
    releasedAt: row.ReleasedAt ? String(row.ReleasedAt) : null,
    isActive: Boolean(row.IsActive),
  };
}

export class SqlBudgetAttachmentRepository implements IBudgetAttachmentRepository {
  async listByBudgetId(budgetPlanId: string) {
    const r = await req();
    r.input("planId", sql.UniqueIdentifier, budgetPlanId);
    const result = await r.query(`
      SELECT AttachmentId, BudgetPlanId, CategoryId, FileName, ContentType,
             FileSizeBytes, Sha256, Source, InheritedFromAttachmentId,
             UploadedBy, UploadedAt, IsArchived
      FROM dbo.BudgetAttachments
      WHERE BudgetPlanId = @planId AND IsArchived = 0
    `);
    return (result.recordset as Record<string, unknown>[]).map(mapAttachmentMeta);
  }
  async getById(id: string) {
    const r = await req();
    r.input("id", sql.UniqueIdentifier, id);
    const result = await r.query(`
      SELECT * FROM dbo.BudgetAttachments WHERE AttachmentId = @id AND IsArchived = 0
    `);
    const row = result.recordset[0] as Record<string, unknown> | undefined;
    if (!row) return null;
    return {
      ...mapAttachmentMeta(row),
      content: Buffer.from(row.Content as Uint8Array),
    };
  }
  async save(attachment: BudgetAttachment, content: Buffer) {
    const r = await req();
    r.input("id", sql.UniqueIdentifier, attachment.id);
    r.input("planId", sql.UniqueIdentifier, attachment.budgetPlanId);
    r.input("catId", sql.UniqueIdentifier, attachment.categoryId);
    r.input("fileName", sql.NVarChar(260), attachment.fileName);
    r.input("contentType", sql.NVarChar(100), attachment.contentType);
    r.input("size", sql.Int, attachment.fileSizeBytes);
    r.input("sha", sql.NVarChar(64), attachment.sha256);
    r.input("content", sql.VarBinary(sql.MAX), content);
    r.input("source", sql.NVarChar(20), attachment.source);
    r.input("inherited", sql.UniqueIdentifier, attachment.inheritedFromAttachmentId);
    r.input("uploadedBy", sql.UniqueIdentifier, attachment.uploadedBy);
    r.input("uploadedAt", sql.DateTime2, attachment.uploadedAt);
    await r.query(`
      INSERT INTO dbo.BudgetAttachments (
        AttachmentId, BudgetPlanId, CategoryId, FileName, ContentType,
        FileSizeBytes, Sha256, Content, Source, InheritedFromAttachmentId,
        UploadedBy, UploadedAt, IsArchived
      ) VALUES (
        @id, @planId, @catId, @fileName, @contentType,
        @size, @sha, @content, @source, @inherited,
        @uploadedBy, @uploadedAt, 0
      )
    `);
    return attachment;
  }
  async archive(id: string, archivedAt: string) {
    const r = await req();
    r.input("id", sql.UniqueIdentifier, id);
    r.input("archivedAt", sql.DateTime2, archivedAt);
    await r.query(`
      UPDATE dbo.BudgetAttachments SET IsArchived = 1, ArchivedAt = @archivedAt
      WHERE AttachmentId = @id
    `);
  }
}

function mapAttachmentMeta(row: Record<string, unknown>): BudgetAttachment {
  return {
    id: String(row.AttachmentId),
    budgetPlanId: String(row.BudgetPlanId),
    categoryId: String(row.CategoryId),
    fileName: String(row.FileName),
    contentType: String(row.ContentType),
    fileSizeBytes: Number(row.FileSizeBytes),
    sha256: String(row.Sha256),
    source: String(row.Source) as BudgetAttachment["source"],
    inheritedFromAttachmentId: row.InheritedFromAttachmentId
      ? String(row.InheritedFromAttachmentId)
      : null,
    uploadedBy: String(row.UploadedBy),
    uploadedAt: String(row.UploadedAt),
    isArchived: Boolean(row.IsArchived),
  };
}

export class SqlBudgetAttachmentCategoryRepository
  implements IBudgetAttachmentCategoryRepository
{
  async listActive() {
    const result = await (await req()).query(`
      SELECT * FROM dbo.BudgetAttachmentCategories WHERE IsActive = 1 ORDER BY Name
    `);
    return (result.recordset as Record<string, unknown>[]).map(mapCategory);
  }
  async listRequiredForBudgetType(budgetType: string) {
    const r = await req();
    r.input("type", sql.NVarChar(50), budgetType);
    const result = await r.query(`
      SELECT c.* FROM dbo.BudgetAttachmentCategories c
      INNER JOIN dbo.BudgetTypeAttachmentRequirements r
        ON r.CategoryId = c.CategoryId
      WHERE r.BudgetType = @type AND c.IsActive = 1
    `);
    return (result.recordset as Record<string, unknown>[]).map(mapCategory);
  }
  async listAll() {
    const result = await (await req()).query(`
      SELECT * FROM dbo.BudgetAttachmentCategories ORDER BY Name
    `);
    return (result.recordset as Record<string, unknown>[]).map(mapCategory);
  }
  async save(category: BudgetAttachmentCategory) {
    const existing = await this.listAll().then((all) =>
      all.find((c) => c.id === category.id)
    );
    const r = await req();
    r.input("id", sql.UniqueIdentifier, category.id);
    r.input("code", sql.NVarChar(50), category.code);
    r.input("name", sql.NVarChar(200), category.name);
    r.input("active", sql.Bit, category.isActive);
    if (!existing) {
      await r.query(`
        INSERT INTO dbo.BudgetAttachmentCategories (CategoryId, Code, Name, IsActive)
        VALUES (@id, @code, @name, @active)
      `);
    } else {
      await r.query(`
        UPDATE dbo.BudgetAttachmentCategories SET Code = @code, Name = @name, IsActive = @active
        WHERE CategoryId = @id
      `);
    }
    return category;
  }
  async setRequirements(budgetType: string, categoryIds: string[]) {
    const del = await req();
    del.input("type", sql.NVarChar(50), budgetType);
    await del.query(`DELETE FROM dbo.BudgetTypeAttachmentRequirements WHERE BudgetType = @type`);
    for (const catId of categoryIds) {
      const r = await req();
      r.input("type", sql.NVarChar(50), budgetType);
      r.input("catId", sql.UniqueIdentifier, catId);
      await r.query(`
        INSERT INTO dbo.BudgetTypeAttachmentRequirements (BudgetType, CategoryId)
        VALUES (@type, @catId)
      `);
    }
  }
}

function mapCategory(row: Record<string, unknown>): BudgetAttachmentCategory {
  return {
    id: String(row.CategoryId),
    code: String(row.Code),
    name: String(row.Name),
    isActive: Boolean(row.IsActive),
  };
}

export class SqlSapPackageRepository implements ISapPackageRepository {
  async getByBudgetPlanId(budgetPlanId: string) {
    const r = await req();
    r.input("planId", sql.UniqueIdentifier, budgetPlanId);
    const result = await r.query(`
      SELECT * FROM dbo.SapPackages WHERE BudgetPlanId = @planId
    `);
    const row = result.recordset[0] as Record<string, unknown> | undefined;
    return row ? mapSapPackage(row) : null;
  }
  async save(pkg: SapPackage) {
    const r = await req();
    r.input("id", sql.UniqueIdentifier, pkg.id);
    r.input("planId", sql.UniqueIdentifier, pkg.budgetPlanId);
    r.input("ref", sql.NVarChar(50), pkg.sapReference);
    r.input("json", sql.NVarChar(sql.MAX), pkg.packageJson);
    r.input("csv", sql.NVarChar(sql.MAX), pkg.csvContent);
    r.input("generatedAt", sql.DateTime2, pkg.generatedAt);
    r.input("generatedBy", sql.UniqueIdentifier, pkg.generatedBy);
    await r.query(`
      INSERT INTO dbo.SapPackages (
        SapPackageId, BudgetPlanId, SapReference, PackageJson, CsvContent,
        GeneratedAt, GeneratedBy
      ) VALUES (@id, @planId, @ref, @json, @csv, @generatedAt, @generatedBy)
    `);
    return pkg;
  }
}

function mapSapPackage(row: Record<string, unknown>): SapPackage {
  return {
    id: String(row.SapPackageId),
    budgetPlanId: String(row.BudgetPlanId),
    sapReference: String(row.SapReference),
    packageJson: String(row.PackageJson),
    csvContent: String(row.CsvContent),
    generatedAt: String(row.GeneratedAt),
    generatedBy: String(row.GeneratedBy),
  };
}
