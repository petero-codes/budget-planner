#!/usr/bin/env node
/**
 * One-shot / idempotent: prepend `import "server-only";` to server-layer modules.
 * Skips files that already have it and infrastructure/development/session-registry.ts
 * (middleware-safe shim re-exporting lib/shared).
 */
import fs from "node:fs";
import path from "node:path";

const rootDir = path.resolve(__dirname, "..");
const MARKER = 'import "server-only";';

const SKIP_REL = new Set([
  "src/infrastructure/development/session-registry.ts",
]);

const DIRS = [
  path.join(rootDir, "src", "application"),
  path.join(rootDir, "src", "infrastructure"),
  path.join(rootDir, "src", "lib", "security"),
  path.join(rootDir, "src", "lib", "server"),
];

function walk(dir: string, acc: string[] = []): string[] {
  if (!fs.existsSync(dir)) return acc;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full, acc);
    else if (/\.(ts|tsx)$/.test(ent.name)) acc.push(full);
  }
  return acc;
}

let stamped = 0;
for (const dir of DIRS) {
  for (const file of walk(dir)) {
    const rel = path.relative(rootDir, file).replace(/\\/g, "/");
    if (SKIP_REL.has(rel)) continue;
    let content = fs.readFileSync(file, "utf8");
    if (content.includes(MARKER)) continue;
    const trimmed = content.trimStart();
    if (trimmed.startsWith("/**")) {
      const end = content.indexOf("*/");
      if (end !== -1) {
        const insertAt = end + 2;
        content =
          content.slice(0, insertAt) +
          "\n\n" +
          MARKER +
          "\n" +
          content.slice(insertAt).replace(/^\n+/, "");
      } else {
        content = MARKER + "\n\n" + content;
      }
    } else {
      content = MARKER + "\n\n" + content;
    }
    fs.writeFileSync(file, content, "utf8");
    stamped++;
    console.log("stamped:", rel);
  }
}
console.log(`Done. ${stamped} file(s) stamped.`);
