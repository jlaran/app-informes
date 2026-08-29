import Link from 'next/link';
import { NoticeCategory } from '@informes/shared';
import {
  listPropertyAuctions,
  listVehicleAuctions,
  listDeceased,
  listDissolutions,
} from '@/lib/api';
import { CATEGORY_LABELS, CATEGORY_HREF } from '@/lib/labels';

// Los conteos se leen en cada request (el cliente API usa cache: 'no-store').
export const dynamic = 'force-dynamic';

interface SectionSummary {
  category: NoticeCategory;
  icon: string;
  description: string;
  total: number | null;
}

async function safeTotal(p: Promise<{ total: number }>): Promise<number | null> {
  try {
    return (await p).total;
  } catch {
    // La API puede no estar disponible en desarrollo local.
    return null;
  }
}

export default async function DashboardPage() {
  const [propertyTotal, vehicleTotal, deceasedTotal, dissolutionTotal] =
    await Promise.all([
      safeTotal(listPropertyAuctions()),
      safeTotal(listVehicleAuctions()),
      safeTotal(listDeceased()),
      safeTotal(listDissolutions()),
    ]);

  const sections: SectionSummary[] = [
    {
      category: NoticeCategory.PROPERTY_AUCTION,
      icon: '🏘️',
      description: 'Casas, fincas, lotes y edificios en remate judicial.',
      total: propertyTotal,
    },
    {
      category: NoticeCategory.VEHICLE_AUCTION,
      icon: '🚗',
      description: 'Vehículos en remate judicial.',
      total: vehicleTotal,
    },
    {
      category: NoticeCategory.DECEASED,
      icon: '🕊️',
      description: 'Procesos sucesorios publicados en el boletín.',
      total: deceasedTotal,
    },
    {
      category: NoticeCategory.DISSOLVED_COMPANY,
      icon: '🏢',
      description: 'Sociedades disueltas publicadas en el boletín.',
      total: dissolutionTotal,
    },
  ];

  return (
    <div>
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Panel general</h1>
        <p className="mt-1 text-sm text-slate-500">
          Información de los Boletines Judiciales de Costa Rica, organizada en
          cuatro secciones. Busca, filtra y crea alertas.
        </p>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {sections.map((section) => (
          <Link
            key={section.category}
            href={CATEGORY_HREF[section.category]}
            className="group rounded-xl border border-slate-200 bg-white p-5 transition-shadow hover:shadow-md"
          >
            <div className="flex items-start justify-between">
              <span className="text-3xl" aria-hidden>
                {section.icon}
              </span>
              <span className="text-right">
                <span className="block text-2xl font-bold text-slate-900">
                  {section.total === null
                    ? '—'
                    : new Intl.NumberFormat('es-CR').format(section.total)}
                </span>
                <span className="text-xs text-slate-400">avisos</span>
              </span>
            </div>
            <h2 className="mt-4 text-base font-semibold text-slate-800 group-hover:text-brand-700">
              {CATEGORY_LABELS[section.category]}
            </h2>
            <p className="mt-1 text-sm text-slate-500">{section.description}</p>
            <span className="mt-3 inline-block text-sm font-medium text-brand-600">
              Ver sección →
            </span>
          </Link>
        ))}
      </section>

      <section className="mt-8 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-base font-semibold text-slate-800">Accesos rápidos</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href="/alertas"
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            🔔 Crear una alerta
          </Link>
          <Link
            href="/remates/propiedades"
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Buscar propiedades
          </Link>
          <Link
            href="/remates/vehiculos"
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Buscar vehículos
          </Link>
        </div>
      </section>
    </div>
  );
}
