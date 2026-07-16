import type { FiscalYear, User } from "@/domain/entities";
import type {
  IAuditLogRepository,
  IFiscalYearRepository,
  IUnitOfWork,
} from "@/infrastructure/repositories/interfaces";
import { newId } from "@/infrastructure/id";
import {
  AuthorizationError,
  AuthorizationService,
} from "./authorization-service";

export class FiscalYearServiceError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = "FiscalYearServiceError";
  }
}

export class FiscalYearService {
  constructor(
    private readonly fiscalYears: IFiscalYearRepository,
    private readonly audits: IAuditLogRepository,
    private readonly authz: AuthorizationService,
    private readonly uow: IUnitOfWork
  ) {}

  /** Years visible in pickers / lists for this user. */
  async listVisible(actor: User): Promise<FiscalYear[]> {
    const all = await this.fiscalYears.getAll();
    if (
      this.authz.hasPermission(actor, "finance.view") ||
      this.authz.hasPermission(actor, "fy.manage")
    ) {
      return all;
    }
    return all.filter((fy) => fy.status === "Open");
  }

  async getActiveOpen(): Promise<FiscalYear | null> {
    return this.fiscalYears.getActive();
  }

  async getCurrent(): Promise<FiscalYear | null> {
    return this.fiscalYears.getCurrent();
  }

  /**
   * Mark exactly one financial year as CURRENT. The previous current year is
   * cleared first so the single-current invariant (and its DB unique index)
   * always holds mid-transaction.
   */
  async setCurrent(
    fiscalYearId: string,
    actor: User,
    correlationId = newId("corr")
  ): Promise<FiscalYear> {
    this.authz.assertPermission(actor, "fy.manage");
    const target = await this.fiscalYears.getById(fiscalYearId);
    if (!target) {
      throw new FiscalYearServiceError("Fiscal year not found", "NOT_FOUND");
    }
    if (target.status === "Archived") {
      throw new FiscalYearServiceError(
        "An archived financial year cannot be set as current",
        "INVALID_STATE"
      );
    }
    if (target.isCurrent) return target;

    return this.uow.runInTransaction(async () => {
      const previous = (await this.fiscalYears.getAll()).find(
        (fy) => fy.isCurrent && fy.id !== fiscalYearId
      );
      if (previous) {
        await this.fiscalYears.save({ ...previous, isCurrent: false });
      }
      const saved = await this.fiscalYears.save({ ...target, isCurrent: true });
      await this.audits.append({
        id: newId("audit"),
        entity: "FiscalYear",
        entityId: saved.id,
        action: "FinancialYearSetCurrent",
        performedBy: actor.id,
        ipAddress: null,
        correlationId,
        beforeJson: previous
          ? JSON.stringify({ previousCurrent: previous.yearLabel })
          : null,
        afterJson: JSON.stringify({ current: saved.yearLabel }),
        timestamp: new Date().toISOString(),
      });
      return saved;
    });
  }

  async assertOpenForBudgetWork(fiscalYearId: string): Promise<FiscalYear> {
    const fy = await this.fiscalYears.getById(fiscalYearId);
    if (!fy) {
      throw new FiscalYearServiceError("Fiscal year not found", "NOT_FOUND");
    }
    if (fy.status !== "Open") {
      throw new FiscalYearServiceError(
        `Financial year ${fy.yearLabel} is ${fy.status.toLowerCase()} — budgets cannot be created, edited, or approved`,
        "FY_LOCKED"
      );
    }
    return fy;
  }

  async close(
    fiscalYearId: string,
    actor: User,
    correlationId = newId("corr")
  ): Promise<FiscalYear> {
    this.authz.assertPermission(actor, "fy.manage");
    return this.transition(fiscalYearId, actor, "Closed", "FinancialYearClosed", correlationId);
  }

  async reopen(
    fiscalYearId: string,
    actor: User,
    correlationId = newId("corr")
  ): Promise<FiscalYear> {
    this.authz.assertPermission(actor, "fy.manage");
    return this.transition(fiscalYearId, actor, "Open", "FinancialYearReopened", correlationId);
  }

  async archive(
    fiscalYearId: string,
    actor: User,
    correlationId = newId("corr")
  ): Promise<FiscalYear> {
    this.authz.assertPermission(actor, "fy.manage");
    return this.transition(
      fiscalYearId,
      actor,
      "Archived",
      "FinancialYearArchived",
      correlationId
    );
  }

  async openNew(
    input: {
      yearLabel: number;
      startDate: string;
      endDate: string;
    },
    actor: User,
    correlationId = newId("corr")
  ): Promise<FiscalYear> {
    this.authz.assertPermission(actor, "fy.manage");
    const all = await this.fiscalYears.getAll();
    const existing = all.find((f) => f.yearLabel === input.yearLabel);
    if (existing) {
      throw new FiscalYearServiceError(
        `Financial year ${input.yearLabel} already exists`,
        "DUPLICATE"
      );
    }
    const openYear = all.find((f) => f.status === "Open");
    if (openYear) {
      throw new FiscalYearServiceError(
        `Financial year ${openYear.yearLabel} is still Open — close it before opening ${input.yearLabel}`,
        "ALREADY_OPEN"
      );
    }
    // First year in the system becomes current automatically.
    const noCurrentYet = !all.some((f) => f.isCurrent);
    const fy: FiscalYear = {
      id: newId(),
      yearLabel: input.yearLabel,
      startDate: input.startDate,
      endDate: input.endDate,
      status: "Open",
      isLocked: false,
      isCurrent: noCurrentYet,
    };
    return this.uow.runInTransaction(async () => {
      const saved = await this.fiscalYears.save(fy);
      await this.audits.append({
        id: newId("audit"),
        entity: "FiscalYear",
        entityId: saved.id,
        action: "FinancialYearOpened",
        performedBy: actor.id,
        ipAddress: null,
        correlationId,
        beforeJson: null,
        afterJson: JSON.stringify({ status: "Open", yearLabel: saved.yearLabel }),
        timestamp: new Date().toISOString(),
      });
      return saved;
    });
  }

  private async transition(
    fiscalYearId: string,
    actor: User,
    next: FiscalYear["status"],
    auditAction: string,
    correlationId: string
  ): Promise<FiscalYear> {
    const fy = await this.fiscalYears.getById(fiscalYearId);
    if (!fy) {
      throw new FiscalYearServiceError("Fiscal year not found", "NOT_FOUND");
    }
    if (fy.status === next) return fy;

    const previous = fy.status;
    if (next === "Open" && previous === "Archived") {
      // allow reopen from archived
    } else if (next === "Closed" && previous !== "Open") {
      throw new FiscalYearServiceError(
        "Only an Open year can be closed",
        "INVALID_STATE"
      );
    } else if (next === "Archived" && previous === "Open") {
      throw new FiscalYearServiceError(
        "Close the year before archiving",
        "INVALID_STATE"
      );
    }

    if (next === "Open") {
      const alreadyOpen = (await this.fiscalYears.getAll()).find(
        (other) => other.status === "Open" && other.id !== fiscalYearId
      );
      if (alreadyOpen) {
        throw new FiscalYearServiceError(
          `Financial year ${alreadyOpen.yearLabel} is still Open — close it before reopening ${fy.yearLabel}`,
          "ALREADY_OPEN"
        );
      }
    }

    fy.status = next;
    fy.isLocked = next !== "Open";
    return this.uow.runInTransaction(async () => {
      const saved = await this.fiscalYears.save(fy);
      await this.audits.append({
        id: newId("audit"),
        entity: "FiscalYear",
        entityId: saved.id,
        action: auditAction,
        performedBy: actor.id,
        ipAddress: null,
        correlationId,
        beforeJson: JSON.stringify({ status: previous }),
        afterJson: JSON.stringify({ status: next }),
        timestamp: new Date().toISOString(),
      });
      return saved;
    });
  }
}
