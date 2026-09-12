import {
  Currency,
  RemateNumber,
  normalizeText,
  normalizeCedula,
  toMinorUnits,
} from '@informes/shared';

/**
 * Extractores de campos por categoría. Calibrados contra el formato real (y
 * altamente formulaico) de los edictos del Boletín Judicial de Costa Rica, que
 * incluyen los montos y cédulas en CIFRAS entre paréntesis además de en letras
 * (ej. "...la suma de cincuenta millones de colones (¢50.000.000,00)...",
 * "...cédula jurídica número tres-ciento uno-... (3-101-123456)..."). Los
 * extractores se apoyan en la forma numérica, que es estable.
 *
 * Fixtures de referencia: apps/ingestion/src/parser/__fixtures__/.
 * Cada campo no hallado queda undefined/null (nunca se inventa).
 */

const PROVINCIAS = [
  'San José',
  'Alajuela',
  'Cartago',
  'Heredia',
  'Guanacaste',
  'Puntarenas',
  'Limón',
];

// Un "token" de ubicación admite letras acentuadas, espacios y algún guion.
const LOC = "[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+(?:[ '-][A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+){0,3}";

/** Extrae un monto (en céntimos) y su moneda desde el texto de un edicto. */
export function extractBasePrice(
  text: string,
): { basePrice: bigint; currency: Currency } | null {
  // 1) Preferimos la cifra entre paréntesis con símbolo: (¢50.000.000,00) / ($8,000.00)
  const paren = text.match(/[(\[]\s*([₡¢$])\s*([\d.,]+)\s*[)\]]/);
  if (paren) {
    return build(paren[1], paren[2]);
  }

  // 2) Cifra con símbolo en cualquier parte: ¢50.000.000,00 / ₡ 50.000.000 / $8,000.00
  const sym = text.match(/([₡¢$])\s*([\d][\d.,]*\d|\d)/);
  if (sym) {
    return build(sym[1], sym[2]);
  }

  // 3) "base ... <cifra> colones/dólares" sin símbolo.
  const worded = text.match(/base[^.\d]{0,80}?([\d][\d.,]*\d|\d)\s*(colones|d[óo]lares)/i);
  if (worded) {
    const currency = /d[óo]lares/i.test(worded[2] ?? '') ? Currency.USD : Currency.CRC;
    const amount = parseAmount(worded[1] ?? '');
    return amount === null ? null : { basePrice: BigInt(toMinorUnits(amount)), currency };
  }

  return null;
}

function build(
  symbol: string | undefined,
  digits: string | undefined,
): { basePrice: bigint; currency: Currency } | null {
  if (!digits) return null;
  const currency = symbol === '$' ? Currency.USD : Currency.CRC;
  const amount = parseAmount(digits);
  return amount === null ? null : { basePrice: BigInt(toMinorUnits(amount)), currency };
}

/** Parsea "50.000.000,00" (es-CR) o "8,000.00" (en) a número. */
export function parseAmount(raw: string): number | null {
  let s = raw.trim();
  if (!s) return null;
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma > lastDot) {
    // formato es-CR: . miles, , decimales
    s = s.replace(/\./g, '').replace(',', '.');
  } else {
    // formato en / entero: , miles, . decimales
    s = s.replace(/,/g, '');
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function extractRemateNumber(text: string): RemateNumber | undefined {
  const t = normalizeText(text);
  if (/\bprimer(a|o)?\b[^.]{0,20}\b(remate|subasta|convocatoria)\b|primera vez|primer remate/.test(t))
    return RemateNumber.FIRST;
  if (/\bsegund(a|o)\b[^.]{0,20}\b(remate|subasta|convocatoria)\b|segunda vez/.test(t))
    return RemateNumber.SECOND;
  if (/\btercer(a|o)?\b[^.]{0,20}\b(remate|subasta|convocatoria)\b|tercera vez/.test(t))
    return RemateNumber.THIRD;
  return undefined;
}

const PROV_BY_NORM = new Map(PROVINCIAS.map((p) => [normalizeText(p), p] as const));

/**
 * Extrae la provincia anclándola a la lista conocida (evita capturar de más,
 * p.ej. "provincia de Guanacaste la finca se encuentra..."). Prefiere la que
 * sigue a "provincia [de]"; si no, la primera provincia conocida mencionada.
 */
function extractProvincia(text: string): string | undefined {
  const t = normalizeText(text);
  // En los remates la provincia suele venir como "partido de <X>" (folio real).
  const m = t.match(/(?:provincia|partido)\s+(?:de\s+|del\s+)?([a-zñ ]{3,40})/);
  if (m?.[1]) {
    for (const [norm, proper] of PROV_BY_NORM) {
      if (m[1].startsWith(norm)) return proper;
    }
  }
  for (const [norm, proper] of PROV_BY_NORM) {
    if (t.includes(norm)) return proper;
  }
  return undefined;
}

function capture(re: RegExp, text: string): string | undefined {
  const m = text.match(re);
  return m?.[1]?.trim().replace(/\s+/g, ' ');
}

// --- Propiedades -----------------------------------------------------------

export interface PropertyFields {
  propertyType?: string;
  provincia?: string;
  canton?: string;
  distrito?: string;
  locationNorm?: string;
  matricula?: string;
  areaM2?: number;
  basePrice?: bigint;
  currency: Currency;
  remateNumber?: RemateNumber;
}

export function extractProperty(text: string): PropertyFields {
  const price = extractBasePrice(text);

  const provincia = extractProvincia(text);
  const canton = capture(new RegExp(`cant[óo]n\\s+(?:de\\s+)?(${LOC})`, 'i'), text);
  const distrito = capture(new RegExp(`distrito\\s+(?:de\\s+)?(${LOC})`, 'i'), text);

  // Matrícula: "1-234567-000" (con guiones) o "558480" (dígitos simples).
  const matricula =
    capture(/matr[íi]cula(?:\s+n[úu]mero|\s+de\s+folio\s+real)?[:\s]*(\d{1,6}-\d{3,6}(?:-[\dF]{1,3})?)/i, text) ??
    capture(/matr[íi]cula(?:\s+n[úu]mero)?[:\s]*(\d{4,7})\b/i, text) ??
    capture(/folio\s+real[:\s]*([\d-]{5,})/i, text);

  const areaRaw = capture(/(?:mide|[áa]rea(?:\s+de)?)[:\s]*([\d.,]+)\s*(?:m(?:2|²)|metros)/i, text);
  const type = capture(/\b(casa|finca|lote|terreno|edificio|apartamento|local|bodega|condominio)\b/i, text);

  const locParts = [provincia, canton, distrito].filter(Boolean).join(' ');

  return {
    propertyType: type?.toLowerCase(),
    provincia,
    canton,
    distrito,
    matricula,
    areaM2: areaRaw ? (parseAmount(areaRaw) ?? undefined) : undefined,
    locationNorm: locParts ? normalizeText(locParts) : undefined,
    basePrice: price?.basePrice,
    currency: price?.currency ?? Currency.CRC,
    remateNumber: extractRemateNumber(text),
  };
}

// --- Vehículos -------------------------------------------------------------

export interface VehicleFields {
  placa?: string;
  brand?: string;
  brandNorm?: string;
  model?: string;
  year?: number;
  basePrice?: bigint;
  currency: Currency;
  remateNumber?: RemateNumber;
}

export function extractVehicle(text: string): VehicleFields {
  const price = extractBasePrice(text);
  const placa = capture(/placa[s]?\s*(?:n[úu]mero\s*)?[:\s]*([A-ZÁÉÍÓÚ]{0,3}-?\s?\d{3,6})/i, text)?.replace(/\s+/g, '');
  const brand = capture(/marca[:\s]+([A-Za-zÁÉÍÓÚñÑ0-9-]+)/i, text);
  const model = capture(/(?:modelo|estilo)[:\s]+([A-Za-z0-9ÁÉÍÓÚñÑ ]+?)(?:[,.]|\bplaca\b|\ba[ñn]o\b|$)/i, text);
  // Solo año explícito ("año/modelo YYYY"): evita capturar el año de publicación.
  const yearRaw = capture(/(?:a[ñn]o|modelo)[:\s]+((?:19|20)\d{2})\b/i, text);

  return {
    placa,
    brand,
    brandNorm: brand ? normalizeText(brand) : undefined,
    model: model?.trim(),
    year: yearRaw ? Number(yearRaw) : undefined,
    basePrice: price?.basePrice,
    currency: price?.currency ?? Currency.CRC,
    remateNumber: extractRemateNumber(text),
  };
}

// --- Fallecidos ------------------------------------------------------------

export interface DeceasedFields {
  fullName: string;
  fullNameNorm: string;
  cedula?: string;
  cedulaNorm?: string;
  sucesorioTipo?: string;
}

const CEDULA_FISICA_RE = /\b(\d)-?(\d{4})-?(\d{4})\b/;
// Palabra de nombre: mayúscula inicial, admite todo-mayúsculas y acentos.
// Los conectores (de, la, los, del, y) pueden ir en mayúscula o minúscula.
const NAMEWORD =
  '(?:[A-ZÁÉÍÓÚÜÑ][A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+|DE|DEL|LA|LAS|LOS|Y|de|del|la|las|los|y)';
const NAME = `[A-ZÁÉÍÓÚÜÑ][A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+(?:\\s+${NAMEWORD}){1,5}`;

export function extractDeceased(text: string): DeceasedFields | null {
  // Cédula: preferimos la cifra entre paréntesis; luego cualquier patrón físico.
  const cedula =
    capture(new RegExp(`[(\\[]\\s*(${CEDULA_FISICA_RE.source})\\s*[)\\]]`), text) ??
    text.match(CEDULA_FISICA_RE)?.[0];

  // Nombre (suele ir en mayúsculas tras estas fórmulas).
  // Artículo/tratamiento opcional antes del nombre: "de la señora MARÍA…".
  const LEAD = '(?:(?:el|la|los|las)\\s+)?(?:se[ñn]or(?:a|es|ita)?\\s+)?';
  const name =
    capture(new RegExp(`quien en vida (?:se llam[óo]|fue)\\s+${LEAD}(${NAME})`), text) ??
    capture(new RegExp(`(?:proceso\\s+)?sucesorio\\s+(?:testamentario\\s+|ab\\s+intestato\\s+)?de\\s+(?:quien\\s+en\\s+vida\\s+(?:se\\s+llam[óo]|fue)\\s+)?${LEAD}(${NAME})`), text) ??
    capture(new RegExp(`(?:causante|de\\s+cujus|difunt[oa])[:\\s]+${LEAD}(${NAME})`, 'i'), text);

  if (!name) return null;
  const fullName = name.trim().replace(/\s+/g, ' ');

  return {
    fullName,
    fullNameNorm: normalizeText(fullName),
    cedula: cedula?.trim(),
    cedulaNorm: cedula ? normalizeCedula(cedula) : undefined,
    sucesorioTipo: /notarial/i.test(text)
      ? 'sucesorio notarial'
      : /testamentario/i.test(text)
        ? 'sucesorio testamentario'
        : 'sucesorio',
  };
}

// --- Sociedades disueltas --------------------------------------------------

export interface DissolvedFields {
  companyName: string;
  companyNameNorm: string;
  cedulaJuridica?: string;
  cedulaJuridicaNorm?: string;
  dissolutionType?: string;
}

// Cédula jurídica CR: 3-<clase 3 díg>-<consecutivo 6 díg> (3-101 S.A., 3-102 S.R.L., etc.)
const CEDULA_JURIDICA_RE = /\b3-?\d{3}-?\d{6}\b/;
// Sufijos societarios: abreviados o en letras.
const SUFFIX =
  '(?:S\\.?\\s?A\\.?|S\\.?\\s?R\\.?\\s?L\\.?|LTDA\\.?|SOCIEDAD\\s+AN[ÓO]NIMA|SOCIEDAD\\s+DE\\s+RESPONSABILIDAD\\s+LIMITADA)';
const COMPANY = `[A-ZÁÉÍÓÚÑ0-9][A-Za-z0-9ÁÉÍÓÚÜÑáéíóúüñ .,&'-]+?\\s+${SUFFIX}`;

export function extractDissolved(text: string): DissolvedFields | null {
  const cedula =
    capture(new RegExp(`[(\\[]\\s*(${CEDULA_JURIDICA_RE.source})\\s*[)\\]]`), text) ??
    text.match(CEDULA_JURIDICA_RE)?.[0];

  const name =
    capture(new RegExp(`(?:la\\s+)?sociedad\\s+(?:denominada\\s+|mercantil\\s+)?(${COMPANY})`, 'i'), text) ??
    capture(new RegExp(`disoluci[óo]n\\s+de\\s+(?:la\\s+sociedad\\s+)?(${COMPANY})`, 'i'), text) ??
    capture(new RegExp(`(${COMPANY})`), text);

  if (!name) return null;
  const companyName = name.trim().replace(/\s+/g, ' ');

  return {
    companyName,
    companyNameNorm: normalizeText(companyName),
    cedulaJuridica: cedula?.trim(),
    cedulaJuridicaNorm: cedula ? normalizeCedula(cedula) : undefined,
    dissolutionType: /voluntaria/i.test(text)
      ? 'disolución voluntaria'
      : /judicial/i.test(text)
        ? 'disolución judicial'
        : undefined,
  };
}
