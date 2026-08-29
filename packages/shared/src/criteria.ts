import { z } from 'zod';
import { NoticeCategory, Currency } from './enums.js';

/**
 * Esquemas de los criterios de alerta (columna JSONB `alerts.criteria`).
 * Se validan en la API al crear/editar alertas y en el motor de matching.
 */

const priceRange = z
  .object({
    min: z.number().int().nonnegative().optional(),
    max: z.number().int().nonnegative().optional(),
    currency: z.nativeEnum(Currency).default(Currency.CRC),
  })
  .refine((v) => v.min === undefined || v.max === undefined || v.min <= v.max, {
    message: 'price.min no puede ser mayor que price.max',
  });

const areaRange = z
  .object({
    min: z.number().nonnegative().optional(),
    max: z.number().nonnegative().optional(),
  })
  .refine((v) => v.min === undefined || v.max === undefined || v.min <= v.max, {
    message: 'area.min no puede ser mayor que area.max',
  });

/** Remate de propiedades: ubicación, precio, área. */
export const PropertyAuctionCriteria = z
  .object({
    location: z
      .object({
        provincia: z.string().trim().min(1).optional(),
        canton: z.string().trim().min(1).optional(),
        distrito: z.string().trim().min(1).optional(),
      })
      .optional(),
    price: priceRange.optional(),
    area: areaRange.optional(),
  })
  .refine((v) => v.location || v.price || v.area, {
    message: 'Defina al menos un criterio (ubicación, precio o área).',
  });

/** Remate de vehículos: precio, marca, año mínimo. */
export const VehicleAuctionCriteria = z
  .object({
    price: priceRange.optional(),
    brand: z.string().trim().min(1).optional(),
    yearMin: z.number().int().min(1900).max(2100).optional(),
  })
  .refine((v) => v.price || v.brand || v.yearMin, {
    message: 'Defina al menos un criterio (precio, marca o año).',
  });

/** Personas fallecidas: cédula o nombre. */
export const DeceasedCriteria = z
  .object({
    cedula: z.string().trim().min(1).optional(),
    name: z.string().trim().min(1).optional(),
  })
  .refine((v) => v.cedula || v.name, {
    message: 'Defina al menos cédula o nombre.',
  });

/** Sociedades disueltas: cédula jurídica o nombre. */
export const DissolvedCompanyCriteria = z
  .object({
    cedulaJuridica: z.string().trim().min(1).optional(),
    name: z.string().trim().min(1).optional(),
  })
  .refine((v) => v.cedulaJuridica || v.name, {
    message: 'Defina al menos cédula jurídica o nombre.',
  });

export type PropertyAuctionCriteriaT = z.infer<typeof PropertyAuctionCriteria>;
export type VehicleAuctionCriteriaT = z.infer<typeof VehicleAuctionCriteria>;
export type DeceasedCriteriaT = z.infer<typeof DeceasedCriteria>;
export type DissolvedCompanyCriteriaT = z.infer<typeof DissolvedCompanyCriteria>;

export type AlertCriteria =
  | PropertyAuctionCriteriaT
  | VehicleAuctionCriteriaT
  | DeceasedCriteriaT
  | DissolvedCompanyCriteriaT;

/** Devuelve el esquema Zod correcto según la categoría de la alerta. */
export function criteriaSchemaFor(category: NoticeCategory) {
  switch (category) {
    case NoticeCategory.PROPERTY_AUCTION:
      return PropertyAuctionCriteria;
    case NoticeCategory.VEHICLE_AUCTION:
      return VehicleAuctionCriteria;
    case NoticeCategory.DECEASED:
      return DeceasedCriteria;
    case NoticeCategory.DISSOLVED_COMPANY:
      return DissolvedCompanyCriteria;
    default: {
      const _exhaustive: never = category;
      throw new Error(`Categoría desconocida: ${_exhaustive as string}`);
    }
  }
}

/** Valida y normaliza los criterios de una alerta para la categoría dada. */
export function parseCriteria(category: NoticeCategory, criteria: unknown): AlertCriteria {
  return criteriaSchemaFor(category).parse(criteria) as AlertCriteria;
}
