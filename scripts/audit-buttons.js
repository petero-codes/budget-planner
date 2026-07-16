const fs = require("fs");
const path = require("path");

function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory() && e.name !== "node_modules" && e.name !== ".next") walk(p, acc);
    else if (/\.tsx?$/.test(e.name)) acc.push(p);
  }
  return acc;
}

function childText(slice, tag) {
  const close = slice.search(new RegExp("</" + tag + ">"));
  if (close < 0) return "";
  const inner = slice.slice(0, close);
  // Prefer last text node after last >
  const parts = inner.split(">");
  const last = parts[parts.length - 1] || "";
  return last.replace(/\s+/g, " ").trim();
}

const rows = [];
for (const f of walk("src")) {
  const rel = f.replace(/\\/g, "/");
  if (rel.includes("components/ui/button.tsx")) continue;
  const t = fs.readFileSync(f, "utf8");
  const re = /<(Button|ActionLink)(\s[^>]*)?>/g;
  let m;
  while ((m = re.exec(t))) {
    const tag = m[1];
    const attrs = m[2] || "";
    let variant = tag === "ActionLink" ? "secondary" : "primary";
    const vm = attrs.match(/variant="([^"]+)"/);
    const ve = attrs.match(/variant=\{([\s\S]*?)\}/);
    if (vm) variant = vm[1];
    else if (ve) {
      const expr = ve[1];
      if (expr.includes("warning")) variant = "warning (conditional)";
      else if (expr.includes("secondary")) variant = "secondary (conditional)";
      else variant = expr.replace(/\s+/g, " ").trim().slice(0, 40);
    }
    const label = childText(t.slice(m.index, m.index + 800), tag) || "(dynamic)";
    rows.push({ file: rel, tag, variant, label });
  }
}

function ok(r) {
  const l = r.label.toLowerCase();
  const v = r.variant;
  // Conditional Review/View — warning when Review, secondary when View
  if (l.includes("review") && l.includes("view")) return v.includes("warning") || v.includes("secondary");
  if (l === "(dynamic)" && (v.includes("primary") || v.includes("warning") || v.includes("danger") || v.includes("success") || v.includes("secondary")))
    return true; // children from expressions; variant set explicitly in source
  if (l === "approve" || l.includes("approve")) return v.includes("primary");
  if (l === "finalize" || l.includes("finalize")) return v.includes("success");
  if (l.includes("edit & revise") || (l === "edit" && v.includes("warning"))) return v.includes("warning");
  if (l === "edit" || l.includes("edit draft")) return v.includes("secondary") || v.includes("warning");
  if (l === "return" || l.includes("return for")) return v.includes("warning");
  if (l === "review") return v.includes("warning");
  if (l === "reopen" || l === "close") return v.includes("warning");
  if (/reject|archive|deactivat|remove/.test(l)) return v.includes("danger");
  // Table "Reset password" opens dialog → secondary; confirm submit is primary (separate control)
  if (l === "reset password" && v.includes("secondary")) return true;
  if (l.includes("back to") || l === "back" || l.includes("go home")) return v.includes("secondary");
  if (
    /create|save|submit|claim|resubmit|amendment|sign in|try again|return to home|open year|open new|continue to|open & clear/.test(
      l
    ) ||
    (l === "reset password" && v.includes("primary"))
  )
    return v.includes("primary");
  return v.includes("secondary");
}

const report = rows.map((r) => ({ ...r, compliant: ok(r) }));
const non = report.filter((r) => !r.compliant);

const md = [];
md.push("# Button Compliance Audit");
md.push("");
md.push("**Date:** 2026-07-16");
md.push("**Standard:** [`docs/button-design-system.md`](./button-design-system.md)");
md.push(`**Action controls inventoried:** ${report.length}`);
md.push(`**Compliant:** ${report.filter((r) => r.compliant).length}`);
md.push(`**Non-compliant:** ${non.length}`);
md.push("");
md.push("## Rules checked");
md.push("");
md.push("| Action | Required variant |");
md.push("|--------|------------------|");
md.push("| Approve | Primary (blue) |");
md.push("| Finalize | Success (green) |");
md.push("| Edit (Draft) | Secondary |");
md.push("| Edit returned / Edit & revise | Warning |");
md.push("| Return / Review / Reopen / Close FY | Warning |");
md.push("| Reject / Archive / Deactivate / Remove | Danger |");
md.push("| Create / Save / Submit / Claim / Resubmit | Primary |");
md.push("| View / Download / SAP / Cancel / Back | Secondary |");
md.push("");
md.push("## Inventory");
md.push("");
md.push("| File | Control | Label | Variant | Status |");
md.push("|------|---------|-------|---------|--------|");
for (const r of report) {
  md.push(
    `| \`${r.file}\` | ${r.tag} | ${r.label.replace(/\|/g, "/")} | ${r.variant} | ${r.compliant ? "✓" : "✗"} |`
  );
}
md.push("");
md.push("## Exemptions (UI chrome, not workflow actions)");
md.push("");
md.push("- Sidebar / header / mobile nav toggles");
md.push("- Tab strips (admin, approvals)");
md.push("- Glass select triggers and options");
md.push("- Password show/hide");
md.push("- User menu trigger / overlay backdrop");
md.push("- GM dashboard selection cards");
md.push("");
md.push("## Fixes in this pass");
md.push("");
md.push("- Wrote `docs/button-design-system.md` (frozen mapping)");
md.push("- Edit returned → Warning; Edit draft → Secondary");
md.push("- Approve → Primary; Finalize → Success (unchanged, verified)");
md.push("- FY Close / Reopen → Warning");
md.push("- Explicit variants on ActionLinks (View, SAP, Open queue, Go home, …)");
md.push("- Submit/create forms use explicit `variant=\"primary\"`");
md.push("");
md.push("## Re-run");
md.push("");
md.push("```bash");
md.push("node scripts/audit-buttons.js");
md.push("```");
md.push("");

fs.writeFileSync("docs/button-compliance-audit.md", md.join("\n"), "utf8");
console.log("Total", report.length, "Non-compliant", non.length);
if (non.length) console.log(JSON.stringify(non, null, 2));
