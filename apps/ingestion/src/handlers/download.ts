import { PutObjectCommand } from '@aws-sdk/client-s3';
import { prisma } from '@informes/db';
import { s3 } from '../aws.js';
import { config, assertConfig } from '../config.js';
import { NexusPjAdapter } from '../sources/nexus-pj.adapter.js';
import type { SourceAdapter } from '../sources/source-adapter.js';

/**
 * Handler de descarga (disparado por EventBridge, cron diario).
 * Lista ediciones nuevas de la fuente, descarga el PDF, lo sube a S3 y registra
 * el boletín. El evento de creación de objeto en S3 dispara el parsing (SQS).
 */
export async function handler(): Promise<{ downloaded: number }> {
  assertConfig(['s3RawBucket']);
  const adapter: SourceAdapter = new NexusPjAdapter();

  const since = await lastPublishedAt();
  const editions = await adapter.listEditions(since);

  let downloaded = 0;
  for (const ref of editions) {
    // Evita re-descargar ediciones ya conocidas.
    const exists = await prisma.boletin.findUnique({
      where: { numero_publishedAt: { numero: ref.numero, publishedAt: ref.publishedAt } },
      select: { id: true },
    });
    if (exists) continue;

    const boletin = await prisma.boletin.create({
      data: {
        numero: ref.numero,
        publishedAt: ref.publishedAt,
        sourceUrl: ref.sourceUrl,
        status: 'PENDING',
      },
    });

    try {
      const pdf = await adapter.downloadPdf(ref);
      const key = `raw-boletines/${ref.publishedAt.getFullYear()}/${ref.numero}.pdf`;
      await s3.send(
        new PutObjectCommand({
          Bucket: config.s3RawBucket,
          Key: key,
          Body: pdf,
          ContentType: 'application/pdf',
          Metadata: { boletinId: boletin.id, numero: ref.numero },
        }),
      );
      await prisma.boletin.update({
        where: { id: boletin.id },
        data: { status: 'DOWNLOADED', s3RawKey: key },
      });
      downloaded++;
    } catch (err) {
      await prisma.boletin.update({
        where: { id: boletin.id },
        data: { status: 'FAILED', error: err instanceof Error ? err.message : String(err) },
      });
    }
  }

  return { downloaded };
}

/** Fecha de la última edición conocida (o hace 30 días si no hay ninguna). */
async function lastPublishedAt(): Promise<Date> {
  const last = await prisma.boletin.findFirst({
    orderBy: { publishedAt: 'desc' },
    select: { publishedAt: true },
  });
  if (last) return last.publishedAt;
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d;
}
