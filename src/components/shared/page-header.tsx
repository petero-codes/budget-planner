export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-neutral-400/20 pb-3">
      <div>
        <h1 className="text-base font-semibold text-kengen-navy">{title}</h1>
        {description ? (
          <p className="mt-0.5 text-meta text-neutral-700">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}
