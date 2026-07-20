#!/usr/bin/env node
/**
 * Browser safety — scan production client chunks for Node/SQL native modules.
 * Run after `npm run build`: npm run lint:browser
 */
import fs from "node:fs";
import path from "node:path";

const rootDir = path.resolve(__dirname, "..");

const FORBIDDEN = [
  "msnodesqlv8",
  "mssql/msnodesqlv8",
  "sqlserver.node",
  "node:fs",
  "node:net",
  "node:tls",
  "node:child_process",
  "require('fs')",
  'require("fs")',
];

function walk(dir: string, acc: string[] = []): string[] {
  if (!fs.existsSync(dir)) return acc;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full, acc);
    else if (ent.name.endsWith(".js")) acc.push(full);
  }
  return acc;
}

/** Scan all JS under .next/static (chunks + hashed build id). */
function clientChunkFiles(): string[] {
  const staticDir = path.join(rootDir, ".next", "static");
  if (!fs.existsSync(staticDir)) return [];
  const files: string[] = [];
  for (const ent of fs.readdirSync(staticDir, { withFileTypes: true })) {
    const full = path.join(staticDir, ent.name);
    if (ent.isDirectory()) walk(full, files);
  }
  return files.filter((f) => f.endsWith(".js"));
}

const chunkFiles = clientChunkFiles();

if (chunkFiles.length === 0) {
  console.error(
    "Browser safety: no client chunks under .next/static. Run `npm run build` first."
  );
  process.exit(2);
}

const hits: { file: string; token: string }[] = [];
for (const file of chunkFiles) {
  const content = fs.readFileSync(file, "utf8");
  for (const token of FORBIDDEN) {
    if (content.includes(token)) {
      hits.push({ file: path.relative(rootDir, file), token });
    }
  }
}

if (hits.length === 0) {
  console.log(
    `Browser safety: PASS (scanned ${chunkFiles.length} client chunk(s)).`
  );
  process.exit(0);
}

console.error("Browser safety: FAIL — forbidden tokens in client bundles:\n");
for (const h of hits) {
  console.error(`  ${h.file}  →  "${h.token}"`);
}
process.exit(1);
