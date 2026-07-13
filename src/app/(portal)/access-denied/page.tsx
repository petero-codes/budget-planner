import Link from "next/link";

export default function AccessDeniedPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-kengen-red/10 text-kengen-red">
        !
      </div>
      <h1 className="text-base font-semibold text-kengen-navy">Access Denied</h1>
      <p className="mt-1 max-w-md text-body text-neutral-700">
        You don&apos;t have access to this cost center or action. The attempt has
        been recorded for audit.
      </p>
      <p className="mt-2 text-meta text-neutral-400">Ref: ACCESS-DENIED</p>
      <Link
        href="/home"
        className="mt-4 rounded bg-kengen-navy px-3 py-1.5 text-body text-white"
      >
        Return to Home
      </Link>
    </div>
  );
}
