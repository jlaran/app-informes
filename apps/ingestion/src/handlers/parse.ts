import type { SQSEvent, SQSBatchResponse, SQSBatchItemFailure } from 'aws-lambda';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { SendMessageCommand } from '@aws-sdk/client-sqs';
import { prisma } from '@informes/db';
import { s3, sqs } from '../aws.js';
import { config } from '../config.js';
import { extractText } from '../pdf/extract-text.js';
import { htmlToText } from '../parser/html-to-text.js';
import { parseBoletin } from '../parser/index.js';

/**
 * Handler de parsing (disparado por la cola SQS que recibe eventos S3
 * "ObjectCreated" del bucket de boletines crudos).
 *
 * Para cada boletín: descarga el PDF de S3, extrae texto, lo parsea y encola
 * los avisos nuevos en la cola de alertas. Usa respuestas parciales de lote
 * (batchItemFailures) para reintentar solo los mensajes fallidos.
 */
export async function handler(event: SQSEvent): Promise<SQSBatchResponse> {
  const batchItemFailures: SQSBatchItemFailure[] = [];

  for (const record of event.Records) {
    try {
      const key = extractS3Key(record.body);
      if (!key) continue;

      const boletin = await prisma.boletin.findFirst({
        where: { s3RawKey: key },
      });
      if (!boletin) {
        console.warn(`No hay boletín registrado para la llave S3: ${key}`);
        continue;
      }

      await prisma.boletin.update({ where: { id: boletin.id }, data: { status: 'PARSING' } });

      const obj = await s3.send(
        new GetObjectCommand({ Bucket: config.s3RawBucket, Key: key }),
      );
      const bytes = await obj.Body!.transformToByteArray();

      // Los boletines de Nexus PJ se guardan como HTML; PDF es fallback legado.
      let text: string;
      if (key.endsWith('.html')) {
        text = htmlToText(Buffer.from(bytes).toString('utf8'));
      } else {
        const extracted = await extractText(bytes);
        text = extracted.text;
        await prisma.boletin.update({
          where: { id: boletin.id },
          data: { pageCount: extracted.pageCount },
        });
      }

      const result = await parseBoletin(boletin.id, text, boletin.publishedAt);
      console.log(
        `Boletín ${boletin.numero}: ${result.created} avisos nuevos, ${result.skipped} omitidos.`,
      );

      // Encola los avisos nuevos para evaluación de alertas.
      if (result.createdNoticeIds.length > 0 && config.alertsQueueUrl) {
        await sqs.send(
          new SendMessageCommand({
            QueueUrl: config.alertsQueueUrl,
            MessageBody: JSON.stringify({ noticeIds: result.createdNoticeIds }),
          }),
        );
      }
    } catch (err) {
      console.error('Error parseando mensaje', record.messageId, err);
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }

  return { batchItemFailures };
}

/** Extrae la llave del objeto desde un evento S3 (envuelto en el body de SQS). */
function extractS3Key(body: string): string | null {
  try {
    const parsed = JSON.parse(body);
    const rec = parsed.Records?.[0];
    const key = rec?.s3?.object?.key;
    return key ? decodeURIComponent(String(key).replace(/\+/g, ' ')) : null;
  } catch {
    return null;
  }
}
