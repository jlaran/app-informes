export function PageHeader({
  title,
  description,
  total,
}: {
  title: string;
  description?: string;
  total?: number;
}) {
  return (
    <header className="mb-6">
      <div className="flex flex-wrap items-baseline gap-3">
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        {typeof total === 'number' && (
          <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
            {new Intl.NumberFormat('es-CR').format(total)} resultados
          </span>
        )}
      </div>
      {description && (
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      )}
    </header>
  );
}
