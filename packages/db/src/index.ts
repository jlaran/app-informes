import { PrismaClient, Prisma } from '@prisma/client';

export * from '@prisma/client';

/**
 * Cliente Prisma base (singleton). En serverless conviene reutilizarlo entre
 * invocaciones para aprovechar el pool de conexiones.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

/**
 * Ejecuta `fn` dentro de una transacción con el tenant fijado para RLS.
 *
 * Fija `app.current_tenant` con SET LOCAL, de modo que las políticas RLS
 * (ver prisma/rls.sql) filtran automáticamente por tenant. Úsese para TODA
 * operación sobre tablas de tenant.
 *
 * @example
 * const alerts = await withTenant(tenantId, (tx) => tx.alert.findMany());
 */
export async function withTenant<T>(
  tenantId: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  client: PrismaClient = prisma,
): Promise<T> {
  return client.$transaction(async (tx) => {
    // set_config con parámetros evita inyección; `true` = LOCAL a la transacción.
    await tx.$executeRaw`SELECT set_config('app.current_tenant', ${tenantId}, true)`;
    return fn(tx);
  });
}
