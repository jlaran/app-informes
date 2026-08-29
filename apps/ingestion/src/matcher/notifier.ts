import { SendEmailCommand } from '@aws-sdk/client-ses';
import { PublishCommand } from '@aws-sdk/client-sns';
import { prisma } from '@informes/db';
import { AlertChannel } from '@informes/shared';
import { ses, sns } from '../aws.js';
import { config } from '../config.js';

/**
 * Notifica las coincidencias PENDING dadas y marca su estado (SENT/FAILED).
 * Email vía SES; push/SMS vía SNS (topic o endpoint). Idempotente por match.
 */
export async function notifyMatches(matchIds: string[]): Promise<void> {
  if (matchIds.length === 0) return;

  const matches = await prisma.alertMatch.findMany({
    where: { id: { in: matchIds }, status: 'PENDING' },
    include: {
      alert: { include: { user: true } },
      notice: true,
    },
  });

  for (const match of matches) {
    try {
      const { alert } = match;
      const subject = `Nueva coincidencia de alerta: ${alert.name}`;
      const body = renderBody(alert.name, match.notice);

      if (alert.channel === AlertChannel.EMAIL) {
        await ses.send(
          new SendEmailCommand({
            Source: config.sesFromEmail,
            Destination: { ToAddresses: [alert.user.email] },
            Message: {
              Subject: { Data: subject, Charset: 'UTF-8' },
              Body: { Text: { Data: body, Charset: 'UTF-8' } },
            },
          }),
        );
      } else {
        // PUSH / SMS a través de SNS (topic de alertas).
        await sns.send(
          new PublishCommand({
            TopicArn: config.snsAlertsTopicArn,
            Subject: subject,
            Message: body,
            MessageAttributes: {
              tenantId: { DataType: 'String', StringValue: match.tenantId },
              channel: { DataType: 'String', StringValue: alert.channel },
            },
          }),
        );
      }

      await prisma.alertMatch.update({
        where: { id: match.id },
        data: { status: 'SENT', notifiedAt: new Date() },
      });
    } catch (err) {
      await prisma.alertMatch.update({
        where: { id: match.id },
        data: { status: 'FAILED', error: err instanceof Error ? err.message : String(err) },
      });
    }
  }
}

function renderBody(alertName: string, notice: { category: string; rawText: string; expediente: string | null }): string {
  return [
    `Su alerta "${alertName}" tiene una nueva coincidencia.`,
    ``,
    `Categoría: ${notice.category}`,
    notice.expediente ? `Expediente: ${notice.expediente}` : '',
    ``,
    notice.rawText.slice(0, 800),
  ]
    .filter(Boolean)
    .join('\n');
}
