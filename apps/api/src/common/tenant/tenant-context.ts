import { AsyncLocalStorage } from 'node:async_hooks';

export interface TenantContext {
  tenantId: string;
  userId: string;
  email: string;
}

/**
 * Almacena el contexto de tenant por request (AsyncLocalStorage), de modo que
 * cualquier capa pueda recuperarlo sin pasarlo explícitamente. La frontera dura
 * de aislamiento sigue siendo la RLS de PostgreSQL; esto es defensa en
 * profundidad + ergonomía.
 */
export const tenantStorage = new AsyncLocalStorage<TenantContext>();

export function currentTenant(): TenantContext | undefined {
  return tenantStorage.getStore();
}

export function requireTenant(): TenantContext {
  const ctx = tenantStorage.getStore();
  if (!ctx) throw new Error('No hay contexto de tenant en la petición actual.');
  return ctx;
}
