import {
  Currency,
  RemateNumber,
  normalizeText,
  normalizeCedula,
  toMinorUnits,
} from '@informes/shared';

/**
 * Extractores de campos por categoría. Son heurísticos (regex sobre el texto
 * del aviso) y deben afinarse con boletines reales (TODO(extract)). Cada uno
 * devuelve un objeto que calza con la tabla de detalle correspondiente en
 * Prisma. Los campos no encontrados quedan undefined/null (nunca inventados).
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

/** Extrae un monto en céntimos y su moneda desde una línea de "base". */
export function extractBasePrice(
  text: string,
): { basePrice: bigint; currency: Currency } | null {
  // Ejemplos: "base de ₡50.000.000,00", "base $8,000.00", "suma de ¢1.500.000"
  const m = text.match(
    /base[^₡¢$\d]{0,40}([₡¢$]|CRC|USD)?\s*([\d.,]+)/i,
  );
  if (!m) return null;
  const symbol = (m[1] ?? '').toUpperCase();
  const currency = symbol === '$' || symbol === 'USD' ? Currency.USD : Currency.CRC;
  const amount = parseAmount(m[2] ?? '');
  if (amount === null) return null;
  return { basePrice: BigInt(toMinorUnits(amount)), currency };
}

/** Parsea "50.000.000,00" (es-CR) o "8,000.00" (en) a número. */
function parseAmount(raw: string): number | null {
  let s = raw.trim();
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma > lastDot) {
    // formato es-CR: . miles, , decimales
    s = s.replace(/\./g, '').replace(',', '.');
  } else {
    // formato en: , miles, . decimales
    s = s.replace(/,/g, '');
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function extractRemateNumber(text: string): RemateNumber | undefined {
  const t = normalizeText(text);
  if (/primer(a)? (remate|subasta|convocatoria)|primera vez/.test(t)) return RemateNumber.FIRST;
  if (/segund(a|o) (remate|subasta|convocatoria)|segunda vez/.test(t)) return RemateNumber.SECOND;
  if (/tercer(a|o) (remate|subasta|convocatoria)|tercera vez/.test(t)) return RemateNumber.THIRD;
  return undefined;
}

function findProvincia(text: string): string | undefined {
  const t = normalizeText(text);
  return PROVINCIAS.find((p) => t.includes(normalizeText(p)));
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
  const provincia = findProvincia(text);
  const matricula = text.match(/matr[íi]cula[^\d]{0,10}([\d-]+)/i)?.[1];
  const area = text.match(/([\d.,]+)\s*m(?:2|²)\b/i)?.[1];
  const type = text.match(/\b(casa|finca|lote|terreno|edificio|apartamento|local)\b/i)?.[1];

  return {
    propertyType: type?.toLowerCase(),
    provincia,
    matricula,
    areaM2: area ? (parseAmount(area) ?? undefined) : undefined,
    locationNorm: provincia ? normalizeText(provincia) : undefined,
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
  const placa = text.match(/placa[s]?[^\wáéíóú]{0,6}([A-Z]{0,3}-?\d{3,6})/i)?.[1];
  const brand = text.match(/marca[:\s]+([A-Za-zÁÉÍÓÚñÑ]+)/i)?.[1];
  const model = text.match(/(?:modelo|estilo)[:\s]+([A-Za-z0-9ÁÉÍÓÚñÑ ]+?)(?:[,.]|\bplaca\b|$)/i)?.[1];
  const year = text.match(/\b(19|20)\d{2}\b/)?.[0];

  return {
    placa,
    brand,
    brandNorm: brand ? normalizeText(brand) : undefined,
    model: model?.trim(),
    year: year ? Number(year) : undefined,
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

export function extractDeceased(text: string): DeceasedFields | null {
  // Cédula física: 1-1234-5678 o 9 dígitos.
  const cedula =
    text.match(/c[ée]dula[^\d]{0,10}(\d[-\s]?\d{4}[-\s]?\d{4})/i)?.[1] ??
    text.match(/\b\d-\d{4}-\d{4}\b/)?.[0];

  // Nombre del/la causante: "sucesorio de <NOMBRE>", "de quien en vida fue <NOMBRE>".
  const name =
    text.match(
      /(?:sucesorio|mortual)[a-z ]*de\s+([A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚñáéíóúÑ .]+?)(?:[,.]|c[ée]dula|qui[eé]n|$)/,
    )?.[1] ??
    text.match(
      /quien en vida (?:se llam[óo]|fue)\s+([A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚñáéíóúÑ .]+?)(?:[,.]|c[ée]dula|$)/,
    )?.[1];

  if (!name) return null;
  const fullName = name.trim().replace(/\s+/g, ' ');

  return {
    fullName,
    fullNameNorm: normalizeText(fullName),
    cedula: cedula?.trim(),
    cedulaNorm: cedula ? normalizeCedula(cedula) : undefined,
    sucesorioTipo: /notarial/i.test(text) ? 'sucesorio notarial' : 'sucesorio judicial',
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

export function extractDissolved(text: string): DissolvedFields | null {
  const cedula =
    text.match(/c[ée]dula\s+jur[íi]dica[^\d]{0,10}(3[-\s]?\d{3}[-\s]?\d{6})/i)?.[1] ??
    text.match(/\b3-\d{3}-\d{6}\b/)?.[0];

  const name =
    text.match(
      /(?:sociedad|disoluci[óo]n de)\s+([A-ZÁÉÍÓÚÑ][A-Za-z0-9ÁÉÍÓÚñáéíóúÑ .,&-]+?(?:S\.?A\.?|S\.?R\.?L\.?|LTDA\.?))/,
    )?.[1] ??
    text.match(/([A-ZÁÉÍÓÚÑ][A-Za-z0-9ÁÉÍÓÚñáéíóúÑ .,&-]+?(?:S\.?A\.?|S\.?R\.?L\.?|LTDA\.?))/)?.[1];

  if (!name) return null;
  const companyName = name.trim().replace(/\s+/g, ' ');

  return {
    companyName,
    companyNameNorm: normalizeText(companyName),
    cedulaJuridica: cedula?.trim(),
    cedulaJuridicaNorm: cedula ? normalizeCedula(cedula) : undefined,
    dissolutionType: /voluntaria/i.test(text) ? 'disolución voluntaria' : undefined,
  };
}
