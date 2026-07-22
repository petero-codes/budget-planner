/**
 * BR-28 — post-GM success path is Finalized; Approved is legacy only.
 * Used by GET …/sap-export CSV gate.
 */
export function isSapCsvExportableStatus(status: string): boolean {
  return status === "Finalized" || status === "Approved";
}
