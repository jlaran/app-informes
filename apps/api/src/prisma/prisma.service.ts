import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient, Prisma, prisma as sharedClient, withTenant } from '@informes/db';

/**
 * Envuelve el cliente Prisma compartido como proveedor de Nest.
 *
 * - `client`: acceso directo para el PLANO PÚBLICO (boletines/avisos), que no
 *   requiere tenant.
 * - `forTenant(...)`: ejecuta una función dentro de una transacción con RLS
 *   fijando `app.current_tenant` (ver @informes/db withTenant). Úsese para TODO
 *   acceso a tablas de tenant (alertas, coincidencias, guardados).
 */
@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  readonly client: PrismaClient = sharedClient;

  async onModuleInit(): Promise<void> {
    await this.client.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.$disconnect();
  }

  forTenant<T>(tenantId: string, fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return withTenant(tenantId, fn, this.client);
  }
}
