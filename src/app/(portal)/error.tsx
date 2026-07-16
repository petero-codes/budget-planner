"use client";

import { useEffect } from "react";
import { Home, RotateCcw } from "lucide-react";
import { PageShell } from "@/components/shared/page-shell";
import { ActionLink, Button } from "@/components/ui/button";

export default function PortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <PageShell>
      <h1 className="text-xl font-semibold text-kengen-navy">Something went wrong</h1>
      <p className="mt-2 text-body text-neutral-700">This page failed to load.</p>
      {error.digest ? (
        <p className="mt-1 text-meta text-neutral-500">Reference: {error.digest}</p>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" variant="primary" icon={RotateCcw} onClick={() => reset()}>
          Try again
        </Button>
        <ActionLink href="/home" variant="secondary" icon={Home} size="default">
          Go home
        </ActionLink>
      </div>
    </PageShell>
  );
}
