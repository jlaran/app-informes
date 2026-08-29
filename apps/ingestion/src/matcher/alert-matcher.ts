import { NoticeCategory } from '@informes/shared';
import { prisma } from '@informes/db';
import { evaluate } from './match-rules.js';

/**
 * Evalúa un conjunto de avisos nuevos contra las alertas activas y crea las
 * coincidencias (AlertMatch) en estado PENDING. Devuelve los IDs de las
 * coincidencias creadas para encolar su notificación.
 *
 * ⚠️ RLS: este job es de servicio y debe leer alertas de TODOS los tenants.
 * Debe ejecutarse con un rol de BD dedicado con BYPASSRLS (informes_matcher),
 * NO con el rol de la API. Ver packages/db/prisma/rls.sql.
 *
 * TODO(trgm): para nombres, delegar el filtrado de candidatos a PostgreSQL con
 * pg_trgm (similarity/%) en lugar de traer todas las alertas a memoria.
 */
export async function matchNotices(noticeIds: string[]): Promise<string[]> {
  if (noticeIds.length === 0) return [];

  const notices = await prisma.notice.findMany({
    where: { id: { in: noticeIds } },
    include: {
      propertyAuction: true,
      vehicleAuction: true,
      deceasedPerson: true,
      dissolvedCompany: true,
    },
  });

  const createdMatchIds: string[] = [];

  // Agrupamos por categoría para cargar solo las alertas relevantes.
  const byCategory = new Map<NoticeCategory, typeof notices>();
  for (const n of notices) {
    const arr = byCategory.get(n.category) ?? [];
    arr.push(n);
    byCategory.set(n.category, arr);
  }

  for (const [category, categoryNotices] of byCategory) {
    const alerts = await prisma.alert.findMany({
      where: { category, isActive: true },
      select: { id: true, tenantId: true, criteria: true, category: true },
    });
    if (alerts.length === 0) continue;

    for (const notice of categoryNotices) {
      const row = detailRow(notice);
      if (!row) continue;

      for (const alert of alerts) {
        if (!evaluate(category, alert.criteria, row)) continue;

        // upsert evita duplicar coincidencias (unique alertId+noticeId).
        const match = await prisma.alertMatch.upsert({
          where: { alertId_noticeId: { alertId: alert.id, noticeId: notice.id } },
          update: {},
          create: {
            tenantId: alert.tenantId,
            alertId: alert.id,
            noticeId: notice.id,
            status: 'PENDING',
          },
          select: { id: true, matchedAt: true, status: true },
        });
        // Solo notificamos las recién creadas (status PENDING sin notificar).
        if (match.status === 'PENDING') createdMatchIds.push(match.id);
      }
    }
  }

  return createdMatchIds;
}

/** Aplana el detalle 1:1 del aviso a la forma que esperan las reglas. */
function detailRow(notice: {
  category: NoticeCategory;
  propertyAuction: { provincia: string | null; canton: string | null; distrito: string | null; basePrice: bigint | null; currency: string; areaM2: unknown | null } | null;
  vehicleAuction: { brand: string | null; year: number | null; basePrice: bigint | null; currency: string } | null;
  deceasedPerson: { fullNameNorm: string; cedulaNorm: string | null } | null;
  dissolvedCompany: { companyNameNorm: string; cedulaJuridicaNorm: string | null } | null;
}) {
  switch (notice.category) {
    case NoticeCategory.PROPERTY_AUCTION:
      return notice.propertyAuction
        ? {
            provincia: notice.propertyAuction.provincia,
            canton: notice.propertyAuction.canton,
            distrito: notice.propertyAuction.distrito,
            basePrice: notice.propertyAuction.basePrice,
            currency: notice.propertyAuction.currency as never,
            areaM2:
              notice.propertyAuction.areaM2 == null
                ? null
                : Number(notice.propertyAuction.areaM2),
          }
        : null;
    case NoticeCategory.VEHICLE_AUCTION:
      return notice.vehicleAuction
        ? {
            brand: notice.vehicleAuction.brand,
            year: notice.vehicleAuction.year,
            basePrice: notice.vehicleAuction.basePrice,
            currency: notice.vehicleAuction.currency as never,
          }
        : null;
    case NoticeCategory.DECEASED:
      return notice.deceasedPerson
        ? {
            fullNameNorm: notice.deceasedPerson.fullNameNorm,
            cedulaNorm: notice.deceasedPerson.cedulaNorm,
          }
        : null;
    case NoticeCategory.DISSOLVED_COMPANY:
      return notice.dissolvedCompany
        ? {
            companyNameNorm: notice.dissolvedCompany.companyNameNorm,
            cedulaJuridicaNorm: notice.dissolvedCompany.cedulaJuridicaNorm,
          }
        : null;
    default:
      return null;
  }
}
