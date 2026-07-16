"use client";

import { useEffect } from "react";
import { Home, RotateCcw } from "lucide-react";
import { ActionLink, Button } from "@/components/ui/button";

export default function GlobalError({
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
    <main className="mx-auto flex min-h-[50vh] max-w-lg flex-col justify-center gap-3 p-6">
      <h1 className="text-xl font-semibold text-kengen-navy">Something went wrong</h1>
      <p className="text-body text-neutral-700">An unexpected error occurred.</p>
      {error.digest ? (
        <p className="text-meta text-neutral-500">Reference: {error.digest}</p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="primary" icon={RotateCcw} onClick={() => reset()}>
          Try again
        </Button>
        <ActionLink href="/home" variant="secondary" icon={Home} size="default">
          Go home
        </ActionLink>
      </div>
    </main>
  );
}
