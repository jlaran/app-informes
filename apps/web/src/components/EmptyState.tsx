export function EmptyState({
  title = 'Sin resultados',
  message = 'No se encontraron avisos que coincidan con los filtros aplicados.',
  icon = '🔍',
}: {
  title?: string;
  message?: string;
  icon?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
      <span className="mb-3 text-4xl" aria-hidden>
        {icon}
      </span>
      <h3 className="text-base font-semibold text-slate-700">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-slate-500">{message}</p>
    </div>
  );
}
