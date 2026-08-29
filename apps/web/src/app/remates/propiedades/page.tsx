import { NoticeCategory } from '@informes/shared';
import { listPropertyAuctions } from '@/lib/api';
import type { PropertyAuctionItem } from '@/lib/types';
import { PageHeader } from '@/components/PageHeader';
import { FilterBar } from '@/components/FilterBar';
import { DataTable, type Column } from '@/components/DataTable';
import { Pagination } from '@/components/Pagination';
import { ErrorState } from '@/components/ErrorState';
import { CategoryBadge } from '@/components/CategoryBadge';
import { formatCurrency, formatNumber, formatDate } from '@/lib/format';
import { REMATE_NUMBER_LABELS } from '@/lib/labels';
import { str, num, pageNum, type RawSearchParams } from '@/lib/searchParams';

export const dynamic = 'force-dynamic';

const FILTER_FIELDS = [
  { name: 'provincia', label: 'Provincia', placeholder: 'San José' },
  { name: 'canton', label: 'Cantón', placeholder: 'Escazú' },
  { name: 'distrito', label: 'Distrito', placeholder: 'San Rafael' },
  { name: 'priceMin', label: 'Precio mínimo (₡)', type: 'number' as const },
  { name: 'priceMax', label: 'Precio máximo (₡)', type: 'number' as const },
  { name: 'areaMin', label: 'Área mínima (m²)', type: 'number' as const },
  { name: 'areaMax', label: 'Área máxima (m²)', type: 'number' as const },
];

const columns: Column<PropertyAuctionItem>[] = [
  {
    key: 'ubicacion',
    header: 'Ubicación',
    render: (r) => (
      <div>
        <p className="font-medium text-slate-800">
          {[r.provincia, r.canton, r.distrito].filter(Boolean).join(', ') || '—'}
        </p>
        {r.propertyType && (
          <p className="text-xs text-slate-500">{r.propertyType}</p>
        )}
      </div>
    ),
  },
  {
    key: 'matricula',
    header: 'Matrícula',
    render: (r) => r.matricula ?? '—',
  },
  {
    key: 'area',
    header: 'Área',
    render: (r) => formatNumber(r.areaM2, 'm²'),
  },
  {
    key: 'precio',
    header: 'Precio base',
    render: (r) => (
      <span className="font-medium text-slate-800">
        {formatCurrency(r.basePrice, r.currency)}
      </span>
    ),
  },
  {
    key: 'remate',
    header: 'Remate',
    render: (r) => (
      <div>
        <p>{r.remateNumber ? REMATE_NUMBER_LABELS[r.remateNumber] : '—'}</p>
        <p className="text-xs text-slate-500">{formatDate(r.remateDate)}</p>
      </div>
    ),
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
];

export default async function PropiedadesPage({
  searchParams,
}: {
  searchParams: RawSearchParams;
}) {
  const filters = {
    provincia: str(searchParams, 'provincia'),
    canton: str(searchParams, 'canton'),
    distrito: str(searchParams, 'distrito'),
    priceMin: num(searchParams, 'priceMin'),
    priceMax: num(searchParams, 'priceMax'),
    areaMin: num(searchParams, 'areaMin'),
    areaMax: num(searchParams, 'areaMax'),
    page: pageNum(searchParams),
  };

  let result: Awaited<ReturnType<typeof listPropertyAuctions>> | null = null;
  let failed = false;
  try {
    result = await listPropertyAuctions(filters);
  } catch {
    failed = true;
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <CategoryBadge category={NoticeCategory.PROPERTY_AUCTION} />
      </div>
      <PageHeader
        title="Remates de Propiedades"
        description="Casas, fincas, lotes y edificios en remate judicial. Filtra por ubicación, precio y área."
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
            emptyMessage="No hay remates de propiedades que coincidan con los filtros."
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
