export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="animate-pulse space-y-2 rounded border border-neutral-400/20 bg-white p-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-7 rounded bg-neutral-100" />
      ))}
    </div>
  );
}
