/**
 * Segmenta el texto completo de un boletín en avisos individuales.
 *
 * Los boletines judiciales suelen separar avisos por número de expediente
 * (formato tipo "12-000123-0164-CI") y/o por líneas de guiones. Esta heurística
 * corta por esos marcadores. Debe afinarse con boletines reales (TODO(segment)).
 */

/** Patrón aproximado de expediente judicial de CR: NN-NNNNNN-NNNN-XX */
export const EXPEDIENTE_RE = /\b\d{2}-\d{6}-\d{4}-[A-Z]{2}\b/;

export interface RawNotice {
  text: string;
  expediente?: string;
  page?: number;
}

export function segmentNotices(fullText: string): RawNotice[] {
  const normalized = fullText.replace(/\r\n/g, '\n');

  // Estrategia: dividir en bloques separados por 2+ saltos de línea y agrupar
  // por la aparición de un número de expediente. Cada bloque que contiene un
  // expediente inicia un aviso; los bloques siguientes sin expediente se
  // adjuntan al aviso en curso.
  const blocks = normalized
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter((b) => b.length > 0);

  const notices: RawNotice[] = [];
  let current: RawNotice | null = null;

  for (const block of blocks) {
    const expMatch = block.match(EXPEDIENTE_RE);
    if (expMatch) {
      if (current) notices.push(current);
      current = { text: block, expediente: expMatch[0] };
    } else if (current) {
      current.text += `\n\n${block}`;
    } else {
      // Bloque sin expediente y sin aviso en curso: lo tratamos como aviso
      // independiente (algunos avisos no citan expediente, p.ej. disoluciones).
      notices.push({ text: block });
    }
  }
  if (current) notices.push(current);

  return notices;
}
