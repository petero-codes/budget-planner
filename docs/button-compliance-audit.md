# Button Compliance Audit

**Date:** 2026-07-16
**Standard:** [`docs/button-design-system.md`](./button-design-system.md)
**Action controls inventoried:** 80
**Compliant:** 80
**Non-compliant:** 0

## Rules checked

| Action | Required variant |
|--------|------------------|
| Approve | Primary (blue) |
| Finalize | Success (green) |
| Edit (Draft) | Secondary |
| Edit returned / Edit & revise | Warning |
| Return / Review / Reopen / Close FY | Warning |
| Reject / Archive / Deactivate / Remove | Danger |
| Create / Save / Submit / Claim / Resubmit | Primary |
| View / Download / SAP / Cancel / Back | Secondary |

## Inventory

| File | Control | Label | Variant | Status |
|------|---------|-------|---------|--------|
| `src/app/(portal)/access-denied/page.tsx` | ActionLink | Return to Home | primary | ✓ |
| `src/app/(portal)/admin/fiscal-years/page.tsx` | Button | Open new year | primary | ✓ |
| `src/app/(portal)/admin/fiscal-years/page.tsx` | Button | Close | warning | ✓ |
| `src/app/(portal)/admin/fiscal-years/page.tsx` | Button | Reopen | warning | ✓ |
| `src/app/(portal)/admin/fiscal-years/page.tsx` | Button | Archive | danger | ✓ |
| `src/app/(portal)/admin/_master-data-admin.tsx` | Button | {editingId ? "Save" : "Create"} | primary | ✓ |
| `src/app/(portal)/admin/_master-data-admin.tsx` | Button | Cancel | secondary | ✓ |
| `src/app/(portal)/admin/_master-data-admin.tsx` | Button | Edit | secondary | ✓ |
| `src/app/(portal)/admin/_master-data-admin.tsx` | Button | Archive | danger | ✓ |
| `src/app/(portal)/admin/_master-data-admin.tsx` | Button | Restore | secondary | ✓ |
| `src/app/(portal)/admin/_master-data-admin.tsx` | Button | Cancel edit | secondary | ✓ |
| `src/app/(portal)/admin/_master-data-admin.tsx` | Button | {editingId ? "Save changes" : "Create cost center"} | primary | ✓ |
| `src/app/(portal)/admin/_master-data-admin.tsx` | Button | Edit | secondary | ✓ |
| `src/app/(portal)/admin/_master-data-admin.tsx` | Button | Archive | danger | ✓ |
| `src/app/(portal)/admin/_master-data-admin.tsx` | ActionLink | Financial Years | secondary | ✓ |
| `src/app/(portal)/admin/_master-data-admin.tsx` | Button | Open year | primary | ✓ |
| `src/app/(portal)/admin/_master-data-admin.tsx` | Button | Set current | secondary | ✓ |
| `src/app/(portal)/admin/_master-data-admin.tsx` | Button | Close | warning | ✓ |
| `src/app/(portal)/admin/_master-data-admin.tsx` | Button | Reopen | warning | ✓ |
| `src/app/(portal)/admin/_master-data-admin.tsx` | Button | Archive | danger | ✓ |
| `src/app/(portal)/admin/_master-data-admin.tsx` | Button | Reopen | warning | ✓ |
| `src/app/(portal)/admin/_users-admin.tsx` | Button | Cancel edit | secondary | ✓ |
| `src/app/(portal)/admin/_users-admin.tsx` | Button | {editingId ? "Save changes" : "Create user"} | primary | ✓ |
| `src/app/(portal)/admin/_users-admin.tsx` | Button | Reset password | primary | ✓ |
| `src/app/(portal)/admin/_users-admin.tsx` | Button | Cancel | secondary | ✓ |
| `src/app/(portal)/admin/_users-admin.tsx` | Button | Edit | secondary | ✓ |
| `src/app/(portal)/admin/_users-admin.tsx` | Button | Reset password | secondary | ✓ |
| `src/app/(portal)/admin/_users-admin.tsx` | Button | Deactivate | danger | ✓ |
| `src/app/(portal)/approvals/page.tsx` | ActionLink | {awaitingMe ? "Review" : "View"} | warning (conditional) | ✓ |
| `src/app/(portal)/budgets/page.tsx` | ActionLink | Create Budget | primary | ✓ |
| `src/app/(portal)/budgets/page.tsx` | ActionLink | View | secondary | ✓ |
| `src/app/(portal)/budgets/page.tsx` | ActionLink | Edit | warning (conditional) | ✓ |
| `src/app/(portal)/budgets/[id]/page.tsx` | ActionLink | {plan.status === "ReturnedForRevision" ? "Edit & revise" : "Edit Draft"} | warning (conditional) | ✓ |
| `src/app/(portal)/budgets/[id]/page.tsx` | Button | Resubmit | primary | ✓ |
| `src/app/(portal)/budgets/[id]/page.tsx` | Button | (dynamic) | primary | ✓ |
| `src/app/(portal)/budgets/[id]/page.tsx` | Button | Export SAP Package | secondary | ✓ |
| `src/app/(portal)/budgets/[id]/page.tsx` | Button | Approve | primary | ✓ |
| `src/app/(portal)/budgets/[id]/page.tsx` | Button | Return | warning | ✓ |
| `src/app/(portal)/budgets/[id]/page.tsx` | Button | Reject | danger | ✓ |
| `src/app/(portal)/error.tsx` | Button | Try again | primary | ✓ |
| `src/app/(portal)/error.tsx` | ActionLink | Go home | secondary | ✓ |
| `src/app/(portal)/finance/page.tsx` | Button | Claim | primary | ✓ |
| `src/app/(portal)/finance/page.tsx` | Button | Finalize | success | ✓ |
| `src/app/(portal)/finance/page.tsx` | Button | Return | warning | ✓ |
| `src/app/(portal)/finance/page.tsx` | Button | Release | secondary | ✓ |
| `src/app/(portal)/finance/page.tsx` | ActionLink | View | secondary | ✓ |
| `src/app/(portal)/finance/page.tsx` | ActionLink | SAP Package | secondary | ✓ |
| `src/app/(portal)/finance/page.tsx` | ActionLink | Open reports | secondary | ✓ |
| `src/app/(portal)/finance/page.tsx` | Button | Cancel | secondary | ✓ |
| `src/app/(portal)/finance/page.tsx` | Button | Return | warning | ✓ |
| `src/app/(portal)/finance/sap/[id]/page.tsx` | ActionLink | Back to Finance | secondary | ✓ |
| `src/app/(portal)/finance/sap/[id]/page.tsx` | Button | Download CSV | secondary | ✓ |
| `src/app/(portal)/finance/sap/[id]/page.tsx` | Button | Download Excel | secondary | ✓ |
| `src/app/(portal)/finance/sap/[id]/page.tsx` | Button | Download PDF | secondary | ✓ |
| `src/app/(portal)/home/page.tsx` | ActionLink | Open queue | secondary | ✓ |
| `src/app/(portal)/home/page.tsx` | ActionLink | Create Budget | primary | ✓ |
| `src/app/(portal)/home/page.tsx` | ActionLink | Open queue | secondary | ✓ |
| `src/app/(portal)/home/page.tsx` | ActionLink | Review | warning | ✓ |
| `src/app/(portal)/home/page.tsx` | ActionLink | View | secondary | ✓ |
| `src/app/(portal)/home/page.tsx` | ActionLink | Edit | warning | ✓ |
| `src/app/(portal)/home/page.tsx` | ActionLink | Resubmit | primary | ✓ |
| `src/app/(portal)/notifications/page.tsx` | Button | Open & clear | primary | ✓ |
| `src/app/(portal)/notifications/page.tsx` | Button | Dismiss | secondary | ✓ |
| `src/app/(portal)/reports/page.tsx` | Button | Export CSV | secondary | ✓ |
| `src/app/(portal)/reports/page.tsx` | Button | Export Excel | secondary | ✓ |
| `src/app/(portal)/reports/page.tsx` | Button | Export PDF | secondary | ✓ |
| `src/app/error.tsx` | Button | Try again | primary | ✓ |
| `src/app/error.tsx` | ActionLink | Go home | secondary | ✓ |
| `src/app/login/page.tsx` | Button | Sign in | primary | ✓ |
| `src/app/verify-email/page.tsx` | Button | Continue to sign in | primary | ✓ |
| `src/app/verify-email/page.tsx` | Button | Back to sign in | secondary | ✓ |
| `src/app/verify-email/page.tsx` | ActionLink | Back to sign in | secondary | ✓ |
| `src/components/budget/budget-plan-form.tsx` | Button | Open Existing Budget | secondary | ✓ |
| `src/components/budget/budget-plan-form.tsx` | Button | Cancel | secondary | ✓ |
| `src/components/budget/budget-plan-form.tsx` | Button | Remove | danger | ✓ |
| `src/components/budget/budget-plan-form.tsx` | Button | Add line | secondary | ✓ |
| `src/components/budget/budget-plan-form.tsx` | Button | Save | primary | ✓ |
| `src/components/budget/budget-plan-form.tsx` | Button | Submit for Approval | primary | ✓ |
| `src/components/dashboard/gm-dashboard.tsx` | ActionLink | Open latest budget | secondary | ✓ |
| `src/components/layout/footer.tsx` | Button | Report an issue | secondary | ✓ |

## Exemptions (UI chrome, not workflow actions)

- Sidebar / header / mobile nav toggles
- Tab strips (admin, approvals)
- Glass select triggers and options
- Password show/hide
- User menu trigger / overlay backdrop
- GM dashboard selection cards

## Fixes in this pass

- Wrote `docs/button-design-system.md` (frozen mapping)
- Edit returned → Warning; Edit draft → Secondary
- Approve → Primary; Finalize → Success (unchanged, verified)
- FY Close / Reopen → Warning
- Explicit variants on ActionLinks (View, SAP, Open queue, Go home, …)
- Submit/create forms use explicit `variant="primary"`

## Re-run

```bash
node scripts/audit-buttons.js
```
