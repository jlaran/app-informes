import { Currency, fromMinorUnits } from '@informes/shared';

/**
 * Utilidades de formato para es-CR (Costa Rica).
 * Recuerde: los montos llegan de la API en CÉNTIMOS (unidad menor); se
 * convierten con `fromMinorUnits` (÷100) antes de formatear.
 */

const LOCALE = 'es-CR';

/**
 * Formatea un monto en céntimos a moneda es-CR.
 * @param minor Monto en la unidad menor (céntimos), tal como lo devuelve la API.
 * @param currency CRC o USD.
 */
export function formatCurrency(
  minor: number | null | undefined,
  currency: Currency = Currency.CRC,
): string {
  if (minor === null || minor === undefined) return '—';
  return new Intl.NumberFormat(LOCALE, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(fromMinorUnits(minor));
}

/** Formatea un número simple (por ejemplo, área en m²) con es-CR. */
export function formatNumber(
  value: number | null | undefined,
  suffix = '',
): string {
  if (value === null || value === undefined) return '—';
  const formatted = new Intl.NumberFormat(LOCALE, {
    maximumFractionDigits: 2,
  }).format(value);
  return suffix ? `${formatted} ${suffix}` : formatted;
}

/** Formatea una fecha ISO a formato largo es-CR (p. ej. "5 de marzo de 2026"). */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(LOCALE, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

/** Formatea una fecha ISO con hora (para remates con hora exacta). */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(LOCALE, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}
