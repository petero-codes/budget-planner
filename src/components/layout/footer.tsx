"use client";

import { useState } from "react";
import { MessageSquareWarning } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ReportIssueModal,
  type ReportIssueContext,
} from "@/components/support/report-issue-modal";

type Props = {
  context?: ReportIssueContext;
};

/**
 * Portal footer — Report Issue opens the in-app support ticket modal.
 */
export function Footer({ context }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-neutral-400/30 bg-white px-4 py-2 text-meta text-neutral-700">
      <span>© KenGen · ICT Budgeting Portal</span>
      <Button
        type="button"
        variant="secondary"
        size="compact"
        icon={MessageSquareWarning}
        aria-label="Report an issue"
        onClick={() => setOpen(true)}
      >
        Report an issue
      </Button>
      <ReportIssueModal
        open={open}
        onClose={() => setOpen(false)}
        context={context}
      />
    </footer>
  );
}
