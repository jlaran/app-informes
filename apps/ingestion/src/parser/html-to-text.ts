/**
 * Convierte el HTML de un boletín (campo `hits.html` de la API de Nexus PJ) a
 * texto plano apto para el segmentador: los cierres de bloque se vuelven saltos
 * de línea dobles (para que cada aviso quede como un bloque separado) y se
 * decodifican las entidades HTML.
 */

const NAMED_ENTITIES: Record<string, string> = {
  nbsp: ' ',
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  aacute: 'á',
  eacute: 'é',
  iacute: 'í',
  oacute: 'ó',
  uacute: 'ú',
  Aacute: 'Á',
  Eacute: 'É',
  Iacute: 'Í',
  Oacute: 'Ó',
  Uacute: 'Ú',
  ntilde: 'ñ',
  Ntilde: 'Ñ',
  uuml: 'ü',
  Uuml: 'Ü',
  ordm: 'º',
  ordf: 'ª',
  deg: '°',
  laquo: '«',
  raquo: '»',
  iexcl: '¡',
  iquest: '¿',
  hellip: '…',
  mdash: '—',
  ndash: '–',
};

function decodeEntities(input: string): string {
  return input.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, body: string) => {
    if (body[0] === '#') {
      const code =
        body[1] === 'x' || body[1] === 'X'
          ? parseInt(body.slice(2), 16)
          : parseInt(body.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return NAMED_ENTITIES[body] ?? match;
  });
}

/** Etiquetas de bloque cuyo cierre marca separación entre avisos/párrafos. */
const BLOCK_CLOSE = /<\/(p|div|tr|li|h[1-6]|section|article|table|blockquote)>/gi;

export function htmlToText(html: string): string {
  let s = html;

  // Eliminar contenido no textual.
  s = s.replace(/<script[\s\S]*?<\/script>/gi, ' ');
  s = s.replace(/<style[\s\S]*?<\/style>/gi, ' ');
  s = s.replace(/<head[\s\S]*?<\/head>/gi, ' ');
  s = s.replace(/<!--[\s\S]*?-->/g, ' ');

  // Saltos de línea a partir de la estructura.
  s = s.replace(/<br\s*\/?>/gi, '\n');
  s = s.replace(BLOCK_CLOSE, '\n\n');
  s = s.replace(/<\/td>/gi, ' ');

  // Quitar el resto de etiquetas (inline) SIN espacio, para no partir palabras
  // como "Esca<b>zú</b>". Los separadores ya los pusieron los bloques y </td>.
  s = s.replace(/<[^>]+>/g, '');

  // Decodificar entidades y normalizar espacios (preservando párrafos).
  s = decodeEntities(s);
  s = s
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return s;
}
