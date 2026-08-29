/** Utilidades para leer `searchParams` de las páginas (App Router). */

export type RawSearchParams = Record<string, string | string[] | undefined>;

/** Devuelve el primer valor string de un parámetro, o undefined. */
export function str(
  params: RawSearchParams,
  key: string,
): string | undefined {
  const value = params[key];
  const first = Array.isArray(value) ? value[0] : value;
  const trimmed = first?.trim();
  return trimmed ? trimmed : undefined;
}

/** Devuelve un parámetro numérico (entero) o undefined si no es válido. */
export function num(
  params: RawSearchParams,
  key: string,
): number | undefined {
  const raw = str(params, key);
  if (raw === undefined) return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/** Página actual (>= 1). */
export function pageNum(params: RawSearchParams): number {
  const p = num(params, 'page');
  return p && p >= 1 ? Math.floor(p) : 1;
}
