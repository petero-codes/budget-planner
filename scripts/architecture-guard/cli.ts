#!/usr/bin/env node
/**
 * CLI: npm run lint:boundaries
 * Browser Safety Contract (AI-032 v2) — Level 1 + Level 2.
 */
import fs from "node:fs";
import path from "node:path";
import { formatViolation, runArchitectureGuard } from "./rules";

const rootDir = path.resolve(__dirname, "../..");

function walk(dir: string, acc: string[] = []): string[] {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === "node_modules" || ent.name === ".next") continue;
      walk(full, acc);
    } else if (/\.(ts|tsx)$/.test(ent.name)) {
      acc.push(path.relative(rootDir, full));
    }
  }
  return acc;
}

const violations = runArchitectureGuard(
  { rootDir },
  (abs) => fs.readFileSync(abs, "utf8"),
  () => walk(path.join(rootDir, "src"))
);

if (violations.length === 0) {
  console.log(
    "Architecture guard (AI-032 v2): PASS — no browser→server reachability."
  );
  process.exit(0);
}

console.error("Architecture guard (AI-032 v2): FAIL\n");
console.error("=".repeat(60));
for (const v of violations) {
  console.error(formatViolation(v));
  console.error("=".repeat(60));
}
console.error(
  `\n${violations.length} violation(s). See docs/ARCHITECTURAL_INVARIANTS.md (AI-032 Browser Safety Contract v2).`
);
process.exit(1);
