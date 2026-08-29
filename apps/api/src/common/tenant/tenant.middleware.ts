import { Injectable, NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { verifyIdToken } from '../auth/cognito.js';
import { tenantStorage, type TenantContext } from './tenant-context.js';

/**
 * Establece el contexto de tenant por request:
 *  1. Si hay `Authorization: Bearer <idToken>` válido de Cognito, extrae
 *     tenant_id/email/sub del token.
 *  2. En desarrollo, permite un atajo con el header `x-demo-tenant` (+ opcional
 *     `x-demo-user`) para probar sin Cognito (coincide con el seed demo).
 *
 * Si no logra autenticar, NO fija contexto; las rutas protegidas responderán 401
 * mediante AuthGuard. Las rutas públicas (avisos) funcionan sin contexto.
 */
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  async use(req: Request, _res: Response, next: NextFunction): Promise<void> {
    const ctx = await this.resolveContext(req);
    if (ctx) {
      tenantStorage.enterWith(ctx);
    }
    next();
  }

  private async resolveContext(req: Request): Promise<TenantContext | undefined> {
    const auth = req.header('authorization');
    if (auth?.startsWith('Bearer ')) {
      const claims = await verifyIdToken(auth.slice('Bearer '.length));
      if (claims) {
        return { tenantId: claims.tenantId, userId: claims.sub, email: claims.email };
      }
    }

    if (process.env.NODE_ENV !== 'production') {
      const demoTenant = req.header('x-demo-tenant');
      if (demoTenant) {
        return {
          tenantId: demoTenant,
          userId: req.header('x-demo-user') ?? 'demo-user',
          email: req.header('x-demo-email') ?? 'demo@informes.example.com',
        };
      }
    }

    return undefined;
  }
}
