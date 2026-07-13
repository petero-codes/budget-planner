# Open Decisions

## Period granularity (v1 default locked)

**Decision (v1):** Plan-level `FromPeriod` / `ToPeriod` on BudgetPlans only.

Monthly/quarterly amounts per line deferred to v2 unless KenGen Finance requires them before Phase 0b.

## Office Administrator cost center

**Status:** TBD — code missing on org chart.

**Routing when coded:** `managerId → Joyce` (one-step route to root). No special SkipManagerTier flag.

## Western Region assistant

**In scope for seed:** Assistant Manager Western Region under Geofrey (Networks & Infrastructure) per architecture directive.

Note: Prior chart had Western Region 606510 crossed out / reassigned as Web & Mobile under Georgina. Seed uses Western Region under Geofrey per current implementation scope; confirm SAP/KGN codes with business.

## Root node submit

**Locked:** Joyce (`managerId IS NULL`) submit → empty ApprovalRoute → auto-Approved. Not a self-approve click.

## Delegation

**Out of scope v1.** Optional v2 `ApprovalDelegations` must preserve sequential route integrity.
