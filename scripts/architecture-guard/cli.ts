#!/usr/bin/env node
/**
 * CLI: npm run lint:boundaries
 * Fails when Client Components or lib/client import server layers.
 */
import fs from "node:fs";
import path from "node:path";
import { runArchitectureGuard } from "./rules";

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
  console.log("Architecture guard: PASS (no forbidden client/shared imports).");
  process.exit(0);
}

console.error("Architecture guard: FAIL\n");
for (const v of violations) {
  console.error(`  ${v.file}\n    import "${v.importPath}" — ${v.rule}`);
}
console.error(
  `\n${violations.length} violation(s). See docs/ARCHITECTURAL_INVARIANTS.md (Browser Safety Rule).`
);
process.exit(1);
