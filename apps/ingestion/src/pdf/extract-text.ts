import pdfParse from 'pdf-parse';
import {
  TextractClient,
  DetectDocumentTextCommand,
} from '@aws-sdk/client-textract';
import { textract } from '../aws.js';

/** Umbral de caracteres por página bajo el cual asumimos PDF escaneado. */
const MIN_CHARS_PER_PAGE = 100;

export interface ExtractedDoc {
  text: string;
  pageCount: number;
  /** true si se recurrió a OCR (Textract). */
  usedOcr: boolean;
}

/**
 * Extrae texto de un PDF. Intenta primero el texto nativo (rápido y barato);
 * si el documento parece escaneado (poco texto por página), cae a OCR con
 * AWS Textract.
 */
export async function extractText(
  pdf: Uint8Array,
  opts: { textractClient?: TextractClient } = {},
): Promise<ExtractedDoc> {
  const buffer = Buffer.from(pdf);
  const parsed = await pdfParse(buffer);
  const pageCount = parsed.numpages || 1;
  const density = parsed.text.trim().length / pageCount;

  if (density >= MIN_CHARS_PER_PAGE) {
    return { text: parsed.text, pageCount, usedOcr: false };
  }

  const ocrText = await ocrWithTextract(buffer, opts.textractClient ?? textract);
  return { text: ocrText, pageCount, usedOcr: true };
}

/**
 * OCR sincrónico de una sola página vía DetectDocumentText.
 *
 * NOTA: DetectDocumentText procesa una imagen/página. Para boletines de muchas
 * páginas conviene usar el flujo asíncrono de Textract
 * (StartDocumentTextDetection sobre el objeto en S3 + polling/SNS). Este helper
 * cubre el caso simple; el flujo async se implementa en el handler de parsing
 * cuando `usedOcr` es necesario a escala. Ver TODO(ocr-async).
 */
async function ocrWithTextract(buffer: Buffer, client: TextractClient): Promise<string> {
  const res = await client.send(
    new DetectDocumentTextCommand({ Document: { Bytes: buffer } }),
  );
  const lines = (res.Blocks ?? [])
    .filter((b) => b.BlockType === 'LINE' && b.Text)
    .map((b) => b.Text as string);
  return lines.join('\n');
}
