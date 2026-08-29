import type {
  NoticeCategory,
  AlertChannel,
  Currency,
  RemateNumber,
} from '@informes/shared';
import type { AlertCriteria } from '@informes/shared';

// Re-exportamos el tipo de criterios para que la UI lo consuma desde un solo
// lugar (@/lib/types) sin acoplar cada componente al paquete compartido.
export type { AlertCriteria } from '@informes/shared';

/**
 * Tipos de las respuestas de la API REST consumida por la web.
 * La fuente de verdad de los modelos es packages/db/prisma/schema.prisma;
 * aquí modelamos únicamente la forma serializada (JSON) que devuelve la API.
 */

/** Envoltura paginada común a todos los endpoints de listado. */
export interface Paginated<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
}

/** Campos comunes a todo aviso (tabla base `notices`). */
export interface NoticeBase {
  id: string;
  category: NoticeCategory;
  expediente: string | null;
  despacho: string | null;
  publishedAt: string; // ISO 8601
  page: number | null;
}

/** Remate de propiedad (notices + property_auctions). */
export interface PropertyAuctionItem extends NoticeBase {
  propertyType: string | null;
  provincia: string | null;
  canton: string | null;
  distrito: string | null;
  matricula: string | null;
  /** Área en m². */
  areaM2: number | null;
  /** Precio base en céntimos (unidad menor). */
  basePrice: number | null;
  currency: Currency;
  remateNumber: RemateNumber | null;
  remateDate: string | null;
  demandado: string | null;
  actor: string | null;
}

/** Remate de vehículo (notices + vehicle_auctions). */
export interface VehicleAuctionItem extends NoticeBase {
  placa: string | null;
  brand: string | null;
  model: string | null;
  year: number | null;
  /** Precio base en céntimos (unidad menor). */
  basePrice: number | null;
  currency: Currency;
  remateNumber: RemateNumber | null;
  remateDate: string | null;
  demandado: string | null;
  actor: string | null;
}

/** Persona fallecida (notices + deceased_persons). */
export interface DeceasedItem extends NoticeBase {
  fullName: string;
  cedula: string | null;
  fechaDefuncion: string | null;
  sucesorioTipo: string | null;
}

/** Sociedad disuelta (notices + dissolved_companies). */
export interface DissolutionItem extends NoticeBase {
  companyName: string;
  cedulaJuridica: string | null;
  dissolutionType: string | null;
}

/** Alerta (tenant-scoped). */
export interface Alert {
  id: string;
  name: string;
  category: NoticeCategory;
  channel: AlertChannel;
  criteria: AlertCriteria;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Cuerpo para crear una alerta. */
export interface CreateAlertInput {
  name: string;
  category: NoticeCategory;
  channel: AlertChannel;
  criteria: AlertCriteria;
}

/** Cuerpo para actualizar una alerta (parcial). */
export interface UpdateAlertInput {
  name?: string;
  channel?: AlertChannel;
  criteria?: AlertCriteria;
  isActive?: boolean;
}

/** Filtros de remates de propiedades. */
export interface PropertyFilters {
  provincia?: string;
  canton?: string;
  distrito?: string;
  priceMin?: number;
  priceMax?: number;
  areaMin?: number;
  areaMax?: number;
  page?: number;
}

/** Filtros de remates de vehículos. */
export interface VehicleFilters {
  brand?: string;
  yearMin?: number;
  priceMin?: number;
  priceMax?: number;
  page?: number;
}

/** Filtros de personas fallecidas. */
export interface DeceasedFilters {
  cedula?: string;
  name?: string;
  page?: number;
}

/** Filtros de sociedades disueltas. */
export interface DissolutionFilters {
  cedulaJuridica?: string;
  name?: string;
  page?: number;
}
