/**
 * Architecture guard — Browser Safety Contract (AI-032 v2)
 *
 * Core invariant: no Client Component / browser module may directly or
 * transitively reach a server-only dependency.
 *
 * Level 1 — Fast path: reject known server roots on direct imports.
 * Level 2 — Semantic: build an import graph, classify server-only modules,
 *            BFS from every "use client" / lib/client file, report chains.
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
  /** Shortest import chain from client → server-only (repo paths or package names). */
  chain?: string[];
  /** Human labels for nodes on the chain. */
  classification?: string[];
  suggestedFix?: string;
}

export type ExtractedImport = {
  spec: string;
  isTypeOnly: boolean;
};

/** Level 1 — direct imports forbidden in client bundles. */
export const CLIENT_FORBIDDEN_IMPORT_PATTERNS: RegExp[] = [
  /^@\/application(\/|$)/,
  /^@\/infrastructure(\/|$)/,
  /^@\/instrumentation$/,
  /^@\/lib\/server(\/|$)/,
  /^@\/lib\/security(\/|$)/,
  /^\.\.?\/.*\/application(\/|$)/,
  /^\.\.?\/.*\/infrastructure(\/|$)/,
  /package\.json$/,
  /^mssql(\/|$)/,
  /^msnodesqlv8$/,
  /^node:/,
];

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

/** Packages / specs that seed server-only classification. */
const SERVER_PACKAGE_SEEDS = new Set([
  "mssql",
  "msnodesqlv8",
  "server-only",
  "tedious",
]);

const NODE_BUILTIN_RE =
  /^(node:|fs|path|os|child_process|net|tls|dns|http|https|cluster|worker_threads|readline|stream|buffer|util|assert|events|module|vm|zlib|crypto)(\/|$)/;

const IMPORT_RE =
  /(?:import|export)\s+(type\s+)?(?:[\w*{}\s,]+\s+from\s+)?["']([^"']+)["']/g;

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

function isDomainModule(relPath: string): boolean {
  return relPath.startsWith("src/domain/");
}

/** Path is a known server root (Level 1 seeds). */
export function isServerRootPath(relPath: string): boolean {
  const p = norm(relPath);
  return (
    p === "src/instrumentation.ts" ||
    p.startsWith("src/application/") ||
    p.startsWith("src/infrastructure/") ||
    p.startsWith("src/lib/server/") ||
    p.startsWith("src/lib/security/")
  );
}

export function extractImports(content: string): ExtractedImport[] {
  const out: ExtractedImport[] = [];
  let m: RegExpExecArray | null;
  IMPORT_RE.lastIndex = 0;
  while ((m = IMPORT_RE.exec(content)) !== null) {
    const typeKeyword = Boolean(m[1]);
    const spec = m[2]!;
    // `import type { X }` / `export type { X }` — type-only (erased).
    // Mixed `import { type A, B }` treated as value (conservative).
    out.push({ spec, isTypeOnly: typeKeyword });
  }
  return out;
}

function matchesForbidden(spec: string, patterns: RegExp[]): string | null {
  for (const re of patterns) {
    if (re.test(spec)) return re.source;
  }
  return null;
}

function isServerPackageSpec(spec: string): boolean {
  if (SERVER_PACKAGE_SEEDS.has(spec)) return true;
  if (spec.startsWith("mssql/") || spec.startsWith("msnodesqlv8/")) return true;
  if (NODE_BUILTIN_RE.test(spec)) return true;
  return false;
}

/**
 * Resolve an import specifier to a repo-relative src path, or keep package name.
 */
export function resolveImportSpec(
  fromRel: string,
  spec: string,
  knownFiles: Set<string>
): string | null {
  if (spec.startsWith("@/")) {
    const base = "src/" + spec.slice(2);
    return resolveExisting(base, knownFiles);
  }
  if (spec.startsWith(".") || spec.startsWith("/")) {
    const fromDir = fromRel.includes("/")
      ? fromRel.slice(0, fromRel.lastIndexOf("/"))
      : "";
    const joined = norm(pathJoin(fromDir, spec));
    return resolveExisting(joined, knownFiles);
  }
  // External package (or node builtin)
  return spec;
}

function pathJoin(dir: string, rel: string): string {
  const parts = (dir ? dir.split("/") : []).concat(rel.split("/"));
  const stack: string[] = [];
  for (const part of parts) {
    if (!part || part === ".") continue;
    if (part === "..") {
      stack.pop();
      continue;
    }
    stack.push(part);
  }
  return stack.join("/");
}

function resolveExisting(base: string, knownFiles: Set<string>): string | null {
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}/index.ts`,
    `${base}/index.tsx`,
  ];
  for (const c of candidates) {
    if (knownFiles.has(c)) return c;
  }
  // Unresolved alias — still useful as a chain node
  return base.endsWith(".ts") || base.endsWith(".tsx") ? base : `${base}.ts`;
}

function classifyNode(node: string): string {
  if (node === "mssql" || node.startsWith("mssql/")) return "native SQL driver";
  if (node === "msnodesqlv8" || node.startsWith("msnodesqlv8/"))
    return "native SQL driver";
  if (node === "tedious") return "SQL driver";
  if (node === "server-only") return "server-only marker";
  if (NODE_BUILTIN_RE.test(node)) return "Node built-in";
  if (node.startsWith("src/infrastructure/repositories/sql/"))
    return "SQL repository";
  if (node === "src/infrastructure/di.ts" || node.endsWith("/di.ts"))
    return "DI container";
  if (node.startsWith("src/infrastructure/startup/")) return "startup";
  if (node.startsWith("src/infrastructure/")) return "infrastructure";
  if (node.startsWith("src/application/")) return "application service";
  if (node.startsWith("src/lib/security/") || node.startsWith("src/lib/server/"))
    return "server lib";
  if (node.startsWith("@/application")) return "application service";
  if (node.startsWith("@/infrastructure")) return "infrastructure";
  if (isServerRootPath(node)) return "server";
  return "module";
}

function suggestedFixForChain(chain: string[]): string {
  const terminal = chain[chain.length - 1] ?? "";
  if (
    terminal.includes("mssql") ||
    terminal.includes("msnodesqlv8") ||
    terminal.includes("/sql/") ||
    terminal.includes("/di.ts") ||
    terminal.startsWith("src/infrastructure/")
  ) {
    return "Expose this through an API route; keep SQL/DI on the server. Client should use @/lib/client fetch helpers.";
  }
  if (terminal.startsWith("src/application/") || chain.some((n) => n.startsWith("src/application/"))) {
    return "Split browser-safe helpers into src/lib/shared/. Keep orchestration in application and call it from an API route.";
  }
  return "Move the browser-safe helper into src/lib/shared/ (or src/lib/client/), or call an API route instead of importing server code.";
}

type ModuleInfo = {
  rel: string;
  content: string;
  imports: ExtractedImport[];
  isClient: boolean;
  isShared: boolean;
  isDomain: boolean;
};

/**
 * Level 2 — classify server-only modules and find client reachability chains.
 */
export function findReachabilityViolations(
  modules: Map<string, ModuleInfo>
): ArchitectureViolation[] {
  const knownFiles = new Set(modules.keys());
  const serverOnly = new Set<string>();

  // Seed classification
  for (const [rel, mod] of modules) {
    if (isServerRootPath(rel)) serverOnly.add(rel);
    if (mod.content.includes('import "server-only"') || mod.content.includes("import 'server-only'")) {
      serverOnly.add(rel);
    }
    for (const edge of mod.imports) {
      if (edge.isTypeOnly) continue;
      if (isServerPackageSpec(edge.spec)) {
        serverOnly.add(rel);
        break;
      }
      if (
        /^@\/application(\/|$)/.test(edge.spec) ||
        /^@\/infrastructure(\/|$)/.test(edge.spec) ||
        /^@\/lib\/server(\/|$)/.test(edge.spec) ||
        /^@\/lib\/security(\/|$)/.test(edge.spec)
      ) {
        serverOnly.add(rel);
        break;
      }
    }
  }

  // Fixed-point: value-import of server-only → server-only
  let changed = true;
  while (changed) {
    changed = false;
    for (const [rel, mod] of modules) {
      if (serverOnly.has(rel)) continue;
      for (const edge of mod.imports) {
        if (edge.isTypeOnly) continue;
        const resolved = resolveImportSpec(rel, edge.spec, knownFiles);
        if (!resolved) continue;
        if (isServerPackageSpec(edge.spec) || serverOnly.has(resolved)) {
          serverOnly.add(rel);
          changed = true;
          break;
        }
      }
    }
  }

  const violations: ArchitectureViolation[] = [];

  for (const [rel, mod] of modules) {
    if (!mod.isClient) continue;

    // BFS for shortest path to any server-only node or server package
    const parent = new Map<string, string | null>();
    const viaSpec = new Map<string, string>();
    const queue: string[] = [rel];
    parent.set(rel, null);
    let hit: string | null = null;

    while (queue.length > 0 && !hit) {
      const cur = queue.shift()!;
      const curMod = modules.get(cur);
      if (!curMod) continue;

      for (const edge of curMod.imports) {
        if (edge.isTypeOnly) continue;
        const resolved = resolveImportSpec(cur, edge.spec, knownFiles);
        if (!resolved) continue;

        const isPkg = !resolved.startsWith("src/");
        const targetIsServer =
          isServerPackageSpec(edge.spec) ||
          (isPkg ? false : serverOnly.has(resolved)) ||
          (isPkg && isServerPackageSpec(resolved));

        if (!parent.has(resolved)) {
          parent.set(resolved, cur);
          viaSpec.set(resolved, edge.spec);
          if (targetIsServer || (resolved.startsWith("src/") && serverOnly.has(resolved))) {
            hit = resolved;
            break;
          }
          if (resolved.startsWith("src/") && modules.has(resolved)) {
            queue.push(resolved);
          } else if (isServerPackageSpec(edge.spec)) {
            hit = resolved;
            break;
          }
        }
      }
    }

    // Also: if the client module itself was classified server-only via a seed import
    if (!hit && serverOnly.has(rel) && rel !== hit) {
      // Find which direct import caused it
      for (const edge of mod.imports) {
        if (edge.isTypeOnly) continue;
        if (
          matchesForbidden(edge.spec, CLIENT_FORBIDDEN_IMPORT_PATTERNS) ||
          isServerPackageSpec(edge.spec)
        ) {
          hit = edge.spec.startsWith("@/")
            ? resolveImportSpec(rel, edge.spec, knownFiles) ?? edge.spec
            : edge.spec;
          parent.set(hit, rel);
          viaSpec.set(hit, edge.spec);
          break;
        }
        const resolved = resolveImportSpec(rel, edge.spec, knownFiles);
        if (resolved && serverOnly.has(resolved)) {
          hit = resolved;
          parent.set(hit, rel);
          viaSpec.set(hit, edge.spec);
          break;
        }
      }
    }

    if (!hit) continue;

    // Reconstruct chain
    const chain: string[] = [];
    let walk: string | null = hit;
    while (walk) {
      chain.unshift(walk);
      walk = parent.get(walk) ?? null;
      if (walk === rel) {
        chain.unshift(rel);
        break;
      }
      if (chain.length > 50) break;
    }
    if (chain[0] !== rel) chain.unshift(rel);

    const importPath = viaSpec.get(hit) ?? hit;
    violations.push({
      file: rel,
      importPath,
      rule: "browser-reachability (server-only reachable)",
      chain,
      classification: chain.map(classifyNode),
      suggestedFix: suggestedFixForChain(chain),
    });
  }

  // Domain purity: domain must not value-import application / infrastructure / react / next
  const DOMAIN_FORBIDDEN = [
    /^@\/application(\/|$)/,
    /^@\/infrastructure(\/|$)/,
    /^react(\/|$)/,
    /^react-dom(\/|$)/,
    /^next(\/|$)/,
  ];
  for (const [rel, mod] of modules) {
    if (!mod.isDomain) continue;
    for (const edge of mod.imports) {
      if (edge.isTypeOnly) continue;
      for (const re of DOMAIN_FORBIDDEN) {
        if (re.test(edge.spec)) {
          violations.push({
            file: rel,
            importPath: edge.spec,
            rule: "domain-purity",
            chain: [rel, edge.spec],
            classification: ["domain", "forbidden dependency"],
            suggestedFix:
              "Domain must stay pure (no Application, Infrastructure, React, or Next.js). Keep framework code in presentation or application.",
          });
        }
      }
    }
  }

  return violations;
}

export function runArchitectureGuard(
  input: ArchitectureGuardInput,
  readFile: (absPath: string) => string,
  listFiles: () => string[]
): ArchitectureViolation[] {
  const files =
    input.files?.map(norm) ??
    listFiles().map((f) => norm(f.replace(/\\/g, "/")));

  const modules = new Map<string, ModuleInfo>();
  const violations: ArchitectureViolation[] = [];

  for (const rel of files) {
    if (!rel.endsWith(".ts") && !rel.endsWith(".tsx")) continue;
    if (!rel.startsWith("src/")) continue;

    // Prefer forward slashes so tests and Unix CI match; Node fs accepts both on Windows.
    const abs = `${input.rootDir.replace(/\\/g, "/")}/${rel}`;
    let content: string;
    try {
      content = readFile(abs);
    } catch {
      // Windows callers may pass backslash paths
      try {
        content = readFile(abs.replace(/\//g, "\\"));
      } catch {
        continue;
      }
    }

    const imports = extractImports(content);
    modules.set(rel, {
      rel,
      content,
      imports,
      isClient: isClientModule(content, rel),
      isShared: isSharedModule(rel),
      isDomain: isDomainModule(rel),
    });
  }

  // Level 1 — direct forbidden imports (client + shared)
  for (const [rel, mod] of modules) {
    for (const edge of mod.imports) {
      // Type-only imports of forbidden paths still discouraged for application/infrastructure
      // but allowed for domain via Level 2; Level 1 skips type-only for path bans except packages.
      if (edge.isTypeOnly) {
        if (
          /^mssql(\/|$)/.test(edge.spec) ||
          /^msnodesqlv8$/.test(edge.spec) ||
          /^node:/.test(edge.spec)
        ) {
          violations.push({
            file: rel,
            importPath: edge.spec,
            rule: "client-forbidden-type (native/node)",
            suggestedFix:
              "Do not reference SQL or Node packages from browser modules, even as types.",
          });
        }
        continue;
      }

      if (mod.isClient) {
        const hit = matchesForbidden(edge.spec, CLIENT_FORBIDDEN_IMPORT_PATTERNS);
        if (hit) {
          violations.push({
            file: rel,
            importPath: edge.spec,
            rule: `client-forbidden (${hit})`,
            chain: [rel, edge.spec],
            classification: [classifyNode(rel), classifyNode(edge.spec)],
            suggestedFix: suggestedFixForChain([rel, edge.spec]),
          });
        }
      }
      if (mod.isShared) {
        const hit = matchesForbidden(edge.spec, LIB_SHARED_FORBIDDEN);
        if (hit) {
          violations.push({
            file: rel,
            importPath: edge.spec,
            rule: `shared-forbidden (${hit})`,
            chain: [rel, edge.spec],
            suggestedFix:
              "lib/shared must stay pure — move server logic to application/infrastructure and call via API.",
          });
        }
      }
    }
  }

  // Level 2 — transitive reachability (includes domain purity)
  const reachability = findReachabilityViolations(modules);

  // Deduplicate: prefer richer chain violations over simple Level 1 for same file+import
  const seen = new Set(
    violations.map((v) => `${v.file}::${v.importPath}::${v.rule}`)
  );
  for (const v of reachability) {
    const key = `${v.file}::${v.importPath}::${v.rule}`;
    // Skip if Level 1 already covered same direct edge with client-forbidden
    const level1Key = `${v.file}::${v.importPath}`;
    const alreadyDirect = violations.some(
      (x) =>
        x.file === v.file &&
        x.importPath === v.importPath &&
        x.rule.startsWith("client-forbidden")
    );
    if (alreadyDirect && v.rule.startsWith("browser-reachability")) {
      // Upgrade the Level 1 entry with the chain if we have a longer path
      if (v.chain && v.chain.length > 2) {
        const idx = violations.findIndex(
          (x) =>
            x.file === v.file &&
            x.importPath === v.importPath &&
            x.rule.startsWith("client-forbidden")
        );
        if (idx >= 0) {
          violations[idx] = {
            ...violations[idx]!,
            chain: v.chain,
            classification: v.classification,
            suggestedFix: v.suggestedFix,
            rule: v.rule,
          };
        }
      }
      continue;
    }
    if (!seen.has(key)) {
      seen.add(key);
      violations.push(v);
    }
  }

  return violations;
}

/** Format a violation for CLI / CI logs. */
export function formatViolation(v: ArchitectureViolation): string {
  const lines: string[] = [];
  lines.push("BROWSER SAFETY VIOLATION");
  lines.push("");
  lines.push(`Client / module: ${v.file}`);
  lines.push(`Import: ${v.importPath}`);
  lines.push(`Rule: ${v.rule}`);
  if (v.chain && v.chain.length > 0) {
    lines.push("");
    lines.push("Import chain");
    lines.push("");
    for (let i = 0; i < v.chain.length; i++) {
      const node = v.chain[i]!;
      const label = v.classification?.[i];
      const annotated = label ? `${node}  (${label})` : node;
      if (i === 0) {
        lines.push(annotated);
      } else {
        lines.push("  ↓");
        lines.push(annotated);
      }
    }
  }
  if (v.suggestedFix) {
    lines.push("");
    lines.push("Suggested fix");
    lines.push(v.suggestedFix);
  }
  return lines.join("\n");
}
