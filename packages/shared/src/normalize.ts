/**
 * Utilidades de normalización compartidas entre el parser de ingesta y el
 * motor de alertas. Mantenerlas aquí garantiza que "lo que se guarda" y
 * "lo que se compara" usan exactamente la misma normalización.
 */

/** Quita acentos/diacríticos y pasa a minúsculas. Para comparación difusa. */
export function normalizeText(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normaliza una cédula (física o jurídica) a solo dígitos.
 * Ej: "3-101-123456" -> "3101123456", "1 1234 5678" -> "112345678".
 */
export function normalizeCedula(input: string): string {
  return input.replace(/\D+/g, '');
}

/**
 * Formatea una cédula física costarricense (9 dígitos) como "P-TTTT-DDDD".
 * Si no calza el patrón esperado, devuelve el valor de solo dígitos.
 */
export function formatCedulaFisica(input: string): string {
  const digits = normalizeCedula(input);
  if (digits.length === 9) {
    return `${digits[0]}-${digits.slice(1, 5)}-${digits.slice(5)}`;
  }
  return digits;
}

/**
 * Formatea una cédula jurídica costarricense (10 dígitos) como "3-TTT-DDDDDD".
 */
export function formatCedulaJuridica(input: string): string {
  const digits = normalizeCedula(input);
  if (digits.length === 10) {
    return `${digits[0]}-${digits.slice(1, 4)}-${digits.slice(4)}`;
  }
  return digits;
}

/** Convierte un monto en la unidad mayor (colones/dólares) a céntimos (entero). */
export function toMinorUnits(amount: number): number {
  return Math.round(amount * 100);
}

/** Convierte céntimos a la unidad mayor. */
export function fromMinorUnits(minor: number): number {
  return minor / 100;
}
