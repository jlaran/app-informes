import { Injectable } from '@nestjs/common';
import { Prisma } from '@informes/db';
import { toMinorUnits, normalizeText } from '@informes/shared';
import { PrismaService } from '../../prisma/prisma.service.js';
import { paginated, serializeAmount, type Paginated } from '../../common/pagination.js';
import type { PropertyQuery, VehicleQuery } from './dto.js';

@Injectable()
export class AuctionsService {
  constructor(private readonly prisma: PrismaService) {}

  async listProperty(q: PropertyQuery): Promise<Paginated<unknown>> {
    const where: Prisma.PropertyAuctionWhereInput = {};

    if (q.provincia) where.provincia = { contains: q.provincia, mode: 'insensitive' };
    if (q.canton) where.canton = { contains: q.canton, mode: 'insensitive' };
    if (q.distrito) where.distrito = { contains: q.distrito, mode: 'insensitive' };

    if (q.priceMin != null || q.priceMax != null) {
      where.basePrice = {};
      if (q.priceMin != null) where.basePrice.gte = BigInt(toMinorUnits(q.priceMin));
      if (q.priceMax != null) where.basePrice.lte = BigInt(toMinorUnits(q.priceMax));
    }
    if (q.areaMin != null || q.areaMax != null) {
      where.areaM2 = {};
      if (q.areaMin != null) where.areaM2.gte = new Prisma.Decimal(q.areaMin);
      if (q.areaMax != null) where.areaM2.lte = new Prisma.Decimal(q.areaMax);
    }

    const [rows, total] = await Promise.all([
      this.prisma.client.propertyAuction.findMany({
        where,
        include: { notice: { select: { publishedAt: true, expediente: true, despacho: true } } },
        orderBy: { remateDate: 'asc' },
        skip: q.skip,
        take: q.pageSize,
      }),
      this.prisma.client.propertyAuction.count({ where }),
    ]);

    const data = rows.map((r) => ({
      id: r.id,
      noticeId: r.noticeId,
      propertyType: r.propertyType,
      provincia: r.provincia,
      canton: r.canton,
      distrito: r.distrito,
      matricula: r.matricula,
      areaM2: r.areaM2 == null ? null : Number(r.areaM2),
      basePrice: serializeAmount(r.basePrice),
      currency: r.currency,
      remateNumber: r.remateNumber,
      remateDate: r.remateDate,
      publishedAt: r.notice.publishedAt,
      expediente: r.notice.expediente,
      despacho: r.notice.despacho,
    }));

    return paginated(data, total, q);
  }

  async listVehicle(q: VehicleQuery): Promise<Paginated<unknown>> {
    const where: Prisma.VehicleAuctionWhereInput = {};

    if (q.brand) where.brandNorm = { contains: normalizeText(q.brand) };
    if (q.yearMin != null) where.year = { gte: q.yearMin };

    if (q.priceMin != null || q.priceMax != null) {
      where.basePrice = {};
      if (q.priceMin != null) where.basePrice.gte = BigInt(toMinorUnits(q.priceMin));
      if (q.priceMax != null) where.basePrice.lte = BigInt(toMinorUnits(q.priceMax));
    }

    const [rows, total] = await Promise.all([
      this.prisma.client.vehicleAuction.findMany({
        where,
        include: { notice: { select: { publishedAt: true, expediente: true, despacho: true } } },
        orderBy: { remateDate: 'asc' },
        skip: q.skip,
        take: q.pageSize,
      }),
      this.prisma.client.vehicleAuction.count({ where }),
    ]);

    const data = rows.map((r) => ({
      id: r.id,
      noticeId: r.noticeId,
      placa: r.placa,
      brand: r.brand,
      model: r.model,
      year: r.year,
      basePrice: serializeAmount(r.basePrice),
      currency: r.currency,
      remateNumber: r.remateNumber,
      remateDate: r.remateDate,
      publishedAt: r.notice.publishedAt,
      expediente: r.notice.expediente,
      despacho: r.notice.despacho,
    }));

    return paginated(data, total, q);
  }
}
