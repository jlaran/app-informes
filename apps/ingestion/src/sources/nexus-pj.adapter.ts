import { config } from '../config.js';
import type { BoletinRef, SourceAdapter } from './source-adapter.js';

/**
 * Adaptador para el buscador Nexus PJ del Poder Judicial de Costa Rica.
 *
 * ⚠️ IMPORTANTE — VALIDAR DESDE LA VPC:
 * Nexus PJ (https://nexuspj.poder-judicial.go.cr) es una SPA cuyo endpoint de
 * búsqueda y formato de respuesta NO están documentados públicamente y el
 * dominio solo es alcanzable desde redes de CR. Los detalles marcados con
 * `TODO(nexus)` deben confirmarse ejecutando la ingesta dentro de la VPC de AWS
 * (con salida a esa red) e inspeccionando las peticiones reales del buscador:
 *   1. El endpoint JSON que la SPA consulta al buscar
 *      `tipoInformacion:(Boletín AND Judicial)` (probable Solr/Elasticsearch).
 *   2. Los campos de cada resultado: número de edición, fecha, enlace al PDF.
 *   3. La forma de paginar (offset/cursor).
 *
 * La estructura de este adaptador (paginar → mapear → descargar) ya es la
 * definitiva; solo hay que rellenar el parseo concreto de la respuesta.
 */
export class NexusPjAdapter implements SourceAdapter {
  constructor(
    private readonly baseUrl = config.nexusPj.baseUrl,
    private readonly query = config.nexusPj.query,
  ) {}

  async listEditions(since: Date): Promise<BoletinRef[]> {
    const editions: BoletinRef[] = [];
    const pageSize = 50;
    let offset = 0;

    // Paginación defensiva con tope para no ciclar indefinidamente.
    for (let guard = 0; guard < 200; guard++) {
      const results = await this.fetchSearchPage(offset, pageSize);
      if (results.length === 0) break;

      for (const r of results) {
        if (r.publishedAt >= since) editions.push(r);
      }

      // La búsqueda viene ordenada desc por fecha; si ya pasamos `since`, paramos.
      const oldest = results[results.length - 1];
      if (oldest && oldest.publishedAt < since) break;

      offset += pageSize;
    }

    return editions.sort((a, b) => a.publishedAt.getTime() - b.publishedAt.getTime());
  }

  async downloadPdf(ref: BoletinRef): Promise<Uint8Array> {
    const url = ref.pdfUrl ?? ref.sourceUrl;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'informes-ingestion/0.1 (+contacto)' },
    });
    if (!res.ok) {
      throw new Error(`Descarga fallida (${res.status}) para ${ref.numero}: ${url}`);
    }
    return new Uint8Array(await res.arrayBuffer());
  }

  /**
   * Consulta una página del buscador y la mapea a BoletinRef[].
   *
   * TODO(nexus): reemplazar por la petición real. La forma esperada del código
   * final es algo como:
   *
   *   const res = await fetch(`${this.baseUrl}/api/search?...`, { ... });
   *   const json = await res.json();
   *   return json.hits.map(mapHitToBoletinRef);
   */
  private async fetchSearchPage(offset: number, limit: number): Promise<BoletinRef[]> {
    void offset;
    void limit;
    void this.query;
    // Sin el endpoint confirmado, no inventamos datos: devolvemos vacío para
    // que la ingesta sea un no-op seguro hasta validar desde la VPC.
    console.warn(
      '[NexusPjAdapter] fetchSearchPage no implementado: confirmar endpoint desde la VPC (ver TODO(nexus)).',
    );
    return [];
  }
}
