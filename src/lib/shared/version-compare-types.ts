/** API/UI shapes for budget version comparison (pure types — no application import). */

export type LineDiff = {
  glAccountId: string;
  glCode?: string;
  change: "added" | "removed" | "modified" | "unchanged";
  fromAmount?: number;
  toAmount?: number;
};

export type HeaderDiff = {
  field: string;
  from: string | null;
  to: string | null;
  changed: boolean;
};

export type AttachmentDiff = {
  categoryId: string;
  fileName: string;
  change: "added" | "removed" | "replaced" | "inherited";
};

export type VersionCompareResult = {
  fromVersionId: string;
  toVersionId: string;
  fromLabel: string | null;
  toLabel: string | null;
  headerChanges: HeaderDiff[];
  lineDiffs: LineDiff[];
  attachmentDiffs: AttachmentDiff[];
  totalFrom: number;
  totalTo: number;
  totalDelta: number;
  summary: {
    linesModified: number;
    linesAdded: number;
    linesRemoved: number;
    attachmentsAdded: number;
    attachmentsRemoved: number;
    headerFieldsChanged: number;
  };
};
