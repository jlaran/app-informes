import {
  NoticeCategory,
  AlertChannel,
  Currency,
  RemateNumber,
} from '@informes/shared';

/**
 * Etiquetas en español para los enums compartidos. No dupliques los VALORES
 * de los enums (viven en @informes/shared); esto solo mapea a texto de UI.
 */

export const CATEGORY_LABELS: Record<NoticeCategory, string> = {
  [NoticeCategory.PROPERTY_AUCTION]: 'Remates de Propiedades',
  [NoticeCategory.VEHICLE_AUCTION]: 'Remates de Vehículos',
  [NoticeCategory.DECEASED]: 'Personas Fallecidas',
  [NoticeCategory.DISSOLVED_COMPANY]: 'Sociedades Disueltas',
};

export const CHANNEL_LABELS: Record<AlertChannel, string> = {
  [AlertChannel.EMAIL]: 'Correo electrónico',
  [AlertChannel.PUSH]: 'Notificación push',
  [AlertChannel.SMS]: 'SMS',
};

export const CURRENCY_LABELS: Record<Currency, string> = {
  [Currency.CRC]: 'Colones (CRC)',
  [Currency.USD]: 'Dólares (USD)',
};

export const REMATE_NUMBER_LABELS: Record<RemateNumber, string> = {
  [RemateNumber.FIRST]: 'Primer remate',
  [RemateNumber.SECOND]: 'Segundo remate',
  [RemateNumber.THIRD]: 'Tercer remate',
};

/** Ruta de listado por categoría (para enlaces del dashboard). */
export const CATEGORY_HREF: Record<NoticeCategory, string> = {
  [NoticeCategory.PROPERTY_AUCTION]: '/remates/propiedades',
  [NoticeCategory.VEHICLE_AUCTION]: '/remates/vehiculos',
  [NoticeCategory.DECEASED]: '/fallecidos',
  [NoticeCategory.DISSOLVED_COMPANY]: '/sociedades',
};
