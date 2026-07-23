"use client";

import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from "@/lib/shared/support-contact";

/**
 * Portal footer — Need help? opens the user's mail client (MVP: no in-app tickets).
 */
export function Footer() {
  return (
    <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-neutral-400/30 bg-white px-4 py-2 text-meta text-neutral-700">
      <span>© KenGen · ICT Budgeting Portal</span>
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-neutral-600">Need help?</span>
        <Button
          type="button"
          variant="secondary"
          size="compact"
          icon={Mail}
          aria-label={`Email support at ${SUPPORT_EMAIL}`}
          onClick={() => {
            window.location.href = SUPPORT_MAILTO;
          }}
        >
          {SUPPORT_EMAIL}
        </Button>
      </div>
    </footer>
  );
}
