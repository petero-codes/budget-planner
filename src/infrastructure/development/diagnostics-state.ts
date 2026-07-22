/** In-process last diagnostics run (development toolkit only). */

import "server-only";

let lastDiagnosticsAt: string | null = null;

export function recordDiagnosticsRun(iso: string): void {
  lastDiagnosticsAt = iso;
}

export function getLastDiagnosticsRun(): string | null {
  return lastDiagnosticsAt;
}
