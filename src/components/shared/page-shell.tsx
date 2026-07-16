import { cn } from "@/lib/utils";

/** Full-height page column so content / empty states use the viewport. */
export function PageShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-h-full flex-1 flex-col", className)}>
      {children}
    </div>
  );
}
