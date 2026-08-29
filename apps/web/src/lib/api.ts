import type {
  Paginated,
  PropertyAuctionItem,
  VehicleAuctionItem,
  DeceasedItem,
  DissolutionItem,
  Alert,
  CreateAlertInput,
  UpdateAlertInput,
  PropertyFilters,
  VehicleFilters,
  DeceasedFilters,
  DissolutionFilters,
} from './types';

/**
 * Cliente HTTP tipado contra la API REST (NestJS).
 *
 * Endpoints (definidos por el equipo de API):
 *   GET  /api/auctions/property
 *   GET  /api/auctions/vehicle
 *   GET  /api/deceased
 *   GET  /api/dissolutions
 *   GET  /api/alerts            (tenant-scoped, requiere Authorization Bearer)
 *   POST /api/alerts
 *   PATCH/DELETE /api/alerts/:id
 *
 * Todas las respuestas de listado tienen la forma
 *   { data: T[], page, pageSize, total }.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

// ---------------------------------------------------------------------------
// TODO(auth/Cognito): mientras no exista autenticación real, usamos un tenant
// y token de demostración. Al integrar Amazon Cognito, reemplazar por el JWT
// del usuario autenticado (claim `tenant_id`) y eliminar la cabecera
// `x-demo-tenant`. Ver docs/ARCHITECTURE.md §2 y §6.
// ---------------------------------------------------------------------------
const DEMO_TENANT =
  process.env.NEXT_PUBLIC_DEMO_TENANT ?? 'demo-tenant';
const DEMO_TOKEN = process.env.NEXT_PUBLIC_DEMO_TOKEN ?? 'demo-token';

function authHeaders(): HeadersInit {
  return {
    Authorization: `Bearer ${DEMO_TOKEN}`,
    'x-demo-tenant': DEMO_TENANT,
  };
}

/** Construye un query string omitiendo valores vacíos/undefined. */
function toQuery(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === '') continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    // Los listados del dataset público cambian a diario; no cacheamos en el
    // fetch para reflejar siempre el estado más reciente (la CDN cachea aparte).
    cache: 'no-store',
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = (await res.json()) as { message?: string };
      if (body?.message) detail = body.message;
    } catch {
      /* respuesta sin cuerpo JSON */
    }
    throw new ApiError(res.status, detail);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// ---------------------------------------------------------------------------
// Listados del dataset público (fetch en el servidor — RSC).
// ---------------------------------------------------------------------------

export function listPropertyAuctions(
  filters: PropertyFilters = {},
): Promise<Paginated<PropertyAuctionItem>> {
  const qs = toQuery({
    provincia: filters.provincia,
    canton: filters.canton,
    distrito: filters.distrito,
    priceMin: filters.priceMin,
    priceMax: filters.priceMax,
    areaMin: filters.areaMin,
    areaMax: filters.areaMax,
    page: filters.page,
  });
  return request<Paginated<PropertyAuctionItem>>(`/api/auctions/property${qs}`);
}

export function listVehicleAuctions(
  filters: VehicleFilters = {},
): Promise<Paginated<VehicleAuctionItem>> {
  const qs = toQuery({
    brand: filters.brand,
    yearMin: filters.yearMin,
    priceMin: filters.priceMin,
    priceMax: filters.priceMax,
    page: filters.page,
  });
  return request<Paginated<VehicleAuctionItem>>(`/api/auctions/vehicle${qs}`);
}

export function listDeceased(
  filters: DeceasedFilters = {},
): Promise<Paginated<DeceasedItem>> {
  const qs = toQuery({
    cedula: filters.cedula,
    name: filters.name,
    page: filters.page,
  });
  return request<Paginated<DeceasedItem>>(`/api/deceased${qs}`);
}

export function listDissolutions(
  filters: DissolutionFilters = {},
): Promise<Paginated<DissolutionItem>> {
  const qs = toQuery({
    cedulaJuridica: filters.cedulaJuridica,
    name: filters.name,
    page: filters.page,
  });
  return request<Paginated<DissolutionItem>>(`/api/dissolutions${qs}`);
}

// ---------------------------------------------------------------------------
// Alertas (tenant-scoped, requieren autenticación).
// ---------------------------------------------------------------------------

export function listAlerts(): Promise<Alert[]> {
  return request<Alert[]>('/api/alerts', { headers: authHeaders() });
}

export function createAlert(input: CreateAlertInput): Promise<Alert> {
  return request<Alert>('/api/alerts', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(input),
  });
}

export function updateAlert(
  id: string,
  input: UpdateAlertInput,
): Promise<Alert> {
  return request<Alert>(`/api/alerts/${id}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify(input),
  });
}

export function deleteAlert(id: string): Promise<void> {
  return request<void>(`/api/alerts/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
}

export { ApiError };
