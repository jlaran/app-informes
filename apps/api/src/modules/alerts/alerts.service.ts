import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@informes/db';
import { parseCriteria, NoticeCategory } from '@informes/shared';
import { ZodError } from 'zod';
import { PrismaService } from '../../prisma/prisma.service.js';
import { requireTenant } from '../../common/tenant/tenant-context.js';
import type { CreateAlertDto, UpdateAlertDto } from './dto.js';

@Injectable()
export class AlertsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Valida los criterios contra el esquema Zod de la categoría. */
  private validateCriteria(category: NoticeCategory, criteria: unknown) {
    try {
      return parseCriteria(category, criteria);
    } catch (err) {
      if (err instanceof ZodError) {
        throw new BadRequestException({
          message: 'Criterios de alerta inválidos.',
          issues: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        });
      }
      throw err;
    }
  }

  /** Resuelve (o crea) el usuario del contexto dentro del tenant. */
  private async resolveUserId(tx: Prisma.TransactionClient): Promise<string> {
    const ctx = requireTenant();
    const user = await tx.user.upsert({
      where: { cognitoSub: ctx.userId },
      update: {},
      create: { tenantId: ctx.tenantId, cognitoSub: ctx.userId, email: ctx.email },
      select: { id: true },
    });
    return user.id;
  }

  async list() {
    const { tenantId } = requireTenant();
    return this.prisma.forTenant(tenantId, (tx) =>
      tx.alert.findMany({ orderBy: { createdAt: 'desc' } }),
    );
  }

  async create(dto: CreateAlertDto) {
    const { tenantId } = requireTenant();
    const criteria = this.validateCriteria(dto.category, dto.criteria);

    return this.prisma.forTenant(tenantId, async (tx) => {
      const userId = await this.resolveUserId(tx);
      return tx.alert.create({
        data: {
          tenantId,
          userId,
          name: dto.name,
          category: dto.category,
          channel: dto.channel,
          criteria: criteria as Prisma.InputJsonValue,
        },
      });
    });
  }

  async update(id: string, dto: UpdateAlertDto) {
    const { tenantId } = requireTenant();

    return this.prisma.forTenant(tenantId, async (tx) => {
      const existing = await tx.alert.findUnique({ where: { id } });
      if (!existing) throw new NotFoundException('Alerta no encontrada.');

      const data: Prisma.AlertUpdateInput = {};
      if (dto.name !== undefined) data.name = dto.name;
      if (dto.channel !== undefined) data.channel = dto.channel;
      if (dto.isActive !== undefined) data.isActive = dto.isActive;
      if (dto.criteria !== undefined) {
        const criteria = this.validateCriteria(existing.category, dto.criteria);
        data.criteria = criteria as Prisma.InputJsonValue;
      }

      return tx.alert.update({ where: { id }, data });
    });
  }

  async remove(id: string) {
    const { tenantId } = requireTenant();
    return this.prisma.forTenant(tenantId, async (tx) => {
      const existing = await tx.alert.findUnique({ where: { id } });
      if (!existing) throw new NotFoundException('Alerta no encontrada.');
      await tx.alert.delete({ where: { id } });
      return { ok: true };
    });
  }

  /** Coincidencias recientes de las alertas del tenant. */
  async matches() {
    const { tenantId } = requireTenant();
    return this.prisma.forTenant(tenantId, (tx) =>
      tx.alertMatch.findMany({
        orderBy: { matchedAt: 'desc' },
        take: 100,
        include: { alert: { select: { name: true, category: true } }, notice: true },
      }),
    );
  }
}
