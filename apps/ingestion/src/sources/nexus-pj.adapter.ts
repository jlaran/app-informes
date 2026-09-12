import { config } from '../config.js';
import { htmlToText } from '../parser/html-to-text.js';
import type { BoletinRef, BoletinContent, SourceAdapter } from './source-adapter.js';

/**
 * Adaptador para el buscador Nexus PJ del Poder Judicial de Costa Rica.
 *
 * API interna (AngularJS) descubierta desde el navegador:
 *   POST /api/document  body {"id":"<docId>"}
 *     → { hits: { numeroDocumento, fecha, fechaPublicacion, id, html, ... } }
 *       `html` es el boletín COMPLETO (todos los avisos) — se extrae a texto y
 *       se pasa por el mismo parser. (No hay PDF ni OCR.)
 *   POST /api/search   body { ... query tipoInformacion:(Boletín AND Judicial) ... }
 *     → lista de boletines (uno por día).
 *
 * ⚠️ El sitio solo es alcanzable desde redes de Costa Rica y está tras una
 * protección de bots (cookies BNIS y x-bni). Si un fetch directo recibe 403,
 * defina NEXUS_PJ_COOKIE con la cookie de una sesión de navegador, o use el
 * fallback con navegador headless (ver TODO(nexus-bot)).
 */
export class NexusPjAdapter implements SourceAdapter {
  constructor(
    private readonly baseUrl = config.nexusPj.baseUrl,
    private readonly query = config.nexusPj.query,
  ) {}

  private headers(): Record<string, string> {
    const h: Record<string, string> = {
      Accept: 'application/json, text/plain, */*',
      'Content-Type': 'application/json;charset=UTF-8',
      Origin: this.baseUrl,
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36',
    };
    if (config.nexusPj.cookie) h.Cookie = config.nexusPj.cookie;
    return h;
  }

  private async post<T>(path: string, body: unknown, referer?: string): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: { ...this.headers(), ...(referer ? { Referer: referer } : {}) },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(
        `Nexus PJ ${path} respondió ${res.status}. ` +
          (res.status === 403
            ? 'Posible bloqueo de bots: defina NEXUS_PJ_COOKIE o use el fallback headless.'
            : ''),
      );
    }
    return (await res.json()) as T;
  }

  /**
   * Descarga el contenido de un boletín por su ID de documento.
   * Endpoint confirmado: POST /api/document {"id": "..."}.
   */
  async fetchContent(ref: BoletinRef): Promise<BoletinContent> {
    const data = await this.post<{ hits?: { html?: string } }>(
      '/api/document',
      { id: ref.documentId },
      `${this.baseUrl}/document/${ref.documentId}`,
    );
    const html = data.hits?.html ?? '';
    return { ref, html, text: htmlToText(html) };
  }

  /**
   * Lista las ediciones del boletín publicadas en o después de `since`.
   *
   * Usa POST /api/search con la query tipoInformacion:(Boletín AND Judicial).
   * TODO(search-body): confirmar el cuerpo exacto de la petición /api/search con
   * el "Copy as cURL" de esa llamada (paginación y nombre de campos). La forma
   * de abajo mapea la respuesta de forma defensiva.
   */
  async listEditions(since: Date): Promise<BoletinRef[]> {
    const pageSize = 50;
    const editions: BoletinRef[] = [];

    for (let from = 0; from < 5000; from += pageSize) {
      const data = await this.post<SearchResponse>('/api/search', {
        q: this.query,
        advanced: true,
        from,
        size: pageSize,
      });

      const hits = extractHits(data);
      if (hits.length === 0) break;

      let allOlder = true;
      for (const h of hits) {
        const ref = hitToRef(h, this.baseUrl);
        if (!ref) continue;
        if (ref.publishedAt >= since) {
          editions.push(ref);
          allOlder = false;
        }
      }
      // La búsqueda viene ordenada por fecha desc; si toda la página es anterior
      // a `since`, dejamos de paginar.
      if (allOlder) break;
    }

    return editions.sort((a, b) => a.publishedAt.getTime() - b.publishedAt.getTime());
  }
}

// --- Mapeo defensivo de la respuesta de /api/search --------------------------

interface Hit {
  id?: string;
  numeroDocumento?: string;
  fecha?: string;
  fechaPublicacion?: string;
}
interface SearchResponse {
  hits?: Hit[] | { hits?: Hit[] };
  results?: Hit[];
}

function extractHits(data: SearchResponse): Hit[] {
  if (Array.isArray(data.hits)) return data.hits;
  if (data.hits && Array.isArray(data.hits.hits)) return data.hits.hits;
  if (Array.isArray(data.results)) return data.results;
  return [];
}

function hitToRef(h: Hit, baseUrl: string): BoletinRef | null {
  if (!h.id) return null;
  const dateStr = h.fechaPublicacion ?? h.fecha;
  if (!dateStr) return null;
  return {
    numero: h.numeroDocumento ?? h.id,
    documentId: h.id,
    publishedAt: new Date(dateStr),
    sourceUrl: `${baseUrl}/document/${h.id}`,
  };
}
