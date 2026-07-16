import type {
  IBudgetAttachmentCategoryRepository,
  IBudgetAttachmentRepository,
  IBudgetLineageRepository,
  IFinanceClaimRepository,
  ISapPackageRepository,
  IWorkflowHistoryRepository,
} from "../interfaces";
import type {
  BudgetAttachment,
  BudgetAttachmentCategory,
  BudgetLineage,
  FinanceQueueClaim,
  SapPackage,
  WorkflowHistoryEntry,
} from "@/domain/entities";
import { mockStore } from "./store";

const IN_PLAY = new Set([
  "Draft",
  "InApproval",
  "ReturnedForRevision",
  "PendingFinanceReview",
  "Claimed",
]);

function defaultPlanFields() {
  return {
    lineageId: null as string | null,
    parentBudgetPlanId: null as string | null,
    lineageRevision: 1,
    versionLabel: null as string | null,
    amendmentReason: null as string | null,
    isArchived: false,
    claimDueAt: null as string | null,
    reviewDueAt: null as string | null,
    escalationStatus: "None" as const,
    financeClaimedAt: null as string | null,
    financeClaimedBy: null as string | null,
    isDemo: false,
    createdByToolkit: false,
    demoBatchId: null as string | null,
  };
}

export function withDefaultPlanFields<T extends object>(plan: T) {
  return { ...defaultPlanFields(), ...plan };
}

export class MockBudgetLineageRepository implements IBudgetLineageRepository {
  async getById(id: string) {
    return structuredClone(mockStore.lineages.find((l) => l.id === id) ?? null);
  }
  async getByKey(costCenterId: string, fiscalYearId: string, originalBudgetType: string) {
    const l = mockStore.lineages.find(
      (x) =>
        x.costCenterId === costCenterId &&
        x.fiscalYearId === fiscalYearId &&
        x.originalBudgetType === originalBudgetType &&
        !x.isArchived
    );
    return l ? structuredClone(l) : null;
  }
  async listBudgetNumbers() {
    return mockStore.lineages.map((l) => l.budgetNumber);
  }
  async save(lineage: BudgetLineage) {
    mockStore.lineages.push(structuredClone(lineage));
    return structuredClone(lineage);
  }
  async updatePointers(lineageId: string, pointers: {
    currentVersionId?: string | null;
    latestFinalizedVersionId?: string | null;
  }) {
    const idx = mockStore.lineages.findIndex((l) => l.id === lineageId);
    if (idx < 0) throw new Error("Lineage not found");
    const l = mockStore.lineages[idx]!;
    if (pointers.currentVersionId !== undefined) l.currentVersionId = pointers.currentVersionId;
    if (pointers.latestFinalizedVersionId !== undefined) {
      l.latestFinalizedVersionId = pointers.latestFinalizedVersionId;
    }
    return structuredClone(l);
  }
  async setArchived(lineageId: string, isArchived: boolean) {
    const l = mockStore.lineages.find((x) => x.id === lineageId);
    if (l) l.isArchived = isArchived;
  }
}

export class MockWorkflowHistoryRepository implements IWorkflowHistoryRepository {
  async append(entry: WorkflowHistoryEntry) {
    mockStore.workflowHistory.push(structuredClone(entry));
  }
  async listByBudgetId(budgetVersionId: string) {
    return structuredClone(
      mockStore.workflowHistory
        .filter((e) => e.budgetVersionId === budgetVersionId)
        .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
    );
  }
}

export class MockFinanceClaimRepository implements IFinanceClaimRepository {
  async getActiveClaim(budgetPlanId: string) {
    const c = mockStore.financeClaims.find(
      (x) => x.budgetPlanId === budgetPlanId && x.isActive
    );
    return c ? structuredClone(c) : null;
  }
  async claim(claim: FinanceQueueClaim) {
    mockStore.financeClaims.push(structuredClone(claim));
    return structuredClone(claim);
  }
  async release(budgetPlanId: string, releasedAt: string) {
    const c = mockStore.financeClaims.find(
      (x) => x.budgetPlanId === budgetPlanId && x.isActive
    );
    if (c) {
      c.isActive = false;
      c.releasedAt = releasedAt;
    }
  }
}

export class MockBudgetAttachmentRepository implements IBudgetAttachmentRepository {
  async listByBudgetId(budgetPlanId: string) {
    return structuredClone(
      mockStore.attachments
        .filter((a) => a.budgetPlanId === budgetPlanId && !a.isArchived)
        .map(({ content: _c, ...meta }) => meta)
    );
  }
  async getById(id: string) {
    const att = mockStore.attachments.find((a) => a.id === id && !a.isArchived);
    return att ? structuredClone(att) : null;
  }
  async save(attachment: BudgetAttachment, content: Buffer) {
    const saved = { ...structuredClone(attachment), content };
    mockStore.attachments.push(saved);
    return structuredClone(attachment);
  }
  async archive(id: string, archivedAt: string) {
    const att = mockStore.attachments.find((a) => a.id === id);
    if (att) {
      att.isArchived = true;
      (att as BudgetAttachment & { archivedAt?: string }).archivedAt = archivedAt;
    }
  }
}

export class MockBudgetAttachmentCategoryRepository
  implements IBudgetAttachmentCategoryRepository
{
  async listActive() {
    return structuredClone(
      mockStore.attachmentCategories.filter((c) => c.isActive)
    );
  }
  async listRequiredForBudgetType(budgetType: string) {
    const ids = mockStore.attachmentRequirements.get(budgetType) ?? [];
    return structuredClone(
      mockStore.attachmentCategories.filter((c) => ids.includes(c.id))
    );
  }
  async listAll() {
    return structuredClone(mockStore.attachmentCategories);
  }
  async save(category: BudgetAttachmentCategory) {
    const idx = mockStore.attachmentCategories.findIndex((c) => c.id === category.id);
    if (idx >= 0) mockStore.attachmentCategories[idx] = structuredClone(category);
    else mockStore.attachmentCategories.push(structuredClone(category));
    return structuredClone(category);
  }
  async setRequirements(budgetType: string, categoryIds: string[]) {
    mockStore.attachmentRequirements.set(budgetType, [...categoryIds]);
  }
}

export class MockSapPackageRepository implements ISapPackageRepository {
  async getByBudgetPlanId(budgetPlanId: string) {
    return structuredClone(
      mockStore.sapPackages.find((p) => p.budgetPlanId === budgetPlanId) ?? null
    );
  }
  async save(pkg: SapPackage) {
    mockStore.sapPackages.push(structuredClone(pkg));
    return structuredClone(pkg);
  }
}

export { IN_PLAY };
