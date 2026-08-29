import type { SQSEvent, SQSBatchResponse, SQSBatchItemFailure } from 'aws-lambda';
import { matchNotices } from '../matcher/alert-matcher.js';
import { notifyMatches } from '../matcher/notifier.js';

/**
 * Handler de alertas (disparado por la cola SQS de alertas). Recibe lotes de
 * IDs de avisos nuevos, los evalúa contra las alertas activas y notifica las
 * coincidencias. Reintenta por mensaje con batchItemFailures.
 */
export async function handler(event: SQSEvent): Promise<SQSBatchResponse> {
  const batchItemFailures: SQSBatchItemFailure[] = [];

  for (const record of event.Records) {
    try {
      const { noticeIds } = JSON.parse(record.body) as { noticeIds: string[] };
      const matchIds = await matchNotices(noticeIds ?? []);
      await notifyMatches(matchIds);
      console.log(`Avisos: ${noticeIds?.length ?? 0} → coincidencias notificadas: ${matchIds.length}`);
    } catch (err) {
      console.error('Error evaluando alertas', record.messageId, err);
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }

  return { batchItemFailures };
}
