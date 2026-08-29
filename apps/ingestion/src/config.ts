/** Configuración de la ingesta leída de variables de entorno. */
export const config = {
  awsRegion: process.env.AWS_REGION ?? 'us-east-1',
  s3RawBucket: process.env.S3_RAW_BOLETINES_BUCKET ?? '',
  parseQueueUrl: process.env.SQS_PARSE_QUEUE_URL ?? '',
  alertsQueueUrl: process.env.SQS_ALERTS_QUEUE_URL ?? '',
  sesFromEmail: process.env.SES_FROM_EMAIL ?? '',
  snsAlertsTopicArn: process.env.SNS_ALERTS_TOPIC_ARN ?? '',
  nexusPj: {
    baseUrl: process.env.NEXUS_PJ_BASE_URL ?? 'https://nexuspj.poder-judicial.go.cr',
    query: process.env.NEXUS_PJ_QUERY ?? 'tipoInformacion:(Boletín AND Judicial)',
  },
} as const;

export function assertConfig(keys: (keyof typeof config)[]): void {
  for (const key of keys) {
    if (!config[key]) {
      throw new Error(`Falta configuración requerida: ${String(key)}`);
    }
  }
}
