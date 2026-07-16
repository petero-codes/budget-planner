import { cn } from "@/lib/utils";

export function EmptyState({
  title,
  description,
  fill = false,
}: {
  title: string;
  description?: string;
  /** Stretch to fill remaining page height (avoids large empty voids). */
  fill?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded border border-dashed border-neutral-400/40 bg-white px-4 text-center",
        fill
          ? "flex flex-1 flex-col items-center justify-center py-12"
          : "py-10"
      )}
    >
      <p className="text-sm font-medium text-kengen-navy">{title}</p>
      {description ? (
        <p className="mt-1 max-w-md text-meta text-neutral-700">{description}</p>
      ) : null}
    </div>
  );
}
