/** Clientes AWS reutilizables (se cachean entre invocaciones en Lambda). */
import { S3Client } from '@aws-sdk/client-s3';
import { SQSClient } from '@aws-sdk/client-sqs';
import { SESClient } from '@aws-sdk/client-ses';
import { SNSClient } from '@aws-sdk/client-sns';
import { TextractClient } from '@aws-sdk/client-textract';
import { config } from './config.js';

const region = config.awsRegion;

export const s3 = new S3Client({ region });
export const sqs = new SQSClient({ region });
export const ses = new SESClient({ region });
export const sns = new SNSClient({ region });
export const textract = new TextractClient({ region });
