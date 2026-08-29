import { createHash } from 'node:crypto';
import { NoticeCategory, normalizeText } from '@informes/shared';
import { prisma } from '@informes/db';
import { segmentNotices } from './segment.js';
import { classify } from './classifier.js';
import {
  extractProperty,
  extractVehicle,
  extractDeceased,
  extractDissolved,
} from './extractors.js';

export interface ParseResult {
  created: number;
  skipped: number;
  createdNoticeIds: string[];
}

function contentHash(boletinId: string, expediente: string | undefined, text: string): string {
  return createHash('sha256')
    .update([boletinId, expediente ?? '', normalizeText(text)].join('|'))
    .digest('hex');
}

/**
 * Parsea el texto completo de un boletín ya descargado: segmenta en avisos,
 * clasifica, extrae campos y hace upsert idempotente. Devuelve los IDs de los
 * avisos NUEVOS (para encolar la evaluación de alertas).
 */
export async function parseBoletin(
  boletinId: string,
  fullText: string,
  publishedAt: Date,
): Promise<ParseResult> {
  const raw = segmentNotices(fullText);
  const result: ParseResult = { created: 0, skipped: 0, createdNoticeIds: [] };

  for (const item of raw) {
    const category = classify(item.text);
    if (!category) {
      result.skipped++;
      continue;
    }

    const hash = contentHash(boletinId, item.expediente, item.text);

    // Idempotencia: si ya existe el aviso, no lo reprocesamos.
    const existing = await prisma.notice.findUnique({
      where: { contentHash: hash },
      select: { id: true },
    });
    if (existing) {
      result.skipped++;
      continue;
    }

    const detail = buildDetail(category, item.text);
    if (!detail) {
      // No se pudo extraer lo mínimo para la categoría: se omite.
      result.skipped++;
      continue;
    }

    const notice = await prisma.notice.create({
      data: {
        boletinId,
        category,
        expediente: item.expediente,
        page: item.page,
        publishedAt,
        rawText: item.text,
        contentHash: hash,
        ...detail,
      },
      select: { id: true },
    });

    result.created++;
    result.createdNoticeIds.push(notice.id);
  }

  await prisma.boletin.update({
    where: { id: boletinId },
    data: { status: 'PARSED', parsedAt: new Date() },
  });

  return result;
}

/** Construye el `create` anidado de la tabla de detalle según la categoría. */
function buildDetail(category: NoticeCategory, text: string) {
  switch (category) {
    case NoticeCategory.PROPERTY_AUCTION:
      return { propertyAuction: { create: extractProperty(text) } };
    case NoticeCategory.VEHICLE_AUCTION:
      return { vehicleAuction: { create: extractVehicle(text) } };
    case NoticeCategory.DECEASED: {
      const d = extractDeceased(text);
      return d ? { deceasedPerson: { create: d } } : null;
    }
    case NoticeCategory.DISSOLVED_COMPANY: {
      const d = extractDissolved(text);
      return d ? { dissolvedCompany: { create: d } } : null;
    }
    default: {
      const _exhaustive: never = category;
      throw new Error(`Categoría no soportada: ${_exhaustive as string}`);
    }
  }
}
