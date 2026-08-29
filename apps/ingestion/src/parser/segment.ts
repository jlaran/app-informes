/**
 * Segmenta el texto completo de un boletín en avisos individuales.
 *
 * Los edictos del Boletín Judicial son formulaicos y casi siempre abren con una
 * frase de apertura reconocible ("En este Despacho/Juzgado…", "Se hace saber…",
 * "Por resolución…", "Se comunica…"). Cortamos por esas frases de inicio y, como
 * respaldo, por el número de expediente. Un bloque que no abre un aviso nuevo se
 * adjunta como continuación del aviso en curso.
 *
 * La masthead y los encabezados de sección ("REMATES", "SUCESORIOS") no abren
 * aviso y, al no clasificar, se descartan aguas abajo.
 */

/** Patrón aproximado de expediente judicial de CR: NN-NNNNNN-NNNN-XX */
export const EXPEDIENTE_RE = /\b\d{2}-\d{6}-\d{4}-[A-Z]{2}\b/;

/** Frases con las que típicamente inicia un edicto. */
const STARTER_RE =
  /^(?:En este (?:Despacho|Juzgado)|En el (?:proceso|Juzgado)|Ante est[ae]|Se hace saber|Se comunica|Se cita|Se notifica|Se pone en conocimiento|Por (?:resoluci[óo]n|escritura|sentencia|auto)|El suscrito|La suscrita|Hágase saber)/i;

export interface RawNotice {
  text: string;
  expediente?: string;
  page?: number;
}

export function segmentNotices(fullText: string): RawNotice[] {
  const normalized = fullText.replace(/\r\n/g, '\n');

  const blocks = normalized
    .split(/\n{2,}/)
    .map((b) => b.replace(/\s+/g, ' ').trim())
    .filter((b) => b.length > 0);

  const notices: RawNotice[] = [];
  let current: RawNotice | null = null;

  const push = () => {
    if (current) {
      current.expediente = current.text.match(EXPEDIENTE_RE)?.[0];
      notices.push(current);
      current = null;
    }
  };

  for (const block of blocks) {
    const startsNotice = STARTER_RE.test(block) || (!current && EXPEDIENTE_RE.test(block));
    if (startsNotice) {
      push();
      current = { text: block };
    } else if (current) {
      current.text += `\n${block}`;
    } else {
      // Bloque suelto (masthead / encabezado de sección): aviso independiente
      // que casi siempre no clasificará y se descartará.
      notices.push({ text: block, expediente: block.match(EXPEDIENTE_RE)?.[0] });
    }
  }
  push();

  return notices;
}
