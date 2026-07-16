import Link from "next/link";

/**
 * Shared chrome for authentication screens: navy backdrop, glass card,
 * KenGen mark — mirrors the portal's glassmorphism design language.
 */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#001a33] px-4 py-8">
      <div className="relative z-10 w-full max-w-sm rounded-2xl border border-white/40 bg-white/80 p-6 shadow-[0_20px_50px_rgba(0,56,101,0.25)] backdrop-blur-xl">
        <div className="mb-4 text-center">
          <Link
            href="/login"
            className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded bg-kengen-green text-sm font-bold text-white"
            aria-label="KenGen ICT Budgeting Portal"
          >
            KG
          </Link>
          <h1 className="text-base font-semibold text-kengen-navy">{title}</h1>
          {subtitle ? (
            <p className="mt-0.5 text-meta text-neutral-700">{subtitle}</p>
          ) : null}
        </div>
        {children}
      </div>
      {footer ? (
        <div className="relative z-10 mt-4 text-center text-meta text-white/70">
          {footer}
        </div>
      ) : null}
    </div>
  );
}
