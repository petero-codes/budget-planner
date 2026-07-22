/**
 * Docs Guard CLI — git/CI plumbing around the pure rule engine (rules.ts).
 *
 * Usage:
 *   npx tsx scripts/docs-guard/cli.ts [--base <ref>] [--head <ref>]
 *
 * In GitHub Actions, base/head default to the PR refs via env:
 *   DOCS_GUARD_BASE (e.g. origin/develop) and DOCS_GUARD_HEAD (e.g. HEAD).
 * Exemption markers are read from DOCS_GUARD_MARKER_TEXT (PR title + body,
 * provided by the workflow) plus the commit messages in the range.
 *
 * Exit codes: 0 = pass, 1 = violations, 2 = usage/git error.
 */
import { execFileSync } from "child_process";
import { runDocsGuard } from "./rules";

function git(...args: string[]): string {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function main(): number {
  const base =
    argValue("--base") ?? process.env.DOCS_GUARD_BASE ?? "origin/develop";
  const head = argValue("--head") ?? process.env.DOCS_GUARD_HEAD ?? "HEAD";

  let mergeBase: string;
  try {
    mergeBase = git("merge-base", base, head);
  } catch {
    console.error(`docs-guard: cannot resolve merge-base of ${base}..${head}.`);
    return 2;
  }

  const changedFiles = git("diff", "--name-only", `${mergeBase}..${head}`)
    .split("\n")
    .filter(Boolean);

  const commitMessages = git("log", "--format=%s%n%b", `${mergeBase}..${head}`);
  const markerText =
    (process.env.DOCS_GUARD_MARKER_TEXT ?? "") + "\n" + commitMessages;

  let branchName = process.env.DOCS_GUARD_BRANCH;
  if (!branchName) {
    try {
      branchName = git("rev-parse", "--abbrev-ref", "HEAD");
    } catch {
      branchName = undefined;
    }
  }

  const violations = runDocsGuard({ changedFiles, markerText, branchName });

  console.log(`docs-guard: ${changedFiles.length} changed file(s) vs ${base}.`);
  if (violations.length === 0) {
    console.log("docs-guard: PASS — documentation obligations satisfied.");
    return 0;
  }

  console.error(`docs-guard: FAIL — ${violations.length} violation(s):\n`);
  for (const v of violations) {
    console.error(`  [${v.rule}] ${v.message}`);
    console.error(
      `     → Fix: update the named doc(s), or add "${v.waiver}" to the PR title/body/commit message if genuinely exempt.\n`
    );
  }
  console.error(
    "Policy: docs/ENGINEERING_GOVERNANCE.md → 'Documentation-update matrix'. Waivers are audited in review."
  );
  return 1;
}

process.exit(main());
