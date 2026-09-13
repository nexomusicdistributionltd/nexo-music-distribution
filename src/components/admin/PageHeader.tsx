import { AdminSearch } from "./AdminSearch";

export function PageHeader({
  title,
  description,
  actions,
  showSearch = false,
  searchQ,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  showSearch?: boolean;
  searchQ?: string;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 space-y-1">
        <h1 className="text-h2 text-[var(--nexo-text)]">{title}</h1>
        {description ? (
          <p className="max-w-2xl text-small text-[var(--nexo-text-muted)]">{description}</p>
        ) : null}
      </div>
      <div className="flex flex-col items-stretch gap-3 sm:items-end">
        {showSearch ? <AdminSearch initialQ={searchQ} /> : null}
        {actions}
      </div>
    </div>
  );
}
