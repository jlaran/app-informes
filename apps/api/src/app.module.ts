import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module.js';
import { TenantMiddleware } from './common/tenant/tenant.middleware.js';
import { AuctionsModule } from './modules/auctions/auctions.module.js';
import { DeceasedModule } from './modules/deceased/deceased.module.js';
import { DissolutionsModule } from './modules/dissolutions/dissolutions.module.js';
import { AlertsModule } from './modules/alerts/alerts.module.js';
import { HealthModule } from './modules/health/health.module.js';

@Module({
  imports: [
    PrismaModule,
    AuctionsModule,
    DeceasedModule,
    DissolutionsModule,
    AlertsModule,
    HealthModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // El contexto de tenant se resuelve para todas las rutas; las rutas
    // públicas simplemente lo ignoran, las protegidas lo exigen vía AuthGuard.
    consumer.apply(TenantMiddleware).forRoutes('*');
  }
}
