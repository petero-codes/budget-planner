export function EmptyState({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="rounded border border-dashed border-neutral-400/40 bg-white px-4 py-10 text-center">
      <p className="text-sm font-medium text-kengen-navy">{title}</p>
      {description ? (
        <p className="mt-1 text-meta text-neutral-700">{description}</p>
      ) : null}
    </div>
  );
}
