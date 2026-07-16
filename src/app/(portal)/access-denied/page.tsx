import { Home } from "lucide-react";
import { ActionLink } from "@/components/ui/button";

export default function AccessDeniedPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div
        className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-kengen-red/10 text-kengen-red"
        aria-hidden
      >
        !
      </div>
      <h1 className="text-base font-semibold text-kengen-navy">Access Denied</h1>
      <p className="mt-1 max-w-md text-body text-neutral-700">
        You do not have permission for this page or action.
      </p>
      <ActionLink
        href="/home"
        variant="primary"
        icon={Home}
        size="default"
        className="mt-4"
      >
        Return to Home
      </ActionLink>
    </div>
  );
}
