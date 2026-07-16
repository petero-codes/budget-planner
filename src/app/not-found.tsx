export const dynamic = "force-dynamic";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[50vh] max-w-lg flex-col justify-center gap-3 p-6">
      <h1 className="text-xl font-semibold text-kengen-navy">Page not found</h1>
      <p className="text-body text-neutral-700">
        The page you requested does not exist or is no longer available.
      </p>
      <a href="/login" className="text-kengen-navy underline">
        Return to sign in
      </a>
    </main>
  );
}
