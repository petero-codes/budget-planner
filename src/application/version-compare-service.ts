import "server-only";

import type { BudgetAttachment, BudgetPlan } from "@/domain/entities";
import type {
  AttachmentDiff,
  HeaderDiff,
  LineDiff,
  VersionCompareResult,
} from "@/lib/shared/version-compare-types";

export type {
  AttachmentDiff,
  HeaderDiff,
  LineDiff,
  VersionCompareResult,
} from "@/lib/shared/version-compare-types";

function total(plan: BudgetPlan): number {
  return plan.lines.reduce((s, l) => s + l.amount, 0);
}

export function compareVersions(
  from: BudgetPlan,
  to: BudgetPlan,
  attachmentsFrom: BudgetAttachment[] = [],
  attachmentsTo: BudgetAttachment[] = []
): VersionCompareResult {
  const headerFields: Array<{
    field: string;
    from: string | null;
    to: string | null;
  }> = [
    { field: "Department", from: from.costCenterId, to: to.costCenterId },
    { field: "Budget Owner", from: from.ownerId, to: to.ownerId },
    { field: "Budget Type", from: from.budgetType, to: to.budgetType },
    { field: "From Period", from: from.fromPeriod, to: to.fromPeriod },
    { field: "To Period", from: from.toPeriod, to: to.toPeriod },
    { field: "Description", from: from.description, to: to.description },
  ];

  const headerChanges: HeaderDiff[] = headerFields.map((h) => ({
    ...h,
    changed: h.from !== h.to,
  }));

  const fromByGl = new Map(from.lines.map((l) => [l.glAccountId, l]));
  const toByGl = new Map(to.lines.map((l) => [l.glAccountId, l]));
  const allGl = Array.from(
    new Set([...Array.from(fromByGl.keys()), ...Array.from(toByGl.keys())])
  );
  const lineDiffs: LineDiff[] = [];

  for (const glId of allGl) {
    const a = fromByGl.get(glId);
    const b = toByGl.get(glId);
    if (a && !b) {
      lineDiffs.push({
        glAccountId: glId,
        change: "removed",
        fromAmount: a.amount,
      });
    } else if (!a && b) {
      lineDiffs.push({
        glAccountId: glId,
        change: "added",
        toAmount: b.amount,
      });
    } else if (a && b) {
      lineDiffs.push({
        glAccountId: glId,
        change: a.amount === b.amount ? "unchanged" : "modified",
        fromAmount: a.amount,
        toAmount: b.amount,
      });
    }
  }

  const fromAtt = new Map(
    attachmentsFrom.filter((a) => !a.isArchived).map((a) => [a.categoryId, a])
  );
  const toAtt = new Map(
    attachmentsTo.filter((a) => !a.isArchived).map((a) => [a.categoryId, a])
  );
  const attachmentDiffs: AttachmentDiff[] = [];
  for (const [catId, att] of Array.from(toAtt.entries())) {
    const prev = fromAtt.get(catId);
    if (!prev) {
      attachmentDiffs.push({
        categoryId: catId,
        fileName: att.fileName,
        change: att.source === "Inherited" || att.source === "Copied" ? "inherited" : "added",
      });
    } else if (prev.fileName !== att.fileName || prev.sha256 !== att.sha256) {
      attachmentDiffs.push({
        categoryId: catId,
        fileName: att.fileName,
        change: "replaced",
      });
    }
  }
  for (const [catId, att] of Array.from(fromAtt.entries())) {
    if (!toAtt.has(catId)) {
      attachmentDiffs.push({
        categoryId: catId,
        fileName: att.fileName,
        change: "removed",
      });
    }
  }

  const totalFrom = total(from);
  const totalTo = total(to);

  return {
    fromVersionId: from.id,
    toVersionId: to.id,
    fromLabel: from.versionLabel,
    toLabel: to.versionLabel,
    headerChanges,
    lineDiffs,
    attachmentDiffs,
    totalFrom,
    totalTo,
    totalDelta: totalTo - totalFrom,
    summary: {
      linesModified: lineDiffs.filter((d) => d.change === "modified").length,
      linesAdded: lineDiffs.filter((d) => d.change === "added").length,
      linesRemoved: lineDiffs.filter((d) => d.change === "removed").length,
      attachmentsAdded: attachmentDiffs.filter(
        (d) => d.change === "added" || d.change === "inherited"
      ).length,
      attachmentsRemoved: attachmentDiffs.filter((d) => d.change === "removed")
        .length,
      headerFieldsChanged: headerChanges.filter((h) => h.changed).length,
    },
  };
}
