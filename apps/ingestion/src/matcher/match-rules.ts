import {
  NoticeCategory,
  Currency,
  normalizeText,
  normalizeCedula,
  toMinorUnits,
  type PropertyAuctionCriteriaT,
  type VehicleAuctionCriteriaT,
  type DeceasedCriteriaT,
  type DissolvedCompanyCriteriaT,
} from '@informes/shared';

/**
 * Reglas de coincidencia (evaluación en memoria).
 *
 * Convención de unidades: en los criterios de alerta, price.min/max vienen en
 * unidad MAYOR (colones/dólares); en la BD el basePrice está en céntimos. Aquí
 * se convierte con toMinorUnits antes de comparar.
 *
 * Para el matching difuso de nombres, este scaffold usa comparación por
 * subcadena normalizada. En producción conviene delegar el candidato a
 * PostgreSQL con pg_trgm (similarity) para tolerar errores de OCR — ver
 * TODO(trgm) en el matcher.
 */

interface PriceRange {
  min?: number;
  max?: number;
  currency?: Currency;
}

function priceInRange(
  basePriceMinor: bigint | null | undefined,
  currency: Currency | null | undefined,
  range: PriceRange | undefined,
): boolean {
  if (!range) return true;
  if (basePriceMinor == null) return false;
  if (range.currency && currency && range.currency !== currency) return false;
  const value = Number(basePriceMinor);
  if (range.min != null && value < toMinorUnits(range.min)) return false;
  if (range.max != null && value > toMinorUnits(range.max)) return false;
  return true;
}

function locationMatches(
  loc: { provincia?: string; canton?: string; distrito?: string } | undefined,
  auction: { provincia?: string | null; canton?: string | null; distrito?: string | null },
): boolean {
  if (!loc) return true;
  const eq = (want?: string, have?: string | null) =>
    !want || (!!have && normalizeText(have).includes(normalizeText(want)));
  return (
    eq(loc.provincia, auction.provincia) &&
    eq(loc.canton, auction.canton) &&
    eq(loc.distrito, auction.distrito)
  );
}

export interface PropertyRow {
  provincia?: string | null;
  canton?: string | null;
  distrito?: string | null;
  basePrice?: bigint | null;
  currency?: Currency | null;
  areaM2?: number | null;
}

export function matchProperty(c: PropertyAuctionCriteriaT, row: PropertyRow): boolean {
  if (!locationMatches(c.location, row)) return false;
  if (!priceInRange(row.basePrice, row.currency, c.price)) return false;
  if (c.area) {
    if (row.areaM2 == null) return false;
    if (c.area.min != null && row.areaM2 < c.area.min) return false;
    if (c.area.max != null && row.areaM2 > c.area.max) return false;
  }
  return true;
}

export interface VehicleRow {
  brand?: string | null;
  year?: number | null;
  basePrice?: bigint | null;
  currency?: Currency | null;
}

export function matchVehicle(c: VehicleAuctionCriteriaT, row: VehicleRow): boolean {
  if (!priceInRange(row.basePrice, row.currency, c.price)) return false;
  if (c.brand) {
    if (!row.brand || !normalizeText(row.brand).includes(normalizeText(c.brand))) return false;
  }
  if (c.yearMin != null) {
    if (row.year == null || row.year < c.yearMin) return false;
  }
  return true;
}

export interface DeceasedRow {
  fullNameNorm: string;
  cedulaNorm?: string | null;
}

export function matchDeceased(c: DeceasedCriteriaT, row: DeceasedRow): boolean {
  if (c.cedula) {
    return !!row.cedulaNorm && row.cedulaNorm === normalizeCedula(c.cedula);
  }
  if (c.name) {
    return row.fullNameNorm.includes(normalizeText(c.name));
  }
  return false;
}

export interface DissolvedRow {
  companyNameNorm: string;
  cedulaJuridicaNorm?: string | null;
}

export function matchDissolved(c: DissolvedCompanyCriteriaT, row: DissolvedRow): boolean {
  if (c.cedulaJuridica) {
    return !!row.cedulaJuridicaNorm && row.cedulaJuridicaNorm === normalizeCedula(c.cedulaJuridica);
  }
  if (c.name) {
    return row.companyNameNorm.includes(normalizeText(c.name));
  }
  return false;
}

/** Despacha a la regla correcta según la categoría de la alerta/aviso. */
export function evaluate(
  category: NoticeCategory,
  criteria: unknown,
  row: PropertyRow | VehicleRow | DeceasedRow | DissolvedRow,
): boolean {
  switch (category) {
    case NoticeCategory.PROPERTY_AUCTION:
      return matchProperty(criteria as PropertyAuctionCriteriaT, row as PropertyRow);
    case NoticeCategory.VEHICLE_AUCTION:
      return matchVehicle(criteria as VehicleAuctionCriteriaT, row as VehicleRow);
    case NoticeCategory.DECEASED:
      return matchDeceased(criteria as DeceasedCriteriaT, row as DeceasedRow);
    case NoticeCategory.DISSOLVED_COMPANY:
      return matchDissolved(criteria as DissolvedCompanyCriteriaT, row as DissolvedRow);
    default: {
      const _exhaustive: never = category;
      throw new Error(`Categoría no soportada: ${_exhaustive as string}`);
    }
  }
}
