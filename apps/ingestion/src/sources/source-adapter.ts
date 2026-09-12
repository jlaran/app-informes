/**
 * Contrato de una fuente de boletines. Aísla el resto de la ingesta de los
 * detalles de la fuente concreta (Nexus PJ del Poder Judicial de CR).
 */

export interface BoletinRef {
  /** Número de edición del boletín (ej. "172"). */
  numero: string;
  /** ID del documento en Nexus PJ (ej. "avi-1-0155-15777"). */
  documentId: string;
  /** Fecha de publicación. */
  publishedAt: Date;
  /** URL de la página de detalle en la fuente. */
  sourceUrl: string;
}

export interface BoletinContent {
  ref: BoletinRef;
  /** HTML crudo del boletín (campo hits.html de la API). */
  html: string;
  /** Texto plano extraído del HTML, listo para el segmentador. */
  text: string;
}

export interface SourceAdapter {
  /**
   * Lista las ediciones publicadas en o después de `since`, ordenadas por fecha
   * ascendente. Debe paginar internamente.
   */
  listEditions(since: Date): Promise<BoletinRef[]>;

  /** Descarga el contenido (HTML + texto) de una edición. */
  fetchContent(ref: BoletinRef): Promise<BoletinContent>;
}
