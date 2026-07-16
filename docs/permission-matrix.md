# Permission Matrix

**Capability vs routing:** Permissions answer "may this user act at all?" Routing answers "who is next?" via `CostCenter.managerId` / `Users.managerId` only (`buildApprovalRoute`).

**Source of truth:** `PermissionCode` / `RoleCode` in `src/domain/value-objects/budget-status.ts`, `permissionCodesByRole` in `src/infrastructure/repositories/mock/seed.ts`, `AuthorizationService`, `src/lib/navigation.ts`, `src/middleware.ts`.  
**Last synced:** 2026-07-16 (Milestone 2 — Priority Documentation Drift gate).

## Roles (capability codes)

| RoleCode | Meaning | Typical org mapping |
|----------|---------|---------------------|
| `BudgetSubmitter` | Create, edit draft/returned, submit own budgets | Budget Holder |
| `BudgetApprover` | Approve/return when `currentApproverId` matches | Manager |
| `GeneralManager` | Approver + permanent reject + audit | GM (`managerId === null`) |
| `FinanceAdministrator` | Finance queue, FY manage, reports, audit | Finance |
| `SystemAdmin` | Users, master data, FY, audit — **not** budget approval by default | System Administrator |
| `AuditViewer` | Audit trail only | Viewer |

There is **no** `FinancialAnalyst` role code. Treat “Financial Analyst” in UAT scripts as **Finance Administrator** unless Product adds a distinct role.

Users may hold multiple roles (e.g. Manager = `BudgetSubmitter` + `BudgetApprover`).

## Default permissions by role (seed)

| Permission | BudgetSubmitter | BudgetApprover | GeneralManager | FinanceAdministrator | SystemAdmin | AuditViewer |
|------------|:---:|:---:|:---:|:---:|:---:|:---:|
| `budget.create` | ✓ | ✓ | ✓ | | | |
| `budget.submit` | ✓ | ✓ | ✓ | | | |
| `budget.approve` | | ✓ | ✓ | | | |
| `budget.reject` | | | ✓ | | | |
| `finance.view` | | | | ✓ | | |
| `finance.claim` | | | | ✓ | | |
| `finance.finalize` | | | | ✓ | | |
| `finance.return` | | | | ✓ | | |
| `report.view` | | ✓ | ✓ | ✓ | | |
| `report.export` | | | | ✓ | | |
| `audit.view` | | | ✓ | ✓ | ✓ | ✓ |
| `admin.users` | | | | | ✓ | |
| `admin.masterdata` | | | | | ✓ | |
| `fy.manage` | | | | ✓ | ✓ | |

Assigned permissions live on the user (`permissionCodes`); admins may grant differently than seed defaults. Enforcement always uses the user’s stored codes.

## Visibility (budgets)

| Org role (resolved) | Scope |
|---------------------|--------|
| `employee` (submitter) | Own plans |
| `manager` | Plans for cost centers where `CostCenter.managerId === user.id`, plus own |
| `gm` / `finance` | All |
| `systemAdmin` | No budget visibility via authz (admin works in Administration) |

Finance users with `finance.view` may view any plan for queue work.

## Matrix (capability + assignee)

| Resource | Action | Who |
|----------|--------|-----|
| Own BudgetPlan | create / edit Draft·Returned / submit | `budget.create` / `budget.submit` + ownership rules |
| BudgetPlan | approve / return | `budget.approve` + `currentApproverId` + not owner; return also requires manager/GM org role |
| BudgetPlan | reject | `budget.reject` + GM org role + `currentApproverId` |
| Finance queue | claim / finalize / return / release | finance.* (+ claim ownership rules) |
| Reports | view / export | `report.view` / `report.export` + visibility |
| AuditLog | view | `audit.view` |
| Users / Dept / CC | manage | `admin.users` / `admin.masterdata` |
| Fiscal Year | manage | `fy.manage` |
| SAP package | after Finalized | visibility + finance/export rules in services |

## Navigation (coarse)

| Audience | Primary nav |
|----------|-------------|
| SystemAdmin | Administration, Audit, Profile |
| FinanceAdministrator | Finance, Financial Years, Reports, Audit, Profile |
| Staff | Home, budgets (if create), Approvals (if approve), Reports/Audit (if permitted), Notifications, Profile |

Middleware enforces session + coarse portal prefixes; **services enforce fine-grained RBAC and IDOR**.

## Permission codes (complete)

`budget.create`, `budget.submit`, `budget.approve`, `budget.reject`, `report.view`, `report.export`, `audit.view`, `admin.users`, `admin.masterdata`, `fy.manage`, `finance.view`, `finance.claim`, `finance.finalize`, `finance.return`

## Enforcement layers

1. `AuthorizationService.hasPermission` / `assertPermission` — capability  
2. Visibility / `currentApproverId` / finance claim ownership — assignee  
3. Middleware portal RBAC (signed session claims) — coarse page gate  
4. Both capability and assignee required for approve/reject/finance mutations. Failure → 403 (+ audit where implemented).

**Session note:** Middleware uses signed cookie claims; role/permission changes take effect on API after DB reload via `getCurrentUser`, but page gates may lag until re-login (accepted residual — see Known Accepted Technical Debt / audit H6).
