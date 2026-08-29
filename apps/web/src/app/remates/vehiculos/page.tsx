import { NoticeCategory } from '@informes/shared';
import { listVehicleAuctions } from '@/lib/api';
import type { VehicleAuctionItem } from '@/lib/types';
import { PageHeader } from '@/components/PageHeader';
import { FilterBar } from '@/components/FilterBar';
import { DataTable, type Column } from '@/components/DataTable';
import { Pagination } from '@/components/Pagination';
import { ErrorState } from '@/components/ErrorState';
import { CategoryBadge } from '@/components/CategoryBadge';
import { formatCurrency, formatDate } from '@/lib/format';
import { REMATE_NUMBER_LABELS } from '@/lib/labels';
import { str, num, pageNum, type RawSearchParams } from '@/lib/searchParams';

export const dynamic = 'force-dynamic';

const FILTER_FIELDS = [
  { name: 'brand', label: 'Marca', placeholder: 'Toyota' },
  { name: 'yearMin', label: 'Año mínimo', type: 'number' as const, placeholder: '2015' },
  { name: 'priceMin', label: 'Precio mínimo (₡)', type: 'number' as const },
  { name: 'priceMax', label: 'Precio máximo (₡)', type: 'number' as const },
];

const columns: Column<VehicleAuctionItem>[] = [
  {
    key: 'vehiculo',
    header: 'Vehículo',
    render: (r) => (
      <div>
        <p className="font-medium text-slate-800">
          {[r.brand, r.model].filter(Boolean).join(' ') || '—'}
        </p>
        {r.placa && <p className="text-xs text-slate-500">Placa {r.placa}</p>}
      </div>
    ),
  },
  {
    key: 'anio',
    header: 'Año',
    render: (r) => r.year ?? '—',
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

export default async function VehiculosPage({
  searchParams,
}: {
  searchParams: RawSearchParams;
}) {
  const filters = {
    brand: str(searchParams, 'brand'),
    yearMin: num(searchParams, 'yearMin'),
    priceMin: num(searchParams, 'priceMin'),
    priceMax: num(searchParams, 'priceMax'),
    page: pageNum(searchParams),
  };

  let result: Awaited<ReturnType<typeof listVehicleAuctions>> | null = null;
  let failed = false;
  try {
    result = await listVehicleAuctions(filters);
  } catch {
    failed = true;
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <CategoryBadge category={NoticeCategory.VEHICLE_AUCTION} />
      </div>
      <PageHeader
        title="Remates de Vehículos"
        description="Vehículos en remate judicial. Filtra por marca, año mínimo y precio."
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
            emptyMessage="No hay remates de vehículos que coincidan con los filtros."
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
