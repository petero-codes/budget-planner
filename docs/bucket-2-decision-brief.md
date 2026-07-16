# Bucket 2 — Decision brief (no code changes)

Stakeholder answers must be recorded in `docs/open-decisions.md` before any implementation of these items.

---

## 5. Reject transition semantics

| | |
|---|---|
| **Interpretation A (docs)** | Reject returns the plan to **Draft**: editable, resubmittable. `state-machines.md` / `approval-engine.md`. |
| **Interpretation B (live code)** | Reject is **terminal `Rejected`**: read-only, no edit/resubmit. Separate **Return** action sets `ReturnedForRevision` (editable + resubmit). |
| **What code does today** | B. Managers Return only; GM may Reject permanently. `ReturnedForRevision` is not in domain-model / state-machines. |
| **If pick A** | Remove or redefine Return; Reject → Draft; update UI/permissions so Manager Reject reappears; migrate existing `Rejected` / `ReturnedForRevision` rows. |
| **If pick B** | Rewrite state-machines + domain-model + approval-engine to document Return vs Reject; keep terminal Rejected. |
| **Open question** | Is terminal Rejected + Return-for-revision the intended v1 model, or was Reject→Draft the locked model and Return an unauthorized expansion? |

---

## 6. Visibility model

| | |
|---|---|
| **Interpretation A (docs)** | Visibility walks **down** the org tree (`managerId` descendants). A Manager sees budgets owned by people under them. |
| **Interpretation B (live code)** | Visibility is **flat CostCenter.managerId** assignment. A Manager sees plans whose cost center lists them as `managerId`. |
| **What code does today** | B. Unit tests assert CC assignment, not subtree. |
| **Impact on locked chart (Asst → Manager → GM)** | Under **B**: Manager sees only CCs assigned to them — Assistant Managers’ primary CCs are visible **only if** those CCs have `managerId = that Manager` (seed does set this for ICT CCs). Under **A**: Manager would also see any descendant-owned plans even if CC.managerId pointed elsewhere. |
| **If pick A** | Revert `canViewBudget` / `filterVisiblePlans` to `getDescendantIds`; `CostCenter.managerId` becomes display-only or unused for authz. |
| **If pick B** | Update `approval-engine.md` / permission-matrix visibility notes; treat CC assignment as source of truth. |
| **Open question** | Which model is intended for v1? |

---

## 7. SystemAdmin scope (“Shape B”)

| | |
|---|---|
| **Interpretation A** | Shape B as discussed: SystemAdmin has user/CC management, audit view, CSV download, **plus** a GM emergency-override path with a **distinctly flagged** audit action; **no** standing create/approve/submit. |
| **Interpretation B (live + written matrix)** | Live: `admin.users`, `audit.view`, `fy.manage` only — **no** CSV, **no** override. Written matrix: SystemAdmin may view reports/subtree and SAP export, still **no** override path described. |
| **What code does today** | Neither full Shape B nor full matrix — no override, no `report.export` for SystemAdmin. |
| **If lock Shape B** | Need exact permission list, override trigger (who/when), and audit action name/shape written into `open-decisions.md` + `permission-matrix.md`, then implement. |
| **If lock current live** | Update matrix to match live (admin + audit + fy only; finance owns CSV). |
| **Open question** | Confirm Shape B as officially locked (with exact permissions + override spec), or confirm live/minimal admin is the intended scope. |

---

## 8. Role / permission drift

| | |
|---|---|
| **Interpretation A** | Original four-capability model (`BudgetSubmitter`, `BudgetApprover`, `SystemAdmin` [+ implied]) and matrix (“BudgetApprover may reject”) remain authoritative — live extras are unapproved scope. |
| **Interpretation B** | Live model is intended: roles `FinanceAdministrator`, `GeneralManager`, `AuditViewer`; permissions `finance.view`, `report.export`, `fy.manage`; **GM-only reject**. |
| **What code does today** | B. |
| **If pick A** | Roll back or formally RFC the extras; restore Manager reject; shrink finance/GM surface. |
| **If pick B** | Full rewrite of `domain-model.md` + `permission-matrix.md` to match code (docs are stale, not the product). |
| **Open question** | Intended forward model vs unapproved expansion? |

---

## 9. Western Region cost center

| | |
|---|---|
| **Interpretation A** | Still in scope per `open-decisions.md` (Assistant Manager Western Region under Geofrey). |
| **Interpretation B** | Cancelled / crossed out on org chart; correctly absent from seed (0 rows). |
| **What code does today** | B (absent). |
| **If pick A** | Re-seed Western Region CC + user; confirm SAP/KGN codes. |
| **If pick B** | One-line correction in `open-decisions.md`: Western Region out of scope for v1. |
| **Open question** | Confirm removal? |

---

## 10. Phase gate naming

| | |
|---|---|
| **Interpretation A** | Stakeholder build order: current work ≈ **Phase 3** (SQL + approvals + CSV). |
| **Interpretation B** | Repo `ai-guardrails.md`: **Phase 4** = SQL + API + SAP release. |
| **What exists today** | SQL live, approvals, SAP export/compliance, finance/executive dashboards — past either Phase 3 gate checklist in spirit, but **concurrency/retry/app-role** gaps were open until Bucket 1. |
| **Gate still must be true (either numbering)** | Optimistic concurrency → 409; SQL retry policy; audit DENY+triggers with least-privilege app login; docs match locked decisions (Bucket 2 items either decided or deferred in `open-decisions.md`). Do **not** assume the gate passed merely because features exist. |
| **Open question** | Which document’s phase numbers are authoritative, and what is the explicit remaining checklist for “pass”? |

---

## 11. Duplicate primary budget after approval

| | |
|---|---|
| **Interpretation A** | After `Approved`, block any new plan for same `(CostCenter, FiscalYear, BudgetType)` entirely (tighten unique index or add domain rule). |
| **Interpretation B** | Allow only via an explicit **Amendment** workflow (type/status rules not fully specified today). |
| **Interpretation C (live index)** | Allow a new Draft/InApproval after Approved/Rejected (current filtered unique). |
| **What code does today** | C. UI offers Budget Type “Amendment” as a string, but no separate amendment state machine. |
| **If pick A** | Change index/domain; may need migration for any existing second-cycle rows. |
| **If pick B** | Spec amendment lifecycle, then implement; keep Primary unique after Approved. |
| **If pick C** | Document as intentional in strategies/domain-model (Bucket 1 already documented current behavior). |
| **Open question** | Block entirely, amendment-only, or allow as-is? |

---

*End of Bucket 2 brief. No code, schema, or doc behavior changes for items 5–11 until each has an explicit stakeholder answer in `open-decisions.md`.*
