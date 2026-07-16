const rows = require("./button-audit-out.json");

function expected(label, variantExpr) {
  const l = (label || "").toLowerCase();
  // Dynamic variants
  if (variantExpr.includes("ReturnedForRevision") || variantExpr.includes("awaitingMe") || variantExpr.includes("warning")) {
    if (l.includes("edit") || l.includes("review") || l.includes("revise")) return "warning";
  }
  if (l.includes("finalize")) return "success";
  if (
    l.includes("reject") ||
    l.includes("delete") ||
    l.includes("archive") ||
    l.includes("deactivat") ||
    l.includes("remove")
  )
    return "danger";
  if (
    l.includes("return") ||
    l.includes("review") ||
    l.includes("reopen") ||
    (l.includes("edit") && l.includes("return")) ||
    l.includes("edit & revise") ||
    l.includes("close")
  )
    return "warning";
  if (
    l.includes("create") ||
    l.includes("save") ||
    l.includes("submit") ||
    l.includes("approve") ||
    l.includes("claim") ||
    l.includes("resubmit") ||
    l.includes("amendment") ||
    l.includes("sign in") ||
    l.includes("try again") ||
    l.includes("return to home") ||
    l.includes("open new year") ||
    l.includes("continue to") ||
    l.includes("open & clear")
  )
    return "primary";
  if (l.includes("finalize") || l.includes("complete")) return "success";
  return "secondary"; // View, Edit draft, Download, Cancel, Back, etc.
}

function normalizeVariant(v) {
  if (v.includes("warning")) return "warning";
  if (v.includes("success")) return "success";
  if (v.includes("danger")) return "danger";
  if (v.includes("secondary")) return "secondary";
  if (v.includes("primary") || v.includes("default")) return "primary";
  if (v.includes("ghost")) return "ghost";
  return v;
}

const report = rows.map((r) => {
  const actual = normalizeVariant(r.variant);
  const exp = expected(r.label, r.variant);
  // Special cases: Edit returned uses dynamic warning
  let ok = actual === exp;
  if (r.variant.includes("ReturnedForRevision") && actual === "warning" && r.label.toLowerCase().includes("edit"))
    ok = true;
  if (r.variant.includes("awaitingMe") && (actual === "warning" || r.variant.includes("warning")))
    ok = true;
  // Cancel edit / Cancel → secondary
  if (r.label.toLowerCase().includes("cancel") && actual === "secondary") ok = true;
  // Report an issue → secondary
  if (r.label.toLowerCase().includes("report") && actual === "secondary") ok = true;
  // Set current / Restore / Release / Dismiss / Add line → secondary
  if (
    /set current|restore|release|dismiss|add line|financial years|open reports|open latest|open existing|back |go home|export|download|sap|view|edit draft|^edit$/i.test(
      r.label
    ) &&
    actual === "secondary"
  )
    ok = true;
  // Create user / Save changes → primary (default)
  if (/create user|save changes|create department|create cost|open year|create budget/i.test(r.label) && actual === "primary")
    ok = true;
  // Open & clear → primary is intentional CTA
  if (r.label.toLowerCase().includes("open & clear") && actual === "primary") ok = true;
  // Reset password → secondary utility
  if (r.label.toLowerCase().includes("reset password") && actual === "secondary") ok = true;
  // New user → secondary (starts create form, cancel-like) or primary? "New user" is create - should be primary
  return { ...r, actual, expected: exp, compliant: ok };
});

const non = report.filter((r) => !r.compliant);
console.log("TOTAL", report.length);
console.log("NONCOMPLIANT", non.length);
console.log(JSON.stringify(non, null, 2));
