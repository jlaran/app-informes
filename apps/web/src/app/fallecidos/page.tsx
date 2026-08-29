import { NoticeCategory } from '@informes/shared';
import { listDeceased } from '@/lib/api';
import type { DeceasedItem } from '@/lib/types';
import { PageHeader } from '@/components/PageHeader';
import { FilterBar } from '@/components/FilterBar';
import { DataTable, type Column } from '@/components/DataTable';
import { Pagination } from '@/components/Pagination';
import { ErrorState } from '@/components/ErrorState';
import { CategoryBadge } from '@/components/CategoryBadge';
import { formatDate } from '@/lib/format';
import { str, pageNum, type RawSearchParams } from '@/lib/searchParams';

export const dynamic = 'force-dynamic';

const FILTER_FIELDS = [
  { name: 'cedula', label: 'Cédula', placeholder: '1-1234-5678' },
  { name: 'name', label: 'Nombre', placeholder: 'Juan Pérez' },
];

const columns: Column<DeceasedItem>[] = [
  {
    key: 'nombre',
    header: 'Nombre',
    render: (r) => <span className="font-medium text-slate-800">{r.fullName}</span>,
  },
  {
    key: 'cedula',
    header: 'Cédula',
    render: (r) => r.cedula ?? '—',
  },
  {
    key: 'tipo',
    header: 'Tipo de sucesorio',
    render: (r) => r.sucesorioTipo ?? '—',
  },
  {
    key: 'defuncion',
    header: 'Fecha de defunción',
    render: (r) => formatDate(r.fechaDefuncion),
  },
  {
    key: 'expediente',
    header: 'Expediente',
    render: (r) => (
      <div>
        <p>{r.expediente ?? '—'}</p>
        {r.despacho && <p className="text-xs text-slate-500">{r.despacho}</p>}
      </div>
    ),
  },
  {
    key: 'publicado',
    header: 'Publicado',
    render: (r) => formatDate(r.publishedAt),
  },
];

export default async function FallecidosPage({
  searchParams,
}: {
  searchParams: RawSearchParams;
}) {
  const filters = {
    cedula: str(searchParams, 'cedula'),
    name: str(searchParams, 'name'),
    page: pageNum(searchParams),
  };

  let result: Awaited<ReturnType<typeof listDeceased>> | null = null;
  let failed = false;
  try {
    result = await listDeceased(filters);
  } catch {
    failed = true;
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <CategoryBadge category={NoticeCategory.DECEASED} />
      </div>
      <PageHeader
        title="Personas Fallecidas"
        description="Procesos sucesorios publicados en el Boletín Judicial. Busca por cédula o nombre."
        total={result?.total}
      />

      <FilterBar fields={FILTER_FIELDS} />

      {failed || !result ? (
        <ErrorState />
      ) : (
        <>
          <DataTable
            columns={columns}
            rows={result.data}
            getRowKey={(r) => r.id}
            emptyMessage="No hay personas fallecidas que coincidan con la búsqueda."
          />
          <Pagination
            page={result.page}
            pageSize={result.pageSize}
            total={result.total}
          />
        </>
      )}
    </div>
  );
}
