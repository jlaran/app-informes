/**
 * Enumeraciones compartidas por toda la plataforma.
 *
 * Se definen con el patrón `const object + union type` (en vez de `enum` de TS)
 * para que sean nominalmente compatibles en AMBOS sentidos con los enums que
 * genera Prisma (uniones de string). Cada símbolo expone un valor (para uso
 * como `NoticeCategory.PROPERTY_AUCTION`) y un tipo con el mismo nombre (la
 * unión de literales).
 *
 * Los valores string deben coincidir con los `enum` de Prisma
 * (packages/db/prisma/schema.prisma).
 */

/** Las cuatro secciones/segmentos de la plataforma. */
export const NoticeCategory = {
  PROPERTY_AUCTION: 'PROPERTY_AUCTION',
  VEHICLE_AUCTION: 'VEHICLE_AUCTION',
  DECEASED: 'DECEASED',
  DISSOLVED_COMPANY: 'DISSOLVED_COMPANY',
} as const;
export type NoticeCategory = (typeof NoticeCategory)[keyof typeof NoticeCategory];

/** Estado del ciclo de vida de la ingesta de un boletín. */
export const BoletinStatus = {
  PENDING: 'PENDING',
  DOWNLOADED: 'DOWNLOADED',
  PARSING: 'PARSING',
  PARSED: 'PARSED',
  FAILED: 'FAILED',
} as const;
export type BoletinStatus = (typeof BoletinStatus)[keyof typeof BoletinStatus];

/** Número de convocatoria del remate. */
export const RemateNumber = {
  FIRST: 'FIRST',
  SECOND: 'SECOND',
  THIRD: 'THIRD',
} as const;
export type RemateNumber = (typeof RemateNumber)[keyof typeof RemateNumber];

/** Canal por el que se entrega una alerta. */
export const AlertChannel = {
  EMAIL: 'EMAIL',
  PUSH: 'PUSH',
  SMS: 'SMS',
} as const;
export type AlertChannel = (typeof AlertChannel)[keyof typeof AlertChannel];

/** Estado de notificación de una coincidencia de alerta. */
export const MatchStatus = {
  PENDING: 'PENDING',
  SENT: 'SENT',
  FAILED: 'FAILED',
} as const;
export type MatchStatus = (typeof MatchStatus)[keyof typeof MatchStatus];

/** Moneda del monto base del remate. */
export const Currency = {
  CRC: 'CRC',
  USD: 'USD',
} as const;
export type Currency = (typeof Currency)[keyof typeof Currency];

/** Rol del usuario dentro de un tenant. */
export const UserRole = {
  OWNER: 'OWNER',
  ADMIN: 'ADMIN',
  MEMBER: 'MEMBER',
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

/** Plan de suscripción del tenant. */
export const TenantPlan = {
  FREE: 'FREE',
  PRO: 'PRO',
  ENTERPRISE: 'ENTERPRISE',
} as const;
export type TenantPlan = (typeof TenantPlan)[keyof typeof TenantPlan];

/** Estado del tenant. */
export const TenantStatus = {
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
  CANCELED: 'CANCELED',
} as const;
export type TenantStatus = (typeof TenantStatus)[keyof typeof TenantStatus];
