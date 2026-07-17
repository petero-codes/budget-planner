# Button Design System

**Status:** Frozen — do not invent ad-hoc button colors.  
**Implementation:** `src/components/ui/button.tsx` (`Button`, `ActionLink`)  
**Last updated:** 2026-07-16

All actionable controls in the portal must use `Button` or `ActionLink`. Do not style actions with inline `bg-*` / `underline` classes.

## Variants

| Variant | Color | Semantic meaning |
|---------|-------|------------------|
| **Primary** | KenGen Blue (`kengen-blue`) | Advance the main happy path |
| **Success** | KenGen Green (`kengen-green`) | Terminal completion |
| **Secondary** | White / navy border | Neutral navigation & utility |
| **Warning** | Amber (`kengen-amber`) | Needs attention / revision |
| **Danger** | Red (`kengen-red`) | Destructive or irreversible |
| **Ghost** | Transparent | Low-emphasis tertiary only (rare) |

### Primary — Approve ≠ Finalize

- **Approve** stays **Primary (blue)** — moves the budget to the next approver / Finance queue.
- **Finalize** stays **Success (green)** — terminal Finance completion.

Do not swap these. Different stages, different colors.

### Edit — two kinds

| Context | Variant | Why |
|---------|---------|-----|
| Normal edit (Draft) | **Secondary** | Routine |
| Edit after Return for Revision | **Warning** | Signals “this item requires your attention” |

## Approved action → variant map

### Primary (KenGen Blue)

- Create  
- Save  
- Submit  
- Approve  
- Claim  
- Resubmit  
- Create Amendment  
- Open year / Open new year  
- Reset password (confirm)  
- Sign in / Continue to sign in / Try again / Return to Home (auth & recovery CTAs)  
- Open & clear (notification → related budget)

### Success (Green)

- Finalize  
- Complete  
- Confirm completion  

### Secondary (White / Navy)

- View  
- Edit (Draft / normal)  
- Download  
- Export  
- SAP Package  
- Compare  
- Cancel  
- Back  
- Release (claim)  
- Dismiss  
- Set current  
- Restore  
- Open reports / Open latest budget (navigation)  
- Add line  

### Warning (Amber)

- Return for Revision  
- Review (awaiting your approval)  
- Edit Returned Budget / Edit & revise  
- Reopen (fiscal year)  
- Close (fiscal year — attention / lock)

### Danger (Red)

- Reject  
- Delete  
- Archive  
- Deactivate  
- Remove  

## Rules for contributors

1. Prefer `Button` / `ActionLink` with a `variant` prop — never copy hex colors into pages.  
2. Table row actions use `size="compact"`.  
3. Pass `icon` from `lucide-react` when it aids recognition.  
4. Use `loading` for async mutations; do not invent custom spinners.  
5. If an action is not listed above, pick the closest semantic variant and update **this document** in the same PR.  
6. Chrome controls (sidebar nav, tab strips, glass select, password reveal, menu triggers) are **not** action buttons and may keep their own styles.

## Enforcement

When UI drifts, re-audit pages against this design system and replace non-compliant button variants.
