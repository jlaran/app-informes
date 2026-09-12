import { NoticeCategory } from '@informes/shared';
import { normalizeText } from '@informes/shared';

/**
 * Clasifica un aviso en una de las 4 categorías. Exige FRASES FORMALES de cada
 * tipo de edicto, no palabras sueltas: los boletines mezclan fallos, circulares
 * y avisos administrativos larguísimos donde "remate", "sucesorio", "vehículo"
 * o "finca" aparecen de forma incidental (calibrado con el Boletín N°172 real).
 *
 * Devuelve null si el bloque no es un edicto de interés (se descarta).
 */
export function classify(text: string): NoticeCategory | null {
  const t = normalizeText(text); // sin acentos, minúsculas

  // --- Remate judicial: frase de subasta, no la palabra "remate" suelta ---
  const isRemate =
    /\ba remate\b/.test(t) || // "sacar a remate", "sometido a remate", "sale a remate"
    /\bmejor postor\b/.test(t) ||
    /\bsubasta publica\b/.test(t) ||
    /\bremate en publica subasta\b/.test(t) ||
    /\bsaquese\b/.test(t);
  if (isRemate) {
    return isVehicle(t) ? NoticeCategory.VEHICLE_AUCTION : NoticeCategory.PROPERTY_AUCTION;
  }

  // --- Sucesorio: edicto que cita/emplaza a herederos, no una mención ---
  const mentionsSucesorio = /sucesori|mortuori/.test(t);
  const isFormalSucesorio =
    /cita y emplaza|se cita|se emplaza|\bemplaza a\b|\bherederos\b|\blegatarios\b|\balbacea\b/.test(t);
  if (mentionsSucesorio && isFormalSucesorio) {
    return NoticeCategory.DECEASED;
  }

  // --- Disolución de sociedad (formal) ---
  const mentionsDisolucion = /disoluci|se disuelve|disuelta|liquidaci/.test(t);
  const hasCompanySignal =
    /\bsociedad\b|\bs\.?\s?a\.?\b|\bs\.?\s?r\.?\s?l\.?\b|cedula juridica|\b3-?\d{3}-?\d{6}\b/.test(t);
  if (mentionsDisolucion && hasCompanySignal) {
    return NoticeCategory.DISSOLVED_COMPANY;
  }

  return null;
}

function isVehicle(t: string): boolean {
  return /veh.culo|autom.vil|\bplaca\b|motocicleta|cami[oó]n|furg[oó]n|\bchasis\b|\bvin\b|marca .{0,40}\bmodelo\b/.test(
    t,
  );
}
