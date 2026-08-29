/**
 * Contrato de una fuente de boletines. Aísla el resto de la ingesta de los
 * detalles de la fuente concreta (Nexus PJ hoy, otra mañana).
 */

export interface BoletinRef {
  /** Número de edición del boletín (ej. "2026-165"). */
  numero: string;
  /** Fecha de publicación. */
  publishedAt: Date;
  /** URL de la página de detalle o del documento en la fuente. */
  sourceUrl: string;
  /** URL directa de descarga del PDF, si se conoce. */
  pdfUrl?: string;
}

export interface SourceAdapter {
  /**
   * Lista las ediciones disponibles publicadas en o después de `since`.
   * Debe paginar internamente y devolverlas ordenadas por fecha ascendente.
   */
  listEditions(since: Date): Promise<BoletinRef[]>;

  /** Descarga el PDF de una edición y devuelve sus bytes. */
  downloadPdf(ref: BoletinRef): Promise<Uint8Array>;
}
