import { NoticeCategory } from '@informes/shared';
import { listDissolutions } from '@/lib/api';
import type { DissolutionItem } from '@/lib/types';
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
  { name: 'cedulaJuridica', label: 'Cédula jurídica', placeholder: '3-101-123456' },
  { name: 'name', label: 'Nombre', placeholder: 'Inversiones ACME S.A.' },
];

const columns: Column<DissolutionItem>[] = [
  {
    key: 'nombre',
    header: 'Sociedad',
    render: (r) => (
      <span className="font-medium text-slate-800">{r.companyName}</span>
    ),
  },
  {
    key: 'cedula',
    header: 'Cédula jurídica',
    render: (r) => r.cedulaJuridica ?? '—',
  },
  {
    key: 'tipo',
    header: 'Tipo de disolución',
    render: (r) => r.dissolutionType ?? '—',
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

export default async function SociedadesPage({
  searchParams,
}: {
  searchParams: RawSearchParams;
}) {
  const filters = {
    cedulaJuridica: str(searchParams, 'cedulaJuridica'),
    name: str(searchParams, 'name'),
    page: pageNum(searchParams),
  };

  let result: Awaited<ReturnType<typeof listDissolutions>> | null = null;
  let failed = false;
  try {
    result = await listDissolutions(filters);
  } catch {
    failed = true;
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <CategoryBadge category={NoticeCategory.DISSOLVED_COMPANY} />
      </div>
      <PageHeader
        title="Sociedades Disueltas"
        description="Sociedades disueltas publicadas en el Boletín Judicial. Busca por cédula jurídica o nombre."
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
            emptyMessage="No hay sociedades disueltas que coincidan con la búsqueda."
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
