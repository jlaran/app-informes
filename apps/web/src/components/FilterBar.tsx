'use client';

import { useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

export interface FilterField {
  name: string;
  label: string;
  type?: 'text' | 'number';
  placeholder?: string;
}

interface FilterBarProps {
  fields: FilterField[];
}

/**
 * Barra de filtros genérica. Sincroniza el estado con la URL (?param=valor)
 * para que la página (Server Component) pueda hacer el fetch en el servidor
 * a partir de `searchParams`. Al aplicar, reinicia la paginación a la página 1.
 */
export function FilterBar({ fields }: FilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const initial = Object.fromEntries(
    fields.map((f) => [f.name, searchParams.get(f.name) ?? '']),
  );
  const [values, setValues] = useState<Record<string, string>>(initial);

  function apply(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    for (const field of fields) {
      const value = values[field.name]?.trim();
      if (value) params.set(field.name, value);
    }
    // Nueva búsqueda ⇒ volver a la primera página.
    router.push(params.toString() ? `${pathname}?${params.toString()}` : pathname);
  }

  function clear() {
    setValues(Object.fromEntries(fields.map((f) => [f.name, ''])));
    router.push(pathname);
  }

  const hasActiveFilters = fields.some((f) => searchParams.get(f.name));

  return (
    <form
      onSubmit={apply}
      className="mb-6 rounded-xl border border-slate-200 bg-white p-4"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {fields.map((field) => (
          <label key={field.name} className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-slate-600">
              {field.label}
            </span>
            <input
              type={field.type ?? 'text'}
              inputMode={field.type === 'number' ? 'numeric' : undefined}
              placeholder={field.placeholder}
              value={values[field.name] ?? ''}
              onChange={(e) =>
                setValues((prev) => ({ ...prev, [field.name]: e.target.value }))
              }
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </label>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-2">
        <button
          type="submit"
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Aplicar filtros
        </button>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={clear}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Limpiar
          </button>
        )}
      </div>
    </form>
  );
}
