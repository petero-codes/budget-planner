/**
 * Architecture guard — client/server import boundaries.
 *
 * Scans every module with "use client" (and everything under lib/client/)
 * and fails if it imports forbidden server layers.
 */

export interface ArchitectureGuardInput {
  /** Repo-relative file paths (forward slashes). If empty, caller scans src/. */
  files?: string[];
  /** Repo root (absolute). */
  rootDir: string;
}

export interface ArchitectureViolation {
  file: string;
  importPath: string;
  rule: string;
}

/** Import paths forbidden in client bundles (Browser Safety Rule). */
export const CLIENT_FORBIDDEN_IMPORT_PATTERNS: RegExp[] = [
  /^@\/application(\/|$)/,
  /^@\/infrastructure(\/|$)/,
  /^@\/lib\/server(\/|$)/,
  /^@\/lib\/security(\/|$)/,
  /^\.\.?\/.*\/application(\/|$)/,
  /^\.\.?\/.*\/infrastructure(\/|$)/,
  /package\.json$/,
  /^mssql(\/|$)/,
  /^msnodesqlv8$/,
  /^node:/,
];

/** lib/client and lib/shared must not import application/infrastructure. */
export const LIB_CLIENT_FORBIDDEN = CLIENT_FORBIDDEN_IMPORT_PATTERNS;

export const LIB_SHARED_FORBIDDEN: RegExp[] = [
  /^@\/application(\/|$)/,
  /^@\/infrastructure(\/|$)/,
  /^@\/lib\/server(\/|$)/,
  /^@\/lib\/security(\/|$)/,
  /^@\/lib\/client(\/|$)/,
  /package\.json$/,
  /^mssql(\/|$)/,
  /^msnodesqlv8$/,
  /^node:/,
];

const IMPORT_RE =
  /(?:import|export)\s+(?:type\s+)?(?:[\w*{}\s,]+\s+from\s+)?["']([^"']+)["']/g;

function norm(p: string): string {
  return p.replace(/\\/g, "/");
}

function isClientModule(content: string, relPath: string): boolean {
  if (relPath.startsWith("src/lib/client/")) return true;
  return /^\s*["']use client["'];?/m.test(content);
}

function isSharedModule(relPath: string): boolean {
  return relPath.startsWith("src/lib/shared/");
}

function extractImports(content: string): string[] {
  const out: string[] = [];
  let m: RegExpExecArray | null;
  IMPORT_RE.lastIndex = 0;
  while ((m = IMPORT_RE.exec(content)) !== null) {
    out.push(m[1]!);
  }
  return out;
}

function matchesForbidden(spec: string, patterns: RegExp[]): string | null {
  for (const re of patterns) {
    if (re.test(spec)) return re.source;
  }
  return null;
}

export function runArchitectureGuard(
  input: ArchitectureGuardInput,
  readFile: (absPath: string) => string,
  listFiles: () => string[]
): ArchitectureViolation[] {
  const files =
    input.files?.map(norm) ??
    listFiles().map((f) => norm(f.replace(/\\/g, "/")));

  const violations: ArchitectureViolation[] = [];

  for (const rel of files) {
    if (!rel.endsWith(".ts") && !rel.endsWith(".tsx")) continue;
    if (!rel.startsWith("src/")) continue;

    const abs = `${input.rootDir}/${rel}`.replace(/\//g, "\\");
    let content: string;
    try {
      content = readFile(abs);
    } catch {
      continue;
    }

    const imports = extractImports(content);
    const client = isClientModule(content, rel);
    const shared = isSharedModule(rel);

    for (const spec of imports) {
      if (client) {
        const hit = matchesForbidden(spec, CLIENT_FORBIDDEN_IMPORT_PATTERNS);
        if (hit) {
          violations.push({
            file: rel,
            importPath: spec,
            rule: `client-forbidden (${hit})`,
          });
        }
      }
      if (shared) {
        const hit = matchesForbidden(spec, LIB_SHARED_FORBIDDEN);
        if (hit) {
          violations.push({
            file: rel,
            importPath: spec,
            rule: `shared-forbidden (${hit})`,
          });
        }
      }
    }
  }

  return violations;
}
