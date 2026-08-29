import { CanActivate, Injectable, UnauthorizedException } from '@nestjs/common';
import { currentTenant } from '../tenant/tenant-context.js';

/**
 * Exige que exista contexto de tenant (fijado por TenantMiddleware). Aplíquese
 * a las rutas tenant-scoped (alertas, guardados, perfil).
 */
@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(): boolean {
    if (!currentTenant()) {
      throw new UnauthorizedException('Se requiere autenticación.');
    }
    return true;
  }
}
